const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const api = (u, o) => fetch(u, o).then(r => r.json());
const STATUSES = ['New','Requested','Reminder Sent','Signed','Recorded','On Hold','Cancelled'];
const sClass = s => 's-' + (s || '').replace(/\s+/g, '');
let VENDORS = [], PROJECT = null;

// ---------- nav ----------
$$('.tab').forEach(t => t.onclick = () => {
  $$('.tab').forEach(x => x.classList.remove('active'));
  $$('.view').forEach(x => x.classList.remove('active'));
  t.classList.add('active'); $('#' + t.dataset.view).classList.add('active');
  if (t.dataset.view === 'reports') loadReports();
  if (t.dataset.view === 'templates') loadTemplates();
});

// ---------- init ----------
async function init() {
  const projects = await api('/api/projects'); PROJECT = projects[0];
  if (PROJECT) $('#projline').textContent = `${PROJECT.name} · File ${PROJECT.file_no} · ${PROJECT.county} County`;
  VENDORS = await api('/api/vendors?project_id=' + (PROJECT ? PROJECT.id : 1));
  const vsel = $('#nVendor'); vsel.innerHTML = '<option value="">— select vendor —</option>' +
    VENDORS.map(v => `<option value="${v.id}">${v.name} — ${v.trade || ''} (${v.n_entries} entr.)</option>`).join('');
  const stsel = $('#fStatus'); stsel.innerHTML = '<option value="">All statuses</option>' + STATUSES.map(s => `<option>${s}</option>`).join('');
  loadOrders();
}
$('#nVendor').onchange = e => {
  const v = VENDORS.find(x => x.id == e.target.value); if (!v) return;
  $('#nEmail').value = v.email || ''; $('#nEntries').value = v.scr_entries || '';
};

// ---------- dashboard ----------
async function loadOrders() {
  const p = new URLSearchParams();
  if ($('#search').value) p.set('q', $('#search').value);
  if ($('#fStatus').value) p.set('status', $('#fStatus').value);
  if ($('#fFile').value) p.set('file_no', $('#fFile').value);
  if ($('#fReq').value) p.set('requestor', $('#fReq').value);
  const orders = await api('/api/orders?' + p.toString());
  renderKpis(orders);
  const tb = $('#ordersBody'); tb.innerHTML = '';
  $('#ordersEmpty').classList.toggle('hidden', orders.length > 0);
  const today = new Date().toISOString().slice(0, 10);
  for (const o of orders) {
    const over = o.due_date && o.due_date < today && !['Signed','Recorded','Cancelled'].includes(o.status);
    const soon = o.due_date && !over && daysBetween(today, o.due_date) <= 3 && !['Signed','Recorded','Cancelled'].includes(o.status);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><b>${esc(o.vendor_name)}</b></td><td>${esc(o.trade || '')}</td><td>${esc(o.file_no || '')}</td>
      <td class="mono">${esc(o.scr_entries || '')}</td><td>${o.waiver_type || ''}<br><small>${o.payment_stage || ''}</small></td>
      <td>${esc(o.requestor || '')}</td><td>${o.request_date || ''}</td>
      <td class="${over?'due-over':soon?'due-soon':''}">${o.due_date || ''}${over?' ⚠':''}</td>
      <td><span class="pill ${sClass(o.status)}">${o.status}</span></td>
      <td style="text-align:center">${o.sent_count || 0}</td>
      <td><div class="rowact">
        <button class="mini" data-act="open" data-id="${o.id}">Open</button>
        <button class="mini" data-act="resend" data-id="${o.id}">Resend</button>
        <a class="mini btnlink" href="/api/orders/${o.id}/doc?kind=packet" target="_blank">Print</a>
      </div></td>`;
    tb.appendChild(tr);
  }
  tb.querySelectorAll('[data-act]').forEach(b => b.onclick = () => {
    if (b.dataset.act === 'open') openDrawer(b.dataset.id);
    if (b.dataset.act === 'resend') resend(b.dataset.id);
  });
}
function renderKpis(orders) {
  const today = new Date().toISOString().slice(0, 10);
  const c = s => orders.filter(o => o.status === s).length;
  const overdue = orders.filter(o => o.due_date && o.due_date < today && !['Signed','Recorded','Cancelled'].includes(o.status)).length;
  const open = orders.filter(o => !['Signed','Recorded','Cancelled'].includes(o.status)).length;
  $('#kpis').innerHTML = [
    ['Total orders', orders.length, ''],
    ['Open', open, 'warn'],
    ['Overdue', overdue, overdue ? 'bad' : 'good'],
    ['Signed', c('Signed') + c('Recorded'), 'good'],
    ['New', c('New'), ''],
  ].map(([l, n, k]) => `<div class="kpi ${k}"><div class="num">${n}</div><div class="lbl">${l}</div></div>`).join('');
}
['search','fFile','fReq'].forEach(id => $('#' + id).oninput = debounce(loadOrders, 250));
$('#fStatus').onchange = loadOrders;
$('#btnClear').onclick = () => { $('#search').value = $('#fFile').value = $('#fReq').value = ''; $('#fStatus').value = ''; loadOrders(); };

async function resend(id) {
  await api('/api/orders/' + id + '/resend', { method: 'POST' });
  loadOrders();
}

// ---------- drawer (order detail/edit) ----------
async function openDrawer(id) {
  const o = (await api('/api/orders?')).find(x => x.id == id) || await api('/api/orders/' + id);
  const ord = o.id ? o : await fetch('/api/orders').then(r=>r.json()).then(a=>a.find(x=>x.id==id));
  const d = ord;
  $('#drawer').classList.remove('hidden');
  $('#drawerInner').innerHTML = `
    <h3>${esc(d.vendor_name)} <button class="x" id="closeDrawer">✕</button></h3>
    <div class="kv">
      <div class="k">File #</div><div>${esc(d.file_no||'')}</div>
      <div class="k">SCR entries</div><div class="mono">${esc(d.scr_entries||'')}</div>
      <div class="k">Trade</div><div>${esc(d.trade||'')}</div>
      <div class="k">Requested</div><div>${d.request_date||''} by ${esc(d.requestor||'')}</div>
      <div class="k">Sent</div><div>${d.sent_count||0}× ${d.last_sent?('(last '+d.last_sent+')'):''}</div>
    </div>
    <label>Status</label><select id="dStatus">${STATUSES.map(s=>`<option ${s===d.status?'selected':''}>${s}</option>`).join('')}</select>
    <label>Waiver type</label><select id="dType"><option ${d.waiver_type==='Conditional'?'selected':''}>Conditional</option><option ${d.waiver_type==='Unconditional'?'selected':''}>Unconditional</option></select>
    <label>Payment stage</label><select id="dStage"><option ${d.payment_stage==='Progress'?'selected':''}>Progress</option><option ${d.payment_stage==='Final'?'selected':''}>Final</option></select>
    <label>Vendor email</label><input id="dEmail" value="${esc(d.email||'')}">
    <label>Due date</label><input id="dDue" type="date" value="${d.due_date||''}">
    <label>Amount owing</label><input id="dAmount" value="${esc(d.amount||'')}">
    <label>Notes</label><textarea id="dNotes" rows="3">${esc(d.notes||'')}</textarea>
    <div class="actions" style="margin-top:14px">
      <button class="primary" id="dSave">Save</button>
      <a class="ghost btnlink" href="/api/orders/${d.id}/doc?kind=packet" target="_blank">Print packet</a>
      <a class="ghost btnlink" href="/api/orders/${d.id}/doc?kind=cover" target="_blank">Coversheet</a>
    </div>
    <div class="actions" style="margin-top:8px">
      <button class="mini" id="dResend">Resend</button>
      <button class="mini" id="dCancel" style="color:#c0392b">Cancel order</button>
    </div>`;
  $('#closeDrawer').onclick = () => $('#drawer').classList.add('hidden');
  $('#dSave').onclick = async () => {
    await api('/api/orders/' + d.id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: $('#dStatus').value, waiver_type: $('#dType').value, payment_stage: $('#dStage').value,
        email: $('#dEmail').value, due_date: $('#dDue').value, amount: $('#dAmount').value, notes: $('#dNotes').value }) });
    $('#drawer').classList.add('hidden'); loadOrders();
  };
  $('#dResend').onclick = async () => { await resend(d.id); $('#drawer').classList.add('hidden'); };
  $('#dCancel').onclick = async () => { await fetch('/api/orders/' + d.id, { method: 'DELETE' }); $('#drawer').classList.add('hidden'); loadOrders(); };
}
$('#drawer').onclick = e => { if (e.target.id === 'drawer') $('#drawer').classList.add('hidden'); };

// ---------- new request ----------
$('#newForm').onsubmit = async e => {
  e.preventDefault();
  const v = VENDORS.find(x => x.id == $('#nVendor').value);
  if (!v) { flash('#newMsg', 'Pick a vendor', true); return; }
  const body = { project_id: PROJECT.id, vendor_id: v.id, vendor_name: v.name, trade: v.trade,
    file_no: $('#nFile').value, requestor: $('#nReq').value, waiver_type: $('#nType').value,
    payment_stage: $('#nStage').value, amount: $('#nAmount').value, due_date: $('#nDue').value,
    email: $('#nEmail').value, scr_entries: $('#nEntries').value, notes: $('#nNotes').value };
  await api('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  flash('#newMsg', '✓ Request created'); e.target.reset();
  loadOrders();
};

// ---------- templates ----------
async function loadTemplates() {
  const ts = await api('/api/templates');
  $('#tmplList').innerHTML = ts.map(t => `
    <div class="tmpl" data-id="${t.id}">
      <header><div><b>${t.title}</b> <span class="badge">${t.kind}${t.stage?(' · '+t.stage):''}</span></div><button class="mini">Edit ▾</button></header>
      <div class="body hidden">
        <label style="font-size:12px;color:#6b7686">Title</label>
        <input class="ttitle" value="${esc(t.title)}" style="width:100%;padding:8px;border:1px solid #e3e8f0;border-radius:7px;margin:4px 0 8px">
        <textarea class="tbody">${esc(t.body)}</textarea>
        <div class="actions"><button class="primary tsave">Save template</button><span class="msg tmsg"></span></div>
      </div>
    </div>`).join('');
  $$('#tmplList .tmpl').forEach(card => {
    card.querySelector('header').onclick = () => card.querySelector('.body').classList.toggle('hidden');
    card.querySelector('.tsave').onclick = async () => {
      await api('/api/templates/' + card.dataset.id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: card.querySelector('.ttitle').value, body: card.querySelector('.tbody').value }) });
      card.querySelector('.tmsg').textContent = '✓ Saved'; setTimeout(() => card.querySelector('.tmsg').textContent = '', 1500);
    };
  });
}

// ---------- reports ----------
async function loadReports() {
  const s = await api('/api/reports/status');
  const max = Math.max(1, ...s.byStatus.map(r => r.n));
  $('#statusReport').innerHTML = `<div class="bars">` + s.byStatus.map(r =>
    `<div class="bar"><span class="pill ${sClass(r.status)}">${r.status}</span><div class="track"><div class="fill" style="width:${r.n/max*100}%"></div></div><span class="cnt">${r.n}</span></div>`
  ).join('') + `</div><p class="sub" style="margin-top:10px">${s.total} total · <b style="color:#c0392b">${s.overdue} overdue</b></p>`;
  const miss = await api('/api/reports/missing?project_id=' + (PROJECT ? PROJECT.id : 1));
  $('#missingReport').innerHTML = miss.length ? `<p><b>${miss.length}</b> vendors have no request yet:</p>` +
    '<ul>' + miss.slice(0, 50).map(v => `<li>${esc(v.name)} <small>(${v.n_entries} entr.)</small></li>`).join('') + '</ul>'
    : '<p class="msg">✓ Every vendor has an active request.</p>';
  runActivity();
}
async function runActivity() {
  const p = new URLSearchParams();
  if ($('#aFrom').value) p.set('from', $('#aFrom').value);
  if ($('#aTo').value) p.set('to', $('#aTo').value);
  if ($('#aFile').value) p.set('file_no', $('#aFile').value);
  if ($('#aReq').value) p.set('requestor', $('#aReq').value);
  const rows = await api('/api/reports/activity?' + p.toString());
  $('#actBody').innerHTML = rows.map(r =>
    `<tr><td>${(r.at||'').slice(0,16).replace('T',' ')}</td><td>${esc(r.action)}</td><td>${esc(r.vendor_name||'')}</td><td>${esc(r.file_no||'')}</td><td>${esc(r.requestor||'')}</td><td>${esc(r.detail||'')}</td></tr>`
  ).join('') || '<tr><td colspan="6" class="empty">No activity in range.</td></tr>';
  $('#aCsv').href = 'data:text/csv,' + encodeURIComponent('When,Action,Vendor,File #,Requestor,Detail\n' +
    rows.map(r => [r.at, r.action, r.vendor_name, r.file_no, r.requestor, r.detail].map(x => `"${(x||'').replace(/"/g,'""')}"`).join(',')).join('\n'));
  $('#aCsv').setAttribute('download', 'scr_activity.csv');
}
$('#aRun').onclick = runActivity;

// ---------- batch ----------
$('#bUpload').onclick = async () => {
  const f = $('#bFileInput').files[0];
  if (!f) { flash('#bMsg', 'Choose a CSV first', true); return; }
  const fd = new FormData(); fd.append('file', f);
  fd.append('file_no', $('#bFile').value); fd.append('requestor', $('#bReq').value);
  fd.append('waiver_type', $('#bType').value); fd.append('payment_stage', $('#bStage').value);
  const r = await fetch('/api/batch', { method: 'POST', body: fd }).then(r => r.json());
  flash('#bMsg', `✓ Created ${r.created} orders`); loadOrders();
};
$('#bAll').onclick = async () => {
  const r = await api('/api/batch/all-missing', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_no: $('#bFile').value, requestor: $('#bReq').value, waiver_type: $('#bType').value, payment_stage: $('#bStage').value }) });
  flash('#bMsg', `✓ Created ${r.created} orders for missing vendors`); loadOrders();
};

// ---------- utils ----------
function esc(s){return (s==null?'':''+s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function debounce(fn,ms){let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms);};}
function daysBetween(a,b){return Math.round((new Date(b)-new Date(a))/864e5);}
function flash(sel,msg,bad){const el=$(sel);el.textContent=msg;el.style.color=bad?'#c0392b':'#1e7e45';setTimeout(()=>el.textContent='',2500);}
init();
