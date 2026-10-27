/* SCR Waiver Desk — single-page app (no build step) */
'use strict';

// ======================= core helpers =======================
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const view = $('#view');
const S = {
  meta: null, project: '', me: '', vendorsAll: [],
  of: { status: 'Open', requestor: '', type: '', due: '', q: '' },
  sort: { k: 'due_date', d: 1 }, orders: [], sel: new Set(),
};

async function api(url, opts = {}) {
  const o = { headers: { 'Content-Type': 'application/json' }, ...opts };
  if (o.body && typeof o.body !== 'string') o.body = JSON.stringify(o.body);
  const r = await fetch(url, o);
  if (!r.ok) throw new Error(await r.text());
  const ct = r.headers.get('content-type') || '';
  return ct.includes('json') ? r.json() : r.text();
}
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };

const ICONS = {
  dash: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  list: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4M12 16h4M8 11h.01M8 16h.01"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>',
  bar: '<path d="M3 3v18h18"/><path d="M18 17V9M13 17V5M8 17v-3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5M12 3v12"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  printer: '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 5L2 7"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4M12 17h.01"/>',
  check: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  chev: '<path d="m9 18 6-6-6-6"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  trend: '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  building: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  pause: '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
  ext: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  sparkle: '<path d="M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2z"/>',
};
const I = (n, style = '') => `<svg class="i" viewBox="0 0 24 24" ${style ? `style="${style}"` : ''}>${ICONS[n] || ''}</svg>`;

// dates
const today = () => S.meta?.today || new Date().toISOString().slice(0, 10);
const D = (iso) => new Date(iso + 'T12:00:00Z');
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtD = (iso, year = false) => { if (!iso) return '—'; const d = D(iso.slice(0, 10)); return `${MON[d.getUTCMonth()]} ${d.getUTCDate()}${year || d.getUTCFullYear() !== D(today()).getUTCFullYear() ? ', ' + d.getUTCFullYear() : ''}`; };
const days = (a, b) => Math.round((D(b) - D(a)) / 864e5);
const bizAdd = (iso, n) => { const d = D(iso); let left = n; while (left > 0) { d.setUTCDate(d.getUTCDate() + 1); const w = d.getUTCDay(); if (w && w !== 6) left--; } return d.toISOString().slice(0, 10); };
const atDate = (at) => new Date(at.replace(' ', 'T') + 'Z');
function ago(at) {
  const s = (Date.now() - atDate(at)) / 1000;
  if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s / 60) + 'm ago'; if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  const d = Math.floor(s / 86400); return d === 1 ? 'yesterday' : d < 30 ? d + 'd ago' : fmtD(at.slice(0, 10));
}
const fmtTime = (at) => atDate(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const OPEN = ['New', 'Sent', 'Follow-up', 'On Hold'];
function dueChip(o) {
  if (!o.due_date) return '';
  if (o.status === 'Received') return `<span class="chip green">${I('check', 'width:12px;height:12px')}Received ${fmtD(o.received_date)}</span>`;
  if (o.status === 'Cancelled') return '';
  if (o.status === 'On Hold') return `<span class="chip">On hold</span>`;
  const n = days(today(), o.due_date);
  if (n < 0) return `<span class="chip red">${-n}d overdue</span>`;
  if (n === 0) return `<span class="chip amber">Due today</span>`;
  if (n <= 3) return `<span class="chip amber">Due in ${n}d</span>`;
  return `<span class="chip">in ${n}d</span>`;
}
const pill = (s) => `<span class="pill st-${String(s).replace(/\s/g, '')}">${esc(s)}</span>`;
const typeTag = (t) => `<span class="tag ${t === 'Unconditional' ? 'unc' : 'cond'}">${esc(t)}</span>`;
const PAL = ['#2f63c9', '#12805c', '#b45309', '#6d3fc9', '#c2362f', '#0e7490', '#9d174d'];
const avColor = (n) => PAL[[...String(n)].reduce((a, c) => a + c.charCodeAt(0), 0) % PAL.length];
const initials = (n) => String(n || '?').split(/\s+/).map(x => x[0]).slice(0, 2).join('').toUpperCase();
const av = (n, sz = 24) => `<span class="av" style="background:${avColor(n)};width:${sz}px;height:${sz}px">${initials(n)}</span>`;
const who = (n) => n ? `<span class="who">${av(n)}${esc(n)}</span>` : '<span class="muted">—</span>';
const first = (n) => String(n || '').split(' ')[0];
const whoShort = (n) => { if (!n) return '<span class="muted">—</span>'; const p = String(n).split(' '); return `<span class="who" title="${esc(n)}">${av(n)}${esc(p[0])}${p[1] ? ' ' + esc(p[1][0]) + '.' : ''}</span>`; };
const STCOL = { New: '#6366f1', Sent: '#2f6fed', 'Follow-up': '#f59e0b', Received: '#12805c', 'On Hold': '#8b5cf6', Cancelled: '#a8b3c4' };
const proj = (id) => S.meta.projects.find(p => p.id == id);
const pq = (extra = {}) => { const p = new URLSearchParams(); if (S.project) p.set('project_id', S.project); for (const [k, v] of Object.entries(extra)) if (v) p.set(k, v); const s = p.toString(); return s ? '?' + s : ''; };

function toast(msg, icon = 'check') {
  const t = document.createElement('div'); t.className = 'toast'; t.innerHTML = I(icon) + esc(msg);
  $('#toasts').appendChild(t); setTimeout(() => { t.style.opacity = 0; t.style.transition = '.3s'; }, 2600); setTimeout(() => t.remove(), 3000);
}
function setTitle(t, crumb = '') { $('#ptitle').textContent = t; $('#pcrumb').textContent = crumb; document.title = t + ' · SCR Waiver Desk'; }
function csvDownload(name, rows) {
  const out = rows.map(r => r.map(x => `"${String(x ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([out], { type: 'text/csv' })); a.download = name; a.click();
}

// ======================= overlay: panel & modal =======================
function closeAll() { $('#panel').classList.remove('on'); $('#modal').classList.remove('on'); $('#overlay').classList.remove('on'); }
$('#overlay').onclick = closeAll;
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeAll();
  if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); $('#gsearch').focus(); }
});
function openPanel(html) { const p = $('#panel'); p.innerHTML = html; p.classList.add('on'); $('#overlay').classList.add('on'); $$('[data-close]', p).forEach(b => b.onclick = closeAll); return p; }
function openModal(html) { $('#panel').classList.remove('on'); const m = $('#modal'); m.innerHTML = html; m.classList.add('on'); $('#overlay').classList.add('on'); $$('[data-close]', m).forEach(b => b.onclick = closeAll); return m; }
function confirmBox(title, msg, okLabel = 'Confirm', danger = false) {
  return new Promise(res => {
    const m = openModal(`<div class="mh"><h3>${esc(title)}</h3></div><div class="mb"><p style="margin:0;line-height:1.55">${msg}</p></div>
      <div class="mf"><div style="flex:1"></div><button class="btn" data-close>Cancel</button><button class="btn ${danger ? 'danger' : 'primary'}" id="cOk">${esc(okLabel)}</button></div>`);
    $$('[data-close]', m).forEach(b => b.onclick = () => { closeAll(); res(false); });
    $('#cOk', m).onclick = () => { closeAll(); res(true); };
  });
}

// ======================= shell: nav, project, user =======================
const NAV = [
  ['dashboard', 'dash', 'Dashboard'], ['orders', 'list', 'Orders'], ['new', 'plus', 'New Request'],
  ['templates', 'file', 'Templates'], ['reports', 'bar', 'Reports'], ['batch', 'upload', 'Batch Upload'],
  ['vendors', 'users', 'Vendors & Emails'], ['settings', 'sliders', 'Settings'],
];
async function renderNav() {
  const route = (location.hash.slice(2).split('?')[0]) || 'dashboard';
  let k = { open: '', overdue: 0, missing: '' };
  try {
    const d = await api('/api/dashboard' + pq()); k.open = d.kpi.open; k.overdue = d.kpi.overdue;
    k.missing = d.projects.reduce((a, p) => a + p.missing, 0);
  } catch {}
  $('#nav').innerHTML = `<div class="navlabel">Workspace</div>` + NAV.map(([r, ic, label], i) => {
    let cnt = '';
    if (r === 'orders' && k.open !== '') cnt = k.overdue ? `<span class="cnt red" title="overdue">${k.overdue}</span>` : `<span class="cnt">${k.open}</span>`;
    if (r === 'reports' && k.missing) cnt = `<span class="cnt" title="vendors with no request">${k.missing}</span>`;
    return (i === 3 ? '<div class="navlabel">Manage</div>' : '') + `<a href="#/${r}" class="${route === r ? 'active' : ''}">${I(ic)}${label}${cnt}</a>`;
  }).join('');
  $('#sidefoot').innerHTML = `${S.meta.settings.demo ? '<span class="demo-pill">● Demo data loaded</span><br><br>' : ''}Utah State Construction Registry<br>Lien waiver tracking`;
}
function renderTop() {
  const ps = S.meta.projects;
  $('#gproject').innerHTML = `<option value="">All title files (${ps.length})</option>` + ps.map(p => `<option value="${p.id}" ${S.project == p.id ? 'selected' : ''}>${esc(p.name)} · ${esc(p.file_no)}${p.is_sample ? ' (sample)' : ''}</option>`).join('');
  $('#me').innerHTML = S.meta.requestors.map(r => `<option ${r.name === S.me ? 'selected' : ''}>${esc(r.name)}</option>`).join('');
  $('#meav').innerHTML = av(S.me, 26);
}
$('#gproject').onchange = (e) => { S.project = e.target.value; store.set('project', S.project); route(); };
$('#me').onchange = (e) => { S.me = e.target.value; store.set('me', S.me); renderTop(); toast(`Working as ${S.me}`); };
$('#gsearch').addEventListener('keydown', e => { if (e.key === 'Enter') { location.hash = '#/orders?status=All&q=' + encodeURIComponent(e.target.value); } });

async function loadMeta() { S.meta = await api('/api/meta'); if (!S.meta.requestors.find(r => r.name === S.me)) S.me = S.meta.requestors[0].name; if (S.project && !proj(S.project)) S.project = ''; }

// ======================= router =======================
const ROUTES = {};
async function route() {
  const [path, qs] = location.hash.slice(2).split('?');
  const r = path || 'dashboard';
  const params = Object.fromEntries(new URLSearchParams(qs || ''));
  closeAll(); S.sel.clear(); renderBulk();
  renderNav();
  view.innerHTML = '<div class="empty">Loading…</div>';
  try { await (ROUTES[r] || ROUTES.dashboard)(params); }
  catch (e) { console.error(e); view.innerHTML = `<div class="card"><div class="empty">${I('alert')}<br>Something went wrong.<br><span class="small">${esc(e.message).slice(0, 300)}</span></div></div>`; }
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);
async function refresh() { const r = location.hash; await renderNav(); if (r === location.hash) route(); }

// ======================= charts =======================
function donut(status) {
  const total = status.reduce((a, s) => a + s.n, 0) || 1; const R = 52, C = 2 * Math.PI * R; let off = 0;
  const segs = status.filter(s => s.n).map(s => { const len = s.n / total * C; const el = `<circle r="${R}" cx="70" cy="70" fill="none" stroke="${STCOL[s.status]}" stroke-width="18" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-off}"/>`; off += len; return el; }).join('');
  return `<div class="donutwrap"><svg width="140" height="140" viewBox="0 0 140 140"><g transform="rotate(-90 70 70)"><circle r="${R}" cx="70" cy="70" fill="none" stroke="#eef1f6" stroke-width="18"/>${segs}</g>
    <text x="70" y="66" text-anchor="middle" font-size="24" font-weight="750" fill="#0f172a">${status.reduce((a, s) => a + s.n, 0)}</text><text x="70" y="86" text-anchor="middle" font-size="11" fill="#64748b">requests</text></svg>
    <div class="legend">${status.map(s => `<div style="cursor:pointer" onclick="location.hash='#/orders?status=${encodeURIComponent(s.status)}'"><i style="background:${STCOL[s.status]}"></i>${esc(s.status)}<span>${s.n}</span></div>`).join('')}</div></div>`;
}
function bars(weeks) {
  const W = 620, H = 200, pad = 28, max = Math.max(4, ...weeks.flatMap(w => [w.requested, w.received]));
  const gw = (W - pad) / weeks.length, bw = Math.min(16, gw / 3.2), sc = (H - 40) / max;
  let g = '';
  for (let i = 0; i <= 4; i++) { const y = H - 22 - (H - 40) * i / 4; g += `<line x1="${pad}" x2="${W}" y1="${y}" y2="${y}" stroke="#eef1f6"/><text x="${pad - 8}" y="${y + 3}" text-anchor="end">${Math.round(max * i / 4)}</text>`; }
  weeks.forEach((w, i) => {
    const x = pad + i * gw + gw / 2; const h1 = w.requested * sc, h2 = w.received * sc;
    g += `<rect x="${x - bw - 2}" y="${H - 22 - h1}" width="${bw}" height="${h1}" rx="4" fill="#2f63c9"><title>${w.requested} requested</title></rect>`;
    g += `<rect x="${x + 2}" y="${H - 22 - h2}" width="${bw}" height="${h2}" rx="4" fill="#2fa77d"><title>${w.received} received</title></rect>`;
    g += `<text x="${x}" y="${H - 6}" text-anchor="middle">${w.label}</text>`;
  });
  return `<div class="barchart"><svg viewBox="0 0 ${W} ${H}" width="100%">${g}</svg></div>`;
}
function actIcon(a) {
  const x = a.action || '';
  if (x.startsWith('Received')) return ['check', 'var(--greenSoft)', 'var(--green)'];
  if (x.startsWith('Follow')) return ['send', 'var(--amberSoft)', 'var(--amber)'];
  if (x.startsWith('Sent')) return ['send', 'var(--brandSoft)', 'var(--brand2)'];
  if (x.startsWith('Email')) return ['mail', 'var(--violetSoft)', 'var(--violet)'];
  if (x.startsWith('Status')) return [x.includes('Hold') ? 'pause' : 'x', 'var(--slateSoft)', 'var(--ink2)'];
  if (x.startsWith('Batch') || x.startsWith('Registry')) return ['upload', 'var(--brandSoft)', 'var(--brand2)'];
  if (x.startsWith('Template')) return ['file', 'var(--slateSoft)', 'var(--ink2)'];
  if (x.startsWith('Due')) return ['clock', 'var(--amberSoft)', 'var(--amber)'];
  return ['plus', 'var(--slateSoft)', 'var(--ink2)'];
}
function feedItem(a) {
  const [ic, bg, fg] = actIcon(a);
  return `<div class="fi"><div class="fic" style="background:${bg};color:${fg}">${I(ic)}</div><div class="ft"><b>${esc(a.action)}</b>${a.vendor_name ? ` · ${esc(a.vendor_name)}` : ''}
    <div class="t">${a.actor ? esc(a.actor) + ' · ' : ''}${a.file_no ? esc(a.file_no) + ' · ' : ''}${ago(a.at)}</div></div></div>`;
}

// ======================= DASHBOARD =======================
ROUTES.dashboard = async () => {
  const p = proj(S.project);
  setTitle('Dashboard', p ? `${p.name} · ${p.file_no}` : 'All title files');
  const d = await api('/api/dashboard' + pq());
  const sN = (s) => (d.status.find(x => x.status === s) || {}).n || 0;
  const h = new Date().getHours(); const greet = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const kpi = (cls, ic, v, l, s, href) => `<div class="kpi ${cls}" onclick="location.hash='${href}'"><div class="ic">${I(ic)}</div><div class="v">${v}</div><div class="l">${l}</div><div class="s">${s}</div></div>`;
  view.innerHTML = `
  <div class="hello"><div><h2>${greet}, ${esc(first(S.me))}</h2>
    <p>${d.kpi.open} open waiver requests across ${d.projects.length} title file${d.projects.length === 1 ? '' : 's'} · ${new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</p></div>
    <div style="display:flex;gap:8px"><a class="btn" href="#/reports?tab=status">${I('bar')}Status report</a><a class="btn" href="#/batch">${I('upload')}Batch upload</a></div></div>
  <div class="kpis">
    ${kpi('blue', 'inbox', d.kpi.open, 'Open requests', `${sN('New')} not sent · ${sN('Sent') + sN('Follow-up')} with vendors`, '#/orders?status=Open')}
    ${kpi('red', 'alert', d.kpi.overdue, 'Overdue', 'Past the return-by date', '#/orders?status=Open&due=overdue')}
    ${kpi('amber', 'clock', d.kpi.due_soon, 'Due in 3 days', 'Follow up before they slip', '#/orders?status=Open&due=soon')}
    ${kpi('green', 'check', d.kpi.received30, 'Received · 30 days', `${d.kpi.completion}% of all requests complete`, '#/orders?status=Received')}
    ${kpi('violet', 'trend', d.kpi.avg_turn + '<small style="font-size:13px;color:var(--mut);font-weight:600"> days</small>', 'Avg. turnaround', 'Request → signed waiver', '#/reports?tab=status')}
  </div>
  <div class="grid g2">
    <div class="card"><div class="hd"><h3>Needs attention</h3><span class="sub">Overdue or due within 3 days</span><div class="r"><a class="btn sm" href="#/orders?status=Open&due=soon">View all</a></div></div>
      <div id="att">${d.attention.length ? d.attention.map(o => `
        <div class="att" data-id="${o.id}"><span class="dot" style="background:${o.overdue ? 'var(--red)' : 'var(--amber)'}"></span>
          <div class="m"><b>${esc(o.vendor_name)}</b><span class="muted small">${esc(o.file_no)} · ${esc(o.waiver_type)} ${esc(o.payment_stage)} · ${esc(o.requestor)} · sent ${o.sent_count}×</span></div>
          ${dueChip(o)}<button class="iconbtn" data-send="${o.id}" title="Resend">${I('send')}</button></div>`).join('')
        : `<div class="empty">${I('check')}<br>All caught up — nothing overdue or due soon.</div>`}</div></div>
    <div class="card"><div class="hd"><h3>Status mix</h3><span class="sub">All requests</span></div>${donut(d.status)}</div>
  </div>
  <div class="grid g2 mt">
    <div class="card"><div class="hd"><h3>Weekly volume</h3><span class="sub">Last 8 weeks</span><div class="r keys"><span><i style="background:#2f63c9"></i>Requested</span><span><i style="background:#2fa77d"></i>Received</span></div></div>${bars(d.weeks)}</div>
    <div class="card"><div class="hd"><h3>Recent activity</h3><div class="r"><a class="btn sm" href="#/reports?tab=activity">All activity</a></div></div><div class="feed">${d.recent.slice(0, 7).map(feedItem).join('')}</div></div>
  </div>
  <div class="card mt"><div class="hd"><h3>Title files</h3><span class="sub">Waiver progress by file</span></div>
    <table class="tbl"><thead><tr><th>File</th><th>Project</th><th>County</th><th style="width:28%">Waivers received</th><th>Open</th><th>Overdue</th><th>Missing requests</th><th></th></tr></thead><tbody>
    ${d.projects.map(p => { const pct = p.total ? Math.round(p.received / p.total * 100) : 0; return `<tr data-p="${p.id}">
      <td class="mono v1">${esc(p.file_no)}</td><td class="w"><div class="v1">${esc(p.name)} ${p.is_sample ? '<span class="tag sample">sample</span>' : ''}</div><div class="v2">${esc(p.gc || '')}</div></td>
      <td>${esc(p.county)}</td><td><div style="display:flex;align-items:center;gap:10px"><div class="prog" style="flex:1"><i style="width:${pct}%"></i></div><b>${p.received}/${p.total}</b></div></td>
      <td>${p.open}</td><td>${p.overdue ? `<span class="chip red">${p.overdue}</span>` : '0'}</td>
      <td>${p.missing ? `<span class="chip blue">${p.missing} vendor${p.missing > 1 ? 's' : ''}</span>` : '<span class="chip green">None</span>'}</td><td>${I('chev')}</td></tr>`; }).join('')}
    </tbody></table></div>`;
  $$('.att', view).forEach(el => el.onclick = (e) => { if (e.target.closest('[data-send]')) return; openOrder(el.dataset.id); });
  $$('[data-send]', view).forEach(b => b.onclick = () => sendFlow([+b.dataset.send]));
  $$('tr[data-p]', view).forEach(tr => tr.onclick = () => { S.project = tr.dataset.p; store.set('project', S.project); renderTop(); location.hash = '#/orders?status=Open'; });
};

// ======================= ORDERS =======================
ROUTES.orders = async (params) => {
  if (Object.keys(params).length) S.of = { status: params.status || 'Open', requestor: params.requestor || '', type: params.type || '', due: params.due || '', q: params.q || '' };
  const p = proj(S.project);
  setTitle('Orders', p ? `${p.name} · ${p.file_no}` : 'All title files');
  S.orders = await api('/api/orders' + pq());
  view.innerHTML = `<div class="card" id="ocard"></div>`;
  drawOrders();
};
function filteredOrders() {
  const f = S.of, q = f.q.toLowerCase();
  let rows = S.orders.filter(o =>
    (f.status === 'All' || (f.status === 'Open' ? OPEN.includes(o.status) : o.status === f.status)) &&
    (!f.requestor || o.requestor === f.requestor) && (!f.type || o.waiver_type === f.type) &&
    (!f.due || (f.due === 'overdue' ? o.overdue : (o.overdue || o.due_soon))) &&
    (!q || [o.vendor_name, o.file_no, o.project_name, o.trade, (o.entries || []).join(' ')].join(' ').toLowerCase().includes(q)));
  const { k, d } = S.sort;
  rows.sort((a, b) => { const x = a[k] ?? '', y = b[k] ?? ''; return (typeof x === 'number' ? x - y : String(x).localeCompare(String(y))) * d; });
  return rows;
}
function drawOrders() {
  const card = $('#ocard'); if (!card) return;
  const f = S.of, rows = filteredOrders();
  const cnt = (s) => s === 'All' ? S.orders.length : s === 'Open' ? S.orders.filter(o => OPEN.includes(o.status)).length : S.orders.filter(o => o.status === s).length;
  const tabs = ['Open', 'New', 'Sent', 'Follow-up', 'Received', 'On Hold', 'Cancelled', 'All'];
  const th = (k, l) => `<th class="sort" data-k="${k}">${l}${S.sort.k === k ? (S.sort.d > 0 ? ' ↑' : ' ↓') : ''}</th>`;
  card.innerHTML = `
   <div class="tabs">${tabs.map(t => `<button class="${f.status === t ? 'on' : ''}" data-t="${t}">${t}<span class="n">${cnt(t)}</span></button>`).join('')}</div>
   <div class="filters">
     <label class="searchbox" style="width:260px">${I('search')}<input id="oq" placeholder="Filter vendor, file, SCR entry" value="${esc(f.q)}"></label>
     <select class="select" id="oreq"><option value="">All requestors</option>${S.meta.requestors.map(r => `<option ${f.requestor === r.name ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select>
     <select class="select" id="otype"><option value="">All waiver types</option><option ${f.type === 'Conditional' ? 'selected' : ''}>Conditional</option><option ${f.type === 'Unconditional' ? 'selected' : ''}>Unconditional</option></select>
     <div class="seg" id="odue"><button data-v="" class="${!f.due ? 'on' : ''}">Any due date</button><button data-v="soon" class="${f.due === 'soon' ? 'on' : ''}">Due ≤ 3 days</button><button data-v="overdue" class="${f.due === 'overdue' ? 'on' : ''}">Overdue</button></div>
     <div style="flex:1"></div><span class="muted small">${rows.length} shown</span>
     <button class="btn sm" id="oexp">${I('download')}Export</button>
   </div>
   <div class="scrollx"><table class="tbl"><thead><tr><th style="width:34px"><input type="checkbox" id="ckall"></th>
     ${th('vendor_name', 'Vendor')}${th('file_no', 'File')}<th>SCR entries</th>${th('waiver_type', 'Waiver')}${th('requestor', 'Requested by')}${th('request_date', 'Requested')}${th('due_date', 'Return by')}${th('status', 'Status')}<th></th></tr></thead>
   <tbody>${rows.map(o => `<tr data-id="${o.id}" class="${S.sel.has(o.id) ? 'sel' : ''}">
     <td><input type="checkbox" data-ck="${o.id}" ${S.sel.has(o.id) ? 'checked' : ''}></td>
     <td class="w"><div class="v1">${esc(o.vendor_name)}</div><div class="v2">${esc(o.trade || '')}</div></td>
     <td class="w" style="min-width:150px;max-width:190px"><div class="v1 mono">${esc(o.file_no)}</div><div class="v2">${esc(o.project_name)}${o.is_sample ? ' <span class="tag sample">sample</span>' : ''}</div></td>
     <td>${(o.entries || []).slice(0, 1).map(e => `<span class="chip mono">${esc(e)}</span>`).join(' ')}${o.entries.length > 1 ? ` <span class="chip" title="${esc(o.entries.join(', '))}">+${o.entries.length - 1}</span>` : ''}</td>
     <td>${typeTag(o.waiver_type)}<div class="v2">${esc(o.payment_stage)}${o.amount ? ' · ' + esc(o.amount) : ''}</div></td>
     <td>${whoShort(o.requestor)}</td>
     <td>${fmtD(o.request_date)}<div class="v2">${o.status === 'Received' ? 'took ' + o.age + 'd' : o.age + 'd open'}</div></td>
     <td>${fmtD(o.due_date)}<div style="margin-top:3px">${dueChip(o)}</div></td>
     <td>${pill(o.status)}<div class="v2">${o.sent_count ? `sent ${o.sent_count}× · ${fmtD(o.last_sent)}` : 'not sent yet'}</div></td>
     <td><div class="acts">${['Received', 'Cancelled'].includes(o.status) ? '' : `<button class="iconbtn" data-a="send" title="${o.sent_count ? 'Resend' : 'Send'}">${I('send')}</button>`}
       <a class="iconbtn" href="/print?ids=${o.id}" target="_blank" title="Print packet">${I('printer')}</a></div></td>
   </tr>`).join('')}</tbody></table></div>
   ${rows.length ? '' : `<div class="empty">${I('inbox')}<br>No requests match these filters.</div>`}`;
  $$('.tabs button', card).forEach(b => b.onclick = () => { S.of.status = b.dataset.t; drawOrders(); });
  $('#oq', card).oninput = debounce((e) => { S.of.q = e.target.value; drawOrders(); $('#oq').focus(); const v = $('#oq'); v.setSelectionRange(v.value.length, v.value.length); }, 200);
  $('#oreq', card).onchange = (e) => { S.of.requestor = e.target.value; drawOrders(); };
  $('#otype', card).onchange = (e) => { S.of.type = e.target.value; drawOrders(); };
  $$('#odue button', card).forEach(b => b.onclick = () => { S.of.due = b.dataset.v; drawOrders(); });
  $$('th.sort', card).forEach(t => t.onclick = () => { S.sort = { k: t.dataset.k, d: S.sort.k === t.dataset.k ? -S.sort.d : 1 }; drawOrders(); });
  $('#oexp', card).onclick = () => csvDownload('waiver_orders.csv', [['Vendor', 'Trade', 'File #', 'Project', 'SCR Entries', 'Waiver Type', 'Stage', 'Amount', 'Requested By', 'Requested', 'Return By', 'Status', 'Times Sent', 'Last Sent', 'Received', 'Vendor Email'],
    ...rows.map(o => [o.vendor_name, o.trade, o.file_no, o.project_name, o.entries.join(' '), o.waiver_type, o.payment_stage, o.amount, o.requestor, o.request_date, o.due_date, o.status, o.sent_count, o.last_sent, o.received_date, o.email])]);
  $('#ckall', card).onchange = (e) => { rows.forEach(o => e.target.checked ? S.sel.add(o.id) : S.sel.delete(o.id)); drawOrders(); renderBulk(); };
  $$('tbody tr', card).forEach(tr => {
    const id = +tr.dataset.id;
    tr.onclick = (e) => {
      if (e.target.closest('[data-ck]')) { S.sel.has(id) ? S.sel.delete(id) : S.sel.add(id); tr.classList.toggle('sel'); renderBulk(); return; }
      if (e.target.closest('a')) return;
      const a = e.target.closest('[data-a]');
      if (a && a.dataset.a === 'send') return sendFlow([id]);
      openOrder(id);
    };
  });
}
function renderBulk() {
  const b = $('#bulk'); const n = S.sel.size;
  b.classList.toggle('on', n > 0); if (!n) return;
  b.innerHTML = `<b>${n} selected</b>
    <button class="btn sm" id="bSend">${I('send')}Send / resend</button>
    <button class="btn sm" id="bPrint">${I('printer')}Print packets</button>
    <button class="btn sm" id="bRecv">${I('check')}Mark received</button>
    <select class="select" id="bSt" style="height:30px;background:rgba(255,255,255,.08);color:#fff;border-color:rgba(255,255,255,.15)"><option value="">Set status…</option>${S.meta.statuses.map(s => `<option style="color:#000">${s}</option>`).join('')}</select>
    <button class="iconbtn" id="bClr" style="color:#cbd5e1">${I('x')}</button>`;
  $('#bSend').onclick = () => sendFlow([...S.sel]);
  $('#bPrint').onclick = () => window.open('/print?ids=' + [...S.sel].join(','), '_blank');
  $('#bRecv').onclick = () => bulkStatus('Received');
  $('#bSt').onchange = (e) => e.target.value && bulkStatus(e.target.value);
  $('#bClr').onclick = () => { S.sel.clear(); renderBulk(); drawOrders(); };
}
async function bulkStatus(status) {
  const ids = [...S.sel];
  await api('/api/orders/bulk-status', { method: 'POST', body: { ids, status, actor: S.me } });
  toast(`${ids.length} request${ids.length > 1 ? 's' : ''} → ${status}`);
  S.sel.clear(); refresh();
}

// ======================= ORDER PANEL =======================
async function openOrder(id) {
  const o = await api('/api/orders/' + id);
  const closed = ['Received', 'Cancelled'].includes(o.status);
  const banner = o.overdue ? `<div class="alert red">${I('alert')}${-days(today(), o.due_date)} days past the return-by date — consider a follow-up.</div>`
    : o.due_soon ? `<div class="alert amber">${I('clock')}Due ${days(today(), o.due_date) === 0 ? 'today' : 'in ' + days(today(), o.due_date) + ' days'}.</div>`
    : o.status === 'Received' ? `<div class="alert green">${I('check')}Signed waiver received ${fmtD(o.received_date, true)} — ${o.age} days after request.</div>`
    : o.status === 'On Hold' ? `<div class="alert blue">${I('pause')}On hold${o.notes ? ': ' + esc(o.notes) : ''}</div>` : '';
  const p = openPanel(`
    <div class="ph"><div class="ptitle"><div style="flex:1;min-width:0"><div class="muted small mono">${esc(o.file_no)} · ${esc(o.project_name)}</div>
      <h2>${esc(o.vendor_name)}</h2><div class="muted small">${esc(o.trade || '')}${o.vendor_phone ? ' · ' + esc(o.vendor_phone) : ''}</div></div>${pill(o.status)}<button class="iconbtn" data-close>${I('x')}</button></div>
      <div class="actionsrow">
        ${closed ? '' : `<button class="btn primary sm" id="pSend">${I('send')}${o.sent_count ? 'Resend' : 'Send'} request</button>`}
        <a class="btn sm" href="/print?ids=${o.id}" target="_blank">${I('printer')}Print packet</a>
        <a class="btn sm" href="/print?ids=${o.id}&parts=cover" target="_blank">${I('file')}Coversheet</a>
        ${o.status !== 'Received' ? `<button class="btn sm" id="pRecv" style="color:var(--green)">${I('check')}Mark received</button>` : ''}
        <select class="select" id="pStatus" style="height:30px">${S.meta.statuses.map(s => `<option ${s === o.status ? 'selected' : ''}>${s}</option>`).join('')}</select>
      </div></div>
    <div class="pb">${banner}
      <div class="kv">
        <div><label>Waiver</label>${typeTag(o.waiver_type)} ${esc(o.payment_stage)} payment</div>
        <div><label>Amount</label>${esc(o.amount || '—')}</div>
        <div><label>Requested by</label>${who(o.requestor)}</div>
        <div><label>${o.payment_stage === 'Final' ? 'Good-thru date' : 'Payment period through'}</label>${fmtD(o.through_date, true)}</div>
        <div><label>Requested on</label>${fmtD(o.request_date, true)}</div>
        <div><label>Return by</label><input type="date" class="input" id="pDue" value="${o.due_date || ''}" style="height:32px"></div>
        <div><label>Times sent</label>${o.sent_count}× ${o.last_sent ? '<span class="muted">· last ' + fmtD(o.last_sent) + '</span>' : ''}</div>
        <div><label>County</label>${esc(o.county)}</div>
      </div>
      <div class="sec">Vendor email</div>
      <div style="display:flex;gap:8px"><input class="input" id="pEmail" value="${esc(o.email || '')}" style="flex:1" placeholder="vendor@company.com"><button class="btn" id="pEmailSave">${I('mail')}Update email</button></div>
      <label class="hint" style="display:flex;gap:6px;align-items:center;margin-top:6px"><input type="checkbox" id="pEmailV" checked>Also update the vendor directory and their other open requests</label>
      <div class="sec">SCR entries on this file (${o.entry_detail.length})</div>
      <div class="entrylist">${o.entry_detail.map(e => `<div><span><b class="mono">${esc(e.entry)}</b> <span class="muted">· filed ${fmtD(e.filed, true)}</span></span><span class="muted">${e.n_parcels} parcel${e.n_parcels === 1 ? '' : 's'} <a href="https://secure.utah.gov/scr/preliminary-notice/view.html?filingId=${esc(e.entry)}&filed=true" target="_blank" title="Open in Utah SCR">${I('ext', 'width:12px;height:12px')}</a></span></div>`).join('') || '<div class="muted">No entries</div>'}</div>
      <div class="sec">Notes</div><textarea class="textarea" id="pNotes" rows="3" placeholder="Internal notes">${esc(o.notes || '')}</textarea>
      <div class="sec">Activity</div>
      <div class="timeline">${o.timeline.map(a => { const c = a.action.startsWith('Received') ? 'g' : a.action.startsWith('Follow') ? 'a' : a.action.includes('Cancel') ? 'r' : ''; return `<div class="tl ${c}"><b>${esc(a.action)}</b> <span class="t">· ${fmtD(a.at.slice(0, 10))} ${fmtTime(a.at)}${a.actor ? ' · ' + esc(a.actor) : ''}</span>${a.detail ? `<div class="d">${esc(a.detail)}</div>` : ''}</div>`; }).join('') || '<div class="muted">No activity yet</div>'}</div>
    </div>
    <div class="pf"><button class="btn" data-close>Close</button><button class="btn primary" id="pSave">Save changes</button></div>`);
  const patch = async (body, msg) => { await api('/api/orders/' + o.id, { method: 'PATCH', body: { ...body, actor: S.me } }); toast(msg); await openOrder(o.id); refreshOrdersQuiet(); };
  if ($('#pSend', p)) $('#pSend', p).onclick = () => sendFlow([o.id]);
  if ($('#pRecv', p)) $('#pRecv', p).onclick = () => patch({ status: 'Received' }, 'Marked as received');
  $('#pStatus', p).onchange = (e) => patch({ status: e.target.value }, 'Status → ' + e.target.value);
  $('#pEmailSave', p).onclick = () => { const v = $('#pEmail', p).value.trim(); if (!/^\S+@\S+\.\S+$/.test(v)) return toast('Enter a valid email', 'alert'); patch({ email: v, update_vendor: $('#pEmailV', p).checked }, 'Email updated'); };
  $('#pSave', p).onclick = () => patch({ due_date: $('#pDue', p).value, notes: $('#pNotes', p).value }, 'Changes saved');
}
async function refreshOrdersQuiet() {
  renderNav();
  if (location.hash.startsWith('#/orders')) { S.orders = await api('/api/orders' + pq()); drawOrders(); }
  else if (location.hash.startsWith('#/dashboard') || location.hash === '' || location.hash === '#/') { /* keep panel open; dashboard refreshes on close */ }
}

// ======================= SEND / RESEND (email preview) =======================
async function sendFlow(ids) {
  if (ids.length === 1) {
    const [o, em] = await Promise.all([api('/api/orders/' + ids[0]), api(`/api/orders/${ids[0]}/email`)]);
    const m = openModal(`
      <div class="mh">${I('mail')}<h3>${o.sent_count ? 'Resend' : 'Send'} waiver request</h3><div style="flex:1"></div><button class="iconbtn" data-close>${I('x')}</button></div>
      <div class="mb">
        <div class="mailhdr"><label>To</label><input class="input" id="mTo" value="${esc(em.to)}">
          <label>Cc</label><input class="input" id="mCc" value="${esc(em.cc)}">
          <label>Subject</label><input class="input" id="mSub" value="${esc(em.subject)}"></div>
        <textarea class="textarea" id="mBody" rows="13">${esc(em.body)}</textarea>
        <div style="margin-top:10px;display:flex;gap:10px;align-items:center"><span class="attach">${I('file')}Lien_Waiver_${esc(o.vendor_name.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, ''))}.pdf</span>
          <a href="/print?ids=${o.id}" target="_blank" class="btn sm">${I('eye')}Preview attachment</a></div>
      </div>
      <div class="mf"><span class="hint">${I('shield', 'width:13px;height:13px;vertical-align:-2px')} Demo mode — logged to the activity history, not delivered.</span><div style="flex:1"></div>
        <button class="btn" data-close>Cancel</button><button class="btn primary" id="mSend">${I('send')}Send</button></div>`);
    $('#mSend', m).onclick = async () => {
      const to = $('#mTo', m).value.trim();
      if (!/^\S+@\S+\.\S+$/.test(to)) return toast('Enter a valid recipient email', 'alert');
      if (to !== (o.email || '')) await api('/api/orders/' + o.id, { method: 'PATCH', body: { email: to, update_vendor: true, actor: S.me } });
      await api('/api/orders/send', { method: 'POST', body: { ids, actor: S.me, subject: $('#mSub', m).value } });
      closeAll(); toast(`${o.sent_count ? 'Reminder' : 'Request'} sent to ${o.vendor_name}`, 'send'); afterMutation();
    };
    return;
  }
  const all = await api('/api/orders' + pq());
  const rows = all.filter(o => ids.includes(o.id));
  const ok = rows.filter(o => !['Received', 'Cancelled'].includes(o.status));
  const skip = rows.length - ok.length, noMail = ok.filter(o => !o.email);
  const m = openModal(`
    <div class="mh">${I('send')}<h3>Send ${ok.length} waiver request${ok.length === 1 ? '' : 's'}</h3><div style="flex:1"></div><button class="iconbtn" data-close>${I('x')}</button></div>
    <div class="mb">
      ${skip ? `<div class="alert blue">${I('alert')}${skip} already received or cancelled — they'll be skipped.</div>` : ''}
      ${noMail.length ? `<div class="alert amber">${I('alert')}${noMail.length} vendor${noMail.length > 1 ? 's have' : ' has'} no email on file. Update them in Vendors & Emails first.</div>` : ''}
      <div class="entrylist" style="max-height:340px;overflow:auto">${ok.map(o => `<div><span><b>${esc(o.vendor_name)}</b> <span class="muted">· ${esc(o.file_no)}</span></span><span class="${o.email ? 'muted' : ''}" style="${o.email ? '' : 'color:var(--red)'}">${esc(o.email || 'no email')} · ${o.sent_count ? 'reminder #' + o.sent_count : 'first send'}</span></div>`).join('')}</div>
      <p class="hint" style="margin-top:10px">Each vendor gets their own email with their packet attached (coversheet, statutory waiver, Exhibit A).</p>
    </div>
    <div class="mf"><span class="hint">Demo mode — logged, not delivered.</span><div style="flex:1"></div><button class="btn" data-close>Cancel</button>
      <button class="btn primary" id="mSendAll" ${ok.length - noMail.length ? '' : 'disabled'}>${I('send')}Send ${ok.length - noMail.length}</button></div>`);
  $('#mSendAll', m).onclick = async () => {
    const r = await api('/api/orders/send', { method: 'POST', body: { ids: ok.filter(o => o.email).map(o => o.id), actor: S.me } });
    closeAll(); S.sel.clear(); renderBulk(); toast(`${r.sent} requests sent`, 'send'); afterMutation();
  };
}
function afterMutation() { if (location.hash.startsWith('#/orders')) refreshOrdersQuiet(); else refresh(); }

// ======================= NEW REQUEST =======================
const NR = { project_id: '', vendors: new Set(), type: 'Conditional', stage: 'Progress', amount: '', through: '', due: '', notes: '', q: '', list: [] };
ROUTES.new = async (params) => {
  setTitle('New Request', 'Request lien waivers from one or more vendors');
  NR.project_id = params.project_id || S.project || NR.project_id || (S.meta.projects[0] || {}).id;
  NR.vendors = new Set((params.vendors || '').split(',').filter(Boolean).map(Number));
  NR.due = bizAdd(today(), S.meta.settings.sla_days);
  await loadNRVendors();
  view.innerHTML = `<div class="nr"><div class="card" id="nrform"></div>
    <div class="card preview"><div class="hd"><h3>Live preview</h3><span class="sub" id="pvsub">Select a vendor to preview their packet</span><div class="r"><button class="btn sm" id="pvOpen">${I('ext')}Open full</button></div></div><iframe id="pv"></iframe></div></div>`;
  drawNR(); updatePreview();
  $('#pvOpen').onclick = () => { const w = window.open(); api('/api/preview', { method: 'POST', body: nrBody([...NR.vendors][0]) }).then(h => { w.document.write(h); w.document.close(); }); };
};
async function loadNRVendors() { NR.list = NR.project_id ? await api('/api/vendors?project_id=' + NR.project_id) : []; }
const nrBody = (vid) => ({ project_id: NR.project_id, vendor_id: vid, waiver_type: NR.type, payment_stage: NR.stage, amount: NR.amount, through_date: NR.through, due_date: NR.due, requestor: S.me });
const updatePreview = debounce(async () => {
  const f = $('#pv'); if (!f) return;
  const vid = [...NR.vendors][0];
  if (!vid) { f.srcdoc = `<body style="font-family:Inter,Arial;color:#64748b;display:grid;place-items:center;height:90vh;margin:0;background:#e9edf3">Select a vendor on the left to preview the packet</body>`; return; }
  const v = NR.list.find(x => x.id === vid); $('#pvsub').textContent = `${v ? v.name : ''}${NR.vendors.size > 1 ? ` (+${NR.vendors.size - 1} more)` : ''} · coversheet, waiver & Exhibit A`;
  f.srcdoc = await api('/api/preview', { method: 'POST', body: nrBody(vid) });
}, 250);
function drawNR() {
  const box = $('#nrform'); if (!box) return;
  const q = NR.q.toLowerCase();
  const list = NR.list.filter(v => !q || (v.name + ' ' + (v.trade || '') + ' ' + (v.entries || '')).toLowerCase().includes(q));
  const opt = (t, s, title, desc) => `<div class="opt ${NR.type === t && NR.stage === s ? 'on' : ''}" data-t="${t}" data-s="${s}"><b>${title}</b><p>${desc}</p></div>`;
  box.innerHTML = `
    <div class="step"><div class="num">1</div><div class="sb"><h4>Title file</h4>
      <div style="display:flex;gap:8px"><select class="select" id="nrP" style="flex:1">${S.meta.projects.map(p => `<option value="${p.id}" ${p.id == NR.project_id ? 'selected' : ''}>${esc(p.name)} · ${esc(p.file_no)} · ${esc(p.county)} County${p.is_sample ? ' (sample)' : ''}</option>`).join('')}</select>
      <button class="btn" id="nrNewP">${I('plus')}New file</button></div></div></div>
    <div class="step"><div class="num">2</div><div class="sb"><h4>Vendors <span class="muted small" style="font-weight:500">· ${NR.vendors.size} selected</span></h4>
      <div style="display:flex;gap:8px;margin-bottom:8px"><label class="searchbox" style="flex:1;width:auto">${I('search')}<input id="nrQ" placeholder="Search vendor, trade, SCR entry" value="${esc(NR.q)}"></label>
        <button class="btn sm" id="nrMissing">Select all without a request</button><button class="btn sm ghost" id="nrClear">Clear</button></div>
      <div class="vlist">${list.map(v => `<div class="vrow ${NR.vendors.has(v.id) ? 'on' : ''}" data-v="${v.id}"><input type="checkbox" ${NR.vendors.has(v.id) ? 'checked' : ''}>
        <div class="nm"><b>${esc(v.name)}</b><span class="muted small">${esc(v.trade || '—')} · ${v.n_entries} SCR entr${v.n_entries === 1 ? 'y' : 'ies'}</span></div>
        ${v.n_open ? `<span class="chip amber">${v.n_open} open</span>` : v.n_orders ? '' : '<span class="chip blue">No request yet</span>'}
        ${v.email ? '' : '<span class="chip red">No email</span>'}</div>`).join('') || '<div class="empty">No vendors with SCR entries on this file yet. Use Batch Upload to add them.</div>'}</div></div></div>
    <div class="step"><div class="num">3</div><div class="sb"><h4>Waiver type</h4><div class="opts">
      ${opt('Conditional', 'Progress', 'Conditional · Progress', 'Most common for draws. Effective once the progress check clears.')}
      ${opt('Conditional', 'Final', 'Conditional · Final', 'Final payment, effective once the final check clears.')}
      ${opt('Unconditional', 'Progress', 'Unconditional · Progress', 'Vendor confirms a progress payment was already received.')}
      ${opt('Unconditional', 'Final', 'Unconditional · Final', 'Vendor confirms they were paid in full. Closes out lien rights.')}
    </div></div></div>
    <div class="step"><div class="num">4</div><div class="sb"><h4>Details</h4>
      <div class="row2"><div class="field"><label>Amount ${NR.vendors.size > 1 ? '<span class="hint">(leave blank to let each vendor fill in)</span>' : ''}</label><input class="input" id="nrAmt" placeholder="$0.00" value="${esc(NR.amount)}"></div>
        <div class="field"><label>${NR.stage === 'Final' ? 'Good-thru date' : 'Payment period through'}</label><input class="input" type="date" id="nrThru" value="${NR.through}"></div></div>
      <div class="row2"><div class="field"><label>Return by</label><input class="input" type="date" id="nrDue" value="${NR.due}"><span class="hint">Default: ${S.meta.settings.sla_days} business days</span></div>
        <div class="field"><label>Requested by</label><select class="select" id="nrReq">${S.meta.requestors.map(r => `<option ${r.name === S.me ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select></div></div>
      <div class="field"><label>Notes</label><textarea class="textarea" id="nrNotes" rows="2" placeholder="Optional internal note">${esc(NR.notes)}</textarea></div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:6px">
        <button class="btn" id="nrCreate" ${NR.vendors.size ? '' : 'disabled'}>${I('plus')}Create ${NR.vendors.size || ''} request${NR.vendors.size === 1 ? '' : 's'}</button>
        <button class="btn primary" id="nrSend" ${NR.vendors.size ? '' : 'disabled'}>${I('send')}Create & send now</button></div>
    </div></div>`;
  $('#nrP').onchange = async (e) => { NR.project_id = e.target.value; NR.vendors.clear(); await loadNRVendors(); drawNR(); updatePreview(); };
  $('#nrNewP').onclick = newProjectModal;
  $('#nrQ').oninput = debounce(e => { NR.q = e.target.value; drawNR(); const i = $('#nrQ'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 150);
  $('#nrMissing').onclick = () => { NR.list.filter(v => !v.n_orders && v.email).forEach(v => NR.vendors.add(v.id)); drawNR(); updatePreview(); };
  $('#nrClear').onclick = () => { NR.vendors.clear(); drawNR(); updatePreview(); };
  $$('.vrow', box).forEach(r => r.onclick = () => { const id = +r.dataset.v; NR.vendors.has(id) ? NR.vendors.delete(id) : NR.vendors.add(id); drawNR(); updatePreview(); });
  $$('.opt', box).forEach(o => o.onclick = () => { NR.type = o.dataset.t; NR.stage = o.dataset.s; drawNR(); updatePreview(); });
  $('#nrAmt').oninput = (e) => { NR.amount = e.target.value; updatePreview(); };
  $('#nrThru').onchange = (e) => { NR.through = e.target.value; updatePreview(); };
  $('#nrDue').onchange = (e) => { NR.due = e.target.value; updatePreview(); };
  $('#nrReq').onchange = (e) => { S.me = e.target.value; store.set('me', S.me); renderTop(); updatePreview(); };
  $('#nrNotes').oninput = (e) => { NR.notes = e.target.value; };
  const create = async (send) => {
    const r = await api('/api/orders', { method: 'POST', body: { project_id: NR.project_id, vendor_ids: [...NR.vendors], waiver_type: NR.type, payment_stage: NR.stage, amount: NR.amount, through_date: NR.through, due_date: NR.due, requestor: S.me, notes: NR.notes, send_now: send } });
    toast(`${r.created} request${r.created === 1 ? '' : 's'} ${send ? 'created and sent' : 'created'}`, send ? 'send' : 'check');
    NR.vendors.clear(); NR.amount = ''; NR.notes = ''; S.project = String(NR.project_id); store.set('project', S.project); renderTop();
    location.hash = '#/orders?status=' + (send ? 'Sent' : 'New');
  };
  $('#nrCreate').onclick = () => create(false);
  $('#nrSend').onclick = () => create(true);
}
function newProjectModal() {
  const m = openModal(`<div class="mh">${I('building')}<h3>Open a new title file</h3><div style="flex:1"></div><button class="iconbtn" data-close>${I('x')}</button></div>
    <div class="mb"><div class="row2"><div class="field"><label>Project name *</label><input class="input" id="npN" placeholder="e.g. Mayflower Lodge Ph 3"></div><div class="field"><label>Title file # *</label><input class="input" id="npF" placeholder="ORT-UT-26-0xxxx"></div></div>
      <div class="row2"><div class="field"><label>County</label><select class="select" id="npC"><option>Wasatch</option><option>Summit</option><option>Salt Lake</option><option>Utah</option><option>Davis</option><option>Weber</option><option>Washington</option></select></div><div class="field"><label>Owner</label><input class="input" id="npO"></div></div>
      <div class="field"><label>General contractor</label><input class="input" id="npG"></div>
      <p class="hint">Add vendors and SCR entries to the file with Batch Upload (or from a registry scrub).</p></div>
    <div class="mf"><div style="flex:1"></div><button class="btn" data-close>Cancel</button><button class="btn primary" id="npOk">Create file</button></div>`);
  $('#npOk', m).onclick = async () => {
    const b = { name: $('#npN', m).value.trim(), file_no: $('#npF', m).value.trim(), county: $('#npC', m).value, owner: $('#npO', m).value, gc: $('#npG', m).value, actor: S.me };
    if (!b.name || !b.file_no) return toast('Name and file # are required', 'alert');
    const p = await api('/api/projects', { method: 'POST', body: b }); await loadMeta(); renderTop(); closeAll(); toast('File opened: ' + p.file_no);
    if (location.hash.startsWith('#/new')) { NR.project_id = p.id; await loadNRVendors(); drawNR(); updatePreview(); }
    if (location.hash.startsWith('#/batch')) { BT.project_id = p.id; drawBatch(); }
  };
}

// ======================= TEMPLATES =======================
const TOKENS = ['PROJECT', 'COUNTY', 'VENDOR', 'ENTRIES', 'AMOUNT', 'THROUGH', 'FILE_NO', 'OWNER', 'GC', 'REQUESTOR', 'REQUESTOR_EMAIL', 'REQUEST_DATE', 'DUE_DATE', 'VENDOR_EMAIL', 'VENDOR_PHONE', 'WAIVER_TYPE', 'STAGE', 'COMPANY', 'EXHIBIT'];
const TP = { id: null, list: [], pv: null, pvProject: null };
ROUTES.templates = async () => {
  setTitle('Templates', 'Utah statutory waivers & request coversheet');
  TP.list = await api('/api/templates');
  if (!TP.id || !TP.list.find(t => t.id === TP.id)) TP.id = TP.list[0].id;
  TP.pvProject = TP.pvProject || (S.meta.projects.find(p => !p.is_sample) || S.meta.projects[0]).id;
  const vs = await api('/api/vendors?project_id=' + TP.pvProject);
  TP.vendors = vs.filter(v => v.n_entries);
  if (!TP.pv || !TP.vendors.find(v => v.id === TP.pv)) TP.pv = (TP.vendors.find(v => /brown strauss/i.test(v.name)) || TP.vendors[0] || {}).id;
  const groups = [['Conditional', 'Conditional waivers', 'shield'], ['Unconditional', 'Unconditional waivers', 'check'], ['Coversheet', 'Coversheets', 'file']];
  view.innerHTML = `<div class="tplgrid">
    <div class="card">${groups.map(([k, label, ic]) => `<div class="sec" style="margin:14px 14px 6px">${label}</div>` + TP.list.filter(t => t.kind === k).map(t => `
      <div class="tpli ${t.id === TP.id ? 'on' : ''}" data-id="${t.id}"><div class="ti">${I(ic)}</div><div><b>${esc(t.stage ? t.stage + ' payment' : t.title)}</b><div class="muted small">Edited ${fmtD(t.updated_at.slice(0, 10))}</div></div></div>`).join('')).join('')}
      <div class="bd hint">Statutory forms per Utah Code §38-1a-802. Wording changes should be approved by counsel.</div></div>
    <div class="card"><div class="hd"><h3 id="tpT"></h3><div class="r"><button class="btn sm" id="tpReset">${I('refresh')}Reset</button><button class="btn sm primary" id="tpSave">Save</button></div></div>
      <div class="bd"><div class="field"><label>Template name</label><input class="input" id="tpTitle"></div>
      <label class="hint">Click a field to insert it at the cursor:</label><div class="tokens">${TOKENS.map(t => `<button data-tk="${t}">{{${t}}}</button>`).join('')}</div>
      <textarea class="code" id="tpBody" spellcheck="false"></textarea></div></div>
    <div class="card tplprev"><div class="hd"><h3>Preview</h3><div class="r"><select class="select" id="tpV" style="height:30px;max-width:230px">${TP.vendors.map(v => `<option value="${v.id}" ${v.id === TP.pv ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}</select></div></div><iframe id="tpF"></iframe></div>
  </div>`;
  const load = () => { const t = TP.list.find(x => x.id === TP.id); $('#tpT').textContent = t.title; $('#tpTitle').value = t.title; $('#tpBody').value = t.body; prev(); };
  const prev = debounce(async () => { $('#tpF').srcdoc = await api('/api/preview', { method: 'POST', body: { template_id: TP.id, body: $('#tpBody').value, project_id: TP.pvProject, vendor_id: TP.pv, requestor: S.me, amount: '$48,250.00', through_date: today() } }); }, 350);
  $$('.tpli').forEach(el => el.onclick = () => { TP.id = +el.dataset.id; $$('.tpli').forEach(x => x.classList.toggle('on', x === el)); load(); });
  $('#tpBody').oninput = prev;
  $('#tpV').onchange = (e) => { TP.pv = +e.target.value; prev(); };
  $$('[data-tk]').forEach(b => b.onclick = () => { const ta = $('#tpBody'), s = ta.selectionStart, tk = `{{${b.dataset.tk}}}`; ta.setRangeText(tk, s, ta.selectionEnd, 'end'); ta.focus(); prev(); });
  $('#tpSave').onclick = async () => { await api('/api/templates/' + TP.id, { method: 'PATCH', body: { title: $('#tpTitle').value, body: $('#tpBody').value, actor: S.me } }); TP.list = await api('/api/templates'); toast('Template saved'); };
  $('#tpReset').onclick = async () => { if (!(await confirmBox('Reset template?', 'This restores the original statutory wording and discards your edits to this template.', 'Reset', true))) return; await api(`/api/templates/${TP.id}/reset`, { method: 'POST' }); TP.list = await api('/api/templates'); load(); toast('Template reset to default'); };
  load();
};

// ======================= REPORTS =======================
const RP = { tab: 'activity', from: '', to: '', file: '', req: '', action: '', preset: '30' };
ROUTES.reports = async (params) => {
  if (params.tab) RP.tab = params.tab;
  setTitle('Reports', { activity: 'All activity', missing: 'Missing requests', status: 'Status report' }[RP.tab]);
  view.innerHTML = `<div class="card"><div class="tabs">
    <button data-t="activity" class="${RP.tab === 'activity' ? 'on' : ''}">${I('clock')}All activity</button>
    <button data-t="missing" class="${RP.tab === 'missing' ? 'on' : ''}">${I('alert')}Missing requests</button>
    <button data-t="status" class="${RP.tab === 'status' ? 'on' : ''}">${I('bar')}Status report</button></div><div id="rbody"></div></div>`;
  $$('.tabs button', view).forEach(b => b.onclick = () => { location.hash = '#/reports?tab=' + b.dataset.t; });
  if (RP.tab === 'missing') return repMissing();
  if (RP.tab === 'status') return repStatus();
  return repActivity();
};
function setPreset(p) {
  RP.preset = p; RP.to = today();
  RP.from = p === 'all' ? '' : p === 'month' ? today().slice(0, 8) + '01' : new Date(D(today()) - (Number(p) - 1) * 864e5).toISOString().slice(0, 10);
  if (p === 'all') RP.to = '';
}
async function repActivity() {
  if (!RP.from && RP.preset !== 'all') setPreset(RP.preset);
  const fileP = RP.file || S.project;
  const qs = new URLSearchParams(Object.entries({ from: RP.from, to: RP.to, project_id: fileP, requestor: RP.req, action: RP.action }).filter(([, v]) => v)).toString();
  const rows = await api('/api/reports/activity?' + qs);
  const n = (p) => rows.filter(r => r.action.startsWith(p)).length;
  let lastDay = '';
  $('#rbody').innerHTML = `
    <div class="filters">
      <div class="seg">${[['7', '7 days'], ['30', '30 days'], ['month', 'This month'], ['90', '90 days'], ['all', 'All time']].map(([v, l]) => `<button data-p="${v}" class="${RP.preset === v ? 'on' : ''}">${l}</button>`).join('')}</div>
      <input type="date" class="input" id="aF" value="${RP.from}"><span class="muted">to</span><input type="date" class="input" id="aT" value="${RP.to}">
      <select class="select" id="aFile"><option value="">All file #s</option>${S.meta.projects.map(p => `<option value="${p.id}" ${fileP == p.id ? 'selected' : ''}>${esc(p.file_no)} · ${esc(p.name)}</option>`).join('')}</select>
      <select class="select" id="aReq"><option value="">All requestors</option>${S.meta.requestors.map(r => `<option ${RP.req === r.name ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select>
      <select class="select" id="aAct"><option value="">All actions</option>${['Request created', 'Sent', 'Follow-up sent', 'Received', 'Status', 'Email updated', 'Due date changed', 'Batch upload', 'Template edited'].map(a => `<option ${RP.action === a ? 'selected' : ''}>${a}</option>`).join('')}</select>
      <div style="flex:1"></div><button class="btn sm" id="aCsv">${I('download')}Export CSV</button><button class="btn sm" onclick="window.print()">${I('printer')}Print</button>
    </div>
    <div class="bd"><div class="stats">
      <div class="stat"><span class="muted small">Events</span><b>${rows.length}</b></div>
      <div class="stat"><span class="muted small">Requests created</span><b>${n('Request created')}</b></div>
      <div class="stat"><span class="muted small">Sent</span><b>${n('Sent')}</b></div>
      <div class="stat"><span class="muted small">Follow-ups</span><b style="color:var(--amber)">${n('Follow-up')}</b></div>
      <div class="stat"><span class="muted small">Received</span><b style="color:var(--green)">${n('Received')}</b></div>
      <div class="stat"><span class="muted small">Email updates</span><b style="color:var(--violet)">${n('Email updated')}</b></div></div></div>
    <table class="tbl"><thead><tr><th style="width:90px">Time</th><th>Action</th><th>Vendor</th><th>File #</th><th>By</th><th>Detail</th></tr></thead><tbody>
    ${rows.map(r => { const day = r.at.slice(0, 10); const hdr = day !== lastDay ? `<tr class="daterow"><td colspan="6">${new Date(day + 'T12:00:00Z').toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</td></tr>` : ''; lastDay = day; const [ic, bg, fg] = actIcon(r);
      return hdr + `<tr data-o="${r.order_id || ''}"><td class="muted">${fmtTime(r.at)}</td><td><div class="ainfo"><span class="fic" style="background:${bg};color:${fg}">${I(ic)}</span><b>${esc(r.action)}</b></div></td>
        <td class="w">${esc(r.vendor_name || '—')}</td><td class="mono">${esc(r.file_no || '—')}</td><td>${who(r.actor)}</td><td class="muted w" style="max-width:420px">${esc(r.detail || '')}</td></tr>`; }).join('')}
    </tbody></table>${rows.length ? '' : `<div class="empty">${I('clock')}<br>No activity in this range.</div>`}`;
  $$('[data-p]').forEach(b => b.onclick = () => { setPreset(b.dataset.p); repActivity(); });
  $('#aF').onchange = (e) => { RP.from = e.target.value; RP.preset = ''; repActivity(); };
  $('#aT').onchange = (e) => { RP.to = e.target.value; RP.preset = ''; repActivity(); };
  $('#aFile').onchange = (e) => { RP.file = e.target.value; repActivity(); };
  $('#aReq').onchange = (e) => { RP.req = e.target.value; repActivity(); };
  $('#aAct').onchange = (e) => { RP.action = e.target.value; repActivity(); };
  $$('tr[data-o]').forEach(tr => tr.dataset.o && (tr.onclick = () => openOrder(tr.dataset.o)));
  $('#aCsv').onclick = () => csvDownload('scr_activity.csv', [['Date', 'Time', 'Action', 'Vendor', 'File #', 'Project', 'By', 'Detail'], ...rows.map(r => [r.at.slice(0, 10), r.at.slice(11, 16), r.action, r.vendor_name, r.file_no, r.project_name, r.actor, r.detail])]);
}
async function repMissing() {
  const rows = await api('/api/reports/missing' + pq());
  const sel = new Set();
  const byP = {}; rows.forEach(r => (byP[r.project_id] = byP[r.project_id] || []).push(r));
  const draw = () => {
    $('#rbody').innerHTML = `
      <div class="bd"><div class="alert blue" style="margin:0">${I('alert')}<span>These vendors filed a preliminary notice in the State Construction Registry on the file, but nobody has requested a waiver from them yet. ${rows.length ? `<b>${rows.length}</b> found.` : ''}</span></div></div>
      <div class="filters"><span class="muted">${sel.size} selected</span><div style="flex:1"></div>
        <button class="btn sm" id="mCsv">${I('download')}Export CSV</button>
        <button class="btn sm primary" id="mCreate" ${sel.size ? '' : 'disabled'}>${I('plus')}Create requests for selected</button></div>
      ${Object.entries(byP).map(([pid, rs]) => `<div class="sec" style="margin:16px 14px 6px">${esc(rs[0].file_no)} · ${esc(rs[0].project_name)} — ${rs.length} vendor${rs.length > 1 ? 's' : ''}</div>
        <table class="tbl"><thead><tr><th style="width:34px"><input type="checkbox" data-all="${pid}"></th><th>Vendor</th><th>SCR entries</th><th>Last filed</th><th>Email</th><th></th></tr></thead><tbody>
        ${rs.map(r => `<tr data-k="${pid}:${r.id}" class="${sel.has(pid + ':' + r.id) ? 'sel' : ''}"><td><input type="checkbox" ${sel.has(pid + ':' + r.id) ? 'checked' : ''}></td>
          <td class="w"><div class="v1">${esc(r.name)}</div><div class="v2">${esc(r.trade || '')}</div></td>
          <td class="w" style="max-width:420px">${r.entries.split(', ').map(e => `<span class="chip mono">${esc(e)}</span>`).join(' ')}</td>
          <td>${fmtD(r.last_filed, true)}</td><td>${r.email ? esc(r.email) : '<span class="chip red">No email</span>'}</td>
          <td><a class="btn sm" href="#/new?project_id=${pid}&vendors=${r.id}">Request</a></td></tr>`).join('')}</tbody></table>`).join('') || `<div class="empty">${I('check')}<br>Every vendor with an SCR filing has a waiver request.</div>`}`;
    $$('tr[data-k]').forEach(tr => tr.onclick = (e) => { if (e.target.closest('a')) return; const k = tr.dataset.k; sel.has(k) ? sel.delete(k) : sel.add(k); draw(); });
    $$('[data-all]').forEach(c => c.onchange = () => { byP[c.dataset.all].forEach(r => c.checked ? sel.add(c.dataset.all + ':' + r.id) : sel.delete(c.dataset.all + ':' + r.id)); draw(); });
    $('#mCsv').onclick = () => csvDownload('missing_requests.csv', [['File #', 'Project', 'Vendor', 'Trade', 'SCR Entries', 'Last Filed', 'Email'], ...rows.map(r => [r.file_no, r.project_name, r.name, r.trade, r.entries, r.last_filed, r.email])]);
    $('#mCreate').onclick = () => bulkCreateModal(sel);
  };
  draw();
}
function bulkCreateModal(sel) {
  let t = 'Conditional', s = 'Progress';
  const m = openModal(`<div class="mh">${I('plus')}<h3>Create ${sel.size} waiver request${sel.size > 1 ? 's' : ''}</h3><div style="flex:1"></div><button class="iconbtn" data-close>${I('x')}</button></div>
    <div class="mb"><div class="opts" id="bcO">${[['Conditional', 'Progress'], ['Conditional', 'Final'], ['Unconditional', 'Progress'], ['Unconditional', 'Final']].map(([a, b]) => `<div class="opt ${a === t && b === s ? 'on' : ''}" data-t="${a}" data-s="${b}"><b>${a} · ${b}</b></div>`).join('')}</div>
      <div class="row2 mt"><div class="field"><label>Requested by</label><select class="select" id="bcR">${S.meta.requestors.map(r => `<option ${r.name === S.me ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select></div>
      <div class="field"><label>Return by</label><input type="date" class="input" id="bcD" value="${bizAdd(today(), S.meta.settings.sla_days)}"></div></div></div>
    <div class="mf"><div style="flex:1"></div><button class="btn" data-close>Cancel</button><button class="btn" id="bcC">Create</button><button class="btn primary" id="bcS">${I('send')}Create & send</button></div>`);
  $$('#bcO .opt', m).forEach(o => o.onclick = () => { t = o.dataset.t; s = o.dataset.s; $$('#bcO .opt', m).forEach(x => x.classList.toggle('on', x === o)); });
  const go = async (send) => {
    const groups = {}; [...sel].forEach(k => { const [p, v] = k.split(':'); (groups[p] = groups[p] || []).push(+v); });
    let n = 0; for (const [p, vids] of Object.entries(groups)) { const r = await api('/api/orders', { method: 'POST', body: { project_id: +p, vendor_ids: vids, waiver_type: t, payment_stage: s, requestor: $('#bcR', m).value, due_date: $('#bcD', m).value, send_now: send } }); n += r.created; }
    closeAll(); toast(`${n} requests ${send ? 'created and sent' : 'created'}`); refresh();
  };
  $('#bcC', m).onclick = () => go(false); $('#bcS', m).onclick = () => go(true);
}
async function repStatus() {
  const d = await api('/api/reports/status' + pq());
  const tot = d.orders.length || 1, openN = d.aging.reduce((a, b) => a + b.n, 0) || 1;
  const hb = (l, n, max, col) => `<div class="hbar"><span>${l}</span><div class="tr"><i style="width:${n / max * 100}%;background:${col}"></i></div><span>${n}</span></div>`;
  const agCol = ['#2fa77d', '#f5b041', '#f08a4b', '#c2362f'];
  $('#rbody').innerHTML = `
    <div class="filters"><span class="muted">${d.orders.length} requests${S.project ? ' on ' + esc(proj(S.project).file_no) : ' across all files'}</span><div style="flex:1"></div>
      <button class="btn sm" id="sCsv">${I('download')}Export all orders</button><button class="btn sm" onclick="window.print()">${I('printer')}Print report</button></div>
    <div class="bd"><div class="grid g11">
      <div class="card"><div class="hd"><h3>By status</h3></div><div class="bd">${d.status.map(s => hb(pill(s.status), s.n, tot, STCOL[s.status])).join('')}</div></div>
      <div class="card"><div class="hd"><h3>Aging of open requests</h3><span class="sub">Days since requested</span></div><div class="bd">${d.aging.map((a, i) => hb(a.bucket, a.n, openN, agCol[i])).join('')}</div></div>
    </div>
    <div class="grid g11 mt">
      <div class="card"><div class="hd"><h3>By requestor</h3></div><table class="tbl"><thead><tr><th>Requestor</th><th>Total</th><th>Open</th><th>Overdue</th><th>Received</th><th>Complete</th></tr></thead><tbody>
        ${d.byReq.map(r => `<tr style="cursor:default"><td>${who(r.requestor)}</td><td>${r.total}</td><td>${r.open}</td><td>${r.overdue ? `<span class="chip red">${r.overdue}</span>` : 0}</td><td>${r.received}</td>
          <td><div style="display:flex;align-items:center;gap:8px"><div class="prog" style="min-width:70px;flex:1"><i style="width:${Math.round(r.received / r.total * 100)}%"></i></div>${Math.round(r.received / r.total * 100)}%</div></td></tr>`).join('')}</tbody></table></div>
      <div class="card"><div class="hd"><h3>By waiver type</h3></div><table class="tbl"><thead><tr><th>Type</th><th>Requests</th><th>Received</th><th>Complete</th></tr></thead><tbody>
        ${d.byType.map(r => `<tr style="cursor:default"><td>${esc(r.type)}</td><td>${r.total}</td><td>${r.received}</td><td>${r.total ? Math.round(r.received / r.total * 100) + '%' : '—'}</td></tr>`).join('')}</tbody></table></div>
    </div>
    <div class="card mt"><div class="hd"><h3>Open requests by vendor</h3><span class="sub">Oldest first</span></div><table class="tbl"><thead><tr><th>Vendor</th><th>File</th><th>Waiver</th><th>Requested</th><th>Return by</th><th>Status</th><th>Sent</th></tr></thead><tbody>
      ${d.orders.filter(o => OPEN.includes(o.status)).sort((a, b) => a.request_date.localeCompare(b.request_date)).map(o => `<tr data-id="${o.id}"><td class="v1 w">${esc(o.vendor_name)}</td><td class="mono">${esc(o.file_no)}</td><td>${typeTag(o.waiver_type)} ${esc(o.payment_stage)}</td><td>${fmtD(o.request_date)} <span class="muted small">(${o.age}d)</span></td><td>${fmtD(o.due_date)} ${dueChip(o)}</td><td>${pill(o.status)}</td><td>${o.sent_count}×</td></tr>`).join('')}
    </tbody></table></div></div>`;
  $$('tr[data-id]').forEach(tr => tr.onclick = () => openOrder(tr.dataset.id));
  $('#sCsv').onclick = () => csvDownload('status_report.csv', [['Vendor', 'File #', 'Project', 'Waiver', 'Stage', 'Requested By', 'Requested', 'Return By', 'Status', 'Days Open', 'Times Sent', 'Received'], ...d.orders.map(o => [o.vendor_name, o.file_no, o.project_name, o.waiver_type, o.payment_stage, o.requestor, o.request_date, o.due_date, o.status, o.age, o.sent_count, o.received_date])]);
}

// ======================= BATCH UPLOAD =======================
const BT = { step: 1, mode: 'existing', project_id: '', newp: { name: '', file_no: '', county: 'Wasatch', owner: '', gc: '' }, type: 'Conditional', stage: 'Progress', rows: [], fileName: '', result: null };
ROUTES.batch = async () => {
  setTitle('Batch Upload', 'Create many waiver requests from a spreadsheet');
  BT.project_id = BT.project_id || S.project || (S.meta.projects[0] || {}).id;
  S.vendorsAll = await api('/api/vendors');
  if (BT.result) { BT.step = 1; BT.rows = []; BT.result = null; }
  view.innerHTML = `<div id="bt"></div>`; drawBatch();
};
function parseCSV(text) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true; else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
    else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim()));
}
const ALIAS = { vendor: ['vendor', 'vendor name', 'filer', 'company', 'name'], email: ['email', 'vendor email', 'e-mail'], scr_entries: ['scr_entries', 'scr entries', 'scr entry', 'scr entry #', 'scr entry numbers', 'entries', 'entry'],
  waiver_type: ['waiver_type', 'waiver type', 'type'], payment_stage: ['payment_stage', 'payment stage', 'stage'], amount: ['amount', 'amount owing'], through_date: ['through_date', 'through', 'good thru', 'good thru date', 'payment period'],
  requestor: ['requestor', 'requested by', 'who requested'], notes: ['notes', 'note'], trade: ['trade'], phone: ['phone'],
  parcels: ['parcels', 'parcel', 'tax parcel ids', 'parcel numbers'], filed: ['filed', 'date filed', 'filing date'], county: ['county'] };
function mapRows(table) {
  const hdr = table[0].map(h => h.trim().toLowerCase());
  const idx = {}; for (const [k, al] of Object.entries(ALIAS)) idx[k] = hdr.findIndex(h => al.includes(h));
  const known = new Map(S.vendorsAll.map(v => [v.name.toLowerCase(), v]));
  return table.slice(1).map((r, i) => {
    const o = { line: i + 2 }; for (const [k, j] of Object.entries(idx)) o[k] = j >= 0 ? (r[j] || '').trim() : '';
    o.issues = []; o.state = 'ok';
    const v = o.vendor ? known.get(o.vendor.toLowerCase()) : null;
    if (!o.vendor) { o.state = 'error'; o.issues.push('Missing vendor name'); }
    else if (!v) { o.state = 'new'; o.issues.push('New vendor — will be added to directory'); }
    o.match = v; if (!o.email && v) o.email = v.email || '';
    if (!o.email) { o.issues.push('No email on file'); if (o.state === 'ok') o.state = 'warn'; }
    else if (!/^\S+@\S+\.\S+$/.test(o.email)) { o.issues.push('Email looks invalid'); o.state = 'error'; }
    if (o.waiver_type && !/^(conditional|unconditional)$/i.test(o.waiver_type)) { o.issues.push(`Unknown waiver type "${o.waiver_type}" — using default`); o.waiver_type = ''; if (o.state === 'ok') o.state = 'warn'; }
    if (o.payment_stage && !/^(progress|final)$/i.test(o.payment_stage)) { o.issues.push(`Unknown stage "${o.payment_stage}" — using default`); o.payment_stage = ''; if (o.state === 'ok') o.state = 'warn'; }
    if (o.waiver_type) o.waiver_type = o.waiver_type[0].toUpperCase() + o.waiver_type.slice(1).toLowerCase();
    if (o.payment_stage) o.payment_stage = o.payment_stage[0].toUpperCase() + o.payment_stage.slice(1).toLowerCase();
    if (o.through_date && !/^\d{4}-\d{2}-\d{2}$/.test(o.through_date)) { const d = new Date(o.through_date); o.through_date = isNaN(d) ? '' : d.toISOString().slice(0, 10); }
    if (!o.scr_entries && v) o.scr_entries = '';
    return o;
  });
}
function drawBatch() {
  const box = $('#bt'); if (!box) return;
  const st = (n, l) => `<div class="${BT.step === n ? 'on' : BT.step > n ? 'done' : ''}"><span class="n">${BT.step > n ? '✓' : n}</span>${l}</div>`;
  let body = '';
  if (BT.step === 1) {
    body = `<div class="card"><div class="hd"><h3>Where should these requests go?</h3></div><div class="bd">
      <div class="seg" style="margin-bottom:14px"><button data-m="existing" class="${BT.mode === 'existing' ? 'on' : ''}">Existing title file</button><button data-m="new" class="${BT.mode === 'new' ? 'on' : ''}">New title file</button></div>
      ${BT.mode === 'existing' ? `<div class="field"><label>Title file</label><select class="select" id="btP">${S.meta.projects.map(p => `<option value="${p.id}" ${p.id == BT.project_id ? 'selected' : ''}>${esc(p.name)} · ${esc(p.file_no)}</option>`).join('')}</select></div>`
      : `<div class="row2"><div class="field"><label>Project name *</label><input class="input" data-np="name" value="${esc(BT.newp.name)}"></div><div class="field"><label>Title file # *</label><input class="input" data-np="file_no" value="${esc(BT.newp.file_no)}"></div></div>
         <div class="row2"><div class="field"><label>County</label><input class="input" data-np="county" value="${esc(BT.newp.county)}"></div><div class="field"><label>General contractor</label><input class="input" data-np="gc" value="${esc(BT.newp.gc)}"></div></div>`}
      <div class="row2"><div class="field"><label>Default waiver type</label><select class="select" id="btT"><option ${BT.type === 'Conditional' ? 'selected' : ''}>Conditional</option><option ${BT.type === 'Unconditional' ? 'selected' : ''}>Unconditional</option></select></div>
        <div class="field"><label>Default payment stage</label><select class="select" id="btS"><option ${BT.stage === 'Progress' ? 'selected' : ''}>Progress</option><option ${BT.stage === 'Final' ? 'selected' : ''}>Final</option></select></div></div>
      <p class="hint">Rows in the file can override the waiver type and stage. Requests are created as <b>${esc(S.me)}</b> unless a row names another requestor.</p>
      <div style="display:flex;justify-content:flex-end"><button class="btn primary" id="btNext">Continue ${I('chev')}</button></div></div></div>`;
  } else if (BT.step === 2) {
    body = `<div class="card"><div class="hd"><h3>Upload your spreadsheet</h3><span class="sub">CSV — export from Excel with “Save As → CSV”</span><div class="r"><a class="btn sm" href="/api/sample-csv">${I('download')}Download template</a></div></div><div class="bd">
      <div class="drop" id="btDrop">${I('upload')}<div style="font-weight:700;font-size:15px">Drop a CSV here or click to browse</div><div class="muted small" style="margin-top:4px">Columns: vendor, email, scr_entries, waiver_type, payment_stage, amount, through_date, requestor, notes</div><input type="file" id="btFile" accept=".csv,text/csv" hidden></div>
      <div style="display:flex;gap:8px;margin-top:14px;align-items:center"><button class="btn" id="btBack">Back</button><div style="flex:1"></div><span class="hint">No file handy?</span><button class="btn" id="btDemo">${I('sparkle')}Demo: October draw</button><button class="btn" id="btDemo2">${I('sparkle')}Demo: new file import</button></div></div></div>`;
  } else if (BT.step === 3) {
    const c = (s) => BT.rows.filter(r => r.state === s).length, valid = BT.rows.filter(r => r.state !== 'error');
    const stChip = (r) => r.state === 'ok' ? '<span class="chip green">Matched</span>' : r.state === 'new' ? '<span class="chip blue">New vendor</span>' : r.state === 'warn' ? '<span class="chip amber">Check</span>' : '<span class="chip red">Error</span>';
    body = `<div class="card"><div class="hd"><h3>Review ${esc(BT.fileName)}</h3><span class="sub">${BT.rows.length} rows</span><div class="r"><button class="btn sm" id="btBack">Choose another file</button></div></div>
      <div class="bd"><div class="stats"><div class="stat"><span class="muted small">Ready</span><b style="color:var(--green)">${c('ok')}</b></div><div class="stat"><span class="muted small">New vendors</span><b style="color:var(--brand2)">${c('new')}</b></div>
        <div class="stat"><span class="muted small">Need a look</span><b style="color:var(--amber)">${c('warn')}</b></div><div class="stat"><span class="muted small">Errors (skipped)</span><b style="color:var(--red)">${c('error')}</b></div></div></div>
      <div class="scrollx"><table class="tbl"><thead><tr><th>Row</th><th>Check</th><th>Vendor</th><th>Email</th><th>SCR entries</th><th>Waiver</th><th>Amount</th><th>Requestor</th><th>Notes</th></tr></thead><tbody>
      ${BT.rows.map(r => `<tr style="cursor:default"><td class="muted">${r.line}</td><td>${stChip(r)}</td><td class="w"><div class="v1">${esc(r.vendor || '—')}</div>${r.issues.length ? `<div class="v2" style="color:${r.state === 'error' ? 'var(--red)' : 'var(--amber)'}">${esc(r.issues.join(' · '))}</div>` : ''}</td>
        <td>${esc(r.email || '—')}</td><td class="mono small">${esc(r.scr_entries || (r.match ? 'from registry' : '—'))}</td><td>${typeTag(r.waiver_type || BT.type)} ${esc(r.payment_stage || BT.stage)}</td><td>${esc(r.amount || '—')}</td><td>${esc(r.requestor || S.me)}</td><td class="muted w">${esc(r.notes || '')}</td></tr>`).join('')}</tbody></table></div>
      <div class="bd" style="display:flex;justify-content:flex-end;gap:8px"><button class="btn primary" id="btImport" ${valid.length ? '' : 'disabled'}>${I('upload')}Create ${valid.length} request${valid.length === 1 ? '' : 's'}</button></div></div>`;
  } else {
    const r = BT.result;
    body = `<div class="card"><div class="bd" style="text-align:center;padding:40px">
      <div style="width:56px;height:56px;border-radius:50%;background:var(--greenSoft);color:var(--green);display:grid;place-items:center;margin:0 auto 12px">${I('check', 'width:28px;height:28px')}</div>
      <h2 style="margin:0 0 6px">${r.created} waiver requests created</h2><p class="muted">${r.newVendors} new vendor${r.newVendors === 1 ? '' : 's'} added · ${r.newEntries} new SCR entr${r.newEntries === 1 ? 'y' : 'ies'} recorded</p>
      <div style="display:flex;gap:8px;justify-content:center;margin-top:16px"><a class="btn" href="#/batch" id="btAgain">Upload another</a><button class="btn primary" id="btView">${I('list')}Review & send them</button></div></div></div>`;
  }
  box.innerHTML = `<div class="stepper">${st(1, 'Choose title file')}${st(2, 'Upload spreadsheet')}${st(3, 'Review & create')}</div>${body}`;
  // bindings
  $$('[data-m]', box).forEach(b => b.onclick = () => { BT.mode = b.dataset.m; drawBatch(); });
  $$('[data-np]', box).forEach(i => i.oninput = () => { BT.newp[i.dataset.np] = i.value; });
  if ($('#btP')) $('#btP').onchange = (e) => BT.project_id = e.target.value;
  if ($('#btT')) $('#btT').onchange = (e) => BT.type = e.target.value;
  if ($('#btS')) $('#btS').onchange = (e) => BT.stage = e.target.value;
  if ($('#btNext')) $('#btNext').onclick = () => { if (BT.mode === 'new' && (!BT.newp.name || !BT.newp.file_no)) return toast('Project name and file # are required', 'alert'); BT.step = 2; drawBatch(); };
  if ($('#btBack')) $('#btBack').onclick = () => { BT.step = BT.step === 3 ? 2 : 1; drawBatch(); };
  const ingest = (name, text) => { const t = parseCSV(text); if (t.length < 2) return toast('That file has no data rows', 'alert'); BT.fileName = name; BT.rows = mapRows(t); BT.step = 3; drawBatch(); };
  const drop = $('#btDrop');
  if (drop) {
    drop.onclick = () => $('#btFile').click();
    $('#btFile').onchange = (e) => { const f = e.target.files[0]; if (f) f.text().then(t => ingest(f.name, t)); };
    drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('over'); };
    drop.ondragleave = () => drop.classList.remove('over');
    drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove('over'); const f = e.dataTransfer.files[0]; if (f) f.text().then(t => ingest(f.name, t)); };
    $('#btDemo').onclick = async () => ingest('demo_batch_upload.csv', await api('/samples/demo_batch_upload.csv'));
    $('#btDemo2').onclick = async () => ingest('demo_new_file_import.csv', await api('/samples/demo_new_file_import.csv'));
  }
  if ($('#btImport')) $('#btImport').onclick = async () => {
    const rows = BT.rows.filter(r => r.state !== 'error').map(r => ({ vendor: r.vendor, email: r.email, scr_entries: r.scr_entries, waiver_type: r.waiver_type, payment_stage: r.payment_stage, amount: r.amount, through_date: r.through_date, requestor: r.requestor || S.me, notes: r.notes, trade: r.trade, phone: r.phone, parcels: r.parcels, filed: r.filed, county: r.county }));
    const body = { rows, waiver_type: BT.type, payment_stage: BT.stage, actor: S.me };
    if (BT.mode === 'existing') body.project_id = BT.project_id; else body.new_project = BT.newp;
    BT.result = await api('/api/batch', { method: 'POST', body }); BT.step = 4;
    await loadMeta(); renderTop(); renderNav(); drawBatch(); toast(`${BT.result.created} requests created`);
  };
  if ($('#btView')) $('#btView').onclick = () => { S.project = String(BT.result.project_id); store.set('project', S.project); renderTop(); BT.result = null; BT.step = 1; BT.rows = []; location.hash = '#/orders?status=New'; };
  if ($('#btAgain')) $('#btAgain').onclick = () => { BT.result = null; BT.step = 1; BT.rows = []; };
}

// ======================= VENDORS & EMAILS =======================
const VD = { q: '', editing: null };
ROUTES.vendors = async () => {
  const p = proj(S.project);
  setTitle('Vendors & Emails', p ? `Vendors on ${p.file_no}` : 'Vendor directory');
  const list = await api('/api/vendors' + pq());
  const draw = () => {
    const q = VD.q.toLowerCase(); const rows = list.filter(v => !q || (v.name + ' ' + v.trade + ' ' + v.email).toLowerCase().includes(q));
    view.innerHTML = `<div class="card"><div class="hd"><h3>${rows.length} vendors</h3><span class="sub">Change an email here and it updates every open request for that vendor.</span>
      <div class="r"><label class="searchbox" style="width:260px">${I('search')}<input id="vq" placeholder="Search vendors" value="${esc(VD.q)}"></label>
      <button class="btn sm" id="vCsv">${I('download')}Export</button></div></div>
      <table class="tbl"><thead><tr><th>Vendor</th><th style="width:34%">Email</th><th>Phone</th><th>SCR entries</th><th>Open requests</th><th>All requests</th></tr></thead><tbody>
      ${rows.map(v => `<tr data-v="${v.id}"><td class="w"><div class="v1">${esc(v.name)}</div><div class="v2">${esc(v.trade || '')}</div></td>
        <td>${VD.editing === v.id ? `<div style="display:flex;gap:6px"><input class="input" id="ve" value="${esc(v.email || '')}" style="flex:1;height:32px"><button class="btn sm primary" id="veS">Save</button><button class="btn sm" id="veC">Cancel</button></div>`
          : `<span style="display:inline-flex;gap:6px;align-items:center">${v.email ? esc(v.email) : '<span class="chip red">No email</span>'}<button class="iconbtn" data-e="${v.id}" title="Update email">${I('edit')}</button></span>`}</td>
        <td>${esc(v.phone || '—')}</td><td>${v.n_entries}</td><td>${v.n_open ? `<span class="chip amber">${v.n_open}</span>` : '0'}</td><td>${v.n_orders}</td></tr>`).join('')}</tbody></table></div>`;
    $('#vq').oninput = debounce(e => { VD.q = e.target.value; draw(); const i = $('#vq'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 150);
    $('#vCsv').onclick = () => csvDownload('vendors.csv', [['Vendor', 'Trade', 'Email', 'Phone', 'SCR Entries', 'Open Requests', 'All Requests'], ...rows.map(v => [v.name, v.trade, v.email, v.phone, v.entries, v.n_open, v.n_orders])]);
    $$('[data-e]').forEach(b => b.onclick = (e) => { e.stopPropagation(); VD.editing = +b.dataset.e; draw(); $('#ve').focus(); });
    if ($('#veC')) $('#veC').onclick = (e) => { e.stopPropagation(); VD.editing = null; draw(); };
    if ($('#veS')) { const save = async (e) => { e && e.stopPropagation(); const val = $('#ve').value.trim(); if (!/^\S+@\S+\.\S+$/.test(val)) return toast('Enter a valid email', 'alert');
      const v = list.find(x => x.id === VD.editing); await api('/api/vendors/' + v.id, { method: 'PATCH', body: { email: val, actor: S.me } }); v.email = val; VD.editing = null; draw(); toast(`Email updated for ${v.name}`, 'mail'); };
      $('#veS').onclick = save; $('#ve').onkeydown = (e) => { if (e.key === 'Enter') save(e); }; $('#ve').onclick = (e) => e.stopPropagation(); }
    $$('tr[data-v]').forEach(tr => tr.onclick = (e) => { if (e.target.closest('button,input')) return; openVendor(+tr.dataset.v); });
  };
  draw();
};
async function openVendor(id) {
  const v = await api('/api/vendors/' + id);
  openPanel(`<div class="ph"><div class="ptitle"><div style="flex:1"><div class="muted small">${esc(v.trade || 'Vendor')}</div><h2>${esc(v.name)}</h2><div class="muted small">${esc(v.email || 'no email')} ${v.phone ? '· ' + esc(v.phone) : ''}</div></div><button class="iconbtn" data-close>${I('x')}</button></div></div>
    <div class="pb"><div class="sec" style="margin-top:0">Waiver requests (${v.orders.length})</div>
      <div class="entrylist">${v.orders.map(o => `<div style="cursor:pointer" data-o="${o.id}"><span><b>${esc(o.file_no)}</b> <span class="muted">· ${esc(o.waiver_type)} ${esc(o.payment_stage)} · ${fmtD(o.request_date)}</span></span>${pill(o.status)}</div>`).join('') || '<div class="muted">No requests yet</div>'}</div>
      <div class="sec">SCR entries (${v.entries.length})</div>
      <div class="entrylist">${v.entries.map(e => `<div><span><b class="mono">${esc(e.entry)}</b> <span class="muted">· ${esc(e.file_no)} · filed ${fmtD(e.filed, true)}</span></span><span class="muted">${e.n_parcels} parcels</span></div>`).join('')}</div>
      <div class="sec">Email change history</div>
      <div class="timeline">${v.history.map(h => `<div class="tl"><b>${esc(h.detail)}</b><div class="t">${fmtD(h.at.slice(0, 10), true)} · ${esc(h.actor || '')}</div></div>`).join('') || '<div class="muted">No changes recorded</div>'}</div>
    </div><div class="pf"><a class="btn" href="#/new?vendors=${v.id}">${I('plus')}New request for this vendor</a><button class="btn" data-close>Close</button></div>`);
  $$('[data-o]', $('#panel')).forEach(el => el.onclick = () => openOrder(el.dataset.o));
}

// ======================= SETTINGS =======================
ROUTES.settings = async () => {
  setTitle('Settings', 'Workspace configuration');
  const s = S.meta.settings;
  view.innerHTML = `<div class="grid g11">
    <div class="card"><div class="hd"><h3>Workspace</h3></div><div class="bd">
      <div class="field"><label>Company name (shown on coversheets & emails)</label><input class="input" id="sCo" value="${esc(s.company)}"></div>
      <div class="field"><label>Default return window (business days)</label><input class="input" id="sSla" type="number" min="1" max="60" value="${s.sla_days}"><span class="hint">Sets the “Return by” date on new requests.</span></div>
      <button class="btn primary" id="sSave">Save settings</button></div></div>
    <div class="card"><div class="hd"><h3>Demo data</h3>${s.demo ? '<span class="chip amber">Loaded</span>' : '<span class="chip">Off</span>'}</div><div class="bd">
      <p style="margin-top:0;line-height:1.55">The <b>Cormont</b> vendors and SCR entries are the real registry scrub. Request statuses, activity history, and the two files marked <span class="tag sample">sample</span> are generated so every screen has something to show.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" id="sReset">${I('refresh')}Reset demo data</button><button class="btn danger" id="sReal">Keep real Cormont data only</button></div>
      <p class="hint">Reset before each demo to start from the same clean state.</p></div></div>
    <div class="card"><div class="hd"><h3>Connections</h3></div><div class="bd">
      <div class="entrylist"><div><span><b>Utah State Construction Registry</b><div class="muted small">Vendors & SCR entries from registry scrub</div></span><span class="chip green">Imported</span></div>
        <div><span><b>Email delivery</b><div class="muted small">Needs SendGrid or Microsoft 365 to deliver mail</div></span><span class="chip amber">Simulated</span></div>
        <div><span><b>E-signature</b><div class="muted small">DocuSign envelope per packet (optional)</div></span><span class="chip">Not connected</span></div>
        <div><span><b>Database</b><div class="muted small">SQLite on this server</div></span><span class="chip green">Active</span></div></div></div></div>
    <div class="card"><div class="hd"><h3>Team</h3><span class="sub">Requestors</span></div><div class="bd"><div class="entrylist">${S.meta.requestors.map(r => `<div><span class="who">${av(r.name)}<b>${esc(r.name)}</b></span><span class="muted">${esc(r.email)}</span></div>`).join('')}</div></div></div>
  </div>`;
  $('#sSave').onclick = async () => { await api('/api/settings', { method: 'PATCH', body: { company: $('#sCo').value, sla_days: $('#sSla').value } }); await loadMeta(); toast('Settings saved'); };
  $('#sReset').onclick = async () => { if (!(await confirmBox('Reset demo data?', 'This rebuilds all requests and activity from scratch. Real Cormont vendors and SCR entries are kept.', 'Reset'))) return; await api('/api/demo/reset', { method: 'POST', body: { demo: true } }); await loadMeta(); S.project = ''; renderTop(); toast('Demo data reset'); location.hash = '#/dashboard'; };
  $('#sReal').onclick = async () => { if (!(await confirmBox('Remove demo data?', 'This deletes all generated requests, activity and the sample files. You keep the real Cormont vendors and SCR entries, with no requests yet.', 'Remove demo data', true))) return; await api('/api/demo/reset', { method: 'POST', body: { demo: false } }); await loadMeta(); S.project = ''; renderTop(); toast('Demo data removed'); location.hash = '#/dashboard'; };
};

// ======================= boot =======================
(async function boot() {
  S.me = store.get('me') || ''; S.project = store.get('project') || '';
  await loadMeta(); renderTop();
  if (!location.hash) location.hash = '#/dashboard'; else route();
})();
