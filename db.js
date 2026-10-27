// SQLite schema + seed for the SCR waiver system.
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = path.join(DATA_DIR, 'scr.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  file_no TEXT,
  county TEXT,
  owner TEXT,
  gc TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS vendors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER REFERENCES projects(id),
  name TEXT NOT NULL,
  trade TEXT,
  phone TEXT,
  email TEXT,
  scr_entries TEXT,       -- comma separated entry numbers
  n_entries INTEGER DEFAULT 0,
  n_parcels INTEGER DEFAULT 0,
  coverage TEXT
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER REFERENCES projects(id),
  vendor_id INTEGER REFERENCES vendors(id),
  file_no TEXT,                 -- title file number
  vendor_name TEXT,
  trade TEXT,
  scr_entries TEXT,
  email TEXT,
  waiver_type TEXT,             -- Conditional / Unconditional
  payment_stage TEXT,          -- Progress / Final
  amount TEXT,
  requestor TEXT,              -- who requested
  request_date TEXT,
  due_date TEXT,
  status TEXT DEFAULT 'New',   -- New, Requested, Reminder Sent, Signed, Recorded, Cancelled, On Hold
  sent_count INTEGER DEFAULT 0,
  last_sent TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,          -- Unconditional, Conditional, Coversheet
  stage TEXT,                  -- Progress, Final, (blank for coversheet)
  title TEXT,
  body TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER,
  file_no TEXT,
  vendor_name TEXT,
  requestor TEXT,
  action TEXT,
  detail TEXT,
  at TEXT DEFAULT (datetime('now'))
);
`);

function logActivity(o) {
  db.prepare(`INSERT INTO activity (order_id,file_no,vendor_name,requestor,action,detail)
              VALUES (@order_id,@file_no,@vendor_name,@requestor,@action,@detail)`).run({
    order_id: o.order_id ?? null, file_no: o.file_no ?? '', vendor_name: o.vendor_name ?? '',
    requestor: o.requestor ?? '', action: o.action, detail: o.detail ?? ''
  });
}

function seed(force = false) {
  const n = db.prepare('SELECT COUNT(*) c FROM projects').get().c;
  if (n > 0 && !force) return;
  if (force) {
    db.exec('DELETE FROM orders; DELETE FROM vendors; DELETE FROM projects; DELETE FROM activity;');
  }
  const seedData = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'seed.json'), 'utf8'));
  const p = seedData.project;
  const pid = db.prepare('INSERT INTO projects (name,file_no,county,owner,gc) VALUES (?,?,?,?,?)')
                .run(p.name, p.file_no, p.county, p.owner, p.gc).lastInsertRowid;
  const insV = db.prepare(`INSERT INTO vendors (project_id,name,trade,phone,email,scr_entries,n_entries,n_parcels,coverage)
                           VALUES (?,?,?,?,?,?,?,?,?)`);
  for (const v of seedData.vendors) {
    insV.run(pid, v.name, v.trade, v.phone, v.email,
             v.entries.map(e => e.entry).join(', '), v.n_entries, v.n_parcels, v.coverage);
  }
  seedTemplates(force);
  console.log(`Seeded project ${p.name} with ${seedData.vendors.length} vendors.`);
}

function seedTemplates(force = false) {
  const c = db.prepare('SELECT COUNT(*) c FROM templates').get().c;
  if (c > 0 && !force) return;
  if (force) db.exec('DELETE FROM templates;');
  const defs = require('./templates');
  const ins = db.prepare('INSERT INTO templates (kind,stage,title,body) VALUES (?,?,?,?)');
  for (const t of defs.defaults) ins.run(t.kind, t.stage, t.title, t.body);
}

if (require.main === module && process.argv.includes('--reseed')) {
  seed(true);
  console.log('Reseed complete.');
}

module.exports = { db, seed, seedTemplates, logActivity, DB_PATH };
