import test from 'node:test';
import assert from 'node:assert/strict';
import { allocate,money,date,passwordHash,passwordCheck,nextMonth } from '../backend/domain.mjs';
test('integer allocation conserves every øre for unequal splits and participant order',()=>{
  for(let amount=1;amount<1100;amount++){const p=['c','a','b'].map(user_id=>({user_id})),shares=allocate(amount,p,'equal');assert.equal(shares.reduce((n,s)=>n+s.amount,0),amount);assert.deepEqual(shares,allocate(amount,p.reverse(),'equal'));assert.ok(Math.max(...shares.map(s=>s.amount))-Math.min(...shares.map(s=>s.amount))<=1);}
  assert.deepEqual(allocate(300000,[{user_id:'a',value:'50'},{user_id:'b',value:'30'},{user_id:'c',value:'20'}],'percentage').map(s=>s.amount),[150000,90000,60000]);
  assert.deepEqual(allocate(101,[{user_id:'a',value:'33.33'},{user_id:'b',value:'33.33'},{user_id:'c',value:'33.34'}],'percentage').map(s=>s.amount),[34,33,34]);
});
test('invalid money, shares, duplicate participants and impossible dates are rejected',()=>{
  assert.equal(money('123,45'),12345);for(const v of ['-1','0','1.001','NaN','1e3','10000001'])assert.throws(()=>money(v));
  assert.throws(()=>allocate(100,[{user_id:'a'},{user_id:'a'}],'equal'));assert.throws(()=>allocate(100,[{user_id:'a',value:'99'}],'percentage'));assert.throws(()=>allocate(100,[{user_id:'a',value:'0.99'}],'fixed'));
  assert.throws(()=>date('2026-02-30'));assert.equal(date('2028-02-29'),'2028-02-29');assert.equal(nextMonth('2026-01-31'),'2026-02-28');assert.equal(nextMonth('2026-02-28',31),'2026-03-31');
});
test('passwords use unique scrypt salts and verify correctly',async()=>{const a=await passwordHash('a long test password'),b=await passwordHash('a long test password');assert.notEqual(a,b);assert.equal(await passwordCheck('a long test password',a),true);assert.equal(await passwordCheck('wrong',a),false);await assert.rejects(passwordHash('short'));});
