import {addDays,enqueue} from './domain.mjs';
import {queuePush} from './push.mjs';

export function localSchedule(instant,zone) {
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(instant);
  const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));return {day:`${p.year}-${p.month}-${p.day}`,time:`${p.hour}:${p.minute}`};
}
export function scheduleReminders(db,origin,instant=new Date()) {
  for(const u of db.prepare('SELECT * FROM users WHERE verified=1 AND (reminders=1 OR EXISTS(SELECT 1 FROM push_subscriptions s WHERE s.user_id=users.id))').all()) {
    const local=localSchedule(instant,u.reminder_zone);
    for(const category of ['chore','payment']){
      const plural=category==='chore'?'chores':'payments';
      if(!u['reminder_'+plural]||local.time<u[category+'_reminder_time'])continue;
      const target=addDays(local.day,u[category+'_reminder_days']);
      const due=d=>d===target||u.reminder_overdue&&d<local.day;
      const lines=[];
      if(category==='chore')for(const c of db.prepare('SELECT c.* FROM chores c JOIN members m ON m.household_id=c.household_id AND m.user_id=? WHERE c.assignee=? AND c.done=0').all(u.id,u.id).filter(c=>due(c.due)))lines.push('Chore: '+c.title+' — '+c.due);
      else {
        const bills=db.prepare(`SELECT e.*,s.amount-COALESCE((SELECT SUM(t.amount) FROM settlements t WHERE t.expense_id=e.id AND t.payer=? AND t.status IN ('sent','confirmed')),0) AS remaining FROM expenses e JOIN shares s ON s.expense_id=e.id JOIN members m ON m.household_id=e.household_id AND m.user_id=? WHERE s.user_id=? AND e.payer<>? AND e.voided=0`).all(u.id,u.id,u.id,u.id).filter(e=>e.remaining>0&&due(e.due));
        // Remind about future templates without creating a charge early.
        for(const b of db.prepare('SELECT b.* FROM bills b JOIN members m ON m.household_id=b.household_id AND m.user_id=? WHERE b.active=1 AND b.payer<>? AND b.next_due=? AND NOT EXISTS(SELECT 1 FROM expenses e WHERE e.template_id=b.id AND e.due=b.next_due)').all(u.id,u.id,target)){
          const share=JSON.parse(b.shares).find(s=>s.user_id===u.id);if(share?.amount>0)bills.push({...b,due:b.next_due,remaining:share.amount});
        }
        for(const b of bills)lines.push('Payment: '+b.title+' — '+(b.remaining/100).toFixed(2)+' NOK — '+b.due);
      }
      if(!lines.length)continue;
      const legacyKey='reminder:'+u.id+':'+local.day,key=legacyKey+':'+plural;
      // A combined digest from before this upgrade must not be re-sent as two new digests.
      if(u.reminders&&!db.prepare('SELECT 1 FROM mail WHERE event_key=?').get(legacyKey))enqueue(db,{key,to:u.email,subject:'Your Home. '+category+' reminders',body:[...lines,'',origin,'','Manage reminders in Settings on Home.'].join('\n')});
      for(const sub of db.prepare('SELECT id FROM push_subscriptions WHERE user_id=?').all(u.id))if(!db.prepare('SELECT 1 FROM push_outbox WHERE event_key=?').get(legacyKey+':'+sub.id))queuePush(db,sub.id,key+':'+sub.id,{title:'Home.',body:'You have '+category+' reminders. Open Home. to view them.',tag:'home-'+plural});
    }

  }
}
