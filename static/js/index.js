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



// ── FIREBASE RTDB AVATAR (index page) ──
let _fbIdxDb = null;
(function _initIndexAvatarFirebase() {
  const cfgEl = document.getElementById('index-fb-cfg');
  if (!cfgEl) return;
  try {
    const cfg = JSON.parse(cfgEl.textContent);
    if (cfg.firebase_config?.projectId) {
      // Reuse est-status app (same config) to avoid duplicate apps
      const app = (firebase.apps || []).find(a => a.name === 'est-status')
               || (firebase.apps || []).find(a => a.name === 'est-idx-avatar')
               || firebase.initializeApp(cfg.firebase_config, 'est-idx-avatar');
      _fbIdxDb = firebase.database(app);
    }
  } catch(e) {}
})();

function _fbIdxKey(username) {
  return username.replace(/[.#$[\]/]/g, '_');
}

function _compressImgIdx(file, maxSize=400, quality=0.78) {
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const ratio = Math.min(maxSize / img.width, maxSize / img.height, 1);
      const canvas = document.createElement('canvas');
      canvas.width  = Math.round(img.width  * ratio);
      canvas.height = Math.round(img.height * ratio);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(blob => resolve(blob), 'image/jpeg', quality);
    };
    img.src = url;
  });
}

async function _getAvatarIdxRTDB(username) {
  if (!_fbIdxDb) return null;
  try {
    const snap = await _fbIdxDb.ref('avatars/' + _fbIdxKey(username)).once('value');
    return snap.val() || null;
  } catch(e) { return null; }
}

function _loadIdxRtdbAvatars(containerEl) {
  if (!containerEl) return;
  containerEl.querySelectorAll('img[data-rtdb-user]').forEach(async img => {
    const u = img.dataset.rtdbUser;
    if (!u) return;
    const src = await _getAvatarIdxRTDB(u);
    if (src) img.src = src;
    else img.src = '/api/avatar/' + encodeURIComponent(u);
  });
}

async function _uploadAvatarIdxRTDB(username, file) {
  if (!_fbIdxDb) throw new Error('Firebase not ready');
  const compressed = await _compressImgIdx(file);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const b64 = e.target.result;
        await _fbIdxDb.ref('avatars/' + _fbIdxKey(username)).set(b64);
        resolve(b64);
      } catch(err) { reject(err); }
    };
    reader.readAsDataURL(compressed);
  });
}

// ── BETA POPUP (show only once per session) ──
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
  input.value = '';
  const cfgEl = document.getElementById('index-fb-cfg');
  const username = cfgEl ? (JSON.parse(cfgEl.textContent).username || '') : '';
  try {
    const src = await _uploadAvatarIdxRTDB(username, file);
    const avatarEl = document.getElementById('profileAvatar');
    if (avatarEl) avatarEl.innerHTML = `<img src="${escAttr(src)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
    toast('Photo updated!');
  } catch(e) {
    toast('Upload failed', false);
  }
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
  // Show default immediately
  const initialSrc = isDevUser ? '/static/images/me.jpg' : defaultAvatar;
  avatarEl.innerHTML = `<img src="${escAttr(initialSrc)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.onerror=null;this.src='${escAttr(defaultAvatar)}'">`;
  // Then load from RTDB (overwrites default if found)
  if (!isDevUser) {
    _getAvatarIdxRTDB(data.username || '').then(src => {
      if (src) avatarEl.innerHTML = `<img src="${escAttr(src)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
    });
  }

  document.getElementById('profileName').textContent = data.username || 'User';
  const profileVerified = document.getElementById('profileVerifiedBadge');
  if (profileVerified) profileVerified.style.display = verified ? 'inline-flex' : 'none';
  document.getElementById('profileZoneChip').textContent = data.zone_label || data.zone_name || data.zone || 'Zone';
  document.getElementById('profileRoleChip').textContent = role;
  document.getElementById('profileSessionChip').textContent = formatDuration(Number(data.login_duration_seconds));

  const permissionHtml = ''; // permissions not shown to users

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
   'aboutModalLangBtn','profileModalLangBtn'].forEach(id => {
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
  if (e.key === 'Escape') { closeTxModal(); closeAbout(); cancelPwdModal(); closePrintModal(); closeCsvModal(); closeLogout(); closeProfileModal(); closeUsersModal(); closeAdminRequestsModal(); closeAdminUsersModal(); closeAdminUserDetailModal(); closeDeleteConfirm(); document.getElementById('reportsDropdownMenu')?.classList.remove('open'); }
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
      const isDevU   = (r.username || '').toLowerCase() === 'hamza k. ghareb';
      const defSrc   = `/static/images/profile_${(r.gender||'')  === 'female' ? 'female' : 'male'}.png`;
      const avatarSrc = isDevU ? '/static/images/me.jpg' : defSrc;
      const rtdbAttr  = isDevU ? '' : `data-rtdb-user="${escAttr(r.username||'')}"`;
      const initial = escHtml((r.full_name || r.username || '?').charAt(0).toUpperCase());
      return `
      <div style="border:1px solid var(--border);background:var(--bg-card);border-radius:12px;padding:14px 16px;margin-bottom:10px;">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;">
          <div style="display:flex;gap:14px;align-items:flex-start;min-width:240px;">
            <div style="width:52px;height:52px;border-radius:50%;background:var(--accent-blue);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;color:#fff;flex-shrink:0;overflow:hidden;border:2px solid rgba(59,130,246,0.3);">
              <img src="${avatarSrc}" ${rtdbAttr} style="width:100%;height:100%;object-fit:cover;" onerror="this.parentElement.textContent='${initial}'">
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
            <button class="btn btn-success" style="padding:8px 14px;font-size:12px;" onclick="approveRegistration(${Number(r.id)})">Approve</button>
            <button class="btn btn-ghost" style="padding:8px 14px;font-size:12px;" onclick="rejectRegistration(${Number(r.id)})">Reject</button>
          </div>
        </div>
      </div>`;
    }).join('');
    _loadIdxRtdbAvatars(body);
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
        ${adminUsersCache.map((u, i) => {
          const isDevU  = (u.username||'').toLowerCase() === 'hamza k. ghareb';
          const defSrc  = `/static/images/profile_${u.gender==='female'?'female':'male'}.png`;
          const avSrc   = isDevU ? '/static/images/me.jpg' : defSrc;
          const rtdbAttr = isDevU ? '' : `data-rtdb-user="${escHtml(u.username)}"`;
          return `
          <button class="admin-user-row" type="button" onclick="openAdminUserDetail(${Number(u.id)})">
            <img class="admin-user-avatar-img" src="${avSrc}" ${rtdbAttr} onerror="this.onerror=null;this.src='${defSrc}'" alt="">
            <div class="admin-user-row-text">
              <strong>${i + 1}. ${escHtml(u.username || '—')}${u.is_verified ? ' <span style="display:inline-flex;align-items:center;justify-content:center;width:13px;height:13px;border-radius:50%;background:#3b82f6;vertical-align:middle;margin-left:3px;" title="Verified"><svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>' : ''}${u.full_name ? ' <span class="admin-user-fullname">· ' + escHtml(u.full_name) + '</span>' : ''}</strong>
              <span>${u.suspended_until ? 'Suspended until ' + escHtml(u.suspended_until.slice(0,16)) : (u.job_title ? escHtml(u.job_title) : 'View details')}</span>
            </div>
            ${u.suspended_until ? '<span class="admin-user-suspended-badge">Suspended</span>' : ''}
          </button>`;
        }).join('')}
      </div>`;
    _loadIdxRtdbAvatars(body);
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
      <img class="admin-detail-avatar-img" src="/static/images/profile_${u.gender==='female'?'female':'male'}.png" data-rtdb-user="${escHtml(u.username)}" alt="Avatar">
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
  _loadIdxRtdbAvatars(body);
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
