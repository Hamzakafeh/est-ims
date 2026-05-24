// qc-sw.js — EST-iMs QC Service Worker
// Handles background push notifications even when the browser is closed

const CACHE_NAME = 'qc-sw-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

// ── Background Sync polling ──────────────────────────
// Registers a periodic check so notifications fire even when browser is closed
self.addEventListener('periodicsync', event => {
  if(event.tag === 'qc-poll'){
    event.waitUntil(checkQCUpdates());
  }
});

// ── Push event (from server-sent push) ───────────────
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch(e){}
  const title = data.title || '📸 QC Alert';
  const body  = data.body  || 'New update in QC Workflow';
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/static/low.ico',
      badge: '/static/low.ico',
      tag: 'qc-alert',
      requireInteraction: true,
      vibrate: [200, 100, 200],
      data: { url: '/qc-workflow' }
    })
  );
});

// ── Notification click ────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/qc-workflow';
  event.waitUntil(
    self.clients.matchAll({type:'window', includeUncontrolled:true}).then(clients => {
      for(const client of clients){
        if(client.url.includes('/qc-workflow') && 'focus' in client){
          return client.focus();
        }
      }
      if(self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});

// ── Background polling via fetch ─────────────────────
let _lastCount    = null;
let _lastStatuses = {};

async function checkQCUpdates(){
  try {
    const res  = await fetch('/api/qc/submissions', {credentials:'include', cache:'no-store'});
    if(!res.ok) return;
    const data = await res.json();
    const items = data.items || [];
    const role  = data.role  || '';

    if(role === 'qc' && _lastCount !== null && items.length > _lastCount){
      const diff = items.length - _lastCount;
      await self.registration.showNotification('📸 New QC Submission', {
        body: `${diff} new photo${diff > 1 ? 's' : ''} waiting for review`,
        icon: '/static/low.ico', badge: '/static/low.ico',
        tag: 'qc-new', requireInteraction: true, vibrate: [200,100,200],
        data: {url:'/qc-workflow'}
      });
    }
    _lastCount = items.length;

    if(role === 'labeling' && Object.keys(_lastStatuses).length > 0){
      for(const item of items){
        const prev = _lastStatuses[item.id];
        if(prev !== undefined && prev !== item.status){
          const emoji = item.status === 'approved' ? '✅' : item.status === 'rejected' ? '❌' : '⏳';
          await self.registration.showNotification(`${emoji} Photo #${item.id} ${item.status.toUpperCase()}`, {
            body: item.review_note ? `Note: ${item.review_note}` : `Your photo was marked as ${item.status}`,
            icon: '/static/low.ico', badge: '/static/low.ico',
            tag: `qc-status-${item.id}`, requireInteraction: true, vibrate: [200,100,200],
            data: {url:'/qc-workflow'}
          });
          break;
        }
      }
    }
    for(const item of items) _lastStatuses[item.id] = item.status;

  } catch(e){ /* ignore network errors */ }
}

// ── Message from page: manual poll trigger ────────────
self.addEventListener('message', event => {
  if(event.data && event.data.type === 'QC_POLL'){
    checkQCUpdates();
  }
});
