import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function openDb(path = process.env.DATABASE_PATH || './data/home.sqlite') {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,password TEXT NOT NULL,verified INTEGER NOT NULL DEFAULT 0,reminders INTEGER NOT NULL DEFAULT 0,created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS tokens(hash TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id) ON DELETE CASCADE,kind TEXT NOT NULL,email TEXT NOT NULL,household_id TEXT,expires INTEGER NOT NULL,created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS households(id TEXT PRIMARY KEY,name TEXT NOT NULL,created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS members(household_id TEXT NOT NULL REFERENCES households(id),user_id TEXT NOT NULL REFERENCES users(id),role TEXT NOT NULL CHECK(role IN ('owner','admin','member')),PRIMARY KEY(household_id,user_id));
    CREATE UNIQUE INDEX IF NOT EXISTS one_owner ON members(household_id) WHERE role='owner';
    CREATE TABLE IF NOT EXISTS chores(id TEXT PRIMARY KEY,household_id TEXT NOT NULL REFERENCES households(id),title TEXT NOT NULL,assignee TEXT NOT NULL REFERENCES users(id),due TEXT NOT NULL,repeat_days INTEGER NOT NULL DEFAULT 0,rotation TEXT NOT NULL DEFAULT '[]',done INTEGER NOT NULL DEFAULT 0,swap_to TEXT REFERENCES users(id),parent_id TEXT,created INTEGER NOT NULL);
    CREATE UNIQUE INDEX IF NOT EXISTS chore_occurrence ON chores(parent_id,due) WHERE parent_id IS NOT NULL;
    CREATE TABLE IF NOT EXISTS expenses(id TEXT PRIMARY KEY,household_id TEXT NOT NULL REFERENCES households(id),title TEXT NOT NULL,category TEXT NOT NULL,amount INTEGER NOT NULL CHECK(amount>0),payer TEXT NOT NULL REFERENCES users(id),kind TEXT NOT NULL CHECK(kind IN ('purchase','bill')),due TEXT NOT NULL,method TEXT NOT NULL,note TEXT NOT NULL,created INTEGER NOT NULL,created_by TEXT NOT NULL REFERENCES users(id),voided INTEGER NOT NULL DEFAULT 0,template_id TEXT);
    CREATE UNIQUE INDEX IF NOT EXISTS bill_occurrence ON expenses(template_id,due) WHERE template_id IS NOT NULL;
    CREATE TABLE IF NOT EXISTS shares(expense_id TEXT NOT NULL REFERENCES expenses(id),user_id TEXT NOT NULL REFERENCES users(id),amount INTEGER NOT NULL CHECK(amount>=0),PRIMARY KEY(expense_id,user_id));
    CREATE TABLE IF NOT EXISTS settlements(id TEXT PRIMARY KEY,expense_id TEXT NOT NULL REFERENCES expenses(id),payer TEXT NOT NULL REFERENCES users(id),amount INTEGER NOT NULL CHECK(amount>0),status TEXT NOT NULL CHECK(status IN ('sent','confirmed','rejected')),created INTEGER NOT NULL,confirmed INTEGER);
    CREATE TABLE IF NOT EXISTS bills(id TEXT PRIMARY KEY,household_id TEXT NOT NULL REFERENCES households(id),title TEXT NOT NULL,category TEXT NOT NULL,amount INTEGER NOT NULL,payer TEXT NOT NULL,shares TEXT NOT NULL,method TEXT NOT NULL,note TEXT NOT NULL,next_due TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1,created_by TEXT NOT NULL,anchor_day INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS receipts(expense_id TEXT PRIMARY KEY REFERENCES expenses(id),mime TEXT NOT NULL,data BLOB NOT NULL);
    CREATE TABLE IF NOT EXISTS shopping(id TEXT PRIMARY KEY,household_id TEXT NOT NULL REFERENCES households(id),title TEXT NOT NULL,quantity TEXT NOT NULL,checked INTEGER NOT NULL DEFAULT 0,created_by TEXT NOT NULL,created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY,household_id TEXT NOT NULL,actor TEXT NOT NULL,action TEXT NOT NULL,record_id TEXT NOT NULL,created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS mail(id TEXT PRIMARY KEY,event_key TEXT UNIQUE NOT NULL,recipient TEXT NOT NULL,subject TEXT NOT NULL,body TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',attempts INTEGER NOT NULL DEFAULT 0,next_attempt INTEGER NOT NULL,created INTEGER NOT NULL,provider_id TEXT,error TEXT);
    CREATE TABLE IF NOT EXISTS rate_limits(key TEXT PRIMARY KEY,count INTEGER NOT NULL,expires INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS chore_household ON chores(household_id,due);
    CREATE INDEX IF NOT EXISTS expense_household ON expenses(household_id,created);
    CREATE INDEX IF NOT EXISTS token_expiry ON tokens(expires);
    CREATE TABLE IF NOT EXISTS push_config(id INTEGER PRIMARY KEY CHECK(id=1),private_jwk TEXT NOT NULL,public_key TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS push_subscriptions(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,endpoint TEXT UNIQUE NOT NULL,p256dh TEXT NOT NULL,auth TEXT NOT NULL,created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS push_outbox(id TEXT PRIMARY KEY,event_key TEXT UNIQUE NOT NULL,subscription_id TEXT NOT NULL REFERENCES push_subscriptions(id) ON DELETE CASCADE,payload TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,next_attempt INTEGER NOT NULL,created INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'pending',error TEXT);
  `);
  // Additive, restart-safe migration for existing installations; defaults preserve opt-in state.
  const columns=new Set(db.prepare('PRAGMA table_info(users)').all().map(c=>c.name));
  for(const [name,definition] of Object.entries({reminder_days:'INTEGER NOT NULL DEFAULT 0',reminder_time:"TEXT NOT NULL DEFAULT '09:00'",reminder_zone:"TEXT NOT NULL DEFAULT 'Europe/Oslo'",reminder_chores:'INTEGER NOT NULL DEFAULT 1',reminder_payments:'INTEGER NOT NULL DEFAULT 1',reminder_overdue:'INTEGER NOT NULL DEFAULT 0'}))if(!columns.has(name))db.exec(`ALTER TABLE users ADD COLUMN ${name} ${definition}`);
  transaction(db,()=>{
    for(const category of ['chore','payment'])for(const [suffix,definition,legacy] of [['days','INTEGER NOT NULL DEFAULT 0','reminder_days'],['time',"TEXT NOT NULL DEFAULT '09:00'",'reminder_time']]){
      const name=`${category}_reminder_${suffix}`;
      if(!columns.has(name)){db.exec(`ALTER TABLE users ADD COLUMN ${name} ${definition}`);db.exec(`UPDATE users SET ${name}=${legacy}`);}
    }
  });
  return db;
}
export function transaction(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try { const value=fn(); db.exec('COMMIT'); return value; }
  catch(e) { db.exec('ROLLBACK'); throw e; }
}
