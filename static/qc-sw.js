// ══════════════════════════════════════════════════════════════════
//  QC Service Worker — Background Push Notifications
//  يدعم: Android (Chrome/Firefox/Samsung) + iOS 16.4+ (Safari PWA)
//  الملف يُسجَّل من qc-workflow.html كـ Service Worker
// ══════════════════════════════════════════════════════════════════
const QC_SW_VERSION = 'qc-sw-v3';

// ── INSTALL ──────────────────────────────────────────────────────
self.addEventListener('install', event => {
  self.skipWaiting();
});

// ── ACTIVATE ─────────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

// ── PUSH (Web Push API — يشتغل بالخلفية على Android و iOS PWA) ──
self.addEventListener('push', event => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch(e) {
    payload = { title: 'EST-iMs QC', body: event.data ? event.data.text() : 'إشعار جديد' };
  }

  const title   = payload.title || 'EST-iMs QC 🔬';
  const options = {
    body:    payload.body    || 'يوجد تحديث جديد في قسم الجودة',
    icon:    payload.icon    || '/static/icons/icon-192.png',
    badge:   payload.badge   || '/static/icons/icon-192.png',
    tag:     payload.tag     || 'qc-notification',
    renotify: true,
    requireInteraction: payload.requireInteraction ?? false,
    data:    payload.data    || { url: '/qc-workflow' },
    vibrate: [200, 100, 200],
    actions: payload.actions || [
      { action: 'open',    title: 'فتح QC' },
      { action: 'dismiss', title: 'تجاهل' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ── NOTIFICATION CLICK ────────────────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const targetUrl = (event.notification.data && event.notification.data.url)
    ? event.notification.data.url
    : '/qc-workflow';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      // إذا في تاب مفتوح على نفس الـ URL، حوّله وركّز عليه
      for (const client of windowClients) {
        if (client.url.includes('/qc') && 'focus' in client) {
          client.postMessage({ type: 'QC_NOTIFICATION_CLICK', url: targetUrl });
          return client.focus();
        }
      }
      // افتح تاب جديد
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// ── NOTIFICATION CLOSE ────────────────────────────────────────────
self.addEventListener('notificationclose', event => {
  // يمكن إضافة تتبع هنا إذا احتجت
});

// ── MESSAGE من الصفحة — للإشعارات الداخلية (foreground polling) ──
self.addEventListener('message', event => {
  const data = event.data || {};

  // الصفحة بتطلب إرسال إشعار محلي (بديل بسيط لما Push مش مفعّل)
  if (data.type === 'SHOW_NOTIFICATION') {
    const title   = data.title   || 'EST-iMs QC';
    const options = {
      body:    data.body    || 'تحديث جديد',
      icon:    data.icon    || '/static/icons/icon-192.png',
      badge:                   '/static/icons/icon-192.png',
      tag:     data.tag     || 'qc-local',
      renotify: true,
      requireInteraction: false,
      data:    { url: data.url || '/qc-workflow' },
      vibrate: [150, 80, 150],
    };
    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  }

  // ping من الصفحة — الـ SW يرد برد حي
  if (data.type === 'PING') {
    event.source?.postMessage({ type: 'PONG', version: QC_SW_VERSION });
  }
});

// ── FETCH — Network First (لا كاش للـ QC data) ───────────────────
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  // API calls: network only — لا كاش أبداً
  if (event.request.url.includes('/api/')) return;
  // SSE stream: تجاهل
  if (event.request.url.includes('/stream')) return;
  // للبقية: network first بدون كاش (online mode)
  // لا نتدخل — الـ browser يتعامل معها مباشرة
});
