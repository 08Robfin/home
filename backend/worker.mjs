import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { openDb,transaction } from './db.mjs';
import { id,now,today,nextMonth,enqueue,escapeHtml } from './domain.mjs';

export function schedule(db,origin) {
  const day=today();
  transaction(db,()=>{
    for(const b of db.prepare('SELECT * FROM bills WHERE active=1 AND next_due<=?').all(day)) {
      // One occurrence per tick; no skipped months or double occurrences across restarts.
      const eid=id();const result=db.prepare('INSERT OR IGNORE INTO expenses(id,household_id,title,category,amount,payer,kind,due,method,note,created,created_by,template_id) VALUES(?,?,?,?,?,?,\'bill\',?,?,?,?,?,?)').run(eid,b.household_id,b.title,b.category,b.amount,b.payer,b.next_due,b.method,b.note,now(),b.created_by,b.id);
      if(result.changes)for(const s of JSON.parse(b.shares))db.prepare('INSERT INTO shares VALUES(?,?,?)').run(eid,s.user_id,s.amount);
      db.prepare('UPDATE bills SET next_due=? WHERE id=?').run(nextMonth(b.next_due,b.anchor_day),b.id);
    }
    const users=db.prepare('SELECT * FROM users WHERE verified=1 AND reminders=1').all();
    for(const u of users) {
      const chores=db.prepare('SELECT c.* FROM chores c JOIN members m ON m.household_id=c.household_id AND m.user_id=? WHERE c.assignee=? AND c.done=0 AND c.due=?').all(u.id,u.id,day);
      const bills=db.prepare(`SELECT e.*,s.amount-COALESCE((SELECT SUM(t.amount) FROM settlements t WHERE t.expense_id=e.id AND t.payer=? AND t.status IN ('sent','confirmed')),0) AS remaining FROM expenses e JOIN shares s ON s.expense_id=e.id JOIN members m ON m.household_id=e.household_id AND m.user_id=? WHERE s.user_id=? AND e.payer<>? AND e.voided=0 AND e.due=?`).all(u.id,u.id,u.id,u.id,day).filter(e=>e.remaining>0);
      if(chores.length||bills.length)enqueue(db,{key:`reminder:${u.id}:${day}`,to:u.email,subject:'Due today on Home.',body:[...chores.map(c=>`Chore: ${c.title}`),...bills.map(b=>`Payment: ${b.title} — ${(b.remaining/100).toFixed(2)} NOK`),'',origin,'','Manage email reminders in Settings on Home.'].join('\n')});
    }
    db.prepare('DELETE FROM tokens WHERE expires<?').run(now());db.prepare('DELETE FROM sessions WHERE expires<?').run(now());
    db.prepare("UPDATE mail SET status='failed',body='',error='Delivery window expired' WHERE status IN ('pending','processing') AND created<?").run(now()-23*3600000);
    db.prepare('DELETE FROM rate_limits WHERE expires<?').run(now());
    db.prepare("DELETE FROM mail WHERE status IN ('sent','failed') AND created<?").run(now()-30*86400000);
  });
}
export async function deliverOne(db,{apiKey,from,origin=process.env.APP_ORIGIN,fetchImpl=fetch}={}) {
  const row=transaction(db,()=>{const r=db.prepare("SELECT * FROM mail WHERE status IN ('pending','processing') AND next_attempt<=? ORDER BY created LIMIT 1").get(now());if(!r)return null;db.prepare("UPDATE mail SET status='processing',next_attempt=?,attempts=attempts+1 WHERE id=?").run(now()+300000,r.id);return r;});
  if(!row)return false;
  let status=0;
  try {
    if(!apiKey||!from)throw new Error('Not configured');
    const escaped=escapeHtml(row.body);
    const action=row.event_key.startsWith('invite:')?'View invitation':row.event_key.startsWith('verify:')?'Verify email':row.event_key.startsWith('reset:')?'Reset password':'Open Home.';
    const content=escaped.replace(/https:\/\/[^\s<]+/g,url=>{try{const target=new URL(url);if(target.origin!==origin||target.pathname!=='/'||target.search||target.hash&&!/^#(invite|verify|reset)=[A-Za-z0-9_-]{43}$/.test(target.hash))return url;return `<a href="${url}" style="display:inline-block;background:#315b4b;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none">${action}</a>`;}catch{return url;}}).replaceAll('\n','<br>');
    const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(row.subject)}</title></head><body style="font-family:Arial,sans-serif;font-size:16px;color:#162c24;line-height:1.6;max-width:560px;margin:32px auto;padding:24px"><h1 style="font-size:24px">Home.</h1><h2 style="font-size:20px">${escapeHtml(row.subject)}</h2><p>${content}</p></body></html>`;
    const response=await fetchImpl('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json','Idempotency-Key':row.id},body:JSON.stringify({from,to:[row.recipient],subject:row.subject,text:row.body,html}),signal:AbortSignal.timeout(15000)});
    status=response.status;
    if(!response.ok)throw new Error('Provider rejected request');
    const result=await response.json();if(typeof result.id!=='string')throw new Error('Invalid provider response');
    db.prepare("UPDATE mail SET status='sent',provider_id=?,body='',error=NULL WHERE id=?").run(result.id,row.id);
  }catch {
    const retry=(!status||status===429||status>=500)&&row.attempts<7;
    db.prepare('UPDATE mail SET status=?,next_attempt=?,error=?,body=? WHERE id=?').run(retry?'pending':'failed',now()+Math.min(3600000,30000*2**row.attempts),status?`Provider HTTP ${status}`:'Delivery unavailable',retry?row.body:'',row.id);
  }
  return true;
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
  const db=openDb();
  const apiKey=process.env.RESEND_API_KEY_FILE?readFileSync(process.env.RESEND_API_KEY_FILE,'utf8').trim():process.env.RESEND_API_KEY;
  if(!apiKey||!process.env.MAIL_FROM||!process.env.APP_ORIGIN)throw new Error('Mail worker configuration is incomplete.');
  const loop=async()=>{try{writeFileSync('/tmp/home-worker-heartbeat',String(now()));schedule(db,process.env.APP_ORIGIN);for(let i=0;i<20;i++){writeFileSync('/tmp/home-worker-heartbeat',String(now()));if(!await deliverOne(db,{apiKey,from:process.env.MAIL_FROM}))break;await new Promise(r=>setTimeout(r,600));}}catch{console.error('Mail worker tick failed.');}setTimeout(loop,15000);};
  loop();
}
