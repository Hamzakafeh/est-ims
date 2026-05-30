// ── THEME ──
(function () {
  if (localStorage.getItem('est-theme') === 'light')
    document.documentElement.classList.add('light');
})();
function toggleTheme() {
  const l = document.documentElement.classList.toggle('light');
  localStorage.setItem('est-theme', l ? 'light' : 'dark');
  const lbl = document.getElementById('dockThemeLabel');
  if (lbl) lbl.textContent = l ? 'Dark Mode' : 'Light Mode';
}
(function () {
  const l = document.documentElement.classList.contains('light');
  const lbl = document.getElementById('dockThemeLabel');
  if (lbl) lbl.textContent = l ? 'Dark Mode' : 'Light Mode';
})();

// ── STATE ──
let _z1Files   = [];      // [{name, size_kb, modified}]
let _z1Active  = null;    // active filename
let _z1Sheet   = null;    // active sheet name
let _z1Sheets  = {};      // filename → [sheet names]
let _z1Offset  = 0;
const _z1Limit = 200;
let _z1Total   = 0;
let _z1SaveTimer = null;

function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── INIT ──
(async function z1Init() {
  try {
    const r = await fetch('/api/zone1/files');
    const d = await r.json();
    _z1Files = d.files || [];
    _z1Sheets = {};
    // Pre-load sheet names for all files
    await Promise.all(_z1Files.map(async f => {
      const sr = await fetch('/api/zone1/sheets?file=' + encodeURIComponent(f.name));
      const sd = await sr.json();
      _z1Sheets[f.name] = sd.sheets || [];
    }));
    z1RenderFileTabs();
    if (_z1Files.length > 0) {
      await z1ActivateFile(_z1Files[0].name);
    }
  } catch(e) {
    console.error('Zone1 init error:', e);
  }
})();

// ── FILE TABS ──
function z1RenderFileTabs() {
  const bar = document.getElementById('z1FileTabs');
  const importBtn = `
    <button class="btn-import" onclick="document.getElementById('z1FileInput').click()">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
      Import Excel
    </button>`;
  const tabs = _z1Files.map(f => `
    <div class="z1-file-tab ${f.name === _z1Active ? 'active' : ''}"
         onclick="z1ActivateFile(${JSON.stringify(f.name)})">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      ${esc(f.name)}
      <span class="z1-file-tab-close" onclick="event.stopPropagation();z1DeleteFile(${JSON.stringify(f.name)})">✕</span>
    </div>`).join('');
  bar.innerHTML = importBtn + tabs;
}

async function z1ActivateFile(name) {
  _z1Active = name;
  _z1Offset = 0;
  z1RenderFileTabs();
  // Sheets
  let sheets = _z1Sheets[name];
  if (!sheets) {
    const r = await fetch('/api/zone1/sheets?file=' + encodeURIComponent(name));
    const d = await r.json();
    sheets = d.sheets || [];
    _z1Sheets[name] = sheets;
  }
  _z1Sheet = sheets[0] || null;
  z1RenderSheetTabs(sheets);
  await z1LoadData();
}

// ── SHEET TABS ──
function z1RenderSheetTabs(sheets) {
  const bar = document.getElementById('z1SheetTabs');
  if (!sheets || sheets.length === 0) { bar.style.display = 'none'; return; }
  bar.style.display = 'flex';
  bar.innerHTML = sheets.map(s => `
    <button class="z1-sheet-tab ${s === _z1Sheet ? 'active' : ''}"
            onclick="z1ActivateSheet(${JSON.stringify(s)})">
      ${esc(s)}
    </button>`).join('');
}

async function z1ActivateSheet(name) {
  _z1Sheet = name;
  _z1Offset = 0;
  z1RenderSheetTabs(_z1Sheets[_z1Active] || []);
  await z1LoadData();
}

// ── DATA LOAD ──
async function z1LoadData() {
  if (!_z1Active || !_z1Sheet) return;
  const content = document.getElementById('z1Content');
  content.innerHTML = `<div class="z1-empty"><div class="z1-spinner"></div></div>`;
  try {
    const url = `/api/zone1/data?file=${encodeURIComponent(_z1Active)}&sheet=${encodeURIComponent(_z1Sheet)}&offset=${_z1Offset}&limit=${_z1Limit}`;
    const r = await fetch(url);
    const d = await r.json();
    if (d.error) { content.innerHTML = `<div class="z1-empty">⚠ ${esc(d.error)}</div>`; return; }
    _z1Total = d.total;
    z1RenderTable(d.headers, d.rows, d.offset);
  } catch(e) {
    content.innerHTML = `<div class="z1-empty">⚠ Failed to load data</div>`;
  }
}

// ── TABLE RENDER ──
function z1RenderTable(headers, rows, offset) {
  const content = document.getElementById('z1Content');
  if (!headers.length && !rows.length) {
    content.innerHTML = `<div class="z1-table-wrap"><div class="z1-empty">This sheet is empty.</div></div>`;
    return;
  }

  const thead = `<tr>
    <th class="z1-row-num">#</th>
    ${headers.map((h, i) => `<th title="Column ${i+1}">${esc(h)}</th>`).join('')}
  </tr>`;

  const tbody = rows.map((row, ri) => {
    const absRow = offset + ri;
    const tds = row.map((cell, ci) => `
      <td data-row="${absRow}" data-col="${ci}" ondblclick="z1StartEdit(this)"
          title="${esc(cell)}">${esc(cell)}</td>`).join('');
    return `<tr><td class="z1-row-num">${absRow + 1}</td>${tds}</tr>`;
  }).join('');

  const pageStart = offset + 1;
  const pageEnd   = Math.min(offset + rows.length, _z1Total);
  const hasPrev   = offset > 0;
  const hasNext   = offset + _z1Limit < _z1Total;

  content.innerHTML = `
    <div class="z1-table-wrap">
      <div class="z1-meta">
        <span>Showing <strong>${pageStart}–${pageEnd}</strong> of <strong>${_z1Total}</strong> rows · <strong>${headers.length}</strong> columns</span>
        <span style="font-size:11px;color:var(--dim)">Double-click a cell to edit</span>
      </div>
      <table class="z1-table">
        <thead>${thead}</thead>
        <tbody id="z1Tbody">${tbody}</tbody>
      </table>
      <div class="z1-pager">
        <button onclick="z1Prev()" ${hasPrev ? '' : 'disabled'}>← Prev</button>
        <span class="z1-pager-info">Page ${Math.floor(offset/_z1Limit)+1} / ${Math.max(1,Math.ceil(_z1Total/_z1Limit))}</span>
        <button onclick="z1Next()" ${hasNext ? '' : 'disabled'}>Next →</button>
      </div>
    </div>`;
}

// ── PAGINATION ──
function z1Prev() { if (_z1Offset > 0) { _z1Offset = Math.max(0, _z1Offset - _z1Limit); z1LoadData(); } }
function z1Next() { if (_z1Offset + _z1Limit < _z1Total) { _z1Offset += _z1Limit; z1LoadData(); } }

// ── INLINE EDIT ──
function z1StartEdit(td) {
  if (td.classList.contains('editing')) return;
  const prev = td.textContent;
  td.classList.add('editing');
  const inp = document.createElement('input');
  inp.type  = 'text';
  inp.value = prev;
  td.textContent = '';
  td.appendChild(inp);
  inp.focus();
  inp.select();
  inp.onblur  = () => z1CommitEdit(td, inp, prev);
  inp.onkeydown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); inp.blur(); }
    if (e.key === 'Escape') { inp.value = prev; inp.blur(); }
    if (e.key === 'Tab') {
      e.preventDefault();
      inp.blur();
      // Move to next cell
      const nextTd = td.nextElementSibling;
      if (nextTd && nextTd.dataset.col !== undefined) z1StartEdit(nextTd);
    }
  };
}

async function z1CommitEdit(td, inp, prev) {
  const newVal = inp.value;
  td.classList.remove('editing');
  td.textContent = newVal;
  if (newVal === prev) return;
  const row = parseInt(td.dataset.row);
  const col = parseInt(td.dataset.col);
  try {
    const r = await fetch('/api/zone1/edit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file: _z1Active, sheet: _z1Sheet, row, col, value: newVal }),
    });
    const d = await r.json();
    if (!d.success) { td.textContent = prev; z1Toast('⚠ ' + (d.message || 'Save failed'), true); }
    else z1Toast('✓ Saved');
  } catch(e) {
    td.textContent = prev;
    z1Toast('⚠ Connection error', true);
  }
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
    const r = await fetch('/api/zone1/import', { method: 'POST', body: fd });
    const d = await r.json();
    if (!d.success) { z1Toast('⚠ ' + (d.message || 'Import failed'), true); return; }
    // Add to list if new
    if (!_z1Files.find(f => f.name === d.name)) {
      _z1Files.push({ name: d.name, size_kb: '—', modified: 'just now' });
    }
    _z1Sheets[d.name] = d.sheets || [];
    z1RenderFileTabs();
    await z1ActivateFile(d.name);
    z1Toast('✓ Imported: ' + d.name);
  } catch(e) {
    z1Toast('⚠ Upload failed', true);
  }
}

// ── DELETE FILE ──
async function z1DeleteFile(name) {
  if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
  try {
    await fetch('/api/zone1/file/' + encodeURIComponent(name), { method: 'DELETE' });
    _z1Files = _z1Files.filter(f => f.name !== name);
    delete _z1Sheets[name];
    if (_z1Active === name) {
      _z1Active = _z1Files[0]?.name || null;
      _z1Sheet  = null;
    }
    z1RenderFileTabs();
    if (_z1Active) await z1ActivateFile(_z1Active);
    else {
      document.getElementById('z1SheetTabs').style.display = 'none';
      document.getElementById('z1Content').innerHTML = `
        <div class="z1-welcome">
          <div class="z1-welcome-icon">📊</div>
          <div class="z1-welcome-title">No files yet</div>
          <div class="z1-welcome-sub">Click Import Excel to upload a file.</div>
        </div>`;
    }
    z1Toast('Deleted');
  } catch(e) {
    z1Toast('⚠ Delete failed', true);
  }
}

// ── TOAST ──
function z1Toast(msg, isErr = false) {
  const el = document.getElementById('z1SaveToast');
  if (!el) return;
  el.textContent = msg;
  el.style.color = isErr ? 'var(--red)' : 'var(--green)';
  el.style.borderColor = isErr ? 'var(--red)' : 'var(--green)';
  el.classList.add('show');
  clearTimeout(_z1SaveTimer);
  _z1SaveTimer = setTimeout(() => el.classList.remove('show'), 2200);
}
