const ITEMS = [
  { sku:'CHKN-BLU-001', nameAr:'أزرق',         hex:'#3b82f6', balance:1564,  date:'2026-05-12' },
  { sku:'CHKN-BRN-001', nameAr:'بني',           hex:'#92400e', balance:30,    date:'2026-05-07' },
  { sku:'CHKN-DBL-001', nameAr:'أزرق غامق',     hex:'#1e3a8a', balance:62412, date:'2026-05-13' },
  { sku:'CHKN-DGR-001', nameAr:'أخضر غامق',     hex:'#14532d', balance:6061,  date:'2026-05-13' },
  { sku:'CHKN-GRY-001', nameAr:'رمادي',         hex:'#6b7280', balance:7723,  date:'2026-05-07' },
  { sku:'CHKN-GRN-001', nameAr:'أخضر',          hex:'#16a34a', balance:57016, date:'2026-05-14' },
  { sku:'CHKN-LBL-001', nameAr:'أزرق فاتح',     hex:'#7dd3fc', balance:339,   date:'2026-05-12' },
  { sku:'CHKN-ORG-001', nameAr:'برتقالي',       hex:'#f97316', balance:59,    date:'2026-05-01' },
  { sku:'CHKN-ORG-002', nameAr:'برتقالي 70×45', hex:'#fb923c', balance:210,   date:'2026-05-01' },
  { sku:'CHKN-PRP-001', nameAr:'بنفسجي',        hex:'#7c3aed', balance:42457, date:'2026-05-14' },
  { sku:'CHKN-RED-001', nameAr:'أحمر',          hex:'#dc2626', balance:7485,  date:'2026-05-13' },
  { sku:'CHKN-YLW-001', nameAr:'أصفر',          hex:'#eab308', balance:7812,  date:'2026-05-13' },
];

// List
const cardsEl = document.getElementById('cards-container');
ITEMS.forEach(item => {
  const d = document.createElement('div');
  d.className = 'bc-card';
  d.innerHTML = `
    <div class="color-dot" style="background:${item.hex}"></div>
    <div class="bc-info">
      <div class="bc-name">صفن الجاج — ${item.nameAr}</div>
      <div class="bc-sku">${item.sku}</div>
    </div>
    <div class="bc-balance">
      <div class="bc-num">${item.balance.toLocaleString()}</div>
      <div class="bc-unit">شوال</div>
    </div>`;
  d.onclick = () => showModal(item);
  cardsEl.appendChild(d);
});

// QR Print
const printEl = document.getElementById('print-container');
ITEMS.forEach(item => {
  const wrap = document.createElement('div');
  wrap.className = 'qr-card';
  wrap.innerHTML = `
    <div class="pname">صفن الجاج — ${item.nameAr}</div>
    <div class="qr-wrap" id="qr-${item.sku}"></div>
    <div class="qr-sku">${item.sku}</div>
    <button class="print-btn" onclick="printQR('${item.sku}','${item.nameAr}')">طباعة</button>`;
  printEl.appendChild(wrap);
  setTimeout(() => {
    const qrUrl = window.location.origin + '/scan?sku=' + item.sku;
    new QRCode(document.getElementById('qr-' + item.sku), {
      text: qrUrl, width: 160, height: 160,
      colorDark: '#1a3a5c', colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M
    });
  }, 150);
});

function showModal(item) {
  const icon = document.getElementById('modalIcon');
  icon.className = 'modal-icon ok';
  icon.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
  document.getElementById('modalCat').textContent = 'شوالات الجاج';
  document.getElementById('modalName').textContent = 'صفن الجاج — ' + item.nameAr;
  document.getElementById('modalStrip').style.background = item.hex;
  document.getElementById('modalNum').textContent = item.balance.toLocaleString();
  document.getElementById('modalDate').textContent = 'آخر تحديث: ' + item.date;
  document.getElementById('modalErr').style.display = 'none';
  document.getElementById('overlay').classList.add('show');
}

function lookupAndShow(raw) {
  const sku = raw.trim().toUpperCase();
  const item = ITEMS.find(i => i.sku === sku);
  if (item) { showModal(item); return; }
  const icon = document.getElementById('modalIcon');
  icon.className = 'modal-icon err';
  icon.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  document.getElementById('modalCat').textContent = '';
  document.getElementById('modalName').textContent = 'كود غير موجود';
  document.getElementById('modalStrip').style.background = '#fee2e2';
  document.getElementById('modalNum').textContent = '—';
  document.getElementById('modalDate').textContent = '';
  const e = document.getElementById('modalErr');
  e.textContent = '"' + sku + '" غير مسجل في النظام';
  e.style.display = 'block';
  document.getElementById('overlay').classList.add('show');
}

function closeModal() { document.getElementById('overlay').classList.remove('show'); }

let scanner = null;
function startScanner() {
  if (scanner) return;
  scanner = new Html5Qrcode("reader");
  scanner.start(
    { facingMode: "environment" },
    { fps: 12, qrbox: { width: 230, height: 230 } },
    (decoded) => lookupAndShow(decoded),
    () => {}
  ).catch(() => {});
}

function switchTab(name) {
  document.querySelectorAll('.tab').forEach((t, i) => {
    t.classList.toggle('active', ['list','scan','print'][i] === name);
  });
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  if (name === 'scan') startScanner();
  else if (scanner) { scanner.stop().then(() => { scanner = null; }).catch(() => {}); }
}

function printQR(sku, nameAr) {
  const el = document.getElementById('qr-' + sku);
  const img = el.querySelector('img') || el.querySelector('canvas');
  const src = img.tagName === 'CANVAS' ? img.toDataURL() : img.src;
  const win = window.open('', '_blank', 'width=300,height=380');
  win.document.write('<html><head><title>QR ' + nameAr + '</title><style>body{font-family:Arial;text-align:center;padding:24px;}.n{font-size:14px;font-weight:bold;color:#1a3a5c;margin-bottom:12px;}.s{font-size:11px;font-family:monospace;color:#64748b;margin-top:8px;letter-spacing:1px;}img{width:200px;height:200px;}
  /* ── MOBILE ENHANCEMENTS ── */
  @media (max-width: 480px) {
    .content { padding: 12px; }
    .bc-num { font-size: 15px; }
    .bc-name { font-size: 12px; }
    .modal { padding: 20px 16px; }
    .modal-num { font-size: 36px; }
    .tab { font-size: 11px; padding: 10px 2px; }
  }
</style></head><body><div class="n">صفن الجاج — ' + nameAr + '</div><img src="' + src + '"><div class="s">' + sku + '</div><script>window.onload=function(){window.print();}<\/script></body></html>');
  win.document.close();
}

// ── LANGUAGE TOGGLE (Scan) ──
const SCAN_LANG = {
  en: {
    back: '← Back', title: 'QR Scanner', langBtn: 'عربي',
    tabList: 'Items', tabScan: 'Camera Scan', tabPrint: 'Print QR',
    secHdr: 'Chicken Sacks — tap to view balance',
    scanHint: 'Point your phone camera at the item QR Code',
    manualLabel: 'Or enter code manually',
    manualPh: 'CHKN-YLW-001', searchBtn: 'Search',
    printHdr: 'Print QR and stick it on the sack',
    modalClose: 'Close', modalLbl: 'Current Balance',
    modalCat: 'Chicken Sacks', modalUnit: 'Sack',
  },
  ar: {
    back: '→ رجوع', title: 'مسح QR', langBtn: 'English',
    tabList: 'الأصناف', tabScan: 'مسح الكاميرا', tabPrint: 'طباعة QR',
    secHdr: 'شوالات الجاج — اضغط لعرض الرصيد',
    scanHint: 'وجّه كاميرا الجوال على QR Code الصنف',
    manualLabel: 'أو أدخل الكود يدوياً',
    manualPh: 'CHKN-YLW-001', searchBtn: 'بحث',
    printHdr: 'اطبع QR وألصقه على الشوال',
    modalClose: 'إغلاق', modalLbl: 'الرصيد الحالي',
    modalCat: 'شوالات الجاج', modalUnit: 'شوال',
  }
};
let scanLang = localStorage.getItem('est-lang') || 'ar';
function applyScanLang(lang) {
  scanLang = lang;
  localStorage.setItem('est-lang', lang);
  const t = SCAN_LANG[lang];
  const isAr = lang === 'ar';
  document.documentElement.lang = lang;
  document.documentElement.dir  = isAr ? 'rtl' : 'ltr';
  document.getElementById('backBtn').textContent    = t.back;
  document.getElementById('pageTitle').textContent  = t.title;
  document.getElementById('langToggleBtn').textContent = t.langBtn;
  document.getElementById('tabList').textContent    = t.tabList;
  document.getElementById('tabScan').textContent    = t.tabScan;
  document.getElementById('tabPrint').textContent   = t.tabPrint;
  const secH = document.querySelector('.sec-header');
  if (secH) secH.textContent = t.secHdr;
  const scanH = document.querySelector('.scanner-hint');
  if (scanH) scanH.textContent = t.scanHint;
  const manL = document.querySelector('.manual-label');
  if (manL) manL.textContent = t.manualLabel;
  const manI = document.getElementById('manualInput');
  if (manI) manI.placeholder = t.manualPh;
  const manB = document.querySelector('.manual-wrap button');
  if (manB) manB.textContent = t.searchBtn;
  const closeBtn = document.querySelector('.modal-close');
  if (closeBtn) closeBtn.textContent = t.modalClose;
  const modalLbl = document.querySelector('.modal-lbl');
  if (modalLbl) modalLbl.textContent = t.modalLbl;
  const modalUnit = document.querySelector('.modal-unit');
  if (modalUnit) modalUnit.textContent = t.modalUnit;
}
function toggleScanLang() {
  applyScanLang(scanLang === 'ar' ? 'en' : 'ar');
}
applyScanLang(scanLang);

// ── AUTO-LOOKUP from URL param (?sku=CHKN-YLW-001) ──
(function() {
  const params = new URLSearchParams(window.location.search);
  const sku = params.get('sku');
  if (sku) {
    switchTab('scan');
    lookupAndShow(sku);
  }
})();

