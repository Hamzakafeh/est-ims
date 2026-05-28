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

const SCAN_LANG = {
  en: {
    lang: 'AR', badge: 'Live Inventory Lookup',
    heroTitle: 'QR SCAN',
    heroSub: 'Scan an inventory QR code to retrieve the latest stock balance directly from EST-iMs.',
    scan: 'Scan QR', hint: 'Tap to open the camera and scan a stock code.', cancel: 'Cancel',
    loading: 'Retrieving live data...', balance: 'Current balance', unit: 'Unit',
    again: 'Scan another code', retry: 'Try again',
    cameraError: 'The camera could not be opened. Please allow camera permission.',
    notFound: 'The code is not found in the system.', serverError: 'Unable to connect to the server.',
    lastUpdate: 'Last update: '
  },
  ar: {
    lang: 'EN', badge: 'بحث مباشر في المخزون',
    heroTitle: 'مسح QR',
    heroSub: 'افحص كود المخزون لعرض آخر رصيد مباشرة من نظام EST-iMs.',
    scan: 'افحص QR', hint: 'اضغط لفتح الكاميرا وفحص كود الصنف.', cancel: 'إلغاء',
    loading: 'جاري جلب البيانات...', balance: 'الرصيد الحالي', unit: 'وحدة',
    again: 'فحص كود آخر', retry: 'حاول مرة أخرى',
    cameraError: 'تعذر فتح الكاميرا. تأكد من السماح بصلاحية الكاميرا.',
    notFound: 'الكود غير موجود في النظام.', serverError: 'تعذر الاتصال بالسيرفر.',
    lastUpdate: 'آخر تحديث: '
  }
};
let scanLang = localStorage.getItem('est-lang') || 'en';
let scanner = null;

function t(key) { return SCAN_LANG[scanLang][key]; }
function applyScanLang(lang) {
  scanLang = lang;
  localStorage.setItem('est-lang', lang);
  const isAr = lang === 'ar';
  document.documentElement.lang = lang;
  document.documentElement.dir = isAr ? 'rtl' : 'ltr';
  document.getElementById('langDockText').textContent = t('lang');
  document.getElementById('badgeText').textContent = t('badge');
  document.getElementById('heroTitle').textContent = t('heroTitle');
  document.getElementById('heroSub').textContent = t('heroSub');
  document.getElementById('scanLabel').textContent = t('scan');
  document.getElementById('hintText').textContent = t('hint');
  document.getElementById('cancelBtn').textContent = t('cancel');
  document.getElementById('loadingText').textContent = t('loading');
  document.getElementById('balanceLabel').textContent = t('balance');
  document.getElementById('resultUnit').textContent = t('unit');
  document.getElementById('scanAgainBtn').textContent = t('again');
  document.getElementById('retryBtn').textContent = t('retry');
}
function toggleScanLang() { applyScanLang(scanLang === 'en' ? 'ar' : 'en'); }

function showState(name) {
  ['ready','scanning','loading','result','error'].forEach(s => {
    const el = document.getElementById('state-' + s);
    el.style.display = (s === name) ? 'flex' : 'none';
  });
}

function startCamera() {
  showState('scanning');
  scanner = new Html5Qrcode('reader');
  scanner.start(
    { facingMode: 'environment' },
    { fps: 12, qrbox: { width: 240, height: 240 } },
    (decoded) => {
      stopCamera();
      handleScanned(decoded);
    },
    () => {}
  ).catch(() => {
    showError(t('cameraError'));
  });
}

function stopCamera() {
  if (scanner) {
    scanner.stop().catch(() => {});
    scanner = null;
  }
}

function handleScanned(raw) {
  let sku = raw.trim().toUpperCase();
  try {
    const url = new URL(raw);
    const fromParam = url.searchParams.get('sku');
    if (fromParam) sku = fromParam.trim().toUpperCase();
  } catch(e) {}

  showState('loading');
  fetch('/api/qrscan/' + encodeURIComponent(sku))
    .then(r => r.json())
    .then(data => {
      if (data.found) showResult(data);
      else showError(data.error || t('notFound'));
    })
    .catch(() => showError(t('serverError')));
}

function showResult(data) {
  document.getElementById('resBar').style.background = data.hex || '#1a3a5c';
  const category = data.category || 'Stocktaking';
  const name = data.nameAr || data.color || data.sku;
  document.querySelector('.result-cat').textContent = category;
  document.getElementById('resName').textContent = name;
  const balance = Number(data.balance);
  document.getElementById('resBalance').textContent = Number.isFinite(balance) ? balance.toLocaleString() : data.balance;
  document.getElementById('resDate').textContent = t('lastUpdate') + (data.date || '-');
  document.getElementById('resSku').textContent = data.sku;
  showState('result');
}

function showError(msg) {
  document.getElementById('errMsg').textContent = msg;
  showState('error');
}

function reset() {
  stopCamera();
  showState('ready');
}

applyScanLang(scanLang);
(function() {
  const params = new URLSearchParams(window.location.search);
  const sku = params.get('sku');
  if (sku) handleScanned(sku);
})();
