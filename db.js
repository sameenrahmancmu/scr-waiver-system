// Database schema, seed, and demo-data generator for the SCR waiver system.
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const SEED_PATH = fs.existsSync(path.join(DATA_DIR, 'seed.json'))
  ? path.join(DATA_DIR, 'seed.json')
  : path.join(__dirname, 'data', 'seed.json');

const db = new Database(path.join(DATA_DIR, 'scr.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, file_no TEXT, county TEXT,
  owner TEXT, gc TEXT, lender TEXT, is_sample INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS vendors (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, trade TEXT,
  phone TEXT, email TEXT, contact TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS vendor_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vendor_id INTEGER REFERENCES vendors(id) ON DELETE CASCADE,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  entry TEXT, filed TEXT, county TEXT, parcels TEXT);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  vendor_id INTEGER REFERENCES vendors(id),
  waiver_type TEXT, payment_stage TEXT, amount TEXT, through_date TEXT,
  requestor TEXT, request_date TEXT, due_date TEXT, status TEXT DEFAULT 'New',
  sent_count INTEGER DEFAULT 0, last_sent TEXT, received_date TEXT,
  email TEXT, notes TEXT,
  created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT, stage TEXT, title TEXT, body TEXT,
  updated_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER, project_id INTEGER,
  vendor_id INTEGER, actor TEXT, action TEXT, detail TEXT,
  at TEXT DEFAULT (datetime('now')));
CREATE INDEX IF NOT EXISTS ix_orders_project ON orders(project_id);
CREATE INDEX IF NOT EXISTS ix_act_at ON activity(at);
`);

// ---------- helpers ----------
const STATUSES = ['New', 'Sent', 'Follow-up', 'Received', 'On Hold', 'Cancelled'];
const OPEN = ['New', 'Sent', 'Follow-up', 'On Hold'];
const REQUESTORS = [
  { name: 'Jennifer Tilton', email: 'JTilton@OldRepublicTitle.com' },
  { name: 'Maria Lopez', email: 'mlopez@oldrepublictitle.com' },
  { name: 'Dan Whitaker', email: 'dwhitaker@oldrepublictitle.com' },
  { name: 'Priya Shah', email: 'pshah@oldrepublictitle.com' },
];

const iso = (d) => d.toISOString().slice(0, 10);
const todayISO = () => iso(new Date());
function addBusinessDays(fromISO, n) {
  const d = new Date(fromISO + 'T12:00:00Z');
  let step = n >= 0 ? 1 : -1, left = Math.abs(n);
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + step);
    const w = d.getUTCDay();
    if (w !== 0 && w !== 6) left--;
  }
  return iso(d);
}
function addDays(fromISO, n) { const d = new Date(fromISO + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return iso(d); }

function getSetting(k, def) { const r = db.prepare('SELECT value FROM settings WHERE key=?').get(k); return r ? r.value : def; }
function setSetting(k, v) { db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(k, String(v)); }

function log({ order_id = null, project_id = null, vendor_id = null, actor = '', action, detail = '', at = null }) {
  if (at) db.prepare('INSERT INTO activity(order_id,project_id,vendor_id,actor,action,detail,at) VALUES(?,?,?,?,?,?,?)')
    .run(order_id, project_id, vendor_id, actor, action, detail, at);
  else db.prepare('INSERT INTO activity(order_id,project_id,vendor_id,actor,action,detail) VALUES(?,?,?,?,?,?)')
    .run(order_id, project_id, vendor_id, actor, action, detail);
}

// ---------- templates ----------
function seedTemplates(force = false) {
  if (!force && db.prepare('SELECT COUNT(*) c FROM templates').get().c) return;
  db.exec('DELETE FROM templates');
  const { defaults } = require('./templates');
  const ins = db.prepare('INSERT INTO templates(kind,stage,title,body) VALUES(?,?,?,?)');
  for (const t of defaults) ins.run(t.kind, t.stage, t.title, t.body);
}

// ---------- demo data ----------
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

function seedAll({ demo = true } = {}) {
  db.exec('DELETE FROM activity; DELETE FROM orders; DELETE FROM vendor_entries; DELETE FROM vendors; DELETE FROM projects;');
  db.exec("DELETE FROM sqlite_sequence WHERE name IN ('activity','orders','vendor_entries','vendors','projects')");
  seedTemplates(true);
  if (!getSetting('sla_days')) setSetting('sla_days', 10);
  if (!getSetting('company')) setSetting('company', 'Old Republic Title');

  const seed = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));
  const R = rng(20261027);
  const pick = (a) => a[Math.floor(R() * a.length)];
  const insP = db.prepare('INSERT INTO projects(name,file_no,county,owner,gc,lender,is_sample) VALUES(?,?,?,?,?,?,?)');
  const insV = db.prepare('INSERT INTO vendors(name,trade,phone,email) VALUES(?,?,?,?)');
  const insE = db.prepare('INSERT INTO vendor_entries(vendor_id,project_id,entry,filed,county,parcels) VALUES(?,?,?,?,?,?)');

  const p = seed.project;
  const cormont = insP.run(p.name, p.file_no, p.county, p.owner, p.gc, p.lender, 0).lastInsertRowid;
  const vendorIds = {};
  for (const v of seed.vendors) {
    const id = insV.run(v.name, v.trade, v.phone, v.email).lastInsertRowid;
    vendorIds[v.name] = id;
    for (const e of v.entries) insE.run(id, cormont, e.entry, e.filed, e.county, JSON.stringify(e.parcels));
  }
  if (!demo) { setSetting('demo', 0); return; }
  setSetting('demo', 1);

  // Two clearly-labelled sample files so the dashboard shows a multi-file office
  const samples = [
    { name: 'Heber Valley Commons', file_no: 'ORT-UT-26-05230', county: 'Wasatch', owner: 'HVC Holdings LLC (sample)',
      gc: 'Wardell Brothers Construction', lender: 'Sample Bank', n: 12, prefix: '00-0031-', base: 101, age: [3, 30] },
    { name: 'Deer Valley East Townhomes', file_no: 'ORT-UT-26-05517', county: 'Summit', owner: 'DVE Residential LLC (sample)',
      gc: 'Jacobsen Construction Company, Inc.', lender: 'Sample Credit Union', n: 9, prefix: '00-0045-', base: 201, age: [0, 14] },
  ];
  const names = Object.keys(vendorIds);
  const projectsForOrders = [{ id: cormont, vendors: names, age: [0, 48], skip: 5 }];
  let fakeEntry = 12990000;
  for (const s of samples) {
    const pid = insP.run(s.name, s.file_no, s.county, s.owner, s.gc, s.lender, 1).lastInsertRowid;
    const chosen = [...names].sort(() => R() - 0.5).slice(0, s.n);
    const parcels = Array.from({ length: 24 }, (_, i) => s.prefix + String(s.base + i).padStart(4, '0'));
    for (const vn of chosen) {
      const k = 1 + (R() < 0.3 ? 1 : 0);
      for (let j = 0; j < k; j++) {
        fakeEntry += Math.floor(R() * 9000) + 500;
        const filed = addDays(todayISO(), -Math.floor(40 + R() * 200));
        const pc = R() < 0.6 ? parcels : parcels.slice(0, 2 + Math.floor(R() * 6));
        insE.run(vendorIds[vn], pid, String(fakeEntry), filed, s.county, JSON.stringify(pc));
      }
    }
    projectsForOrders.push({ id: pid, vendors: chosen, age: s.age, skip: 0 });
  }

  const sla = Number(getSetting('sla_days', 10));
  const today = todayISO();
  const insO = db.prepare(`INSERT INTO orders(project_id,vendor_id,waiver_type,payment_stage,amount,through_date,requestor,
    request_date,due_date,status,sent_count,last_sent,received_date,email,notes,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const reqW = () => { const r = R(); return r < 0.45 ? REQUESTORS[0] : r < 0.65 ? REQUESTORS[1] : r < 0.85 ? REQUESTORS[2] : REQUESTORS[3]; };
  const money = () => '$' + (Math.round((2500 + R() * 180000) * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 });
  const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const stamp = (dISO, h, m) => { const s = `${dISO} ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`; return s > nowStr ? nowStr : s; };
  const bizBack = (n) => addBusinessDays(today, -n);

  for (const P of projectsForOrders) {
    const list = [...P.vendors].sort(() => R() - 0.5);
    const active = list.slice(0, list.length - P.skip); // leave some vendors with no request -> Missing report
    for (const vn of active) {
      const vid = vendorIds[vn];
      const v = db.prepare('SELECT * FROM vendors WHERE id=?').get(vid);
      const nOrders = P.id === cormont && R() < 0.22 ? 2 : 1;
      for (let k = 0; k < nOrders; k++) {
        const age = Math.floor(P.age[0] + R() * (P.age[1] - P.age[0]));
        const rd = bizBack(age);
        const due = addBusinessDays(rd, sla);
        const r = R();
        let status;
        if (age > 20) status = r < .64 ? 'Received' : r < .87 ? 'Follow-up' : r < .91 ? 'Sent' : r < .96 ? 'On Hold' : 'Cancelled';
        else if (age > 12) status = r < .45 ? 'Received' : r < .80 ? 'Follow-up' : r < .95 ? 'Sent' : 'On Hold';
        else if (age > 7) status = r < .35 ? 'Received' : r < .55 ? 'Follow-up' : r < .95 ? 'Sent' : 'On Hold';
        else status = r < .45 ? 'Sent' : r < .80 ? 'New' : 'Received';
        if (age === 0 && status === 'Received') status = 'New';
        const stage = k === 1 ? 'Final' : (R() < 0.85 ? 'Progress' : 'Final');
        const type = R() < 0.78 ? 'Conditional' : 'Unconditional';
        const rq = reqW();
        let sent = status === 'New' ? 0 : status === 'Follow-up' ? 2 + Math.floor(R() * 2) : status === 'Sent' ? 1 : 1 + (R() < .3 ? 1 : 0);
        if (status === 'Cancelled') sent = 1;
        let lastSent = sent ? (sent > 1 ? addBusinessDays(rd, Math.min(age, 5 * (sent - 1))) : rd) : null;
        if (status === 'Follow-up') { const back = Math.floor(R() * 7); lastSent = back < age ? bizBack(back) : rd; }
        const dueFinal = status === 'Follow-up' && lastSent ? addBusinessDays(lastSent, 5 + Math.floor(R() * 4)) : due;
        const recv = status === 'Received' ? addBusinessDays(rd, Math.max(1, Math.min(age, 2 + Math.floor(R() * 9)))) : null;
        const amount = stage === 'Progress' && R() < 0.75 ? money() : (stage === 'Final' ? money() : '');
        const thru = stage === 'Progress' ? addDays(rd, -Math.floor(R() * 10) - 3) : '';
        const notes = status === 'On Hold' ? pick(['Waiting on lender draw approval', 'Vendor disputing invoice amount', 'Holding until next pay app'])
          : status === 'Cancelled' ? pick(['Duplicate request', 'Vendor paid directly by GC']) : '';
        const id = insO.run(P.id, vid, type, stage, amount, thru, rq.name, rd, dueFinal, status, sent, lastSent, recv,
          v.email, notes, stamp(rd, 9, 5), stamp(recv || lastSent || rd, 15, 0)).lastInsertRowid;
        // activity timeline
        log({ order_id: id, project_id: P.id, vendor_id: vid, actor: rq.name, action: 'Request created', detail: `${type} · ${stage}`, at: stamp(rd, 9, 5 + Math.floor(R() * 40)) });
        if (sent >= 1) log({ order_id: id, project_id: P.id, vendor_id: vid, actor: rq.name, action: 'Sent', detail: `Packet emailed to ${v.email}`, at: stamp(rd, 10, Math.floor(R() * 59)) });
        for (let s = 2; s <= sent; s++) {
          let dd = addBusinessDays(rd, Math.min(age, 5 * (s - 1)));
          if (s === sent && lastSent) dd = lastSent; else if (lastSent && dd > lastSent) dd = lastSent;
          log({ order_id: id, project_id: P.id, vendor_id: vid, actor: rq.name, action: 'Follow-up sent', detail: `Reminder #${s - 1} to ${v.email}`, at: stamp(dd, 11, Math.floor(R() * 59)) });
        }
        if (status === 'On Hold') log({ order_id: id, project_id: P.id, vendor_id: vid, actor: rq.name, action: 'Status → On Hold', detail: notes, at: stamp(addBusinessDays(rd, Math.min(age, 3)), 14, 10) });
        if (status === 'Cancelled') log({ order_id: id, project_id: P.id, vendor_id: vid, actor: rq.name, action: 'Status → Cancelled', detail: notes, at: stamp(addBusinessDays(rd, Math.min(age, 2)), 13, 30) });
        if (recv) log({ order_id: id, project_id: P.id, vendor_id: vid, actor: rq.name, action: 'Received', detail: 'Signed waiver returned', at: stamp(recv, 13 + Math.floor(R() * 3), Math.floor(R() * 59)) });
      }
    }
  }
  // a few email-address updates in history
  const vs = db.prepare('SELECT * FROM vendors ORDER BY RANDOM() LIMIT 5').all();
  vs.forEach((v, i) => {
    const old = v.email ? v.email.replace('@', '.old@') : 'unknown@vendor.com';
    log({ vendor_id: v.id, project_id: cormont, actor: pick(REQUESTORS).name, action: 'Email updated', detail: `${old} → ${v.email}`, at: stamp(bizBack(3 + i * 4), 16, 12) });
  });
  log({ project_id: cormont, actor: 'Jennifer Tilton', action: 'Registry scrub imported', detail: `${seed.vendors.length} vendors · ${seed.vendors.reduce((a, v) => a + v.entries.length, 0)} SCR entries`, at: stamp(bizBack(48), 8, 30) });
}

function ensureSeeded() {
  const n = db.prepare('SELECT COUNT(*) c FROM projects').get().c;
  if (!n) seedAll({ demo: process.env.DEMO_DATA !== '0' });
  else seedTemplates(false);
}

if (require.main === module) {
  seedAll({ demo: !process.argv.includes('--no-demo') });
  console.log('Seeded.');
}

module.exports = { db, log, seedAll, ensureSeeded, seedTemplates, getSetting, setSetting, addBusinessDays, todayISO, STATUSES, OPEN, REQUESTORS };
