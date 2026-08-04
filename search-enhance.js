/* ============================================================
   بهبود جست‌وجو و فیلتر — نسخه 2.2
   ------------------------------------------------------------
   این فایل هیچ منطق داده‌ای/فرمولی را تغییر نمی‌دهد. فقط یک لایه
   روی جست‌وجوهای موجود می‌گذارد:
     ۱) یکسان‌سازی متن (ي→ی، ك→ک، ارقام عربی/انگلیسی→فارسی معیار،
        حذف اعراب و نیم‌فاصله و فاصله اضافی) پیش از رسیدن به فیلترها
     ۲) دکمه پاک‌کردن (×) داخل هر کادر جست‌وجو
     ۳) شمارنده نتایج بالای لیست
     ۴) هایلایت عبارت جست‌وجو در نتایج
     ۵) پیمایش با کلید ↑ ↓ Enter و بستن با Esc
     ۶) تاخیر کوتاه (debounce) برای روان‌تر شدن تایپ در فهرست‌های بزرگ

   توسعه آینده: برای اضافه‌کردن کادر جست‌وجوی جدید هیچ کاری لازم نیست؛
   هر عنصری با ساختار «.search-box > input + .search-results» به‌صورت
   خودکار همین امکانات را می‌گیرد (MutationObserver پایین فایل).
   ============================================================ */
(function () {
  'use strict';

  /* ---------- ۱) یکسان‌سازی متن ---------- */
  var AR = { 'ي': 'ی', 'ك': 'ک', 'ٱ': 'ا', 'أ': 'ا', 'إ': 'ا', 'آ': 'آ', 'ة': 'ه', 'ۀ': 'ه', 'ؤ': 'و' };
  var DIGITS = { '٠': '۰', '١': '۱', '٢': '۲', '٣': '۳', '٤': '۴', '٥': '۵', '٦': '۶', '٧': '۷', '٨': '۸', '٩': '۹' };

  function normalize(str) {
    if (!str) return '';
    var out = '';
    for (var i = 0; i < str.length; i++) {
      var ch = str[i];
      if (AR[ch]) ch = AR[ch];
      else if (DIGITS[ch]) ch = DIGITS[ch];
      else if (ch >= '0' && ch <= '9') ch = String.fromCharCode(1776 + (ch.charCodeAt(0) - 48));
      var code = ch.charCodeAt(0);
      // اعراب و علائم کشیدگی حذف می‌شوند
      if ((code >= 0x064b && code <= 0x065f) || code === 0x0640 || code === 0x0670) continue;
      if (code === 0x200c || code === 0x200f || code === 0x200e) ch = ' '; // نیم‌فاصله و کنترل جهت → فاصله
      out += ch;
    }
    return out.replace(/\s+/g, ' ');
  }
  window.faNormalize = normalize; // برای استفاده در توسعه‌های آینده

  /* ---------- ابزارها ---------- */
  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function highlight(container, query) {
    var q = normalize(query).trim();
    if (!q || q.length < 2) return;
    var terms = q.split(' ').filter(function (t) { return t.length >= 2; });
    if (!terms.length) return;
    var targets = container.querySelectorAll('.sr-cat, .sr-snip, .sr-table, .sr-text');
    Array.prototype.forEach.call(targets, function (el) {
      if (el.querySelector('mark')) return;
      var html = el.innerHTML;
      terms.forEach(function (t) {
        try {
          var re = new RegExp('(' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'g');
          html = html.replace(/>([^<]+)</g, function (m, txt) {
            return '>' + txt.replace(re, '<mark class="sr-hit">$1</mark>') + '<';
          });
        } catch (e) { /* عبارت نامعتبر — بی‌صدا رد می‌شود */ }
      });
      el.innerHTML = html;
    });
  }

  function countItems(results) {
    return results.querySelectorAll('.search-result-item').length;
  }

  function setMeta(results, query) {
    var n = countItems(results);
    var meta = results.previousElementSibling;
    if (!meta || !meta.classList.contains('search-meta')) {
      meta = document.createElement('div');
      meta.className = 'search-meta';
      meta.setAttribute('role', 'status');
      meta.setAttribute('aria-live', 'polite');
      meta.setAttribute('aria-atomic', 'true');
      results.parentNode.insertBefore(meta, results);
    }
    if (!normalize(query).trim()) { meta.classList.remove('show'); meta.textContent = ''; return; }
    meta.innerHTML = n
      ? '<span class="sm-count">' + toFa(n) + '</span> نتیجه یافت شد'
      : '<span class="sm-none">نتیجه‌ای یافت نشد</span>';
    meta.classList.add('show');
  }

  function toFa(n) {
    return String(n).replace(/[0-9]/g, function (d) { return String.fromCharCode(1776 + (+d)); });
  }

  var A11Y_SEQ = 0;

  /* ---------- ۲..۶) تجهیز هر کادر جست‌وجو ---------- */
  function enhance(box) {
    if (!box || box.dataset.enhanced === '1') return;
    var input = box.querySelector('input[type="text"], input:not([type])');
    var results = box.querySelector('.search-results');
    if (!input || !results) return;
    box.dataset.enhanced = '1';

    /* ---------- دسترسی‌پذیری (a11y) ---------- */
    var uid = 'sb' + (++A11Y_SEQ);
    if (!results.id) results.id = uid + '-results';
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('aria-controls', results.id);
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('enterkeyhint', 'search');
    results.setAttribute('role', 'listbox');
    if (!results.getAttribute('aria-label')) results.setAttribute('aria-label', 'نتایج جست‌وجو');
    var lbl = box.querySelector('label');
    if (lbl) {
      if (!input.id) input.id = uid + '-input';
      if (!lbl.getAttribute('for')) lbl.setAttribute('for', input.id);
    } else if (!input.getAttribute('aria-label')) {
      input.setAttribute('aria-label', input.getAttribute('placeholder') || 'جست‌وجو');
    }
    // راهنمای کوتاه کلیدهای میان‌بر برای صفحه‌خوان‌ها
    var help = document.createElement('span');
    help.className = 'sr-only';
    help.id = uid + '-help';
    help.textContent = 'برای پیمایش نتایج از کلیدهای بالا و پایین، برای انتخاب از Enter و برای پاک کردن از Esc استفاده کنید.';
    box.appendChild(help);
    input.setAttribute('aria-describedby', help.id);

    function syncA11y() {
      var items = results.querySelectorAll('.search-result-item');
      var open = results.classList.contains('show') && items.length > 0;
      input.setAttribute('aria-expanded', open ? 'true' : 'false');
      Array.prototype.forEach.call(items, function (el, i) {
        el.setAttribute('role', 'option');
        if (!el.id) el.id = results.id + '-o' + i;
        if (el.getAttribute('tabindex') === null) el.setAttribute('tabindex', '-1');
        el.setAttribute('aria-selected', el.classList.contains('kb-active') ? 'true' : 'false');
      });
      var act = results.querySelector('.search-result-item.kb-active');
      if (act) input.setAttribute('aria-activedescendant', act.id);
      else input.removeAttribute('aria-activedescendant');
    }
    box._syncA11y = syncA11y;

    // یکسان‌سازی ورودی پیش از اجرای هندلرهای اصلی (فاز capture)
    input.addEventListener('input', function () {
      var n = normalize(input.value);
      if (n !== input.value) {
        var pos = input.selectionStart;
        input.value = n;
        try { input.setSelectionRange(pos, pos); } catch (e) {}
      }
      box.classList.toggle('has-value', !!input.value.trim());
    }, true);

    // دکمه پاک‌کردن
    var clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'search-clear';
    clear.setAttribute('aria-label', 'پاک کردن جست‌وجو');
    clear.innerHTML = '&times;';
    clear.addEventListener('click', function () {
      input.value = '';
      box.classList.remove('has-value');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus();
    });
    // input داخل یک پوشش نسبی قرار می‌گیرد تا دکمه پاک‌کردن دقیقاً روی خودش بنشیند
    var wrap = document.createElement('div');
    wrap.className = 'search-input-wrap';
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    wrap.appendChild(clear);

    // پس از اجرای هندلر اصلی: شمارنده + هایلایت
    input.addEventListener('input', function () {
      clearTimeout(input._seTimer);
      input._seTimer = setTimeout(function () {
        setMeta(results, input.value);
        highlight(results, input.value);
      }, 40);
    });

    // پیمایش با کلیدهای جهت‌دار
    input.addEventListener('keydown', function (e) {
      var items = Array.prototype.slice.call(results.querySelectorAll('.search-result-item'));
      if (e.key === 'Escape') { input.value = ''; input.dispatchEvent(new Event('input', { bubbles: true })); return; }
      if (!items.length) return;
      var cur = items.findIndex(function (el) { return el.classList.contains('kb-active'); });
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        var next = e.key === 'ArrowDown' ? (cur + 1) % items.length : (cur <= 0 ? items.length - 1 : cur - 1);
        items.forEach(function (el) { el.classList.remove('kb-active'); });
        items[next].classList.add('kb-active');
        items[next].scrollIntoView({ block: 'nearest' });
        if (box._syncA11y) box._syncA11y();
      } else if (e.key === 'Enter' && cur > -1) {
        e.preventDefault();
        items[cur].click();
      }
    });

    // هر بار محتوای نتایج عوض شد، شمارنده به‌روز شود
    new MutationObserver(function () {
      setMeta(results, input.value);
      highlight(results, input.value);
      syncA11y();
    }).observe(results, { childList: true, attributes: true, attributeFilter: ['class'] });
    syncA11y();
  }

  function enhanceAll(root) {
    (root || document).querySelectorAll('.search-box').forEach(enhance);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { enhanceAll(); });
  } else {
    enhanceAll();
  }

  // کادرهای جست‌وجویی که در آینده به‌صورت داینامیک ساخته شوند
  new MutationObserver(function (muts) {
    muts.forEach(function (m) {
      Array.prototype.forEach.call(m.addedNodes, function (n) {
        if (n.nodeType !== 1) return;
        if (n.classList && n.classList.contains('search-box')) enhance(n);
        else enhanceAll(n);
      });
    });
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
