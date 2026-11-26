import test from 'node:test';
import assert from 'node:assert/strict';
import {createECDH} from 'node:crypto';
import { openDb } from '../backend/db.mjs';
import { createApp } from '../backend/server.mjs';
import { schedule,deliverOne } from '../backend/worker.mjs';
import { today,now } from '../backend/domain.mjs';

test('real HTTP account, tenancy, invitation, chore, ledger, receipt and email flows',async t=>{
  const db=openDb(':memory:');const origin='http://localhost:3000';const {server}=createApp({db,origin});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>{server.closeAllConnections();server.close();db.close();});const base=`http://127.0.0.1:${server.address().port}`;
  function client(){let cookie='';return async(path,body,expected=200,extra={})=>{const r=await fetch(base+'/api'+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,'X-Home-Request':'1','Content-Type':'application/json',Cookie:cookie,...extra},body:body===undefined?undefined:JSON.stringify(body)});if(r.headers.has('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];const result=r.headers.get('content-type')?.includes('application/json')?await r.json():await r.arrayBuffer();assert.equal(r.status,expected,JSON.stringify(result));return result;};}
  const a=client(),b=client(),c=client();
  const rawToken=(email,kind)=>{const row=db.prepare('SELECT body FROM mail WHERE recipient=? AND event_key LIKE ? ORDER BY created DESC LIMIT 1').get(email,kind+':%');return row.body.match(new RegExp('#'+kind+'=([^\\s]+)'))[1];};
  await t.test('verification is single use and required for household creation',async()=>{
    await a('/auth/register',{name:'A',email:'a@example.test',password:'long test password A'});await a('/auth/login',{email:'a@example.test',password:'long test password A'});await a('/households',{name:'Denied'},403);const raw=rawToken('a@example.test','verify');assert.ok(!db.prepare('SELECT hash FROM tokens').get().hash.includes(raw));await a('/auth/verify',{token:raw});await a('/auth/verify',{token:raw},400);
  });
  const h=(await a('/households',{name:'House A'})).id;
  for(const [call,address,name] of [[b,'b@example.test','B'],[c,'c@example.test','C']]){await call('/auth/register',{name,email:address,password:'long test password '+name});await call('/auth/verify',{token:rawToken(address,'verify')});await call('/auth/login',{email:address,password:'long test password '+name});}
  const uidA=(await a('/me')).user.id,uidB=(await b('/me')).user.id;
  await t.test('nonmembers cannot read, export or mutate another household',async()=>{await b('/h/'+h,undefined,404);await b(`/h/${h}/export`,undefined,404);await b(`/h/${h}/shopping`,{title:'Injection'},404);});
  await t.test('invitation is recipient-bound, revocable, single use and role checked',async()=>{
    await a(`/h/${h}/invite`,{email:'b@example.test'});const invite=rawToken('b@example.test','invite');await c('/invitations/accept',{token:invite},400);await b('/invitations/accept',{token:invite});await b('/invitations/accept',{token:invite},400);await b(`/h/${h}/invite`,{email:'c@example.test'},403);await a(`/h/${h}/invite`,{email:'c@example.test'});const raw=rawToken('c@example.test','invite');const inv=(await a('/h/'+h)).invitations[0];await a(`/h/${h}/revoke`,{id:inv.id});await c('/invitations/accept',{token:raw},400);
  });
  let chore;
  await t.test('recurring chore creates one next occurrence, swaps require recipient approval',async()=>{
    chore=(await a(`/h/${h}/chores`,{title:'Kitchen',assignee:uidA,due:today(),repeat_days:'7',rotation:[uidA,uidB]})).id;
    await b(`/h/${h}/chores/${chore}/complete`,{},403);await a(`/h/${h}/chores/${chore}/swap`,{user_id:uidB});await a(`/h/${h}/chores/${chore}/accept`,{},403);await b(`/h/${h}/chores/${chore}/accept`,{});await b(`/h/${h}/chores/${chore}/complete`,{});await b(`/h/${h}/chores/${chore}/complete`,{},400);const chores=(await a('/h/'+h)).chores;assert.equal(chores.length,2);assert.equal(chores.filter(c=>!c.done)[0].assignee,uidA);
  });
  let eid,sid;
  const input={title:'Sofa',category:'Furniture',amount:'3000',payer:uidA,kind:'purchase',due:today(),method:'percentage',participants:[{user_id:uidA,value:'70'},{user_id:uidB,value:'30'}]};
  await t.test('expense preview rules are enforced, and cross-household participants rejected',async()=>{await a(`/h/${h}/expenses`,{...input,participants:[{user_id:uidA,value:'100'},{user_id:(await c('/me')).user.id,value:'0'}]},400);eid=(await a(`/h/${h}/expenses`,input)).id;const e=(await b('/h/'+h)).expenses[0];assert.equal(e.shares.find(s=>s.user_id===uidB).amount,90000);});
  await t.test('partial repayments reserve pending amounts and only recipient can confirm once',async()=>{
    sid=(await b(`/h/${h}/expenses/${eid}/settle`,{amount:'300'})).id;await b(`/h/${h}/expenses/${eid}/settle`,{amount:'601'},400);await b(`/h/${h}/settlements/${sid}/confirm`,{},403);await a(`/h/${h}/settlements/${sid}/confirm`,{});await a(`/h/${h}/settlements/${sid}/confirm`,{},400);await a(`/h/${h}/expenses/${eid}/void`,{},400);
    const s2=(await b(`/h/${h}/expenses/${eid}/settle`,{amount:'600'})).id;await a(`/h/${h}/settlements/${s2}/reject`,{});const s3=(await b(`/h/${h}/expenses/${eid}/settle`,{amount:'600'})).id;await a(`/h/${h}/settlements/${s3}/confirm`,{});await b(`/h/${h}/expenses/${eid}/settle`,{amount:'0.01'},400);
  });
  await t.test('receipts are private, validated and not leaked to other tenants',async()=>{
    await a(`/h/${h}/expenses/${eid}/receipt`,{mime:'text/html',data:Buffer.from('<script>').toString('base64')},400);await a(`/h/${h}/expenses/${eid}/receipt`,{mime:'application/pdf',data:Buffer.from('%PDF-1.4 test').toString('base64')});await c(`/h/${h}/expenses/${eid}/receipt`,undefined,404);await b(`/h/${h}/expenses/${eid}/receipt`);
  });
  await t.test('authorized membership in another household cannot be combined with foreign record IDs',async()=>{
    const other=(await c('/households',{name:'Other household'})).id;
    await c(`/h/${other}/expenses/${eid}/receipt`,undefined,404);
    await c(`/h/${other}/expenses/${eid}/settle`,{amount:'1'},404);
    await c(`/h/${other}/settlements/${sid}/confirm`,{},404);
    await c(`/h/${other}/chores/${chore}/complete`,{},404);
  });
  await t.test('monthly bills and opted-in reminders are restart safe',async()=>{
    const bill=(await a(`/h/${h}/expenses`,{...input,title:'Rent',kind:'bill',monthly:true,due:'2026-01-01'})).id;assert.ok(bill);schedule(db,origin);schedule(db,origin);const dates=db.prepare('SELECT due FROM expenses WHERE template_id IS NOT NULL').all().map(x=>x.due);assert.equal(dates.length,new Set(dates).size);
    await b('/profile',{name:'B',reminders:true,reminder_time:'00:00'});schedule(db,origin);schedule(db,origin);assert.equal(db.prepare("SELECT count(*) AS n FROM mail WHERE event_key LIKE 'reminder:%'").get().n,0);
    await a(`/h/${h}/chores`,{title:'Reminder chore',assignee:uidB,due:today()});schedule(db,origin);schedule(db,origin);assert.equal(db.prepare("SELECT count(*) AS n FROM mail WHERE event_key LIKE 'reminder:%'").get().n,1);
  });
  await t.test('shopping edits persist and CSRF is rejected',async()=>{const s=(await a(`/h/${h}/shopping`,{title:'Milk',quantity:'2'})).id;await b(`/h/${h}/shopping/${s}`,{title:'Oat milk',quantity:'1',checked:true});assert.equal((await a('/h/'+h)).shopping[0].title,'Oat milk');await a(`/h/${h}/shopping`,{title:'CSRF'},403,{Origin:'https://evil.example'});await a(`/h/${h}/shopping/clear`,{});assert.equal((await a('/h/'+h)).shopping.length,0);});
  await t.test('mail retries keep stable idempotency keys and never store provider error bodies',async()=>{const calls=[];const send=async(url,options)=>{calls.push(options);return {ok:calls.length>1,status:calls.length>1?200:429,json:async()=>({id:'test-provider-id'})};};await deliverOne(db,{apiKey:'fake-only-for-test',from:'Home <test@example.test>',fetchImpl:send});const row=db.prepare("SELECT * FROM mail WHERE attempts=1").get();assert.equal(row.status,'pending');db.prepare('UPDATE mail SET next_attempt=0 WHERE id=?').run(row.id);await deliverOne(db,{apiKey:'fake-only-for-test',from:'Home <test@example.test>',fetchImpl:send});assert.equal(calls[0].headers['Idempotency-Key'],calls[1].headers['Idempotency-Key']);assert.equal(db.prepare('SELECT body FROM mail WHERE id=?').get(row.id).body,'');});
  await t.test('notification preferences validate, persist and cancel pending digests',async()=>{
    await b('/profile',{name:'B',reminders:true,reminder_days:'3',reminder_time:'18:15',reminder_zone:'America/New_York',reminder_chores:false,reminder_payments:true,reminder_overdue:true});
    const user=(await b('/me')).user;assert.equal(user.reminder_days,3);assert.equal(user.reminder_time,'18:15');assert.equal(user.reminder_zone,'America/New_York');assert.equal(user.reminder_chores,false);assert.equal(user.reminder_overdue,true);
    for(const invalid of [{reminder_days:15},{reminder_days:-1},{reminder_time:'25:00'},{reminder_zone:'Invalid/Zone'}])await b('/profile',{name:'B',...invalid},400);
    assert.equal(db.prepare("SELECT count(*) n FROM mail WHERE event_key LIKE 'reminder:%' AND status='pending'").get().n,0);
    await b('/profile',{name:'B',reminders:true,chore_reminder_days:'0',chore_reminder_time:'08:00',payment_reminder_days:'2',payment_reminder_time:'18:30'});
    const separate=(await b('/me')).user;assert.equal(separate.chore_reminder_days,0);assert.equal(separate.chore_reminder_time,'08:00');assert.equal(separate.payment_reminder_days,2);assert.equal(separate.payment_reminder_time,'18:30');
    for(const invalid of [{chore_reminder_days:15},{payment_reminder_days:-1},{chore_reminder_time:'24:10'},{payment_reminder_time:'not-a-time'}])await b('/profile',{name:'B',...invalid},400);

  });
  await t.test('push endpoints are authenticated, scoped, deduplicated and never expose private VAPID keys',async()=>{
    const anon=client();await anon('/push/key',undefined,401);const key=await a('/push/key');assert.deepEqual(Object.keys(key),['publicKey']);assert.equal(Buffer.from(key.publicKey,'base64url').length,65);
    const receiver=createECDH('prime256v1');receiver.generateKeys();const subscription={endpoint:'https://web.push.apple.com/synthetic-only',keys:{p256dh:receiver.getPublicKey().toString('base64url'),auth:Buffer.alloc(16,1).toString('base64url')}};
    await a('/push/subscribe',{subscription});await a('/push/subscribe',{subscription});assert.equal(db.prepare('SELECT count(*) n FROM push_subscriptions').get().n,1);
    assert.equal((await b('/push/status',{endpoint:subscription.endpoint})).subscribed,false);await b('/push/subscribe',{subscription},409);await b('/push/test',{endpoint:subscription.endpoint},400);await b('/push/unsubscribe',{endpoint:subscription.endpoint});assert.equal(db.prepare('SELECT count(*) n FROM push_subscriptions').get().n,1);
    await a('/push/test',{endpoint:subscription.endpoint});assert.equal(db.prepare('SELECT count(*) n FROM push_outbox').get().n,1);await a('/push/subscribe',{subscription:{...subscription,endpoint:'https://127.0.0.1/secret'}},400);await a('/push/unsubscribe',{endpoint:subscription.endpoint});assert.equal(db.prepare('SELECT count(*) n FROM push_outbox').get().n,0);
  });
  await t.test('password reset is single-use and invalidates existing sessions',async()=>{await b('/auth/forgot',{email:'b@example.test'});const raw=rawToken('b@example.test','reset');await b('/auth/reset',{token:raw,password:'a changed test password'});await b('/me',undefined,401);await b('/auth/reset',{token:raw,password:'a changed test password'},400);await b('/auth/login',{email:'b@example.test',password:'a changed test password'});});
  await t.test('owner cannot leave without transfer, member cannot escalate privileges',async()=>{await a(`/h/${h}/leave`,{},400);await b(`/h/${h}/member`,{user_id:uidB,role:'owner'},403);});
});
