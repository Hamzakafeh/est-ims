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

const CONTACT_LANG = {
  en: {
    lang: 'AR', badge: 'Alestesharia Animal Nutrition',
    heroTitle: 'CONTACT US',
    heroSub: 'Reach the Alestesharia Animal Nutrition team through our official contact channels.',
    address: 'Address', addressValue: 'Box 244, Amman<br>19378, Jordan',
    hours: 'Working Hours', hoursValue: 'Weekdays · 9AM to 7PM<br>Weekends · Off',
    phone: 'Phone', email: 'Email', follow: 'Follow Us', copy: 'Copyright 2026 | All Rights Reserved'
  },
  ar: {
    lang: 'EN', badge: 'الاستشارية للتغذية الحيوانية',
    heroTitle: 'تواصل معنا',
    heroSub: 'تواصل مع فريق الاستشارية للتغذية الحيوانية عبر قنوات الاتصال الرسمية.',
    address: 'العنوان', addressValue: 'صندوق بريد 244، عمّان<br>19378، الأردن',
    hours: 'ساعات العمل', hoursValue: 'أيام الأسبوع · 9 صباحاً إلى 7 مساءً<br>نهاية الأسبوع · مغلق',
    phone: 'الهاتف', email: 'البريد الإلكتروني', follow: 'تابعنا', copy: 'حقوق النشر 2026 | جميع الحقوق محفوظة'
  }
};
let contactLang = localStorage.getItem('est-lang') || 'en';
function ct(key) { return CONTACT_LANG[contactLang][key]; }
function applyContactLang(lang) {
  contactLang = lang;
  localStorage.setItem('est-lang', lang);
  const isAr = lang === 'ar';
  document.documentElement.lang = lang;
  document.documentElement.dir = isAr ? 'rtl' : 'ltr';
  document.getElementById('langDockText').textContent = ct('lang');
  document.getElementById('badgeText').textContent = ct('badge');
  document.getElementById('heroTitle').textContent = ct('heroTitle');
  document.getElementById('heroSub').textContent = ct('heroSub');
  document.getElementById('addressLabel').textContent = ct('address');
  document.getElementById('addressValue').innerHTML = ct('addressValue');
  document.getElementById('hoursLabel').textContent = ct('hours');
  document.getElementById('hoursValue').innerHTML = ct('hoursValue');
  document.getElementById('phoneLabel').textContent = ct('phone');
  document.getElementById('emailLabel').textContent = ct('email');
  document.getElementById('followLabel').textContent = ct('follow');
  document.getElementById('copyText').textContent = ct('copy');
}
function toggleContactLang() { applyContactLang(contactLang === 'en' ? 'ar' : 'en'); }
applyContactLang(contactLang);
