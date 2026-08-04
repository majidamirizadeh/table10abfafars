/* ============================================================
   بهبودهای ظاهری/تجربه کاربری — نسخه 2.3
   ------------------------------------------------------------
   این فایل هیچ داده، فرمول یا منطق محاسباتی را تغییر نمی‌دهد.
   فقط یک لایه روی رابط کاربری اضافه می‌کند:
     ۱) آکاردئون «درباره» در فوتر (حفظ وضعیت باز/بسته)
     ۲) اعلام قابل‌مشاهده به‌روزرسانی Service Worker + بررسی دوره‌ای
     ۳) راهنمای مسیر (breadcrumb) شکیل زیر هدر — فقط قرص شیشه‌ای
   توسعه آینده: هر بخش زیر مستقل است؛ می‌توانید بلوک‌ها را جدا
   تغییر دهید بدون اثر روی بخش‌های دیگر.
   ============================================================ */
(function () {
  'use strict';

  /* ---------- ۱) آکاردئون «درباره» ----------
     - فقط در صفحه اصلی (mainhome) نمایش داده می‌شود.
     - با اسکرول کاربر به سمت بالای صفحه، خودکار بسته می‌شود.
     توسعه آینده: برای نمایش در صفحات دیگر، شناسه آن صفحه را به
     آرایه ABOUT_SCREENS اضافه کنید. */
  (function () {
    try {
      var acc = document.getElementById('aboutAcc');
      if (!acc) return;
      var ABOUT_SCREENS = ['mainhome'];

      /* ۳) نمایش «درباره» فقط در صفحه‌های مجاز */
      function syncVisibility() {
        var visible = ABOUT_SCREENS.some(function (id) {
          var el = document.getElementById('screen-' + id);
          return el && el.classList.contains('active');
        });
        acc.style.display = visible ? '' : 'none';
        if (!visible && acc.open) acc.open = false;
      }
      var screens = document.querySelectorAll('.screen');
      var vObs = new MutationObserver(function () { syncVisibility(); });
      Array.prototype.forEach.call(screens, function (sc) {
        vObs.observe(sc, { attributes: true, attributeFilter: ['class'] });
      });
      syncVisibility();

      /* ۴) بستن خودکار هنگام اسکرول به بالای صفحه */
      var lastY = window.scrollY || 0;
      window.addEventListener('scroll', function () {
        var y = window.scrollY || 0;
        if (acc.open) {
          var box = acc.getBoundingClientRect();
          var scrolledUp = y < lastY - 4;
          var outOfView = box.top > window.innerHeight;
          if ((scrolledUp && y < lastY - 40) || outOfView || y <= 4) acc.open = false;
        }
        lastY = y;
      }, { passive: true });

      acc.addEventListener('toggle', function () {
        if (acc.open) {
          lastY = window.scrollY || 0;
          setTimeout(function () {
            acc.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            setTimeout(function () { lastY = window.scrollY || 0; }, 500);
          }, 60);
        }
      });
    } catch (e) {}
  })();

  /* ---------- ۲) اعلام به‌روزرسانی Service Worker ---------- */
  (function () {
    try {
      var banner = document.getElementById('updateBanner');
      if (!banner) return;
      var titleEl = banner.querySelector('strong');
      var subEl = banner.querySelector('span');
      var btn = document.getElementById('updateReloadBtn');
      var shown = false;

      window.abfaAnnounceUpdate = function (kind) {
        if (shown) return;
        shown = true;
        if (kind === 'activated') {
          if (titleEl) titleEl.textContent = 'نسخه جدید برنامه آماده شد';
          if (subEl) subEl.textContent = 'برای اعمال آخرین تغییرات، روی «به‌روزرسانی» بزنید (اطلاعات شما حفظ می‌شود).';
        } else {
          if (titleEl) titleEl.textContent = 'نسخه جدیدی از برنامه در دسترس است';
          if (subEl) subEl.textContent = 'در حال دریافت به‌روزرسانی… پس از آماده شدن، همین‌جا اطلاع داده می‌شود.';
        }
        banner.classList.add('show');
        banner.setAttribute('role', 'status');
        banner.setAttribute('aria-live', 'polite');
      };

      if (btn) {
        btn.addEventListener('click', function () {
          btn.disabled = true;
          btn.textContent = 'در حال به‌روزرسانی…';
        });
      }

      if (!('serviceWorker' in navigator)) return;

      // بررسی دوره‌ای وجود نسخه جدید (بدون رفرش اجباری)
      function checkForUpdate() {
        navigator.serviceWorker.getRegistration().then(function (reg) {
          if (reg) { try { reg.update(); } catch (e) {} }
        }).catch(function () {});
      }
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') checkForUpdate();
      });
      setTimeout(checkForUpdate, 4000);
      setInterval(checkForUpdate, 30 * 60 * 1000);
    } catch (e) {}
  })();

  /* ---------- ۳) راهنمای مسیر شکیل زیر هدر ----------
     فقط قرص شیشه‌ای با نقطه‌های مسیر؛ بدون متن راهنما. */
  (function () {
    try {
      var nav = document.getElementById('stepNav');
      if (!nav) return;
      nav.classList.add('step-nav-pro');
      nav.removeAttribute('aria-hidden');
      nav.setAttribute('role', 'navigation');
      nav.setAttribute('aria-label', 'مسیر صفحه');
      var old = nav.querySelector('.step-label');
      if (old) old.remove();
    } catch (e) {}
  })();
})();
