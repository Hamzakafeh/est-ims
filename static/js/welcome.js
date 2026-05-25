// ── AI AGENT ──
const SYSTEM_PROMPT = `You are the EST-iMs AI Assistant — a smart, concise helper for the EST-iMs Inventory Management System used by Alestesharia Animal Nutrition.

About the system:
- EST-iMs is a web-based inventory management system for a feed/animal nutrition company
- It tracks stock across multiple warehouse zones: Zone 1, Zone 2, Zone 3 (Packaging), Zone 4, Zone 5, Admin, and Dev
- Features: real-time stock tracking, zone-based access control, edit mode with password protection, inventory reports in Excel, and a clean dark/light UI
- Users log in with credentials and select their zone. Super zones (Admin, Dev) can view all zones and switch between them
- The system runs on Flask (Python) with openpyxl for Excel-based inventory storage
- Developed by Hamza K. Ghareb, Warehouse Keeper - IT, with an MBA background

Your role:
- Answer questions about how to use EST-iMs, its features, zones, login process, and general inventory management
- Be concise, helpful, and professional — keep replies short (2-4 sentences max unless a list is needed)
- Use Arabic if the user writes in Arabic
- Do NOT make up specific stock numbers or confidential data
- If asked something outside the system scope, politely redirect to what you can help with`;

let aiOpen = false;
let aiLoading = false;
let conversationHistory = [];
let greetingShown = false;

function toggleAI() {
  aiOpen = !aiOpen;
  document.getElementById('aiFab').classList.toggle('open', aiOpen);
  document.getElementById('aiPanel').classList.toggle('open', aiOpen);
  if (aiOpen && !greetingShown) {
    greetingShown = true;
    setTimeout(() => showGreeting(), 300);
  }
  if (aiOpen) setTimeout(() => document.getElementById('aiInput').focus(), 350);
}

function showGreeting() {
  addMessage('ai', "Hello! I'm the EST-iMs Assistant. I can help you understand the inventory system, navigate zones, or answer any questions about features. How can I help you today?");
}

function getTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function addMessage(role, text) {
  const wrap = document.getElementById('aiMessages');
  const div = document.createElement('div');
  div.className = `ai-msg ${role === 'ai' ? 'ai' : 'usr'}`;
  div.innerHTML = `
    <div class="ai-bubble">${escapeHtml(text)}</div>
    <div class="ai-msg-time">${getTime()}</div>
  `;
  wrap.appendChild(div);
  wrap.scrollTop = wrap.scrollHeight;
}

function addTyping() {
  const wrap = document.getElementById('aiMessages');
  const div = document.createElement('div');
  div.className = 'ai-msg ai'; div.id = 'aiTyping';
  div.innerHTML = `<div class="ai-typing"><span></span><span></span><span></span></div>`;
  wrap.appendChild(div);
  wrap.scrollTop = wrap.scrollHeight;
}

function removeTyping() {
  const t = document.getElementById('aiTyping');
  if (t) t.remove();
}

function escapeHtml(t) {
  return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
}

function hideChips() {
  const chips = document.getElementById('aiChips');
  if (chips) chips.style.display = 'none';
}

async function sendMessage() {
  const input = document.getElementById('aiInput');
  const text = input.value.trim();
  if (!text || aiLoading) return;

  hideChips();
  addMessage('usr', text);
  conversationHistory.push({ role: 'user', content: text });
  input.value = ''; autoResize(input);

  document.getElementById('aiSendBtn').disabled = true;
  aiLoading = true;
  addTyping();

  try {
    const response = await fetch('/api/ai-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        messages: conversationHistory
      })
    });
    const data = await response.json();
    const reply = data.content?.map(b => b.text || '').join('') || 'Sorry, I could not process that.';
    removeTyping();
    addMessage('ai', reply);
    conversationHistory.push({ role: 'assistant', content: reply });
  } catch (err) {
    removeTyping();
    addMessage('ai', 'Connection error. Please try again.');
  }

  aiLoading = false;
  document.getElementById('aiSendBtn').disabled = false;
}

function sendChip(el) {
  document.getElementById('aiInput').value = el.textContent;
  sendMessage();
}

function handleKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
}

function autoResize(el) {
  el.style.height = '40px';
  el.style.height = Math.min(el.scrollHeight, 100) + 'px';
}

// ── DEVELOPER MODAL ──
function openDevModal() {
  document.getElementById('devOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeDevModal() {
  document.getElementById('devOverlay').classList.remove('open');
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

// ── LANGUAGE TOGGLE (Welcome) ──
const WELCOME_LANG = {
  en: {
    chip: 'Welcome', subHeading: 'Inventory Management System',
    suffix: 'Animal Nutrition',
    tagline: 'Streamlined inventory tracking, real‑time stock management,<br>and precise reporting — all in one place.',
    loginBtn: 'Log In', moreBtn: 'For More', privacy: 'Privacy Policy', terms: 'Terms of Use', langLabel: 'عربي',
    dockLogin: 'Log In', dockContact: 'Contact Us', dockHelp: 'Help', dockScan: 'QR Scan', dockAbout: 'About Us',
  },
  ar: {
    chip: 'أهلاً', subHeading: 'نظام إدارة المخزون',
    suffix: 'التغذية الحيوانية',
    tagline: 'تتبع المخزون بشكل مبسط، وإدارة المخزون الفوري،<br>وتقارير دقيقة — كل ذلك في مكان واحد.',
    loginBtn: 'تسجيل الدخول', moreBtn: 'للمزيد', privacy: 'سياسة الخصوصية', terms: 'شروط الاستخدام', langLabel: 'English',
    dockLogin: 'دخول', dockContact: 'تواصل معنا', dockHelp: 'مساعدة', dockScan: 'مسح QR', dockAbout: 'من نحن',
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
  const tag = document.querySelector('.tagline');
  if (tag) tag.innerHTML = t.tagline;
  const loginText = document.getElementById('welcomeLoginText');
  if (loginText) loginText.textContent = t.loginBtn;
  const moreText = document.getElementById('welcomeMoreText');
  if (moreText) moreText.textContent = t.moreBtn;
  const privacyLink = document.getElementById('welcomePrivacyLink');
  if (privacyLink) privacyLink.textContent = t.privacy;
  const termsLink = document.getElementById('welcomeTermsLink');
  if (termsLink) termsLink.textContent = t.terms;
  const langLbl = document.getElementById('welcomeLangLabel');
  if (langLbl) langLbl.textContent = t.langLabel;
  document.querySelectorAll('.dock-label').forEach(el => {
    const en = el.getAttribute('data-en');
    const ar = el.getAttribute('data-ar');
    if (en && ar) el.textContent = isAr ? ar : en;
  });
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
