/* ============================================================
   Service Worker - آب و فاضلاب استان فارس (جداول الگوی مصرف)
   ------------------------------------------------------------
   نحوه انتشار نسخه جدید:
   هر بار که فایل‌های برنامه (index.html و ...) تغییر کردند،
   فقط کافیست عدد CACHE_VERSION را افزایش دهید (مثلاً v6 -> v7).
   با این کار کش قدیمی به‌طور خودکار حذف و نسخه جدید جایگزین می‌شود.
   ============================================================ */
const CACHE_VERSION = 'v7';
const CACHE_NAME = `abfa-fars-tables-${CACHE_VERSION}`;

// فایل‌های اصلی برنامه (App Shell) که باید برای اجرای کامل آفلاین کش شوند
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg'
];

// دامنه‌های فونت گوگل که به‌صورت پویا (Runtime) کش می‌شوند
const RUNTIME_HOSTS = new Set(['fonts.googleapis.com', 'fonts.gstatic.com']);

/* ---------------------- نصب: کش کردن App Shell ---------------------- */
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // به‌جای cache.addAll (که با خطای یک فایل، کل نصب را متوقف می‌کند)
      // هر فایل جدا اضافه می‌شود تا خرابی یک مورد باعث شکست کل SW نشود
      await Promise.allSettled(
        APP_SHELL.map(async (url) => {
          try {
            const req = new Request(url, { cache: 'reload' });
            const res = await fetch(req);
            if (res && res.ok) {
              await cache.put(url, res.clone());
            }
          } catch (err) {
            // در صورت نبود اینترنت هنگام نصب، بی‌صدا رد می‌شود
            // (کاربر در بازدید بعدی با اینترنت، کش کامل می‌شود)
          }
        })
      );
    })()
  );
  self.skipWaiting();
});

/* ------------------- فعال‌سازی: حذف نسخه‌های قدیمی کش ------------------- */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

/* --------- دریافت پیام از صفحه برای فعال‌سازی فوری نسخه جدید --------- */
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

/* ------------------------- استراتژی واکشی ------------------------- */
/* Stale-While-Revalidate: پاسخ کش‌شده فوراً نمایش داده می‌شود (سرعت بالا)
   و هم‌زمان نسخه جدید از شبکه گرفته و برای دفعه بعد در کش ذخیره می‌شود.
   برای فایل‌های داخلی برنامه و همچنین فونت‌های گوگل (کراس-اورجین) کار می‌کند. */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch (e) {
    return;
  }

  // فقط درخواست‌های http/https را مدیریت کن (chrome-extension و... نادیده گرفته شود)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  const isSameOrigin = url.origin === self.location.origin;
  const isKnownRuntimeHost = RUNTIME_HOSTS.has(url.hostname);
  if (!isSameOrigin && !isKnownRuntimeHost) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      // برای درخواست‌های ناوبری (باز شدن مستقیم صفحه)، اگر در کش نبود از index.html استفاده کن
      const cacheKey = request.mode === 'navigate' ? './index.html' : request;
      const cached = await cache.match(request.mode === 'navigate' ? './index.html' : request);

      const networkFetch = fetch(request)
        .then((response) => {
          // پاسخ‌های موفق (200) یا opaque (فونت‌های کراس-اورجین بدون CORS) کش می‌شوند
          if (response && (response.status === 200 || response.type === 'opaque')) {
            cache.put(request.mode === 'navigate' ? './index.html' : request, response.clone());
          }
          return response;
        })
        .catch(() => null);

      if (cached) {
        // پاسخ فوری از کش + به‌روزرسانی خاموش در پس‌زمینه
        event.waitUntil(networkFetch);
        return cached;
      }

      // اگر در کش نبود، منتظر شبکه بمان؛ در صورت شکست کامل، خطا برگردان
      const fresh = await networkFetch;
      if (fresh) return fresh;

      // آخرین راه‌حل برای ناوبری آفلاین بدون کش قبلی: پاسخ خطای قابل کنترل
      return new Response(
        '<!DOCTYPE html><html lang="fa" dir="rtl"><meta charset="utf-8"><body style="font-family:Tahoma,sans-serif;text-align:center;padding:40px;">اتصال اینترنت برقرار نیست و نسخه آفلاین هنوز کامل بارگذاری نشده است.</body></html>',
        { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    })()
  );
});
