// ── LANGUAGE ──
const LOGIN_LANG = {
  en: {
    title: 'EST-iMs<sup style="font-size:0.45em;opacity:0.55;vertical-align:super;margin-left:2px">©</sup>',
    subtitle: 'Limited Access',
    backLabel: 'Back', themeLight: 'Light Mode', themeDark: 'Dark Mode',
    langLabel: 'عربي',
    userLabel: 'Username', passLabel: 'Password',
    userPlaceholder: 'Enter username', passPlaceholder: 'Enter password',
    signIn: 'Sign In', signingIn: 'Signing in...', success: '✓ Success',
    signUp: 'Sign Up', forgotPw: 'Forgot password?', noAccount: "Don't Have An Account?",
    rememberMe: 'Remember me',
    morning: 'Good morning ☀️', afternoon: 'Good afternoon 🌤️',
    evening: 'Good evening 🌆', night: 'Good night 🌙'
  },
  ar: {
    title: 'نظام EST للمخزون', subtitle: 'وصول محدود',
    backLabel: 'رجوع', themeLight: 'الوضع الفاتح', themeDark: 'الوضع الداكن',
    langLabel: 'English',
    userLabel: 'اسم المستخدم', passLabel: 'كلمة المرور',
    userPlaceholder: 'أدخل اسم المستخدم', passPlaceholder: 'أدخل كلمة المرور',
    signIn: 'تسجيل الدخول', signingIn: 'جاري الدخول...', success: '✓ تم',
    signUp: 'إنشاء حساب', forgotPw: 'نسيت كلمة المرور؟', noAccount: 'ليس لديك حساب؟',
    rememberMe: 'تذكرني',
    morning: 'صباح الخير ☀️', afternoon: 'مساء الخير 🌤️',
    evening: 'مساء النور 🌆', night: 'تصبح على خير 🌙'
  }
};
let loginLang = localStorage.getItem('est-lang') || 'en';

function applyLoginLang(lang) {
  loginLang = lang;
  localStorage.setItem('est-lang', lang);
  const t = LOGIN_LANG[lang];
  const isAr = lang === 'ar';
  document.documentElement.lang = lang;
  document.documentElement.dir  = isAr ? 'rtl' : 'ltr';

  const titleEl = document.querySelector('.login-title');
  if (titleEl) titleEl.innerHTML = t.title;
  const subEl = document.querySelector('.login-subtitle');
  if (subEl) subEl.textContent = t.subtitle;

  const userIn = document.getElementById('username');
  if (userIn) userIn.placeholder = t.userPlaceholder;
  const passIn = document.getElementById('password');
  if (passIn) passIn.placeholder = t.passPlaceholder;

  const btnText = document.getElementById('btnText');
  if (btnText) {
    const cur = btnText.textContent;
    const busy = [LOGIN_LANG.en.signingIn, LOGIN_LANG.ar.signingIn,
                  LOGIN_LANG.en.success,   LOGIN_LANG.ar.success];
    if (!busy.includes(cur)) btnText.textContent = t.signIn;
  }

  const signupLink = document.getElementById('loginLinkSignup');
  if (signupLink) signupLink.textContent = t.signUp;
  const forgotLink = document.getElementById('loginLinkForgot');
  if (forgotLink) forgotLink.textContent = t.forgotPw;
  const noAccount = document.getElementById('loginNoAccount');
  if (noAccount) noAccount.textContent = t.noAccount;
  const rmEl = document.getElementById('rememberMeText');
  if (rmEl) rmEl.textContent = t.rememberMe;

  const backLbl = document.getElementById('dockBackLabel');
  if (backLbl) backLbl.textContent = t.backLabel;

  const langText = document.getElementById('loginLangText');
  if (langText) langText.textContent = isAr ? 'EN' : 'AR';
  const langLbl = document.getElementById('loginLangLabel');
  if (langLbl) langLbl.textContent = t.langLabel;

  updateLoginGreeting();
  updateDockTheme();
}

function toggleLoginLang() {
  applyLoginLang(loginLang === 'en' ? 'ar' : 'en');
}

function updateLoginGreeting() {
  const t = LOGIN_LANG[loginLang];
  const h = new Date().getHours();
  const el = document.getElementById('welcomeMsg');
  if (!el) return;
  if (h >= 5  && h < 12) el.textContent = t.morning;
  else if (h >= 12 && h < 17) el.textContent = t.afternoon;
  else if (h >= 17 && h < 21) el.textContent = t.evening;
  else                         el.textContent = t.night;
}

// ── THEME ──
(function() {
  const saved = localStorage.getItem('est-theme');
  if (saved === 'light') document.documentElement.classList.add('light');
})();

function updateDockTheme() {
  const isLight = document.documentElement.classList.contains('light');
  const t = LOGIN_LANG[loginLang] || LOGIN_LANG.en;
  const label = document.getElementById('dockThemeLabel');
  if (label) label.textContent = isLight ? t.themeDark : t.themeLight;
}

function toggleTheme() {
  const isLight = document.documentElement.classList.toggle('light');
  localStorage.setItem('est-theme', isLight ? 'light' : 'dark');
  updateDockTheme();
}

// welcome message handled by applyLoginLang → updateLoginGreeting

// ── PASSWORD TOGGLE ──
document.getElementById('pwToggle').addEventListener('click', function() {
  const inp = document.getElementById('password');
  const icon = document.getElementById('eyeIcon');
  if (inp.type === 'password') {
    inp.type = 'text';
    icon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>';
  } else {
    inp.type = 'password';
    icon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
  }
});

// ── ENTER KEY ──
document.addEventListener('keydown', function(e) {
  if (e.key === 'Enter') doLogin();
});

// ── PROGRESS BAR ──
function startProgress() {
  const bar = document.getElementById('progressBar');
  bar.style.display = 'block';
  bar.style.transition = 'none';
  bar.style.width = '0%';
  setTimeout(() => {
    bar.style.transition = 'width 1.8s ease';
    bar.style.width = '85%';
  }, 10);
}
function finishProgress(success) {
  const bar = document.getElementById('progressBar');
  bar.style.transition = 'width 0.3s ease';
  bar.style.width = '100%';
  if (success) bar.style.background = 'linear-gradient(90deg,#10b981,#34d399)';
  else bar.style.background = 'linear-gradient(90deg,#ef4444,#f87171)';
  setTimeout(() => {
    bar.style.opacity = '0';
    bar.style.transition = 'opacity 0.4s';
    setTimeout(() => {
      bar.style.display = 'none';
      bar.style.opacity = '1';
      bar.style.background = '';
    }, 400);
  }, 500);
}

// ── SHAKE CARD ──
function shakeCard() {
  const card = document.querySelector('.login-card');
  card.classList.remove('shake');
  void card.offsetWidth; // reflow
  card.classList.add('shake');
  setTimeout(() => card.classList.remove('shake'), 600);
}

// ── LOCKOUT COUNTDOWN (persistent via localStorage) ──
const LOCKOUT_KEY = 'est_lockout_until';

function getLockoutUntil() {
  try { return parseInt(localStorage.getItem(LOCKOUT_KEY) || '0', 10); } catch(e) { return 0; }
}

function setLockoutUntil(seconds) {
  const until = Date.now() + seconds * 1000;
  try { localStorage.setItem(LOCKOUT_KEY, String(until)); } catch(e) {}
  startLockoutCountdown(seconds);
}

function clearLockout() {
  try { localStorage.removeItem(LOCKOUT_KEY); } catch(e) {}
}

let _lockoutTimer = null;
let _failedAttempts = 0;
const MAX_WARN_ATTEMPTS = 5;

function startLockoutCountdown(remaining) {
  const loginBtn = document.getElementById('loginBtn');
  const btnText  = document.getElementById('btnText');
  const spinner  = document.getElementById('spinner');
  clearInterval(_lockoutTimer);

  function tick() {
    const until = getLockoutUntil();
    const now = Date.now();
    const secs = Math.max(0, Math.ceil((until - now) / 1000));
    if (secs <= 0) {
      clearInterval(_lockoutTimer);
      clearLockout();
      _failedAttempts = 0;
      loginBtn.disabled = false;
      btnText.textContent = 'Sign In';
      spinner.style.display = 'none';
      document.getElementById('errorBox').classList.add('hidden');
      return;
    }
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    // Keep button enabled — correct password still allows entry
    loginBtn.disabled = false;
    spinner.style.display = 'none';
    btnText.textContent = 'Sign In';
    showError(`⚠️ ${MAX_WARN_ATTEMPTS} failed attempts — Enter correct password to login (${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')})`);
  }
  tick();
  _lockoutTimer = setInterval(tick, 1000);
}

// Check on page load
(function() {
  const until = getLockoutUntil();
  if (until > Date.now()) {
    const remaining = Math.ceil((until - Date.now()) / 1000);
    startLockoutCountdown(remaining);
  }
})();

// Also check lockout status from server on load
fetch('/api/lockout_status').then(r => r.json()).then(d => {
  if (d.locked && d.remaining > 0) {
    setLockoutUntil(d.remaining);
  }
}).catch(() => {});

function showLoginAlert(title, text) {
  document.getElementById('loginAlertTitle').textContent = title;
  document.getElementById('loginAlertText').textContent = text;
  document.getElementById('loginAlertModal').classList.add('open');
}
function closeLoginAlert() {
  document.getElementById('loginAlertModal')?.classList.remove('open');
  document.getElementById('forceLogoutBtn').style.display = 'none';
}

async function forceLogoutOther() {
  const username = document.getElementById('username')?.value?.trim() || '';
  const password = document.getElementById('password')?.value?.trim() || '';
  const btn = document.getElementById('forceLogoutBtn');
  btn.disabled = true;
  btn.textContent = 'جارٍ الطرد...';
  try {
    const res = await fetch('/api/force_logout_other', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ username, password })
    });
    const d = await res.json();
    if (d.success) {
      closeLoginAlert();
      // Retry login automatically
      await doLogin();
    } else {
      btn.disabled = false;
      btn.textContent = 'تسجيل خروج من الجهاز الآخر والدخول هنا';
      document.getElementById('loginAlertText').textContent = d.message || 'فشل الطرد. تأكد من كلمة المرور.';
    }
  } catch(e) {
    btn.disabled = false;
    btn.textContent = 'تسجيل خروج من الجهاز الآخر والدخول هنا';
  }
}

// ── LOGIN ──
async function doLogin() {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();
  const errorBox = document.getElementById('errorBox');
  const spinner  = document.getElementById('spinner');
  const btnText  = document.getElementById('btnText');
  const loginBtn = document.getElementById('loginBtn');

  errorBox.classList.add('hidden');

  if (['admin','administrator','dev','developer','root','superadmin'].includes(username.toLowerCase())) {
    showLoginAlert('Reserved account name', 'This username is reserved for system roles and cannot be used from this login form.');
    shakeCard();
    return;
  }

  if (!username || !password) {
    showError('Please enter your username and password.');
    shakeCard();
    return;
  }

  startProgress();
  spinner.style.display = 'block';
  btnText.textContent = LOGIN_LANG[loginLang].signingIn;
  loginBtn.disabled = true;

  try {
    const res = await fetch('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ username, password, remember_me: document.getElementById('rememberMe')?.checked || false })
    });
    const data = await res.json();
    if (data.success) {
      clearLockout();
      _failedAttempts = 0;
      finishProgress(true);
      btnText.textContent = LOGIN_LANG[loginLang].success;
      spinner.style.display = 'none';
      loginBtn.classList.add('success');
      setTimeout(() => { window.location.href = data.redirect || '/zones'; }, 600);
    } else if (data.active_elsewhere) {
      finishProgress(false);
      // Show force-logout button so user can kick the other session
      document.getElementById('forceLogoutBtn').style.display = 'block';
      showLoginAlert('الحساب مفتوح من جهاز آخر', data.message || 'هذا الحساب مسجل الدخول من جهاز آخر حالياً. يمكنك طرد تلك الجلسة والدخول من هنا.');
      shakeCard();
      resetBtn();
    } else if (data.locked) {
      // Server says locked — show warning countdown but keep button enabled
      finishProgress(false);
      _failedAttempts++;
      setLockoutUntil(data.remaining || 300);
      shakeCard();
      resetBtn();
    } else {
      finishProgress(false);
      _failedAttempts++;
      let msg = data.message || 'Incorrect username or password';
      if (_failedAttempts >= MAX_WARN_ATTEMPTS) {
        msg = ` ${_failedAttempts} Please wait`;
      } else {
        msg = `${msg} (${_failedAttempts}/${MAX_WARN_ATTEMPTS} attempts)`;
      }
      showError(msg);
      shakeCard();
      resetBtn();
    }
  } catch(e) {
    finishProgress(false);
    showError('Connection error. Please try again.');
    shakeCard();
    resetBtn();
  }
}

function showError(msg) {
  const box = document.getElementById('errorBox');
  document.getElementById('errorMsg').textContent = msg;
  box.classList.remove('hidden');
  box.style.display = 'flex';
}

function resetBtn() {
  document.getElementById('spinner').style.display = 'none';
  document.getElementById('btnText').textContent = LOGIN_LANG[loginLang].signIn;
  document.getElementById('loginBtn').disabled = false;
}

// ── PARTICLES ──
(function() {
  const canvas = document.getElementById('particleCanvas');
  const ctx = canvas.getContext('2d');
  let W, H, particles = [], mouse = { x: -999, y: -999 };
  const isLight = () => document.documentElement.classList.contains('light');

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function Particle() {
    this.x  = Math.random() * W;
    this.y  = Math.random() * H;
    this.vx = (Math.random() - 0.5) * 0.4;
    this.vy = (Math.random() - 0.5) * 0.4;
    this.r  = Math.random() * 1.8 + 0.4;
    this.alpha = Math.random() * 0.5 + 0.1;
  }

  Particle.prototype.update = function() {
    this.x += this.vx;
    this.y += this.vy;
    if (this.x < 0) this.x = W;
    if (this.x > W) this.x = 0;
    if (this.y < 0) this.y = H;
    if (this.y > H) this.y = 0;
    // mouse repel
    const dx = this.x - mouse.x, dy = this.y - mouse.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist < 100) {
      this.x += dx / dist * 1.2;
      this.y += dy / dist * 1.2;
    }
  };

  function init() {
    resize();
    particles = [];
    const count = Math.floor((W * H) / 14000);
    for (let i = 0; i < count; i++) particles.push(new Particle());
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const light = isLight();
    const dotColor   = light ? 'rgba(37,99,235,'   : 'rgba(59,130,246,';
    const lineColor  = light ? 'rgba(37,99,235,'   : 'rgba(59,130,246,';
    const maxDist = 130;

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.update();
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = dotColor + p.alpha + ')';
      ctx.fill();

      for (let j = i + 1; j < particles.length; j++) {
        const q = particles[j];
        const dx = p.x - q.x, dy = p.y - q.y;
        const d = Math.sqrt(dx*dx + dy*dy);
        if (d < maxDist) {
          const a = (1 - d / maxDist) * 0.18 * (light ? 1 : 0.7);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(q.x, q.y);
          ctx.strokeStyle = lineColor + a + ')';
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
      }
    }
    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', init);
  window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
  window.addEventListener('mouseleave', () => { mouse.x = -999; mouse.y = -999; });
  init();
  draw();
})();

// ── INIT LANGUAGE ──
applyLoginLang(loginLang);
