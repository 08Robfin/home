import test from 'node:test';
import assert from 'node:assert/strict';
import {openDb} from '../backend/db.mjs';
import {enqueue,now} from '../backend/domain.mjs';
import {schedule,deliverOne} from '../backend/worker.mjs';
test('permanent delivery failure clears sensitive link body and is not retried',async()=>{const db=openDb(':memory:');try{enqueue(db,{key:'fake-event',to:'test@example.test',subject:'Test',body:'Synthetic test token body'});let calls=0;await deliverOne(db,{apiKey:'fake',from:'test@example.test',fetchImpl:async()=>{calls++;return {ok:false,status:403};}});await deliverOne(db,{apiKey:'fake',from:'test@example.test',fetchImpl:async()=>{calls++;}});const row=db.prepare('SELECT * FROM mail').get();assert.equal(row.status,'failed');assert.equal(row.body,'');assert.equal(row.error,'Provider HTTP 403');assert.equal(calls,1);}finally{db.close();}});
test('expired queued mail is suppressed before provider delivery',()=>{const db=openDb(':memory:');try{enqueue(db,{key:'expired-test',to:'test@example.test',subject:'Test',body:'Synthetic expired link'});db.prepare('UPDATE mail SET created=?').run(now()-24*3600000);schedule(db,'https://home.example.test');const row=db.prepare('SELECT * FROM mail').get();assert.equal(row.status,'failed');assert.equal(row.body,'');}finally{db.close();}});
