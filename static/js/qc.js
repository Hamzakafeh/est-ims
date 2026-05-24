// ══════════════════════════════════════════════════════
// CONFIG
// ══════════════════════════════════════════════════════
const role = window.QC_CONFIG.qc_role;

// ══════════════════════════════════════════════════════
// THEME
// ══════════════════════════════════════════════════════
(function(){ if(localStorage.getItem('est-theme') === 'light') document.documentElement.classList.add('light'); })();
function toggleTheme(){
  const isLight = document.documentElement.classList.toggle('light');
  localStorage.setItem('est-theme', isLight ? 'light' : 'dark');
}

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
    const a = new Audio('/static/' + file);
    a.volume = 0.9;
    const p = a.play();
    if(p && typeof p.catch === 'function') p.catch(()=>{});
  }catch(e){}
}

// ══════════════════════════════════════════════════════
// PUSH NOTIFICATIONS — Web Push via Service Worker
// ══════════════════════════════════════════════════════
function requestNotifPermission(){
  if(!('Notification' in window)) { toast('Notifications not supported', false); return; }
  Notification.requestPermission().then(p => {
    document.getElementById('notifBanner').classList.remove('show');
    if(p === 'granted'){
      toast('✅ Notifications enabled!');
      registerServiceWorker();
    } else {
      toast('Notifications blocked', false);
    }
  });
}

async function registerServiceWorker(){
  if(!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register('/static/qc-sw.js');
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
      body: JSON.stringify({ subscription: sub.toJSON() })
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
  // Try via service worker for background support
  if('serviceWorker' in navigator){
    navigator.serviceWorker.ready.then(reg => {
      reg.showNotification(title, {
        body,
        icon: '/static/low.ico',
        badge: '/static/low.ico',
        tag: title,
        requireInteraction: true,
        vibrate: [200, 100, 200]
      });
    }).catch(() => {
      // Fallback: direct Notification
      try { new Notification(title, { body, icon: '/static/low.ico', tag: title }); } catch(e){}
    });
  } else {
    try { new Notification(title, { body, icon: '/static/low.ico', tag: title }); } catch(e){}
  }
}

// Show banner if permission not yet decided
(function(){
  if(!('Notification' in window)) return;
  if(Notification.permission === 'default'){
    document.getElementById('notifBanner').classList.add('show');
  }
  // Register SW if already granted
  if(Notification.permission === 'granted') registerServiceWorker();
})();

// ══════════════════════════════════════════════════════
// POLLING — real-time updates via fast polling
// ══════════════════════════════════════════════════════
let _lastCount    = null;
let _lastStatuses = {};
let _allItems     = [];

async function loadItems(){
  const box = document.getElementById('items');
  try{
    const res  = await fetch('/api/qc/submissions', {cache:'no-store'});
    const data = await res.json();
    const items = data.items || [];
    _allItems = items;

    document.getElementById('countBadge').textContent = items.length + ' items';

    // ── Detect NEW submission (QC gets alert) ──
    if(role === 'qc' && _lastCount !== null && items.length > _lastCount){
      const diff = items.length - _lastCount;
      playSound('qcalert.wav');
      showBrowserNotif('📸 New QC Submission', `${diff} new photo${diff > 1 ? 's' : ''} waiting for review`);
      toast(`📸 ${diff} new photo${diff > 1 ? 's' : ''} received!`);
    }
    _lastCount = items.length;

    // ── Detect STATUS CHANGE (Labeling gets alert) ──
    if(role === 'labeling' && Object.keys(_lastStatuses).length > 0){
      for(const item of items){
        const prev = _lastStatuses[item.id];
        if(prev !== undefined && prev !== item.status){
          playSound('lebelass.wav');
          const emoji = item.status === 'approved' ? '✅' : item.status === 'rejected' ? '❌' : '⏳';
          showBrowserNotif(`${emoji} Photo #${item.id} ${item.status.toUpperCase()}`, item.review_note ? `Note: ${item.review_note}` : `Your photo was marked as ${item.status}`);
          toast(`${emoji} Photo #${item.id} marked as ${item.status}`);
          break;
        }
      }
    }
    for(const item of items) _lastStatuses[item.id] = item.status;

    renderItems(items);
  }catch(e){
    box.innerHTML = '<div class="empty">⚠ Failed to load. Retrying...</div>';
  }
}

function renderItems(items){
  const box = document.getElementById('items');
  if(!items.length){ box.innerHTML = '<div class="empty">No submissions yet</div>'; return; }

  box.innerHTML = items.map(x => `
    <article class="item" id="item-${x.id}">
      <div class="item-img-wrap" onclick="openLightbox('${esc(x.image_url)}')">
        <img src="${esc(x.image_url)}" alt="QC photo #${x.id}" loading="lazy">
        <span class="img-zoom-hint">🔍 Tap to view</span>
      </div>
      <div class="item-body">
        <div class="meta">
          <span>#${x.id} — ${esc(x.created_by)}</span>
          <span>${esc(x.created_at)}</span>
        </div>
        <span class="status ${esc(x.status)}">${esc(x.status)}</span>
        ${x.note ? `<div class="note" style="margin-top:6px">${esc(x.note)}</div>` : ''}
        ${x.review_note ? `<div class="review-note">💬 ${esc(x.review_note)}</div>` : ''}
        <div class="actions">
          ${role === 'qc' ? `
            <button class="btn green" onclick="openReviewModal(${x.id},'approved')">✅ Approve</button>
            <button class="btn red"   onclick="openReviewModal(${x.id},'rejected')">❌ Reject</button>
            <button class="btn amber" onclick="openReviewModal(${x.id},'pending')">⏳ Pending</button>
          ` : ''}
          ${role === 'labeling' ? `
            <button class="btn-delete" onclick="deleteItem(${x.id})">🗑 Delete</button>
          ` : ''}
        </div>
      </div>
    </article>`).join('');
}

// ══════════════════════════════════════════════════════
// REVIEW ACTION (with modal note — About-style)
// ══════════════════════════════════════════════════════
let _pendingReview = null;

function openReviewModal(id, status){
  _pendingReview = {id, status};
  const statusLabels = {approved:'✅ Approve', rejected:'❌ Reject', pending:'⏳ Pending'};
  const statusColors = {approved:'green', rejected:'red', pending:'amber'};
  document.getElementById('modalTitle').textContent = `${statusLabels[status]} — Photo #${id}`;
  document.getElementById('modalNoteText').value = '';
  const btn = document.getElementById('modalConfirmBtn');
  btn.className = 'btn ' + statusColors[status];
  btn.textContent = statusLabels[status];
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
  if(res.ok){ toast('✅ Status updated'); loadItems(); }
  else { toast('Failed to update status', false); }
}

function closeNoteModal(e){
  if(e.target === document.getElementById('noteModal')){
    document.getElementById('noteModal').classList.remove('show');
    _pendingReview = null;
  }
}

// ══════════════════════════════════════════════════════
// DELETE (labeling only)
// ══════════════════════════════════════════════════════
async function deleteItem(id){
  if(!confirm(`Delete submission #${id}? This cannot be undone.`)) return;
  const res = await fetch(`/api/qc/submissions/${id}`, {method:'DELETE'});
  const data = await res.json();
  if(res.ok && data.success){
    toast('🗑 Deleted');
    // Remove from DOM immediately
    const el = document.getElementById('item-' + id);
    if(el){ el.style.opacity='0'; el.style.transform='scale(.95)'; el.style.transition='.25s'; setTimeout(()=>el.remove(),250); }
    _lastCount = Math.max(0, (_lastCount||1) - 1);
    document.getElementById('countBadge').textContent = ((_lastCount||0)) + ' items';
  } else {
    toast(data.message || 'Delete failed', false);
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
  if(!selectedFile){ toast('Photo is required', false); return; }
  const fd = new FormData();
  fd.append('photo', selectedFile);
  fd.append('note', document.getElementById('note').value);
  const res  = await fetch('/api/qc/submissions', {method:'POST', body:fd});
  const data = await res.json();
  if(!res.ok || !data.success){ toast(data.message || 'Failed', false); return; }
  selectedFile = null;
  document.getElementById('photoPreview').classList.remove('show');
  document.getElementById('uploadLabel').textContent = 'No photo selected';
  document.getElementById('note').value = '';
  document.getElementById('photoFile').value = '';
  document.getElementById('photoCamera').value = '';
  toast('📤 Photo sent to QC!');
  loadItems();
}

// ══════════════════════════════════════════════════════
// FULLSCREEN LIGHTBOX with zoom & download
// ══════════════════════════════════════════════════════
let _lbScale = 1;
let _lbSrc   = '';

function openLightbox(src){
  _lbSrc = src;
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

// Pinch-to-zoom on mobile
(function(){
  const img = document.getElementById('lightboxImg');
  let initDist = 0;
  let initScale = 1;
  img.addEventListener('touchstart', e => {
    if(e.touches.length === 2){
      initDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
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

// Keyboard shortcuts in lightbox
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
      // Add to items list immediately
      if(!_allItems.find(x => x.id === item.id)){
        _allItems.unshift(item);
        if(role === 'qc'){
          playSound('qcalert.wav');
          showBrowserNotif('📸 New QC Submission', 'New photo waiting for review');
          toast('📸 New photo received!');
        }
        _lastCount = (_lastCount || 0) + 1;
        document.getElementById('countBadge').textContent = _allItems.length + ' items';
        renderItems(_allItems);
      }
    }catch(e){}
  });

  es.addEventListener('deleted', e => {
    try {
      const {id} = JSON.parse(e.data);
      _allItems = _allItems.filter(x => x.id !== id);
      document.getElementById('countBadge').textContent = _allItems.length + ' items';
      const el = document.getElementById('item-' + id);
      if(el){ el.style.opacity='0'; el.style.transform='scale(.95)'; el.style.transition='.25s'; setTimeout(()=>el.remove(),250); }
    }catch(e){}
  });

  es.addEventListener('status_update', e => {
    try {
      const updated = JSON.parse(e.data);
      const idx = _allItems.findIndex(x => x.id === updated.id);
      if(idx !== -1){
        const prev = _allItems[idx].status;
        _allItems[idx] = updated;
        if(role === 'labeling' && prev !== updated.status){
          playSound('lebelass.wav');
          const emoji = updated.status === 'approved' ? '✅' : updated.status === 'rejected' ? '❌' : '⏳';
          showBrowserNotif(`${emoji} Photo #${updated.id} ${updated.status.toUpperCase()}`, updated.review_note ? `Note: ${updated.review_note}` : `Marked as ${updated.status}`);
          toast(`${emoji} Photo #${updated.id} marked as ${updated.status}`);
        }
        renderItems(_allItems);
      }
    }catch(e){}
  });

  es.onerror = () => {
    es.close();
    _sseConnected = false;
    // Reconnect after 5s
    setTimeout(connectSSE, 5000);
  };
}

function startPolling(){
  loadItems();
  setInterval(loadItems, 7000);
}

// Initial load
loadItems();
// Connect SSE for instant updates
connectSSE();

// استقبال رسائل من الـ Service Worker (مثلاً نقرة على إشعار)
if('serviceWorker' in navigator){
  navigator.serviceWorker.addEventListener('message', e => {
    if(e.data?.type === 'QC_NOTIFICATION_CLICK'){
      loadItems();
    }
  });
}

document.addEventListener('visibilitychange', () => { if(!document.hidden && !_sseConnected) loadItems(); });
window.addEventListener('focus', () => { if(!_sseConnected) loadItems(); });
