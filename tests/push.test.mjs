import test from 'node:test';
import assert from 'node:assert/strict';
import {createECDH,createPublicKey,verify} from 'node:crypto';
import {openDb} from '../backend/db.mjs';
import {encryptPush,validateSubscription,pushKeys,vapidAuthorization,queuePush,deliverPushOne} from '../backend/push.mjs';
import {scheduleReminders,localSchedule} from '../backend/reminders.mjs';
import {now,enqueue} from '../backend/domain.mjs';

const receiver=createECDH('prime256v1');receiver.generateKeys();
const subscription={endpoint:'https://web.push.apple.com/test-only',keys:{p256dh:receiver.getPublicKey().toString('base64url'),auth:Buffer.alloc(16,1).toString('base64url')}};
function fixture(){const db=openDb(':memory:');db.prepare('INSERT INTO users(id,email,name,password,verified,reminders,created) VALUES(?,?,?,?,1,1,?)').run('u','u@example.test','Demo','synthetic',now());db.prepare('INSERT INTO households VALUES(?,?,?)').run('h','Demo household',now());db.prepare("INSERT INTO members VALUES('h','u','owner')").run();db.prepare('INSERT INTO push_subscriptions VALUES(?,?,?,?,?,?)').run('s','u',subscription.endpoint,subscription.keys.p256dh,subscription.keys.auth,now());return db;}
function chore(db,id,due,done=0){db.prepare('INSERT INTO chores(id,household_id,title,assignee,due,done,created) VALUES(?,?,?,?,?,?,?)').run(id,'h',id,'u',due,done,now());}

test('push encryption matches the published RFC 8291 vector byte for byte',()=>{
  const sender=createECDH('prime256v1');sender.setPrivateKey(Buffer.from('yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw','base64url'));
  const body=encryptPush({p256dh:'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',auth:'BTBZMqHH6r4Tts7J_aSIgg'},Buffer.from('When I grow up, I want to be a watermelon'),{sender,salt:Buffer.from('DGv6ra1nlYgDCS1FRnbzlw','base64url')});
  assert.equal(body.toString('base64url'),'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN');
});
test('VAPID signatures verify independently and keys persist without returning private material',()=>{
  const db=fixture();try{const keys=pushKeys(db);assert.equal(pushKeys(db).public_key,keys.public_key);const header=vapidAuthorization(subscription.endpoint,keys,'https://home.example.test');assert.equal(vapidAuthorization(subscription.endpoint,keys,'https://home.example.test'),header);const jwt=header.match(/t=([^,]+)/)[1];const [a,b,c]=jwt.split('.');assert.equal(JSON.parse(Buffer.from(b,'base64url')).aud,'https://web.push.apple.com');assert.equal(verify('sha256',Buffer.from(a+'.'+b),{key:createPublicKey({key:JSON.parse(keys.private_jwk),format:'jwk'}),dsaEncoding:'ieee-p1363'},Buffer.from(c,'base64url')),true);}finally{db.close();}
});
test('subscription validation rejects private endpoints, redirects, credentials and invalid curve points',()=>{
  assert.equal(validateSubscription(subscription).endpoint,subscription.endpoint);
  for(const endpoint of ['http://web.push.apple.com/x','https://127.0.0.1/x','https://evilpush.apple.com/x','https://web.push.apple.com.evil.test/x','https://user:pass@web.push.apple.com/x','https://web.push.apple.com:123/x'])assert.throws(()=>validateSubscription({...subscription,endpoint}));
  assert.throws(()=>validateSubscription({...subscription,keys:{...subscription.keys,p256dh:Buffer.alloc(65,4).toString('base64url')}}));
});
test('lead time, category switches, overdue choice, DST and restart deduplication',()=>{
  const db=fixture();try{
    db.prepare("UPDATE users SET chore_reminder_days=2,chore_reminder_time='09:30',reminder_payments=0").run();chore(db,'upcoming','2026-11-28');chore(db,'overdue','2026-11-25');chore(db,'completed','2026-11-28',1);
    scheduleReminders(db,'https://home.example.test',new Date('2026-11-26T08:29:00Z'));assert.equal(db.prepare('SELECT COUNT(*) n FROM mail').get().n,0);
    scheduleReminders(db,'https://home.example.test',new Date('2026-11-26T08:30:00Z'));scheduleReminders(db,'https://home.example.test',new Date('2026-11-26T10:00:00Z'));assert.equal(db.prepare('SELECT COUNT(*) n FROM mail').get().n,1);assert.equal(db.prepare('SELECT COUNT(*) n FROM push_outbox').get().n,1);const body=db.prepare('SELECT body FROM mail').get().body;assert.match(body,/upcoming/);assert.doesNotMatch(body,/overdue|completed/);
    db.prepare('UPDATE users SET reminder_overdue=1').run();scheduleReminders(db,'https://home.example.test',new Date('2026-11-27T10:00:00Z'));assert.match(db.prepare('SELECT body FROM mail ORDER BY rowid DESC LIMIT 1').get().body,/overdue/);
    db.prepare('UPDATE users SET reminder_chores=0').run();scheduleReminders(db,'https://home.example.test',new Date('2026-11-28T10:00:00Z'));assert.equal(db.prepare('SELECT COUNT(*) n FROM mail').get().n,2);
    assert.deepEqual(localSchedule(new Date('2026-03-29T07:00:00Z'),'Europe/Oslo'),{day:'2026-03-29',time:'09:00'});assert.deepEqual(localSchedule(new Date('2026-10-25T08:00:00Z'),'Europe/Oslo'),{day:'2026-10-25',time:'09:00'});
  }finally{db.close();}
});
test('push retry, expiry and deleted subscriptions are handled without leaking provider responses',async()=>{
  const db=fixture();try{queuePush(db,'s','test',{body:'Synthetic reminder'});let calls=0;const fetchImpl=async(url,options)=>{calls++;assert.equal(options.redirect,'error');assert.equal(options.headers['Content-Encoding'],'aes128gcm');assert.equal(options.headers.Urgency,'high');assert.ok(Buffer.isBuffer(options.body));return {status:calls===1?429:201,ok:calls>1};};await deliverPushOne(db,{origin:'https://home.example.test',fetchImpl});assert.equal(db.prepare('SELECT status FROM push_outbox').get().status,'pending');db.prepare('UPDATE push_outbox SET next_attempt=0').run();await deliverPushOne(db,{origin:'https://home.example.test',fetchImpl});assert.equal(db.prepare('SELECT payload FROM push_outbox').get().payload,'');queuePush(db,'s','test-expired',{body:'Synthetic'});db.prepare("UPDATE push_outbox SET created=0 WHERE event_key='test-expired'").run();await deliverPushOne(db,{origin:'https://home.example.test',fetchImpl});assert.equal(calls,2);queuePush(db,'s','gone',{body:'Synthetic'});await deliverPushOne(db,{origin:'https://home.example.test',fetchImpl:async()=>({status:410,ok:false})});assert.equal(db.prepare('SELECT COUNT(*) n FROM push_subscriptions').get().n,0);assert.equal(db.prepare('SELECT COUNT(*) n FROM push_outbox').get().n,0);}finally{db.close();}
});
test('future monthly payments remind without creating expenses; email and push consent are independent',()=>{
  const db=fixture();try{
    db.prepare("INSERT INTO users(id,email,name,password,verified,created) VALUES('payer','payer@example.test','Payer','synthetic',1,?)").run(now());
    db.prepare("UPDATE users SET reminders=0,payment_reminder_days=2,reminder_chores=0").run();
    db.prepare('INSERT INTO bills VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run('bill','h','Future bill','Other',10000,'payer',JSON.stringify([{user_id:'u',amount:5000},{user_id:'payer',amount:5000}]),'equal','','2026-11-28',1,'u',28);
    scheduleReminders(db,'https://home.example.test',new Date('2026-11-26T10:00:00Z'));assert.equal(db.prepare('SELECT count(*) n FROM mail').get().n,0);assert.equal(db.prepare('SELECT count(*) n FROM push_outbox').get().n,1);assert.equal(db.prepare('SELECT count(*) n FROM expenses').get().n,0);
    db.prepare('DELETE FROM members').run();db.prepare('DELETE FROM push_outbox').run();scheduleReminders(db,'https://home.example.test',new Date('2026-11-26T11:00:00Z'));assert.equal(db.prepare('SELECT count(*) n FROM push_outbox').get().n,0);
  }finally{db.close();}
});
test('chores today at 08:00 and payments two days ahead at 18:00 send independently',()=>{
  const db=fixture();try{
    db.prepare("UPDATE users SET chore_reminder_days=0,chore_reminder_time='08:00',payment_reminder_days=2,payment_reminder_time='18:00'").run();
    chore(db,'Today chore','2026-11-26');chore(db,'Future chore','2026-11-28');
    db.prepare("INSERT INTO users(id,email,name,password,verified,created) VALUES('payer','payer@example.test','Payer','synthetic',1,?)").run(now());
    db.prepare('INSERT INTO bills VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run('bill','h','Future payment','Other',10000,'payer',JSON.stringify([{user_id:'u',amount:5000}]),'equal','','2026-11-28',1,'u',28);
    scheduleReminders(db,'https://home.example.test',new Date('2026-11-26T06:59:00Z'));assert.equal(db.prepare('SELECT count(*) n FROM mail').get().n,0);
    scheduleReminders(db,'https://home.example.test',new Date('2026-11-26T07:00:00Z'));let mail=db.prepare('SELECT * FROM mail ORDER BY rowid').all();assert.equal(mail.length,1);assert.match(mail[0].body,/Today chore/);assert.doesNotMatch(mail[0].body,/Future chore|Future payment/);
    scheduleReminders(db,'https://home.example.test',new Date('2026-11-26T16:59:00Z'));assert.equal(db.prepare('SELECT count(*) n FROM mail').get().n,1);
    scheduleReminders(db,'https://home.example.test',new Date('2026-11-26T17:00:00Z'));scheduleReminders(db,'https://home.example.test',new Date('2026-11-26T18:00:00Z'));mail=db.prepare('SELECT * FROM mail ORDER BY rowid').all();assert.equal(mail.length,2);assert.match(mail[1].body,/Future payment/);assert.doesNotMatch(mail[1].body,/Today chore/);
    assert.deepEqual(db.prepare('SELECT payload FROM push_outbox ORDER BY rowid').all().map(r=>JSON.parse(r.payload).tag),['home-chores','home-payments']);
  }finally{db.close();}
});

test('an existing combined digest is not duplicated by the split-schedule upgrade',()=>{
  const db=fixture();try{chore(db,'Today','2026-11-26');enqueue(db,{key:'reminder:u:2026-11-26',to:'u@example.test',subject:'Synthetic old digest',body:'Synthetic'});queuePush(db,'s','reminder:u:2026-11-26:s',{body:'Synthetic old digest'});scheduleReminders(db,'https://home.example.test',new Date('2026-11-26T10:00:00Z'));assert.equal(db.prepare('SELECT count(*) n FROM mail').get().n,1);assert.equal(db.prepare('SELECT count(*) n FROM push_outbox').get().n,1);}finally{db.close();}
});
