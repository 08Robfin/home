import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { openDb, transaction } from './db.mjs';
import { id,now,token,hash,fail,text,email,date,money,allocate,passwordHash,passwordCheck,issueToken,today,addDays,nextMonth } from './domain.mjs';

export function createApp({db=openDb(),origin=process.env.APP_ORIGIN||'http://localhost:3000',secure=origin.startsWith('https:')}={}) {
  const get=(sql,...args)=>db.prepare(sql).get(...args), all=(sql,...args)=>db.prepare(sql).all(...args), run=(sql,...args)=>db.prepare(sql).run(...args);
  const dummy='00000000000000000000000000000000:'+ '0'.repeat(128);
  const cookie=(res,value,maxAge=2592000)=>res.setHeader('Set-Cookie',`home_session=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure?'; Secure':''}`);
  const audit=(h,u,action,record)=>run('INSERT INTO audit(household_id,actor,action,record_id,created) VALUES(?,?,?,?,?)',h,u,action,record,now());
  function rate(key,max,window=3600000) { const t=now(); transaction(db,()=>{run('DELETE FROM rate_limits WHERE expires<?',t);const row=get('SELECT * FROM rate_limits WHERE key=?',key);if(row&&row.count>=max)fail('Too many requests. Try again later.',429);run('INSERT INTO rate_limits VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1',key,t+window);}); }
  function auth(req,verified=true) { const raw=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('home_session='))?.slice(13); const u=raw&&get('SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.hash=? AND s.expires>?',hash(raw),now()); if(!u)fail('Sign in to continue.',401);if(verified&&!u.verified)fail('Verify your email address first.',403);return u; }
  function membership(h,u,role=false) { const m=get('SELECT * FROM members WHERE household_id=? AND user_id=?',h,u.id);if(!m)fail('Household not found.',404); if(role&&m.role==='member')fail('An administrator is required.',403);return m; }
  function member(h,userId) { if(typeof userId!=='string'||!get('SELECT 1 FROM members WHERE household_id=? AND user_id=?',h,userId))fail('Choose a current household member.');return userId; }
  function object(table,h,record) {const row=get(`SELECT * FROM ${table} WHERE id=? AND household_id=?`,record,h);if(!row)fail('Record not found.',404);return row;}
  function pendingBalance(expense,userId,includePending=true) {const share=get('SELECT amount FROM shares WHERE expense_id=? AND user_id=?',expense.id,userId);if(!share||expense.payer===userId||expense.voided)return 0; const paid=get(`SELECT COALESCE(SUM(amount),0) AS n FROM settlements WHERE expense_id=? AND payer=? AND status ${includePending?"IN ('sent','confirmed')":"='confirmed'"}`,expense.id,userId).n;return share.amount-paid;}
  function canDepart(h,userId) {
    const expenses=all('SELECT * FROM expenses WHERE household_id=? AND voided=0',h);
    if(expenses.some(e=>e.payer===userId?all('SELECT user_id FROM shares WHERE expense_id=? AND user_id<>?',e.id,userId).some(s=>pendingBalance(e,s.user_id,false)>0):pendingBalance(e,userId,false)>0))fail('Settle outstanding expenses before leaving or removing this member.');
    if(get('SELECT 1 FROM chores WHERE household_id=? AND done=0 AND assignee=?',h,userId))fail('Reassign unfinished chores first.');
    if(all('SELECT * FROM chores WHERE household_id=? AND done=0',h).some(c=>JSON.parse(c.rotation).includes(userId))||all('SELECT * FROM bills WHERE household_id=? AND active=1',h).some(b=>b.payer===userId||JSON.parse(b.shares).some(s=>s.user_id===userId)))fail('Remove this member from recurring chores and stop their recurring bills first.');
  }
  async function api(req,res,url,body) {
    const path=url.pathname, method=req.method;
    if(path==='/api/health'&&method==='GET')return {app:'home',ok:!!get('SELECT 1')};
    const ip=req.socket.remoteAddress; // Aggregate at proxy: forwarded headers are never trusted for abuse controls.
    if(path.startsWith('/api/auth/')&&method==='POST')rate('auth-ip:'+ip,60,900000);
    if(path==='/api/auth/register'&&method==='POST') {
      const address=email(body.email),name=text(body.name,80);rate('register:'+address,3);
      const pw=await passwordHash(body.password);
      transaction(db,()=>{if(!get('SELECT id FROM users WHERE email=?',address)){const uid=id();run('INSERT INTO users(id,email,name,password,created) VALUES(?,?,?,?,?)',uid,address,name,pw,now());issueToken(db,{user:uid,kind:'verify',recipient:address,origin});}});
      return {message:'If this address can be registered, a verification email is on its way. After verifying, sign in.'};
    }
    if(path==='/api/auth/login'&&method==='POST') {
      const address=email(body.email);rate('login:'+address,12,900000);const u=get('SELECT * FROM users WHERE email=?',address);
      if(!await passwordCheck(body.password,u?.password||dummy)||!u)fail('Email or password is incorrect.',401);
      const raw=token();run('INSERT INTO sessions VALUES(?,?,?)',hash(raw),u.id,now()+2592000000);cookie(res,raw);return {ok:true};
    }
    if(path==='/api/auth/logout'&&method==='POST') { const u=auth(req,false);const raw=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('home_session='))?.slice(13);run('DELETE FROM sessions WHERE hash=? AND user_id=?',hash(raw),u.id);cookie(res,'',0);return {ok:true}; }
    if(['/api/auth/forgot','/api/auth/resend'].includes(path)&&method==='POST') {
      const address=email(body.email);rate(path+address,3);const u=get('SELECT * FROM users WHERE email=?',address);
      if(u&&(path.endsWith('forgot')||!u.verified))transaction(db,()=>issueToken(db,{user:u.id,recipient:address,kind:path.endsWith('forgot')?'reset':'verify',origin}));return {message:'If the account is eligible, an email is on its way.'};
    }
    if(['/api/auth/verify','/api/auth/reset'].includes(path)&&method==='POST') {
      const kind=path.endsWith('reset')?'reset':'verify';const digest=hash(text(body.token,100));const pw=kind==='reset'?await passwordHash(body.password):null;
      transaction(db,()=>{const t=get('SELECT * FROM tokens WHERE hash=? AND kind=? AND expires>?',digest,kind,now());if(!t)fail('This link has expired or has already been used. Request a new one.');if(kind==='verify')run('UPDATE users SET verified=1 WHERE id=?',t.user_id);else {run('UPDATE users SET password=? WHERE id=?',pw,t.user_id);run('DELETE FROM sessions WHERE user_id=?',t.user_id);}run('DELETE FROM tokens WHERE user_id=? AND kind=?',t.user_id,kind);});return {message:kind==='verify'?'Email verified. You can sign in.':'Password changed. Sign in with your new password.'};
    }
    const u=auth(req,false);
    if(path==='/api/me'&&method==='GET')return {user:{id:u.id,email:u.email,name:u.name,verified:!!u.verified,reminders:!!u.reminders},households:all('SELECT h.id,h.name,m.role FROM households h JOIN members m ON m.household_id=h.id WHERE m.user_id=? ORDER BY h.created',u.id)};
    if(path==='/api/profile'&&method==='POST') {run('UPDATE users SET name=?,reminders=? WHERE id=?',text(body.name,80),body.reminders===true?1:0,u.id);return {ok:true};}
    if(!u.verified)fail('Verify your email address first.',403);
    if(path==='/api/households'&&method==='POST') {rate('households:'+u.id,10,86400000);const h=id();transaction(db,()=>{run('INSERT INTO households VALUES(?,?,?)',h,text(body.name,100),now());run('INSERT INTO members VALUES(?,?,?)',h,u.id,'owner');audit(h,u.id,'household.created',h);});return {id:h};}
    if(path==='/api/invitations/accept'&&method==='POST') {
      return transaction(db,()=>{const t=get('SELECT * FROM tokens WHERE hash=? AND kind=\'invite\' AND expires>?',hash(text(body.token,100)),now());if(!t||t.email!==u.email)fail('This invitation is expired, revoked, or belongs to a different email address.');if(all('SELECT user_id FROM members WHERE household_id=?',t.household_id).length>=50)fail('This household has reached the 50-member limit.');run('INSERT OR IGNORE INTO members VALUES(?,?,?)',t.household_id,u.id,'member');run('DELETE FROM tokens WHERE hash=?',t.hash);audit(t.household_id,u.id,'invitation.accepted',u.id);return {id:t.household_id};});
    }
    const match=path.match(/^\/api\/h\/([\w-]+)(?:\/(.*))?$/);if(!match)fail('Not found.',404);
    const h=match[1], route=match[2]||'';const m=membership(h,u);
    if(!['GET','HEAD'].includes(method))rate('write:'+u.id,240,60000);
    if(route===''&&method==='GET') {
      const expenses=all('SELECT * FROM expenses WHERE household_id=? ORDER BY created DESC',h).map(e=>({...e,shares:all('SELECT * FROM shares WHERE expense_id=?',e.id),settlements:all('SELECT * FROM settlements WHERE expense_id=? ORDER BY created',e.id),receipt:!!get('SELECT 1 FROM receipts WHERE expense_id=?',e.id)}));
      return {household:get('SELECT * FROM households WHERE id=?',h),role:m.role,members:all('SELECT u.id,u.name,u.email,m.role FROM members m JOIN users u ON u.id=m.user_id WHERE m.household_id=? ORDER BY m.role,u.name',h),chores:all('SELECT * FROM chores WHERE household_id=? ORDER BY done,due,created',h).map(c=>({...c,rotation:JSON.parse(c.rotation)})),expenses,shopping:all('SELECT * FROM shopping WHERE household_id=? ORDER BY checked,created',h),bills:all('SELECT id,title,next_due,active FROM bills WHERE household_id=? ORDER BY next_due',h),invitations:m.role==='member'?[]:all('SELECT hash AS id,email,expires FROM tokens WHERE household_id=? AND kind=\'invite\' AND expires>?',h,now()),audit:all('SELECT a.*,u.name FROM audit a JOIN users u ON u.id=a.actor WHERE household_id=? ORDER BY a.id DESC LIMIT 100',h)};
    }
    if(route==='export'&&method==='GET')return {household:get('SELECT * FROM households WHERE id=?',h),expenses:all('SELECT * FROM expenses WHERE household_id=?',h).map(e=>({...e,shares:all('SELECT * FROM shares WHERE expense_id=?',e.id),settlements:all('SELECT * FROM settlements WHERE expense_id=?',e.id)})),chores:all('SELECT * FROM chores WHERE household_id=?',h),shopping:all('SELECT * FROM shopping WHERE household_id=?',h),audit:all('SELECT * FROM audit WHERE household_id=?',h)};
    if(route==='rename'&&method==='POST'){membership(h,u,true);run('UPDATE households SET name=? WHERE id=?',text(body.name,100),h);return {ok:true};}
    if(route==='invite'&&method==='POST') {membership(h,u,true);rate('invite:'+u.id,20);const recipient=email(body.email);if(get('SELECT 1 FROM members m JOIN users u ON u.id=m.user_id WHERE m.household_id=? AND u.email=?',h,recipient))fail('This person is already a member.');transaction(db,()=>{issueToken(db,{kind:'invite',recipient,household:h,origin,inviter:u.name});audit(h,u.id,'invitation.sent',recipient);});return {ok:true};}
    if(route==='revoke'&&method==='POST'){membership(h,u,true);run('DELETE FROM tokens WHERE hash=? AND household_id=? AND kind=\'invite\'',text(body.id,100),h);return {ok:true};}
    if(route==='member'&&method==='POST') {
      return transaction(db,()=>{const target=member(h,body.user_id);if(m.role!=='owner')fail('Only the owner can change roles.',403);if(target===u.id)fail('Use transfer ownership to change the owner.');if(!['admin','member','owner'].includes(body.role))fail('Choose a role.');if(body.role==='owner')run('UPDATE members SET role=\'admin\' WHERE household_id=? AND user_id=?',h,u.id);run('UPDATE members SET role=? WHERE household_id=? AND user_id=?',body.role,h,target);audit(h,u.id,'member.role.'+body.role,target);return {ok:true};});
    }
    if(route==='leave'&&method==='POST') {
      transaction(db,()=>{const target=body.user_id||u.id;member(h,target);if(target!==u.id&&m.role!=='owner')fail('Only the owner can remove members.',403);if(get('SELECT role FROM members WHERE household_id=? AND user_id=?',h,target).role==='owner')fail('Transfer ownership before leaving.');canDepart(h,target);run('DELETE FROM members WHERE household_id=? AND user_id=?',h,target);audit(h,u.id,'member.left',target);});return {ok:true};
    }
    if(route==='chores'&&method==='POST') {
      const assignee=member(h,body.assignee),due=date(body.due),title=text(body.title,160);const repeat=Number(body.repeat_days||0);if(!Number.isInteger(repeat)||repeat<0||repeat>365)fail('Repeat interval must be 0–365 days.');const rotation=Array.isArray(body.rotation)?body.rotation:[];if(rotation.length>50||new Set(rotation).size!==rotation.length)fail('Choose distinct rotation members.');rotation.forEach(uid=>member(h,uid));const cid=id();transaction(db,()=>{run('INSERT INTO chores(id,household_id,title,assignee,due,repeat_days,rotation,created) VALUES(?,?,?,?,?,?,?,?)',cid,h,title,assignee,due,repeat,JSON.stringify(rotation),now());audit(h,u.id,'chore.created',cid);});return {id:cid};
    }
    const chore=route.match(/^chores\/([\w-]+)\/(complete|swap|accept|decline|reassign|stop)$/);
    if(chore&&method==='POST')return transaction(db,()=>{
      const c=object('chores',h,chore[1]);if(c.done)fail('This chore is already completed.');const action=chore[2];
      if(action==='complete'){if(u.id!==c.assignee&&m.role==='member')fail('Only the assignee or an administrator can complete this chore.',403);run('UPDATE chores SET done=1,swap_to=NULL WHERE id=?',c.id);if(c.repeat_days){const rotation=JSON.parse(c.rotation).filter(uid=>get('SELECT 1 FROM members WHERE household_id=? AND user_id=?',h,uid));const assignee=rotation.length?rotation[(rotation.indexOf(c.assignee)+1)%rotation.length]:c.assignee;run('INSERT OR IGNORE INTO chores(id,household_id,title,assignee,due,repeat_days,rotation,parent_id,created) VALUES(?,?,?,?,?,?,?,?,?)',id(),h,c.title,assignee,addDays(c.due,c.repeat_days),c.repeat_days,JSON.stringify(rotation),c.parent_id||c.id,now());}}
      if(action==='swap'){if(u.id!==c.assignee)fail('Only the assignee can request a swap.',403);const target=member(h,body.user_id);if(target===u.id)fail('Choose another member.');run('UPDATE chores SET swap_to=? WHERE id=?',target,c.id);}
      if(action==='accept'||action==='decline'){if(c.swap_to!==u.id)fail('This swap is not addressed to you.',403);if(action==='accept')run('UPDATE chores SET assignee=?,swap_to=NULL WHERE id=?',u.id,c.id);else run('UPDATE chores SET swap_to=NULL WHERE id=?',c.id);}
      if(action==='reassign'){membership(h,u,true);run('UPDATE chores SET assignee=?,swap_to=NULL WHERE id=?',member(h,body.user_id),c.id);}
      if(action==='stop'){membership(h,u,true);run('UPDATE chores SET repeat_days=0,rotation=\'[]\' WHERE id=?',c.id);}
      audit(h,u.id,'chore.'+action,c.id);return {ok:true};
    });
    if(route==='expenses'&&method==='POST')return transaction(db,()=>{
      const amount=money(body.amount),payer=member(h,body.payer),title=text(body.title,160),due=date(body.due),method=body.method;
      if(!['purchase','bill'].includes(body.kind))fail('Choose purchase or bill.');const shares=allocate(amount,body.participants,method);shares.forEach(s=>member(h,s.user_id));const eid=id(),bill=body.monthly&&body.kind==='bill'?id():null;
      const category=text(body.category||'Other',50),note=typeof body.note==='string'?body.note.trim():'';if(note.length>2000)fail('Notes may contain at most 2000 characters.');
      if(bill)run('INSERT INTO bills VALUES(?,?,?,?,?,?,?,?,?,?,1,?,?)',bill,h,title,category,amount,payer,JSON.stringify(shares),method,note,nextMonth(due),u.id,Number(due.slice(8)));
      run('INSERT INTO expenses(id,household_id,title,category,amount,payer,kind,due,method,note,created,created_by,template_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',eid,h,title,category,amount,payer,body.kind,due,method,note,now(),u.id,bill);
      for(const share of shares)run('INSERT INTO shares VALUES(?,?,?)',eid,share.user_id,share.amount);
      audit(h,u.id,'expense.created',eid);return {id:eid};
    });
    const expense=route.match(/^expenses\/([\w-]+)\/(settle|void|receipt)$/);
    if(expense){const e=object('expenses',h,expense[1]);
      if(expense[2]==='receipt'&&method==='GET') {const r=get('SELECT * FROM receipts WHERE expense_id=?',e.id);if(!r)fail('Receipt not found.',404);res.setHeader('Content-Type',r.mime);res.setHeader('Content-Disposition','inline');res.end(Buffer.from(r.data));return undefined;}
      if(expense[2]==='receipt'&&method==='POST'){if(e.created_by!==u.id&&m.role==='member')fail('Only the author or an administrator can attach a receipt.',403);if(!['image/png','image/jpeg','application/pdf'].includes(body.mime)||typeof body.data!=='string'||body.data.length>7000000)fail('Use a PNG, JPEG or PDF up to 5 MB.');const buffer=Buffer.from(body.data,'base64');const valid=body.mime==='application/pdf'?buffer.subarray(0,5).toString()==='%PDF-':body.mime==='image/png'?buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):buffer[0]===255&&buffer[1]===216&&buffer[2]===255;if(!valid||buffer.length>5*1024*1024)fail('Invalid receipt file.');run('INSERT INTO receipts VALUES(?,?,?) ON CONFLICT(expense_id) DO UPDATE SET mime=excluded.mime,data=excluded.data',e.id,body.mime,buffer);return {ok:true};}
      if(expense[2]==='settle'&&method==='POST')return transaction(db,()=>{const current=object('expenses',h,e.id);const amount=money(body.amount);if(amount>pendingBalance(current,u.id))fail('Amount exceeds your remaining unpaid share.');const sid=id();run('INSERT INTO settlements VALUES(?,?,?,?,?,?,NULL)',sid,e.id,u.id,amount,'sent',now());audit(h,u.id,'settlement.sent',sid);return {id:sid};});
      if(expense[2]==='void'&&method==='POST')return transaction(db,()=>{if(e.created_by!==u.id&&m.role==='member')fail('Only the author or an administrator can void expenses.',403);if(get('SELECT 1 FROM settlements WHERE expense_id=? AND status IN (\'sent\',\'confirmed\')',e.id))fail('An expense with sent or confirmed repayments cannot be voided.');run('UPDATE expenses SET voided=1 WHERE id=?',e.id);audit(h,u.id,'expense.voided',e.id);return {ok:true};});
    }
    const settlement=route.match(/^settlements\/([\w-]+)\/(confirm|reject)$/);
    if(settlement&&method==='POST')return transaction(db,()=>{const s=get('SELECT s.* FROM settlements s JOIN expenses e ON e.id=s.expense_id WHERE s.id=? AND e.household_id=?',settlement[1],h);if(!s)fail('Repayment not found.',404);const e=object('expenses',h,s.expense_id);if(e.payer!==u.id)fail('Only the recipient can confirm or reject a repayment.',403);if(s.status!=='sent')fail('This repayment has already been processed.');run('UPDATE settlements SET status=?,confirmed=? WHERE id=?',settlement[2]==='confirm'?'confirmed':'rejected',now(),s.id);audit(h,u.id,'settlement.'+settlement[2],s.id);return {ok:true};});
    if(route==='bills/stop'&&method==='POST') {membership(h,u,true);object('bills',h,body.id);run('UPDATE bills SET active=0 WHERE id=?',body.id);audit(h,u.id,'bill.stopped',body.id);return {ok:true};}
    if(route==='shopping'&&method==='POST'){const sid=id();run('INSERT INTO shopping VALUES(?,?,?,?,0,?,?)',sid,h,text(body.title,160),body.quantity?text(body.quantity,40):'',u.id,now());return {id:sid};}
    const shopping=route.match(/^shopping\/([\w-]+)$/);
    if(shopping&&shopping[1]!=='clear'&&['POST','DELETE'].includes(method)){object('shopping',h,shopping[1]);if(method==='DELETE')run('DELETE FROM shopping WHERE id=?',shopping[1]);else run('UPDATE shopping SET title=?,quantity=?,checked=? WHERE id=?',text(body.title,160),body.quantity?text(body.quantity,40):'',body.checked?1:0,shopping[1]);return {ok:true};}
    if(route==='shopping/clear'&&method==='POST'){run('DELETE FROM shopping WHERE household_id=? AND checked=1',h);return {ok:true};}
    fail('Not found.',404);
  }
  const staticFiles={'/':'index.html','/app.js':'app.js','/styles.css':'styles.css','/icon.svg':'icon.svg','/icon-192.png':'icon-192.png','/icon-512.png':'icon-512.png','/manifest.webmanifest':'manifest.webmanifest','/sw.js':'sw.js'};
  const server=http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob: data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'");res.setHeader('Cache-Control','no-store');
    try {
      const url=new URL(req.url,origin);
      if(url.pathname.startsWith('/api/')) {
        let body={};
        if(!['GET','HEAD'].includes(req.method)) {
          if(req.headers.origin!==origin||req.headers['x-home-request']!=='1')fail('Request origin rejected.',403);
          if(!(req.headers['content-type']||'').startsWith('application/json'))fail('Use JSON.',415);
          let chunks=[],size=0;for await(const chunk of req){size+=chunk.length;if(size>7100000)fail('Request too large.',413);chunks.push(chunk);}try{body=JSON.parse(Buffer.concat(chunks).toString()||'{}');if(!body||Array.isArray(body)||typeof body!=='object')fail('Invalid JSON.');}catch{fail('Invalid JSON.');}
        }
        const value=await api(req,res,url,body);if(!res.writableEnded){res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(value));}return;
      }
      if(!['GET','HEAD'].includes(req.method)||!staticFiles[url.pathname])fail('Not found.',404);
      const file=staticFiles[url.pathname],ext=file.split('.').at(-1),types={html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8',svg:'image/svg+xml',png:'image/png',webmanifest:'application/manifest+json'};
      const contents=await readFile(fileURLToPath(new URL('../frontend/'+file,import.meta.url)));res.setHeader('Content-Type',types[ext]||'application/octet-stream');res.end(req.method==='HEAD'?undefined:contents);
    } catch(e) { if(res.writableEnded)return;res.statusCode=e.status||500;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({error:e.status?e.message:'Something went wrong. Try again.'}));if(!e.status)console.error('Request failed:',e.code||e.name); }
  });
  server.requestTimeout=20000;server.headersTimeout=10000;
  return {server,db};
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {const {server}=createApp();server.listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log('Home listening on port '+(process.env.PORT||3000)));}
