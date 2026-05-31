// ── FIREBASE RTDB AVATAR ──
let _fbAvatarDb = null;
(function _initZonesFirebase() {
  const cfgEl = document.getElementById('zones-fb-cfg');
  if (!cfgEl) return;
  try {
    const cfg = JSON.parse(cfgEl.textContent);
    if (!cfg.firebase_config?.projectId) return;
    // Reuse DEFAULT app if it exists, otherwise create named app
    const defaultApp = (firebase.apps || []).find(a => a.name === '[DEFAULT]');
    const app = defaultApp
      || (firebase.apps || []).find(a => a.name === 'est-zones')
      || firebase.initializeApp(cfg.firebase_config, 'est-zones');
    _fbAvatarDb = firebase.database(app);
  } catch(e) { console.warn('[Zones Avatar] Firebase init failed', e.message); }
})();

function _compressImage(file, maxSize=400, quality=0.78) {
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

function _fbKey(username) {
  return username.replace(/[.#$[\]/]/g, '_');
}

async function _getAvatarRTDB(username) {
  if (!_fbAvatarDb) return null;
  try {
    const snap = await _fbAvatarDb.ref('avatars/' + _fbKey(username)).once('value');
    return snap.val() || null;
  } catch(e) { return null; }
}

async function _uploadAvatarRTDB(username, file) {
  if (!_fbAvatarDb) throw new Error('Firebase not ready');
  const compressed = await _compressImage(file);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const b64 = e.target.result;
        await _fbAvatarDb.ref('avatars/' + _fbKey(username)).set(b64);
        resolve(b64);
      } catch(err) { reject(err); }
    };
    reader.readAsDataURL(compressed);
  });
}

// ── THEME ──
(function() {
  if (localStorage.getItem('est-theme') === 'light') document.documentElement.classList.add('light');
  updateDockTheme();
})();
function updateDockTheme() {
  const isLight = document.documentElement.classList.contains('light');
  const label = document.getElementById('dockThemeLabel');
  if (label) label.textContent = isLight ? 'Dark Mode' : 'Light Mode';
}
function toggleTheme() {
  const isLight = document.documentElement.classList.toggle('light');
  localStorage.setItem('est-theme', isLight ? 'light' : 'dark');
  updateDockTheme();
}

// ── ZONE SELECTION ──
let selectedZone = null;
let selectedQcRole = 'qc';

const RESTRICTED_ZONES = ['admin', 'dev', 'qc'];

function showDenied() {
  document.getElementById('deniedOverlay').classList.add('open');
  // deactivate zone card
  document.querySelectorAll('.zone-card').forEach(c => c.classList.remove('active'));
  selectedZone = null;
}

function closeDenied() {
  document.getElementById('deniedOverlay').classList.remove('open');
}

async function selectZone(zoneId) {
  // For restricted zones, check access BEFORE showing password modal
  if (RESTRICTED_ZONES.includes(zoneId)) {
    try {
      const res = await fetch('/api/zone_access_check', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ zone_id: zoneId })
      });
      const data = await res.json();
      if (!data.allowed) {
        showDenied();
        return;
      }
    } catch(e) {
      // Network error — fallback to showing the password modal
    }
  }

  selectedZone = zoneId;
  document.querySelectorAll('.zone-card').forEach(c => c.classList.remove('active'));
  document.getElementById('card-' + zoneId).classList.add('active');

  const names = {
    zone1:'Zone 1', zone2:'Zone 2', zone3:'Zone 3',
    zone4:'Zone 4', zone5:'Zone 5', qc:'QC', admin:'Admin', dev:'Dev'
  };
  const labels = {
    zone1:'زون 1', zone2:'زون 2', zone3:'Packaging',
    zone4:'زون 4', zone5:'زون 5', qc:'Quality Control', admin:'Administration', dev:''
  };

  document.getElementById('pwTitle').textContent = names[zoneId] || zoneId;
  document.getElementById('pwSub').textContent = `Enter password for ${names[zoneId] || zoneId} — ${labels[zoneId] || ''}`;
  const qcRoleWrap = document.getElementById('qcRoleWrap');
  if (qcRoleWrap) qcRoleWrap.style.display = zoneId === 'qc' ? 'block' : 'none';
  const qcRoleSelect = document.getElementById('qcRoleSelect');
  if (qcRoleSelect) qcRoleSelect.value = 'qc';
  document.getElementById('pwInput').value = '';
  document.getElementById('pwError').classList.remove('show');
  document.getElementById('btnText').textContent = 'Enter Zone';
  document.getElementById('enterBtn').disabled = false;
  document.getElementById('enterBtn').classList.remove('success');

  document.getElementById('pwOverlay').classList.add('open');
  setTimeout(() => document.getElementById('pwInput').focus(), 120);
}

async function submitZone() {
  if (!selectedZone) return;
  const pw = document.getElementById('pwInput').value.trim();
  selectedQcRole = document.getElementById('qcRoleSelect')?.value || 'qc';
  if (!pw) { shakePanel(); return; }

  const spinner  = document.getElementById('btnSpinner');
  const btnText  = document.getElementById('btnText');
  const enterBtn = document.getElementById('enterBtn');
  const pwError  = document.getElementById('pwError');

  spinner.style.display  = 'block';
  btnText.textContent    = 'Verifying...';
  enterBtn.disabled      = true;
  pwError.classList.remove('show');

  try {
    const res  = await fetch('/api/zone_login', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ zone_id: selectedZone, password: pw, qc_role: selectedQcRole })
    });
    const data = await res.json();

    if (data.success) {
      spinner.style.display = 'none';
      btnText.textContent   = '✓ Access Granted';
      enterBtn.classList.add('success');
      setTimeout(() => { window.location.href = data.redirect || '/index'; }, 600);
    } else if (data.not_allowed) {
      spinner.style.display = 'none';
      btnText.textContent   = 'Enter Zone';
      enterBtn.disabled     = false;
      closeModal();
      showDenied();
    } else {
      spinner.style.display = 'none';
      btnText.textContent   = 'Enter Zone';
      enterBtn.disabled     = false;
      document.getElementById('pwErrorMsg').textContent = data.message || 'Incorrect password';
      pwError.classList.add('show');
      shakePanel();
    }
  } catch(e) {
    spinner.style.display = 'none';
    btnText.textContent   = 'Enter Zone';
    enterBtn.disabled     = false;
    document.getElementById('pwErrorMsg').textContent = 'Connection error. Try again.';
    pwError.classList.add('show');
    shakePanel();
  }
}

function closeModal() {
  selectedZone = null;
  document.getElementById('pwOverlay').classList.remove('open');
  document.querySelectorAll('.zone-card').forEach(c => c.classList.remove('active'));
}

function shakePanel() {
  const panel = document.getElementById('pwPanel');
  panel.classList.remove('shake');
  void panel.offsetWidth;
  panel.classList.add('shake');
  setTimeout(() => panel.classList.remove('shake'), 500);
}

// Password toggle
document.getElementById('pwToggle').addEventListener('click', function() {
  const inp = document.getElementById('pwInput');
  const eye = document.getElementById('pwEye');
  if (inp.type === 'password') {
    inp.type = 'text';
    eye.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>';
  } else {
    inp.type = 'password';
    eye.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
  }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && selectedZone) submitZone();
  if (e.key === 'Escape') { closeModal(); closeDenied(); }
});

// Click on overlay backdrop to close
document.getElementById('pwOverlay').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

// ── PARTICLES ──
(function() {
  const canvas = document.getElementById('particleCanvas');
  const ctx = canvas.getContext('2d');
  let W, H, particles = [], mouse = { x:-999, y:-999 };
  const isLight = () => document.documentElement.classList.contains('light');
  function resize() { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }
  function Particle() { this.x=Math.random()*W; this.y=Math.random()*H; this.vx=(Math.random()-0.5)*0.4; this.vy=(Math.random()-0.5)*0.4; this.r=Math.random()*1.8+0.4; this.alpha=Math.random()*0.5+0.1; }
  Particle.prototype.update = function() {
    this.x+=this.vx; this.y+=this.vy;
    if(this.x<0)this.x=W; if(this.x>W)this.x=0;
    if(this.y<0)this.y=H; if(this.y>H)this.y=0;
    const dx=this.x-mouse.x,dy=this.y-mouse.y,d=Math.sqrt(dx*dx+dy*dy);
    if(d<100){this.x+=dx/d*1.2;this.y+=dy/d*1.2;}
  };
  function init() { resize(); particles=[]; const n=Math.floor((W*H)/14000); for(let i=0;i<n;i++)particles.push(new Particle()); }
  function draw() {
    ctx.clearRect(0,0,W,H);
    const light=isLight(); const dc=light?'rgba(37,99,235,':'rgba(59,130,246,'; const md=130;
    for(let i=0;i<particles.length;i++){
      const p=particles[i]; p.update();
      ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fillStyle=dc+p.alpha+')';ctx.fill();
      for(let j=i+1;j<particles.length;j++){
        const q=particles[j],dx=p.x-q.x,dy=p.y-q.y,d=Math.sqrt(dx*dx+dy*dy);
        if(d<md){const a=(1-d/md)*0.18*(light?1:0.7);ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.strokeStyle=dc+a+')';ctx.lineWidth=0.6;ctx.stroke();}
      }
    }
    requestAnimationFrame(draw);
  }
  window.addEventListener('resize', init);
  window.addEventListener('mousemove', e=>{mouse.x=e.clientX;mouse.y=e.clientY;});
  window.addEventListener('mouseleave', ()=>{mouse.x=-999;mouse.y=-999;});
  init(); draw();
})();

// ── LANGUAGE TOGGLE ──
const ZONES_LANG = {
  en: {
    title: 'Select Your Zone',
    sub: 'Choose the warehouse zone you want to access',
    mgmt: 'Management',
    welcome: 'Welcome',
    logout: 'Logout',
    lang: 'عربي',
    enterZone: 'Enter Zone',
    verifying: 'Verifying...',
    accessGranted: '✓ Access Granted',
    incorrectPwd: 'Incorrect password',
    connErr: 'Connection error. Try again.',
    enterPwd: 'Enter Zone Password',
    enterPwdSub: 'Enter the password for this zone',
    zoneNames: { zone1:'Zone 1', zone2:'Zone 2', zone3:'Zone 3', zone4:'Zone 4', zone5:'Zone 5', qc:'QC', admin:'EST', dev:'Dev' },
    zoneLabels: { zone1:'', zone2:'', zone3:'Packaging', zone4:'', zone5:'', qc:'Quality Control', admin:'Administration', dev:'' },
  },
  ar: {
    title: 'اختر المنطقة',
    sub: 'اختر منطقة المستودع التي تريد الدخول إليها',
    mgmt: 'الإدارة',
    welcome: 'الرئيسية',
    logout: 'تسجيل الخروج',
    lang: 'English',
    enterZone: 'دخول',
    verifying: 'جارٍ التحقق...',
    accessGranted: '✓ تم الدخول',
    incorrectPwd: 'كلمة المرور غير صحيحة',
    connErr: 'خطأ في الاتصال. حاول مرة أخرى.',
    enterPwd: 'أدخل كلمة مرور المنطقة',
    enterPwdSub: 'أدخل كلمة المرور للدخول إلى هذه المنطقة',
    zoneNames: { zone1:'منطقة 1', zone2:'منطقة 2', zone3:'منطقة 3', zone4:'منطقة 4', zone5:'منطقة 5', qc:'جودة', admin:'EST', dev:'Dev' },
    zoneLabels: { zone1:'', zone2:'', zone3:'التعبئة', zone4:'', zone5:'', qc:'مراقبة الجودة', admin:'الإدارة', dev:'' },
  }
};
let currentLang = localStorage.getItem('est-lang') || 'en';
function applyLang(lang) {
  currentLang = lang;
  localStorage.setItem('est-lang', lang);
  const t = ZONES_LANG[lang];
  const isAr = lang === 'ar';
  document.documentElement.lang = lang;
  document.documentElement.dir  = isAr ? 'rtl' : 'ltr';
  const _zt = document.querySelector('.zones-title');
  if (_zt) _zt.textContent = t.title;
  const _zs = document.querySelector('.zones-sub');
  if (_zs) _zs.textContent = t.sub;
  const _zd = document.querySelector('.zones-divider-text');
  if (_zd) _zd.textContent = t.mgmt;
  const dockItems = document.querySelectorAll('.dock-label');
  // Home, Light/Dark, Lang, Logout
  if (dockItems[0]) dockItems[0].textContent = t.welcome;
  const dockLangText = document.getElementById('dockLangText');
  if (dockLangText) dockLangText.textContent = isAr ? 'EN' : 'AR';
  if (document.getElementById('dockLangLabel')) document.getElementById('dockLangLabel').textContent = t.lang;
  // zone cards
  document.querySelectorAll('.zone-card').forEach(card => {
    const id = card.id.replace('card-','');
    if (t.zoneNames[id])  card.querySelector('.zone-name').textContent  = t.zoneNames[id];
    if (t.zoneLabels[id] !== undefined) card.querySelector('.zone-label').textContent = t.zoneLabels[id];
  });
}
function toggleLang() {
  applyLang(currentLang === 'en' ? 'ar' : 'en');
}
// تطبيق اللغة عند التحميل
applyLang(currentLang);

// ── PRESENCE PING ──
(function pingPresence() {
  fetch('/api/zones/ping', { method: 'POST' }).catch(() => {});
  setInterval(() => fetch('/api/zones/ping', { method: 'POST' }).catch(() => {}), 10000);
})();

// ── USER COUNT ON FAB BUTTON ──
(async function loadUserCount() {
  try {
    const res = await fetch('/api/zones/users');
    const data = await res.json();
    const count = (data.users || []).length;
    const lbl = document.getElementById('zuFabLabel');
    if (lbl && count > 0) lbl.textContent = `Users (${count})`;
  } catch(e) {}
})();

// Load avatar in user-corner + verified badge
let _ucGender = '';
function _devAvatarSrc(username) {
  return username.toLowerCase() === 'hamza k. ghareb' ? '/static/images/me.jpg' : null;
}
(async function() {
  const username = document.getElementById('userCorner')?.dataset.username || '';
  if (!username) return;
  const img = document.getElementById('ucAvatarImg');
  const icon = document.getElementById('ucAvatarIcon');

  // Always fetch /api/zones/me to get full data (gender + verified)
  let userData = {};
  try {
    const r = await fetch('/api/zones/me');
    userData = await r.json();
    if (!_zpData) _zpData = userData;
  } catch(e) {}
  _ucGender = userData.gender || '';

  // Show verified badge
  if (userData.is_verified) {
    const badge = document.getElementById('ucVerifiedBadge');
    if (badge) badge.style.display = '';
  }

  // Show gender default immediately, then try custom avatar
  const devSrc = _devAvatarSrc(username);
  const genderSrc = '/static/images/profile_' + (_ucGender === 'female' ? 'female' : 'male') + '.png';
  img.src = devSrc || genderSrc;
  img.onload = () => { img.style.display = 'block'; if (icon) icon.style.display = 'none'; };

  if (!devSrc) {
    _getAvatarRTDB(username).then(src => {
      if (src) { img.src = src; }
    });
  }
})();

// ── PROFILE MODAL ──
let _zpData = null;

async function openZoneProfile() {
  document.getElementById('zpOverlay').classList.add('open');
  if (!_zpData) {
    try {
      const res = await fetch('/api/zones/me');
      _zpData = await res.json();
    } catch(e) { _zpData = {}; }
  }
  const d = _zpData;
  const username = d.username || '';

  // Avatar — show gender default immediately, replace with custom if available
  const avatarEl = document.getElementById('zpAvatar');
  if (username) {
    const gender = d.gender || '';
    const devSrc = _devAvatarSrc(username);
    const genderSrc = '/static/images/profile_' + (gender === 'female' ? 'female' : 'male') + '.png';
    const _showAv = (src) => {
      avatarEl.innerHTML = '';
      const i = document.createElement('img');
      i.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%';
      i.src = src;
      avatarEl.appendChild(i);
      // Re-attach camera overlay after img swap
      if (!devSrc) _attachCamOverlay(avatarEl, username);
    };
    _showAv(devSrc || genderSrc);
    if (!devSrc) {
      _getAvatarRTDB(username).then(src => { if (src) _showAv(src); });
    }
  }

  document.getElementById('zpName').textContent = d.full_name || username || '—';
  const zpUser = document.getElementById('zpUsername');
  zpUser.textContent = username ? '@' + username : '—';
  // Verified badge below username
  let vbadge = document.getElementById('zpVerifiedBadge');
  if (d.is_verified) {
    if (!vbadge) {
      vbadge = document.createElement('div');
      vbadge.id = 'zpVerifiedBadge';
      vbadge.className = 'zp-verified-badge';
      vbadge.innerHTML = '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Verified';
      zpUser.insertAdjacentElement('afterend', vbadge);
    }
    vbadge.style.display = '';
  } else if (vbadge) {
    vbadge.style.display = 'none';
  }

  const rows = [];
  if (d.job_title) rows.push(['Job Title', d.job_title]);
  if (d.email)    rows.push(['Email',     d.email]);
  if (d.phone)    rows.push(['Phone',     d.phone]);
  if (d.gender)   rows.push(['Gender',    d.gender]);

  document.getElementById('zpFields').innerHTML = rows.length
    ? rows.map(([l, v]) => `<div class="zp-field"><span class="zp-field-label">${l}</span><span class="zp-field-val">${v}</span></div>`).join('')
    : '<div style="text-align:center;font-size:12px;color:var(--text-dim);padding:8px 0">No details</div>';
}

function closeZoneProfile() {
  document.getElementById('zpOverlay').classList.remove('open');
}

function _attachCamOverlay(avatarEl, username) {
  if (document.getElementById('zpCamOverlay')) return;
  avatarEl.style.position = 'relative';
  avatarEl.style.overflow = 'hidden';
  const cam = document.createElement('label');
  cam.id = 'zpCamOverlay';
  cam.htmlFor = 'zpFileInput';
  cam.title = 'Change photo';
  cam.className = 'zp-cam-overlay';
  cam.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>';
  avatarEl.appendChild(cam);
  // Hidden file input (once)
  if (!document.getElementById('zpFileInput')) {
    const fi = document.createElement('input');
    fi.id = 'zpFileInput'; fi.type = 'file'; fi.accept = 'image/*';
    fi.style.display = 'none';
    fi.onchange = (e) => _uploadZoneAvatar(e, username);
    document.body.appendChild(fi);
  }
}

async function _uploadZoneAvatar(e, username) {
  const file = e.target.files[0];
  if (!file) return;
  e.target.value = '';
  try {
    const src = await _uploadAvatarRTDB(username, file);
    // Refresh profile modal avatar
    const avatarEl = document.getElementById('zpAvatar');
    if (avatarEl) {
      avatarEl.innerHTML = '';
      const i = document.createElement('img');
      i.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%';
      i.src = src;
      avatarEl.appendChild(i);
      _attachCamOverlay(avatarEl, username);
    }
    // Refresh user corner avatar
    const ucImg = document.getElementById('ucAvatarImg');
    if (ucImg) { ucImg.src = src; ucImg.style.display = 'block'; }
    const ucIcon = document.getElementById('ucAvatarIcon');
    if (ucIcon) ucIcon.style.display = 'none';
    _zpData = null;
  } catch(err) {
    alert('فشل رفع الصورة. تأكد من الاتصال وحاول مجدداً.');
  }
}

// ── DEV OWNER PROFILE ──
function _buildDevOwnerRow() {
  const row = document.createElement('div');
  row.className = 'zu-user';
  row.style.cssText = 'cursor:pointer;background:rgba(59,130,246,.06);border:1px solid rgba(59,130,246,.15);border-radius:8px;padding:6px 10px;';
  row.title = 'View profile';
  row.onclick = openDevOwnerProfile;

  const avDiv = document.createElement('div');
  avDiv.className = 'zu-user-av';
  const avImg = document.createElement('img');
  avImg.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%';
  avImg.src = '/static/images/me.jpg';
  avImg.onerror = () => { avImg.src = '/static/images/profile_male.png'; };
  avDiv.appendChild(avImg);

  const infoEl = document.createElement('div');
  infoEl.style.cssText = 'flex:1;min-width:0;';

  const nameEl = document.createElement('div');
  nameEl.className = 'zu-user-name';
  nameEl.style.cssText = 'display:flex;align-items:center;gap:4px;';
  nameEl.innerHTML = 'Hamza K. Ghareb'
    + '<span class="zu-verified" title="Verified" style="display:inline-flex;align-items:center;justify-content:center;width:12px;height:12px;border-radius:50%;background:var(--blue,#3b82f6);flex-shrink:0;">'
    + '<svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>'
    + '<span style="font-size:9px;font-weight:700;color:var(--cyan,#06b6d4);border:1px solid rgba(6,182,212,.4);border-radius:4px;padding:1px 5px;margin-left:2px;">OWNER</span>';

  const jobEl = document.createElement('div');
  jobEl.className = 'zu-user-job';
  jobEl.textContent = 'Warehouse Keeper · IT & Development';

  infoEl.appendChild(nameEl);
  // job title intentionally omitted — show name only

  const dot = document.createElement('span');
  dot.className = 'zu-user-dot';
  dot.style.cssText = 'background:#10b981;box-shadow:0 0 6px #10b981;';
  dot.title = 'Online';

  row.appendChild(avDiv);
  row.appendChild(infoEl);
  row.appendChild(dot);
  return row;
}

function openDevOwnerProfile() {
  const existing = document.getElementById('devOwnerModal');
  if (existing) existing.remove();

  const isLight = document.documentElement.classList.contains('light');
  const card = {
    bg:      isLight ? '#ffffff'              : '#0f1729',
    border:  isLight ? 'rgba(37,99,235,.2)'   : 'rgba(59,130,246,.25)',
    text:    isLight ? '#0f172a'              : '#e2e8f0',
    muted:   isLight ? '#475569'              : '#8b9db8',
    rowBg:   isLight ? 'rgba(241,245,249,.8)' : 'rgba(255,255,255,.04)',
    rowBdr:  isLight ? '#e2e8f0'              : 'rgba(255,255,255,.08)',
    closeBdr:isLight ? '#cbd5e1'              : 'rgba(255,255,255,.15)',
    closeClr:isLight ? '#64748b'              : '#8b9db8',
    shadow:  isLight ? '0 24px 64px rgba(0,0,0,.12)' : '0 24px 64px rgba(0,0,0,.6)',
  };

  const overlay = document.createElement('div');
  overlay.id = 'devOwnerModal';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9100;background:rgba(0,0,0,.45);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:20px;';
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

  overlay.innerHTML = `
    <div style="background:${card.bg};border:1px solid ${card.border};border-radius:22px;padding:30px 24px 24px;max-width:320px;width:100%;position:relative;box-shadow:${card.shadow};text-align:center;">
      <div style="position:absolute;top:0;left:15%;right:15%;height:2px;background:linear-gradient(90deg,transparent,#3b82f6,#06b6d4,transparent);border-radius:2px;"></div>
      <button onclick="document.getElementById('devOwnerModal').remove()"
        style="position:absolute;top:12px;right:12px;width:28px;height:28px;border-radius:8px;border:1px solid ${card.closeBdr};background:transparent;color:${card.closeClr};cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;transition:.15s;"
        onmouseover="this.style.color='#ef4444';this.style.borderColor='rgba(239,68,68,.4)'"
        onmouseout="this.style.color='${card.closeClr}';this.style.borderColor='${card.closeBdr}'">✕</button>

      <!-- Avatar -->
      <div style="width:80px;height:80px;border-radius:50%;overflow:hidden;border:3px solid rgba(59,130,246,.35);margin:0 auto 16px;box-shadow:0 0 0 4px ${isLight?'rgba(59,130,246,.08)':'rgba(59,130,246,.12)'};">
        <img src="/static/images/me.jpg" onerror="this.src='/static/images/profile_male.png'" style="width:100%;height:100%;object-fit:cover;">
      </div>

      <!-- Name + verified + crown -->
      <div style="font-size:17px;font-weight:800;color:${card.text};margin-bottom:4px;display:flex;align-items:center;justify-content:center;gap:7px;flex-wrap:wrap;">
        Hamza K. Ghareb
        <span title="Verified" style="display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:50%;background:#3b82f6;flex-shrink:0;">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </span>
        <!-- Crown tag — glass effect -->
        <span title="System Owner" style="display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:8px;font-size:10px;font-weight:800;letter-spacing:.6px;
          background:${isLight?'rgba(255,197,0,.18)':'rgba(255,197,0,.14)'};
          border:1px solid ${isLight?'rgba(255,197,0,.5)':'rgba(255,197,0,.3)'};
          color:${isLight?'#92400e':'#fcd34d'};
          backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);">
          👑 OWNER
        </span>
      </div>

      <div style="font-size:12px;color:${card.muted};margin-bottom:16px;">Warehouse Keeper · IT &amp; Development</div>

      <!-- Fields -->
      <div style="text-align:left;display:flex;flex-direction:column;gap:7px;">
        <div style="display:flex;align-items:center;gap:10px;padding:9px 12px;background:${card.rowBg};border:1px solid ${card.rowBdr};border-radius:10px;">
          <span style="font-size:10px;color:${card.muted};font-weight:700;min-width:76px;text-transform:uppercase;letter-spacing:.5px;">Education</span>
          <span style="font-size:12px;color:${card.text};font-weight:500;">MBA — Business Administration</span>
        </div>
        <div style="display:flex;align-items:center;gap:10px;padding:9px 12px;background:${card.rowBg};border:1px solid ${card.rowBdr};border-radius:10px;">
          <span style="font-size:10px;color:${card.muted};font-weight:700;min-width:76px;text-transform:uppercase;letter-spacing:.5px;">Role</span>
          <span style="font-size:12px;color:${card.text};font-weight:500;">Warehouse Keeper &amp; Developer</span>
        </div>
        <div style="display:flex;align-items:center;gap:10px;padding:9px 12px;background:${card.rowBg};border:1px solid ${card.rowBdr};border-radius:10px;">
          <span style="font-size:10px;color:${card.muted};font-weight:700;min-width:76px;text-transform:uppercase;letter-spacing:.5px;">Built</span>
          <span style="font-size:12px;color:${card.text};font-weight:500;">EST-iMs — Inventory System</span>
        </div>
      </div>
    </div>`;

  document.body.appendChild(overlay);
}

// ── ONLINE USERS MODAL ──
async function openOnlineUsers() {
  document.getElementById('zuOverlay').classList.add('open');
  const list = document.getElementById('zuList');
  list.innerHTML = '<div class="zu-loading">Loading...</div>';
  try {
    const res = await fetch('/api/zones/users');
    const data = await res.json();
    const users = data.users || [];
    list.innerHTML = '';
    // ── Pinned Dev (Owner) — always first regardless of user count ──
    const devRow = _buildDevOwnerRow();
    list.appendChild(devRow);
    if (!users.length) {
      const emptyEl = document.createElement('div');
      emptyEl.className = 'zu-empty';
      emptyEl.textContent = 'No other registered users';
      list.appendChild(emptyEl);
    } else {
      const sep = document.createElement('div');
      sep.style.cssText = 'height:1px;background:rgba(255,255,255,.06);margin:6px 0 8px;';
      list.appendChild(sep);
    }
    users.forEach(u => {
      const row = document.createElement('div');
      row.className = 'zu-user';

      const avDiv = document.createElement('div');
      avDiv.className = 'zu-user-av';
      const uDevSrc = _devAvatarSrc(u.username || u);
      const uGenderSrc = '/static/images/profile_' + (u.gender === 'female' ? 'female' : 'male') + '.png';
      const avImg = document.createElement('img');
      avImg.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%';
      avImg.src = uDevSrc || uGenderSrc;
      avDiv.appendChild(avImg);
      if (!uDevSrc) {
        _getAvatarRTDB(u.username || u).then(src => { if (src) avImg.src = src; });
      }

      const infoEl = document.createElement('div');
      infoEl.style.cssText = 'flex:1;min-width:0;';
      const nameEl = document.createElement('div');
      nameEl.className = 'zu-user-name';
      nameEl.style.display = 'flex';
      nameEl.style.alignItems = 'center';
      nameEl.style.gap = '4px';
      const nameText = document.createTextNode(u.full_name || u.username || u);
      nameEl.appendChild(nameText);
      if (u.is_verified) {
        const vEl = document.createElement('span');
        vEl.className = 'zu-verified';
        vEl.title = 'Verified';
        vEl.innerHTML = '<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
        nameEl.appendChild(vEl);
      }
      infoEl.appendChild(nameEl);
      // job_title intentionally omitted — name only

      const dot = document.createElement('span');
      dot.className = 'zu-user-dot';
      dot.style.background = u.online ? '#10b981' : '#4a5568';
      dot.style.boxShadow = u.online ? '0 0 6px #10b981' : 'none';
      dot.title = u.online ? 'Online' : 'Offline';

      row.appendChild(avDiv);
      row.appendChild(infoEl);
      row.appendChild(dot);
      list.appendChild(row);
    });
  } catch(e) {
    list.innerHTML = '<div class="zu-loading">Failed to load</div>';
  }
}

function closeOnlineUsers() {
  document.getElementById('zuOverlay').classList.remove('open');
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeZoneProfile(); closeOnlineUsers(); }
});
