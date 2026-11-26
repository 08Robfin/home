const $=(s,root=document)=>root.querySelector(s), $$=(s,root=document)=>[...root.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const currency=n=>new Intl.NumberFormat('nb-NO',{style:'currency',currency:'NOK'}).format(n/100);
const day=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Oslo'}).format(new Date());
const fmt=d=>new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short'}).format(new Date(d+'T12:00:00Z'));
const dateLabel=d=>`${d<day()?'Overdue · ':d===day()?'Today · ':''}${fmt(d)}`;
const dateClass=d=>d<day()?'overdue':'';
const paths={home:'m3 10 9-7 9 7v10H3Zm6 10v-7h6v7',chores:'m9 6 2 2 4-4M9 14l2 2 4-4M4 6h1M4 14h1M4 21h16',payments:'M3 5h18v14H3Zm0 4h18M7 15h4',shopping:'m3 3 2 2 2 12h12l2-9H6M9 21h.01M18 21h.01',more:'M5 12h.01M12 12h.01M19 12h.01',check:'m5 12 4 4L19 6',close:'m6 6 12 12M6 18 18 6',settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm-7 4H2m20 0h-3M12 2v3m0 14v3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2'};
const icon=n=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${n==='more'?'<circle cx="5" cy="12" r="1.65" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.65" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.65" fill="currentColor" stroke="none"/>':n==='shopping'?'<path d="M3 3h2l2.4 12h11.2L21 7H6"/><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/>':`<path d="${paths[n]}"/>`}</svg>`;
const brand=`<a class="brand" href="/" aria-label="Home."><img src="/icon.svg" alt="">Home.</a>`;
let me=null,data=null,household=localStorage.getItem('home.household'),page='home',authMode='login',feedback='',viewError='';
let noticeTimer;
let theme=localStorage.getItem('home.theme')||'system';
function applyTheme(value){
  theme=['light','dark','system'].includes(value)?value:'system';
  document.documentElement.dataset.theme=theme;
  localStorage.setItem('home.theme',theme);
  const dark=theme==='dark'||theme==='system'&&matchMedia('(prefers-color-scheme: dark)').matches;
  document.querySelector('meta[name="theme-color"]').content=dark?'#141b17':'#f4f6f3';
}
applyTheme(theme);
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>applyTheme(theme));
function themeControl(){return '<div class="theme-picker" role="group" aria-label="Appearance">'+['light','dark','system'].map(value=>'<button type="button" data-action="theme" data-theme="'+value+'" aria-pressed="'+(theme===value)+'">'+value[0].toUpperCase()+value.slice(1)+'</button>').join('')+'</div>';}
let previousTab='home';
function navigate(next){previousTab=page;page=next;closeModal();render(true);window.scrollTo({top:0,behavior:'instant'});$('#main').focus({preventScroll:true});}
function showMore(){modal('More', '<div class="record-menu">'+btn('Settings','go-settings')+btn('Create household','create-household')+'</div><h3 class="appearance-label">Appearance</h3>'+themeControl()+'<div class="record-menu separated">'+btn('Sign out','logout','','danger')+'</div>','more-menu');$('.mobile-more')?.setAttribute('data-open','true');}

const fragment=new URLSearchParams(location.hash.slice(1));
let pendingToken=fragment.has('verify')?{kind:'verify',value:fragment.get('verify')}:fragment.has('reset')?{kind:'reset',value:fragment.get('reset')}:null;
if(fragment.has('invite'))sessionStorage.setItem('home.invite',fragment.get('invite'));
if(location.hash)history.replaceState(null,'',location.pathname);

async function api(path,body,method=body===undefined?'GET':'POST') {
  if(!navigator.onLine)throw new Error('You are offline. Reconnect to save changes.');
  const response=await fetch('/api'+path,{method,credentials:'same-origin',headers:body===undefined?{}:{'Content-Type':'application/json','X-Home-Request':'1'},body:body===undefined?undefined:JSON.stringify(body)});
  const result=await response.json();if(!response.ok){const error=new Error(result.error||'Could not complete this request.');error.status=response.status;throw error;}return result;
}
function notify(message){clearTimeout(noticeTimer);$('#notice').textContent=message;noticeTimer=setTimeout(()=>$('#notice').textContent='',5000);}
const btn=(label,action,extra='',cls='')=>`<button type="button" class="${cls}" data-action="${action}" ${extra}>${esc(label)}</button>`;
const field=(label,name,type='text',value='',extra='')=>`<div class="field"><label>${label}<input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label></div>`;
const select=(label,name,options,value='',extra='')=>`<div class="field"><label>${label}<select name="${name}" ${extra}>${options.map(o=>`<option value="${esc(o.value)}" ${o.value===value?'selected':''}>${esc(o.label)}</option>`).join('')}</select></label></div>`;
const memberOptions=()=>data.members.map(m=>({value:m.id,label:m.name}));
const memberName=uid=>data?.members.find(m=>m.id===uid)?.name||'Former member';
const name=uid=>esc(memberName(uid));
const empty=message=>`<p class="empty">${esc(message)}</p>`;
const admin=()=>data&&data.role!=='member';
const formError='<p class="error" role="alert"></p>';
const actions=(label='Save')=>`${formError}<div class="actions">${btn('Cancel','close')}<button class="primary" type="submit">${label}</button></div>`;
function heading(title,subtitle='',button=''){return `<header class="page-head"><div><h1>${esc(title)}</h1>${subtitle?`<p class="muted">${esc(subtitle)}</p>`:''}</div>${button}</header>`;}
function modal(title,content,kind=''){const d=$('#dialog');d.className=kind;d.innerHTML=`<div class="dialog-head"><h2 id="dialog-title">${esc(title)}</h2>${btn('×','close','aria-label="Close dialog"','quiet')}</div>${content}`;if(!d.open)d.showModal();setTimeout(()=>$('input:not([type=checkbox]),select,button[type=submit]',d)?.focus(),30);}
function closeModal(){const d=$('#dialog');if(d.open)d.close();}
function renderAuth(){
  let mode=pendingToken?.kind||authMode;
  const titles={login:'Sign in',register:'Create account',forgot:'Reset password',resend:'Resend verification',verify:'Verify email',reset:'Choose a new password'};
  let fields='';
  if(mode==='register')fields+=field('Name','name','text','','required maxlength="80" autocomplete="name"');
  if(['login','register','forgot','resend'].includes(mode))fields+=field('Email','email','email','','required maxlength="254" autocomplete="email"');
  if(['login','register','reset'].includes(mode))fields+=field(mode==='reset'?'New password':'Password','password','password','',`required ${mode==='login'?'':'minlength="12"'} maxlength="128" autocomplete="${mode==='login'?'current-password':'new-password'}"`);
  if(mode==='verify')fields='<p>Confirm your email address to use Home.</p>';
  $('#app').innerHTML=`<main id="main" class="auth">${brand}<h1>${titles[mode]}</h1>${feedback?`<p class="feedback" role="status">${esc(feedback)}</p>`:''}<form data-form="auth" data-mode="${mode}">${fields}${formError}<button class="primary">${mode==='verify'?'Verify email':mode==='forgot'||mode==='resend'?'Send email':titles[mode]}</button></form><div class="auth-links">${btn(mode==='login'?'Create account':'Back to sign in','auth',`data-mode="${mode==='login'?'register':'login'}"`,'quiet')}${mode==='login'?btn('Forgot password?','auth','data-mode="forgot"','quiet'):''}</div>${mode==='register'?'<p class="fine muted">Use at least 12 characters. You’ll need to verify your email.</p>':''}${mode==='login'?btn('Resend verification email','auth','data-mode="resend"','quiet'):''}${sessionStorage.getItem('home.invite')?'<p class="fine muted">Sign in or register with the email address that received the invitation.</p>':''}</main>`;
}
function render(animateNav=false){
  if(!me||pendingToken){renderAuth();return;}
  const nav=['home','chores','payments','shopping','settings'].map(n=>`<button class="nav-button ${page===n?'active':''}" data-action="navigate" data-page="${n}" ${page===n?'aria-current="page"':''}>${icon(n)}<span>${n[0].toUpperCase()+n.slice(1)}</span></button>`).join('');
  const dock=['home','chores','payments','shopping'].map(n=>`<button class="nav-button ${page===n?'active':''}" data-action="navigate" data-page="${n}" ${page===n?'aria-current="page"':''}>${icon(n)}<span>${n[0].toUpperCase()+n.slice(1)}</span></button>`).join('');
  let content;
  if(!me.user.verified)content=heading('Verify your email')+`<p>Check your inbox before creating or joining a household.</p>${btn('Resend verification','resend-logged','','primary')} ${btn('Check verification','reload')}`;
  else if(!data)content=heading('Your households','Create a household or open an invitation from your email.',btn('Create household','create-household','','primary'))+(viewError?`<p class="error">${esc(viewError)}</p>`:empty('You haven’t joined a household yet.'));
  else content=({home:renderHome,chores:renderChores,payments:renderPayments,shopping:renderShopping,settings:renderSettings}[page])();
  $('#app').innerHTML=`<div class="layout"><aside class="sidebar">${brand}<nav aria-label="Main navigation">${nav}</nav></aside><div class="workspace"><header class="topbar"><a href="/" class="mobile-brand" aria-label="Home."><img src="/icon.svg" alt=""><span>Home.</span></a><button class="household-trigger" type="button" data-action="households" aria-label="Switch household" aria-haspopup="dialog"><span>${esc(me.households.find(h=>h.id===household)?.name||'Households')}</span><svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m6 8 4 4 4-4"/></svg></button><div class="account"><span class="account-name meta">${esc(me.user.name)}</span><span class="avatar" aria-hidden="true">${esc(me.user.name[0].toUpperCase())}</span>${btn('Sign out','logout','','quiet small')}</div></header>${!navigator.onLine?'<div class="notice-strip" role="status">You’re offline. Reconnect to load and save changes.</div>':''}<main id="main" class="content" tabindex="-1">${content}</main></div><nav class="mobile-dock" aria-label="Mobile navigation"><div class="mobile-tabs" data-selected="${animateNav?previousTab:page}">${dock}</div><button class="mobile-more ${page==='settings'?'active':''}" type="button" data-action="more" aria-label="More" aria-haspopup="dialog"><span class="more-symbol">${icon('more')}${icon('close')}</span><span>More</span></button></nav></div>`;
  if(animateNav){const tabs=$('.mobile-tabs');getComputedStyle(tabs,'::before').transform;requestAnimationFrame(()=>{tabs.dataset.selected=page;});}
  document.title=`${data?data.household.name+' · ':''}Home.`;
}
function choreRow(c){
  const canComplete=!c.done&&(c.assignee===me.user.id||admin());
  const repeat=c.repeat_days===7?'Weekly':c.repeat_days===14?'Every 2 weeks':c.repeat_days===1?'Daily':c.repeat_days?'Every '+c.repeat_days+' days':'';
  return `<div class="row chore-row ${c.done?'done':''}">${canComplete?`<button class="complete-button" type="button" data-action="complete" data-id="${c.id}" aria-label="Complete ${esc(c.title)}">${icon('check')}</button>`:`<span class="complete-mark ${c.done?'is-done':''}" aria-hidden="true">${c.done?icon('check'):''}</span>`}<div class="row-main"><div class="row-title">${esc(c.title)}</div><div class="meta row-meta"><span>${name(c.assignee)}</span><span class="${!c.done?dateClass(c.due):''}">${c.due===day()?'Today':dateLabel(c.due)}</span></div></div>${!c.done?`<button class="icon-button row-more" type="button" data-action="chore-menu" data-id="${c.id}" aria-label="Actions for ${esc(c.title)}">${icon('more')}</button>`:''}</div>`;
}
function remaining(e,uid,pending=false){if(e.voided||e.payer===uid)return 0;const share=e.shares.find(s=>s.user_id===uid)?.amount||0;return share-e.settlements.filter(s=>s.payer===uid&&(s.status==='confirmed'||pending&&s.status==='sent')).reduce((a,s)=>a+s.amount,0);}
function totals(){let owe=0,owed=0;for(const e of data.expenses){if(e.voided)continue;if(e.payer===me.user.id)owed+=e.shares.reduce((n,s)=>n+remaining(e,s.user_id),0);else owe+=remaining(e,me.user.id);}return {owe,owed};}
function summary(){const t=totals();return `<div class="summary"><div><span>You owe</span><strong>${currency(t.owe)}</strong></div><div><span>Owed to you</span><strong>${currency(t.owed)}</strong></div></div>`;}
function renderHome(){
  const chores=data.chores.filter(c=>!c.done&&(c.assignee===me.user.id||c.swap_to===me.user.id)).slice(0,3);
  const payments=data.expenses.filter(e=>remaining(e,me.user.id)>0).sort((a,b)=>a.due.localeCompare(b.due)).slice(0,3);
  const confirmations=data.expenses.flatMap(e=>e.payer===me.user.id?e.settlements.filter(s=>s.status==='sent').map(s=>({e,s})):[]);
  return heading('Home',new Intl.DateTimeFormat('en-GB',{weekday:'long',day:'numeric',month:'long'}).format(new Date()))+summary()+`<div class="split-layout"><div><section class="section"><div class="section-head"><h2>Your chores</h2>${btn('View all','navigate','data-page="chores"','quiet small')}</div>${chores.map(choreRow).join('')||empty('No chores due.')}</section><section class="section"><div class="section-head"><h2>Upcoming payments</h2>${btn('View all','navigate','data-page="payments"','quiet small')}</div>${payments.map(e=>`<button type="button" class="payment-row" data-action="expense-open" data-id="${e.id}"><span class="item-symbol">${icon('payments')}</span><span class="row-main"><span class="row-title">${esc(e.title)}</span><span class="meta">To ${name(e.payer)} · ${e.due===day()?'Today':dateLabel(e.due)}</span></span><strong class="money">${currency(remaining(e,me.user.id))}</strong></button>`).join('')||empty('No outstanding payments.')}</section></div><div>${confirmations.length?`<section class="section"><div class="section-head"><h2>Confirm repayments</h2></div>${confirmations.map(({e,s})=>`<div class="row confirmation-row"><div class="row-main"><div class="row-title">${name(s.payer)}</div><div class="meta">${esc(e.title)} · ${currency(s.amount)}</div></div>${btn('Review','review-repayment',`data-id="${s.id}"`,'small')}</div>`).join('')}</section>`:''}<section class="section"><div class="section-head"><h2>Shopping</h2>${btn('Open list','navigate','data-page="shopping"','quiet small')}</div>${data.shopping.filter(s=>!s.checked).slice(0,3).map(s=>shoppingRow(s,false)).join('')||empty('Nothing on the list.')}</section></div></div>`;
}
function renderChores(){const active=data.chores.filter(c=>!c.done),completed=data.chores.filter(c=>c.done).sort((a,b)=>b.due.localeCompare(a.due));return heading('Chores','',btn('Add chore','add-chore','','primary'))+`<section class="section">${active.map(choreRow).join('')||empty('No chores yet. Add the first one.')}</section><section class="section"><div class="section-head"><h2>Completed</h2></div>${completed.slice(0,30).map(choreRow).join('')||empty('Completed chores will appear here.')}</section>`;}
function expenseDetail(e){
  const myDue=remaining(e,me.user.id),owed=e.payer===me.user.id?e.shares.reduce((n,share)=>n+remaining(e,share.user_id),0):0;
  const participates=e.shares.some(share=>share.user_id===me.user.id)||e.payer===me.user.id;
  const amount=e.voided?e.amount:myDue||owed||e.amount;
  const status=e.voided?'Voided':myDue?'You owe':owed?'Owed to you':participates?'Settled':'Not included';
  const context=e.kind==='bill'?'Due '+(e.due===day()?'today':fmt(e.due)):memberName(e.payer)+' paid · '+currency(e.amount);
  return `<details data-expense="${e.id}"><summary class="expense-summary"><span class="item-symbol">${icon(e.category==='Groceries'?'shopping':'payments')}</span><span class="row-main"><span class="row-title">${esc(e.title)}</span><span class="meta">${esc(context)}</span></span><span class="money"><strong>${currency(amount)}</strong><span class="meta ${myDue&&e.due<day()?'overdue':''}">${status}</span></span></summary><div class="expense-detail"><p class="detail-caption">Total ${currency(e.amount)} · Due ${fmt(e.due)}</p>${e.note?`<p>${esc(e.note)}</p>`:''}${e.shares.map(share=>{const pending=e.settlements.filter(t=>t.payer===share.user_id&&t.status==='sent').reduce((n,t)=>n+t.amount,0);const status=share.user_id===e.payer?(e.kind==='bill'?'Collector':'Paid'):e.voided?'Voided':remaining(e,share.user_id)===0?'Confirmed':currency(remaining(e,share.user_id))+' remaining'+(pending?' · '+currency(pending)+' sent':'');return `<div class="row"><div class="row-main"><div class="row-title">${name(share.user_id)}</div><div class="meta">${status}</div></div><span class="money">${currency(share.amount)}</span></div>`;}).join('')}${e.settlements.length?'<h3>Repayments</h3>':''}${e.settlements.map(repayment=>`<div class="row row-top"><div class="row-main"><span class="row-title">${name(repayment.payer)} · ${currency(repayment.amount)}</span><span class="meta">${repayment.status==='sent'?'Awaiting confirmation':repayment.status==='confirmed'?'Receipt confirmed':'Rejected'}</span></div>${repayment.status==='sent'&&e.payer===me.user.id?`<div class="row-actions">${btn('Confirm receipt','confirm',`data-id="${repayment.id}"`,'small')}${btn('Reject','reject',`data-id="${repayment.id}"`,'quiet small')}</div>`:''}</div>`).join('')}<div class="actions">${!e.voided&&remaining(e,me.user.id,true)>0?btn('Mark repayment as sent','repay',`data-id="${e.id}"`,'primary'):''}${e.receipt?`<a href="/api/h/${household}/expenses/${e.id}/receipt" target="_blank" rel="noopener">View receipt</a>`:''}${e.created_by===me.user.id||admin()?btn(e.receipt?'Replace receipt':'Attach receipt','receipt',`data-id="${e.id}"`,'small')+(!e.voided?btn('Void expense','void',`data-id="${e.id}"`,'danger small'):''):''}</div></div></details>`;
}
function renderPayments(){
  return heading('Payments','',btn('Add expense','add-expense','','primary'))+summary()+`<section class="section"><div class="section-head"><h2>Expenses</h2></div>${data.expenses.map(expenseDetail).join('')||empty('Add a purchase or bill to get started.')}</section>${data.bills.length?`<section class="section"><div class="section-head"><h2>Recurring bills</h2></div>${data.bills.map(b=>`<div class="row"><div class="row-main"><div class="row-title">${esc(b.title)}</div><div class="meta">${b.active?'Next: '+fmt(b.next_due):'Stopped'}</div></div>${b.active&&admin()?btn('Stop','stop-bill',`data-id="${b.id}"`,'quiet small'):''}</div>`).join('')}</section>`:''}`;
}
function shoppingRow(s,editable=true){return `<div class="row shopping-item ${s.checked?'done':''}"><label class="shopping-row"><input type="checkbox" data-shopping="${s.id}" ${s.checked?'checked':''}><span class="row-main"><span class="row-title">${esc(s.title)}</span>${s.quantity?`<span class="meta">${esc(s.quantity)}</span>`:''}</span></label>${editable?`<button class="icon-button" type="button" data-action="shopping-menu" data-id="${s.id}" aria-label="Actions for ${esc(s.title)}">${icon('more')}</button>`:''}</div>`;}
function renderShopping(){return heading('Shopping','',data.shopping.some(s=>s.checked)?btn('Clear checked','clear-shopping','','quiet small'):'')+`<form data-form="shopping" class="quick-add"><label><span class="sr-only">Item</span><input name="title" placeholder="Add an item" required maxlength="160"></label><button class="primary" aria-label="Add item">Add</button>${formError}</form><section class="section">${data.shopping.map(s=>shoppingRow(s)).join('')||empty('Nothing on the list yet.')}</section>`;}
function renderSettings(){return heading('Settings')+`<section class="section appearance-section"><h2>Appearance</h2>${themeControl()}</section>`+`<section class="section"><h2>Your account</h2><form data-form="profile" class="settings-form">${field('Name','name','text',me.user.name,'required maxlength="80"')}<p class="muted">${esc(me.user.email)}</p><label class="check"><input type="checkbox" name="reminders" ${me.user.reminders?'checked':''}>Email me about chores and payments due today</label>${formError}<div class="actions"><button class="primary">Save preferences</button></div></form></section><section class="section"><div class="section-head"><h2>${esc(data.household.name)}</h2>${admin()?btn('Rename','rename-household','','quiet small'):''}</div>${data.members.map(m=>`<div class="row"><div class="row-main"><div class="row-title">${esc(m.name)}${m.id===me.user.id?' (you)':''}</div><div class="meta">${esc(m.email)} · ${m.role}</div></div>${data.role==='owner'&&m.id!==me.user.id?btn('Manage','manage-member',`data-id="${m.id}"`,'quiet small'):''}</div>`).join('')}${admin()?`<form data-form="invite" class="inline-form actions"><label class="grow">Invite by email<input name="email" type="email" required maxlength="254" autocomplete="off"></label><button class="primary">Send invitation</button>${formError}</form>${data.invitations.map(i=>`<div class="row"><div class="row-main">${esc(i.email)}<div class="meta">Invitation expires ${fmt(new Date(i.expires).toISOString().slice(0,10))}</div></div>${btn('Revoke','revoke',`data-id="${i.id}"`,'quiet small')}</div>`).join('')}`:''}</section><section class="section"><h2>Household data</h2><p class="fine muted">Download the household’s expense ledger, chores, shopping list and activity. Receipts are available on each expense.</p><div class="row-actions">${btn('Export data','export')}${btn('Create household','create-household')}${btn('Leave household','leave','','danger')}</div></section><section class="section"><h2>Install Home.</h2><p class="fine muted">On iPhone, open in Safari, choose Share, then Add to Home Screen. On Android or desktop, use your browser’s install option. Changes need an internet connection.</p></section><section class="section"><h2>Recent activity</h2><div class="history">${data.audit.map(a=>`<div class="row"><div class="row-main"><span>${esc(a.name)}</span><div class="meta">${esc(a.action.replaceAll('.',' '))} · ${new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short'}).format(new Date(a.created))}</div></div></div>`).join('')||empty('No activity yet.')}</div></section>`;}

async function reload({quiet=false}={}){
  try{me=await api('/me');if(!me.households.some(h=>h.id===household))household=me.households[0]?.id||null;localStorage.setItem('home.household',household||'');data=household&&me.user.verified?await api('/h/'+household):null;viewError='';
    if(me.user.verified&&sessionStorage.getItem('home.invite')){const invite=sessionStorage.getItem('home.invite');modal('Join household',`<p>Accept the invitation sent to ${esc(me.user.email)}?</p>${formError}<div class="actions">${btn('Dismiss','dismiss-invite')}${btn('Join household','accept-invite',`data-token="${esc(invite)}"`,'primary')}</div>`);}
    if(!quiet||!$('#dialog').open&&!$('input:focus,textarea:focus,select:focus,details[open]'))render();
  }catch(e){if(e.status===401){me=null;data=null;render();}else if(!quiet){viewError=e.message;if(me)render();else{$('#app').innerHTML=`<main class="auth" id="main">${brand}<h1>Couldn’t load Home.</h1><p class="error">${esc(e.message)}</p>${btn('Try again','reload','','primary')}</main>`;}}}
}
function expenseForm(){
  modal('Add expense',`<form data-form="expense" data-method="equal">${field('Description','title','text','','required maxlength="160" placeholder="e.g. Sofa"')}${field('Amount (NOK)','amount','text','','required inputmode="decimal" placeholder="0.00"')}<div class="form-grid">${select('Paid by / pay to','payer',memberOptions(),me.user.id)}${select('Type','kind',[{value:'purchase',label:'Purchase'},{value:'bill',label:'Bill'}],'purchase')}</div><fieldset class="split-method"><legend>Split</legend><input type="hidden" name="method" value="equal"><div class="segmented" role="group" aria-label="Split method">${['equal','percentage','fixed'].map((method,i)=>`<button type="button" data-action="split-mode" data-method="${method}" aria-pressed="${i===0}">${['Equal','Percent','Fixed'][i]}</button>`).join('')}</div></fieldset><fieldset class="participants"><legend class="sr-only">Participants</legend>${data.members.map(m=>`<div class="participant"><label class="check"><input type="checkbox" name="participant" value="${m.id}" checked><span>${esc(m.name)}</span></label><input class="share-value hidden" name="share-${m.id}" aria-label="Share for ${esc(m.name)}" value="0" inputmode="decimal"><output class="share-amount money" data-user="${m.id}"></output></div>`).join('')}</fieldset><div class="preview" aria-live="polite"></div><details class="advanced-fields"><summary>Details</summary>${field('Due date','due','date',day(),'required')}${select('Category','category',['Furniture','Groceries','Electricity','Rent','Other'].map(label=>({value:label,label})),'Other')}<label class="check monthly-option hidden"><input type="checkbox" name="monthly">Repeat monthly</label><div class="field"><label>Note<textarea name="note" maxlength="2000"></textarea></label></div></details>${actions('Save expense')}</form>`);updatePreview();
}
function expenseParticipants(form){return $$('input[name=participant]:checked',form).map(i=>({user_id:i.value,value:form.elements['share-'+i.value].value}));}
function updatePreview(){
  const form=$('form[data-form=expense]');if(!form)return;
  const method=form.elements.method.value;form.dataset.method=method;
  $$('.share-value',form).forEach(i=>i.classList.toggle('hidden',method==='equal'));
  $('.monthly-option',form).classList.toggle('hidden',form.elements.kind.value!=='bill');
  if(form.elements.kind.value!=='bill')form.elements.monthly.checked=false;
  const value=Number(form.elements.amount.value.replace(',','.'));
  const selected=expenseParticipants(form).sort((a,b)=>a.user_id.localeCompare(b.user_id));
  let message='',shares=[];
  if(value>0&&selected.length){
    const amount=Math.round(value*100);
    if(method==='equal'){const base=Math.floor(amount/selected.length),left=amount-base*selected.length;shares=selected.map((p,i)=>({...p,amount:base+(i<left?1:0)}));}
    else if(method==='fixed'){shares=selected.map(p=>({...p,amount:Math.round(Number(p.value.replace(',','.'))*100)}));if(shares.reduce((a,b)=>a+b.amount,0)!==amount)message='Shares must equal the total.';}
    else{const weights=selected.map(p=>Math.round(Number(p.value.replace(',','.'))*100));if(weights.reduce((a,b)=>a+b,0)!==10000)message='Percentages must total 100%.';else{shares=selected.map((p,i)=>({...p,amount:Math.floor(amount*weights[i]/10000),rem:amount*weights[i]%10000}));let left=amount-shares.reduce((a,b)=>a+b.amount,0);[...shares].sort((a,b)=>b.rem-a.rem||a.user_id.localeCompare(b.user_id)).forEach(share=>{if(left-->0)share.amount++;});}}
  }
  $$('.share-amount',form).forEach(output=>{const share=shares.find(p=>p.user_id===output.dataset.user);output.textContent=share&&!message?currency(share.amount):'—';});
  $('.preview',form).innerHTML=message?`<p class="error">${message}</p>`:`<div class="preview-total"><span>Total</span><strong>${value>0?currency(Math.round(value*100)):currency(0)}</strong></div>`;
}

document.addEventListener('submit',async event=>{
  const form=event.target;if(!form.dataset.form)return;event.preventDefault();const error=$('.error',form);error.textContent='';const submit=$('button[type=submit],button:not([type])',form);if(submit)submit.disabled=true;const values=Object.fromEntries(new FormData(form));
  try{
    const type=form.dataset.form;
    if(type==='auth'){
      const mode=form.dataset.mode;if(mode==='login'){await api('/auth/login',values);feedback='';await reload();}
      else{const result=await api('/auth/'+({register:'register',forgot:'forgot',resend:'resend',verify:'verify',reset:'reset'}[mode]),{...values,...(pendingToken?{token:pendingToken.value}:{})});feedback=result.message;pendingToken=null;authMode='login';renderAuth();}return;
    }
    if(type==='household'){const result=await api('/households',values);household=result.id;page='home';}
    if(type==='rename')await api(`/h/${household}/rename`,values);
    if(type==='profile')await api('/profile',{...values,reminders:form.elements.reminders.checked});
    if(type==='invite')await api(`/h/${household}/invite`,values);
    if(type==='chore')await api(`/h/${household}/chores`,{...values,rotation:$$('input[name=rotation]:checked',form).map(i=>i.value)});
    if(type==='expense')await api(`/h/${household}/expenses`,{...values,participants:expenseParticipants(form),monthly:form.elements.monthly.checked});
    if(type==='repay')await api(`/h/${household}/expenses/${form.dataset.id}/settle`,values);
    if(type==='swap')await api(`/h/${household}/chores/${form.dataset.id}/swap`,values);
    if(type==='reassign')await api(`/h/${household}/chores/${form.dataset.id}/reassign`,values);
    if(type==='shopping'||type==='edit-shopping')await api(`/h/${household}/shopping${type==='edit-shopping'?'/'+form.dataset.id:''}`,{...values,checked:form.elements.checked?.checked||false});
    if(type==='receipt'){const file=form.elements.receipt.files[0];if(!file||file.size>5*1024*1024)throw new Error('Select a receipt up to 5 MB.');const content=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result.split(',')[1]);r.onerror=reject;r.readAsDataURL(file);});await api(`/h/${household}/expenses/${form.dataset.id}/receipt`,{mime:file.type,data:content});}
    closeModal();notify(type==='invite'?'Invitation queued for email delivery.':type==='repay'?'Marked as sent. The recipient can now confirm.':'Saved.');await reload();
  }catch(e){error.textContent=e.message;}finally{if(submit)submit.disabled=false;}
});
document.addEventListener('click',async event=>{
  const button=event.target.closest('[data-action]');if(!button)return;const action=button.dataset.action,record=button.dataset.id;const path=`/h/${household}`;
  try{
    if(action==='close'){closeModal();return;}
    if(action==='auth'){pendingToken=null;feedback='';authMode=button.dataset.mode;renderAuth();return;}
    if(action==='navigate'){navigate(button.dataset.page);return;}
    if(action==='more'){showMore();return;}
    if(action==='households'){
      modal('Households','<div class="household-list">'+me.households.map(h=>'<button type="button" class="household-option '+(h.id===household?'selected':'')+'" data-action="switch-household" data-id="'+esc(h.id)+'" '+(h.id===household?'aria-current="true"':'')+'><span class="household-initial" aria-hidden="true">'+esc(h.name[0].toUpperCase())+'</span><span>'+esc(h.name)+'</span><span class="household-check">'+(h.id===household?icon('check'):'')+'</span></button>').join('')+'</div><div class="record-menu separated">'+btn('Create household','create-household')+'</div>','household-menu');return;
    }
    if(action==='switch-household'){household=record;page='home';closeModal();await reload();window.scrollTo({top:0,behavior:'instant'});return;}
    if(action==='split-mode'){
      const form=button.closest('form'),method=button.dataset.method;form.elements.method.value=method;
      $$('[data-action="split-mode"]',form).forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
      if(method==='percentage'&&expenseParticipants(form).every(p=>Number(p.value)===0)){const fields=$$('input[name="participant"]:checked',form);fields.forEach((field,i)=>{form.elements['share-'+field.value].value=((Math.floor(10000/fields.length)+(i<10000%fields.length?1:0))/100).toFixed(2);});}
      updatePreview();return;
    }
    if(action==='go-settings'){navigate('settings');return;}
    if(action==='theme'){applyTheme(button.dataset.theme);if($('#dialog').classList.contains('more-menu'))showMore();else render();return;}
    if(action==='chore-menu'){
      const c=data.chores.find(c=>c.id===record);
      const recurrence=c.repeat_days?(c.repeat_days===7?'Repeats weekly':'Repeats every '+c.repeat_days+' days')+(c.rotation.length?' · Rotates':''):'';
      const menu=[c.assignee===me.user.id&&data.members.length>1?btn('Request swap','swap',`data-id="${record}"`):'',c.swap_to===me.user.id?btn('Accept swap','accept-swap',`data-id="${record}"`)+btn('Decline swap','decline-swap',`data-id="${record}"`):'',admin()?btn('Change assignment','reassign',`data-id="${record}"`):''].join('');
      modal(c.title,(recurrence?'<p class="muted">'+esc(recurrence)+'</p>':'')+(c.swap_to?'<p>Swap requested: '+name(c.swap_to)+'</p>':'')+'<div class="record-menu">'+(menu||'<p class="muted">Assigned to '+name(c.assignee)+'</p>')+'</div>');return;
    }
    if(action==='shopping-menu'){const s=data.shopping.find(s=>s.id===record);modal(s.title,'<div class="record-menu">'+btn('Edit item','edit-shopping',`data-id="${record}"`)+btn('Remove item','remove-shopping',`data-id="${record}"`,'danger')+'</div>');return;}
    if(action==='expense-open'){navigate('payments');const detail=$('[data-expense="'+record+'"]');if(detail){detail.open=true;detail.scrollIntoView({block:'start'});}return;}
    if(action==='review-repayment'){const expense=data.expenses.find(e=>e.settlements.some(s=>s.id===record));const settlement=expense.settlements.find(s=>s.id===record);modal('Confirm repayment','<p>'+name(settlement.payer)+' · '+currency(settlement.amount)+'</p><p class="muted">'+esc(expense.title)+'</p><div class="record-menu">'+btn('Confirm receipt','confirm',`data-id="${record}"`)+btn('Reject repayment','reject',`data-id="${record}"`,'danger')+'</div>');return;}
    if(action==='reload'){await reload();return;}
    if(action==='logout'){await api('/auth/logout',{});closeModal();me=null;data=null;render();return;}
    if(action==='resend-logged'){await api('/auth/resend',{email:me.user.email});notify('Verification email requested.');return;}
    if(action==='create-household'){modal('Create household',`<form data-form="household">${field('Household name','name','text','','required maxlength="100"')}${actions('Create household')}</form>`);return;}
    if(action==='rename-household'){modal('Rename household',`<form data-form="rename">${field('Household name','name','text',data.household.name,'required maxlength="100"')}${actions()}</form>`);return;}
    if(action==='dismiss-invite'){sessionStorage.removeItem('home.invite');closeModal();return;}
    if(action==='accept-invite'){const r=await api('/invitations/accept',{token:button.dataset.token});sessionStorage.removeItem('home.invite');household=r.id;page='home';closeModal();await reload();return;}
    if(action==='add-chore'){modal('Add chore',`<form data-form="chore">${field('Chore','title','text','','required maxlength="160"')}<div class="form-grid">${select('Assigned to','assignee',memberOptions(),me.user.id)}${field('Due date','due','date',day(),'required')}</div>${select('Repeat','repeat_days',[{value:'0',label:'Does not repeat'},{value:'1',label:'Every day'},{value:'7',label:'Every week'},{value:'14',label:'Every two weeks'},{value:'28',label:'Every four weeks'}],'0')}<fieldset><legend>Rotate between (optional)</legend>${data.members.map(m=>`<label class="check"><input type="checkbox" name="rotation" value="${m.id}">${esc(m.name)}</label>`).join('')}</fieldset>${actions('Add chore')}</form>`);return;}
    if(action==='add-expense'){expenseForm();return;}
    if(action==='repay'){const e=data.expenses.find(e=>e.id===record);modal('Mark repayment as sent',`<p>${esc(e.title)} · to ${name(e.payer)}</p><form data-form="repay" data-id="${record}">${field('Amount sent (NOK)','amount','text',(remaining(e,me.user.id,true)/100).toFixed(2),'required inputmode="decimal"')}<p class="fine muted">Only mark money you have already sent. Partial repayments are allowed.</p>${actions('Mark as sent')}</form>`);return;}
    if(action==='receipt'){modal('Attach receipt',`<form data-form="receipt" data-id="${record}"><div class="field"><label>PNG, JPEG or PDF · up to 5 MB<input name="receipt" type="file" accept="image/png,image/jpeg,application/pdf" required></label></div>${actions('Upload receipt')}</form>`);return;}
    if(action==='swap'||action==='reassign'){modal(action==='swap'?'Request chore swap':'Change assignment',`<form data-form="${action}" data-id="${record}">${select('Assign to','user_id',memberOptions().filter(m=>action==='reassign'||m.value!==me.user.id))}${actions(action==='swap'?'Request swap':'Save')}</form>${action==='reassign'?btn('Stop repeating and rotating','stop-chore',`data-id="${record}"`,'quiet danger'):''}`);return;}
    if(action==='edit-shopping'){const s=data.shopping.find(s=>s.id===record);modal('Edit item',`<form data-form="edit-shopping" data-id="${record}">${field('Item','title','text',s.title,'required maxlength="160"')}${field('Quantity','quantity','text',s.quantity,'maxlength="40"')}<label class="check"><input type="checkbox" name="checked" ${s.checked?'checked':''}>Checked</label>${actions()}</form>`);return;}
    if(action==='manage-member'){const m=data.members.find(m=>m.id===record);modal(m.name,`<div class="stack">${btn(m.role==='admin'?'Make member':'Make administrator','role',`data-id="${record}" data-role="${m.role==='admin'?'member':'admin'}"`)}${btn('Transfer ownership','role',`data-id="${record}" data-role="owner"`)}${btn('Remove from household','remove-member',`data-id="${record}"`,'danger')}</div>${formError}`);return;}
    if(action==='export'){const output=await api(path+'/export'),blob=new Blob([JSON.stringify(output,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`home-export-${day()}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return;}
    const destructive={void:'Void this expense? It stays in the history.',reject:'Reject this repayment? The amount will become unpaid again.',confirm:'Confirm you received this repayment?',leave:'Leave this household? Outstanding obligations must be settled first.',revoke:'Revoke this invitation?', 'remove-member':'Remove this member from the household?','stop-bill':'Stop future bills? Existing expenses stay in the ledger.','clear-shopping':'Remove all checked items?', 'remove-shopping':'Remove this shopping item?'};
    if(destructive[action]&&!confirm(destructive[action]))return;
    if(action==='role'&&button.dataset.role==='owner'&&!confirm('Transfer ownership to this member? You will become an administrator.'))return;
    button.disabled=true;
    const calls={complete:()=>api(`${path}/chores/${record}/complete`,{}),'accept-swap':()=>api(`${path}/chores/${record}/accept`,{}),'decline-swap':()=>api(`${path}/chores/${record}/decline`,{}),'stop-chore':()=>api(`${path}/chores/${record}/stop`,{}),confirm:()=>api(`${path}/settlements/${record}/confirm`,{}),reject:()=>api(`${path}/settlements/${record}/reject`,{}),void:()=>api(`${path}/expenses/${record}/void`,{}),'stop-bill':()=>api(path+'/bills/stop',{id:record}),revoke:()=>api(path+'/revoke',{id:record}),role:()=>api(path+'/member',{user_id:record,role:button.dataset.role}),leave:()=>api(path+'/leave',{}),'remove-member':()=>api(path+'/leave',{user_id:record}),'clear-shopping':()=>api(path+'/shopping/clear',{}),'remove-shopping':()=>api(path+'/shopping/'+record,{},'DELETE')};
    if(calls[action]){await calls[action]();closeModal();notify('Saved.');await reload();}
  }catch(e){if($('#dialog').open&&$('.error',$('#dialog')))$('.error',$('#dialog')).textContent=e.message;else notify(e.message);}finally{button.disabled=false;}
});
document.addEventListener('change',async event=>{const el=event.target;if(el.dataset.shopping){const item=data.shopping.find(s=>s.id===el.dataset.shopping);try{await api(`/h/${household}/shopping/${item.id}`,{title:item.title,quantity:item.quantity,checked:el.checked});await reload();}catch(e){el.checked=!el.checked;notify(e.message);}}if(el.closest('form[data-form=expense]'))updatePreview();});
document.addEventListener('input',event=>{if(event.target.closest('form[data-form=expense]'))updatePreview();});
window.addEventListener('online',()=>reload());window.addEventListener('offline',()=>notify('You are offline. Changes need an internet connection.'));
$('#dialog').addEventListener('close',()=>$('.mobile-more')?.removeAttribute('data-open'));
$('#dialog').addEventListener('click',event=>{if(event.target!==$('#dialog'))return;const bounds=event.target.getBoundingClientRect();if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)closeModal();});
setInterval(()=>{if(me&&document.visibilityState==='visible'&&!$('#dialog').open&&!$('input:focus,textarea:focus,select:focus,details[open]'))reload({quiet:true});},20000);
if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
await reload();
