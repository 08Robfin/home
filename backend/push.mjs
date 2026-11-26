import {createECDH,createCipheriv,createPrivateKey,generateKeyPairSync,hkdfSync,randomBytes,sign} from 'node:crypto';
import {id,now,fail,hash} from './domain.mjs';
import {transaction} from './db.mjs';

// RFC 8291 payload encryption and RFC 8292 VAPID, using Node's standard crypto primitives.
export function pushKeys(db) {
  return transaction(db,()=>{
    let keys=db.prepare('SELECT * FROM push_config WHERE id=1').get();
    if(!keys){const {privateKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});const jwk=privateKey.export({format:'jwk'});const pub=Buffer.concat([Buffer.from([4]),Buffer.from(jwk.x,'base64url'),Buffer.from(jwk.y,'base64url')]).toString('base64url');db.prepare('INSERT INTO push_config VALUES(1,?,?)').run(JSON.stringify(jwk),pub);keys=db.prepare('SELECT * FROM push_config WHERE id=1').get();}
    return keys;
  });
}
export function validateSubscription(value) {
  let url;try{url=new URL(value?.endpoint);}catch{fail('Invalid notification subscription.');}
  const host=url.hostname;
  const allowed=host==='fcm.googleapis.com'||host==='updates.push.services.mozilla.com'||host.endsWith('.push.apple.com')||host.endsWith('.notify.windows.com');
  if(url.protocol!=='https:'||url.port||url.username||url.password||url.hash||!allowed||url.href.length>2048)fail('Unsupported notification service.');
  const p=value?.keys?.p256dh,a=value?.keys?.auth;
  if(typeof p!=='string'||typeof a!=='string'||!/^[A-Za-z0-9_-]{87}=?$/.test(p)||!/^[A-Za-z0-9_-]{22}={0,2}$/.test(a))fail('Invalid notification keys.');
  const pub=Buffer.from(p,'base64url'),auth=Buffer.from(a,'base64url');
  try{if(pub.length!==65||pub[0]!==4||auth.length!==16)throw Error();const check=createECDH('prime256v1');check.generateKeys();check.computeSecret(pub);}catch{fail('Invalid notification keys.');}
  return {endpoint:url.href,p256dh:p,auth:a};
}
export function encryptPush(subscription,payload,{salt=randomBytes(16),sender=null}={}) {
  if(!sender){sender=createECDH('prime256v1');sender.generateKeys();}
  const receiver=Buffer.from(subscription.p256dh,'base64url'),pub=sender.getPublicKey();
  const info=Buffer.concat([Buffer.from('WebPush: info\0'),receiver,pub]);
  const ikm=hkdfSync('sha256',sender.computeSecret(receiver),Buffer.from(subscription.auth,'base64url'),info,32);
  const key=hkdfSync('sha256',ikm,salt,Buffer.from('Content-Encoding: aes128gcm\0'),16);
  const nonce=hkdfSync('sha256',ikm,salt,Buffer.from('Content-Encoding: nonce\0'),12);
  const plain=Buffer.isBuffer(payload)?payload:Buffer.from(JSON.stringify(payload));
  if(plain.length>3993)throw new Error('Push payload too large');
  const cipher=createCipheriv('aes-128-gcm',key,nonce),header=Buffer.alloc(21);salt.copy(header);header.writeUInt32BE(4096,16);header[20]=65;
  return Buffer.concat([header,pub,cipher.update(Buffer.concat([plain,Buffer.from([2])])),cipher.final(),cipher.getAuthTag()]);
}
export function vapidAuthorization(endpoint,keys,subject) {
  const encode=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
  const input=encode({typ:'JWT',alg:'ES256'})+'.'+encode({aud:new URL(endpoint).origin,exp:Math.floor(now()/1000)+43200,sub:subject});
  const signature=sign('sha256',Buffer.from(input),{key:createPrivateKey({key:JSON.parse(keys.private_jwk),format:'jwk'}),dsaEncoding:'ieee-p1363'}).toString('base64url');
  return `vapid t=${input}.${signature}, k=${keys.public_key}`;
}
export function queuePush(db,subscriptionId,key,payload) {db.prepare('INSERT OR IGNORE INTO push_outbox(id,event_key,subscription_id,payload,next_attempt,created) VALUES(?,?,?,?,?,?)').run(id(),key,subscriptionId,JSON.stringify(payload),now(),now());}
export async function deliverPushOne(db,{origin,fetchImpl=fetch}={}) {
  const row=transaction(db,()=>{const r=db.prepare("SELECT o.*,s.endpoint,s.p256dh,s.auth FROM push_outbox o JOIN push_subscriptions s ON s.id=o.subscription_id WHERE o.status IN ('pending','processing') AND o.next_attempt<=? ORDER BY o.created LIMIT 1").get(now());if(!r)return null;db.prepare("UPDATE push_outbox SET status='processing',attempts=attempts+1,next_attempt=? WHERE id=?").run(now()+60000,r.id);return r;});
  if(!row)return false;
  let status=0;
  try {
    if(row.created<now()-23*3600000)throw Object.assign(new Error(),{expired:true});
    validateSubscription({endpoint:row.endpoint,keys:{p256dh:row.p256dh,auth:row.auth}});
    const body=encryptPush(row,Buffer.from(row.payload));
    const response=await fetchImpl(row.endpoint,{method:'POST',redirect:'error',headers:{Authorization:vapidAuthorization(row.endpoint,pushKeys(db),origin),'Content-Type':'application/octet-stream','Content-Encoding':'aes128gcm',TTL:'3600',Urgency:'normal',Topic:hash(row.event_key).slice(0,32)},body,signal:AbortSignal.timeout(10000)});
    status=response.status;
    if(status===404||status===410){db.prepare('DELETE FROM push_subscriptions WHERE id=?').run(row.subscription_id);return true;}
    if(!response.ok)throw new Error();
    db.prepare("UPDATE push_outbox SET status='sent',payload='',error=NULL WHERE id=?").run(row.id);
  }catch(e){const retry=!e.expired&&(!status||status===429||status>=500)&&row.attempts<6;db.prepare('UPDATE push_outbox SET status=?,next_attempt=?,payload=?,error=? WHERE id=?').run(retry?'pending':'failed',now()+Math.min(3600000,30000*2**row.attempts),retry?row.payload:'',status?`Push HTTP ${status}`:'Push unavailable',row.id);}
  return true;
}
