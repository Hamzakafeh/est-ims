// THEME
(function() {
  if (localStorage.getItem('est-theme') === 'light') document.documentElement.classList.add('light');
})();
function toggleTheme() {
  const isLight = document.documentElement.classList.toggle('light');
  localStorage.setItem('est-theme', isLight ? 'light' : 'dark');
}

// LANGUAGE
const ABOUT_LANG = {
  en: {
    back:'Back', topbar:'About Us', badge:'EST-iMs System', lang:'عربي',
    heroTitle:'ABOUT US',
    heroSub:'EST-iMs is a professional inventory management system built specifically for Alestesharia Animal Nutrition — delivering real-time stock control across all warehouse zones.',
    c1t:'🏢 The Company', c1:'Alestesharia Animal Nutrition is a leading company in the animal feed sector, managing multiple warehouse zones with diverse inventory categories.',
    c2t:'📦 The System', c2:'EST-iMs (Inventory Management System) is a web-based platform built on Flask & Python, using Excel files as structured data storage with real-time read/write capabilities.',
    c3t:'🏭 Warehouse Zones', c3:'The system manages multiple zones: Zone 1–5 for warehouse operations, QC for quality control, and Admin/Dev for management and development access.',
    c4t:'🔒 Access Control', c4:'Role-based access control ensures each employee only accesses their assigned zone. Super-zones (Admin, Dev) have full visibility across all warehouse zones.',
    featTitle:'Key Features',
    f1:'Real-time stock tracking with IN/OUT transaction logging',
    f2:'QR Code scanning for quick inventory lookups from any mobile device',
    f3:'Excel-based data storage with automated balance recalculation',
    f4:'Dark / Light mode with full Arabic & English language support',
    f5:'CSV export, print reports, and an AI assistant for system guidance',
    f6:'Brute-force protection, session management, and secure authentication',
    devRole:'Warehouse Keeper — IT | MBA',
    devDesc:'Designed, developed, and maintains the EST-iMs system — combining warehouse operations expertise with software development to deliver a practical, efficient inventory solution.',
  },
  ar: {
    back:'رجوع', topbar:'من نحن', badge:'نظام EST-iMs', lang:'English',
    heroTitle:'من نحن',
    heroSub:'EST-iMs هو نظام إدارة مخزون احترافي مبني خصيصاً لشركة الاستشارية للتغذية الحيوانية — يوفر تحكماً فورياً في المخزون عبر جميع مناطق المستودع.',
    c1t:'🏢 الشركة', c1:'الاستشارية للتغذية الحيوانية شركة رائدة في قطاع أعلاف الحيوانات، تدير مناطق مستودع متعددة بفئات مخزون متنوعة.',
    c2t:'📦 النظام', c2:'EST-iMs نظام ويب متكامل مبني على Flask وPython، يستخدم ملفات Excel كمخزن بيانات منظم مع قدرات قراءة/كتابة فورية.',
    c3t:'🏭 مناطق المستودع', c3:'يدير النظام عدة مناطق: زون 1-5 للعمليات، QC لمراقبة الجودة، والإدارة/التطوير للوصول الإداري.',
    c4t:'🔒 التحكم في الوصول', c4:'يضمن التحكم في الوصول المستند إلى الأدوار أن كل موظف يصل فقط إلى زونه المخصص. الزونات الإدارية (Admin, Dev) لها رؤية كاملة.',
    featTitle:'المميزات الرئيسية',
    f1:'تتبع المخزون الفوري مع سجل معاملات الإدخال والإخراج',
    f2:'مسح QR Code للبحث السريع في المخزون من أي جهاز محمول',
    f3:'تخزين البيانات على Excel مع إعادة حساب الأرصدة تلقائياً',
    f4:'وضع ليلي/نهاري مع دعم كامل للغتين العربية والإنجليزية',
    f5:'تصدير CSV، تقارير الطباعة، ومساعد AI لإرشاد المستخدمين',
    f6:'حماية من القوة الغاشمة، إدارة الجلسات، ومصادقة آمنة',
    devRole:'أمين مستودع — تقنية المعلومات | ماجستير إدارة الأعمال',
    devDesc:'صمّم وطوّر ويُدير نظام EST-iMs — جامعاً بين خبرة العمليات اللوجستية وتطوير البرمجيات لتقديم حل مخزون عملي وفعال.',
  }
};
let aboutLang = localStorage.getItem('est-lang') || 'en';
function applyAboutLang(lang) {
  aboutLang = lang;
  localStorage.setItem('est-lang', lang);
  const t = ABOUT_LANG[lang];
  const isAr = lang === 'ar';
  document.documentElement.lang = lang;
  document.documentElement.dir  = isAr ? 'rtl' : 'ltr';
  document.getElementById('backText').textContent   = t.back;
  document.getElementById('topbarTitle').textContent= t.topbar;
  document.getElementById('badgeText').textContent  = t.badge;
  document.getElementById('langBtn').textContent    = t.lang;
  document.getElementById('heroTitle').textContent  = t.heroTitle;
  document.getElementById('heroSub').textContent    = t.heroSub;
  document.getElementById('card1Title').textContent = t.c1t;
  document.getElementById('card1Text').textContent  = t.c1;
  document.getElementById('card2Title').textContent = t.c2t;
  document.getElementById('card2Text').textContent  = t.c2;
  document.getElementById('card3Title').textContent = t.c3t;
  document.getElementById('card3Text').textContent  = t.c3;
  document.getElementById('card4Title').textContent = t.c4t;
  document.getElementById('card4Text').textContent  = t.c4;
  document.getElementById('featTitle').textContent  = t.featTitle;
  document.getElementById('feat1').textContent = t.f1;
  document.getElementById('feat2').textContent = t.f2;
  document.getElementById('feat3').textContent = t.f3;
  document.getElementById('feat4').textContent = t.f4;
  document.getElementById('feat5').textContent = t.f5;
  document.getElementById('feat6').textContent = t.f6;
  document.getElementById('devRole').textContent = t.devRole;
  document.getElementById('devDesc').textContent = t.devDesc;
}
function toggleAboutLang() {
  applyAboutLang(aboutLang === 'en' ? 'ar' : 'en');
}
applyAboutLang(aboutLang);
