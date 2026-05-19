# خطوات تحويل EST-iMs إلى PWA

## الملفات المطلوبة

```
your_project/
├── app.py                        ← محدّث (جاهز)
├── static/
│   ├── manifest.json             ← انسخه هون
│   ├── service-worker.js         ← انسخه هون
│   └── icons/
│       ├── icon-192.png          ← انسخه هون
│       └── icon-512.png          ← انسخه هون
```

---

## الخطوة 1 — انسخ الملفات

ضع الملفات المرفقة في مجلد `static/` كما هو موضح أعلاه.

---

## الخطوة 2 — أضف هذا الكود في `<head>` داخل login.html و index.html

```html
<!-- PWA -->
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#2C5F8A">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="EST-iMs">
<link rel="apple-touch-icon" href="/static/icons/icon-192.png">

<script>
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js')
      .then(() => console.log('SW registered'))
      .catch(err => console.log('SW error:', err));
  }
</script>
```

---

## الخطوة 3 — تنصيب التطبيق على الهاتف

1. افتح المتصفح (Chrome) على الهاتف
2. اذهب لرابط السيستم تبعك
3. اضغط على **⋮ (النقاط الثلاث)** في أعلى يمين المتصفح
4. اختر **"Add to Home screen"** أو **"Install App"**
5. اضغط **Install**

التطبيق هيظهر على الشاشة الرئيسية زي أي تطبيق عادي! ✅

---

## ملاحظات

- السيستم لازم يشتغل على **HTTPS** أو **localhost** عشان الـ PWA تشتغل
- لو السيستم على شبكة داخلية (LAN) تأكد إن الهاتف متصل بنفس الشبكة
- الـ PWA بتشتغل على Android Chrome بشكل ممتاز
