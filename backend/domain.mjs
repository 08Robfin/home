import { randomBytes, randomUUID, createHash, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
export const id=()=>randomUUID();
export const now=()=>Date.now();
export const token=()=>randomBytes(32).toString('base64url');
export const hash=v=>createHash('sha256').update(v).digest('hex');
export const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
export function text(v,max=200) { if(typeof v!=='string'||!v.trim()||v.trim().length>max) fail(`Enter a value of 1–${max} characters.`); return v.trim(); }
export function email(v) { const s=text(v,254).toLowerCase(); if(!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(s)) fail('Enter a valid email address.'); return s; }
export function date(v) { if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||Number.isNaN(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v||v<'2000-01-01'||v>'2100-12-31') fail('Enter a valid date.'); return v; }
export const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Oslo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export function addDays(d,n) { const x=new Date(d+'T12:00:00Z'); x.setUTCDate(x.getUTCDate()+n); return x.toISOString().slice(0,10); }
export function nextMonth(d,anchorDay=Number(d.slice(8))) { const x=new Date(d+'T12:00:00Z'); x.setUTCDate(1);x.setUTCMonth(x.getUTCMonth()+1); const last=new Date(Date.UTC(x.getUTCFullYear(),x.getUTCMonth()+1,0)).getUTCDate(); x.setUTCDate(Math.min(anchorDay,last));return x.toISOString().slice(0,10); }
export function money(v) { if(typeof v!=='string'||!/^\d{1,8}([.,]\d{1,2})?$/.test(v)) fail('Enter an amount with at most two decimals.'); const [a,b='']=v.replace(',','.').split('.'); const n=Number(a)*100+Number(b.padEnd(2,'0')); if(n<=0||n>1000000000) fail('Amount must be between 0.01 and 10,000,000 NOK.'); return n; }
export function allocate(amount,participants,method) {
  if(!Array.isArray(participants)||!participants.length||participants.length>50||new Set(participants.map(p=>p.user_id)).size!==participants.length) fail('Select distinct participants.');
  const sorted=[...participants].sort((a,b)=>a.user_id.localeCompare(b.user_id));
  let weights;
  if(method==='equal') weights=sorted.map(()=>1);
  else if(method==='percentage') { weights=sorted.map(p=>{if(!/^\d{1,3}([.,]\d{1,2})?$/.test(String(p.value))) fail('Enter percentages with at most two decimals.'); return Math.round(Number(String(p.value).replace(',','.'))*100);}); if(weights.reduce((a,b)=>a+b,0)!==10000) fail('Percentages must total 100%.'); }
  else if(method==='fixed') { const shares=sorted.map(p=>({user_id:p.user_id,amount:typeof p.value==='string'&&/^0([.,]0{1,2})?$/.test(p.value)?0:money(p.value)}));if(shares.reduce((a,b)=>a+b.amount,0)!==amount) fail('Fixed shares must equal the total.'); return shares; }
  else fail('Choose a split method.');
  const total=weights.reduce((a,b)=>a+b,0); const shares=sorted.map((p,i)=>({user_id:p.user_id,amount:Math.floor(amount*weights[i]/total),remainder:amount*weights[i]%total}));
  let left=amount-shares.reduce((n,p)=>n+p.amount,0);
  for(const p of [...shares].sort((a,b)=>b.remainder-a.remainder||a.user_id.localeCompare(b.user_id))) {if(left--<=0)break;p.amount++;}
  return shares.map(({user_id,amount})=>({user_id,amount}));
}
const derive=promisify(scrypt);
export async function passwordHash(password) { if(typeof password!=='string'||password.length<12||password.length>128) fail('Use a password of 12–128 characters.');const salt=randomBytes(16).toString('hex');return salt+':'+(await derive(password,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024})).toString('hex'); }
export async function passwordCheck(password,stored) { const [salt,key]=stored.split(':');const supplied=await derive(String(password).slice(0,128),salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024});return timingSafeEqual(supplied,Buffer.from(key,'hex')); }
export const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function enqueue(db,{key,to,subject,body}) { db.prepare('INSERT OR IGNORE INTO mail(id,event_key,recipient,subject,body,next_attempt,created) VALUES(?,?,?,?,?,?,?)').run(id(),key,to,subject,body,now(),now()); }
export function issueToken(db,{user=null,kind,recipient,household=null,origin,inviter=null}) {
  const raw=token(), digest=hash(raw); const expires=now()+(kind==='invite'?7*86400000:kind==='reset'?3600000:86400000);
  db.prepare('DELETE FROM tokens WHERE email=? AND kind=? AND COALESCE(household_id,\'\')=COALESCE(?,\'\')').run(recipient,kind,household);
  db.prepare('INSERT INTO tokens VALUES(?,?,?,?,?,?,?)').run(digest,user,kind,recipient,household,expires,now());
  const link=`${origin}/#${kind}=${raw}`;
  const householdName=kind==='invite'?db.prepare('SELECT name FROM households WHERE id=?').get(household)?.name:null;
  const subject=kind==='verify'?'Verify your email for Home.':kind==='reset'?'Reset your Home. password':`Join ${householdName} on Home.`;
  const body=kind==='invite'?`${inviter||'A household member'} invited you to join ${householdName} on Home.\n\n${link}\n\nSign in or register with this email address to accept. This invitation expires in 7 days.\n\nIf you were not expecting this invitation, you can ignore this email.`:`${kind==='verify'?'Verify your email address':'Reset your password'} using this link. It expires in ${kind==='reset'?'1 hour':'24 hours'}.\n\n${link}\n\nIf you did not request this, you can ignore this email.`;
  enqueue(db,{key:`${kind}:${digest}`,to:recipient,subject,body});
}
