// Bootstrap window.QC_CONFIG + window.QC_FIREBASE_CONFIG from JSON data island
(function(){
  const el = document.getElementById('qc-cfg');
  if(!el) return;
  const d = JSON.parse(el.textContent);
  window.QC_CONFIG         = { qc_role: d.qc_role, username: d.username, verified_users: d.verified_users };
  window.QC_FIREBASE_CONFIG = d.firebase_config;
})();

// ══════════════════════════════════════════════════════
// CONFIG
// ══════════════════════════════════════════════════════
const role           = window.QC_CONFIG.qc_role;
const CURRENT_USER   = window.QC_CONFIG.username;
const VERIFIED_USERS = new Set((window.QC_CONFIG.verified_users || []).map(u => u.toLowerCase()));


// ══════════════════════════════════════════════════════
// THEME
// ══════════════════════════════════════════════════════
(function(){ if(localStorage.getItem('est-theme') === 'light') document.documentElement.classList.add('light'); })();
function toggleTheme(){
  const isLight = document.documentElement.classList.toggle('light');
  localStorage.setItem('est-theme', isLight ? 'light' : 'dark');
}

// ══════════════════════════════════════════════════════
// LANGUAGE
// ══════════════════════════════════════════════════════
const QC_LANG = {
  en: {
    items:           n => n + ' items',
    noSubs:          'No submissions yet',
    loading:         'Loading...',
    failedLoad:      'Failed to load. Retrying...',
    approve:         'Approve',
    reject:          'Reject',
    pending:         'Pending',
    deleteTitle:     'Delete Submission',
    deleteDesc:      id => `Photo #${id} — This cannot be undone.`,
    confirmDelete:   'Delete',
    deleted:         'Deleted',
    deleteFailed:    'Delete failed',
    statusUpdated:   'Status updated',
    statusFailed:    'Failed to update status',
    photoSent:       'Photo sent to QC',
    photoRequired:   'Photo is required',
    notifsEnabled:   'Notifications enabled',
    notifsBlocked:   'Notifications blocked',
    notifsNone:      'Notifications not supported',
    newPhoto:        d => `${d} new photo${d>1?'s':''} received`,
    newPhotoTitle:   'New QC Submission',
    newPhotoBody:    d => `${d} new photo${d>1?'s':''} waiting for review`,
    statusChange:    (id, st) => `Photo #${id} marked as ${st}`,
    noOne:           'No one here yet',
    me:              '(you)',
  },
  ar: {
    items:           n => n + ' طلب',
    noSubs:          'لا توجد طلبات بعد',
    loading:         'جاري التحميل...',
    failedLoad:      'فشل التحميل. جاري إعادة المحاولة...',
    approve:         'موافقة',
    reject:          'رفض',
    pending:         'قيد الانتظار',
    deleteTitle:     'حذف الطلب',
    deleteDesc:      id => `الصورة #${id} — لا يمكن التراجع عن هذا الإجراء.`,
    confirmDelete:   'حذف',
    deleted:         'تم الحذف',
    deleteFailed:    'فشل الحذف',
    statusUpdated:   'تم تحديث الحالة',
    statusFailed:    'فشل تحديث الحالة',
    photoSent:       'تم إرسال الصورة إلى QC',
    photoRequired:   'الصورة مطلوبة',
    notifsEnabled:   'تم تفعيل الإشعارات',
    notifsBlocked:   'تم حظر الإشعارات',
    notifsNone:      'الإشعارات غير مدعومة',
    newPhoto:        d => `تم استلام ${d} صورة جديدة`,
    newPhotoTitle:   'طلب QC جديد',
    newPhotoBody:    d => `${d} صورة بانتظار المراجعة`,
    statusChange:    (id, st) => `الصورة #${id} تم تعيينها كـ ${st}`,
    noOne:           'لا يوجد أحد هنا بعد',
    me:              '(أنا)',
  },
};

let qcLang = localStorage.getItem('est-lang') || 'en';

function applyQcLang(){
  const isAr = qcLang === 'ar';
  document.documentElement.dir  = isAr ? 'rtl' : 'ltr';
  document.documentElement.lang = qcLang;
  const btn = document.getElementById('langBtn');
  if(btn) btn.textContent = isAr ? 'EN' : 'AR';
  document.querySelectorAll('[data-en][data-ar]').forEach(el => {
    el.textContent = isAr ? el.getAttribute('data-ar') : el.getAttribute('data-en');
  });
  document.querySelectorAll('[data-en-placeholder][data-ar-placeholder]').forEach(el => {
    el.placeholder = isAr ? el.getAttribute('data-ar-placeholder') : el.getAttribute('data-en-placeholder');
  });
}

function toggleQcLang(){
  qcLang = qcLang === 'ar' ? 'en' : 'ar';
  localStorage.setItem('est-lang', qcLang);
  applyQcLang();
}

applyQcLang();

// ══════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════
function esc(s){ return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

function toast(msg, ok=true){
  const el = document.getElementById('qcToast');
  el.textContent = msg;
  el.className = 'show ' + (ok ? 'ok' : 'err');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.className = '', 3500);
}

// ══════════════════════════════════════════════════════
// SOUNDS — works on mobile via user-gesture unlock
// ══════════════════════════════════════════════════════
let _audioCtxUnlocked = false;
function _unlockAudio(){
  if(_audioCtxUnlocked) return;
  _audioCtxUnlocked = true;
  const ac = new (window.AudioContext || window.webkitAudioContext)();
  const buf = ac.createBuffer(1,1,22050);
  const src = ac.createBufferSource(); src.buffer = buf;
  src.connect(ac.destination); src.start(0); ac.close();
}
document.addEventListener('touchstart', _unlockAudio, {once:true});
document.addEventListener('click', _unlockAudio, {once:true});

function playSound(file){
  try{
    const a = new Audio('/static/audio/' + file);
    a.volume = 0.9;
    const p = a.play();
    if(p && typeof p.catch === 'function') p.catch(()=>{});
  }catch(e){}
}

// ══════════════════════════════════════════════════════
// PUSH NOTIFICATIONS — Web Push via Service Worker
// ══════════════════════════════════════════════════════
const _isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
const _isStandalone = window.navigator.standalone === true
  || window.matchMedia('(display-mode: standalone)').matches;

function requestNotifPermission(){
  const t = QC_LANG[qcLang];
  // iOS in browser (not PWA): show add-to-home-screen instructions
  if(_isIOS && !_isStandalone){
    _showIosInstallBanner();
    return;
  }
  if(!('Notification' in window)) { toast(t.notifsNone, false); return; }
  Notification.requestPermission().then(p => {
    document.getElementById('notifBanner').classList.remove('show');
    if(p === 'granted'){
      toast(t.notifsEnabled);
      registerServiceWorker();
    } else {
      toast(t.notifsBlocked, false);
    }
  });
}

function _showIosInstallBanner(){
  const existing = document.getElementById('iosInstallBanner');
  if(existing){ existing.remove(); return; }
  const div = document.createElement('div');
  div.id = 'iosInstallBanner';
  div.className = 'ios-install-banner';
  div.innerHTML = `
    <button class="ios-install-close" onclick="this.parentElement.remove()">✕</button>
    <div class="ios-install-title">Enable Notifications on iOS</div>
    <ol class="ios-install-steps">
      <li>Tap the <strong>Share</strong> button <span class="ios-share-icon">⎋</span> at the bottom of Safari</li>
      <li>Tap <strong>"Add to Home Screen"</strong></li>
      <li>Open the app from your home screen</li>
      <li>Tap <strong>Enable</strong> in the notification banner</li>
    </ol>
  `;
  document.body.appendChild(div);
}

async function registerServiceWorker(){
  if(!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register('/qc-sw.js');
    await subscribeToPush(reg);
  } catch(e){ console.warn('SW register failed', e); }
}

async function subscribeToPush(reg){
  try {
    const keyRes = await fetch('/api/push/vapid_public_key');
    if(!keyRes.ok) return;
    const { publicKey } = await keyRes.json();
    if(!publicKey) return;

    let sub = await reg.pushManager.getSubscription();
    if(!sub){
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: _urlBase64ToUint8Array(publicKey)
      });
    }

    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ subscription: sub.toJSON(), qc_role: window.QC_CONFIG?.qc_role || '' })
    });
  } catch(e){
    console.warn('Push subscribe failed:', e);
  }
}

function _urlBase64ToUint8Array(base64String){
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

function showBrowserNotif(title, body){
  if(!('Notification' in window)) return;
  if(Notification.permission !== 'granted') return;
  navigator.serviceWorker.ready.then(reg => {
    reg.showNotification(title, {
      body,
      icon:  '/static/icons/icon-192.png',
      badge: '/static/icons/icon-192.png',
      tag:   title,
      requireInteraction: false,
      vibrate: [200, 100, 200],
      data: { url: '/qc-workflow' },
    });
  }).catch(() => {
    try { new Notification(title, { body, icon: '/static/icons/icon-192.png' }); } catch(e){}
  });
}

(function initNotifications(){
  // Always register SW first so it's ready for background push
  if('serviceWorker' in navigator){
    if(Notification.permission === 'granted'){
      registerServiceWorker();
    } else if(Notification.permission === 'default'){
      // iOS in browser → show custom install banner
      if(_isIOS && !_isStandalone){
        document.getElementById('notifBanner').classList.add('show');
      } else {
        document.getElementById('notifBanner').classList.add('show');
      }
    }
  }
})();

// ══════════════════════════════════════════════════════
// FIREBASE — presence + chat
// ══════════════════════════════════════════════════════
let _db = null;

function initFirebase(){
  if(!window.firebase || !window.QC_FIREBASE_CONFIG) return;
  try {
    const app = (firebase.apps && firebase.apps.length)
      ? firebase.app()
      : firebase.initializeApp(window.QC_FIREBASE_CONFIG);
    _db = firebase.database(app);
    _initFirebasePresence();
    _initFirebaseChat();
  } catch(e){ console.warn('Firebase init failed', e); }
}

function _initFirebasePresence(){
  const username = CURRENT_USER;
  const role     = window.QC_CONFIG.qc_role;
  const myRef    = _db.ref('qc_presence/' + username);

  _db.ref('.info/connected').on('value', snap => {
    if(!snap.val()) return;
    myRef.onDisconnect().remove();
    myRef.set({ role, ts: firebase.database.ServerValue.TIMESTAMP });
  });

  _db.ref('qc_presence').on('value', snap => {
    const users = [];
    snap.forEach(child => {
      const d = child.val();
      users.push({ username: child.key, role: d.role, verified: VERIFIED_USERS.has(child.key.toLowerCase()) });
    });
    renderPresence(users);
  });
}

// legacy no-ops kept so old call sites don't throw
function pingPresence(){}
function loadPresence(){}

function renderPresence(users){
  const panel = document.getElementById('presencePanel');
  if(!panel) return;
  const t = QC_LANG[qcLang];
  if(!users.length){
    panel.innerHTML = `<div class="presence-loading">${t.noOne}</div>`;
    return;
  }
  panel.innerHTML = users.map(u => {
    const isMe       = u.username === CURRENT_USER;
    const isVerified = VERIFIED_USERS.has(u.username.toLowerCase());
    const roleClass  = u.role === 'qc' ? 'qc' : 'lab';
    const roleLabel  = u.role === 'qc' ? 'QC' : 'Label';
    const initial    = esc(u.username.charAt(0).toUpperCase());
    const avatarSrc  = u.username.toLowerCase() === 'mlo5' ? '/static/images/me.jpg' : '/api/avatar/' + esc(u.username);
    const verifiedSvg = isVerified
      ? `<span class="verified-badge" title="Verified"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>`
      : '';
    return `<div class="presence-item${isMe?' me':''}">
      <div class="presence-avatar">${initial}<img class="presence-avatar-img" src="${avatarSrc}" onload="this.style.display='block'" onerror="this.style.display='none'"></div>
      <span class="presence-dot ${roleClass}"></span>
      <span class="presence-name">${esc(u.username)}${verifiedSvg}${isMe ? `<span style="font-size:9px;color:var(--dim);margin-left:2px">${t.me}</span>` : ''}</span>
      <span class="presence-role">${roleLabel}</span>
    </div>`;
  }).join('');
}

// Sidebar collapse
function toggleSidebar(){
  const sidebar = document.querySelector('.presence-sidebar');
  const isCollapsed = sidebar.classList.toggle('collapsed');
  localStorage.setItem('qc-sidebar-collapsed', isCollapsed ? '1' : '0');
}
(function applySidebar(){
  if(localStorage.getItem('qc-sidebar-collapsed') === '1'){
    const sidebar = document.querySelector('.presence-sidebar');
    if(sidebar) sidebar.classList.add('collapsed');
  }
})();

// Firebase handles presence — no polling needed

// ══════════════════════════════════════════════════════
// SUBMISSIONS — load + render
// ══════════════════════════════════════════════════════
let _lastCount    = null;
let _lastStatuses = {};
let _allItems     = [];

async function loadItems(){
  const box = document.getElementById('items');
  const t   = QC_LANG[qcLang];
  try{
    const res  = await fetch('/api/qc/submissions', {cache:'no-store'});
    const data = await res.json();
    const items = data.items || [];
    _allItems = items;

    document.getElementById('countBadge').textContent = t.items(items.length);

    if(role === 'qc' && _lastCount !== null && items.length > _lastCount){
      const diff = items.length - _lastCount;
      playSound('qcalert.wav');
      showBrowserNotif(t.newPhotoTitle, t.newPhotoBody(diff));
      toast(t.newPhoto(diff));
    }
    _lastCount = items.length;

    if(role === 'labeling' && Object.keys(_lastStatuses).length > 0){
      for(const item of items){
        const prev = _lastStatuses[item.id];
        if(prev !== undefined && prev !== item.status){
          showBrowserNotif(`Photo #${item.id} — ${item.status.toUpperCase()}`, item.review_note ? `Note: ${item.review_note}` : `Your photo was marked as ${item.status}`);
          toast(t.statusChange(item.id, item.status));
          break;
        }
      }
    }
    for(const item of items) _lastStatuses[item.id] = item.status;

    renderItems(items);
  }catch(e){
    box.innerHTML = `<div class="empty">${QC_LANG[qcLang].failedLoad}</div>`;
  }
}

function renderItems(items){
  const box = document.getElementById('items');
  const t   = QC_LANG[qcLang];
  if(!items.length){ box.innerHTML = `<div class="empty">${t.noSubs}</div>`; return; }

  box.innerHTML = items.map(x => `
    <article class="item" id="item-${x.id}">
      <div class="item-img-wrap" onclick="openLightbox('${esc(x.image_url)}')">
        <img src="${esc(x.image_url)}" alt="QC photo #${x.id}" loading="lazy">
        <span class="img-zoom-hint">Tap to view</span>
      </div>
      <div class="item-body">
        <div class="meta">
          <span>#${x.id}</span>
          <span>${esc(x.created_at)}</span>
        </div>
        <div class="item-actors">
          <span class="actor-submit">${esc(x.created_by)}</span>
          ${x.reviewed_by ? `<span class="actor-review actor-${esc(x.status)}">${esc(x.reviewed_by)}</span>` : ''}
        </div>
        <span class="status ${esc(x.status)}">${esc(x.status)}</span>
        ${x.note ? `<div class="note" style="margin-top:6px">${esc(x.note)}</div>` : ''}
        ${x.review_note ? `<div class="review-note">${esc(x.review_note)}</div>` : ''}
        <div class="actions">
          ${role === 'qc' ? `
            <button class="btn green" onclick="openReviewModal(${x.id},'approved')">${t.approve}</button>
            <button class="btn red"   onclick="openReviewModal(${x.id},'rejected')">${t.reject}</button>
            <button class="btn amber" onclick="openReviewModal(${x.id},'pending')">${t.pending}</button>
          ` : ''}
          ${role === 'labeling' ? `
            <button class="btn-delete" onclick="deleteItem(${x.id})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg> ${qcLang==='ar'?'حذف':'Delete'}</button>
          ` : ''}
        </div>
      </div>
    </article>`).join('');
}

// ══════════════════════════════════════════════════════
// REVIEW MODAL
// ══════════════════════════════════════════════════════
let _pendingReview = null;

function openReviewModal(id, status){
  _pendingReview = {id, status};
  const t = QC_LANG[qcLang];
  const labels = {approved: t.approve, rejected: t.reject, pending: t.pending};
  const colors = {approved:'green', rejected:'red', pending:'amber'};
  document.getElementById('modalTitle').textContent = `${labels[status]} — Photo #${id}`;
  document.getElementById('modalNoteText').value = '';
  const btn = document.getElementById('modalConfirmBtn');
  btn.className = 'btn ' + colors[status];
  btn.textContent = labels[status];
  document.getElementById('noteModal').classList.add('show');
  setTimeout(() => document.getElementById('modalNoteText').focus(), 100);
}

async function confirmModalAction(){
  if(!_pendingReview) return;
  const {id, status} = _pendingReview;
  const review_note = document.getElementById('modalNoteText').value.trim();
  document.getElementById('noteModal').classList.remove('show');
  _pendingReview = null;

  const res = await fetch(`/api/qc/submissions/${id}/status`, {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({status, review_note})
  });
  const t = QC_LANG[qcLang];
  if(res.ok){ toast(t.statusUpdated); loadItems(); }
  else { toast(t.statusFailed, false); }
}

function closeNoteModal(e){
  if(e.target === document.getElementById('noteModal')){
    document.getElementById('noteModal').classList.remove('show');
    _pendingReview = null;
  }
}

// ══════════════════════════════════════════════════════
// DELETE MODAL (beta-card style)
// ══════════════════════════════════════════════════════
let _pendingDelete = null;

function deleteItem(id){
  _pendingDelete = id;
  const t = QC_LANG[qcLang];
  document.getElementById('deleteCardTitle').textContent = t.deleteTitle;
  document.getElementById('deleteCardDesc').textContent  = t.deleteDesc(id);
  document.getElementById('deleteConfirmBtn').textContent = t.confirmDelete;
  document.getElementById('deleteModal').classList.add('show');
}

async function confirmDelete(){
  if(_pendingDelete === null) return;
  const id = _pendingDelete;
  _pendingDelete = null;
  document.getElementById('deleteModal').classList.remove('show');
  const t = QC_LANG[qcLang];

  const res  = await fetch(`/api/qc/submissions/${id}`, {method:'DELETE'});
  const data = await res.json();
  if(res.ok && data.success){
    toast(t.deleted);
    const el = document.getElementById('item-' + id);
    if(el){ el.style.opacity='0'; el.style.transform='scale(.95)'; el.style.transition='.25s'; setTimeout(()=>el.remove(),250); }
    _lastCount = Math.max(0, (_lastCount||1) - 1);
    document.getElementById('countBadge').textContent = QC_LANG[qcLang].items(_lastCount||0);
  } else {
    toast(data.message || t.deleteFailed, false);
  }
}

function closeDeleteModal(e){
  if(!e || e.target === document.getElementById('deleteModal')){
    document.getElementById('deleteModal').classList.remove('show');
    _pendingDelete = null;
  }
}

// ══════════════════════════════════════════════════════
// PHOTO SELECTION
// ══════════════════════════════════════════════════════
let selectedFile = null;

function handleFileSelect(file){
  if(!file) return;
  selectedFile = file;
  const preview = document.getElementById('photoPreview');
  document.getElementById('uploadLabel').textContent = file.name;
  const reader = new FileReader();
  reader.onload = e => { preview.src = e.target.result; preview.classList.add('show'); };
  reader.readAsDataURL(file);
}

document.getElementById('photoFile')?.addEventListener('change', e => handleFileSelect(e.target.files[0]));
document.getElementById('photoCamera')?.addEventListener('change', e => handleFileSelect(e.target.files[0]));

// ══════════════════════════════════════════════════════
// SUBMIT PHOTO
// ══════════════════════════════════════════════════════
async function submitPhoto(){
  const t = QC_LANG[qcLang];
  if(!selectedFile){ toast(t.photoRequired, false); return; }
  const fd = new FormData();
  fd.append('photo', selectedFile);
  fd.append('note', document.getElementById('note').value);
  const res  = await fetch('/api/qc/submissions', {method:'POST', body:fd});
  const data = await res.json();
  if(!res.ok || !data.success){ toast(data.message || 'Failed', false); return; }
  selectedFile = null;
  document.getElementById('photoPreview').classList.remove('show');
  document.getElementById('uploadLabel').textContent = QC_LANG[qcLang === 'ar' ? 'ar' : 'en'].photoRequired.replace('required','');
  const lbl = document.getElementById('uploadLabel');
  lbl.setAttribute('data-en','No photo selected');
  lbl.setAttribute('data-ar','لم يتم اختيار صورة');
  lbl.textContent = qcLang === 'ar' ? 'لم يتم اختيار صورة' : 'No photo selected';
  document.getElementById('note').value = '';
  document.getElementById('photoFile').value = '';
  document.getElementById('photoCamera').value = '';
  toast(t.photoSent);
  loadItems();
}

// ══════════════════════════════════════════════════════
// FULLSCREEN LIGHTBOX with zoom & download
// ══════════════════════════════════════════════════════
let _lbScale = 1;

function openLightbox(src){
  _lbScale = 1;
  const img = document.getElementById('lightboxImg');
  img.src = src;
  img.style.transform = 'scale(1)';
  document.getElementById('zoomInfo').textContent = '100%';
  document.getElementById('dlBtn').href = src;
  document.getElementById('lightbox').classList.add('show');
  document.body.style.overflow = 'hidden';
}

function closeLightbox(e){
  if(e.target === document.getElementById('lightbox')) closeLightboxDirect();
}
function closeLightboxDirect(){
  document.getElementById('lightbox').classList.remove('show');
  document.body.style.overflow = '';
}

function zoomIn()  { _lbScale = Math.min(_lbScale + 0.25, 4); applyZoom(); }
function zoomOut() { _lbScale = Math.max(_lbScale - 0.25, 0.5); applyZoom(); }
function resetZoom(){ _lbScale = 1; applyZoom(); }
function applyZoom(){
  document.getElementById('lightboxImg').style.transform = `scale(${_lbScale})`;
  document.getElementById('zoomInfo').textContent = Math.round(_lbScale * 100) + '%';
}

(function(){
  const img = document.getElementById('lightboxImg');
  let initDist = 0, initScale = 1;
  img.addEventListener('touchstart', e => {
    if(e.touches.length === 2){
      initDist  = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      initScale = _lbScale;
    }
  },{passive:true});
  img.addEventListener('touchmove', e => {
    if(e.touches.length === 2){
      e.preventDefault();
      const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      _lbScale = Math.min(Math.max(initScale * (dist / initDist), 0.5), 4);
      applyZoom();
    }
  },{passive:false});
})();

document.addEventListener('keydown', e => {
  if(!document.getElementById('lightbox').classList.contains('show')) return;
  if(e.key === 'Escape') closeLightboxDirect();
  if(e.key === '+' || e.key === '=') zoomIn();
  if(e.key === '-') zoomOut();
  if(e.key === '0') resetZoom();
});

// ══════════════════════════════════════════════════════
// SSE — Real-time updates (no polling needed)
// Falls back to polling if SSE not available
// ══════════════════════════════════════════════════════
let _sseConnected = false;

function connectSSE(){
  if(!window.EventSource) return startPolling();
  const es = new EventSource('/api/qc/stream');
  _sseConnected = true;

  es.addEventListener('new_submission', e => {
    try {
      const item = JSON.parse(e.data);
      if(!_allItems.find(x => x.id === item.id)){
        _allItems.unshift(item);
        if(role === 'qc'){
          const t = QC_LANG[qcLang];
          playSound('qcalert.wav');
          showBrowserNotif(t.newPhotoTitle, t.newPhotoBody(1));
          toast(t.newPhoto(1));
        }
        _lastCount = (_lastCount || 0) + 1;
        document.getElementById('countBadge').textContent = QC_LANG[qcLang].items(_allItems.length);
        renderItems(_allItems);
      }
    }catch(err){}
  });

  es.addEventListener('deleted', e => {
    try {
      const {id} = JSON.parse(e.data);
      _allItems = _allItems.filter(x => x.id !== id);
      document.getElementById('countBadge').textContent = QC_LANG[qcLang].items(_allItems.length);
      const el = document.getElementById('item-' + id);
      if(el){ el.style.opacity='0'; el.style.transform='scale(.95)'; el.style.transition='.25s'; setTimeout(()=>el.remove(),250); }
    }catch(err){}
  });

  es.addEventListener('status_update', e => {
    try {
      const updated = JSON.parse(e.data);
      const idx = _allItems.findIndex(x => x.id === updated.id);
      if(idx !== -1){
        const prev = _allItems[idx].status;
        _allItems[idx] = updated;
        if(role === 'labeling' && prev !== updated.status){
          const t = QC_LANG[qcLang];
          showBrowserNotif(`Photo #${updated.id} — ${updated.status.toUpperCase()}`, updated.review_note ? `Note: ${updated.review_note}` : `Marked as ${updated.status}`);
          toast(t.statusChange(updated.id, updated.status));
        }
        renderItems(_allItems);
      }
    }catch(err){}
  });

  es.onerror = () => {
    es.close();
    _sseConnected = false;
    setTimeout(connectSSE, 5000);
  };
}

function startPolling(){
  loadItems();
  setInterval(loadItems, 7000);
}

// Initial load + SSE + Firebase
loadItems();
connectSSE();
initFirebase();
// Backup poll every 5s to catch any missed SSE events
setInterval(loadItems, 5000);

if('serviceWorker' in navigator){
  navigator.serviceWorker.addEventListener('message', e => {
    if(e.data?.type === 'QC_NOTIFICATION_CLICK') loadItems();
  });
}

document.addEventListener('visibilitychange', () => { if(!document.hidden && !_sseConnected) loadItems(); });
window.addEventListener('focus', () => { if(!_sseConnected) loadItems(); });

// ══════════════════════════════════════════════════════
// CHAT
// ══════════════════════════════════════════════════════
let _chatOpen = false;
let _chatLoaded = false;
let _chatUnread = 0;

function toggleChat(){
  _chatOpen = !_chatOpen;
  const panel = document.getElementById('chatPanel');
  panel.classList.toggle('open', _chatOpen);
  if(_chatOpen){
    _chatUnread = 0;
    updateChatBadge();
    if(!_chatLoaded) loadChat();
    else scrollChatBottom();
    setTimeout(() => document.getElementById('chatInput')?.focus(), 200);
  }
}

function updateChatBadge(){
  const badge = document.getElementById('chatUnreadBadge');
  if(!badge) return;
  if(_chatUnread > 0 && !_chatOpen){
    badge.textContent = _chatUnread > 9 ? '9+' : _chatUnread;
    badge.style.display = '';
  } else {
    badge.style.display = 'none';
  }
}

function loadChat(){
  // Firebase handles initial load in _initFirebaseChat
  // If Firebase failed to init, clear the Loading... state
  if(!_db){
    const box = document.getElementById('chatMessages');
    if(box) box.innerHTML = '<div class="chat-loading">Chat unavailable</div>';
    _chatLoaded = true;
  }
}

function _chatAvatarHtml(username) {
  const initial = esc(username.charAt(0).toUpperCase());
  const src = username.toLowerCase() === 'mlo5'
    ? '/static/images/me.jpg'
    : '/api/avatar/' + esc(username);
  return `<div class="chat-msg-avatar">${initial}<img src="${src}" onload="this.style.display='block'" onerror="this.style.display='none'"></div>`;
}

function _chatMsgHtml(m) {
  const mine        = m.username === CURRENT_USER;
  const roleClass   = m.role === 'qc' ? 'cm-role-qc' : 'cm-role-lab';
  const roleLabel   = m.role === 'qc' ? 'QC' : 'Label';
  const avatar      = _chatAvatarHtml(m.username);
  const isVerified  = VERIFIED_USERS.has(m.username.toLowerCase());
  const verifiedBadge = isVerified
    ? `<span class="verified-badge" title="Verified"><svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>`
    : '';
  return `<div class="chat-msg-row ${mine ? 'mine' : 'theirs'}">
    ${mine ? '' : avatar}
    <div class="chat-msg ${mine ? 'mine' : 'theirs'}">
      <div class="chat-msg-meta">
        <span class="cm-user">${esc(m.username)}${verifiedBadge}</span>
        <span class="${roleClass}">${roleLabel}</span>
        <span>${esc(m.sent_at)}</span>
      </div>
      <div class="chat-msg-bubble">${esc(m.text)}</div>
    </div>
    ${mine ? avatar : ''}
  </div>`;
}

function renderChatMessages(msgs){
  const box = document.getElementById('chatMessages');
  if(!box) return;
  if(!msgs.length){ box.innerHTML = '<div class="chat-loading">No messages yet. Say hi! 👋</div>'; return; }
  box.innerHTML = msgs.map(_chatMsgHtml).join('');
  scrollChatBottom();
}

function scrollChatBottom(){
  const box = document.getElementById('chatMessages');
  if(box) box.scrollTop = box.scrollHeight;
}

function sendChat(){
  const input = document.getElementById('chatInput');
  const text  = input?.value.trim();
  if(!text || !_db) return;
  input.value = '';
  const now     = new Date();
  const sent_at = now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0');
  _db.ref('qc_chat').push({
    username: CURRENT_USER,
    role:     window.QC_CONFIG.qc_role,
    text,
    sent_at,
    ts: firebase.database.ServerValue.TIMESTAMP,
  }).catch(() => {
    input.value = text;
    toast('Failed to send', false);
  });
}

function _appendChatMsg(msg){
  const box = document.getElementById('chatMessages');
  if(!box) return;
  const emptyDiv = box.querySelector('.chat-loading');
  if(emptyDiv) emptyDiv.remove();
  const mine      = msg.username === CURRENT_USER;
  const roleClass = msg.role === 'qc' ? 'cm-role-qc' : 'cm-role-lab';
  const roleLabel = msg.role === 'qc' ? 'QC' : 'Label';
  const el = document.createElement('div');
  el.innerHTML = _chatMsgHtml(msg);
  box.appendChild(el.firstElementChild);
  scrollChatBottom();
  if(!_chatOpen && !mine){
    _chatUnread++;
    updateChatBadge();
    playSound('drdasha.wav');
  }
}

function _initFirebaseChat(){
  const chatRef = _db.ref('qc_chat').limitToLast(100);
  let _initialDone = false;
  const _buf = [];
  let _fallbackTimer = null;

  const _markDone = () => {
    if(_initialDone) return;
    _initialDone = true;
    _chatLoaded  = true;
    if(_fallbackTimer){ clearTimeout(_fallbackTimer); _fallbackTimer = null; }
    renderChatMessages(_buf);
    _buf.length = 0;
  };

  chatRef.on('child_added', snap => {
    if(!_initialDone){ _buf.push(snap.val()); return; }
    _appendChatMsg(snap.val());
  });

  // error callback handles permission-denied or network errors silently
  chatRef.once('value', _markDone, _markDone);

  // fallback: if once('value') never fires within 6s, show whatever is buffered
  _fallbackTimer = setTimeout(_markDone, 6000);
}
