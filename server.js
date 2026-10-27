const express = require('express');
const multer = require('multer');
const path = require('path');
const { db, seed, logActivity } = require('./db');

seed(); // seed on first boot

const app = express();
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));
const upload = multer({ storage: multer.memoryStorage() });

const now = () => new Date().toISOString().slice(0, 10);
function addBusinessDays(fromISO, days) {
  const d = new Date(fromISO); let added = 0;
  while (added < days) { d.setDate(d.getDate() + 1); const wd = d.getDay(); if (wd !== 0 && wd !== 6) added++; }
  return d.toISOString().slice(0, 10);
}
const DEFAULT_SLA_DAYS = 10;

// ---------- Projects ----------
app.get('/api/projects', (req, res) => res.json(db.prepare('SELECT * FROM projects ORDER BY id').all()));

// ---------- Vendors ----------
app.get('/api/vendors', (req, res) => {
  const { project_id } = req.query;
  const rows = project_id
    ? db.prepare('SELECT * FROM vendors WHERE project_id=? ORDER BY name').all(project_id)
    : db.prepare('SELECT * FROM vendors ORDER BY name').all();
  res.json(rows);
});
app.patch('/api/vendors/:id', (req, res) => {
  const v = db.prepare('SELECT * FROM vendors WHERE id=?').get(req.params.id);
  if (!v) return res.status(404).json({ error: 'not found' });
  const email = req.body.email ?? v.email;
  db.prepare('UPDATE vendors SET email=? WHERE id=?').run(email, v.id);
  if (email !== v.email) logActivity({ vendor_name: v.name, action: 'Email updated', detail: `${v.email || '(blank)'} → ${email}` });
  res.json(db.prepare('SELECT * FROM vendors WHERE id=?').get(v.id));
});

// ---------- Orders ----------
app.get('/api/orders', (req, res) => {
  const { status, file_no, requestor, q } = req.query;
  let sql = 'SELECT * FROM orders WHERE 1=1', args = [];
  if (status) { sql += ' AND status=?'; args.push(status); }
  if (file_no) { sql += ' AND file_no LIKE ?'; args.push('%' + file_no + '%'); }
  if (requestor) { sql += ' AND requestor LIKE ?'; args.push('%' + requestor + '%'); }
  if (q) { sql += ' AND (vendor_name LIKE ? OR scr_entries LIKE ?)'; args.push('%' + q + '%', '%' + q + '%'); }
  sql += ' ORDER BY (due_date IS NULL), due_date ASC, id DESC';
  res.json(db.prepare(sql).all(...args));
});

app.post('/api/orders', (req, res) => {
  const b = req.body;
  const request_date = b.request_date || now();
  const due_date = b.due_date || addBusinessDays(request_date, DEFAULT_SLA_DAYS);
  const info = db.prepare(`INSERT INTO orders
    (project_id,vendor_id,file_no,vendor_name,trade,scr_entries,email,waiver_type,payment_stage,amount,requestor,request_date,due_date,status,notes)
    VALUES (@project_id,@vendor_id,@file_no,@vendor_name,@trade,@scr_entries,@email,@waiver_type,@payment_stage,@amount,@requestor,@request_date,@due_date,@status,@notes)`)
    .run({
      project_id: b.project_id ?? 1, vendor_id: b.vendor_id ?? null, file_no: b.file_no ?? '',
      vendor_name: b.vendor_name ?? '', trade: b.trade ?? '', scr_entries: b.scr_entries ?? '',
      email: b.email ?? '', waiver_type: b.waiver_type ?? 'Conditional', payment_stage: b.payment_stage ?? 'Progress',
      amount: b.amount ?? '', requestor: b.requestor ?? '', request_date, due_date,
      status: b.status ?? 'New', notes: b.notes ?? ''
    });
  logActivity({ order_id: info.lastInsertRowid, file_no: b.file_no, vendor_name: b.vendor_name, requestor: b.requestor, action: 'Created', detail: `${b.waiver_type}/${b.payment_stage}` });
  res.json(db.prepare('SELECT * FROM orders WHERE id=?').get(info.lastInsertRowid));
});

app.patch('/api/orders/:id', (req, res) => {
  const o = db.prepare('SELECT * FROM orders WHERE id=?').get(req.params.id);
  if (!o) return res.status(404).json({ error: 'not found' });
  const fields = ['file_no','vendor_name','trade','scr_entries','email','waiver_type','payment_stage','amount','requestor','request_date','due_date','status','notes'];
  const upd = {}; for (const f of fields) upd[f] = req.body[f] ?? o[f];
  db.prepare(`UPDATE orders SET file_no=@file_no,vendor_name=@vendor_name,trade=@trade,scr_entries=@scr_entries,email=@email,
    waiver_type=@waiver_type,payment_stage=@payment_stage,amount=@amount,requestor=@requestor,request_date=@request_date,
    due_date=@due_date,status=@status,notes=@notes,updated_at=datetime('now') WHERE id=@id`).run({ ...upd, id: o.id });
  if (req.body.status && req.body.status !== o.status)
    logActivity({ order_id: o.id, file_no: o.file_no, vendor_name: o.vendor_name, requestor: o.requestor, action: 'Status → ' + req.body.status });
  res.json(db.prepare('SELECT * FROM orders WHERE id=?').get(o.id));
});

// Resend: bump counter, stamp date, log
app.post('/api/orders/:id/resend', (req, res) => {
  const o = db.prepare('SELECT * FROM orders WHERE id=?').get(req.params.id);
  if (!o) return res.status(404).json({ error: 'not found' });
  const status = o.status === 'New' ? 'Requested' : (o.status === 'Requested' ? 'Reminder Sent' : o.status);
  db.prepare("UPDATE orders SET sent_count=sent_count+1,last_sent=?,status=?,updated_at=datetime('now') WHERE id=?")
    .run(now(), status, o.id);
  logActivity({ order_id: o.id, file_no: o.file_no, vendor_name: o.vendor_name, requestor: o.requestor,
    action: o.sent_count === 0 ? 'Sent' : 'Resent', detail: `to ${o.email || '(no email)'}` });
  res.json(db.prepare('SELECT * FROM orders WHERE id=?').get(o.id));
});

app.delete('/api/orders/:id', (req, res) => {
  const o = db.prepare('SELECT * FROM orders WHERE id=?').get(req.params.id);
  if (o) { db.prepare('UPDATE orders SET status=? WHERE id=?').run('Cancelled', o.id);
    logActivity({ order_id: o.id, file_no: o.file_no, vendor_name: o.vendor_name, action: 'Cancelled' }); }
  res.json({ ok: true });
});

// ---------- Templates ----------
app.get('/api/templates', (req, res) => res.json(db.prepare('SELECT * FROM templates ORDER BY kind,stage').all()));
app.patch('/api/templates/:id', (req, res) => {
  const t = db.prepare('SELECT * FROM templates WHERE id=?').get(req.params.id);
  if (!t) return res.status(404).json({ error: 'not found' });
  db.prepare("UPDATE templates SET title=?,body=?,updated_at=datetime('now') WHERE id=?")
    .run(req.body.title ?? t.title, req.body.body ?? t.body, t.id);
  res.json(db.prepare('SELECT * FROM templates WHERE id=?').get(t.id));
});

// ---------- Document render (print) ----------
function exhibitRows(entries) {
  if (!entries) return '<p><i>No SCR entries on file.</i></p>';
  const list = entries.split(',').map(s => s.trim()).filter(Boolean);
  let html = '<table class="ex"><tr><th>#</th><th>SCR Entry Number</th></tr>';
  list.forEach((e, i) => { html += `<tr><td>${i + 1}</td><td>${e}</td></tr>`; });
  return html + '</table>';
}
app.get('/api/orders/:id/doc', (req, res) => {
  const o = db.prepare('SELECT * FROM orders WHERE id=?').get(req.params.id);
  if (!o) return res.status(404).send('not found');
  const proj = db.prepare('SELECT * FROM projects WHERE id=?').get(o.project_id) || {};
  const which = req.query.kind; // template id OR 'packet'
  const tmap = db.prepare('SELECT * FROM templates').all();
  const find = (kind, stage) => tmap.find(t => t.kind === kind && (stage ? t.stage === stage : true));
  const fill = (body) => body
    .replace(/{{TITLE}}/g, (find(o.waiver_type, o.payment_stage) || {}).title || '')
    .replace(/{{PROJECT}}/g, proj.name || '').replace(/{{COUNTY}}/g, proj.county || '')
    .replace(/{{VENDOR}}/g, o.vendor_name || '').replace(/{{ENTRIES}}/g, o.scr_entries || '')
    .replace(/{{AMOUNT}}/g, o.amount || '________________________')
    .replace(/{{PERIOD}}/g, '________________________').replace(/{{GOODTHRU}}/g, '________________________')
    .replace(/{{FILE_NO}}/g, o.file_no || '').replace(/{{TRADE}}/g, o.trade || '')
    .replace(/{{WAIVER_TYPE}}/g, o.waiver_type || '').replace(/{{STAGE}}/g, o.payment_stage || '')
    .replace(/{{DUE_DATE}}/g, o.due_date || '').replace(/{{REQUEST_DATE}}/g, o.request_date || '')
    .replace(/{{REQUESTOR}}/g, o.requestor || '').replace(/{{REQUESTOR_EMAIL}}/g, o.email || '')
    .replace(/{{EXHIBIT_ROWS}}/g, exhibitRows(o.scr_entries));
  const cover = find('Coversheet');
  const waiver = find(o.waiver_type, o.payment_stage);
  let inner = '';
  if (which === 'cover') inner = fill(cover.body);
  else if (which === 'waiver') inner = fill(waiver.body);
  else inner = fill(cover.body) + '<div class="pagebreak"></div>' + fill(waiver.body);
  res.send(`<!doctype html><html><head><meta charset="utf-8"><title>${o.vendor_name} — Waiver Packet</title>
    <link rel="stylesheet" href="/doc.css"></head><body onload="window.focus()">${inner}
    <div class="noprint bar"><button onclick="window.print()">Print / Save as PDF</button></div></body></html>`);
});

// ---------- Reports ----------
app.get('/api/reports/status', (req, res) => {
  const rows = db.prepare('SELECT status, COUNT(*) n FROM orders GROUP BY status').all();
  const total = db.prepare('SELECT COUNT(*) n FROM orders').get().n;
  const overdue = db.prepare("SELECT COUNT(*) n FROM orders WHERE due_date < date('now') AND status NOT IN ('Signed','Recorded','Cancelled')").get().n;
  res.json({ byStatus: rows, total, overdue });
});
app.get('/api/reports/activity', (req, res) => {
  const { from, to, file_no, requestor } = req.query;
  let sql = 'SELECT * FROM activity WHERE 1=1', a = [];
  if (from) { sql += ' AND at >= ?'; a.push(from); }
  if (to) { sql += ' AND at <= ?'; a.push(to + ' 23:59:59'); }
  if (file_no) { sql += ' AND file_no LIKE ?'; a.push('%' + file_no + '%'); }
  if (requestor) { sql += ' AND requestor LIKE ?'; a.push('%' + requestor + '%'); }
  sql += ' ORDER BY at DESC LIMIT 1000';
  res.json(db.prepare(sql).all(...a));
});
// Missing Request: vendors (from registry scrub) that have no active order yet
app.get('/api/reports/missing', (req, res) => {
  const pid = req.query.project_id || 1;
  const vendors = db.prepare('SELECT * FROM vendors WHERE project_id=?').all(pid);
  const ordered = new Set(db.prepare('SELECT vendor_name FROM orders WHERE status != ?').all('Cancelled').map(o => o.vendor_name));
  res.json(vendors.filter(v => !ordered.has(v.name)));
});

// ---------- Batch upload (CSV or JSON of vendors -> create orders) ----------
app.post('/api/batch', upload.single('file'), (req, res) => {
  let rows = [];
  if (req.file) {
    const text = req.file.buffer.toString('utf8');
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    const hdr = lines.shift().split(',').map(h => h.trim().toLowerCase());
    rows = lines.map(l => {
      const cells = l.match(/("([^"]|"")*"|[^,]*)/g).filter((_, i) => i % 2 === 0).map(c => c.replace(/^"|"$/g, '').replace(/""/g, '"').trim());
      const o = {}; hdr.forEach((h, i) => o[h] = cells[i] || ''); return o;
    });
  } else if (Array.isArray(req.body.rows)) rows = req.body.rows;
  const requestor = req.body.requestor || (rows[0] && rows[0].requestor) || '';
  const file_no = req.body.file_no || '';
  const waiver_type = req.body.waiver_type || 'Conditional';
  const payment_stage = req.body.payment_stage || 'Progress';
  const ins = db.prepare(`INSERT INTO orders (project_id,vendor_id,file_no,vendor_name,trade,scr_entries,email,waiver_type,payment_stage,requestor,request_date,due_date,status)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const rd = now(), dd = addBusinessDays(rd, DEFAULT_SLA_DAYS);
  let made = 0;
  const tx = db.transaction(() => {
    for (const r of rows) {
      const vname = r.vendor || r.vendor_name || r.name; if (!vname) continue;
      const v = db.prepare('SELECT * FROM vendors WHERE name=?').get(vname);
      ins.run(1, v ? v.id : null, r.file_no || file_no, vname, r.trade || (v && v.trade) || '',
        r.scr_entries || r['scr entry numbers'] || (v && v.scr_entries) || '',
        r.email || (v && v.email) || '', r.waiver_type || waiver_type, r.payment_stage || payment_stage,
        r.requestor || requestor, rd, dd, 'New');
      made++;
    }
  });
  tx();
  logActivity({ file_no, requestor, action: 'Batch upload', detail: `${made} orders created` });
  res.json({ created: made });
});

// One-click: create orders for every vendor missing one (demo accelerator)
app.post('/api/batch/all-missing', (req, res) => {
  const requestor = req.body.requestor || '';
  const file_no = req.body.file_no || '';
  const wt = req.body.waiver_type || 'Conditional', ps = req.body.payment_stage || 'Progress';
  const vendors = db.prepare('SELECT * FROM vendors WHERE project_id=1').all();
  const ordered = new Set(db.prepare('SELECT vendor_name FROM orders WHERE status != ?').all('Cancelled').map(o => o.vendor_name));
  const rd = now(), dd = addBusinessDays(rd, DEFAULT_SLA_DAYS);
  const ins = db.prepare(`INSERT INTO orders (project_id,vendor_id,file_no,vendor_name,trade,scr_entries,email,waiver_type,payment_stage,requestor,request_date,due_date,status)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  let made = 0;
  const tx = db.transaction(() => {
    for (const v of vendors) { if (ordered.has(v.name)) continue;
      ins.run(1, v.id, file_no, v.name, v.trade, v.scr_entries, v.email, wt, ps, requestor, rd, dd, 'New'); made++; }
  });
  tx();
  logActivity({ file_no, requestor, action: 'Batch: all missing', detail: `${made} orders created` });
  res.json({ created: made });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`SCR system running on http://localhost:${PORT}`));
