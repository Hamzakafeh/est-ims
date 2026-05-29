// ── DEVELOPER MODAL ──
function openDevModal() {
  const ov = document.getElementById('devOverlay');
  if (!ov) return;
  ov.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}
function closeDevModal() {
  const ov = document.getElementById('devOverlay');
  if (!ov) return;
  ov.style.display = 'none';
  document.body.style.overflow = '';
}
function closeDevModalOutside(e) {
  if (e.target === document.getElementById('devOverlay')) closeDevModal();
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeDevModal(); closeQuickScan(); } });

// ── THEME ──
(function() {
  if (localStorage.getItem('est-theme') === 'light')
    document.documentElement.classList.add('light');
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

// ── TYPEWRITER LOOP ──
(function() {
  const word        = 'ALESTESHARIA';
  const el          = document.getElementById('brandText');
  const wrap        = document.getElementById('brandName');
  const typeSpeed   = 155;
  const deleteSpeed = 85;
  const pauseFull   = 2400;
  const pauseEmpty  = 550;

  wrap.style.opacity   = '0';
  wrap.style.transform = 'translateY(16px)';
  wrap.style.transition = 'opacity 0.55s ease, transform 0.55s ease';

  setTimeout(() => {
    wrap.style.opacity   = '1';
    wrap.style.transform = 'translateY(0)';

    let i = 0, deleting = false;

    function tick() {
      if (!deleting) {
        i++;
        el.textContent = word.slice(0, i);
        if (i === word.length) {
          setTimeout(() => { deleting = true; tick(); }, pauseFull);
        } else {
          setTimeout(tick, typeSpeed);
        }
      } else {
        i--;
        el.textContent = word.slice(0, i);
        if (i === 0) {
          deleting = false;
          setTimeout(tick, pauseEmpty);
        } else {
          setTimeout(tick, deleteSpeed);
        }
      }
    }
    tick();
  }, 500);
})();

// ── PARTICLES ──
(function() {
  const canvas = document.getElementById('particleCanvas');
  const ctx    = canvas.getContext('2d');
  let W, H, particles = [], mouse = { x: -999, y: -999 };
  const isLight = () => document.documentElement.classList.contains('light');

  function resize() { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }

  function Particle() {
    this.x  = Math.random() * W; this.y  = Math.random() * H;
    this.vx = (Math.random() - 0.5) * 0.35; this.vy = (Math.random() - 0.5) * 0.35;
    this.r  = Math.random() * 1.6 + 0.4; this.alpha = Math.random() * 0.4 + 0.08;
  }

  Particle.prototype.update = function() {
    this.x += this.vx; this.y += this.vy;
    if (this.x < 0) this.x = W; if (this.x > W) this.x = 0;
    if (this.y < 0) this.y = H; if (this.y > H) this.y = 0;
    const dx = this.x - mouse.x, dy = this.y - mouse.y;
    const d  = Math.sqrt(dx*dx + dy*dy);
    if (d < 110) { this.x += dx/d*1.4; this.y += dy/d*1.4; }
  };

  function init() {
    resize(); particles = [];
    const n = Math.floor((W * H) / 13000);
    for (let i = 0; i < n; i++) particles.push(new Particle());
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const light = isLight();
    const dc = light ? 'rgba(37,99,235,' : 'rgba(59,130,246,';
    const lc = light ? 'rgba(37,99,235,' : 'rgba(59,130,246,';
    const md = 135;
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.update();
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
      ctx.fillStyle = dc + p.alpha + ')'; ctx.fill();
      for (let j = i+1; j < particles.length; j++) {
        const q  = particles[j];
        const dx = p.x - q.x, dy = p.y - q.y;
        const d  = Math.sqrt(dx*dx + dy*dy);
        if (d < md) {
          const a = (1 - d/md) * 0.15 * (light ? 1 : 0.65);
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y);
          ctx.strokeStyle = lc + a + ')'; ctx.lineWidth = 0.6; ctx.stroke();
        }
      }
    }
    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', init);
  window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
  window.addEventListener('mouseleave', () => { mouse.x = -999; mouse.y = -999; });
  init(); draw();
})();

fetch('https://est-ims.onrender.com/ping').catch(() => {});
fetch('/api/track_visit', { method: 'POST' }).catch(() => {});

// ── STATS ──
(async function() {
  try {
    const res  = await fetch('/api/stats');
    const data = await res.json();
    if (data.total !== undefined) {
      document.getElementById('statTotal').textContent = data.total.toLocaleString();
      document.getElementById('statToday').textContent = data.today.toLocaleString();
    }
  } catch(e) {}
})();

// ── TAGLINE CYCLER ──
const TAGLINES = {
  en: [
    'Streamlined inventory tracking, real‑time stock management,<br>and precise reporting — all in one place.',
    'Zone-based access, QR scanning, and Excel export<br>built for warehouse teams.',
    'From stock intake to final report —<br>every step managed digitally.',
    'Quality control, multi-zone warehousing,<br>and live dashboards — all connected.'
  ],
  ar: [
    'تتبع المخزون بشكل مبسط، وإدارة المخزون الفوري،<br>وتقارير دقيقة — كل ذلك في مكان واحد.',
    'وصول قائم على المناطق، مسح QR، وتصدير Excel<br>مصمم لفرق المستودعات.',
    'من استلام المخزون حتى التقرير النهائي —<br>كل خطوة تُدار رقمياً.',
    'ضبط الجودة، مستودعات متعددة المناطق،<br>ولوحات تحكم مباشرة — كل شيء متصل.'
  ]
};
let taglineIdx = 0;

function rotateTagline() {
  const el = document.getElementById('taglineEl');
  if (!el) return;
  el.classList.remove('flip-in');
  el.classList.add('flip-out');
  setTimeout(function() {
    taglineIdx = (taglineIdx + 1) % TAGLINES[welcomeLang].length;
    el.innerHTML = TAGLINES[welcomeLang][taglineIdx];
    el.classList.remove('flip-out');
    el.classList.add('flip-in');
  }, 340);
}
setTimeout(function() { setInterval(rotateTagline, 4200); }, 4000);

// ── LANGUAGE TOGGLE (Welcome) ──
const WELCOME_LANG = {
  en: {
    chip: 'Welcome', subHeading: 'Inventory Management System',
    suffix: 'Animal Nutrition',
    loginBtn: 'Log In', moreBtn: 'For More', langLabel: 'عربي',
    dockLogin: 'Log In', dockContact: 'Contact Us', dockHelp: 'Help', dockScan: 'QR Scan', dockAbout: 'About Us',
    texts: {
      step1Desc: 'Register from the welcome page with your employee details and submit an access request.',
      step2Desc: 'An admin reviews your request and activates your account with the appropriate zone access.',
      step3Desc: 'Sign in with your credentials to enter the system and access your assigned workspace.',
      step4Desc: 'Select your warehouse zone — each zone holds its own inventory categorized by year and month.',
      step5Desc: 'Track items, scan QR codes for quick lookups, edit stock, and export reports to Excel.',
      aboutCard1Text: 'Manufactures a wide range of livestock and poultry feed — including sacks, rolls, plastic-packaged, and custom nutritional blends for every production need.',
      aboutCard2Text: 'Operates multiple specialized warehouse zones, each managed independently with its own inventory tracking, access control, and reporting structure.',
      aboutCard3Text: 'Fully digitized inventory with real-time stock updates, QR-code–based item tracking, quality control workflows, and Excel-based reporting for operations teams.',
      devProfileSubtitle: 'Warehouse Keeper – IT &nbsp;·&nbsp; Master of Business Administration',
      devProfileBio: 'Designed and built EST-iMs entirely from scratch — combining hands-on warehouse expertise with self-taught full-stack development. The system was created to solve real operational challenges faced daily at Alestesharia Animal Nutrition, transforming manual spreadsheet processes into a live, connected digital platform.',
      devHighlight1: 'Real-time SSE for live QC updates across all connected devices',
      devHighlight2: 'Zone-based access control with single-session enforcement per user',
      devHighlight3: 'Excel-based inventory engine with openpyxl for data persistence and export',
      footerCopyText: 'Copyright 2026 &nbsp;|&nbsp; All Rights Reserved',
      footerDevText: 'Developed By'
    }
  },
  ar: {
    chip: 'أهلاً', subHeading: 'نظام إدارة المخزون',
    suffix: 'التغذية الحيوانية',
    loginBtn: 'تسجيل الدخول', moreBtn: 'للمزيد', langLabel: 'English',
    dockLogin: 'دخول', dockContact: 'تواصل معنا', dockHelp: 'مساعدة', dockScan: 'مسح QR', dockAbout: 'من نحن',
    texts: {
      step1Desc: 'سجّل من صفحة الترحيب ببياناتك الوظيفية وأرسل طلب الوصول.',
      step2Desc: 'يراجع المسؤول طلبك ويفعّل حسابك بصلاحيات المنطقة المناسبة.',
      step3Desc: 'سجّل الدخول ببياناتك للوصول إلى النظام ومساحة العمل المخصصة لك.',
      step4Desc: 'اختر منطقة المستودع — كل منطقة تحتوي مخزوناً مستقلاً مصنفاً بالسنة والشهر.',
      step5Desc: 'تتبع الأصناف، امسح رموز QR للبحث السريع، عدّل المخزون، وصدّر التقارير إلى Excel.',
      aboutCard1Text: 'تصنّع مجموعة واسعة من أعلاف الماشية والدواجن — تشمل الأكياس والرولات والمعبأ بالبلاستيك والمخاليط الغذائية المخصصة لكل احتياج إنتاجي.',
      aboutCard2Text: 'تدير مناطق مستودعات متعددة ومتخصصة، تُدار كل منها باستقلالية مع تتبع المخزون الخاص بها وصلاحيات الوصول وهيكل التقارير.',
      aboutCard3Text: 'مخزون رقمي بالكامل مع تحديثات فورية للمخزون، وتتبع الأصناف برموز QR، وسير عمل لضبط الجودة، وتقارير Excel لفرق العمليات.',
      devProfileSubtitle: 'أمين مستودع – تقنية المعلومات &nbsp;·&nbsp; ماجستير إدارة الأعمال',
      devProfileBio: 'صمّم وبنى EST-iMs من الصفر — جامعاً بين الخبرة الميدانية في المستودعات والتطوير البرمجي المتكامل المكتسب ذاتياً. أُنشئ النظام لحل تحديات تشغيلية حقيقية يواجهها يومياً في الاستشارية للتغذية الحيوانية، محوّلاً العمليات اليدوية بالجداول إلى منصة رقمية حية ومتكاملة.',
      devHighlight1: 'SSE الفوري لتحديثات ضبط الجودة المباشرة عبر جميع الأجهزة المتصلة',
      devHighlight2: 'تحكم بالوصول قائم على المناطق مع تطبيق جلسة مفردة لكل مستخدم',
      devHighlight3: 'محرك مخزون قائم على Excel مع openpyxl لاستمرارية البيانات والتصدير',
      footerCopyText: 'حقوق النشر 2026 &nbsp;|&nbsp; جميع الحقوق محفوظة',
      footerDevText: 'تطوير بواسطة'
    }
  }
};
let welcomeLang = localStorage.getItem('est-lang') || 'en';

function applyWelcomeLang(lang) {
  welcomeLang = lang;
  localStorage.setItem('est-lang', lang);
  const t = WELCOME_LANG[lang];
  const isAr = lang === 'ar';
  document.documentElement.lang = lang;
  document.documentElement.dir  = isAr ? 'rtl' : 'ltr';
  const chip = document.querySelector('.welcome-chip');
  if (chip) chip.textContent = t.chip;
  const sub = document.querySelector('.sub-heading');
  if (sub) sub.textContent = t.subHeading;
  const suf = document.querySelector('.brand-suffix');
  if (suf) suf.textContent = t.suffix;
  const tagEl = document.getElementById('taglineEl');
  if (tagEl) tagEl.innerHTML = TAGLINES[lang][taglineIdx];
  const loginText = document.getElementById('welcomeLoginText');
  if (loginText) loginText.textContent = t.loginBtn;
  const moreText = document.getElementById('welcomeMoreText');
  if (moreText) moreText.textContent = t.moreBtn;
  const langLbl = document.getElementById('welcomeLangLabel');
  if (langLbl) langLbl.textContent = t.langLabel;
  const langDockText = document.getElementById('langDockText');
  if (langDockText) langDockText.textContent = isAr ? 'EN' : 'AR';
  document.querySelectorAll('[data-en][data-ar]').forEach(function(el) {
    el.textContent = isAr ? el.getAttribute('data-ar') : el.getAttribute('data-en');
  });
  if (t.texts) {
    Object.keys(t.texts).forEach(function(id) {
      const el = document.getElementById(id);
      if (el) el.innerHTML = t.texts[id];
    });
  }
  updateDockTheme();
}

function toggleWelcomeLang() {
  applyWelcomeLang(welcomeLang === 'en' ? 'ar' : 'en');
}

applyWelcomeLang(welcomeLang);

// ── QUICK QR SCAN ──
let quickScanner = null;
let quickScannerBusy = false;

function quickScanText(key) {
  const isAr = (localStorage.getItem('est-lang') || 'en') === 'ar';
  const text = {
    opening:     isAr ? 'جاري فتح الكاميرا...'                           : 'Opening camera...',
    scanning:    isAr ? 'وجه الكاميرا على كود QR.'                       : 'Point the camera at a QR code.',
    loading:     isAr ? 'جاري جلب البيانات...'                           : 'Retrieving live data...',
    again:       isAr ? 'مسح كود آخر'                                    : 'Scan another code',
    cameraError: isAr ? 'تعذر فتح الكاميرا. تأكد من السماح بصلاحية الكاميرا.' : 'The camera could not be opened. Please allow camera permission.',
    notFound:    isAr ? 'الكود غير موجود في النظام.'                     : 'The code is not found in the system.',
    serverError: isAr ? 'تعذر الاتصال بالسيرفر.'                        : 'Unable to connect to the server.',
    lastUpdate:  isAr ? 'آخر تحديث: '                                    : 'Last update: '
  };
  return text[key];
}

function setQuickScanStatus(text, isError = false) {
  const status = document.getElementById('quickScanStatus');
  if (!status) return;
  status.textContent = text;
  status.style.color = isError ? '#ef4444' : 'var(--text-muted)';
}

function resetQuickScanResult() {
  const result = document.getElementById('quickScanResult');
  const again  = document.getElementById('quickScanAgain');
  if (result) result.style.display = 'none';
  if (again)  { again.style.display = 'none'; again.textContent = quickScanText('again'); }
}

function openQuickScan() {
  const overlay = document.getElementById('quickScanOverlay');
  if (!overlay) return;
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  resetQuickScanResult();
  setQuickScanStatus(quickScanText('opening'));
  setTimeout(startQuickScanCamera, 180);
}

function closeQuickScan() {
  stopQuickScanCamera();
  const overlay = document.getElementById('quickScanOverlay');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
  quickScannerBusy = false;
}

function closeQuickScanOutside(event) {
  if (event.target === document.getElementById('quickScanOverlay')) closeQuickScan();
}

function startQuickScanCamera() {
  if (!document.getElementById('quickScanOverlay')?.classList.contains('open')) return;
  if (typeof Html5Qrcode === 'undefined') { setQuickScanStatus(quickScanText('cameraError'), true); return; }
  stopQuickScanCamera();
  quickScannerBusy = false;
  document.getElementById('quickQrReader').innerHTML = '';
  quickScanner = new Html5Qrcode('quickQrReader');
  quickScanner.start(
    { facingMode: 'environment' },
    { fps: 12, qrbox: { width: 240, height: 240 } },
    decoded => {
      if (quickScannerBusy) return;
      quickScannerBusy = true;
      stopQuickScanCamera();
      handleQuickScanned(decoded);
    },
    () => {}
  ).then(() => {
    setQuickScanStatus(quickScanText('scanning'));
  }).catch(() => {
    setQuickScanStatus(quickScanText('cameraError'), true);
  });
}

function stopQuickScanCamera() {
  if (quickScanner) {
    const scanner = quickScanner;
    quickScanner = null;
    scanner.stop().catch(() => {}).finally(() => { scanner.clear().catch(() => {}); });
  }
}

function handleQuickScanned(raw) {
  let sku = raw.trim().toUpperCase();
  try {
    const url = new URL(raw);
    const fromParam = url.searchParams.get('sku');
    if (fromParam) sku = fromParam.trim().toUpperCase();
  } catch (e) {}
  setQuickScanStatus(quickScanText('loading'));
  fetch('/api/qrscan/' + encodeURIComponent(sku))
    .then(r => r.json())
    .then(data => { if (data.found) showQuickScanResult(data); else showQuickScanError(data.error || quickScanText('notFound')); })
    .catch(() => showQuickScanError(quickScanText('serverError')));
}

function showQuickScanResult(data) {
  const balance = Number(data.balance);
  document.getElementById('quickScanResultBar').style.background = data.hex || '#1a3a5c';
  document.getElementById('quickScanCategory').textContent  = data.category || 'Stocktaking';
  document.getElementById('quickScanName').textContent      = data.nameAr || data.color || data.sku;
  document.getElementById('quickScanBalance').textContent   = Number.isFinite(balance) ? balance.toLocaleString() : data.balance;
  document.getElementById('quickScanDate').textContent      = quickScanText('lastUpdate') + (data.date || '-');
  document.getElementById('quickScanSku').textContent       = data.sku;
  document.getElementById('quickScanResult').style.display  = 'block';
  document.getElementById('quickScanAgain').style.display   = 'block';
  setQuickScanStatus('');
}

function showQuickScanError(message) {
  document.getElementById('quickScanAgain').style.display = 'block';
  setQuickScanStatus(message, true);
}

function restartQuickScan() {
  resetQuickScanResult();
  setQuickScanStatus(quickScanText('opening'));
  startQuickScanCamera();
}

// ── SCROLL INDICATOR HIDE + BACK TO TOP ──
(function() {
  const si  = document.getElementById('scrollIndicator');
  const btt = document.getElementById('backToTop');
  window.addEventListener('scroll', function() {
    const y = window.scrollY;
    if (si)  si.classList.toggle('hidden', y > 80);
    if (btt) btt.classList.toggle('visible', y > 400);
  }, { passive: true });
})();

// ── SCROLL REVEAL ──
(function() {
  const els = document.querySelectorAll('.reveal');
  if (!els.length) return;
  const obs = new IntersectionObserver(function(entries) {
    entries.forEach(function(e) {
      if (e.isIntersecting) {
        e.target.classList.add('revealed');
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });
  els.forEach(function(el) { obs.observe(el); });
})();
