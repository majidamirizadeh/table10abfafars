/* ============================================================
   Service Worker - آبفا پلاس (جداول الگوی مصرف)
   ------------------------------------------------------------
   نحوه انتشار نسخه جدید:
   هر بار که فایل‌های برنامه (index.html و ...) تغییر کردند،
   فقط کافیست عدد CACHE_VERSION را افزایش دهید (مثلاً v6 -> v7).
   با این کار کش قدیمی به‌طور خودکار حذف و نسخه جدید جایگزین می‌شود.
   ============================================================ */
const CACHE_VERSION = 'v27';
const CACHE_NAME = `abfaplus-tables-${CACHE_VERSION}`;

// فایل‌های اصلی برنامه (App Shell) که باید برای اجرای کامل آفلاین کش شوند
// نکته: از نسخه v11 به بعد، داده‌های جداول/آیین‌نامه/قوانین از app.js جدا شده
// و به‌صورت JSON مستقل بارگذاری می‌شوند؛ بنابراین باید اینجا هم اضافه شوند
// تا در همان مرحله نصب (install) پیش‌کش شوند و کارکرد آفلاین از همان اولین
// بازدید کامل باشد.
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './search-enhance.js',
  './ui-enhance.js',
  './quiz.js',
  './manifest.json',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png',
  './apple-touch-icon.png',
  './data/tables.json',
  './data/chapters.json',
  './data/laws.json',
  './data/tariffs.json',
  './data/quiz/index.json',
  './pdf/aeen-nameh-tarefeha.pdf',
  './pdf/jadaval-dahgane-olgooye-masraf.pdf',
  './pdf/ghavanin-ab-va-fazelab.pdf',
  './pdf/tarefeha-1405-bandha.pdf',
  './pdf/jadaval-nerkh-tarefeha-1405.pdf'
];

/* ---------------------- نصب: کش کردن App Shell ---------------------- */
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // فایل‌های بانک سؤال به‌صورت خودکار از روی data/quiz/index.json خوانده
      // می‌شوند تا افزودن/حذف بانک نیازی به ویرایش این فهرست نداشته باشد.
      const shell = APP_SHELL.slice();
      try {
        const man = await (await fetch('./data/quiz/index.json', { cache: 'reload' })).json();
        (man.sections || []).forEach((sec) => {
          if (sec && sec.file) shell.push('./data/quiz/' + sec.file);
        });
      } catch (err) {}
      // به‌جای cache.addAll (که با خطای یک فایل، کل نصب را متوقف می‌کند)
      // هر فایل جدا اضافه می‌شود تا خرابی یک مورد باعث شکست کل SW نشود
      await Promise.allSettled(
        shell.map(async (url) => {
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
   فقط برای درخواست‌های هم‌مبدأ (فایل‌های داخلی برنامه) اجرا می‌شود.

   استثناها:
   - PDF: Network-First (تا نسخه جدید از سرور بیاید؛ آفلاین از کش)
   - فایل‌های واقعی (pdf/json/تصویر/فونت/...) هرگز به index.html نگاشت نمی‌شوند
     تا باز کردن مستقیم لینک PDF باعث نمایش صفحهٔ برنامه نشود.
*/
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
  if (!isSameOrigin) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const isNavigate = request.mode === 'navigate';

      // فایل واقعی استاتیک — نباید مثل route برنامه به index.html برود
      const isPdf = /\.pdf$/i.test(url.pathname);
      const isRealFile =
        /\.(pdf|json|png|svg|jpe?g|gif|webp|woff2?|ttf|ico|css|js|map)$/i.test(url.pathname) ||
        /\/(data|pdf|fonts|splash)\//i.test(url.pathname);

      // فقط ناوبری صفحات برنامه → index.html ؛ لینک مستقیم PDF و سایر فایل‌ها دست‌نخورده
      const cacheKey = (isNavigate && !isRealFile) ? './index.html' : request;

      // ---------- PDF: Network-First ----------
      if (isPdf) {
        try {
          const fresh = await fetch(request, { cache: 'no-store' });
          if (fresh && fresh.ok) {
            cache.put(request, fresh.clone()).catch(() => {});
            return fresh;
          }
        } catch (e) {}

        const cachedPdf =
          (await cache.match(request)) ||
          (await cache.match(request, { ignoreSearch: true }));
        if (cachedPdf) return cachedPdf;

        return new Response('فایل PDF در دسترس نیست (آفلاین یا خطا در دریافت).', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      }

      // تصاویر / فونت: اگر در کش بود همان را بده (مثل قبل، بدون PDF)
      const isHeavyStatic = /\.(png|svg|woff2?|ttf)$/i.test(url.pathname);

      const cached =
        (await cache.match(cacheKey)) ||
        (await cache.match(cacheKey, { ignoreSearch: true }));

      if (cached && isHeavyStatic) return cached;

      const networkFetch = fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            cache.put(cacheKey, response.clone()).catch(() => {});
          }
          return response;
        })
        .catch(() => null);

      if (cached) {
        event.waitUntil(networkFetch);
        return cached;
      }

      const fresh = await networkFetch;
      if (fresh) return fresh;

      // آفلاین: فقط برای صفحات برنامه پوسته را بده، نه برای فایل واقعی
      if (isNavigate && !isRealFile) {
        const shell =
          (await cache.match('./index.html')) || (await cache.match('./'));
        if (shell) return shell;
      }

      return new Response(
        '<!DOCTYPE html><html lang="fa" dir="rtl"><meta charset="utf-8"><body style="font-family:Tahoma,sans-serif;text-align:center;padding:40px;">اتصال اینترنت برقرار نیست و نسخه آفلاین هنوز کامل بارگذاری نشده است.</body></html>',
        { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    })()
  );
});
