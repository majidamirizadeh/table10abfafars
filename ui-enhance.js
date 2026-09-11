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

  /* ============================================================
     نسخه ۲.۵ — بازطراحی ظاهری (بدون تغییر در داده/فرمول/مسیر ناوبری)
     ------------------------------------------------------------
     ۴) نمایش دکمه «درباره» + دکمه همبرگر + نوار تب شیشه‌ای فقط در
        صفحه اول (mainhome) — دقیقاً همان الگوی بخش ۱ (آکاردئون
        «درباره») که در بالا برای همین فایل استفاده شده است.
     ۵) باز/بسته‌شدن منوی همبرگری، هماهنگ با کلید فیزیکی برگشت
        (یک ورودی تاریخچه به‌ازای هر بار باز شدن — دقیقاً هم‌الگو
        با پاپ‌آپ راهنما در app.js).
     ۶) کلیک روی تب‌های نوار شیشه‌ای: فقط از توابع موجود ناوبری
        (showScreen / resetCalcForm) استفاده می‌شود؛ هیچ منطق
        جدیدی اضافه نشده است.
     ۷) ثبت صفحه «راهنمای کنتور» در SCREEN_META — دقیقاً به همان
        شیوه‌ای که quiz.js صفحات آزمون را ثبت می‌کند.
     ============================================================ */

  /* ---------- ۴) نمایش عناصر مخصوص صفحه اول ---------- */
  (function () {
    try {
      var brandBtn = document.getElementById('brandMark');
      var burgerBtn = document.getElementById('menuBurgerBtn');
      var tabbar = document.getElementById('glassTabbar');
      if (!brandBtn && !burgerBtn && !tabbar) return;
      var HOME_SCREENS = ['mainhome'];

      function syncHomeOnlyUI() {
        var isHome = HOME_SCREENS.some(function (id) {
          var el = document.getElementById('screen-' + id);
          return el && el.classList.contains('active');
        });
        if (brandBtn) brandBtn.style.display = isHome ? '' : 'none';
        if (burgerBtn) burgerBtn.style.display = isHome ? 'flex' : 'none';
        if (tabbar) tabbar.style.display = isHome ? 'flex' : 'none';
        document.body.classList.toggle('has-tabbar', isHome);
      }
      var screens = document.querySelectorAll('.screen');
      var obs2 = new MutationObserver(function () { syncHomeOnlyUI(); });
      Array.prototype.forEach.call(screens, function (sc) {
        obs2.observe(sc, { attributes: true, attributeFilter: ['class'] });
      });
      syncHomeOnlyUI();
    } catch (e) {}
  })();

  /* ---------- ۵) منوی همبرگری: باز/بسته‌شدن + هماهنگی با کلید برگشت ---------- */
  (function () {
    try {
      var overlay = document.getElementById('mainMenuOverlay');
      var openBtn = document.getElementById('menuBurgerBtn');
      var closeBtn = document.getElementById('mainMenuClose');
      if (!overlay || !openBtn || !closeBtn) return;

      function setOpen(isOpen) {
        overlay.classList.toggle('show', isOpen);
        openBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        document.body.style.overflow = isOpen ? 'hidden' : '';
      }
      function openMenu() {
        setOpen(true);
        try {
          var base = window.history.state || {};
          var next = {};
          for (var k in base) { if (Object.prototype.hasOwnProperty.call(base, k)) next[k] = base[k]; }
          next.mainMenu = true;
          history.pushState(next, '', location.href);
        } catch (e) {}
      }
      function closeMenu() {
        if (!overlay.classList.contains('show')) return;
        if (history.state && history.state.mainMenu) {
          history.back();
        } else {
          setOpen(false);
        }
      }
      openBtn.addEventListener('click', openMenu);
      closeBtn.addEventListener('click', closeMenu);
      overlay.addEventListener('click', function (e) { if (e.target === overlay) closeMenu(); });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && overlay.classList.contains('show')) closeMenu();
      });
      window.addEventListener('popstate', function (ev) {
        var st = ev.state || {};
        if (overlay.classList.contains('show') && !st.mainMenu) setOpen(false);
      });
    } catch (e) {}
  })();

  /* ---------- ۶) کلیک روی تب‌های نوار شیشه‌ای ---------- */
  (function () {
    try {
      var tabHome = document.getElementById('gtabHome');
      var tabQuiz = document.getElementById('gtabQuiz');
      var tabCalc = document.getElementById('gtabCalc');
      var tabMeter = document.getElementById('gtabMeter');
      if (tabHome) tabHome.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
      if (tabQuiz) tabQuiz.addEventListener('click', function () {
        if (typeof showScreen === 'function') showScreen('quizhome');
        if (typeof renderQuizHome === 'function') renderQuizHome();
      });
      if (tabCalc) tabCalc.addEventListener('click', function () {
        if (typeof resetCalcForm === 'function') resetCalcForm();
        if (typeof showScreen === 'function') showScreen('calc');
      });
      if (tabMeter) tabMeter.addEventListener('click', function () {
        if (typeof showScreen === 'function') showScreen('meter');
      });
    } catch (e) {}
  })();

  /* توجه: ثبت SCREEN_META.meter از این‌جا به فایل meter-guide.js منتقل شد
     تا کل منطق بخش «کنتور» (فهرست فصل‌ها، تصویر تعاملی، فرم پیشنهاد) در
     یک فایل مستقل و هم‌الگو با quiz.js نگه‌داری شود. */
})();
