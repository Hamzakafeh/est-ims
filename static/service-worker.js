// EST-iMs Service Worker - Online Mode
const CACHE_NAME = 'est-ims-v1';

// Only cache static assets for faster loading
const STATIC_ASSETS = [
  '/static/icons/icon-192.png',
  '/static/icons/icon-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  // Remove old caches
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network first — always get fresh data from server
self.addEventListener('fetch', event => {
  // Skip non-GET and cross-origin requests
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request).catch(() => {
      // If network fails, show offline message
      return new Response(
        `<!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head><meta charset="UTF-8"><title>EST-iMs</title>
        <style>
          body { font-family: Arial; display:flex; flex-direction:column;
                 align-items:center; justify-content:center; height:100vh;
                 margin:0; background:#f0f4f8; color:#2C5F8A; text-align:center; }
          h2 { font-size: 22px; margin-bottom: 10px; }
          p  { color: #555; font-size: 14px; }
          button { margin-top:20px; padding:10px 24px; background:#2C5F8A;
                   color:#fff; border:none; border-radius:8px; font-size:15px; cursor:pointer; }
        </style></head>
        <body>
          <h2>⚠️ لا يوجد اتصال بالإنترنت</h2>
          <p>تحقق من اتصالك وحاول مرة أخرى</p>
          <button onclick="location.reload()">إعادة المحاولة</button>
        </body></html>`,
        { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    })
  );
});
