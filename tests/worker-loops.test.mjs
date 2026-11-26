import test from 'node:test';
import assert from 'node:assert/strict';
import {startWorkerLoops} from '../backend/worker.mjs';

test('pending email cannot block one-second push checks or scheduling',async()=>{
  let mailCalls=0,pushCalls=0,scheduleCalls=0,releaseMail;const timers=[];const cancelled=[];
  const mailWait=new Promise(resolve=>{releaseMail=resolve;});
  const stop=startWorkerLoops({scheduleTask:()=>scheduleCalls++,mailTask:()=>{mailCalls++;return mailWait;},pushTask:async()=>{pushCalls++;return false;},timer:(fn,delay)=>{const handle={fn,delay};timers.push(handle);return handle;},cancelTimer:h=>cancelled.push(h)});
  await new Promise(resolve=>setImmediate(resolve));assert.equal(scheduleCalls,1);assert.equal(mailCalls,1);assert.equal(pushCalls,3);
  const pushTimer=timers.find(h=>h.delay===1000);assert.ok(pushTimer);pushTimer.fn();await new Promise(resolve=>setImmediate(resolve));assert.equal(pushCalls,6);assert.equal(mailCalls,1);
  const scheduleTimer=timers.find(h=>h.delay===15000);scheduleTimer.fn();assert.equal(scheduleCalls,2);
  stop();releaseMail(false);await new Promise(resolve=>setImmediate(resolve));assert.ok(cancelled.length>0);
});
