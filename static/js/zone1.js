// ── THEME ──
(function () {
  if (localStorage.getItem('est-theme') === 'light')
    document.documentElement.classList.add('light');
  const l   = document.documentElement.classList.contains('light');
  const lbl = document.getElementById('dockThemeLabel');
  if (lbl) lbl.textContent = l ? 'Dark Mode' : 'Light Mode';
})();
function toggleTheme() {
  const l = document.documentElement.classList.toggle('light');
  localStorage.setItem('est-theme', l ? 'light' : 'dark');
  const lbl = document.getElementById('dockThemeLabel');
  if (lbl) lbl.textContent = l ? 'Dark Mode' : 'Light Mode';
}

// ── STATE ──
let _files  = [];
let _active = null;   // index into _files
let _sheet  = null;
let _sheets = {};
let _saveTimer = null;

function esc(s)  { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function attr(s) { return esc(s).replace(/'/g,'&#39;'); }

// ── INIT ──
(async function z1Init() {
  try {
    const r = await fetch('/api/zone1/files');
    const d = await r.json();
    _files  = d.files || [];
    _sheets = {};
    await Promise.all(_files.map(async f => {
      try {
        const sr = await fetch('/api/zone1/sheets?file=' + encodeURIComponent(f.name));
        const sd = await sr.json();
        _sheets[f.name] = sd.sheets || [];
      } catch(e) { _sheets[f.name] = []; }
    }));
    renderFileTabs();
    if (_files.length > 0) await activateFile(0);
  } catch(e) { console.error('Zone1 init:', e); }
})();

// ── TOPBAR ACTION BUTTONS ──
function renderTbActions() {
  const el = document.getElementById('z1TbActions');
  if (!el) return;
  const hasFile = _active !== null && _files[_active];
  if (!hasFile) { el.innerHTML = ''; return; }
  el.innerHTML = `
    <button class="z1-tb-btn green" onclick="z1Save()" title="Save — all edits auto-save. Click to confirm.">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
      Save
    </button>
    <button class="z1-tb-btn" onclick="z1Print()" title="Print current sheet">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
      Print
    </button>
    <button class="z1-tb-btn amber" onclick="z1Export()" title="Download Excel file">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      Export
    </button>`;
}

// ── FILE TABS ──
function renderFileTabs() {
  const bar = document.getElementById('z1FileTabs');
  const importBtn = `
    <button class="btn-import" onclick="document.getElementById('z1FileInput').click()">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
      Import
    </button>
    <button class="btn-new-file" onclick="openNewFileModal()">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      New File
    </button>`;
  const tabs = _files.map((f, idx) => {
    const isActive = _active === idx;
    return `<div class="z1-file-tab ${isActive ? 'active' : ''}" data-idx="${idx}" role="button" tabindex="0">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      <span class="z1-tab-name">${esc(f.name)}</span>
      <span class="z1-file-tab-close" data-close-idx="${idx}" title="Close">✕</span>
    </div>`;
  }).join('');
  bar.innerHTML = importBtn + tabs;

  bar.querySelectorAll('.z1-file-tab').forEach(tab => {
    tab.addEventListener('click', async (e) => {
      if (e.target.closest('.z1-file-tab-close')) return;
      const idx = parseInt(tab.dataset.idx);
      if (!isNaN(idx)) await activateFile(idx);
    });
  });
  bar.querySelectorAll('.z1-file-tab-close').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.closeIdx);
      if (!isNaN(idx)) await deleteFile(idx);
    });
  });
  renderTbActions();
}

async function activateFile(idx) {
  if (idx < 0 || idx >= _files.length) return;
  _active = idx;
  renderFileTabs();
  const fname = _files[idx].name;
  let sheets = _sheets[fname];
  if (!sheets) {
    const r = await fetch('/api/zone1/sheets?file=' + encodeURIComponent(fname));
    const d = await r.json();
    sheets = d.sheets || [];
    _sheets[fname] = sheets;
  }
  _sheet = sheets[0] || null;
  renderSheetTabs(sheets);
  await loadData();
}

// ── SHEET TABS ──
function renderSheetTabs(sheets) {
  const bar = document.getElementById('z1SheetTabs');
  if (!sheets || sheets.length === 0) { bar.style.display = 'none'; return; }
  bar.style.display = 'flex';
  bar.innerHTML = sheets.map((s, i) =>
    `<button class="z1-sheet-tab ${s === _sheet ? 'active' : ''}" data-sheet-idx="${i}">${esc(s)}</button>`
  ).join('');
  bar.querySelectorAll('.z1-sheet-tab').forEach(btn => {
    btn.addEventListener('click', async () => {
      const fname  = _files[_active]?.name;
      const sheets = _sheets[fname] || [];
      const idx    = parseInt(btn.dataset.sheetIdx);
      if (isNaN(idx)) return;
      _sheet = sheets[idx];
      renderSheetTabs(sheets);
      await loadData();
    });
  });
}

// ── DATA LOAD ──
async function loadData() {
  const fname = _files[_active]?.name;
  if (!fname || !_sheet) return;
  const content = document.getElementById('z1Content');
  content.innerHTML = `<div class="z1-empty" style="padding:60px 0;"><div class="z1-spinner"></div><div style="margin-top:14px;color:var(--muted);font-size:13px;">Reading Excel…</div></div>`;
  try {
    const url = `/api/zone1/data?file=${encodeURIComponent(fname)}&sheet=${encodeURIComponent(_sheet)}`;
    const r   = await fetch(url);
    const d   = await r.json();
    if (d.error) { content.innerHTML = `<div class="z1-empty">⚠ ${esc(d.error)}</div>`; return; }
    renderTable(d);
  } catch(e) {
    content.innerHTML = `<div class="z1-empty">⚠ Failed to load: ${esc(String(e))}</div>`;
  }
}

// ── TABLE RENDER ──
function renderTable(d) {
  const content   = document.getElementById('z1Content');
  const rows      = d.rows || [];
  if (!rows.length) {
    content.innerHTML = `<div class="z1-table-wrap"><div class="z1-empty">This sheet is empty.</div></div>`;
    return;
  }
  const colWidths  = d.col_widths  || [];
  const rowHeights = d.row_heights || [];

  const colgroup = `<colgroup>
    <col style="width:42px;min-width:42px;">
    ${colWidths.map(w => `<col style="width:${w}px;min-width:${Math.max(36,w)}px;">`).join('')}
  </colgroup>`;

  let tbodyHtml = '';
  rows.forEach((row, rIdx) => {
    const rh = rowHeights[rIdx] ? `height:${rowHeights[rIdx]}px;` : '';
    tbodyHtml += `<tr style="${rh}"><td class="z1-row-num">${rIdx + 1}</td>`;
    row.forEach((cell, cIdx) => {
      if (cell === null) return;
      const v = cell.v ?? '';
      let style = '';
      if (cell.bg)   style += `background:${cell.bg};`;
      if (cell.c)    style += `color:${cell.c};`;
      if (cell.b)    style += 'font-weight:700;';
      if (cell.i)    style += 'font-style:italic;';
      if (cell.sz)   style += `font-size:${cell.sz}pt;`;
      if (cell.al)   style += `text-align:${cell.al};`;
      if (cell.vl)   style += `vertical-align:${cell.vl};`;
      if (cell.wrap) style += 'white-space:pre-wrap;word-break:break-word;';
      const rs = cell.rs ? ` rowspan="${cell.rs}"` : '';
      const cs = cell.cs ? ` colspan="${cell.cs}"` : '';
      tbodyHtml += `<td${rs}${cs} data-row="${rIdx}" data-col="${cIdx}"
        style="${style}" title="${attr(String(v))}"
        ondblclick="startEdit(this)">${esc(String(v))}</td>`;
    });
    tbodyHtml += '</tr>';
  });

  const fname = _files[_active]?.name || '';
  content.innerHTML = `
    <div class="z1-table-wrap">
      <div class="z1-meta">
        <span><strong>${rows.length}</strong> rows · <strong>${colWidths.length}</strong> cols
        · <em style="color:var(--dim)">${esc(fname)} / ${esc(_sheet || '')}</em></span>
        <span style="font-size:11px;color:var(--dim)">Double-click to edit</span>
      </div>
      <div style="overflow:auto;max-height:calc(100vh - 200px);">
        <table class="z1-table">${colgroup}<tbody id="z1Tbody">${tbodyHtml}</tbody></table>
      </div>
    </div>`;
}

// ── INLINE EDIT ──
function startEdit(td) {
  if (td.classList.contains('editing')) return;
  const prev = td.textContent;
  td.classList.add('editing');
  const inp = document.createElement('input');
  inp.type  = 'text';
  inp.value = prev;
  const bg  = td.style.background || td.style.backgroundColor;
  if (bg) inp.style.background = bg;
  td.textContent = '';
  td.appendChild(inp);
  inp.focus(); inp.select();

  const commit = () => commitEdit(td, inp, prev);
  inp.addEventListener('blur', commit);
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); inp.removeEventListener('blur', commit); commitEdit(td, inp, prev); }
    if (e.key === 'Escape') { inp.value = prev; inp.removeEventListener('blur', commit); td.classList.remove('editing'); td.textContent = prev; }
    if (e.key === 'Tab')    { e.preventDefault(); inp.removeEventListener('blur', commit); commitEdit(td, inp, prev); const next = td.nextElementSibling; if (next && next.dataset.col !== undefined) startEdit(next); }
  });
}

async function commitEdit(td, inp, prev) {
  const newVal = inp.value;
  td.classList.remove('editing');
  td.textContent = newVal;
  if (newVal === prev) return;
  const row   = parseInt(td.dataset.row);
  const col   = parseInt(td.dataset.col);
  const fname = _files[_active]?.name;
  try {
    const r = await fetch('/api/zone1/edit', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({file: fname, sheet: _sheet, row, col, value: newVal}),
    });
    const d = await r.json();
    if (!d.success) { td.textContent = prev; z1Toast('⚠ ' + (d.message || 'Save failed'), true); }
    else z1Toast('✓ Saved');
  } catch(e) { td.textContent = prev; z1Toast('⚠ Connection error', true); }
}

// ── TOPBAR ACTIONS ──

function z1Save() {
  // All edits auto-save per cell. This button gives visual confirmation.
  z1Toast('✓ All changes saved to ' + (_files[_active]?.name || 'file'));
}

function z1Print() {
  const wrap = document.querySelector('.z1-table-wrap');
  if (!wrap) { z1Toast('⚠ No data to print', true); return; }
  const fname = _files[_active]?.name || 'Sheet';
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head>
    <title>${fname} — Zone 1</title>
    <style>
      body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; margin: 20px; }
      h2 { font-size: 13pt; margin: 0 0 10px; }
      table { border-collapse: collapse; width: 100%; }
      td, th { border: 1px solid #aaa; padding: 3px 7px; }
      tr:nth-child(even) { background: #f5f5f5; }
      .z1-row-num { background: #e8edf5 !important; color: #888; font-size: 9pt; text-align: center; min-width: 30px; }
      @media print { button, .z1-meta { display:none; } }
    </style></head>
    <body>
      <h2>${fname} — ${_sheet || ''}</h2>
      ${wrap.querySelector('table')?.outerHTML || ''}
    </body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}

function z1Export() {
  const fname = _files[_active]?.name;
  if (!fname) { z1Toast('⚠ No file selected', true); return; }
  window.location.href = '/api/zone1/download/' + encodeURIComponent(fname);
  z1Toast('⬇ Downloading ' + fname);
}

// ── IMPORT ──
async function z1ImportFile(input) {
  const file = input.files[0];
  if (!file) return;
  input.value = '';
  const fd = new FormData();
  fd.append('file', file);
  z1Toast('Uploading…');
  try {
    const r = await fetch('/api/zone1/import', {method: 'POST', body: fd});
    const d = await r.json();
    if (!d.success) { z1Toast('⚠ ' + (d.message || 'Import failed'), true); return; }
    let idx = _files.findIndex(f => f.name === d.name);
    if (idx === -1) { _files.push({name: d.name, size_kb: '—', modified: 'just now'}); idx = _files.length - 1; }
    _sheets[d.name] = d.sheets || [];
    await activateFile(idx);
    z1Toast('✓ Imported: ' + d.name);
  } catch(e) { z1Toast('⚠ Upload failed', true); }
}

// ── CREATE NEW FILE ──
function openNewFileModal() {
  document.getElementById('z1NewFileModal').classList.add('open');
  document.getElementById('z1NfName').focus();
}
function closeNewFileModal() {
  document.getElementById('z1NewFileModal').classList.remove('open');
  document.getElementById('z1NfName').value    = '';
  document.getElementById('z1NfSheet').value   = '';
  document.getElementById('z1NfHeaders').value = '';
}

async function z1CreateFile() {
  const nameVal    = document.getElementById('z1NfName').value.trim();
  const sheetVal   = document.getElementById('z1NfSheet').value.trim() || 'Sheet1';
  const headersRaw = document.getElementById('z1NfHeaders').value.trim();
  if (!nameVal) { document.getElementById('z1NfName').focus(); return; }
  const headers = headersRaw ? headersRaw.split(',').map(h => h.trim()).filter(Boolean) : [];
  closeNewFileModal();
  z1Toast('Creating file…');
  try {
    const r = await fetch('/api/zone1/create', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({name: nameVal, sheet: sheetVal, headers}),
    });
    const d = await r.json();
    if (!d.success) { z1Toast('⚠ ' + (d.message || 'Failed'), true); return; }
    let idx = _files.findIndex(f => f.name === d.name);
    if (idx === -1) { _files.push({name: d.name, size_kb: '—', modified: 'just now'}); idx = _files.length - 1; }
    _sheets[d.name] = d.sheets || [];
    await activateFile(idx);
    z1Toast('✓ Created: ' + d.name);
  } catch(e) { z1Toast('⚠ Error: ' + e, true); }
}

// ── DELETE ──
async function deleteFile(idx) {
  if (idx < 0 || idx >= _files.length) return;
  const name = _files[idx].name;
  if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
  try {
    await fetch('/api/zone1/file/' + encodeURIComponent(name), {method: 'DELETE'});
    _files.splice(idx, 1);
    delete _sheets[name];
    const newActive = _files.length > 0 ? Math.max(0, idx - 1) : null;
    _active = newActive;
    _sheet  = null;
    renderFileTabs();
    if (newActive !== null) { await activateFile(newActive); }
    else {
      document.getElementById('z1SheetTabs').style.display = 'none';
      document.getElementById('z1Content').innerHTML = `
        <div class="z1-welcome">
          <div class="z1-welcome-icon">📊</div>
          <div class="z1-welcome-title">No files yet</div>
          <div class="z1-welcome-sub">Click <strong>Import</strong> or <strong>New File</strong>.</div>
        </div>`;
    }
    z1Toast('Deleted');
  } catch(e) { z1Toast('⚠ Delete failed', true); }
}

// ── TOAST ──
function z1Toast(msg, isErr = false) {
  const el = document.getElementById('z1SaveToast');
  if (!el) return;
  el.textContent   = msg;
  el.style.color       = isErr ? 'var(--red,#ef4444)' : 'var(--green,#10b981)';
  el.style.borderColor = isErr ? 'var(--red,#ef4444)' : 'var(--green,#10b981)';
  el.style.border      = '1px solid';
  el.classList.add('show');
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => el.classList.remove('show'), 2500);
}
