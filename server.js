const express = require('express');
const path = require('path');
const fs = require('fs');
const {
  db, log, seedAll, ensureSeeded, getSetting, setSetting, addBusinessDays, todayISO,
  STATUSES, OPEN, REQUESTORS,
} = require('./db');

ensureSeeded();

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ---------------- helpers ----------------
const ORDER_SQL = `SELECT o.*, v.name vendor_name, v.trade, v.phone vendor_phone, v.email vendor_email,
  p.name project_name, p.file_no, p.county, p.is_sample
  FROM orders o JOIN vendors v ON v.id=o.vendor_id JOIN projects p ON p.id=o.project_id`;

function daysBetween(a, b) { return Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / 864e5); }
function decorate(o) {
  const t = todayISO();
  const open = OPEN.includes(o.status);
  o.overdue = open && o.status !== 'On Hold' && o.due_date && o.due_date < t;
  o.due_soon = open && o.status !== 'On Hold' && !o.overdue && o.due_date && daysBetween(t, o.due_date) <= 3;
  o.age = o.request_date ? daysBetween(o.request_date, o.received_date || t) : 0;
  o.entries = db.prepare('SELECT entry FROM vendor_entries WHERE vendor_id=? AND project_id=? ORDER BY filed').all(o.vendor_id, o.project_id).map(e => e.entry);
  return o;
}
const reqEmail = (name) => (REQUESTORS.find(r => r.name === name) || {}).email || '';
const fmtDate = (s) => { if (!s) return ''; const [y, m, d] = s.split('-'); return `${+m}/${+d}/${y}`; };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------------- meta / settings ----------------
app.get('/api/meta', (req, res) => {
  res.json({
    projects: db.prepare('SELECT * FROM projects ORDER BY is_sample, name').all(),
    requestors: REQUESTORS,
    statuses: STATUSES,
    settings: { sla_days: Number(getSetting('sla_days', 10)), company: getSetting('company', 'Old Republic Title'), demo: getSetting('demo', '0') === '1' },
    today: todayISO(),
  });
});
app.patch('/api/settings', (req, res) => {
  if (req.body.sla_days) setSetting('sla_days', Math.max(1, Math.min(60, Number(req.body.sla_days))));
  if (req.body.company) setSetting('company', req.body.company);
  res.json({ ok: true });
});
app.post('/api/demo/reset', (req, res) => {
  seedAll({ demo: req.body.demo !== false });
  res.json({ ok: true });
});

// ---------------- projects / vendors ----------------
app.post('/api/projects', (req, res) => {
  const b = req.body;
  if (!b.name || !b.file_no) return res.status(400).json({ error: 'name and file_no required' });
  const id = db.prepare('INSERT INTO projects(name,file_no,county,owner,gc,lender) VALUES(?,?,?,?,?,?)')
    .run(b.name, b.file_no, b.county || '', b.owner || '', b.gc || '', b.lender || '').lastInsertRowid;
  log({ project_id: id, actor: b.actor || '', action: 'File opened', detail: `${b.file_no} · ${b.name}` });
  res.json(db.prepare('SELECT * FROM projects WHERE id=?').get(id));
});

app.get('/api/vendors', (req, res) => {
  const pid = req.query.project_id;
  const rows = db.prepare(`SELECT v.*,
      (SELECT COUNT(*) FROM vendor_entries e WHERE e.vendor_id=v.id ${pid ? 'AND e.project_id=@pid' : ''}) n_entries,
      (SELECT GROUP_CONCAT(entry, ', ') FROM vendor_entries e WHERE e.vendor_id=v.id ${pid ? 'AND e.project_id=@pid' : ''}) entries,
      (SELECT COUNT(*) FROM orders o WHERE o.vendor_id=v.id ${pid ? 'AND o.project_id=@pid' : ''}) n_orders,
      (SELECT COUNT(*) FROM orders o WHERE o.vendor_id=v.id AND o.status IN ('New','Sent','Follow-up','On Hold') ${pid ? 'AND o.project_id=@pid' : ''}) n_open
    FROM vendors v ORDER BY v.name`).all(pid ? { pid } : {});
  res.json(pid ? rows.filter(r => r.n_entries > 0 || r.n_orders > 0) : rows);
});
app.get('/api/vendors/:id', (req, res) => {
  const v = db.prepare('SELECT * FROM vendors WHERE id=?').get(req.params.id);
  if (!v) return res.status(404).json({ error: 'not found' });
  v.entries = db.prepare(`SELECT e.entry, e.filed, e.county, p.name project, p.file_no,
     json_array_length(e.parcels) n_parcels FROM vendor_entries e JOIN projects p ON p.id=e.project_id WHERE vendor_id=? ORDER BY filed DESC`).all(v.id);
  v.orders = db.prepare(ORDER_SQL + ' WHERE o.vendor_id=? ORDER BY o.request_date DESC').all(v.id).map(decorate);
  v.history = db.prepare("SELECT * FROM activity WHERE vendor_id=? AND action='Email updated' ORDER BY at DESC").all(v.id);
  res.json(v);
});
app.patch('/api/vendors/:id', (req, res) => {
  const v = db.prepare('SELECT * FROM vendors WHERE id=?').get(req.params.id);
  if (!v) return res.status(404).json({ error: 'not found' });
  const email = (req.body.email ?? v.email).trim(), phone = req.body.phone ?? v.phone, contact = req.body.contact ?? v.contact;
  db.prepare('UPDATE vendors SET email=?, phone=?, contact=? WHERE id=?').run(email, phone, contact, v.id);
  if (email !== v.email) {
    log({ vendor_id: v.id, actor: req.body.actor || '', action: 'Email updated', detail: `${v.email || '(none)'} → ${email}` });
    if (req.body.apply_open !== false)
      db.prepare("UPDATE orders SET email=? WHERE vendor_id=? AND status IN ('New','Sent','Follow-up','On Hold')").run(email, v.id);
  }
  res.json(db.prepare('SELECT * FROM vendors WHERE id=?').get(v.id));
});

// ---------------- orders ----------------
app.get('/api/orders', (req, res) => {
  const q = req.query, w = [], a = {};
  if (q.project_id) { w.push('o.project_id=@pid'); a.pid = q.project_id; }
  if (q.status && q.status !== 'All') {
    if (q.status === 'Open') w.push("o.status IN ('New','Sent','Follow-up','On Hold')");
    else { w.push('o.status=@st'); a.st = q.status; }
  }
  if (q.requestor) { w.push('o.requestor=@rq'); a.rq = q.requestor; }
  if (q.type) { w.push('o.waiver_type=@ty'); a.ty = q.type; }
  if (q.q) { w.push('(v.name LIKE @q OR p.file_no LIKE @q OR p.name LIKE @q OR EXISTS (SELECT 1 FROM vendor_entries e WHERE e.vendor_id=o.vendor_id AND e.project_id=o.project_id AND e.entry LIKE @q))'); a.q = '%' + q.q + '%'; }
  let rows = db.prepare(ORDER_SQL + (w.length ? ' WHERE ' + w.join(' AND ') : '') + ' ORDER BY o.due_date ASC, o.id DESC').all(a).map(decorate);
  if (q.due === 'overdue') rows = rows.filter(r => r.overdue);
  if (q.due === 'soon') rows = rows.filter(r => r.due_soon || r.overdue);
  res.json(rows);
});

app.get('/api/orders/:id', (req, res) => {
  const o = db.prepare(ORDER_SQL + ' WHERE o.id=?').get(req.params.id);
  if (!o) return res.status(404).json({ error: 'not found' });
  decorate(o);
  o.entry_detail = db.prepare('SELECT entry, filed, county, json_array_length(parcels) n_parcels FROM vendor_entries WHERE vendor_id=? AND project_id=? ORDER BY filed').all(o.vendor_id, o.project_id);
  o.timeline = db.prepare('SELECT * FROM activity WHERE order_id=? OR (vendor_id=? AND order_id IS NULL AND action=\'Email updated\') ORDER BY at DESC').all(o.id, o.vendor_id);
  o.requestor_email = reqEmail(o.requestor);
  res.json(o);
});

app.post('/api/orders', (req, res) => {
  const b = req.body;
  const ids = Array.isArray(b.vendor_ids) ? b.vendor_ids : [b.vendor_id];
  const sla = Number(getSetting('sla_days', 10));
  const rd = todayISO(), due = b.due_date || addBusinessDays(rd, sla);
  const made = [];
  const tx = db.transaction(() => {
    for (const vid of ids.filter(Boolean)) {
      const v = db.prepare('SELECT * FROM vendors WHERE id=?').get(vid);
      if (!v) continue;
      const send = !!b.send_now;
      const id = db.prepare(`INSERT INTO orders(project_id,vendor_id,waiver_type,payment_stage,amount,through_date,requestor,
        request_date,due_date,status,sent_count,last_sent,email,notes) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(b.project_id, vid, b.waiver_type || 'Conditional', b.payment_stage || 'Progress', b.amount || '', b.through_date || '',
          b.requestor || '', rd, due, send ? 'Sent' : 'New', send ? 1 : 0, send ? rd : null, v.email || '', b.notes || '').lastInsertRowid;
      log({ order_id: id, project_id: b.project_id, vendor_id: vid, actor: b.requestor, action: 'Request created', detail: `${b.waiver_type} · ${b.payment_stage}` });
      if (send) log({ order_id: id, project_id: b.project_id, vendor_id: vid, actor: b.requestor, action: 'Sent', detail: `Packet emailed to ${v.email || '(no email)'}` });
      made.push(id);
    }
  });
  tx();
  res.json({ created: made.length, ids: made });
});

app.patch('/api/orders/:id', (req, res) => {
  const o = db.prepare('SELECT * FROM orders WHERE id=?').get(req.params.id);
  if (!o) return res.status(404).json({ error: 'not found' });
  const f = ['waiver_type', 'payment_stage', 'amount', 'through_date', 'due_date', 'status', 'email', 'notes', 'requestor'];
  const u = {}; f.forEach(k => u[k] = req.body[k] ?? o[k]);
  u.received_date = u.status === 'Received' ? (o.received_date || todayISO()) : (u.status === o.status ? o.received_date : null);
  db.prepare(`UPDATE orders SET waiver_type=@waiver_type,payment_stage=@payment_stage,amount=@amount,through_date=@through_date,
    due_date=@due_date,status=@status,email=@email,notes=@notes,requestor=@requestor,received_date=@received_date,updated_at=datetime('now') WHERE id=@id`)
    .run({ ...u, id: o.id });
  const actor = req.body.actor || o.requestor;
  if (u.status !== o.status) log({ order_id: o.id, project_id: o.project_id, vendor_id: o.vendor_id, actor, action: u.status === 'Received' ? 'Received' : 'Status → ' + u.status, detail: u.status === 'Received' ? 'Signed waiver received' : (req.body.reason || '') });
  if (u.email !== o.email) {
    log({ order_id: o.id, project_id: o.project_id, vendor_id: o.vendor_id, actor, action: 'Email updated', detail: `${o.email || '(none)'} → ${u.email}` });
    if (req.body.update_vendor) db.prepare('UPDATE vendors SET email=? WHERE id=?').run(u.email, o.vendor_id);
  }
  if (u.due_date !== o.due_date) log({ order_id: o.id, project_id: o.project_id, vendor_id: o.vendor_id, actor, action: 'Due date changed', detail: `${fmtDate(o.due_date)} → ${fmtDate(u.due_date)}` });
  res.json({ ok: true });
});

app.post('/api/orders/bulk-status', (req, res) => {
  const { ids = [], status, actor = '' } = req.body;
  if (!STATUSES.includes(status)) return res.status(400).json({ error: 'bad status' });
  const tx = db.transaction(() => {
    for (const id of ids) {
      const o = db.prepare('SELECT * FROM orders WHERE id=?').get(id); if (!o || o.status === status) continue;
      db.prepare("UPDATE orders SET status=?, received_date=?, updated_at=datetime('now') WHERE id=?").run(status, status === 'Received' ? todayISO() : null, id);
      log({ order_id: id, project_id: o.project_id, vendor_id: o.vendor_id, actor: actor || o.requestor, action: status === 'Received' ? 'Received' : 'Status → ' + status, detail: status === 'Received' ? 'Signed waiver received' : '' });
    }
  });
  tx();
  res.json({ ok: true });
});

app.get('/api/orders/:id/email', (req, res) => {
  const o = db.prepare(ORDER_SQL + ' WHERE o.id=?').get(req.params.id);
  if (!o) return res.status(404).json({ error: 'not found' });
  decorate(o);
  const first = o.sent_count === 0;
  res.json({
    to: o.email || o.vendor_email || '',
    cc: reqEmail(o.requestor),
    subject: `${first ? '' : 'REMINDER: '}Lien Waiver Request — ${o.project_name} (${o.file_no}) — ${o.vendor_name}`,
    body: `Hello ${o.vendor_name},

${first ? 'Please find attached' : 'This is a reminder regarding'} a ${o.waiver_type.toLowerCase()} lien waiver (${o.payment_stage.toLowerCase()} payment) for the ${o.project_name} project in ${o.county} County, Utah.

SCR entry number(s): ${o.entries.join(', ')}
${o.amount ? 'Amount: ' + o.amount + '\n' : ''}Please sign and return by ${fmtDate(o.due_date)}.

The attached packet includes a coversheet, the Utah statutory waiver form, and Exhibit A listing your SCR entries and parcels.

Thank you,
${o.requestor}
${getSetting('company', 'Old Republic Title')}
${reqEmail(o.requestor)}`,
  });
});

app.post('/api/orders/send', (req, res) => {
  const { ids = [], actor = '', subject } = req.body;
  const t = todayISO();
  let n = 0;
  const tx = db.transaction(() => {
    for (const id of ids) {
      const o = db.prepare('SELECT o.*, v.email vendor_email FROM orders o JOIN vendors v ON v.id=o.vendor_id WHERE o.id=?').get(id);
      if (!o || ['Received', 'Cancelled'].includes(o.status)) continue;
      const first = o.sent_count === 0;
      const status = first ? 'Sent' : (o.status === 'On Hold' ? 'On Hold' : 'Follow-up');
      db.prepare("UPDATE orders SET sent_count=sent_count+1, last_sent=?, status=?, updated_at=datetime('now') WHERE id=?").run(t, status, id);
      log({ order_id: id, project_id: o.project_id, vendor_id: o.vendor_id, actor: actor || o.requestor,
        action: first ? 'Sent' : 'Follow-up sent', detail: `${first ? 'Packet' : 'Reminder #' + o.sent_count} emailed to ${o.email || o.vendor_email || '(no email)'}` });
      n++;
    }
  });
  tx();
  res.json({ sent: n, subject });
});

// ---------------- document rendering ----------------
function exhibitHTML(vendorId, projectId, vendorName) {
  const ents = db.prepare('SELECT * FROM vendor_entries WHERE vendor_id=? AND project_id=? ORDER BY filed').all(vendorId, projectId);
  let h = `<h2 class="ex-title">EXHIBIT A — SCR ENTRIES AND ASSOCIATED PARCELS</h2><p class="ex-filer">Filer: ${esc(vendorName)}</p>`;
  if (!ents.length) return h + '<p><i>No SCR entries on file for this vendor on this project.</i></p>';
  h += '<table class="ex">';
  for (const e of ents) {
    const ps = JSON.parse(e.parcels || '[]');
    h += `<tr class="ex-h"><td colspan="2"><b>SCR Entry #:</b> ${esc(e.entry)}</td><td colspan="2"><b>Date Filed:</b> ${fmtDate(e.filed)}</td></tr>`;
    for (let i = 0; i < ps.length; i += 4) {
      h += '<tr>' + [0, 1, 2, 3].map(j => `<td>${esc(ps[i + j] || '')}</td>`).join('') + '</tr>';
    }
    if (!ps.length) h += '<tr><td colspan="4"><i>Parcels not listed</i></td></tr>';
  }
  return h + '</table>';
}

function fillTokens(body, ctx) {
  return body.replace(/{{([A-Z_]+)}}/g, (m, k) => (k in ctx ? ctx[k] : m));
}

function packetHTML(o, parts) {
  const p = db.prepare('SELECT * FROM projects WHERE id=?').get(o.project_id) || {};
  const v = db.prepare('SELECT * FROM vendors WHERE id=?').get(o.vendor_id) || {};
  const entries = db.prepare('SELECT entry FROM vendor_entries WHERE vendor_id=? AND project_id=? ORDER BY filed').all(o.vendor_id, o.project_id).map(e => e.entry);
  const blank = '______________________________';
  const ctx = {
    COMPANY: esc(getSetting('company', 'Old Republic Title')),
    PROJECT: esc(p.name), COUNTY: esc((p.county || '').toUpperCase()), OWNER: esc(p.owner), GC: esc(p.gc), FILE_NO: esc(p.file_no),
    VENDOR: esc(v.name), VENDOR_EMAIL: esc(o.email || v.email), VENDOR_PHONE: esc(v.phone),
    ENTRIES: esc(entries.join(', ') || '—'),
    AMOUNT: esc(o.amount) || blank, THROUGH: o.through_date ? fmtDate(o.through_date) : blank,
    WAIVER_TYPE: esc(o.waiver_type), STAGE: esc(o.payment_stage),
    REQUESTOR: esc(o.requestor), REQUESTOR_EMAIL: esc(reqEmail(o.requestor)),
    REQUEST_DATE: fmtDate(o.request_date || todayISO()), DUE_DATE: fmtDate(o.due_date),
    EXHIBIT: exhibitHTML(o.vendor_id, o.project_id, v.name),
  };
  const tpl = (kind, stage) => db.prepare('SELECT body FROM templates WHERE kind=? AND (stage=? OR ?=\'\')').get(kind, stage, stage);
  let out = '';
  if (parts.includes('cover')) out += `<section class="page">${fillTokens(tpl('Coversheet', '').body, ctx)}</section>`;
  if (parts.includes('waiver')) {
    const t = tpl(o.waiver_type, o.payment_stage);
    const filled = fillTokens(t ? t.body : '<p>Template missing</p>', ctx);
    out += filled.split('<div class="pagebreak"></div>').map(part => `<section class="page">${part}</section>`).join('');
  }
  return out;
}

function docShell(title, inner, autoprint, embed = false) {
  const fit = embed ? `<style>.page{margin:14px auto}</style><script>function f(){document.body.style.zoom=Math.min(1,(innerWidth-10)/(8.5*96+30))}f();addEventListener('resize',f)</script>` : '';
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<link rel="stylesheet" href="/doc.css"></head><body>
${embed ? '' : `<div class="toolbar noprint"><span>${esc(title)}</span><button onclick="window.print()">Print / Save as PDF</button></div>`}
${inner}${fit}${autoprint ? '<script>window.onload=()=>setTimeout(()=>window.print(),300)</script>' : ''}</body></html>`;
}

app.get('/print', (req, res) => {
  const ids = String(req.query.ids || '').split(',').map(Number).filter(Boolean);
  const parts = String(req.query.parts || 'cover,waiver').split(',');
  const rows = ids.map(id => db.prepare('SELECT * FROM orders WHERE id=?').get(id)).filter(Boolean);
  if (!rows.length) return res.status(404).send('No orders');
  const inner = rows.map(o => packetHTML(o, parts)).join('');
  const v = rows.length === 1 ? db.prepare('SELECT name FROM vendors WHERE id=?').get(rows[0].vendor_id).name : `${rows.length} packets`;
  res.send(docShell(`Waiver packet — ${v}`, inner, req.query.autoprint === '1'));
});

app.post('/api/preview', (req, res) => {
  const b = req.body;
  const o = {
    project_id: b.project_id, vendor_id: b.vendor_id, waiver_type: b.waiver_type || 'Conditional', payment_stage: b.payment_stage || 'Progress',
    amount: b.amount || '', through_date: b.through_date || '', requestor: b.requestor || '', request_date: todayISO(),
    due_date: b.due_date || addBusinessDays(todayISO(), Number(getSetting('sla_days', 10))), email: '',
  };
  if (b.template_id) {
    const t = db.prepare('SELECT * FROM templates WHERE id=?').get(b.template_id);
    if (t && t.kind !== 'Coversheet') { o.waiver_type = t.kind; o.payment_stage = t.stage; }
    const parts = t && t.kind === 'Coversheet' ? ['cover'] : ['waiver'];
    if (b.body != null) { // unsaved edits preview
      const saved = t.body; db.prepare('UPDATE templates SET body=? WHERE id=?').run(b.body, t.id);
      const html = packetHTML(o, parts); db.prepare('UPDATE templates SET body=? WHERE id=?').run(saved, t.id);
      return res.send(docShell('Preview', html, false, true));
    }
    return res.send(docShell('Preview', packetHTML(o, parts), false, true));
  }
  res.send(docShell('Preview', packetHTML(o, ['cover', 'waiver']), false, true));
});

// ---------------- templates ----------------
app.get('/api/templates', (req, res) => res.json(db.prepare("SELECT * FROM templates ORDER BY CASE kind WHEN 'Conditional' THEN 1 WHEN 'Unconditional' THEN 2 ELSE 3 END, stage DESC").all()));
app.patch('/api/templates/:id', (req, res) => {
  const t = db.prepare('SELECT * FROM templates WHERE id=?').get(req.params.id);
  if (!t) return res.status(404).json({ error: 'not found' });
  db.prepare("UPDATE templates SET title=?, body=?, updated_at=datetime('now') WHERE id=?").run(req.body.title ?? t.title, req.body.body ?? t.body, t.id);
  log({ actor: req.body.actor || '', action: 'Template edited', detail: t.title });
  res.json({ ok: true });
});
app.post('/api/templates/:id/reset', (req, res) => {
  const t = db.prepare('SELECT * FROM templates WHERE id=?').get(req.params.id);
  const def = require('./templates').defaults.find(d => d.kind === t.kind && d.stage === t.stage);
  db.prepare("UPDATE templates SET title=?, body=?, updated_at=datetime('now') WHERE id=?").run(def.title, def.body, t.id);
  res.json({ ok: true });
});

// ---------------- dashboard ----------------
app.get('/api/dashboard', (req, res) => {
  const pid = req.query.project_id;
  const all = db.prepare(ORDER_SQL + (pid ? ' WHERE o.project_id=?' : '')).all(...(pid ? [pid] : [])).map(decorate);
  const t = todayISO();
  const open = all.filter(o => OPEN.includes(o.status));
  const recv = all.filter(o => o.status === 'Received');
  const recv30 = recv.filter(o => o.received_date && daysBetween(o.received_date, t) <= 30);
  const turn = recv.filter(o => o.received_date).map(o => daysBetween(o.request_date, o.received_date));
  const status = STATUSES.map(s => ({ status: s, n: all.filter(o => o.status === s).length }));
  // weekly volume, last 8 weeks
  const weeks = [];
  for (let i = 7; i >= 0; i--) {
    const end = new Date(t + 'T12:00:00Z'); end.setUTCDate(end.getUTCDate() - i * 7);
    const start = new Date(end); start.setUTCDate(start.getUTCDate() - 6);
    const s = start.toISOString().slice(0, 10), e = end.toISOString().slice(0, 10);
    weeks.push({
      label: `${start.getUTCMonth() + 1}/${start.getUTCDate()}`,
      requested: all.filter(o => o.request_date >= s && o.request_date <= e).length,
      received: all.filter(o => o.received_date && o.received_date >= s && o.received_date <= e).length,
    });
  }
  const attention = open.filter(o => o.overdue || o.due_soon).sort((a, b) => (a.due_date || '').localeCompare(b.due_date || '')).slice(0, 8);
  const projects = db.prepare('SELECT * FROM projects ORDER BY is_sample, name').all().filter(p => !pid || p.id == pid).map(p => {
    const os = all.filter(o => o.project_id === p.id);
    const vendorsWithEntries = db.prepare('SELECT COUNT(DISTINCT vendor_id) c FROM vendor_entries WHERE project_id=?').get(p.id).c;
    const requested = new Set(os.filter(o => o.status !== 'Cancelled').map(o => o.vendor_id)).size;
    return { ...p, total: os.length, received: os.filter(o => o.status === 'Received').length,
      open: os.filter(o => OPEN.includes(o.status)).length, overdue: os.filter(o => o.overdue).length,
      vendors: vendorsWithEntries, missing: Math.max(0, vendorsWithEntries - requested) };
  });
  const recent = db.prepare(`SELECT a.*, v.name vendor_name, p.file_no FROM activity a
    LEFT JOIN vendors v ON v.id=a.vendor_id LEFT JOIN projects p ON p.id=a.project_id
    ${pid ? 'WHERE a.project_id=?' : ''} ORDER BY a.at DESC, a.id DESC LIMIT 12`).all(...(pid ? [pid] : []));
  res.json({
    kpi: {
      total: all.length, open: open.length, overdue: open.filter(o => o.overdue).length,
      due_soon: open.filter(o => o.due_soon).length, received30: recv30.length,
      avg_turn: turn.length ? Math.round(turn.reduce((a, b) => a + b, 0) / turn.length * 10) / 10 : 0,
      completion: all.length ? Math.round(recv.length / all.filter(o => o.status !== 'Cancelled').length * 100) : 0,
    },
    status, weeks, attention, projects, recent,
  });
});

// ---------------- reports ----------------
app.get('/api/reports/activity', (req, res) => {
  const q = req.query, w = [], a = {};
  if (q.from) { w.push('a.at >= @from'); a.from = q.from; }
  if (q.to) { w.push('a.at <= @to'); a.to = q.to + ' 23:59:59'; }
  if (q.project_id) { w.push('a.project_id=@pid'); a.pid = q.project_id; }
  if (q.file_no) { w.push('p.file_no LIKE @fn'); a.fn = '%' + q.file_no + '%'; }
  if (q.requestor) { w.push('a.actor=@rq'); a.rq = q.requestor; }
  if (q.action) { w.push('a.action LIKE @ac'); a.ac = q.action + '%'; }
  res.json(db.prepare(`SELECT a.*, v.name vendor_name, p.file_no, p.name project_name FROM activity a
    LEFT JOIN vendors v ON v.id=a.vendor_id LEFT JOIN projects p ON p.id=a.project_id
    ${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY a.at DESC, a.id DESC LIMIT 2000`).all(a));
});

app.get('/api/reports/missing', (req, res) => {
  const pid = req.query.project_id;
  const rows = db.prepare(`SELECT v.*, p.id project_id, p.name project_name, p.file_no,
      COUNT(e.id) n_entries, GROUP_CONCAT(e.entry, ', ') entries, MAX(e.filed) last_filed
    FROM vendor_entries e JOIN vendors v ON v.id=e.vendor_id JOIN projects p ON p.id=e.project_id
    WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.vendor_id=e.vendor_id AND o.project_id=e.project_id AND o.status!='Cancelled')
    ${pid ? 'AND e.project_id=@pid' : ''}
    GROUP BY v.id, p.id ORDER BY p.name, v.name`).all(pid ? { pid } : {});
  res.json(rows);
});

app.get('/api/reports/status', (req, res) => {
  const pid = req.query.project_id;
  const all = db.prepare(ORDER_SQL + (pid ? ' WHERE o.project_id=?' : '')).all(...(pid ? [pid] : [])).map(decorate);
  const open = all.filter(o => OPEN.includes(o.status));
  const bucket = (o) => o.age <= 7 ? '0–7 days' : o.age <= 14 ? '8–14 days' : o.age <= 30 ? '15–30 days' : '30+ days';
  const aging = ['0–7 days', '8–14 days', '15–30 days', '30+ days'].map(b => ({ bucket: b, n: open.filter(o => bucket(o) === b).length }));
  const byReq = [...new Set(all.map(o => o.requestor))].filter(Boolean).map(r => {
    const os = all.filter(o => o.requestor === r);
    return { requestor: r, total: os.length, open: os.filter(o => OPEN.includes(o.status)).length,
      overdue: os.filter(o => o.overdue).length, received: os.filter(o => o.status === 'Received').length };
  }).sort((a, b) => b.total - a.total);
  const byType = ['Conditional|Progress', 'Conditional|Final', 'Unconditional|Progress', 'Unconditional|Final'].map(k => {
    const [t, s] = k.split('|'); const os = all.filter(o => o.waiver_type === t && o.payment_stage === s);
    return { type: `${t} · ${s}`, total: os.length, received: os.filter(o => o.status === 'Received').length };
  });
  res.json({ status: STATUSES.map(s => ({ status: s, n: all.filter(o => o.status === s).length })), aging, byReq, byType, orders: all });
});

// ---------------- batch upload ----------------
app.post('/api/batch', (req, res) => {
  const b = req.body;
  let pid = b.project_id;
  if (!pid && b.new_project) {
    const np = b.new_project;
    pid = db.prepare('INSERT INTO projects(name,file_no,county,owner,gc) VALUES(?,?,?,?,?)').run(np.name, np.file_no, np.county || '', np.owner || '', np.gc || '').lastInsertRowid;
    log({ project_id: pid, actor: b.actor || '', action: 'File opened', detail: `${np.file_no} · ${np.name}` });
  }
  if (!pid) return res.status(400).json({ error: 'project required' });
  const sla = Number(getSetting('sla_days', 10));
  const rd = todayISO();
  let created = 0, newVendors = 0, newEntries = 0;
  const tx = db.transaction(() => {
    for (const r of b.rows || []) {
      if (!r.vendor) continue;
      let v = db.prepare('SELECT * FROM vendors WHERE lower(name)=lower(?)').get(r.vendor.trim());
      if (!v) {
        const id = db.prepare('INSERT INTO vendors(name,trade,phone,email) VALUES(?,?,?,?)').run(r.vendor.trim(), r.trade || '', r.phone || '', r.email || '').lastInsertRowid;
        v = db.prepare('SELECT * FROM vendors WHERE id=?').get(id); newVendors++;
      } else if (r.email && r.email !== v.email) {
        log({ vendor_id: v.id, project_id: pid, actor: b.actor || '', action: 'Email updated', detail: `${v.email || '(none)'} → ${r.email} (batch)` });
        db.prepare('UPDATE vendors SET email=? WHERE id=?').run(r.email, v.id); v.email = r.email;
      }
      for (const en of String(r.scr_entries || '').split(/[;,\s]+/).filter(Boolean)) {
        if (!db.prepare('SELECT 1 FROM vendor_entries WHERE vendor_id=? AND project_id=? AND entry=?').get(v.id, pid, en)) {
          db.prepare('INSERT INTO vendor_entries(vendor_id,project_id,entry,filed,county,parcels) VALUES(?,?,?,?,?,?)')
            .run(v.id, pid, en, r.filed || '', r.county || '', JSON.stringify(String(r.parcels || '').split(/[;\s]+/).filter(Boolean)));
          newEntries++;
        }
      }
      const due = r.due_date || addBusinessDays(rd, sla);
      const id = db.prepare(`INSERT INTO orders(project_id,vendor_id,waiver_type,payment_stage,amount,through_date,requestor,request_date,due_date,status,email,notes)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).run(pid, v.id, r.waiver_type || b.waiver_type || 'Conditional', r.payment_stage || b.payment_stage || 'Progress',
        r.amount || '', r.through_date || '', r.requestor || b.actor || '', rd, due, 'New', v.email || '', r.notes || '').lastInsertRowid;
      log({ order_id: id, project_id: pid, vendor_id: v.id, actor: r.requestor || b.actor || '', action: 'Request created', detail: 'Batch upload' });
      created++;
    }
    log({ project_id: pid, actor: b.actor || '', action: 'Batch upload', detail: `${created} requests · ${newVendors} new vendors · ${newEntries} new SCR entries` });
  });
  tx();
  res.json({ created, newVendors, newEntries, project_id: pid });
});

app.get('/api/sample-csv', (req, res) => {
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="waiver_batch_template.csv"');
  res.send('vendor,email,scr_entries,waiver_type,payment_stage,amount,through_date,requestor,notes\n' +
    '"Geneva Rock Products, Inc.",grplienwaivers@genevarock.com,12828641,Conditional,Progress,"$48,250.00",2026-10-15,Jennifer Tilton,October draw\n');
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`SCR Waiver System on http://localhost:${PORT}`));
