import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync} from 'node:fs';
import {join,dirname,resolve,basename} from 'node:path';
import {tmpdir} from 'node:os';
import {openDb} from '../backend/db.mjs';

test('separate schedule migration preserves old choices and never overwrites later changes',()=>{
  const dir=mkdtempSync(join(tmpdir(),'home-reminder-test-'));const path=join(dir,'test.sqlite');let db;
  try{
    db=new DatabaseSync(path);db.exec("CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,password TEXT NOT NULL,verified INTEGER NOT NULL DEFAULT 0,reminders INTEGER NOT NULL DEFAULT 0,created INTEGER NOT NULL,reminder_days INTEGER NOT NULL DEFAULT 0,reminder_time TEXT NOT NULL DEFAULT '09:00');INSERT INTO users VALUES('u','u@example.test','Demo','synthetic',1,1,0,2,'18:30')");db.close();
    db=openDb(path);let user=db.prepare('SELECT * FROM users').get();assert.equal(user.chore_reminder_days,2);assert.equal(user.payment_reminder_days,2);assert.equal(user.chore_reminder_time,'18:30');assert.equal(user.payment_reminder_time,'18:30');
    db.prepare("UPDATE users SET chore_reminder_days=0,chore_reminder_time='08:00'").run();db.close();db=openDb(path);user=db.prepare('SELECT * FROM users').get();assert.equal(user.chore_reminder_days,0);assert.equal(user.chore_reminder_time,'08:00');assert.equal(user.payment_reminder_days,2);assert.equal(user.payment_reminder_time,'18:30');
  }finally{if(db?.isOpen)db.close();assert.equal(dirname(resolve(dir)),resolve(tmpdir()));assert.ok(basename(dir).startsWith('home-reminder-test-'));rmSync(dir,{recursive:true,force:true});}
});
