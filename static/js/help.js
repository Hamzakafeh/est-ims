(function() {
  const _t = localStorage.getItem('est-theme');
  if (_t === 'light') document.documentElement.classList.add('light');
  else if (_t === 'classic') document.documentElement.classList.add('classic');
})();
function toggleTheme() {
  const h = document.documentElement;
  const cur = h.classList.contains('classic') ? 'classic' : h.classList.contains('light') ? 'light' : 'dark';
  const next = cur === 'dark' ? 'classic' : cur === 'classic' ? 'light' : 'dark';
  h.classList.remove('light', 'classic');
  if (next !== 'dark') h.classList.add(next);
  localStorage.setItem('est-theme', next);
}

const HELP_LANG = {
  en: {
    lang: 'AR', badge: 'EST-iMs Support Center',
    heroTitle: 'HELP & FAQ', heroSub: 'Find quick answers for accounts, inventory, reports, and supported devices.',
    search: 'Search for help topics...', tabAll: 'All Topics', tabAccount: 'Account', tabInventory: 'Inventory', tabReports: 'Reports', tabSystem: 'System',
    emailSupport: 'Email Support', phoneSupport: 'Phone Support',
    tip: '<strong>Pro Tip:</strong> Use the search bar above to quickly find answers. Support is available on weekdays from 9AM to 7PM.',
    copy: 'Copyright 2026 | All Rights Reserved'
  },
  ar: {
    lang: 'EN', badge: 'مركز دعم EST-iMs',
    heroTitle: 'المساعدة', heroSub: 'اعثر بسرعة على إجابات تخص الحسابات والمخزون والتقارير والأجهزة المدعومة.',
    search: 'ابحث في مواضيع المساعدة...', tabAll: 'الكل', tabAccount: 'الحساب', tabInventory: 'المخزون', tabReports: 'التقارير', tabSystem: 'النظام',
    emailSupport: 'الدعم عبر البريد', phoneSupport: 'الدعم عبر الهاتف',
    tip: '<strong>نصيحة:</strong> استخدم شريط البحث للوصول السريع للإجابات. الدعم متاح أيام الأسبوع من 9 صباحاً إلى 7 مساءً.',
    copy: 'حقوق النشر 2026 | جميع الحقوق محفوظة'
  }
};
let helpLang = localStorage.getItem('est-lang') || 'en';
function ht(key) { return HELP_LANG[helpLang][key]; }
function applyHelpLang(lang) {
  helpLang = lang;
  localStorage.setItem('est-lang', lang);
  const isAr = lang === 'ar';
  document.documentElement.lang = lang;
  document.documentElement.dir = isAr ? 'rtl' : 'ltr';
  document.getElementById('langDockText').textContent = ht('lang');
  document.getElementById('badgeText').textContent = ht('badge');
  document.getElementById('heroTitle').textContent = ht('heroTitle');
  document.getElementById('heroSub').textContent = ht('heroSub');
  document.getElementById('searchInput').placeholder = ht('search');
  document.querySelector('[data-i18n="tabAll"]').textContent = ht('tabAll');
  document.querySelector('[data-i18n="tabAccount"]').textContent = ht('tabAccount');
  document.querySelector('[data-i18n="tabInventory"]').textContent = ht('tabInventory');
  document.querySelector('[data-i18n="tabReports"]').textContent = ht('tabReports');
  document.querySelector('[data-i18n="tabSystem"]').textContent = ht('tabSystem');
  document.getElementById('emailSupportLabel').textContent = ht('emailSupport');
  document.getElementById('phoneSupportLabel').textContent = ht('phoneSupport');
  document.getElementById('tipText').innerHTML = ht('tip');
}
function toggleHelpLang() { applyHelpLang(helpLang === 'en' ? 'ar' : 'en'); }

function toggleFAQ(el) {
  const item = el.closest('.faq-item');
  const wasOpen = item.classList.contains('open');
  document.querySelectorAll('.faq-item.open').forEach(i => i.classList.remove('open'));
  if (!wasOpen) item.classList.add('open');
}
function filterFAQ(val) {
  const q = val.toLowerCase();
  document.querySelectorAll('.faq-item').forEach(item => {
    const text = item.dataset.q + ' ' + item.querySelector('.faq-q-text').textContent.toLowerCase();
    item.style.display = text.includes(q) ? '' : 'none';
  });
}
function filterTab(cat, btn) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('searchInput').value = '';
  document.querySelectorAll('.faq-item').forEach(item => {
    item.style.display = (cat === 'all' || item.dataset.cat === cat) ? '' : 'none';
  });
}
applyHelpLang(helpLang);
