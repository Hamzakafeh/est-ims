(function() {
  if (localStorage.getItem('est-theme') === 'light') document.documentElement.classList.add('light');
})();
function toggleTheme() {
  const isLight = document.documentElement.classList.toggle('light');
  localStorage.setItem('est-theme', isLight ? 'light' : 'dark');
}

const MORE_LANG = {
  en: {
    lang: 'AR', badge: 'Contact & Support',
    heroTitle: 'FOR MORE',
    heroSub: 'Have a question, request, or support need? Send us the details and the EST-iMs team will follow up with you.',
    formTitle: 'Send a Message',
    name: 'Full Name', phone: 'Phone', email: 'Email', dept: 'Department', message: 'Message',
    namePh: 'Your name', phonePh: '+962 ...', emailPh: 'you@example.com', msgPh: 'Describe your question or request...',
    deptPh: '— Select department —', submit: 'Send Message', sending: 'Sending...',
    successTitle: 'Message Sent!', successSub: "Thank you. We'll get back to you as soon as possible.", again: 'Send Another',
    c1t: 'Fast Support', c1: 'Share the issue clearly and include your department so the right person can respond.',
    c2t: 'System Requests', c2: 'Use this form for access, QR scan, reports, inventory, or technical questions.',
    c3t: 'EST-iMs', c3: 'Built for Alestesharia Animal Nutrition to keep warehouse operations clear, fast, and organized.'
  },
  ar: {
    lang: 'EN', badge: 'تواصل ودعم',
    heroTitle: 'للمزيد',
    heroSub: 'عندك سؤال أو طلب أو تحتاج دعم؟ ارسل التفاصيل وفريق EST-iMs بتابع معك.',
    formTitle: 'إرسال رسالة',
    name: 'الاسم الكامل', phone: 'رقم الهاتف', email: 'البريد الإلكتروني', dept: 'القسم', message: 'الرسالة',
    namePh: 'اسمك', phonePh: '+962 ...', emailPh: 'you@example.com', msgPh: 'اكتب سؤالك أو طلبك...',
    deptPh: '— اختر القسم —', submit: 'إرسال الرسالة', sending: 'جاري الإرسال...',
    successTitle: 'تم إرسال الرسالة!', successSub: 'شكراً لك. سيتم التواصل معك بأقرب وقت ممكن.', again: 'إرسال رسالة أخرى',
    c1t: 'دعم سريع', c1: 'اكتب المشكلة بوضوح وحدد القسم حتى يتم توجيه الطلب للشخص المناسب.',
    c2t: 'طلبات النظام', c2: 'استخدم النموذج لطلبات الدخول، فحص QR، التقارير، المخزون، أو الأسئلة التقنية.',
    c3t: 'EST-iMs', c3: 'نظام مبني لشركة الاستشارية للتغذية الحيوانية لتنظيم وتسريع عمليات المستودعات.'
  }
};
let moreLang = localStorage.getItem('est-lang') || 'en';
function t(key) { return MORE_LANG[moreLang][key]; }
function applyForMoreLang(lang) {
  moreLang = lang;
  localStorage.setItem('est-lang', lang);
  const isAr = lang === 'ar';
  const text = MORE_LANG[lang];
  document.documentElement.lang = lang;
  document.documentElement.dir = isAr ? 'rtl' : 'ltr';

  document.getElementById('langDockText').textContent = text.lang;
  document.getElementById('badgeText').textContent = text.badge;
  document.getElementById('heroTitle').textContent = text.heroTitle;
  document.getElementById('heroSub').textContent = text.heroSub;
  document.getElementById('formTitle').textContent = text.formTitle;
  document.getElementById('nameLabel').textContent = text.name;
  document.getElementById('phoneLabel').textContent = text.phone;
  document.getElementById('emailLabel').textContent = text.email;
  document.getElementById('deptLabel').textContent = text.dept;
  document.getElementById('messageLabel').textContent = text.message;
  document.getElementById('fname').placeholder = text.namePh;
  document.getElementById('fphone').placeholder = text.phonePh;
  document.getElementById('femail').placeholder = text.emailPh;
  document.getElementById('fmsg').placeholder = text.msgPh;
  document.getElementById('deptPlaceholder').textContent = text.deptPh;
  document.getElementById('submitText').textContent = text.submit;
  document.getElementById('successTitle').textContent = text.successTitle;
  document.getElementById('successSub').textContent = text.successSub;
  document.getElementById('againBtn').textContent = text.again;
  document.getElementById('card1Title').textContent = text.c1t;
  document.getElementById('card1Text').textContent = text.c1;
  document.getElementById('card2Title').textContent = text.c2t;
  document.getElementById('card2Text').textContent = text.c2;
  document.getElementById('card3Title').textContent = text.c3t;
  document.getElementById('card3Text').textContent = text.c3;

  document.querySelectorAll('#fdept option[data-en]').forEach(option => {
    option.textContent = isAr ? option.dataset.ar : option.dataset.en;
  });
}
function toggleForMoreLang() {
  applyForMoreLang(moreLang === 'en' ? 'ar' : 'en');
}

function renderSubmitButton() {
  document.getElementById('submitBtn').innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <line x1="22" y1="2" x2="11" y2="13"/>
      <polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
    <span id="submitText">${t('submit')}</span>
    <svg class="btn-arrow" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>`;
}

const _KNOWN_EMAIL_DOMAINS = new Set([
  'gmail.com','yahoo.com','hotmail.com','outlook.com','live.com','live.co.uk',
  'icloud.com','me.com','mac.com','proton.me','protonmail.com','msn.com',
  'aol.com','mail.com','yandex.com','yandex.ru','ymail.com','zoho.com',
  'alestesharia.com.jo','alestesharia.com',
]);
function _emailDomainOk(email) {
  const d = (email.split('@')[1] || '').toLowerCase();
  if (_KNOWN_EMAIL_DOMAINS.has(d)) return true;
  if (/\.(jo|edu|gov|org|net)$/.test(d)) return true;
  return false;
}

const FORM_HINTS = {
  en: {
    fname:  'Full name is required',
    fphone: 'Phone number is required',
    femail_empty:  'Email address is required',
    femail_format: 'Enter a valid email address',
    femail_domain: 'Enter a valid email address (e.g. name@gmail.com)',
    fdept:  'Please select a department',
    fmsg:   'Message is required',
  },
  ar: {
    fname:  'الاسم الكامل مطلوب',
    fphone: 'رقم الهاتف مطلوب',
    femail_empty:  'البريد الإلكتروني مطلوب',
    femail_format: 'أدخل بريدًا إلكترونيًا صحيحًا',
    femail_domain: 'أدخل بريدًا إلكترونيًا صحيحًا (مثال: name@gmail.com)',
    fdept:  'يرجى اختيار القسم',
    fmsg:   'الرسالة مطلوبة',
  }
};

function _clearHints() {
  ['hintFname','hintFphone','hintFemail','hintFdept','hintFmsg'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.textContent = ''; el.classList.remove('show'); }
  });
  ['fname','fphone','femail','fdept','fmsg'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('error');
  });
}

function _showHint(fieldId, hintId, msg) {
  const field = document.getElementById(fieldId);
  const hint  = document.getElementById(hintId);
  if (field) field.classList.add('error');
  if (hint)  { hint.textContent = msg; hint.classList.add('show'); }
}

function submitForm() {
  _clearHints();
  const lang = moreLang || 'en';
  const H = FORM_HINTS[lang] || FORM_HINTS.en;

  const name  = document.getElementById('fname').value.trim();
  const phone = document.getElementById('fphone').value.trim();
  const email = document.getElementById('femail').value.trim();
  const dept  = document.getElementById('fdept').value;
  const msg   = document.getElementById('fmsg').value.trim();

  const emailFormatOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const emailDomainOk = emailFormatOk && _emailDomainOk(email);

  let hasError = false;
  if (!name)            { _showHint('fname',  'hintFname',  H.fname);           hasError = true; }
  if (!phone)           { _showHint('fphone', 'hintFphone', H.fphone);          hasError = true; }
  if (!email)           { _showHint('femail', 'hintFemail', H.femail_empty);    hasError = true; }
  else if (!emailFormatOk) { _showHint('femail', 'hintFemail', H.femail_format); hasError = true; }
  else if (!emailDomainOk) { _showHint('femail', 'hintFemail', H.femail_domain); hasError = true; }
  if (!dept)            { _showHint('fdept',  'hintFdept',  H.fdept);           hasError = true; }
  if (!msg)             { _showHint('fmsg',   'hintFmsg',   H.fmsg);            hasError = true; }

  if (hasError) return;

  const btn = document.getElementById('submitBtn');
  btn.disabled = true;
  btn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="animation:spin 0.8s linear infinite">
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
    ${t('sending')}`;

  fetch('/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, phone, email, department: dept, message: msg })
  })
  .then(response => response.ok ? response.json() : Promise.reject())
  .catch(() => ({ ok: true }))
  .finally(() => {
    document.getElementById('contactForm').style.display = 'none';
    document.getElementById('successState').classList.add('show');
  });
}

// Clear field hint + error border on input
['fname','fphone','femail','fdept','fmsg'].forEach(fieldId => {
  const el = document.getElementById(fieldId);
  const hintId = 'hint' + fieldId.charAt(0).toUpperCase() + fieldId.slice(1);
  if (el) {
    el.addEventListener('input', () => {
      el.classList.remove('error');
      const hint = document.getElementById(hintId);
      if (hint) { hint.textContent = ''; hint.classList.remove('show'); }
    });
    el.addEventListener('change', () => {
      el.classList.remove('error');
      const hint = document.getElementById(hintId);
      if (hint) { hint.textContent = ''; hint.classList.remove('show'); }
    });
  }
});

function resetForm() {
  ['fname','fphone','femail','fmsg'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('fdept').value = '';
  _clearHints();
  document.getElementById('contactForm').style.display = '';
  document.getElementById('successState').classList.remove('show');
  const btn = document.getElementById('submitBtn');
  btn.disabled = false;
  renderSubmitButton();
}

applyForMoreLang(moreLang);
