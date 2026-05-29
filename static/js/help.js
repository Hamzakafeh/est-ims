(function() {
  if (localStorage.getItem('est-theme') === 'light') document.documentElement.classList.add('light');
})();
function toggleTheme() {
  const isLight = document.documentElement.classList.toggle('light');
  localStorage.setItem('est-theme', isLight ? 'light' : 'dark');
}

const HELP_LANG = {
  en: {
    lang: 'AR', badge: 'EST-iMs Support Center',
    heroTitle: 'HELP & FAQ', heroSub: 'Find quick answers for accounts, inventory, reports, and supported devices.',
    search: 'Search for help topics...', tabAll: 'All Topics', tabAccount: 'Account', tabInventory: 'Inventory', tabReports: 'Reports', tabSystem: 'System',
    emailSupport: 'Email Support', phoneSupport: 'Phone Support',
    tip: '<strong>Pro Tip:</strong> Use the search bar above to quickly find answers. Support is available on weekdays from 9AM to 7PM.',
    copy: 'Copyright 2026 | All Rights Reserved',
    faqs: [
      { q: 'How do I change or reset my password?', a: 'Go to your profile settings and click <strong>Change Password</strong>. Enter your current password followed by your new password, then confirm. If you\'ve forgotten your password, use the <strong>Forgot Password</strong> link on the login page.' },
      { q: 'Why can\'t I log in to my account?', a: 'Ensure your credentials are correct and that Caps Lock is off. Your account may be temporarily locked after multiple failed attempts. If the issue persists, contact your system administrator.' },
      { q: 'How do I add a new product to inventory?', a: 'Navigate to the relevant inventory sheet and add the required item details. Once saved, the item will appear in the related views, reports, and stocktaking calculations.' },
      { q: 'How do stock alerts and low-quantity thresholds work?', a: 'When current quantity drops at or below the configured threshold, the system flags the item and includes it in dashboard warnings or low-stock reports.' },
      { q: 'How do I export a report to PDF or Excel?', a: 'Open the report you need, apply the required filters, then use the available export or print option. Date and zone filters apply to the exported data.' },
      { q: 'What browsers and devices are supported?', a: 'EST-iMs is optimized for modern browsers including Chrome, Edge, Firefox, and Safari. It works on desktop, tablet, and mobile screens.' },
    ]
  },
  ar: {
    lang: 'EN', badge: 'مركز دعم EST-iMs',
    heroTitle: 'المساعدة والأسئلة الشائعة', heroSub: 'اعثر بسرعة على إجابات تخص الحسابات والمخزون والتقارير والأجهزة المدعومة.',
    search: 'ابحث في مواضيع المساعدة...', tabAll: 'الكل', tabAccount: 'الحساب', tabInventory: 'المخزون', tabReports: 'التقارير', tabSystem: 'النظام',
    emailSupport: 'الدعم عبر البريد', phoneSupport: 'الدعم عبر الهاتف',
    tip: '<strong>نصيحة:</strong> استخدم شريط البحث للوصول السريع للإجابات. الدعم متاح أيام الأسبوع من 9 صباحاً إلى 7 مساءً.',
    copy: 'حقوق النشر 2026 | جميع الحقوق محفوظة',
    faqs: [
      { q: 'كيف أغير كلمة المرور أو أعيد تعيينها؟', a: 'اذهب إلى إعدادات ملفك الشخصي وانقر على <strong>تغيير كلمة المرور</strong>. أدخل كلمة المرور الحالية ثم الجديدة وأكدها. إذا نسيت كلمة المرور، استخدم رابط <strong>نسيت كلمة المرور</strong> في صفحة تسجيل الدخول.' },
      { q: 'لماذا لا أستطيع تسجيل الدخول إلى حسابي؟', a: 'تأكد من صحة بيانات الدخول وأن زر Caps Lock مطفأ. قد يُقفل حسابك مؤقتاً بعد محاولات فاشلة متعددة. إذا استمرت المشكلة، تواصل مع مسؤول النظام.' },
      { q: 'كيف أضيف منتجاً جديداً إلى المخزون؟', a: 'انتقل إلى ورقة المخزون المناسبة وأضف تفاصيل الصنف المطلوبة. بعد الحفظ، سيظهر الصنف في العروض والتقارير وحسابات الجرد.' },
      { q: 'كيف تعمل تنبيهات المخزون وحدود الكميات المنخفضة؟', a: 'عندما تنخفض الكمية الحالية إلى مستوى الحد المحدد أو دونه، يُميز النظام الصنف ويدرجه في تحذيرات لوحة التحكم أو تقارير المخزون المنخفض.' },
      { q: 'كيف أصدّر تقريراً إلى PDF أو Excel؟', a: 'افتح التقرير المطلوب، وطبّق الفلاتر اللازمة، ثم استخدم خيار التصدير أو الطباعة المتاح. تُطبَّق فلاتر التاريخ والمنطقة على البيانات المُصدَّرة.' },
      { q: 'ما المتصفحات والأجهزة المدعومة؟', a: 'يعمل EST-iMs بشكل مثالي على المتصفحات الحديثة كـ Chrome وEdge وFirefox وSafari. كما يدعم أجهزة سطح المكتب والأجهزة اللوحية والهواتف.' },
    ]
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
  const _dl = document.getElementById('langDockLabel'); if(_dl) _dl.textContent = lang === 'en' ? 'عربي' : 'English';
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
  // Translate FAQ questions and answers
  const faqs = ht('faqs');
  document.querySelectorAll('.faq-item').forEach((item, i) => {
    if (!faqs[i]) return;
    const qEl = item.querySelector('.faq-q-text');
    const aEl = item.querySelector('.faq-answer');
    if (qEl) qEl.textContent = faqs[i].q;
    if (aEl) aEl.innerHTML = faqs[i].a;
  });
  // Also update search keywords for the current language
  document.getElementById('searchInput').value = '';
  filterFAQ('');
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
