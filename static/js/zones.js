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
    zoneLabels: { zone1:'زون 1', zone2:'زون 2', zone3:'Packaging', zone4:'زون 4', zone5:'زون 5', qc:'Quality Control', admin:'Administration', dev:'' },
  },
  ar: {
    title: 'اختر الزون',
    sub: 'اختر زون المستودع الذي تريد الدخول إليه',
    mgmt: 'الإدارة',
    welcome: 'الرئيسية',
    logout: 'تسجيل الخروج',
    lang: 'English',
    enterZone: 'دخول',
    verifying: 'جارٍ التحقق...',
    accessGranted: '✓ تم الدخول',
    incorrectPwd: 'كلمة المرور غير صحيحة',
    connErr: 'خطأ في الاتصال. حاول مرة أخرى.',
    enterPwd: 'أدخل كلمة مرور الزون',
    enterPwdSub: 'أدخل كلمة المرور للدخول إلى هذا الزون',
    zoneNames: { zone1:'زون 1', zone2:'زون 2', zone3:'زون 3', zone4:'زون 4', zone5:'زون 5', qc:'جودة', admin:'EST', dev:'Dev' },
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
  document.querySelector('.zones-title').textContent = t.title;
  document.querySelector('.zones-sub').textContent   = t.sub;
  document.querySelector('.zones-divider-text').textContent = t.mgmt;
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

// Load avatar in user-corner + verified badge
let _ucGender = '';
function _devAvatarSrc(username) {
  return username.toLowerCase() === 'mlo5' ? '/static/images/me.jpg' : null;
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
    const customImg = new Image();
    customImg.onload = () => { img.src = customImg.src; };
    customImg.src = '/api/avatar/' + encodeURIComponent(username);
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
      const i = document.createElement('img');
      i.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%';
      i.src = src;
      avatarEl.innerHTML = '';
      avatarEl.appendChild(i);
    };
    _showAv(devSrc || genderSrc);
    if (!devSrc) {
      const customImg = new Image();
      customImg.onload = () => _showAv(customImg.src);
      customImg.src = '/api/avatar/' + encodeURIComponent(username);
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

// ── ONLINE USERS MODAL ──
async function openOnlineUsers() {
  document.getElementById('zuOverlay').classList.add('open');
  const list = document.getElementById('zuList');
  list.innerHTML = '<div class="zu-loading">Loading...</div>';
  try {
    const res = await fetch('/api/zones/users');
    const data = await res.json();
    const users = data.users || [];
    if (!users.length) {
      list.innerHTML = '<div class="zu-empty">No registered users</div>';
      return;
    }
    list.innerHTML = '';
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
        const customImg = new Image();
        customImg.onload = () => { avImg.src = customImg.src; };
        customImg.src = '/api/avatar/' + encodeURIComponent(u.username || u);
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
      if (u.job_title) {
        const jobEl = document.createElement('div');
        jobEl.style.cssText = 'font-size:10px;color:var(--text-dim);margin-top:1px;';
        jobEl.textContent = u.job_title;
        infoEl.appendChild(jobEl);
      }

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
