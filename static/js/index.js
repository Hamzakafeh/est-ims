// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// ACCOUNT STATUS — Firebase real-time listener
// Detects delete/suspend actions by admin and force-logs out the user
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
(function _initAccountStatusListener() {
  const cfgEl = document.getElementById('index-fb-cfg');
  if (!cfgEl) return;
  let cfg;
  try { cfg = JSON.parse(cfgEl.textContent); } catch(e) { return; }
  if (!cfg.firebase_config || !cfg.firebase_config.databaseURL || !cfg.username) return;

  const _pageLoadTs = Date.now() / 1000; // compare against event timestamp

  try {
    const app = firebase.initializeApp(cfg.firebase_config, 'est-status');
    const db  = firebase.database(app);
    // Firebase keys cannot contain . # $ [ ] /
    const safeKey = cfg.username.replace(/[.#$[\]/]/g, '_');

    db.ref('user_status/' + safeKey).on('value', snap => {
      const val = snap.val();
      if (!val || !val.status) return;
      // Only react to events set AFTER the page loaded (ignore stale flags)
      if (val.ts && val.ts <= _pageLoadTs) return;
      if (val.status === 'deleted' || val.status === 'suspended') {
        _showForceLogout(val.status, val.message || '');
      }
    });
  } catch(e) { console.warn('[EST-iMs] Account status listener error:', e); }
})();

const _flCountdownIntervals = [];
function _showForceLogout(status, message) {
  const modal = document.getElementById('forceLogoutModal');
  if (!modal) return;
  const titleEl = document.getElementById('flTitle');
  const msgEl   = document.getElementById('flMessage');
  const cdEl    = document.getElementById('flCountdown');
  if (titleEl) titleEl.textContent = status === 'deleted' ? 'Account Deleted' : 'Account Suspended';
  if (msgEl)   msgEl.textContent   = message || (status === 'deleted'
    ? 'Your account has been removed from the system by the administration.'
    : 'Your account has been temporarily suspended by the administration.');
  modal.style.display = 'flex';
  // Countdown
  let secs = 5;
  if (cdEl) cdEl.textContent = `Redirecting in ${secs}s...`;
  const iv = setInterval(() => {
    secs--;
    if (cdEl) cdEl.textContent = secs > 0 ? `Redirecting in ${secs}s...` : 'Redirecting...';
    if (secs <= 0) { clearInterval(iv); window.location.href = '/logout'; }
  }, 1000);
  _flCountdownIntervals.push(iv);
}



// â”€â”€ BETA POPUP (show only once per session) â”€â”€
function closeBetaOverlay() {
  const overlay = document.getElementById('betaOverlay');
  if (!overlay) return;
  overlay.style.animation = 'overlayOut 0.25s ease both';
  setTimeout(() => overlay.remove(), 250);
}
(function() {
  const overlay = document.getElementById('betaOverlay');
  if (!overlay) return;
  if (sessionStorage.getItem('est-beta-seen')) {
    overlay.remove();
  }
  // Mark as seen for this session
  sessionStorage.setItem('est-beta-seen', '1');
})();


// â”€â”€ COMING SOON MODAL â”€â”€
function openSoonModal(feature, customTitle, customSub) {
  document.getElementById('soonTitle').textContent = customTitle || feature || 'Feature Under Development';
  document.getElementById('soonSub').textContent   = customSub  || 'This feature will be available in a future update.';
  document.getElementById('soonModal').classList.add('open');
}
function closeSoonModal() {
  document.getElementById('soonModal').classList.remove('open');
}

// â”€â”€ USER PROFILE MODAL â”€â”€
let _profileLoaded = false;
let _profileData = null;

function profileInitials(username) {
  const cleaned = String(username || '').trim();
  if (!cleaned) return '--';
  return cleaned
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0].toUpperCase())
    .join('');
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0
    ? `${h}h ${String(m).padStart(2, '0')}m`
    : `${m}m ${String(s).padStart(2, '0')}s`;
}

function openProfileModal() {
  document.getElementById('profileModal').classList.add('open');
  loadProfile();
}

function closeProfileModal() {
  document.getElementById('profileModal')?.classList.remove('open');
}

async function uploadProfileAvatar(input) {
  const file = input.files[0];
  if (!file) return;
  const fd = new FormData();
  fd.append('avatar', file);
  try {
    const res = await fetch('/api/profile/avatar', { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok || !data.success) { toast(data.message || 'Failed to upload', false); return; }
    const avatarEl = document.getElementById('profileAvatar');
    avatarEl.innerHTML = `<img src="${escAttr(data.avatar_url)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
    toast(' Photo updated!');
  } catch (e) {
    toast('Upload failed', false);
  }
  input.value = '';
}

async function loadProfile() {
  const body = document.getElementById('profileBody');
  body.innerHTML = '<div class="profile-loading">Loading profile...</div>';
  try {
    const res = await fetch('/api/profile');
    if (!res.ok) throw new Error('profile');
    _profileData = await res.json();
    _profileLoaded = true;
    renderProfile(_profileData);
  } catch (e) {
    body.innerHTML = '<div class="profile-error">⚠ Failed to load profile data</div>';
  }
}

function renderProfile(data) {
  const role = data.is_super ? 'Super User' : 'Zone User';
  const verified = data.is_verified || String(data.username || '').toLowerCase() === 'hamza k. ghareb';
  const avatarEl = document.getElementById('profileAvatar');
  const isDevUser = String(data.username || '').toLowerCase() === 'hamza k. ghareb';
  const defaultAvatar = `/static/images/profile_${data.gender === 'female' ? 'female' : 'male'}.png`;
  const avatarSrc = isDevUser ? '/static/images/me.jpg' : (data.avatar_url || defaultAvatar);
  avatarEl.innerHTML = `<img src="${escAttr(avatarSrc)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.onerror=null;this.src='${escAttr(defaultAvatar)}'">`;

  document.getElementById('profileName').textContent = data.username || 'User';
  const profileVerified = document.getElementById('profileVerifiedBadge');
  if (profileVerified) profileVerified.style.display = verified ? 'inline-flex' : 'none';
  document.getElementById('profileZoneChip').textContent = data.zone_label || data.zone_name || data.zone || 'Zone';
  document.getElementById('profileRoleChip').textContent = role;
  document.getElementById('profileSessionChip').textContent = formatDuration(Number(data.login_duration_seconds));

  const permissions = [
    ['Edit Mode', data.permissions?.can_edit],
    ['Print', data.permissions?.can_print],
    ['Export CSV', data.permissions?.can_export],
    ['Reports', data.permissions?.can_reports],
    ['All Zones', data.permissions?.can_view_all_zones],
    ['Switch Zones', data.permissions?.can_switch_zones],
  ];
  const permissionHtml = permissions.map(([label, enabled]) => `
    <div class="permission-item">
      <span class="permission-dot ${enabled ? '' : 'off'}"></span>
      <span>${escHtml(label)}</span>
    </div>`).join('');

  const zones = (data.allowed_zones || []).map(z => `
    <span class="profile-zone-pill">${escHtml(z.label || z.name || z.id)}</span>
  `).join('') || '<span class="profile-zone-pill">—</span>';

  const _isPrivIp = ip => !ip || /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1)/.test(ip);
  const _fmtCountry = (e) => {
    if (e.country && e.country.toLowerCase() !== 'nan' && e.country.trim() !== '') return e.country;
    return _isPrivIp(e.ip) ? 'Local' : '—';
  };
  const logins = (data.recent_logins || []).length
    ? data.recent_logins.map(entry => `
        <div class="profile-log-item">
          <div>
            <div class="profile-log-main">${escHtml(entry.zone_label || entry.zone_id || 'Zone')}</div>
            <div class="profile-log-sub">${escHtml(_fmtCountry(entry))} &nbsp;·&nbsp; ${escHtml(entry.ip || '—')}</div>
          </div>
          <div class="profile-log-time">${escHtml(entry.time || '—')}</div>
        </div>
      `).join('')
    : '<div class="users-empty" style="padding:18px;">No login history yet</div>';

  document.getElementById('profileBody').innerHTML = `
    <div class="profile-grid">
      <div class="profile-card">
        <div class="profile-card-label">Current Zone</div>
        <div class="profile-card-value">${escHtml(data.zone_label || data.zone_name || data.zone || '—')}</div>
        <div class="profile-card-sub">${escHtml(data.zone_name || data.zone || '')}</div>
      </div>
      <div class="profile-card">
        <div class="profile-card-label">Active View</div>
        <div class="profile-card-value">${escHtml(data.active_view_zone_label || data.active_view_zone || '—')}</div>
        <div class="profile-card-sub">${data.is_super ? 'Super-zone view access' : 'Assigned zone access'}</div>
      </div>
      <div class="profile-card">
        <div class="profile-card-label">Login Time</div>
        <div class="profile-card-value">${escHtml(data.login_time || '—')}</div>
        <div class="profile-card-sub">Session: ${escHtml(formatDuration(Number(data.login_duration_seconds)))}</div>
      </div>
    </div>

    <div class="profile-section">
      <div class="profile-section-title">Permissions</div>
      <div class="permission-grid">${permissionHtml}</div>
    </div>

    <div class="profile-section">
      <div class="profile-section-title">Allowed Zones</div>
      <div class="profile-zone-list">${zones}</div>
    </div>

    <div class="profile-section">
      <div class="profile-section-title">Recent Logins</div>
      <div class="profile-log-list">${logins}</div>
    </div>

    <div class="profile-section">
      <div class="profile-section-title">Change Password</div>
      <div class="profile-change-pw" id="profileChangePwForm">
        <input type="password" id="profilePwCurrent" placeholder="Current password" autocomplete="current-password">
        <input type="password" id="profilePwNew" placeholder="New password" autocomplete="new-password">
        <input type="password" id="profilePwConfirm" placeholder="Confirm new password" autocomplete="new-password">
        <div class="profile-pw-status" id="profilePwStatus"></div>
        <button class="btn btn-primary" onclick="submitProfilePasswordChange()">Save new password</button>
      </div>
    </div>

    <div class="profile-actions">
      <button class="btn btn-primary" onclick="loadProfile()">Refresh Profile</button>
      <button class="btn btn-logout" onclick="confirmLogout()">Logout</button>
    </div>
  `;
}

function submitProfilePasswordChange() {
  const current = (document.getElementById('profilePwCurrent')?.value || '').trim();
  const newPw   = (document.getElementById('profilePwNew')?.value || '').trim();
  const confirm = (document.getElementById('profilePwConfirm')?.value || '').trim();
  const status  = document.getElementById('profilePwStatus');
  if (!status) return;
  if (!current || !newPw || !confirm) {
    status.textContent = 'Please fill in all fields';
    status.className = 'profile-pw-status err';
    return;
  }
  if (newPw !== confirm) {
    status.textContent = 'New passwords do not match';
    status.className = 'profile-pw-status err';
    return;
  }
  status.textContent = 'Saving...';
  status.className = 'profile-pw-status';
  fetch('/api/profile/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ current_password: current, new_password: newPw, confirm_password: confirm })
  })
  .then(r => r.json())
  .then(data => {
    status.textContent = data.message || (data.success ? 'Done' : 'Error');
    status.className = 'profile-pw-status ' + (data.success ? 'ok' : 'err');
    if (data.success) {
      ['profilePwCurrent', 'profilePwNew', 'profilePwConfirm'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = '';
      });
    }
  })
  .catch(() => {
    status.textContent = 'Request failed';
    status.className = 'profile-pw-status err';
  });
}

// â”€â”€ LANGUAGE TOGGLE (index) â”€â”€
const INDEX_LANG = {
  en: {
    refresh: 'Refresh', print: 'Print', exportCSV: 'Export CSV',
    about: 'About', logout: 'Logout', lang: 'Ar-En',
    selectMonth: 'Select a month to begin',
    searchPh: 'Search data...',
    yearLabel: 'Year', monthsLabel: 'Months', filesLabel: 'Files', sheetsLabel: 'Sheets',
    editMode: 'Edit Mode', zoneView: 'Zone View',
  },
  ar: {
    refresh: 'ØªØ­Ø¯ÙŠØ«', print: 'Ø·Ø¨Ø§Ø¹Ø©', exportCSV: 'ØªØµØ¯ÙŠØ± CSV',
    about: 'Ø¹Ù† Ø§Ù„Ù†Ø¸Ø§Ù…', logout: 'Ø®Ø±ÙˆØ¬', lang: 'Ar-En',
    selectMonth: 'Ø§Ø®ØªØ± Ø´Ù‡Ø±Ø§Ù‹ Ù„Ù„Ø¨Ø¯Ø¡',
    searchPh: 'Ø¨Ø­Ø« ÙÙŠ Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª...',
    yearLabel: 'Ø§Ù„Ø³Ù†Ø©', monthsLabel: 'Ø§Ù„Ø£Ø´Ù‡Ø±', filesLabel: 'Ø§Ù„Ù…Ù„ÙØ§Øª', sheetsLabel: 'Ø§Ù„Ø£ÙˆØ±Ø§Ù‚',
    editMode: 'ÙˆØ¶Ø¹ Ø§Ù„ØªØ¹Ø¯ÙŠÙ„', zoneView: 'Ø¹Ø±Ø¶ Ø§Ù„Ø²ÙˆÙ†',
  }
};
let indexLang = localStorage.getItem('est-lang') || 'en';
// Set initial lang button text immediately before full apply
(function() {
  const btn = document.getElementById('langBtnText');
  if (btn) btn.textContent = (localStorage.getItem('est-lang') || 'en') === 'ar' ? 'AR' : 'EN';
})();
function applyIndexLang(lang) {
  indexLang = lang;
  localStorage.setItem('est-lang', lang);
  const t = INDEX_LANG[lang];
  const isAr = lang === 'ar';
  document.documentElement.lang = lang;
  document.documentElement.dir  = isAr ? 'rtl' : 'ltr';
  // Buttons text
  const actions = document.querySelectorAll('.topbar-actions .btn');
  // find by onclick
  document.querySelectorAll('.topbar-actions .btn').forEach(btn => {
    const oc = btn.getAttribute('onclick') || '';
    if (oc.includes('refreshData'))   btn.lastChild.textContent = ' ' + t.refresh;
    if (oc.includes('openPrintModal')) btn.lastChild.textContent = ' ' + t.print;
    if (oc.includes('exportCSV'))     btn.lastChild.textContent = ' ' + t.exportCSV;
    if (oc.includes('showAbout'))     btn.lastChild.textContent = ' ' + t.about;
    if (oc.includes('confirmLogout')) btn.lastChild.textContent = ' ' + t.logout;
  });
  const langLabel = lang === 'ar' ? 'AR' : 'EN';
  const langBtnText = document.getElementById('langBtnText');
  if (langBtnText) langBtnText.textContent = langLabel;
  // Sync lang button text across all modal headers
  ['usersModalLangBtn','reqModalLangBtn','msgModalLangBtn','usrModalLangBtn',
   'aboutModalLangBtn','dashModalLangBtn','profileModalLangBtn'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = langLabel;
  });
  // Update all bilingual data-en / data-ar elements
  document.querySelectorAll('[data-en][data-ar]').forEach(el => {
    el.textContent = isAr ? el.dataset.ar : el.dataset.en;
  });
  // Search
  const si = document.getElementById('searchInput');
  if (si) si.placeholder = t.searchPh;
}
function toggleIndexLang() {
  applyIndexLang(indexLang === 'en' ? 'ar' : 'en');
}
// ØªØ·Ø¨ÙŠÙ‚ Ø§Ù„Ù„ØºØ© Ø¹Ù†Ø¯ Ø§Ù„ØªØ­Ù…ÙŠÙ„
applyIndexLang(indexLang);

// â”€â”€ LOGIN SOUND â”€â”€
(function() {
  try {
    const audio = new Audio('/static/audio/id.mp3');
    audio.volume = 0.7;
    audio.play().catch(() => {});
  } catch(e) {}
})();

// â”€â”€ SIDEBAR TOGGLE â”€â”€
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const btn = document.getElementById('sidebarToggleBtn');
  const collapsed = sidebar.classList.toggle('collapsed');
  btn.innerHTML = collapsed
    ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>'
    : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>';
  btn.title = collapsed ? 'Show sidebar' : 'Hide sidebar';
}

// â”€â”€ PRINT MODAL â”€â”€
function openPrintModal() {
  const table = document.querySelector('.data-table');
  if (!table) { toast('No data to print', false); return; }
  document.getElementById('printInfoFile').textContent = state.selectedFile || '—';
  document.getElementById('printInfoSheet').textContent = state.selectedSheet || '—';
  document.getElementById('printInfoPeriod').textContent = (state.selectedMonth && state.selectedYear) ? `${state.selectedMonth} ${state.selectedYear}` : '—';
  document.getElementById('printInfoRecords').textContent = state.allRows.length ? `${state.allRows.length} rows` : '—';
  document.getElementById('printModal').style.display = 'flex';
}
function closePrintModal() {
  document.getElementById('printModal').style.display = 'none';
}
function doPrint() {
  closePrintModal();
  printTable();
}

// â”€â”€ STATE â”€â”€
const state = {
  structure: {},
  availableYears: [],
  selectedYear: null,
  selectedMonth: null,
  selectedFile: null,
  selectedSheet: null,
  allRows: [],
  headers: [],
  filePath: null,
  editMode: false,
  isInventorySheet: false,
  sheetOptions: { colors: [], types: [], sizes: [], categories: [] },   // â† dropdown options from Excel
};

const MONTH_NUMS = { January:1,February:2,March:3,April:4,May:5,June:6,July:7,August:8,September:9,October:10,November:11,December:12 };
const FILE_ICONS  = { 'Other+': '-', 'Sacks': '-' };
const FILE_LABELS = { 'Other+': 'Other+', 'Sacks': 'Sacks' };

// Columns that should NOT be directly editable (managed by transaction logic)
const READ_ONLY_COLS = ['Current Balance', 'IN', 'OUT', '__row__'];
// Columns that identify it as an inventory sheet
const NON_INVENTORY_SHEETS = ['Stocktaking'];

// ── THEME ──
(function() {
  const saved = localStorage.getItem('est-theme');
  if (saved === 'light') document.documentElement.classList.add('light');
})();
function toggleTheme() {
  const isLight = document.documentElement.classList.toggle('light');
  localStorage.setItem('est-theme', isLight ? 'light' : 'dark');
}
document.getElementById('themeBtn').addEventListener('click', toggleTheme);


// â”€â”€ CLOCK (disabled per update) â”€â”€
// function updateClock() { ... }

// â”€â”€ TOAST â”€â”€
let _toastTimer;
function toast(msg, ok=true) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'show ' + (ok ? 'toast-ok' : 'toast-err');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { el.className = ''; }, 3000);
}

// â”€â”€ GO HOME (reset to initial state) â”€â”€
function goHome() {
  state.selectedMonth = null;
  state.selectedFile  = null;
  state.selectedSheet = null;
  document.getElementById('fileSection').style.display  = 'none';
  document.getElementById('sheetSection').style.display = 'none';
  // deactivate month pills
  document.querySelectorAll('.month-pill').forEach(p => p.classList.remove('active'));
  showEmptyState('Select a month to begin');
  updateHeader('Select a month to begin', `${state.selectedYear} → ...`);
  document.getElementById('pathInfo').textContent = '—';
  setStatus('Ready');
}

// â”€â”€ INIT â”€â”€
const IS_SUPER = window.INDEX_CONFIG.IS_SUPER;
let currentViewZone = window.INDEX_CONFIG.zone;

async function loadStructure(viewZone) {
  const url = IS_SUPER && viewZone
    ? `/api/structure?zone=${viewZone}`
    : '/api/structure';
  const res = await fetch(url);
  return await res.json();
}

async function switchViewZone(zoneId) {
  currentViewZone = zoneId;
  await fetch('/api/switch_zone', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({zone_id: zoneId})
  });
  state.selectedMonth = null; state.selectedFile = null; state.selectedSheet = null;
  document.getElementById('fileSection').style.display = 'none';
  document.getElementById('sheetSection').style.display = 'none';
  showEmptyState('Select a month to begin');
  state.structure = await loadStructure(zoneId);
  state.availableYears = Object.keys(state.structure).sort();
  buildYearSelect();
  if (state.availableYears.length) {
    state.selectedYear = state.availableYears[0];
    document.getElementById('yearSelect').value = state.selectedYear;
    buildMonthGrid();
  }
}

async function init() {
  // Restore toggle buttons visibility state
  try {
    if (localStorage.getItem('topbarButtonsHidden') === '1') {
      const actions = document.querySelector('.topbar-actions');
      const btn = document.getElementById('buttonsToggleBtn');
      const icon = document.getElementById('toggleBtnIcon');
      if (actions) actions.classList.add('buttons-hidden');
      if (btn) btn.classList.add('active');
      if (icon) icon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
    }
  } catch(e){}
  state.structure = await loadStructure(currentViewZone);
  state.availableYears = Object.keys(state.structure).sort();
  if (!state.availableYears.length) return;
  buildYearSelect();
  state.selectedYear = state.availableYears[0];
  document.getElementById('yearSelect').value = state.selectedYear;
  buildMonthGrid();
}

// â”€â”€ BUILD YEAR SELECT â”€â”€
function buildYearSelect() {
  const sel = document.getElementById('yearSelect');
  sel.innerHTML = '';
  state.availableYears.forEach(yr => {
    const opt = document.createElement('option');
    opt.value = yr;
    opt.textContent = yr;
    sel.appendChild(opt);
  });
}

// â”€â”€ SELECT YEAR â”€â”€
function selectYear(year) {
  state.selectedYear = year;
  state.selectedMonth = null;
  state.selectedFile = null;
  state.selectedSheet = null;
  document.getElementById('fileSection').style.display = 'none';
  document.getElementById('sheetSection').style.display = 'none';
  showEmptyState('Select a month to begin');
  updateHeader('Select a month to begin', `${year} → ...`);
  document.getElementById('pathInfo').textContent = '—';
  buildMonthGrid();
}

// â”€â”€ BUILD MONTH GRID â”€â”€
function buildMonthGrid() {
  const grid = document.getElementById('monthGrid');
  grid.innerHTML = '';
  const months = Object.keys(state.structure[state.selectedYear] || {});
  months.forEach(month => {
    const num = MONTH_NUMS[month] || 0;
    const pill = document.createElement('div');
    pill.className = 'month-pill';
    pill.dataset.month = month;
    pill.innerHTML = `${month}<span class="num">${String(num).padStart(2,'0')}</span>`;
    pill.onclick = () => selectMonth(month);
    grid.appendChild(pill);
  });
}

// â”€â”€ SELECT MONTH â”€â”€
function selectMonth(month) {
  state.selectedMonth = month;
  state.selectedFile = null;
  state.selectedSheet = null;
  document.querySelectorAll('.month-pill').forEach(p => p.classList.toggle('active', p.dataset.month === month));
  const files = (state.structure[state.selectedYear] || {})[month] || {};
  buildFileList(files);
  document.getElementById('fileSection').style.display = '';
  document.getElementById('sheetSection').style.display = 'none';
  showEmptyState(`Select a file from ${month} files`);
  updateHeader('Select a file', `${state.selectedYear} → ${month}`);
  document.getElementById('pathInfo').textContent = `${state.selectedYear} / ${month}`;
}

// â”€â”€ BUILD FILE LIST â”€â”€
function buildFileList(files) {
  const list = document.getElementById('fileList');
  list.innerHTML = '';
  Object.entries(files).forEach(([fname, fpath]) => {
    const item = document.createElement('div');
    item.className = 'file-item';
    item.dataset.name = fname;
    item.dataset.path = fpath;
    item.innerHTML = `<span class="fi-icon">${FILE_ICONS[fname] || '📄'}</span>${FILE_LABELS[fname] || fname}`;
    item.onclick = () => selectFile(fname, fpath);
    list.appendChild(item);
  });
}

// â”€â”€ SELECT FILE â”€â”€
async function selectFile(fname, fpath) {
  state.selectedFile = fname;
  state.selectedSheet = null;
  state.filePath = fpath;
  document.querySelectorAll('.file-item').forEach(i => i.classList.toggle('active', i.dataset.name === fname));
  setStatus(`Loading sheets for ${fname}...`);
  const res = await fetch(`/api/sheets?path=${encodeURIComponent(fpath)}`);
  const data = await res.json();
  if (data.error || !data.sheets) { setStatus('Error reading file'); return; }
  buildSheetList(data.sheets);
  document.getElementById('sheetSection').style.display = '';
  if (data.sheets.length > 0) selectSheet(data.sheets[0]);
  updateHeader(fname, `${state.selectedYear} → ${state.selectedMonth} → ${fname}`);
}

// â”€â”€ BUILD SHEET LIST â”€â”€
function buildSheetList(sheets) {
  const list = document.getElementById('sheetList');
  list.innerHTML = '';
  sheets.forEach(sh => {
    const tab = document.createElement('div');
    tab.className = 'sheet-tab';
    tab.dataset.sheet = sh;
    tab.innerHTML = `<span class="st-dot"></span>${sh}`;
    tab.onclick = () => selectSheet(sh);
    list.appendChild(tab);
  });
}

// â”€â”€ SELECT SHEET â”€â”€
async function selectSheet(sheet) {
  const switchingSheet = state.selectedSheet !== sheet;
  // Only reset edit mode when actively switching to a different sheet
  if (switchingSheet) {
    state.editMode = false;
    const toggle = document.getElementById('editToggle');
    if (toggle) toggle.checked = false;
  }
  state.selectedSheet = sheet;

  document.querySelectorAll('.sheet-tab').forEach(t => t.classList.toggle('active', t.dataset.sheet === sheet));
  setStatus(`Loading data for ${sheet}...`);
  showLoading();

  const res = await fetch(`/api/data?path=${encodeURIComponent(state.filePath)}&sheet=${encodeURIComponent(sheet)}`);
  const data = await res.json();

  if (data.error) { showEmptyState('Error reading data'); setStatus('Error reading data'); return; }

  state.headers  = data.headers || [];
  state.allRows  = data.rows    || [];
  state.isInventorySheet = !NON_INVENTORY_SHEETS.includes(sheet);

  // Fetch Color/Type dropdown options from the Excel file
  state.sheetOptions = { colors: [], types: [] };
  if (state.isInventorySheet) {
    try {
      const optRes = await fetch(`/api/options?path=${encodeURIComponent(state.filePath)}&sheet=${encodeURIComponent(sheet)}`);
      const optData = await optRes.json();
      if (!optData.error) state.sheetOptions = optData;
    } catch(e) {}
  }

  renderTable(state.headers, state.allRows);
  updateHeader(sheet, `${state.selectedYear} → ${state.selectedMonth} → ${state.selectedFile} → ${sheet}`);
  document.getElementById('recordCount').textContent = `${data.count} Records`;
  setStatus(`Loaded ${state.selectedFile} / ${sheet}`);
  document.getElementById('pathInfo').textContent = `${state.selectedYear} / ${state.selectedMonth} / ${state.selectedFile}.xlsm / ${sheet}`;
  document.getElementById('searchInput').value = '';
  document.getElementById('filterInfo').textContent = '';

  // Show edit toggle for all sheets except Stocktaking
  const wrap = document.getElementById('editToggleWrap');
  const toggle = document.getElementById('editToggle');
  if (wrap) wrap.style.display = state.isInventorySheet ? '' : 'none';
  if (toggle) toggle.checked = state.editMode;
  document.getElementById('editBadge').style.display = state.editMode ? '' : 'none';
}

// â”€â”€ TOGGLE EDIT MODE â”€â”€
function toggleEditMode() {
  const toggle = document.getElementById('editToggle');
  if (toggle.checked) {
    // Turning ON — require password
    toggle.checked = false; // revert visually until password confirmed
    document.getElementById('pwdInput').value = '';
    document.getElementById('pwdError').textContent = '';
    document.getElementById('pwdModal').classList.add('open');
    setTimeout(() => document.getElementById('pwdInput').focus(), 120);
  } else {
    // Turning OFF — no password needed
    state.editMode = false;
    document.getElementById('editBadge').style.display = 'none';
    renderTable(state.headers, state.allRows);
  }
}

// â”€â”€ PASSWORD MODAL â”€â”€
async function confirmPwd() {
  const val = document.getElementById('pwdInput').value;
  try {
    const res = await fetch('/api/verify_edit_password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: val })
    });
    const data = await res.json();
    if (data.success) {
      document.getElementById('pwdModal').classList.remove('open');
      state.editMode = true;
      document.getElementById('editToggle').checked = true;
      document.getElementById('editBadge').style.display = '';
      renderTable(state.headers, state.allRows);
      toast('Edit mode ON — click any cell or use IN/OUT buttons', true);
    } else {
      document.getElementById('pwdError').textContent = '✗ Incorrect password';
      document.getElementById('pwdInput').value = '';
      document.getElementById('pwdInput').focus();
    }
  } catch (e) {
    document.getElementById('pwdError').textContent = '✗ Connection error';
  }
}
function cancelPwdModal() {
  document.getElementById('pwdModal').classList.remove('open');
  document.getElementById('pwdInput').value = '';
  document.getElementById('pwdError').textContent = '';
}

// â”€â”€ RENDER TABLE â”€â”€
function renderTable(headers, rows) {
  const wrap = document.getElementById('tableWrap');
  if (!headers.length) { showEmptyState('No data in this sheet'); return; }

  const showActions = state.editMode && state.isInventorySheet;
  const visHeaders = headers.filter(h => h !== '__row__');

  let html = `<table class="data-table fade-in"><thead><tr><th class="row-num">#</th>`;
  visHeaders.forEach(h => { html += `<th>${h}</th>`; });
  if (showActions) html += `<th>Actions</th>`;
  html += `</tr></thead><tbody>`;

  if (!rows.length) {
    html += `<tr class="no-data-row"><td colspan="${visHeaders.length + 1 + (showActions?1:0)}">No data entered yet in this sheet</td></tr>`;
  } else {
    rows.forEach((row, i) => {
      const excelRow = row['__row__'];
      // Detect IN/OUT from Process column (Log sheet)
      const processKey = Object.keys(row).find(k => k.toLowerCase() === 'process');
      const processVal = processKey ? String(row[processKey] || '').trim().toUpperCase() : '';
      const rowCls = processVal === 'IN' ? 'row-in' : processVal === 'OUT' ? 'row-out' : '';
      html += `<tr data-row="${i}" data-excel-row="${excelRow || ''}" class="${rowCls}">`;
      html += `<td class="row-num">${i + 1}</td>`;
      visHeaders.forEach(h => {
        const val = row[h];
        const hLower = h.toLowerCase();
        let cls = '';
        if (hLower === 'date' || hLower === 'Ø§Ù„ØªØ§Ø±ÙŠØ®') cls = 'cell-date';
        else if (hLower === 'in') cls = 'cell-in';
        else if (hLower === 'out') cls = 'cell-out';
        else if (hLower.includes('balance')) cls = 'cell-balance';

        const display = (val === null || val === undefined || val === '') ?
          `<span class=”cell-null”>—</span>` : escHtml(String(val));

        const isReadOnly = READ_ONLY_COLS.some(ro => hLower.includes(ro.toLowerCase()));
        const editable   = state.editMode && !isReadOnly;

        if (editable) {
          html += `<td class="${cls} editable" data-col="${escAttr(h)}" data-excel-row="${excelRow || ''}"
                       onclick="startEdit(this, ${excelRow}, '${escAttr(h)}')">${display}</td>`;
        } else {
          html += `<td class="${cls}">${display}</td>`;
        }
      });
      if (showActions) {
        html += `<td class="action-cell">
          <button class="btn-in"  onclick="openTxModal(${excelRow}, 'IN')">+IN</button>
          <button class="btn-out" onclick="openTxModal(${excelRow}, 'OUT')">-OUT</button>
          <button class="btn-del" onclick="confirmClearRow(${excelRow})" title="Clear row data"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>
        </td>`;
      }
      html += `</tr>`;
    });
  }
  html += `</tbody></table>`;
  wrap.innerHTML = html;
}

// â”€â”€ INLINE CELL EDIT â”€â”€
function _buildDropdown(options, currentText, excelRow, colName) {
  let optHtml = `<option value=””>— Select —</option>`;
  let found = false;
  options.forEach(o => {
    const sel = o === currentText ? ' selected' : '';
    if (sel) found = true;
    optHtml += `<option value="${escAttr(o)}"${sel}>${escHtml(o)}</option>`;
  });
  if (currentText && !found) {
    optHtml += `<option value="${escAttr(currentText)}" selected>${escHtml(currentText)}</option>`;
  }
  optHtml += `<option value="__new__">+ Add new value...</option>`;
  return `<select
    onchange="handleDDChange(this,${excelRow},'${escAttr(colName)}')"
    onblur="handleDDBlur(this,${excelRow},'${escAttr(colName)}')"
    onkeydown="if(event.key==='Escape'){event.preventDefault();cancelEdit(this);}"
  >${optHtml}</select>`;
}

function startEdit(td, excelRow, colName) {
  if (td.querySelector('input') || td.querySelector('select')) return;
  const currentText = td.innerText.trim() === '—' ? '' : td.innerText.trim();
  const colLower = colName.toLowerCase();

  const ddMap = {
    'color':    state.sheetOptions.colors,
    'type':     state.sheetOptions.types,
    'size':     state.sheetOptions.sizes,
    'category': state.sheetOptions.categories,
  };
  const ddKey = Object.keys(ddMap).find(k => colLower.includes(k));
  if (ddKey && ddMap[ddKey].length > 0) {
    td.innerHTML = _buildDropdown(ddMap[ddKey], currentText, excelRow, colName);
    td.querySelector('select').focus();
    return;
  }
  if (colLower.includes('basic')) {
    td.innerHTML = `<input type="number" step="0.01" value="${escAttr(currentText)}"
      onblur="commitEdit(this,${excelRow},'${escAttr(colName)}')"
      onkeydown="if(event.key==='Enter'){this.blur();}if(event.key==='Escape'){cancelEdit(this);}">`;
    td.querySelector('input').focus();
    return;
  }
  td.innerHTML = `<input type="text" value="${escAttr(currentText)}"
    onblur="commitEdit(this,${excelRow},'${escAttr(colName)}')"
    onkeydown="if(event.key==='Enter'){this.blur();}if(event.key==='Escape'){cancelEdit(this);}">`;
  td.querySelector('input').focus();
}

function handleDDChange(select, excelRow, colName) {
  if (select.value !== '__new__') return;
  // Prevent blur from firing during prompt
  select._prompting = true;
  const newVal = prompt(`Add new value for ${colName}:`);
  select._prompting = false;
  if (newVal && newVal.trim()) {
    const v = newVal.trim();
    const opt = document.createElement('option');
    opt.value = v; opt.textContent = v; opt.selected = true;
    select.insertBefore(opt, select.lastElementChild);
    select.value = v;
    // Immediately commit the new value
    commitEditSelect(select, excelRow, colName);
  } else {
    const prev = select.options[0].value;
    select.value = prev === '__new__' ? '' : prev;
    if (!select.value) cancelEdit(select);
  }
}

function handleDDBlur(select, excelRow, colName) {
  if (select._prompting) return;
  if (select.value === '__new__' || select.value === '') {
    cancelEdit(select);
    return;
  }
  commitEditSelect(select, excelRow, colName);
}

function cancelEdit(el) {
  renderTable(state.headers, state.allRows);
}

async function _applyAutoBalance(excelRow, colorValue) {
  // Fetch last current balance for this color (from rows BEFORE this row)
  const params = new URLSearchParams({
    path:       state.filePath,
    sheet:      state.selectedSheet,
    color:      colorValue,
    before_row: excelRow,
  });
  try {
    const res  = await fetch(`/api/color_balance?${params}`);
    const data = await res.json();
    if (data.found && data.balance !== null) {
      // Write Basic + Current both = last current balance
      const r2 = await fetch('/api/set_opening_balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filepath: state.filePath,
          sheet:    state.selectedSheet,
          row:      excelRow,
          balance:  data.balance,
        })
      });
      const d2 = await r2.json();
      if (d2.success) {
        // Update local state
        const rowObj = state.allRows.find(r => r['__row__'] === excelRow);
        if (rowObj) {
          const basicKey   = Object.keys(rowObj).find(k => k.toLowerCase().includes('basic'));
          const currentKey = Object.keys(rowObj).find(k => k.toLowerCase().includes('current'));
          if (basicKey)   rowObj[basicKey]   = data.balance;
          if (currentKey) rowObj[currentKey] = data.balance;
        }
        toast(`Color: ${colorValue} — Opening balance: ${data.balance}`, true);
        renderTable(state.headers, state.allRows);
        return;
      }
    }
    // No previous balance found — just toast color saved, leave Basic/Current empty
    toast(`Color: ${colorValue} — no previous balance for this item`, true);
  } catch(e) {
    // silently ignore
  }
}

async function commitEditSelect(select, excelRow, colName) {
  const newValue = select.value;
  if (!newValue || newValue === '__new__') { renderTable(state.headers, state.allRows); return; }
  const td = select.parentElement;
  td.textContent = newValue;

  const res = await fetch('/api/update_cell', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filepath: state.filePath,
      sheet:    state.selectedSheet,
      row:      excelRow,
      col_name: colName,
      value:    newValue,
    })
  });
  const d = await res.json();
  if (d.success) {
    const rowObj = state.allRows.find(r => r['__row__'] === excelRow);
    if (rowObj) rowObj[colName] = newValue;

    // If Color was just set → auto-fill Basic + Current from last balance
    if (colName.toLowerCase() === 'color') {
      await _applyAutoBalance(excelRow, newValue);
    } else {
      toast(`Saved: ${colName} = ${newValue}`);
    }
  } else {
    toast(`✗ Error: ${d.error}`, false);
    renderTable(state.headers, state.allRows);
  }
}

async function commitEdit(input, excelRow, colName) {
  const newValue = input.value.trim();
  const td = input.parentElement;

  // Optimistic UI
  td.textContent = newValue || '—';

  const res = await fetch('/api/update_cell', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filepath: state.filePath,
      sheet:    state.selectedSheet,
      row:      excelRow,
      col_name: colName,
      value:    newValue,
    })
  });
  const data = await res.json();
  if (data.success) {
    toast(`Saved: ${colName} = ${newValue}`);
    // Update local state so re-render is correct
    const rowObj = state.allRows.find(r => r['__row__'] === excelRow);
    if (rowObj) rowObj[colName] = newValue;
  } else {
    toast(`✗ Error: ${data.error}`, false);
    renderTable(state.headers, state.allRows); // revert
  }
}

// â”€â”€ CLEAR ROW â”€â”€
async function confirmClearRow(excelRow) {
  const rowObj = state.allRows.find(r => r['__row__'] === excelRow) || {};
  const colorVal = Object.entries(rowObj).find(([k]) => k.toLowerCase() === 'color')?.[1];
  const label = colorVal ? `(Color: ${colorVal})` : `(Row ${excelRow})`;
  if (!confirm(`Clear row data ${label}?\nThis will clear all values. Are you sure?`)) return;

  const res = await fetch('/api/clear_row', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filepath: state.filePath, sheet: state.selectedSheet, row: excelRow })
  });
  const d = await res.json();
  if (d.success) {
    toast('Row data cleared');
    await selectSheet(state.selectedSheet);
  } else {
    toast(`✗ ${d.error}`, false);
  }
}

// â”€â”€ TRANSACTION MODAL â”€â”€
let _txRow = null, _txOp = null;

function openTxModal(excelRow, operation) {
  _txRow = excelRow;
  _txOp  = operation;

  // Find row data
  const rowObj = state.allRows.find(r => r['__row__'] === excelRow) || {};

  // Enforce Color must be set
  const colorKey = Object.keys(rowObj).find(k => k.toLowerCase() === 'color');
  const colorVal = colorKey ? rowObj[colorKey] : null;
  if (!colorVal || String(colorVal).trim() === '' || String(colorVal).trim().toLowerCase() === 'null') {
    toast('⚠ Color must be set before performing any operation', false);
    return;
  }

  document.getElementById('txTitle').textContent    = operation === 'IN' ? '+ IN — Add Stock' : '− OUT — Remove Stock';
  document.getElementById('txSubtitle').textContent = `${state.selectedFile} / ${state.selectedSheet} — Row ${excelRow}`;

  // Info grid
  const infoFields = ['Color', 'Size', 'Type', 'Category', 'Current Balance', 'Basic'];
  let grid = '';
  infoFields.forEach(f => {
    const key = Object.keys(rowObj).find(k => k.toLowerCase().includes(f.toLowerCase()));
    if (key && rowObj[key] !== null && rowObj[key] !== undefined && rowObj[key] !== '') {
      grid += `<div class="modal-info-item">
        <div class="modal-info-label">${f}</div>
        <div class="modal-info-value">${escHtml(String(rowObj[key]))}</div>
      </div>`;
    }
  });
  document.getElementById('txInfoGrid').innerHTML = grid;

  const btn = document.getElementById('txConfirmBtn');
  btn.className = `btn ${operation === 'IN' ? 'btn-in-modal' : 'btn-out-modal'}`;
  btn.textContent = operation === 'IN' ? 'Add Stock' : 'Remove Stock';

  document.getElementById('txQty').value = '';
  document.getElementById('txModal').classList.add('open');
  setTimeout(() => document.getElementById('txQty').focus(), 100);
}

function closeTxModal() {
  document.getElementById('txModal').classList.remove('open');
  _txRow = null; _txOp = null;
}

async function submitTx() {
  const qty = parseFloat(document.getElementById('txQty').value);
  if (isNaN(qty) || qty < 0) { toast('Enter a valid quantity (0 or more)', false); return; }
  if (!_txRow || !_txOp) return;

  const btn = document.getElementById('txConfirmBtn');
  btn.disabled = true;
  btn.textContent = 'Saving...';

  const res = await fetch('/api/transaction', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filepath:  state.filePath,
      sheet:     state.selectedSheet,
      row:       _txRow,
      operation: _txOp,
      qty:       qty,
    })
  });
  const data = await res.json();

  btn.disabled = false;
  btn.textContent = _txOp === 'IN' ? 'Add Stock' : 'Remove Stock';

  if (data.success) {
    toast(`${_txOp} ${qty} — New balance: ${data.new_balance}`);
    closeTxModal();
    // Refresh to show updated Current Balance across all rows with same Color
    await selectSheet(state.selectedSheet);
  } else {
    toast(`✗ ${data.error}`, false);
  }
}

// â”€â”€ FILTER â”€â”€
function filterTable(query) {
  const q = query.trim().toLowerCase();
  const rows = document.querySelectorAll('.data-table tbody tr[data-row]');
  let visible = 0;
  rows.forEach(tr => {
    const show = !q || tr.textContent.toLowerCase().includes(q);
    tr.style.display = show ? '' : 'none';
    if (show) visible++;
  });
  const info = document.getElementById('filterInfo');
  info.textContent = q ? `${visible} of ${state.allRows.length} results` : '';
}

// â”€â”€ HELPERS â”€â”€
function showEmptyState(msg) {
  document.getElementById('tableWrap').innerHTML = `
    <div class="empty-state">
      <div class="es-icon">📂</div>
      <h3>${msg}</h3>
      <p>Select a month, file and sheet from the sidebar</p>
    </div>`;
}
function showLoading() {
  document.getElementById('tableWrap').innerHTML = `
    <div class="loading"><div class="spinner"></div><span>Loading data...</span></div>`;
}
function setStatus(msg) { document.getElementById('statusMsg').textContent = msg; }
function updateHeader(title, breadcrumb) {
  document.getElementById('contentTitle').textContent = title;
  document.getElementById('breadcrumb').textContent   = breadcrumb;
}
function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function escAttr(s) {
  return String(s).replace(/'/g,"\\'").replace(/"/g,'&quot;');
}

// â”€â”€ ACTIONS â”€â”€
function refreshData() { if (state.selectedSheet) selectSheet(state.selectedSheet); }

function printTable() {
  const table = document.querySelector('.data-table');
  if (!table) return toast('No data to print', false);
  const win = window.open('', '_blank');
  win.document.write(`<html><head><title>EST Inventory System</title>
    <style>
      body { font-family: Arial, sans-serif; direction: ltr; font-size: 12px; }
      h2 { margin-bottom: 10px; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #ccc; padding: 6px 10px; text-align: center; }
      th { background: #1a3a5c; color: white; }
      tr:nth-child(even) { background: #f5f5f5; }
      .action-cell { display: none; }
    </style></head><body>`);
  win.document.write(`<h2>${state.selectedFile} / ${state.selectedSheet} — ${state.selectedMonth} ${state.selectedYear}</h2>`);
  win.document.write(table.outerHTML);
  win.document.write('</body></html>');
  win.document.close();
  win.print();
}

function exportCSV() {
  if (!state.headers.length || !state.allRows.length) {
    toast('⚠ No data to export', false);
    return;
  }
  openCsvModal();
}

function openCsvModal() {
  const filename = state.headers.length
    ? `${state.selectedFile || 'data'}_${state.selectedSheet || 'sheet'}_${state.selectedMonth || ''}_${state.selectedYear || ''}.csv`
    : '—';
  document.getElementById('csvInfoFile').textContent    = state.selectedFile  || '—';
  document.getElementById('csvInfoSheet').textContent   = state.selectedSheet || '—';
  document.getElementById('csvInfoPeriod').textContent  = (state.selectedMonth && state.selectedYear) ? `${state.selectedMonth} ${state.selectedYear}` : '—';
  document.getElementById('csvInfoRecords').textContent = state.allRows.length ? `${state.allRows.length} rows` : '—';
  document.getElementById('csvInfoFilename').textContent = filename;
  document.getElementById('csvModalSub').textContent = state.headers.length
    ? `Export: ${state.selectedFile || ''} / ${state.selectedSheet || ''}`
    : 'No data loaded — please select a file and sheet first.';
  document.getElementById('csvModal').classList.add('open');
}

function closeCsvModal() {
  document.getElementById('csvModal').classList.remove('open');
}

function doExportCSV() {
  if (!state.headers.length) { closeCsvModal(); return; }
  const visHeaders = state.headers.filter(h => h !== '__row__');
  let csv = '\uFEFF';
  csv += visHeaders.join(',') + '\n';
  state.allRows.forEach(row => {
    const vals = visHeaders.map(h => {
      const v = row[h];
      if (v === null || v === undefined) return '';
      const s = String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g,'""')}"` : s;
    });
    csv += vals.join(',') + '\n';
  });
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `${state.selectedFile}_${state.selectedSheet}_${state.selectedMonth}_${state.selectedYear}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  closeCsvModal();
}

// â”€â”€ KEYBOARD â”€â”€
document.addEventListener('keydown', e => {
  if (e.ctrlKey && e.key === 'f') { e.preventDefault(); document.getElementById('searchInput').focus(); }
  if (e.key === 'Escape') { closeTxModal(); closeAbout(); cancelPwdModal(); closePrintModal(); closeCsvModal(); closeLogout(); closeDashboard(); closeProfileModal(); closeUsersModal(); closeAdminRequestsModal(); closeAdminUsersModal(); closeAdminUserDetailModal(); closeDeleteConfirm(); document.getElementById('reportsDropdownMenu')?.classList.remove('open'); }
});

// â”€â”€ ABOUT â”€â”€
function showAbout()  { document.getElementById('aboutModal').style.display = 'flex'; }
function closeAbout() { document.getElementById('aboutModal').style.display = 'none'; }

// â”€â”€ DELETE CONFIRM MODAL â”€â”€
let _deleteConfirmCallback = null;
function openDeleteConfirm(title, msg, callback) {
  _deleteConfirmCallback = callback;
  document.getElementById('deleteConfirmTitle').textContent = title || 'Delete?';
  document.getElementById('deleteConfirmMsg').textContent = msg || 'This action cannot be undone.';
  document.getElementById('deleteConfirmModal').style.display = 'flex';
}
function closeDeleteConfirm() {
  document.getElementById('deleteConfirmModal').style.display = 'none';
  _deleteConfirmCallback = null;
}
function _doDeleteConfirm() {
  const cb = _deleteConfirmCallback;
  closeDeleteConfirm();
  if (cb) cb();
}


function confirmLogout() {
  document.getElementById('logoutModal').classList.add('open');
}
function closeLogout() {
  document.getElementById('logoutModal').classList.remove('open');
}
function doLogout() {
window.location.href = '/logout';}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// DASHBOARD
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
let _dashData   = null;
let _dashView   = 'overview';
let _dashCharts = [];

async function openDashboard() {
  document.getElementById('dashModal').classList.add('open');
  await loadDashData();
}
function closeDashboard() {
  document.getElementById('dashModal').classList.remove('open');
  destroyDashCharts();
}

async function loadDashData() {
  setDashContent('<div class="dash-loading"><div class="spinner"></div><span>Reading Excel files...</span></div>');
  const btn = document.getElementById('dashBtn');
  if (btn) btn.disabled = false;
  try {
    const res  = await fetch('/api/dashboard', { cache: 'no-store' });
    _dashData  = await res.json();
    if (!res.ok || _dashData.error) throw new Error(_dashData.error || 'Dashboard request failed');
    dashShow(_dashView);
  } catch(e) {
    setDashContent('<div class="dash-loading">⚠ Failed to load dashboard data</div>');
  }
}

function setDashContent(html) {
  const c = document.getElementById('dashContent');
  if (c) c.innerHTML = html;
}

function destroyDashCharts() {
  _dashCharts.forEach(ch => {
    try { ch.destroy(); } catch(e) {}
  });
  _dashCharts = [];
}

function dashShow(view) {
  _dashView = view;
  // update nav active
  document.querySelectorAll('.dash-nav-item').forEach(el => el.classList.remove('active'));
  const navEl = document.getElementById('dnav-' + view);
  if (navEl) navEl.classList.add('active');
  // destroy old chart
  destroyDashCharts();

  const d = _dashData;
  if (!d) return;

  if (view === 'overview')    dashOverview(d);
  if (view === 'movement')    dashMovement(d);
  if (view === 'alerts')      dashAlerts(d);
  if (view === 'top')         dashTop(d);
  if (view === 'summary')     dashConsumptionSummary(d);
  if (view === 'zones')       dashZones(d);
  if (view === 'logactivity') dashLogActivity(d);
  if (view === 'stocktaking') dashStocktaking();
  if (view === 'excelstatus') dashExcelStatus();

  // After rendering, update countdown in the newly created element (preserves ongoing timer)
  updateDashCountdown();
}

async function dashStocktaking() {
  setDashContent(`<div class="dash-content-title">Inventory Count</div>
    <div class="dash-content-sub">Current stock balances from Stocktaking sheets.</div>
    <div class="dash-loading"><div class="spinner"></div><span>Reading Stocktaking sheets...</span></div>`);
  try {
    const zone = _dashSelectedZone && _dashSelectedZone !== 'all' ? `?zone=${_dashSelectedZone}` : '';
    const res  = await fetch('/api/dashboard/stocktaking' + zone, { cache: 'no-store' });
    const data = await res.json();
    const items = data.items || [];
    if (!items.length) {
      setDashContent(`<div class="dash-content-title">Inventory Count</div>
        <div class="dash-content-sub">No Stocktaking sheet found in the current scope.</div>
        <div class="dash-empty">No data available. Make sure the Excel files contain a sheet named "Stocktaking".</div>`);
      return;
    }
    const zeroCount = items.filter(i => i.balance <= 0).length;
    const lowCount  = items.filter(i => i.balance > 0 && i.balance < 10).length;
    const rows = items.map((it, idx) => {
      const cls = it.balance <= 0 ? 'row-out' : it.balance < 10 ? '' : '';
      const balColor = it.balance <= 0 ? 'color:#ef4444;font-weight:700'
                     : it.balance < 10 ? 'color:#f59e0b;font-weight:600'
                     : 'color:var(--text-main)';
      return `<tr class="${cls}">
        <td class="row-num">${idx + 1}</td>
        <td style="font-weight:600">${escHtml(it.name)}</td>
        <td>${escHtml(it.category)}</td>
        <td>${escHtml(it.color)}</td>
        <td>${escHtml(it.size)}</td>
        <td style="${balColor};text-align:center">${it.balance}</td>
        <td style="font-size:10px;color:var(--text-dim)">${escHtml(it.zone)}</td>
      </tr>`;
    }).join('');
    setDashContent(`<div class="dash-content-title">Inventory Count</div>
      <div class="dash-content-sub">${items.length} items · ${data.files_scanned} file(s) scanned</div>
      <div class="dash-kpi-grid" style="margin-bottom:20px;">
        <div class="dash-kpi-card blue"><div class="dash-kpi-label">Total Items</div><div class="dash-kpi-value">${items.length}</div></div>
        <div class="dash-kpi-card red"><div class="dash-kpi-label">Zero Stock</div><div class="dash-kpi-value">${zeroCount}</div></div>
        <div class="dash-kpi-card amber"><div class="dash-kpi-label">Low Stock (&lt;10)</div><div class="dash-kpi-value">${lowCount}</div></div>
      </div>
      <div class="dash-summary-toolbar">
        <span style="font-size:12px;color:var(--text-muted)">🔴 Zero &nbsp; 🟡 Low Stock (&lt;10)</span>
        <button class="dash-print-btn" onclick="printStocktaking()">🖨 Print Count Sheet</button>
      </div>
      <div class="dash-zone-table-wrap" id="stocktakingTableWrap">
        <table class="dash-zone-table">
          <thead><tr><th>#</th><th>Item</th><th>Category</th><th>Color</th><th>Size</th><th>Balance</th><th>Zone</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`);
  } catch(e) {
    setDashContent(`<div class="dash-content-title">Inventory Count</div><div class="dash-empty">Failed to load stocktaking data.</div>`);
  }
}

function printStocktaking() {
  const wrap = document.getElementById('stocktakingTableWrap');
  if (!wrap) return;
  const win = window.open('', '_blank');
  win.document.write(`<html><head><title>Inventory Count — EST-iMs</title>
    <style>body{font-family:Arial,sans-serif;font-size:12px;}
    table{border-collapse:collapse;width:100%;}th,td{border:1px solid #ccc;padding:5px 8px;}
    th{background:#0F2137;color:#fff;}tr:nth-child(even){background:#f5f5f5;}
    .zero{background:#fee2e2!important;}h2{margin-bottom:8px;}</style></head>
    <body><h2>Inventory Count Sheet — EST-iMs</h2>${wrap.innerHTML}</body></html>`);
  win.document.close();
  win.print();
}
async function dashExcelStatus() {
  setDashContent(`<div class="dash-content-title">Excel Link Status</div><div class="dash-loading"><div class="spinner"></div><span>Checking Excel connection...</span></div>`);
  try {
    const res = await fetch('/api/dashboard/excel_status', { cache:'no-store' });
    const data = await res.json();
    const ok = !!data.connected;
    setDashContent(`<div class="dash-content-title">Excel Link Status</div>
      <div class="dash-content-sub">Live file availability check.</div>
      <div class="dash-kpi-grid">
        <div class="dash-kpi-card ${ok ? 'green' : 'red'}"><div class="dash-kpi-label">Connection</div><div class="dash-kpi-value">${ok ? 'Connected' : 'Failed'}</div><div class="dash-kpi-sub">${escHtml(data.message || '')}</div></div>
        <div class="dash-kpi-card blue"><div class="dash-kpi-label">Last Update</div><div class="dash-kpi-value">${ok ? escHtml(String(data.minutes_ago)) + 'm' : '-'}</div><div class="dash-kpi-sub">${escHtml(data.last_update || '')}</div></div>
      </div>
      <div class="dash-chart-wrap"><div class="dash-chart-title">Source file</div><div class="dash-empty">${escHtml(data.file || 'No Excel file found')}</div></div>`);
  } catch(e) {
    setDashContent(`<div class="dash-content-title">Excel Link Status</div><div class="dash-empty">Failed to read Excel status.</div>`);
  }
}
/* â”€â”€ OVERVIEW â”€â”€ */
function dashOverview(d) {
  const kpis = [
    { label:'Total Items',     value: d.total_items   ?? '—', sub:'across all sheets',   cls:'blue'  },
    { label:'Total IN',        value: d.total_in      ?? '—', sub:'all time',             cls:'green' },
    { label:'Total OUT',       value: d.total_out     ?? '—', sub:'all time',             cls:'red'   },
    { label:'Low Stock Items', value: d.low_stock     ?? '—', sub:'below threshold',      cls:'amber' },
    { label:'Zero Stock',      value: d.zero_stock    ?? '—', sub:'need restocking',      cls:'red'   },
  ];
  const kpiHtml = kpis.map(k => `
    <div class="dash-kpi-card ${k.cls}">
      <div class="dash-kpi-label">${k.label}</div>
      <div class="dash-kpi-value">${k.value}</div>
      <div class="dash-kpi-sub">${k.sub}</div>
    </div>`).join('');

  setDashContent(`
    <button class="dash-close-btn" onclick="closeDashboard()">✕</button>
    <div class="dash-content-title">Overview</div>
    <div class="dash-content-sub">Summary of current inventory status</div>
    <div class="dash-kpi-grid">${kpiHtml}</div>
    <div class="dash-chart-wrap">
      <div class="dash-chart-title">IN vs OUT — Current Data</div>
      <canvas id="dashChartCanvas"></canvas>
    </div>`);

  // Bar chart IN vs OUT per zone
  const labels = Object.keys(d.zone_in || {});
  const ins    = labels.map(z => d.zone_in[z]  || 0);
  const outs   = labels.map(z => d.zone_out[z] || 0);
  drawChart('bar', labels, [
    { label:'IN',  data: ins,  backgroundColor:'rgba(16,185,129,0.7)'  },
    { label:'OUT', data: outs, backgroundColor:'rgba(239,68,68,0.7)'   },
  ]);
}

/* â”€â”€ MOVEMENT â”€â”€ */
function dashMovement(d) {
  setDashContent(`
    <button class="dash-close-btn" onclick="closeDashboard()">✕</button>
    <div class="dash-content-title">IN / OUT Movement</div>
    <div class="dash-content-sub">Stock movement breakdown by zone</div>
    <div class="dash-chart-wrap">
      <div class="dash-chart-title">IN per Zone</div>
      <canvas id="dashChartCanvas"></canvas>
    </div>
    <div class="dash-chart-wrap" style="margin-top:0;">
      <div class="dash-chart-title">OUT per Zone</div>
      <canvas id="dashChartCanvas2"></canvas>
    </div>`);

  const labels = Object.keys(d.zone_in || {});
  const ins    = labels.map(z => d.zone_in[z]  || 0);
  const outs   = labels.map(z => d.zone_out[z] || 0);

  _dashChart = new Chart(document.getElementById('dashChartCanvas'), {
    type: 'bar',
    data: { labels, datasets: [{ label:'IN', data: ins, backgroundColor:'rgba(16,185,129,0.75)', borderRadius:6 }] },
    options: chartOpts('IN Quantity')
  });
  new Chart(document.getElementById('dashChartCanvas2'), {
    type: 'bar',
    data: { labels, datasets: [{ label:'OUT', data: outs, backgroundColor:'rgba(239,68,68,0.75)', borderRadius:6 }] },
    options: chartOpts('OUT Quantity')
  });
}

/* â”€â”€ ALERTS â”€â”€ */
function dashAlerts(d) {
  const items = d.alerts || [];
  const rows = items.length
    ? items.map(a => `
        <div class="dash-alert-item ${a.level}">
          <div class="dash-alert-icon">${a.level==='danger'?'🔴':'🟡'}</div>
          <div class="dash-alert-text">
            <div class="dash-alert-name">${escHtml(a.name)}</div>
            <div class="dash-alert-desc">${escHtml(a.sheet||'')} — Balance: ${a.balance}</div>
          </div>
          <div class="dash-alert-badge ${a.level==='danger'?'red':'amber'}">${a.level==='danger'?'ZERO':'LOW'}</div>
        </div>`)
      .join('')
    : '<div class="dash-loading"> All items have sufficient stock</div>';

  setDashContent(`
    <button class="dash-close-btn" onclick="closeDashboard()">✕</button>
    <div class="dash-content-title">Stock Alerts</div>
    <div class="dash-content-sub">${items.length} item(s) need attention</div>
    <div class="dash-alert-list">${rows}</div>`);
}

/* â”€â”€ TOP ITEMS â”€â”€ */
function dashTop(d) {
  const items  = (d.top_items || []).slice(0, 10);
  const labels = items.map(i => i.name);
  const vals   = items.map(i => i.out);

  setDashContent(`
    <button class="dash-close-btn" onclick="closeDashboard()">✕</button>
    <div class="dash-content-title">Top Items by Consumption</div>
    <div class="dash-content-sub">Items with highest OUT quantity</div>
    <div class="dash-chart-wrap">
      <div class="dash-chart-title">Top 10 Most Consumed Items</div>
      <canvas id="dashChartCanvas"></canvas>
    </div>`);

  drawChart('bar', labels, [
    { label:'OUT Qty', data: vals, backgroundColor:'rgba(59,130,246,0.75)', borderRadius:6 }
  ], { indexAxis: 'y' });
}

/* â”€â”€ ZONES â”€â”€ */
function dashZones(d) {
  const zones  = Object.keys(d.zone_in || {});
  const rows   = zones.map(z => `
    <tr>
      <td>${escHtml(z)}</td>
      <td style="color:var(--accent-green);font-weight:600;">${d.zone_in[z]  || 0}</td>
      <td style="color:var(--accent-red);font-weight:600;">${d.zone_out[z] || 0}</td>
      <td style="color:var(--accent-cyan);font-weight:600;">${(d.zone_in[z]||0) - (d.zone_out[z]||0)}</td>
    </tr>`).join('');

  setDashContent(`
    <button class="dash-close-btn" onclick="closeDashboard()">✕</button>
    <div class="dash-content-title">Zones Summary</div>
    <div class="dash-content-sub">IN / OUT breakdown per zone</div>
    <div class="dash-chart-wrap" style="padding:0;overflow:hidden;">
      <table class="dash-zone-table">
        <thead><tr><th>Zone</th><th>Total IN</th><th>Total OUT</th><th>Net</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div class="dash-chart-wrap" style="margin-top:16px;">
      <div class="dash-chart-title">Zone Comparison</div>
      <canvas id="dashChartCanvas"></canvas>
    </div>`);

  const ins  = zones.map(z => d.zone_in[z]  || 0);
  const outs = zones.map(z => d.zone_out[z] || 0);
  drawChart('bar', zones, [
    { label:'IN',  data: ins,  backgroundColor:'rgba(16,185,129,0.7)'  },
    { label:'OUT', data: outs, backgroundColor:'rgba(239,68,68,0.7)'   },
  ]);
}

/* â”€â”€ CHART HELPERS â”€â”€ */
function chartOpts(yLabel='') {
  return {
    responsive:true, maintainAspectRatio:true,
    plugins:{ legend:{ labels:{ color:'#8b9db8', font:{size:11} } } },
    scales:{
      x:{ ticks:{color:'#8b9db8'}, grid:{color:'rgba(255,255,255,0.05)'} },
      y:{ ticks:{color:'#8b9db8'}, grid:{color:'rgba(255,255,255,0.05)'}, title:{display:!!yLabel,text:yLabel,color:'#8b9db8'} }
    }
  };
}
function drawChart(type, labels, datasets, extra={}) {
  const canvas = document.getElementById('dashChartCanvas');
  if (!canvas) return;
  if (_dashChart) { _dashChart.destroy(); _dashChart = null; }
  _dashChart = new Chart(canvas, {
    type,
    data: { labels, datasets: datasets.map(ds => ({...ds, borderRadius:6})) },
    options: { ...chartOpts(), ...extra,
      responsive:true, maintainAspectRatio:true,
      plugins:{ legend:{ labels:{ color:'#8b9db8', font:{size:11} } } },
      scales:{
        x:{ ticks:{color:'#8b9db8'}, grid:{color:'rgba(255,255,255,0.05)'} },
        y:{ ticks:{color:'#8b9db8'}, grid:{color:'rgba(255,255,255,0.05)'} }
      }
    }
  });
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function fmtDashNum(v) {
  const n = Number(v || 0);
  return Number.isInteger(n) ? n.toLocaleString() : n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function dashHeader(title, sub) {
  const d = _dashData || {};
  return `
    <div class="dash-top-row">
      <div>
        <div class="dash-content-title">${escHtml(String(title))}</div>
        <div class="dash-content-sub">${escHtml(String(sub))}</div>
      </div>
      <div class="dash-actions">
        <button class="dash-refresh-btn" id="dashRefreshBtn" onclick="loadDashData(false, true)">Refresh</button>
      </div>
    </div>
    <div class="dash-meta-grid">
      <div class="dash-meta-card"><div class="dash-meta-label">Scope</div><div class="dash-meta-value">${escHtml(String(d.scope || 'Current zone'))}</div></div>
      <div class="dash-meta-card"><div class="dash-meta-label">Excel files</div><div class="dash-meta-value">${fmtDashNum(d.file_count)} scanned</div></div>
      <div class="dash-meta-card"><div class="dash-meta-label">Last file update</div><div class="dash-meta-value">${escHtml(String(d.latest_file_update || 'N/A'))}</div></div>
      <div class="dash-meta-card"><div class="dash-meta-label">Dashboard refresh</div><div class="dash-meta-value">${escHtml(String(d.generated_at || 'N/A'))}</div></div>
    </div>`;
}

function dashKpi(label, value, sub, cls) {
  return `<div class="dash-kpi-card ${cls}"><div class="dash-kpi-label">${escHtml(String(label))}</div><div class="dash-kpi-value">${escHtml(String(value))}</div><div class="dash-kpi-sub">${escHtml(String(sub))}</div></div>`;
}

function dashOverview(d) {
  const labels = Object.keys(d.zone_in || {});
  const kpis = [
    dashKpi('Total Items', fmtDashNum(d.total_items), 'Item rows found in Other+ and Sacks', 'blue'),
    dashKpi('Total IN', fmtDashNum(d.total_in), 'Total received quantity from IN columns', 'green'),
    dashKpi('Total OUT', fmtDashNum(d.total_out), 'Total issued/consumed quantity from OUT columns', 'red'),
    dashKpi('Net Movement', fmtDashNum((d.total_in || 0) - (d.total_out || 0)), 'IN minus OUT', 'cyan'),
    dashKpi('Low Stock', fmtDashNum(d.low_stock), 'Items below stock threshold', 'amber'),
    dashKpi('Zero Stock', fmtDashNum(d.zero_stock), 'Items with zero current balance', 'red'),
  ].join('');
  setDashContent(`${dashHeader('Dashboard Overview', 'Live summary based on current Excel files')}<div class="dash-kpi-grid">${kpis}</div><div class="dash-chart-wrap"><div class="dash-chart-title">IN vs OUT by Zone</div>${labels.length ? '<canvas id="dashChartCanvas"></canvas>' : '<div class="dash-empty">No movement data found yet.</div>'}</div>`);
  if (labels.length) {
    drawDashChart('dashChartCanvas', 'bar', labels, [
      { label:'IN', data: labels.map(z => d.zone_in[z] || 0), backgroundColor:'rgba(16,185,129,0.7)' },
      { label:'OUT', data: labels.map(z => d.zone_out[z] || 0), backgroundColor:'rgba(239,68,68,0.7)' },
    ]);
  }
}

function dashMovement(d) {
  const labels = Object.keys(d.zone_in || {});
  setDashContent(`${dashHeader('Movement Analysis', 'Compare received and issued quantities across zones')}<div class="dash-section-grid"><div class="dash-chart-wrap"><div class="dash-chart-title">IN per Zone</div>${labels.length ? '<canvas id="dashChartCanvas"></canvas>' : '<div class="dash-empty">No IN data available.</div>'}</div><div class="dash-chart-wrap"><div class="dash-chart-title">OUT per Zone</div>${labels.length ? '<canvas id="dashChartCanvas2"></canvas>' : '<div class="dash-empty">No OUT data available.</div>'}</div></div>`);
  if (labels.length) {
    drawDashChart('dashChartCanvas', 'bar', labels, [{ label:'IN', data: labels.map(z => d.zone_in[z] || 0), backgroundColor:'rgba(16,185,129,0.75)' }], {}, 'IN Quantity');
    drawDashChart('dashChartCanvas2', 'bar', labels, [{ label:'OUT', data: labels.map(z => d.zone_out[z] || 0), backgroundColor:'rgba(239,68,68,0.75)' }], {}, 'OUT Quantity');
  }
}

function dashAlerts(d) {
  const items = d.alerts || [];
  const rows = items.length ? items.map(a => `<div class="dash-alert-item ${a.level}"><div class="dash-alert-icon">${a.level === 'danger' ? '!' : 'i'}</div><div class="dash-alert-text"><div class="dash-alert-name">${escHtml(String(a.name || 'Item'))}</div><div class="dash-alert-desc">${escHtml(String(a.sheet || ''))} - Balance: ${fmtDashNum(a.balance)}</div></div><div class="dash-alert-badge ${a.level === 'danger' ? 'red' : 'amber'}">${a.level === 'danger' ? 'ZERO' : 'LOW'}</div></div>`).join('') : '<div class="dash-empty">No low-stock or zero-stock items found.</div>';
  setDashContent(`${dashHeader('Stock Alerts', `${items.length} item(s) need attention`)}<div class="dash-alert-list compact">${rows}</div>`);
}

function dashTop(d) {
  // Prefer Log sheet top items (actual operations), fallback to inventory columns
  const hasLog = (d.log_ops_count || 0) > 0;
  const rawItems = hasLog && (d.log_top_items || []).length > 0
    ? d.log_top_items
    : (d.top_items || []);
  const items = rawItems.slice(0, 10);
  const labels = items.map(i => i.name);
  const rows = items.map((item, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td class="item-name-cell"><strong>${escHtml(item.name || 'Unnamed item')}</strong></td>
      <td style="color:var(--accent-red);font-weight:700;font-family:'JetBrains Mono',monospace;">${fmtDashNum(item.out)} OUT</td>
    </tr>`).join('');
  setDashContent(`${dashHeader('Top Items by Consumption', 'Items with the highest OUT quantity')}
    <div class="dash-chart-wrap">
      <div class="dash-chart-title">Top 10 Most Consumed Items</div>
      ${items.length ? '<canvas id="dashChartCanvas"></canvas>' : '<div class="dash-empty">No OUT movement found yet.</div>'}
    </div>
    <div class="dash-chart-wrap dash-zone-table-wrap" style="padding:0;overflow:hidden;">
      <table class="dash-zone-table">
        <thead><tr><th>#</th><th>Item Name</th><th>OUT Quantity</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="3">No OUT movement found yet.</td></tr>'}</tbody>
      </table>
    </div>`);
  if (items.length) drawDashChart('dashChartCanvas', 'bar', labels, [{ label:'OUT Qty', data: items.map(i => i.out), backgroundColor:'rgba(59,130,246,0.75)' }], { indexAxis:'y' });
}

function dashConsumptionSummary(d) {
  const items = (d.top_items || []).slice(0, 15);
  const leaders = Object.entries(d.zone_consumption || {});
  const topItem = items[0] || null;
  const lowItem = [...items].reverse().find(item => Number(item.out || 0) > 0) || null;
  const rows = items.map((item, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td class="item-name-cell">${escHtml(item.name || 'Unnamed item')}</td>
      <td style="color:var(--accent-red);font-weight:700;font-family:'JetBrains Mono',monospace;">${fmtDashNum(item.out)}</td>
    </tr>`).join('');
  const leaderRows = leaders.map(([zone, info]) => `
    <tr>
      <td>${escHtml(zone)}</td>
      <td class="item-name-cell">${escHtml(info.top?.name || 'N/A')}<br><span style="color:var(--text-muted);font-size:11px;">${fmtDashNum(info.top?.out)} OUT</span></td>
      <td class="item-name-cell">${escHtml(info.lowest?.name || 'N/A')}<br><span style="color:var(--text-muted);font-size:11px;">${fmtDashNum(info.lowest?.out)} OUT</span></td>
      <td>${fmtDashNum(info.moving_items)} item(s)</td>
    </tr>`).join('');

  setDashContent(`
    ${dashHeader('Consumption Summary', 'Printable OUT summary by selected zone')}
    <div id="consumptionSummaryPrint">
      <div class="dash-summary-toolbar">
        <div class="dash-content-sub" style="margin:0;">Scope: ${escHtml(String(d.scope || 'Current zone'))} | Generated: ${escHtml(String(d.generated_at || 'N/A'))}</div>
        <button class="dash-print-btn" onclick="printConsumptionSummary()">Print Summary</button>
      </div>
      <div class="dash-kpi-grid">
        ${dashKpi('Total OUT', fmtDashNum(d.total_out), 'Selected scope consumption', 'red')}
        ${dashKpi('Moving Items', fmtDashNum(items.length), 'Items with OUT movement', 'blue')}
        ${dashKpi('Most Consumed', topItem ? topItem.name : 'No item', topItem ? (fmtDashNum(topItem.out) + ' OUT') : 'No item', 'amber')}
        ${dashKpi('Least Consumed', lowItem ? lowItem.name : 'No item', lowItem ? (fmtDashNum(lowItem.out) + ' OUT') : 'No item', 'cyan')}
      </div>
      <div class="dash-chart-wrap dash-zone-table-wrap" style="padding:0;overflow:hidden;">
        <table class="dash-zone-table">
          <thead><tr><th>#</th><th>Item Name</th><th>OUT Quantity</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="3">No consumption data found.</td></tr>'}</tbody>
        </table>
      </div>
      ${leaders.length > 1 ? `<div class="dash-chart-wrap dash-zone-table-wrap" style="padding:0;overflow:hidden;"><table class="dash-zone-table"><thead><tr><th>Zone</th><th>Most Consumed</th><th>Least Consumed</th><th>Moving Items</th></tr></thead><tbody>${leaderRows}</tbody></table></div>` : ''}
    </div>`);
}

function printConsumptionSummary() {
  const section = document.getElementById('consumptionSummaryPrint');
  if (!section) return;
  const win = window.open('', '_blank', 'width=960,height=720');
  if (!win) return;
  win.document.write(`<!doctype html><html><head><title>Consumption Summary</title><style>
    body{font-family:Arial,sans-serif;color:#111;padding:24px;}
    h1{font-size:20px;margin:0 0 16px;}
    table{width:100%;border-collapse:collapse;margin-top:14px;font-size:12px;}
    th,td{border:1px solid #d1d5db;padding:8px;text-align:left;vertical-align:top;}
    th{background:#f3f4f6;}
    .dash-kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:16px 0;}
    .dash-kpi-card{border:1px solid #d1d5db;border-radius:8px;padding:10px;}
    .dash-kpi-label,.dash-kpi-sub,.dash-content-sub{color:#4b5563;font-size:11px;}
    .dash-kpi-value{font-size:18px;font-weight:700;margin:6px 0;}
    button,.dash-countdown,.dash-refresh-btn,.dash-zone-select{display:none!important;}
  </style></head><body><h1>Consumption Summary</h1>${section.innerHTML}</body></html>`);
  win.document.close();
  win.focus();
  win.print();
}

function dashZones(d) {
  const zones = Array.from(new Set([...Object.keys(d.zone_in || {}), ...Object.keys(d.zone_out || {}), ...Object.keys(d.zone_items || {})]));
  const rows = zones.map(z => `<tr><td>${escHtml(String(z))}</td><td>${fmtDashNum((d.zone_files || {})[z])}</td><td>${fmtDashNum((d.zone_items || {})[z])}</td><td style="color:var(--accent-green);font-weight:600;">${fmtDashNum((d.zone_in || {})[z])}</td><td style="color:var(--accent-red);font-weight:600;">${fmtDashNum((d.zone_out || {})[z])}</td><td style="color:var(--accent-cyan);font-weight:600;">${fmtDashNum(((d.zone_in || {})[z] || 0) - ((d.zone_out || {})[z] || 0))}</td></tr>`).join('');
  setDashContent(`${dashHeader('Zones Summary', 'Files, rows, IN, OUT, and net movement per zone')}<div class="dash-chart-wrap dash-zone-table-wrap" style="padding:0;overflow:hidden;"><table class="dash-zone-table"><thead><tr><th>Zone</th><th>Files</th><th>Items</th><th>Total IN</th><th>Total OUT</th><th>Net</th></tr></thead><tbody>${rows || '<tr><td colspan="6">No zone data found.</td></tr>'}</tbody></table></div><div class="dash-chart-wrap" style="margin-top:16px;"><div class="dash-chart-title">Zone Comparison</div>${zones.length ? '<canvas id="dashChartCanvas"></canvas>' : '<div class="dash-empty">No zone movement available.</div>'}</div>`);
  if (zones.length) drawDashChart('dashChartCanvas', 'bar', zones, [
    { label:'IN', data: zones.map(z => (d.zone_in || {})[z] || 0), backgroundColor:'rgba(16,185,129,0.7)' },
    { label:'OUT', data: zones.map(z => (d.zone_out || {})[z] || 0), backgroundColor:'rgba(239,68,68,0.7)' },
  ]);
}

/* ── LOG ACTIVITY ── */
function dashLogActivity(d) {
  const logItems = (d.log_top_items || []).slice(0, 12);
  const daily    = d.log_daily_out || {};
  const recent   = (d.log_recent_ops || []).slice(0, 25);
  const dailyKeys = Object.keys(daily).sort();

  const topRows = logItems.map((item, i) => {
    const pct = logItems[0]?.out > 0 ? Math.round((item.out / logItems[0].out) * 100) : 0;
    return `<tr>
      <td style="color:var(--text-dim);font-size:11px;">${i + 1}</td>
      <td><strong>${escHtml(item.name)}</strong></td>
      <td style="color:var(--accent-red);font-weight:700;font-family:'JetBrains Mono',monospace;">${fmtDashNum(item.out)}</td>
      <td style="min-width:80px;">
        <div style="background:rgba(239,68,68,0.15);border-radius:4px;overflow:hidden;height:8px;">
          <div style="background:rgba(239,68,68,0.75);height:100%;width:${pct}%;border-radius:4px;"></div>
        </div>
      </td>
    </tr>`;
  }).join('');

  const recentRows = recent.map(op => {
    const isOut = op.op === 'OUT';
    return `<div class="dash-alert-item" style="padding:8px 12px;gap:10px;">
      <div style="font-size:10px;font-weight:800;color:${isOut ? 'var(--accent-red)' : 'var(--accent-green)'};min-width:30px;text-align:center;">${escHtml(op.op)}</div>
      <div class="dash-alert-text">
        <div class="dash-alert-name" style="font-size:12px;">${escHtml(op.item)}</div>
        <div class="dash-alert-desc">${escHtml(op.time)} · ${escHtml(op.zone)}</div>
      </div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;color:${isOut ? 'var(--accent-red)' : 'var(--accent-green)'};">${fmtDashNum(op.qty)}</div>
    </div>`;
  }).join('');

  const hasItems  = logItems.length > 0;
  const hasDaily  = dailyKeys.length > 0;
  const hasRecent = recent.length > 0;
  const noData = !hasItems && !hasRecent;

  setDashContent(`
    ${dashHeader('Log Activity', 'Actual IN/OUT operations read from Log sheets')}
    <div class="dash-kpi-grid">
      ${dashKpi('Operations', fmtDashNum(d.log_ops_count), 'Total log records', 'blue')}
      ${dashKpi('Total OUT', fmtDashNum(d.log_total_out), 'Issued from Log', 'red')}
      ${dashKpi('Total IN',  fmtDashNum(d.log_total_in),  'Received from Log', 'green')}
      ${dashKpi('Items Moving', fmtDashNum(logItems.length), 'Unique items with OUT', 'cyan')}
    </div>
    ${noData ? '<div class="dash-empty">No Log sheet data found. Make sure the Excel files have a sheet named "Log" with IN/OUT operations.</div>' : `
    <div class="dash-section-grid">
      <div class="dash-chart-wrap">
        <div class="dash-chart-title">Most Withdrawn Items (from Log)</div>
        ${hasItems ? '<canvas id="dashChartCanvas" style="max-height:260px;"></canvas>' : '<div class="dash-empty">No OUT entries in Log yet.</div>'}
      </div>
      <div class="dash-chart-wrap">
        <div class="dash-chart-title">Daily OUT Trend</div>
        ${hasDaily ? '<canvas id="dashChartCanvas2" style="max-height:260px;"></canvas>' : '<div class="dash-empty">No date data in Log yet.</div>'}
      </div>
    </div>
    ${hasItems ? `
    <div class="dash-chart-wrap dash-zone-table-wrap" style="padding:0;overflow:hidden;">
      <table class="dash-zone-table">
        <thead><tr><th>#</th><th>Item</th><th>Total OUT</th><th>Share</th></tr></thead>
        <tbody>${topRows}</tbody>
      </table>
    </div>` : ''}
    ${hasRecent ? `
    <div class="dash-chart-wrap">
      <div class="dash-chart-title">Recent Operations (latest ${recent.length})</div>
      <div style="max-height:220px;overflow-y:auto;padding:4px 0;">${recentRows}</div>
    </div>` : ''}`}
  `);

  if (hasItems) {
    drawDashChart('dashChartCanvas', 'bar',
      logItems.map(i => i.name.length > 22 ? i.name.slice(0, 20) + '…' : i.name),
      [{ label: 'OUT Qty', data: logItems.map(i => i.out), backgroundColor: 'rgba(239,68,68,0.75)' }],
      { indexAxis: 'y' }
    );
  }
  if (hasDaily) {
    drawDashChart('dashChartCanvas2', 'line', dailyKeys, [{
      label: 'OUT / Day',
      data: dailyKeys.map(k => daily[k]),
      borderColor: 'rgba(239,68,68,0.9)',
      backgroundColor: 'rgba(239,68,68,0.12)',
      fill: true, tension: 0.35, pointRadius: 4,
    }]);
  }
}

function drawDashChart(canvasId, type, labels, datasets, extra={}, yLabel='') {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const chart = new Chart(canvas, {
    type,
    data: { labels, datasets: datasets.map(ds => ({...ds, borderRadius:6})) },
    options: {
      responsive:true,
      maintainAspectRatio:false,
      ...extra,
      plugins:{ legend:{ labels:{ color:'#8b9db8', font:{size:11}, usePointStyle:true } }, tooltip:{ mode:'index', intersect:false } },
      scales:{ x:{ ticks:{color:'#8b9db8'}, grid:{color:'rgba(255,255,255,0.05)'} }, y:{ ticks:{color:'#8b9db8'}, grid:{color:'rgba(255,255,255,0.05)'}, title:{display:!!yLabel,text:yLabel,color:'#8b9db8'} } }
    }
  });
  _dashCharts.push(chart);
}

// DASHBOARD FINAL OVERRIDES
let _dashSelectedZone   = 'all';
let _dashSelectedFile   = 'both';    // 'both' | 'sacks' | 'others'
let _dashSelectedSheet  = '';        // sheet name, e.g. 'Chicken'
let _dashAvailableSheets = [];       // cached sheet list for current file
let _dashAutoTimer = null;
let _dashRefreshRemaining = 1800;
let _dashLastSignature = '';
let _dashSoundArmed = false;

function dashboardSignature(d) {
  return [d.latest_file_update || '', d.total_in || 0, d.total_out || 0, d.low_stock || 0, d.zero_stock || 0, d.scope || ''].join('|');
}

function startDashboardAutoRefresh() {
  clearInterval(_dashAutoTimer);
  _dashRefreshRemaining = 1800;
  updateDashCountdown();
  _dashAutoTimer = setInterval(() => {
    const modal = document.getElementById('dashModal');
    if (!modal || !modal.classList.contains('open')) return;
    _dashRefreshRemaining -= 1;
    if (_dashRefreshRemaining <= 0) {
      _dashRefreshRemaining = 1800;
      loadDashData(false, true);
    }
    updateDashCountdown();
  }, 1000);
}

function updateDashCountdown() {
  const el = document.getElementById('dashCountdown');
  if (!el) return;
  const seconds = Math.max(0, Number(_dashRefreshRemaining || 0));
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  el.textContent = `Next refresh in ${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

async function playDashboardAlertSound(d) {
  const hasRisk = (d.zero_stock || 0) > 0 || (d.low_stock || 0) > 0 || (d.high_usage_items || []).length > 0;
  if (!hasRisk || !_dashSoundArmed) return;
  try {
    const audio = new Audio('/static/audio/alert.mp3');
    audio.volume = 0.65;
    await audio.play();
  } catch(e) {}
}

async function openDashboard() {
  _dashSoundArmed = true;
  document.getElementById('dashModal').classList.add('open');
  await loadDashData();
  startDashboardAutoRefresh();
}

function closeDashboard() {
  document.getElementById('dashModal').classList.remove('open');
  clearInterval(_dashAutoTimer);
  _dashAutoTimer = null;
  destroyDashCharts();
}

async function loadDashData(silent=false, isAuto=false) {
  const refreshBtn = document.getElementById('dashRefreshBtn');
  if (refreshBtn) { refreshBtn.disabled = true; refreshBtn.textContent = 'Refreshing...'; }
  if (!silent) setDashContent('<div class="dash-loading"><div class="spinner"></div><span>Refreshing dashboard...</span></div>');
  try {
    const qp = new URLSearchParams();
    if (_dashSelectedZone && _dashSelectedZone !== 'all') qp.set('zone', _dashSelectedZone);
    if (_dashSelectedFile && _dashSelectedFile !== 'both') qp.set('file', _dashSelectedFile);
    if (_dashSelectedSheet) qp.set('sheet', _dashSelectedSheet);
    const query = qp.toString() ? '?' + qp.toString() : '';
    const res = await fetch('/api/dashboard' + query, { cache: 'no-store' });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'Dashboard request failed');
    const nextSignature = dashboardSignature(data);
    const changed = _dashLastSignature && nextSignature !== _dashLastSignature;
    _dashLastSignature = nextSignature;
    _dashData = data;
    // Only reset countdown on actual data fetch (not view switches)
    _dashRefreshRemaining = 1800;
    dashShow(_dashView);
    updateDashCountdown();
    if (!silent || changed) playDashboardAlertSound(data);
  } catch(e) {
    if (!silent) setDashContent(`<div class="dash-empty">Failed to load dashboard data.<br>${escHtml(String(e.message || e))}</div>`);
  } finally {
    const nextBtn = document.getElementById('dashRefreshBtn');
    if (nextBtn) { nextBtn.disabled = false; nextBtn.textContent = 'Refresh'; }
  }
}

// View switch does NOT reset the countdown — timer continues
const _origDashShow_wrapped = dashShow;

function onDashZoneChange(value) {
  _dashSelectedZone = value || 'all';
  _dashLastSignature = '';
  loadDashData();
}
async function onDashFileChange(value) {
  _dashSelectedFile    = value || 'both';
  _dashSelectedSheet   = '';
  _dashAvailableSheets = [];
  _dashLastSignature   = '';
  if (_dashSelectedFile !== 'both') {
    try {
      const r = await fetch(`/api/dashboard/sheets?file=${encodeURIComponent(_dashSelectedFile)}`, { cache: 'no-store' });
      const d = await r.json();
      _dashAvailableSheets = d.sheets || [];
    } catch(e) { _dashAvailableSheets = []; }
  }
  loadDashData();
}
function onDashSheetChange(value) {
  _dashSelectedSheet = value || '';
  _dashLastSignature = '';
  loadDashData();
}

function dashHeader(title, sub) {
  const d = _dashData || {};
  const options = (d.dashboard_zones || []).map(z => `<option value="${escHtml(String(z.id))}" ${String(z.id) === String(d.selected_zone || _dashSelectedZone) ? 'selected' : ''}>${escHtml(String(z.name || z.id))}</option>`).join('');
  const selector = options ? `<select class="dash-zone-select" onchange="onDashZoneChange(this.value)">${options}</select>` : '';
  const selFile  = _dashSelectedFile || 'both';
  const fileSelector = `<select class="dash-zone-select" onchange="onDashFileChange(this.value)" title="Filter by file">
    <option value="both"   ${selFile === 'both'   ? 'selected' : ''}>Both Files</option>
    <option value="sacks"  ${selFile === 'sacks'  ? 'selected' : ''}>Sacks</option>
    <option value="others" ${selFile === 'others' ? 'selected' : ''}>Others+</option>
  </select>`;
  return `
    <div class="dash-top-row">
      <div>
        <div class="dash-content-title">${escHtml(String(title))}</div>
        <div class="dash-content-sub">${escHtml(String(sub))}</div>
      </div>
      <div class="dash-actions">
        ${selector}
        ${fileSelector}
        <span class="dash-countdown" id="dashCountdown">Next refresh in 01:00</span>
        <button class="dash-refresh-btn" id="dashRefreshBtn" onclick="loadDashData(false, true)">Refresh</button>
      </div>
    </div>
    <div class="dash-meta-grid">
      <div class="dash-meta-card"><div class="dash-meta-label">Scope</div><div class="dash-meta-value">${escHtml(String(d.scope || 'Current zone'))}</div></div>
      <div class="dash-meta-card"><div class="dash-meta-label">Files scanned</div><div class="dash-meta-value">${fmtDashNum(d.file_count)} Excel files</div><div class="dash-meta-sub" style="font-size:10px;color:var(--text-dim);">across all months</div></div>
      <div class="dash-meta-card"><div class="dash-meta-label">Last file update</div><div class="dash-meta-value">${escHtml(String(d.latest_file_update || 'N/A'))}</div></div>
      <div class="dash-meta-card"><div class="dash-meta-label">Auto refresh</div><div class="dash-meta-value">Every 30 min</div></div>
      <div class="dash-meta-card"><div class="dash-meta-label">Dashboard refresh</div><div class="dash-meta-value">${escHtml(String(d.generated_at || 'N/A'))}</div></div>
    </div>`;
}

function dashLeaderCards(d) {
  // Prefer Log-based consumption (accurate), fall back to item-sheet OUT columns
  const consumption = (Object.keys(d.log_zone_consumption || {}).length > 0)
    ? d.log_zone_consumption
    : (d.zone_consumption || {});
  const entries = Object.entries(consumption);
  if (!entries.length) return '<div class="dash-empty">No consumption data found yet. Log sheet data will appear here once operations are recorded.</div>';

  // Per-zone cards
  const zoneCards = entries.map(([zone, data]) => `
    <div class="dash-leader-card">
      <div class="dash-leader-zone">${escHtml(zone)}</div>
      <div class="dash-leader-row">
        <div><div class="dash-leader-label">Most consumed</div><div class="dash-leader-name">${escHtml(data.top?.name || 'N/A')}</div></div>
        <div class="dash-leader-value">${fmtDashNum(data.top?.out)} OUT</div>
      </div>
      <div class="dash-leader-row">
        <div><div class="dash-leader-label">Least consumed</div><div class="dash-leader-name">${escHtml(data.lowest?.name || 'N/A')}</div></div>
        <div class="dash-leader-value">${fmtDashNum(data.lowest?.out)} OUT</div>
      </div>
    </div>`).join('');

  // Per-file cards (shown when "Both" is selected)
  const fileConsumption = d.log_file_consumption || {};
  const fileEntries = Object.entries(fileConsumption);
  const fileCards = (_dashSelectedFile === 'both' && fileEntries.length > 0) ? `
    <div class="dash-leader-grid" style="margin-top:12px;">
      ${fileEntries.map(([fname, data]) => `
        <div class="dash-leader-card" style="border-top:2px solid var(--accent-cyan);">
          <div class="dash-leader-zone" style="color:var(--accent-cyan);">${escHtml(fname)}</div>
          <div class="dash-leader-row">
            <div><div class="dash-leader-label">Most consumed</div><div class="dash-leader-name">${escHtml(data.top?.name || 'N/A')}</div></div>
            <div class="dash-leader-value">${fmtDashNum(data.top?.out)} OUT</div>
          </div>
          ${(data.top5 || []).slice(1, 4).map(item => `
          <div class="dash-leader-row" style="opacity:0.75;">
            <div><div class="dash-leader-name" style="font-size:11px;">${escHtml(item.name)}</div></div>
            <div class="dash-leader-value" style="font-size:11px;">${fmtDashNum(item.out)}</div>
          </div>`).join('')}
        </div>`).join('')}
    </div>` : '';

  return `<div class="dash-leader-grid">${zoneCards}</div>${fileCards}`;
}

function dashRiskCards(d) {
  const lowZero = Object.entries(d.zone_low_zero || {});
  const high    = d.high_usage_items || [];
  const latest  = d.latest_files || [];
  const activeZone = d.most_active_zone;
  const activeMovement = activeZone ? fmtDashNum(activeZone.movement) : '—';
  const activeLabel   = activeZone ? escHtml(activeZone.zone) : 'N/A';
  return `
    <div class="dash-mini-grid">
      <div class="dash-mini-card">
        <div class="dash-mini-title">Most Active Zone</div>
        <div class="dash-mini-value">${activeLabel}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:3px;">${activeMovement} total movement</div>
      </div>
      <div class="dash-mini-card">
        <div class="dash-mini-title">High Usage Alerts</div>
        <div class="dash-mini-value">${fmtDashNum(high.length)} item(s)</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:3px;">Items above 2× avg OUT</div>
      </div>
      <div class="dash-mini-card">
        <div class="dash-mini-title">Unreadable Files</div>
        <div class="dash-mini-value">${fmtDashNum(d.unreadable_files)}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:3px;">Excel files that failed to open</div>
      </div>
    </div>
    <div class="dash-section-grid">
      <div class="dash-chart-wrap">
        <div class="dash-chart-title">Low / Zero Stock by Zone</div>
        ${lowZero.length ? `<table class="dash-zone-table"><thead><tr><th>Zone</th><th>Low</th><th>Zero</th></tr></thead><tbody>${lowZero.map(([z, v]) => `<tr><td>${escHtml(z)}</td><td>${fmtDashNum(v.low)}</td><td>${fmtDashNum(v.zero)}</td></tr>`).join('')}</tbody></table>` : '<div class="dash-empty">No stock risk by zone.</div>'}
      </div>
      <div class="dash-chart-wrap">
        <div class="dash-chart-title">Latest Updated Files</div>
        ${latest.length ? `<div class="dash-file-list">${latest.map(f => `<div class="dash-file-item"><div><div class="dash-file-name">${escHtml(f.zone)} / ${escHtml(f.file)}</div><div class="dash-content-sub" style="margin:4px 0 0;">${escHtml(f.path || '')}</div></div><div class="dash-file-date">${escHtml(f.updated || '')}</div></div>`).join('')}</div>` : '<div class="dash-empty">No file updates found.</div>'}
      </div>
    </div>`;
}

function dashOverview(d) {
  const hasLog = (d.log_ops_count || 0) > 0;
  const displayIn  = hasLog ? (d.log_total_in  || 0) : (d.total_in  || 0);
  const displayOut = hasLog ? (d.log_total_out || 0) : (d.total_out || 0);
  // Chart uses Log zone data when available, else item-sheet zone data
  const logZoneIn  = d.log_zone_in  || {};
  const logZoneOut = d.log_zone_out || {};
  const hasLogZone = Object.keys(logZoneIn).length > 0 || Object.keys(logZoneOut).length > 0;
  const allZones   = Array.from(new Set([
    ...Object.keys(hasLogZone ? logZoneIn : (d.zone_in || {})),
    ...Object.keys(hasLogZone ? logZoneOut : (d.zone_out || {})),
  ]));
  // Top item: name only (no OUT qty)
  const logTop = (d.log_top_items || [])[0];
  const topName = logTop ? escHtml(String(logTop.name)) : (d.top_items?.[0] ? escHtml(String(d.top_items[0].name)) : 'N/A');
  const kpis = [
    dashKpi('Total Items',  fmtDashNum(d.total_items), 'Rows in Other+ and Sacks sheets', 'blue'),
    dashKpi('Total IN',     fmtDashNum(displayIn),  hasLog ? 'From Log sheet operations' : 'From IN columns', 'green'),
    dashKpi('Total OUT',    fmtDashNum(displayOut), hasLog ? 'From Log sheet operations' : 'From OUT columns', 'red'),
    dashKpi('Log Ops',      fmtDashNum(d.log_ops_count || 0), 'Total IN+OUT records in Log', 'cyan'),
    dashKpi('Top Consumed', topName, 'Most withdrawn item', 'amber'),
    dashKpi('Zero Stock',   fmtDashNum(d.zero_stock), 'Items with zero current balance', 'red'),
  ].join('');
  // Item-level chart: IN vs OUT per item from Log
  const itemStats  = (d.log_item_stats || []).slice(0, 15);
  const hasItems   = itemStats.length > 0;
  const itemLabels = itemStats.map(i => i.name.length > 22 ? i.name.slice(0, 20) + '…' : i.name);

  // Sheet dropdown — only when a specific file is selected
  const showSheetFilter = _dashSelectedFile !== 'both' && _dashAvailableSheets.length > 0;
  const sheetDropdown = showSheetFilter
    ? `<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
         <span style="font-size:12px;color:var(--text-muted);font-weight:600;">Sheet:</span>
         <select class="dash-zone-select" onchange="onDashSheetChange(this.value)">
           <option value="">All Sheets</option>
           ${_dashAvailableSheets.map(s => `<option value="${escHtml(s)}" ${s === _dashSelectedSheet ? 'selected' : ''}>${escHtml(s)}</option>`).join('')}
         </select>
       </div>`
    : '';

  const chartTitle = _dashSelectedSheet
    ? `IN vs OUT — ${escHtml(_dashSelectedSheet)} (${_dashSelectedFile === 'sacks' ? 'Sacks' : 'Others+'})`
    : (_dashSelectedFile !== 'both'
        ? `IN vs OUT — ${_dashSelectedFile === 'sacks' ? 'Sacks' : 'Others+'} (All Sheets)`
        : 'IN vs OUT per Item — Both Files (Top 15 by OUT)');

  setDashContent(`
    ${dashHeader('Dashboard Overview', 'Live summary based on current Excel files')}
    <div class="dash-kpi-grid">${kpis}</div>
    ${dashLeaderCards(d)}
    ${dashRiskCards(d)}
    <div class="dash-chart-wrap">
      <div class="dash-chart-title">${chartTitle}</div>
      ${sheetDropdown}
      ${hasItems ? '<canvas id="dashChartCanvas" style="max-height:320px;"></canvas>' : '<div class="dash-empty">No Log data found for this selection.</div>'}
    </div>`);
  if (hasItems) drawDashChart('dashChartCanvas', 'bar', itemLabels, [
    { label:'IN',  data: itemStats.map(i => i.in),  backgroundColor:'rgba(16,185,129,0.75)' },
    { label:'OUT', data: itemStats.map(i => i.out), backgroundColor:'rgba(239,68,68,0.75)'  },
  ]);
}

function dashZones(d) {
  const zones = Array.from(new Set([...Object.keys(d.zone_in || {}), ...Object.keys(d.zone_out || {}), ...Object.keys(d.zone_items || {}), ...Object.keys(d.zone_consumption || {})]));
  const rows = zones.map(z => {
    const leader = (d.zone_consumption || {})[z] || {};
    return `<tr><td>${escHtml(String(z))}</td><td>${fmtDashNum((d.zone_files || {})[z])}</td><td>${fmtDashNum((d.zone_items || {})[z])}</td><td>${escHtml(leader.top?.name || 'N/A')}<br><span style="color:var(--text-muted);font-size:11px;">${fmtDashNum(leader.top?.out)} OUT</span></td><td>${escHtml(leader.lowest?.name || 'N/A')}<br><span style="color:var(--text-muted);font-size:11px;">${fmtDashNum(leader.lowest?.out)} OUT</span></td><td style="color:var(--accent-green);font-weight:600;">${fmtDashNum((d.zone_in || {})[z])}</td><td style="color:var(--accent-red);font-weight:600;">${fmtDashNum((d.zone_out || {})[z])}</td></tr>`;
  }).join('');
  setDashContent(`${dashHeader('Zones Summary', 'Consumption leaders and movement per zone')}<div class="dash-chart-wrap dash-zone-table-wrap" style="padding:0;overflow:hidden;"><table class="dash-zone-table"><thead><tr><th>Zone</th><th>Files</th><th>Items</th><th>Most Consumed</th><th>Least Consumed</th><th>Total IN</th><th>Total OUT</th></tr></thead><tbody>${rows || '<tr><td colspan="7">No zone data found.</td></tr>'}</tbody></table></div>`);
}

// WELCOME TOAST
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
(function() {
  const t = document.getElementById('welcomeToast');
  if (!t) return;
  setTimeout(() => t.classList.add('show'), 600);
  setTimeout(() => t.classList.remove('show'), 4500);
})();

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SESSION TIMER
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
(function() {
  const el = document.getElementById('sessionTimer');
  if (!el) return;
  const start = Date.now();
  function tick() {
    const s = Math.floor((Date.now() - start) / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    el.textContent = h > 0
      ? `± ${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
      : `± ${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  }
  tick();
  setInterval(tick, 1000);
})();

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// ALERT BADGE (zero stock count)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
(function() {
  const badge = document.getElementById('alertBadge');
  if (!badge) return;
  fetch('/api/alert_count')
    .then(r => r.json())
    .then(d => {
      if (d.zero > 0) {
        badge.textContent = d.zero;
        badge.style.display = 'flex';
      }
    }).catch(() => {});
})();

function toggleTopbarButtons() {
  const box = document.querySelector('.topbar-actions');
  if (!box) return;
  const hidden = box.classList.toggle('buttons-hidden');
  localStorage.setItem('est-buttons-hidden', hidden ? '1' : '0');
}
(function(){ if (localStorage.getItem('est-buttons-hidden') === '1') document.querySelector('.topbar-actions')?.classList.add('buttons-hidden'); })();
let adminMessagesCache = [];
function setForMoreMessagesBadge(count) {
  const badge = document.getElementById('forMoreMessagesBadge');
  if (!badge) return;
  const n = Number(count || 0);
  // Play sound when new message arrives
  const key = 'est-admin-msg-count';
  const prevRaw = sessionStorage.getItem(key);
  const prev = prevRaw === null ? n : Number(prevRaw || 0);
  sessionStorage.setItem(key, String(n));
  if (n > prev) {
    try {
      const audio = new Audio('/static/audio/newapp.mp3');
      audio.volume = 0.8;
      audio.play().catch(() => {});
    } catch(e) {}
  }
  badge.textContent = String(n);
  badge.style.display = n > 0 ? 'inline-flex' : 'none';
}
function openAdminMessagesModal() { document.getElementById('adminMessagesModal')?.classList.add('open'); loadAdminMessages(); }
function closeAdminMessagesModal() { document.getElementById('adminMessagesModal')?.classList.remove('open'); }
async function loadAdminMessages() {
  const body = document.getElementById('adminMessagesBody');
  if (!body) return;
  body.innerHTML = '<div class="users-empty">Loading...</div>';
  try {
    const res = await fetch('/api/admin/contact_messages', { cache:'no-store' });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'Failed');
    adminMessagesCache = data.messages || [];
    setForMoreMessagesBadge(data.count || 0);
    if (!adminMessagesCache.length) { body.innerHTML = '<div class="users-empty">No messages yet</div>'; return; }
    body.innerHTML = adminMessagesCache.map(m => {
      const isNew = m.status === 'new';
      const borderColor = isNew ? 'rgba(239,68,68,0.45)' : 'rgba(16,185,129,0.35)';
      const bgColor = isNew ? 'rgba(239,68,68,0.06)' : 'rgba(16,185,129,0.05)';
      return `<div style="border:1px solid ${borderColor};background:${bgColor};border-radius:12px;padding:14px 16px;margin:12px;transition:border-color 0.3s;">
        <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-start;">
          <strong style="color:var(--text-main);">${escHtml(m.name || '—')}</strong>
          <span style="color:var(--text-dim);font-size:11px;">${escHtml(m.created_at || '')}</span>
        </div>
        <div style="color:var(--text-muted);font-size:12px;margin-top:5px;">${escHtml(m.phone || '')}${m.email ? ' | ' + escHtml(m.email) : ''}${m.department ? ' | ' + escHtml(m.department) : ''}</div>
        <div style="color:var(--text-main);font-size:13px;line-height:1.6;margin-top:10px;white-space:pre-wrap;">${escHtml(m.message || '')}</div>
        <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">
          ${isNew ? `<button class="btn btn-ghost" style="padding:6px 14px;font-size:12px;border-color:rgba(16,185,129,0.4);color:var(--accent-green);" onclick="markAdminMessageRead(${Number(m.id)})">Mark as Read</button>` : `<span style="font-size:11px;color:var(--accent-green);padding:6px 0;">Read</span>`}
          <button class="btn" style="padding:6px 14px;font-size:12px;background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.35);color:#ef4444;" onclick="deleteAdminMessage(${Number(m.id)})">Delete</button>
        </div>
      </div>`;
    }).join('');
  } catch(e) { body.innerHTML = `<div class="users-empty">Failed to load messages<br>${escHtml(String(e.message || e))}</div>`; }
}
async function markAdminMessageRead(id) { await fetch(`/api/admin/contact_messages/${id}/read`, { method:'POST' }); loadAdminMessages(); }
async function deleteAdminMessage(id) {
  try {
    await fetch(`/api/admin/contact_messages/${id}`, { method: 'DELETE' });
    loadAdminMessages();
  } catch(e) {}
}
setInterval(() => { if (document.getElementById('forMoreMessagesBadge')) fetch('/api/admin/contact_messages',{cache:'no-store'}).then(r=>r.json()).then(d=>setForMoreMessagesBadge(d.count||0)).catch(()=>{}); }, 30000);

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// BACKGROUND NOTIFICATION SYSTEM
// Works even when page is minimized or in another tab
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
(function() {
  // Request notification permission on load
  function requestNotifPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }
  requestNotifPermission();

  // Show browser notification if page is not visible
  function showBrowserNotif(title, body, icon) {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    try {
      new Notification(title, {
        body: body,
        icon: icon || '/static/icons/low.ico',
        badge: '/static/icons/low.ico',
        tag: title, // prevent duplicate stacking
        requireInteraction: false,
        silent: false
      });
    } catch(e) {}
  }

  // Play sound always, show browser notif only when hidden
  function notifyNewMessages(prevCount, newCount) {
    if (newCount <= prevCount) return;
    // Always play sound
    try {
      const audio = new Audio('/static/audio/newapp.mp3');
      audio.volume = 0.85;
      audio.play().catch(() => {});
    } catch(e) {}
    // Show browser notification if page hidden/minimized
    if (document.hidden || !document.hasFocus()) {
      showBrowserNotif(
        'New Messages - For More',
        `${newCount - prevCount} new message(s)`,
        '/static/icons/low.ico'
      );
    }
  }

  function notifyNewRequests(prevCount, newCount) {
    if (newCount <= prevCount) return;
    try {
      const audio = new Audio('/static/audio/newapp.mp3');
      audio.volume = 0.85;
      audio.play().catch(() => {});
    } catch(e) {}
    if (document.hidden || !document.hasFocus()) {
      showBrowserNotif(
        'New Registration Request',
        `${newCount - prevCount} new request(s)`,
        '/static/icons/low.ico'
      );
    }
  }

  // Poll for messages every 20 seconds (background-aware)
  let _msgPrev = Number(sessionStorage.getItem('est-admin-msg-count') || 0);
  function pollMessages() {
    if (!document.getElementById('forMoreMessagesBadge')) return;
    fetch('/api/admin/contact_messages', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        const n = Number(d.count || 0);
        notifyNewMessages(_msgPrev, n);
        _msgPrev = n;
        sessionStorage.setItem('est-admin-msg-count', String(n));
        setForMoreMessagesBadge(n);
      })
      .catch(() => {});
  }

  let _reqPrev = Number(sessionStorage.getItem('est-admin-request-count') || 0);
  function pollRequests() {
    if (!document.getElementById('adminRequestsBadge')) return;
    fetch('/api/admin/pending_requests_count', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        const n = Number(d.count || 0);
        notifyNewRequests(_reqPrev, n);
        _reqPrev = n;
        sessionStorage.setItem('est-admin-request-count', String(n));
        setAdminRequestBadge(n);
      })
      .catch(() => {});
  }

  // Poll every 20 seconds
  setInterval(pollMessages, 20000);
  setInterval(pollRequests, 20000);

  // Also poll immediately when tab becomes visible again (catches up)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      pollMessages();
      pollRequests();
    }
  });

  // Poll when window regains focus
  window.addEventListener('focus', () => {
    pollMessages();
    pollRequests();
  });
})();

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// USERS / LOGIN LOG MODAL
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function openUsersModal() {
  document.getElementById('usersModal')?.classList.add('open');
  loadLoginLog();
}
function closeUsersModal() {
  document.getElementById('usersModal')?.classList.remove('open');
}

async function loadLoginLogLegacy() {
  const body = document.getElementById('usersBody');
  if (!body) return;
  body.innerHTML = '<div class="users-empty">Loading...</div>';
  try {
    const res  = await fetch('/api/login_log');
    const data = await res.json();
    const entries = data.entries || [];
    if (!entries.length) {
      body.innerHTML = '<div class=”users-empty”>No login records yet</div>';
      return;
    }
    const rows = entries.map((e, i) => `
      <tr>
        <td style="color:var(--text-dim);font-family:'JetBrains Mono',monospace;font-size:11px;">${i + 1}</td>
        <td>
          <span style="display:inline-flex;align-items:center;gap:6px;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <strong>${escHtml(e.username || '—')}</strong>
          </span>
        </td>
        <td><span class="zone-badge" style="font-size:11px;padding:2px 10px;">${escHtml(e.zone_label || e.zone_id || '—')}</span></td>
        <td style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text-muted);">${escHtml(e.time || '—')}</td>
        <td style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text-dim);">${escHtml(e.ip || '—')}</td>
      </tr>`).join('');

    body.innerHTML = `
      <table class="users-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Username</th>
            <th>Zone</th>
            <th>Time</th>
            <th>IP</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
  } catch(e) {
    body.innerHTML = '<div class="users-empty">⚠ Failed to load log</div>';
  }
}

// â”€â”€ REPORTS DROPDOWN â”€â”€
async function loadLoginLog() {
  const body = document.getElementById('usersBody');
  if (!body) return;
  body.innerHTML = '<div class="users-empty">Loading...</div>';
  try {
    const res = await fetch('/api/login_log', { cache: 'no-store' });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'Failed to load log');
    const entries = data.entries || [];
    if (!entries.length) {
      body.innerHTML = `<div class="users-empty">No login records yet<br><span style="font-size:11px;color:var(--text-dim);">Log file: ${escHtml(data.log_file || 'default login_log.json')}</span></div>`;
      return;
    }
    const _isPrivateIp = ip => !ip || /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1)/.test(ip);
    const _resolveCountry = (e) => {
      if (e.country && e.country.toLowerCase() !== 'nan' && e.country.trim() !== '') return e.country;
      if (_isPrivateIp(e.ip)) return 'Local';
      return '—';
    };
    const rows = entries.map((e, i) => `
      <tr>
        <td style="color:var(--text-dim);font-family:'JetBrains Mono',monospace;font-size:11px;">${i + 1}</td>
        <td><strong>${escHtml(e.username || '-')}</strong></td>
        <td><span class="zone-badge" style="font-size:11px;padding:2px 10px;">${escHtml(e.zone_label || e.zone_id || '-')}</span></td>
        <td style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text-muted);">${escHtml(e.time || '-')}</td>
        <td style="font-size:11px;color:var(--text-muted);">${escHtml(_resolveCountry(e))}</td>
        <td style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text-dim);">${escHtml(e.ip || '-')}</td>
      </tr>`).join('');
    body.innerHTML = `
      <div style="padding:10px 16px;border-bottom:1px solid var(--border);font-size:11px;color:var(--text-dim);font-family:'JetBrains Mono',monospace;display:flex;align-items:center;justify-content:space-between;gap:10px;">
        <span>Total: ${fmtDashNum(data.total ?? entries.length)} | Log file: ${escHtml(data.log_file || 'default login_log.json')}</span>
        <button class="dash-refresh-btn" style="padding:5px 9px;font-size:11px;" onclick="loadLoginLog()">Refresh</button>
      </div>
      <table class="users-table">
        <thead><tr><th>#</th><th>Username</th><th>Zone</th><th>Time</th><th>Country</th><th>IP</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  } catch(e) {
    body.innerHTML = `<div class="users-empty">Failed to load log<br><span style="font-size:11px;color:var(--text-dim);">${escHtml(String(e.message || e))}</span></div>`;
  }
}

function playNewRequestSound(count) {
  const n = Number(count || 0);
  const key = 'est-admin-request-count';
  const prevRaw = sessionStorage.getItem(key);
  const prev = prevRaw === null ? n : Number(prevRaw || 0);
  sessionStorage.setItem(key, String(n));
  if (n > prev) {
    const audio = new Audio('/static/audio/newapp.mp3');
    audio.volume = 0.8;
    audio.play().catch(() => {});
  }
}

function setAdminRequestBadge(count) {
  const badge = document.getElementById('adminRequestsBadge');
  if (!badge) return;
  const n = Number(count || 0);
  badge.textContent = String(n);
  badge.style.display = n > 0 ? 'inline-flex' : 'none';
  document.getElementById('adminRequestsBtn')?.classList.toggle('pulse-btn', n > 0);
  playNewRequestSound(n);
}

function openAdminRequestsModal() {
  document.getElementById('adminRequestsModal')?.classList.add('open');
  loadAdminRequests();
}

function closeAdminRequestsModal() {
  document.getElementById('adminRequestsModal')?.classList.remove('open');
}

function openAdminUsersModal() {
  document.getElementById('adminUsersModal')?.classList.add('open');
  loadAdminUsers();
}

function closeAdminUsersModal() {
  document.getElementById('adminUsersModal')?.classList.remove('open');
}

function exportAdminUsers() {
  if (!adminUsersCache.length) {
    toast('⚠ No registered users to export', false);
    return;
  }
  window.location.href = '/api/admin/registered_users/export.xlsx';
}

async function loadAdminRequests() {
  const body = document.getElementById('adminRequestsBody');
  if (!body) return;
  body.innerHTML = '<div class="users-empty">Loading...</div>';
  try {
    const res = await fetch('/api/admin/registration_requests', { cache: 'no-store' });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'Failed');
    setAdminRequestBadge(data.count || 0);
    const items = data.requests || [];
    if (!items.length) {
      body.innerHTML = '<div class="users-empty">No pending registration requests</div>';
      return;
    }
    body.innerHTML = items.map((r) => {
      const avatarSrc = `/api/avatar/${escAttr(r.username || '')}`;
      const initial = escHtml((r.full_name || r.username || '?').charAt(0).toUpperCase());
      return `
      <div style="border:1px solid var(--border);background:var(--bg-card);border-radius:12px;padding:14px 16px;margin-bottom:10px;">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;">
          <div style="display:flex;gap:14px;align-items:flex-start;min-width:240px;">
            <div style="width:52px;height:52px;border-radius:50%;background:var(--accent-blue);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;color:#fff;flex-shrink:0;overflow:hidden;border:2px solid rgba(59,130,246,0.3);">
              <img src="${avatarSrc}" style="width:100%;height:100%;object-fit:cover;" onerror="this.parentElement.textContent='${initial}'">
            </div>
            <div>
              <div style="font-size:15px;font-weight:700;color:var(--text-main);">${escHtml(r.full_name || '—')}</div>
              <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">@${escHtml(r.username || '—')} • ${escHtml(r.job_title || '—')}</div>
              <div style="font-size:11px;color:var(--text-dim);margin-top:6px;">${escHtml(r.email || '—')} • ${escHtml(r.phone || '—')}</div>
              <div style="font-size:11px;color:var(--text-dim);margin-top:4px;">Security Q: ${escHtml(r.security_question || '—')}</div>
              <div style="font-size:11px;color:var(--text-dim);margin-top:4px;">${escHtml(r.created_at || '—')}</div>
            </div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn btn-purple" style="padding:8px 14px;font-size:12px;" onclick="approveRegistration(${Number(r.id)})">Approve</button>
            <button class="btn btn-ghost" style="padding:8px 14px;font-size:12px;" onclick="rejectRegistration(${Number(r.id)})">Reject</button>
          </div>
        </div>
      </div>`;
    }).join('');
  } catch (e) {
    body.innerHTML = `<div class="users-empty">Failed to load requests<br><span style="font-size:11px;color:var(--text-dim);">${escHtml(String(e.message || e))}</span></div>`;
  }
}

async function approveRegistration(id) {
  try {
    const res = await fetch(`/api/admin/registration_requests/${id}/approve`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'Failed');
    await loadAdminRequests();
    await loadAdminUsers();
  } catch (e) {
    toast(e.message || 'Failed to approve request', false);
  }
}

async function rejectRegistration(id) {
  try {
    const res = await fetch(`/api/admin/registration_requests/${id}/reject`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'Failed');
    await loadAdminRequests();
  } catch (e) {
    toast(e.message || 'Failed to reject request', false);
  }
}

const ADMIN_SECURITY_QUESTIONS = [
  'What was the name of your first school?',
  'What is your mother\'s maiden name?',
  'What city were you born in?',
  'What is the name of your favorite teacher?',
  'What was your first phone number?'
];
function adminSecurityOptions(current) {
  const value = String(current || '');
  const list = ADMIN_SECURITY_QUESTIONS.includes(value) || !value ? ADMIN_SECURITY_QUESTIONS : [value, ...ADMIN_SECURITY_QUESTIONS];
  return list.map(q => `<option value="${escAttr(q)}" ${q === value ? 'selected' : ''}>${escHtml(q)}</option>`).join('');
}
let adminUsersCache = [];

async function loadAdminUsers() {
  const body = document.getElementById('adminUsersBody');
  if (!body) return;
  body.innerHTML = '<div class="users-empty">Loading...</div>';
  try {
    const res = await fetch('/api/admin/registered_users', { cache: 'no-store' });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'Failed');
    adminUsersCache = data.users || [];
    if (!adminUsersCache.length) {
      body.innerHTML = '<div class="users-empty">No registered users yet</div>';
      return;
    }
    body.innerHTML = `
      <div class="users-empty" style="padding:10px 16px;text-align:start;font-size:11px;">Database: ${escHtml(data.db_file || 'auth.sqlite3')} · ${adminUsersCache.length} users</div>
      <div class="admin-user-list">
        ${adminUsersCache.map((u, i) => `
          <button class="admin-user-row" type="button" onclick="openAdminUserDetail(${Number(u.id)})">
            <img class="admin-user-avatar-img" src="/api/avatar/${escHtml(u.username)}" onerror="this.onerror=null;this.src='/static/images/profile_${u.gender==='female'?'female':'male'}.png'" alt="">
            <div class="admin-user-row-text">
              <strong>${i + 1}. ${escHtml(u.username || '—')}${u.full_name ? ' <span class="admin-user-fullname">· ' + escHtml(u.full_name) + '</span>' : ''}</strong>
              <span>${u.suspended_until ? 'Suspended until ' + escHtml(u.suspended_until.slice(0,16)) : (u.job_title ? escHtml(u.job_title) : 'View details')}</span>
            </div>
            ${u.suspended_until ? '<span class="admin-user-suspended-badge">Suspended</span>' : ''}
          </button>
        `).join('')}
      </div>`;
  } catch (e) {
    body.innerHTML = `<div class="users-empty">Failed to load users<br><span style="font-size:11px;color:var(--text-dim);">${escHtml(String(e.message || e))}</span></div>`;
  }
}

function openAdminUserDetail(id) {
  const u = adminUsersCache.find(x => Number(x.id) === Number(id));
  if (!u) return;
  const body = document.getElementById('adminUserDetailBody');
  if (!body) return;
  const rows = [
    ['Full name', u.full_name], ['Username', u.username], ['Job title', u.job_title], ['Gender', u.gender], ['Birth date', u.birth_date], ['Privacy accepted', u.privacy_accepted ? 'Yes' : 'No'], ['Email', u.email],
    ['Phone', u.phone], ['Security question', u.security_question], ['Password', u.password_stored_as ? 'Hidden (one-way hash)' : '—'],
    ['Security answer', u.security_answer_stored_as ? 'Hidden (one-way hash)' : '—'],
    ['Approved at', u.approved_at || u.created_at], ['Suspended until', u.suspended_until || '—'], ['Suspended by', u.suspended_by || '—']
  ];
  body.innerHTML = `
    <div class="admin-detail-header">
      <img class="admin-detail-avatar-img" src="/api/avatar/${escHtml(u.username)}" onerror="this.onerror=null;this.src='/static/images/profile_${u.gender==='female'?'female':'male'}.png'" alt="Avatar">
      <div class="admin-detail-header-info">
        <div class="admin-detail-header-name">${escHtml(u.full_name || u.username)}</div>
        <div class="admin-detail-header-meta">
          <span class="admin-detail-header-user">@${escHtml(u.username)}</span>
          ${u.job_title ? `<span class="admin-detail-header-job">${escHtml(u.job_title)}</span>` : ''}
          ${u.suspended_until ? `<span class="admin-user-suspended-badge">Suspended until ${escHtml(u.suspended_until.slice(0,16))}</span>` : ''}
        </div>
      </div>
    </div>
    <div class="admin-detail-grid">
      ${rows.map(([label, value]) => `<div class="admin-detail-item"><div class="admin-detail-label">${escHtml(label)}</div><div class="admin-detail-value">${escHtml(value || '—')}</div></div>`).join('')}
    </div>
    <div class="admin-danger-zone">
      <div class="admin-dz-label">Suspend Account</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
        <input id="suspendMinutes" type="number" min="1" max="43200" value="60" placeholder="Minutes" style="width:100px;">
        <button class="btn" style="padding:8px 14px;font-size:12px;background:#ef4444;color:#fff;border:none;" onclick="suspendAdminUser(${Number(u.id)})">Suspend</button>
        <button class="btn btn-ghost" style="padding:8px 14px;font-size:12px;" onclick="unsuspendAdminUser(${Number(u.id)})">Unsuspend</button>
      </div>
    </div>
    <div class="admin-danger-zone">
      <div class="admin-dz-label">Change Password</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <input id="adminNewPassword" type="password" placeholder="New password" style="flex:1 1 160px;">
        <input id="adminConfirmPassword" type="password" placeholder="Confirm password" style="flex:1 1 160px;">
        <button class="btn" style="padding:8px 14px;font-size:12px;background:#3b82f6;color:#fff;border:none;" onclick="resetAdminUserPassword(${Number(u.id)})">Save Password</button>
      </div>
    </div>
    <div class="admin-danger-zone">
      <div class="admin-dz-label">Security Question</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <select id="adminSecurityQuestion" style="flex:2 1 220px;">${adminSecurityOptions(u.security_question)}</select>
        <input id="adminSecurityAnswer" type="text" placeholder="New security answer" style="flex:1 1 160px;">
        <button class="btn" style="padding:8px 14px;font-size:12px;background:#f59e0b;color:#000;border:none;" onclick="resetAdminUserSecurity(${Number(u.id)})">Save Question</button>
      </div>
    </div>
    <div class="admin-danger-zone" id="adminZonesSection_${Number(u.id)}">
      <div class="admin-dz-label">Zone Access</div>
      <div id="adminZonesBody_${Number(u.id)}" style="margin-bottom:10px;color:var(--text-dim);font-size:12px;">Loading...</div>
      <button class="btn" style="padding:8px 14px;font-size:12px;background:#10b981;color:#fff;border:none;" onclick="saveAdminUserZones(${Number(u.id)})">Save Zones</button>
      <button class="btn btn-ghost" style="padding:8px 14px;font-size:12px;" onclick="clearAdminUserZones(${Number(u.id)})">Allow All Zones</button>
    </div>
    <div class="admin-danger-zone">
      <div class="admin-dz-label">Permissions</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px 20px;margin-bottom:10px;">
        <label style="display:inline-flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;color:var(--text-muted);">
          <input type="checkbox" id="perm_edit_${Number(u.id)}" ${u.can_edit ? 'checked' : ''} style="accent-color:#3b82f6;">
          Edit Mode
        </label>
      </div>
      <button class="btn" style="padding:8px 14px;font-size:12px;background:#3b82f6;color:#fff;border:none;" onclick="saveAdminUserPerms(${Number(u.id)})">Save Permissions</button>
    </div>
    <div class="admin-danger-zone">
      <div class="admin-dz-label">Verified Badge</div>
      <label style="display:inline-flex;align-items:center;gap:8px;font-size:12px;cursor:pointer;color:var(--text-muted);margin-bottom:10px;">
        <input type="checkbox" id="verifiedBadge_${Number(u.id)}" ${u.is_verified ? 'checked' : ''} style="accent-color:#3b82f6;">
        Show ✓ verified badge next to username
      </label>
      <br>
      <button class="btn" style="padding:8px 14px;font-size:12px;background:#3b82f6;color:#fff;border:none;" onclick="saveAdminUserVerified(${Number(u.id)})">Save Badge</button>
    </div>
    <div class="admin-danger-zone" style="border-color:rgba(239,68,68,0.3);">
      <div class="admin-dz-label" style="color:#ef4444;">Danger Zone</div>
      <button class="btn btn-logout" style="padding:8px 14px;font-size:12px;" onclick="deleteAdminUser(${Number(u.id)}, '${escAttr(u.username || '')}')">Delete Account</button>
    </div>`;
  document.getElementById('adminUserDetailModal')?.classList.add('open');
  loadAdminUserZones(Number(u.id));
}

function closeAdminUserDetailModal() {
  document.getElementById('adminUserDetailModal')?.classList.remove('open');
}

const _ALL_ZONES = [
  {id:'zone1',name:'Zone 1'},{id:'zone2',name:'Zone 2'},{id:'zone3',name:'Packaging'},
  {id:'zone4',name:'Zone 4'},{id:'zone5',name:'Zone 5'},{id:'qc',name:'QC Workflow'}
];
async function loadAdminUserZones(id) {
  const body = document.getElementById(`adminZonesBody_${id}`);
  if (!body) return;
  try {
    const res = await fetch(`/api/admin/registered_users/${id}/zones`);
    const data = await res.json();
    const allowed = data.zones; // null = all zones
    body.innerHTML = _ALL_ZONES.map(z => {
      const checked = allowed === null || (Array.isArray(allowed) && allowed.includes(z.id));
      return `<label style="display:inline-flex;align-items:center;gap:6px;margin:4px 8px 4px 0;font-size:12px;cursor:pointer;">
        <input type="checkbox" data-zone-id="${escAttr(z.id)}" ${checked ? 'checked' : ''} style="accent-color:var(--accent-blue);">
        ${escHtml(z.name)}
      </label>`;
    }).join('');
  } catch(e) { body.textContent = 'Failed to load'; }
}
async function saveAdminUserZones(id) {
  const body = document.getElementById(`adminZonesBody_${id}`);
  if (!body) return;
  const checked = [...body.querySelectorAll('input[data-zone-id]:checked')].map(el => el.dataset.zoneId);
  try {
    const res = await fetch(`/api/admin/registered_users/${id}/zones`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ zones: checked }) });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'Failed');
    toast('Zone access saved', true);
  } catch(e) { toast(e.message || 'Failed', false); }
}
async function clearAdminUserZones(id) {
  try {
    const res = await fetch(`/api/admin/registered_users/${id}/zones`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ zones: null }) });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'Failed');
    toast('All zones allowed', true);
    loadAdminUserZones(id);
  } catch(e) { toast(e.message || 'Failed', false); }
}

async function saveAdminUserPerms(id) {
  const canEdit = document.getElementById(`perm_edit_${id}`)?.checked || false;
  try {
    const res = await fetch(`/api/admin/registered_users/${id}/permissions`, {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ switch_zones: false, can_edit: canEdit, manage_permissions: false })
    });
    let data = {};
    try { data = await res.json(); } catch(_) {}
    if (!res.ok || !data.success) throw new Error(data.message || (res.ok ? 'Failed' : `Server error ${res.status}`));
    toast('Permissions saved', true);
  } catch(e) { toast(e.message || 'Failed', false); }
}

async function saveAdminUserVerified(id) {
  const isVerified = document.getElementById(`verifiedBadge_${id}`)?.checked || false;
  try {
    const res = await fetch(`/api/admin/registered_users/${id}/toggle_verified`, {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ is_verified: isVerified })
    });
    let data = {};
    try { data = await res.json(); } catch(_) {}
    if (!res.ok || !data.success) throw new Error(data.message || (res.ok ? 'Failed' : `Server error ${res.status}`));
    toast('Verified badge updated', true);
  } catch(e) { toast(e.message || 'Failed', false); }
}

async function suspendAdminUser(id) {
  const minutes = Number(document.getElementById('suspendMinutes')?.value || 0);
  try {
    const res = await fetch(`/api/admin/registered_users/${id}/suspend`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ minutes }) });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'Failed');
    toast(data.message || 'Account suspended', true);
    await loadAdminUsers();
    closeAdminUserDetailModal();
  } catch(e) { toast(e.message || 'Failed to suspend user', false); }
}

async function unsuspendAdminUser(id) {
  try {
    const res = await fetch(`/api/admin/registered_users/${id}/unsuspend`, { method:'POST' });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'Failed');
    toast(data.message || 'Account unsuspended', true);
    await loadAdminUsers();
    closeAdminUserDetailModal();
  } catch(e) { toast(e.message || 'Failed to unsuspend user', false); }
}

async function resetAdminUserPassword(id) {
  const new_password = document.getElementById('adminNewPassword')?.value || '';
  const confirm_password = document.getElementById('adminConfirmPassword')?.value || '';
  try {
    const res = await fetch(`/api/admin/registered_users/${id}/password`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ new_password, confirm_password }) });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'Failed');
    toast(data.message || 'Password updated', true);
    await loadAdminUsers();
    closeAdminUserDetailModal();
  } catch(e) { toast(e.message || 'Failed to update password', false); }
}

async function resetAdminUserSecurity(id) {
  const security_question = document.getElementById('adminSecurityQuestion')?.value || '';
  const security_answer = document.getElementById('adminSecurityAnswer')?.value || '';
  try {
    const res = await fetch(`/api/admin/registered_users/${id}/security`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ security_question, security_answer }) });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'Failed');
    toast(data.message || 'Security question updated', true);
    await loadAdminUsers();
    closeAdminUserDetailModal();
  } catch(e) { toast(e.message || 'Failed to update security question', false); }
}

async function deleteAdminUser(id, username) {
  openDeleteConfirm(
    `Delete ${username}?`,
    'This will permanently remove the account. This action cannot be undone.',
    async () => {
      try {
        const res = await fetch(`/api/admin/registered_users/${id}`, { method:'DELETE' });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.message || 'Failed');
        toast(data.message || 'Deleted', true);
        await loadAdminUsers();
        closeAdminUserDetailModal();
      } catch(e) { toast(e.message || 'Failed to delete', false); }
    }
  );
}

let _reportsLoaded = false;

async function toggleReportsDropdown(e) {
  e.stopPropagation();
  const menu = document.getElementById('reportsDropdownMenu');
  const isOpen = menu.classList.contains('open');
  if (isOpen) {
    menu.classList.remove('open');
    return;
  }
  // Load list on first open
  if (!_reportsLoaded) {
    menu.innerHTML = '<div class="reports-dropdown-empty">Loading...</div>';
    menu.classList.add('open');
    try {
      const res  = await fetch('/api/reports');
      const data = await res.json();
      _reportsLoaded = true;
      if (!data.files || !data.files.length) {
        menu.innerHTML = '<div class="reports-dropdown-empty">📂 No reports found</div>';
      } else {
        menu.innerHTML = data.files.map(f =>
          `<div class="reports-dropdown-item" onclick="printReport('${escAttr(f)}')">
             <span class="ri-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></span>
             <span style="overflow:hidden;text-overflow:ellipsis;">${escHtml(f)}</span>
           </div>`
        ).join('');
      }
    } catch {
      menu.innerHTML = '<div class="reports-dropdown-empty">⚠ Failed to load</div>';
    }
  } else {
    menu.classList.add('open');
  }
}

function printReport(filename) {
  document.getElementById('reportsDropdownMenu').classList.remove('open');
  // Open the server-rendered HTML print page directly — no download, no iframe tricks
  window.open('/reports/print/' + encodeURIComponent(filename), '_blank');
}

// Close dropdown when clicking outside
document.addEventListener('click', function(e) {
  const wrap = document.getElementById('reportsDropdownWrap');
  if (wrap && !wrap.contains(e.target)) {
    document.getElementById('reportsDropdownMenu').classList.remove('open');
  }
});

// â”€â”€ TOGGLE BUTTONS VISIBILITY â”€â”€
function toggleButtonsVisibility() {
  const actions = document.querySelector('.topbar-actions');
  const btn = document.getElementById('buttonsToggleBtn');
  const icon = document.getElementById('toggleBtnIcon');
  const hidden = actions.classList.toggle('buttons-hidden');
  btn.classList.toggle('active', hidden);
  // Switch icon: eye-off when hidden, eye when visible
  if (hidden) {
    icon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
  } else {
    icon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>';
  }
  // Persist preference
  try { localStorage.setItem('topbarButtonsHidden', hidden ? '1' : '0'); } catch(e){}
}

// â”€â”€ START â”€â”€
init();
