/* ============================================================
   meter-guide.js — راهنمای کنتور (تب چهارم صفحه اول)
   ------------------------------------------------------------
   این ماژول کاملاً مستقل است و هیچ بخشی از منطق قبلی برنامه را
   تغییر نمی‌دهد (دقیقاً هم‌الگو با quiz.js). تنها از دو امکان
   موجود استفاده می‌کند:
     • SCREEN_META  (ثبت صفحه «meter»)
     • showScreen() (فقط برای خواندن currentScreen از طریق کلاس‌ها)
   داده‌های این بخش (مرجع فنی، نقاط داغ تصویر، سؤالات فرم پیشنهاد)
   از data/meter-guide.json خوانده می‌شود؛ افزودن/ویرایش محتوا فقط
   یعنی ویرایش همان فایل JSON، نه این فایل.
   سه پنل داخلی (مرجع فنی / شناخت صفحه / پیشنهاد کنتور) با تب‌های
   محلی جابه‌جا می‌شوند و به تاریخچه مرورگر چیزی اضافه نمی‌کنند؛
   دکمه فیزیکی برگشت همیشه از کل صفحه «کنتور» خارج می‌شود.
   ============================================================ */
(function () {
  'use strict';

  try {
    if (typeof SCREEN_META !== 'undefined') {
      SCREEN_META.meter = {
        theme: 'neutral', icon: '📟',
        title: 'راهنمای کنتور', sub: 'مرجع فنی، شناخت صفحه و پیشنهاد کنتور',
        back: true, parent: 'mainhome', help: false
      };
    }
  } catch (e) {}

  const $ = (id) => document.getElementById(id);
  const faNum = (n) => String(n).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }
  function nl2br(s) { return esc(s).replace(/\n/g, '<br>'); }

  let DATA = null;
  let loaded = false, loading = false;
  let activeTechChapter = null;
  let activeHotspotKey = null;
  const advAnswers = {};

  /* ==================== بارگذاری داده (تنبل، فقط یک‌بار) ==================== */
  function ensureLoaded() {
    if (loaded || loading) return;
    const root = $('screen-meter');
    if (!root) return;
    loading = true;
    const loadingEl = $('meterLoading'), errEl = $('meterLoadError');
    if (loadingEl) loadingEl.style.display = 'flex';
    if (errEl) errEl.hidden = true;
    fetch('./data/meter-guide.json')
      .then((res) => { if (!res.ok) throw new Error('network'); return res.json(); })
      .then((json) => {
        DATA = json; loaded = true; loading = false;
        if (loadingEl) loadingEl.style.display = 'none';
        renderTechList();
        renderDial();
        renderAdvisor();
      })
      .catch((err) => {
        loading = false;
        console.error('خطا در بارگذاری راهنمای کنتور:', err);
        if (loadingEl) loadingEl.style.display = 'none';
        if (errEl) errEl.hidden = false;
      });
  }

  /* ==================== تب‌های محلی صفحه کنتور ==================== */
  function switchMeterTab(tab) {
    document.querySelectorAll('.meter-subtab').forEach((b) => {
      const on = b.dataset.mtab === tab;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    document.querySelectorAll('.meter-panel').forEach((p) => {
      p.classList.toggle('active', p.dataset.mpanel === tab);
    });
  }
  document.querySelectorAll('.meter-subtab').forEach((btn) => {
    btn.addEventListener('click', () => switchMeterTab(btn.dataset.mtab));
  });
  const retryBtn = $('meterRetryBtn');
  if (retryBtn) retryBtn.addEventListener('click', ensureLoaded);

  /* بارگذاری فقط وقتی صفحه «کنتور» واقعاً فعال می‌شود (هم‌الگو با بخش‌های افزودنی دیگر) */
  (function () {
    const scr = $('screen-meter');
    if (!scr) return;
    const obs = new MutationObserver(() => { if (scr.classList.contains('active')) ensureLoaded(); });
    obs.observe(scr, { attributes: true, attributeFilter: ['class'] });
    if (scr.classList.contains('active')) ensureLoaded();
  })();

  /* ==================================================================
     پنل ۱ — مرجع فنی کنتور
     ================================================================== */
  function blockHtml(b) {
    switch (b.type) {
      case 'h4': return `<h4 class="tech-h4">${esc(b.text)}</h4>`;
      case 'p': return `<p class="tech-p">${esc(b.text)}</p>`;
      case 'formula': return `<div class="tech-formula">${esc(b.text)}</div>`;
      case 'callout': return `<div class="tech-callout ${b.tone === 'warn' ? 'warn' : 'info'}">${b.tone === 'warn' ? '⚠️' : 'ℹ️'} ${esc(b.text)}</div>`;
      case 'list': return `<ul class="tech-list">${b.items.map((it) => `<li>${esc(it)}</li>`).join('')}</ul>`;
      case 'table': {
        const head = `<tr>${b.cols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr>`;
        const rows = b.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('');
        return `<div class="data-table-wrap tech-table-wrap"><table class="data-table tech-data-table"><thead>${head}</thead><tbody>${rows}</tbody></table></div>`;
      }
      default: return '';
    }
  }

  function renderTechList() {
    const wrap = $('meterTechList');
    if (!wrap || !DATA) return;
    const tr = DATA.techRef;
    wrap.innerHTML = `
      <p class="home-intro">${esc(tr.subtitle)}</p>
      <div class="tech-disclaimer">📖 ${esc(tr.disclaimer)}</div>
      <div id="techChapterGrid"></div>
      <div class="tech-callout info" style="margin:14px 0;">${tr.closingNote.map((n) => '💡 ' + esc(n)).join('<br><br>')}</div>
      <h5 class="tech-standards-title">📚 اسناد استاندارد مرجع</h5>
      <div class="data-table-wrap tech-table-wrap">
        <table class="data-table tech-data-table">
          <thead><tr>${tr.standards.cols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead>
          <tbody>${tr.standards.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
      </div>
    `;
    const grid = $('techChapterGrid');
    grid.innerHTML = tr.chapters.map((c) => `
      <div class="table-card" data-cid="${c.id}">
        <div class="icon">${faNum(c.id)}</div>
        <div class="info">
          <h3>فصل ${faNum(c.id)} — ${esc(c.title)}</h3>
          <span>${esc(c.goals)}</span>
        </div>
        <div class="chev">‹</div>
      </div>`).join('');
    Array.from(grid.children).forEach((el) => {
      el.onclick = () => openTechChapter(parseInt(el.dataset.cid, 10));
    });
  }

  function openTechChapter(id) {
    if (!DATA) return;
    const c = DATA.techRef.chapters.find((x) => x.id === id);
    if (!c) return;
    const wasInDetail = activeTechChapter !== null;
    activeTechChapter = id;
    $('meterTechList').hidden = true;
    const detail = $('meterTechDetail');
    detail.hidden = false;
    detail.innerHTML = `
      <button type="button" class="tech-back-link" id="techBackBtn">← بازگشت به فهرست فصل‌ها</button>
      <div class="tech-chapter-head">
        <div class="tech-chapter-num">فصل ${faNum(c.id)}</div>
        <h2>${esc(c.title)}</h2>
        <p class="tech-goals">🎯 ${esc(c.goals)}</p>
      </div>
      <div class="tech-blocks">${c.blocks.map(blockHtml).join('')}</div>
      <div class="tech-summary">
        <h5>جمع‌بندی فصل</h5>
        <ul>${c.summary.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
      </div>
      <div class="tech-chapter-nav">
        ${id > 1 ? `<button type="button" class="btn-mini" id="techPrevBtn">‹ فصل قبل</button>` : '<span></span>'}
        ${id < DATA.techRef.chapters.length ? `<button type="button" class="btn-mini" id="techNextBtn">فصل بعد ›</button>` : '<span></span>'}
      </div>
    `;
    $('techBackBtn').onclick = backToTechList;
    const prevBtn = $('techPrevBtn'); if (prevBtn) prevBtn.onclick = () => openTechChapter(id - 1);
    const nextBtn = $('techNextBtn'); if (nextBtn) nextBtn.onclick = () => openTechChapter(id + 1);
    detail.scrollIntoView({ behavior: 'smooth', block: 'start' });

    /* یکپارچگی با کلید فیزیکی برگشت: اولین ورود به یک فصل، یک ورودی
       تاریخچه اضافه می‌کند؛ جابه‌جایی بین فصل‌ها (قبل/بعد) همان ورودی
       را جایگزین می‌کند تا کلید برگشت همیشه با یک بار فشردن، دقیقاً
       به «فهرست فصل‌ها» برگردد، نه به خانه و نه فصل‌به‌فصل. */
    try {
      const base = window.history.state || {};
      const next = {};
      for (const k in base) { if (Object.prototype.hasOwnProperty.call(base, k)) next[k] = base[k]; }
      next.techChapter = id;
      if (wasInDetail) history.replaceState(next, '', location.href);
      else history.pushState(next, '', location.href);
    } catch (e) {}
  }
  function backToTechList() {
    if (history.state && history.state.techChapter) {
      history.back();
    } else {
      resetTechToList();
    }
  }
  function resetTechToList() {
    activeTechChapter = null;
    $('meterTechDetail').hidden = true;
    $('meterTechList').hidden = false;
  }
  window.addEventListener('popstate', (ev) => {
    const st = ev.state || {};
    if (activeTechChapter !== null && !st.techChapter) resetTechToList();
  });

  /* برای استفاده از سایر پنل‌ها: پرش مستقیم به یک فصل خاص مرجع فنی */
  function jumpToTechChapter(id) {
    switchMeterTab('tech');
    $('meterTechList').hidden = false;
    openTechChapter(id);
  }

  /* ==================================================================
     پنل ۲ — شناخت صفحه کنتور (تصویر تعاملی + نقاط داغ نئونی)
     ================================================================== */
  function renderDial() {
    const root = $('meterDialRoot');
    if (!root || !DATA) return;
    const d = DATA.dial;
    const cats = [...new Set(d.hotspots.map(h => h.category))];
    const uid = 'dialMask_' + Date.now().toString(36);

    // مختصات نقاط داغ عمداً در همان فضای مختصات خود تصویر نگه داشته می‌شوند.
    // بنابراین با تغییر رزولوشن، DPR یا اندازه موبایل، نسبت انتخاب به تصویر ثابت می‌ماند.
    const shapeFor = (h, fill = 'white') => {
      const x = h.x, y = h.y, w = h.w, hh = h.h;
      if (h.shape === 'circle') {
        return `<ellipse cx="${x + w / 2}" cy="${y + hh / 2}" rx="${w / 2}" ry="${hh / 2}" fill="${fill}"/>`;
      }
      return `<rect x="${x}" y="${y}" width="${w}" height="${hh}" rx="0.7" fill="${fill}"/>`;
    };
    const maskAll = `<rect x="0" y="0" width="100" height="100" fill="white"/>`;

    root.innerHTML = `
      <div class="dial-professional-head">
        <div>
          <p class="home-intro" style="margin-bottom:4px;">شناخت دقیق صفحه و علائم کنتور</p>
          <p class="dial-guide-note">دسته موردنظر را انتخاب کنید، سپس دقیقاً روی همان علامت روی تصویر بزنید. در حالت فیلتر، فقط آیتم‌های همان دسته رنگی و روشن می‌مانند و کل تصویر در پس‌زمینه سیاه‌وسفید می‌شود.</p>
        </div>
      </div>
      <div class="dial-category-filter" id="dialCategoryFilter">
        <button type="button" class="dial-filter-chip active" data-cat="all">همه موارد</button>
        ${cats.map(c => `<button type="button" class="dial-filter-chip" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}
      </div>
      <div class="dial-frame" id="dialFrame" style="aspect-ratio:${d.ratio};">
        <div class="dial-canvas" id="dialCanvas">
          <svg class="dial-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <filter id="${uid}_gray" x="-5%" y="-5%" width="110%" height="110%">
                <feColorMatrix type="saturate" values="0"/>
              </filter>
              <mask id="${uid}" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
                ${maskAll}
              </mask>
            </defs>
            <image class="dial-svg-img dial-svg-gray" href="${esc(d.image)}" x="0" y="0" width="100" height="100" preserveAspectRatio="none" filter="url(#${uid}_gray)"/>
            <image class="dial-svg-img dial-svg-color" id="dialColorImage" href="${esc(d.image)}" x="0" y="0" width="100" height="100" preserveAspectRatio="none" mask="url(#${uid})"/>
          </svg>
          <div class="dial-hotspot-layer">
            ${d.hotspots.map((h) => `
              <button type="button" class="dial-hotspot ${h.shape === 'circle' ? 'is-circle' : 'is-rect'}"
                data-key="${esc(h.key)}" data-cat="${esc(h.category)}"
                style="left:${h.x}%;top:${h.y}%;width:${h.w}%;height:${h.h}%;"
                aria-label="${esc(h.title)}">
                <span class="dial-hotspot-label">${esc(h.label)}</span>
              </button>
            `).join('')}
          </div>
        </div>
        <div class="dial-dim" id="dialDim"></div>
      </div>
      <div class="dial-info-card" id="dialInfoCard">
        <div class="dial-info-empty">👆 یک دسته یا یکی از علائم روی تصویر را انتخاب کنید.</div>
      </div>
    `;

    const frame = $('dialFrame');
    const canvas = $('dialCanvas');
    const mask = document.getElementById(uid);
    const setMask = (cat) => {
      if (!mask) return;
      if (cat === 'all') {
        mask.innerHTML = maskAll;
        return;
      }
      mask.innerHTML = d.hotspots
        .filter(h => h.category === cat)
        .map(h => shapeFor(h, 'white'))
        .join('');
    };
    setMask('all');

    Array.from(frame.querySelectorAll('.dial-hotspot')).forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.classList.contains('is-hidden')) return;
        if (activeHotspotKey === btn.dataset.key) clearHotspot();
        else selectHotspot(btn.dataset.key);
      });
    });

    const filter = $('dialCategoryFilter');
    Array.from(filter.querySelectorAll('.dial-filter-chip')).forEach(chip => {
      chip.addEventListener('click', () => {
        const cat = chip.dataset.cat;
        Array.from(filter.querySelectorAll('.dial-filter-chip')).forEach(c => c.classList.toggle('active', c === chip));
        setMask(cat);
        Array.from(frame.querySelectorAll('.dial-hotspot')).forEach(h => {
          const show = cat === 'all' || h.dataset.cat === cat;
          h.classList.toggle('is-hidden', !show);
        });
        clearHotspot();
      });
    });
  }

  function selectHotspot(key) {
    if (!DATA) return;
    const d = DATA.dial;
    const h = d.hotspots.find((x) => x.key === key);
    if (!h) return;
    activeHotspotKey = key;

    const frame = $('dialFrame');
    const cx = h.x + h.w / 2, cy = h.y + h.h / 2;
    const dim = $('dialDim');
    dim.style.setProperty('--fx', cx + '%');
    dim.style.setProperty('--fy', cy + '%');
    // اسپات‌لایت فقط یک حلقه ظریف پیرامون همان آیتم است؛ دیگر از یک
    // دایره بزرگ که خارج از محدوده آیتم قرار می‌گیرد استفاده نمی‌شود.
    const frameW = frame.clientWidth || frame.offsetWidth || 1;
    const frameH = frame.clientHeight || Math.round(frameW / (d.ratio || 1));
    const halfDiag = Math.sqrt(Math.pow((h.w / 100) * frameW / 2, 2) + Math.pow((h.h / 100) * frameH / 2, 2));
    const radius = Math.max(12, halfDiag + 5);
    dim.style.setProperty('--fr', radius + 'px');
    dim.style.setProperty('--frInner', Math.max(8, halfDiag - 2) + 'px');
    frame.classList.add('focus');

    const card = $('dialInfoCard');
    card.innerHTML = `
      <div class="dial-info-chip">${esc(h.category)}</div>
      <h4>${esc(h.title)}</h4>
      <p>${esc(h.body)}</p>
      <div class="dial-info-actions">
        <button type="button" class="btn-mini" id="dialGotoChapterBtn">📘 مرجع فنی — فصل ${faNum(h.chapter)}</button>
      </div>
    `;
    $('dialGotoChapterBtn').onclick = () => jumpToTechChapter(h.chapter);
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  function clearHotspot() {
    activeHotspotKey = null;
    const frame = $('dialFrame');
    if (frame) frame.classList.remove('focus');
    const card = $('dialInfoCard');
    if (card) card.innerHTML = `<div class="dial-info-empty">👆 برای شروع، یکی از قسمت‌های نشان‌داده‌شده روی تصویر را لمس کنید. با لمس دوباره همان نقطه، انتخاب لغو می‌شود.</div>`;
  }

  /* ==================================================================
     پنل ۳ — پیشنهاد کنتور (فرم + موتور پیشنهاد قانونمند)
     ================================================================== */
  function renderAdvisor() {
    const root = $('meterAdvisorRoot');
    if (!root || !DATA) return;
    const a = DATA.advisor;
    root.innerHTML = `
      <p class="home-intro">${esc(a.intro)}</p>
      <div id="advGroups"></div>
      <button type="button" class="calc-btn adv-submit-btn" id="advSubmitBtn">🧭 دریافت پیشنهاد</button>
      <div id="advResultWrap"></div>
    `;
    const groupsWrap = $('advGroups');
    groupsWrap.innerHTML = a.groups.map((g, idx) => `
      <div class="adv-group">
        <div class="adv-group-head">
          <span class="adv-group-num">${faNum(idx + 1)}</span>
          <span class="adv-group-ico">${g.icon || '📋'}</span>
          <h4>${esc(g.title)}</h4>
        </div>
        <div class="adv-group-body">
          ${g.questions.map((q) => renderQuestion(q)).join('')}
        </div>
      </div>
    `).join('');

    a.groups.forEach((g) => g.questions.forEach((q) => {
      if (q.type === 'select') {
        const wrap = $('q_' + q.key);
        if (!wrap) return;
        Array.from(wrap.querySelectorAll('.choice-chip')).forEach((chip) => {
          chip.addEventListener('click', () => {
            advAnswers[q.key] = chip.dataset.v;
            Array.from(wrap.querySelectorAll('.choice-chip')).forEach((c) => c.classList.toggle('selected', c === chip));
          });
        });
      } else if (q.type === 'number') {
        const inp = $('q_' + q.key);
        if (!inp) return;
        inp.addEventListener('input', () => { advAnswers[q.key] = inp.value; });
      }
    }));

    $('advSubmitBtn').onclick = () => {
      const result = computeRecommendation(advAnswers);
      renderRecommendationResult(result);
    };
  }

  function renderQuestion(q) {
    if (q.type === 'select') {
      return `
        <div class="field">
          <label>${esc(q.label)}</label>
          <div class="choice-group" id="q_${q.key}">
            ${q.options.map((o) => `<button type="button" class="choice-chip" data-v="${o.v}">${esc(o.t)}</button>`).join('')}
          </div>
        </div>`;
    }
    if (q.type === 'number') {
      return `
        <div class="field">
          <label>${esc(q.label)}</label>
          <input type="number" inputmode="decimal" id="q_${q.key}" placeholder="${esc(q.placeholder || '')}" min="${q.min ?? 0}" ${q.step ? `step="${q.step}"` : ''}>
        </div>`;
    }
    return '';
  }

  /* ---------------- موتور پیشنهاد (قانونمند، بر مبنای مقادیر رسمی استاندارد) ---------------- */
  const STD_Q3 = [1, 1.6, 2.5, 4, 6.3, 10, 16, 25, 40, 63, 100, 160, 250, 400, 630, 1000, 1600, 2500, 4000, 6300];
  const STD_R = [40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1000];
  function snapUp(list, val) {
    for (let i = 0; i < list.length; i++) if (list[i] >= val - 1e-9) return list[i];
    return list[list.length - 1];
  }
  function dnFromQ3(q3) {
    if (q3 <= 2.5) return 15;
    if (q3 <= 4) return 20;
    if (q3 <= 6.3) return 25;
    if (q3 <= 10) return 32;
    if (q3 <= 16) return 40;
    if (q3 <= 25) return 50;
    if (q3 <= 40) return 65;
    if (q3 <= 63) return 80;
    return 100;
  }

  function computeRecommendation(ans) {
    const usageType = ans.usageType || 'res1';
    const unitCount = Math.max(1, parseInt(ans.unitCount, 10) || 1);
    const meterShared = ans.meterShared || 'individual';
    const monthlyVolume = Math.max(0, parseFloat(ans.monthlyVolume) || 0);
    const peakHourlyFlow = Math.max(0, parseFloat(ans.peakHourlyFlow) || 0);
    const minFlow = Math.max(0, parseFloat(ans.minFlow) || 0);
    const peakFactorRaw = ans.peakFactor;
    const peakFactor = ['1.5','2','3','4'].includes(peakFactorRaw) ? parseFloat(peakFactorRaw) : null;
    const lowNightFlow = ans.lowNightFlow || 'unknown';
    const pattern = (lowNightFlow === 'yes' || ans.meterArchitecture === 'wide') ? 'wide' : 'normal';
    const pressure = ans.pressure || 'unknown';
    const waterTemp = ans.waterTemp || 'cold';
    const waterQuality = ans.waterQuality || 'clean';
    const lengthLimit = ans.lengthLimit || 'unknown';
    const disturbance = ans.disturbance || 'unknown';
    const orientation = ans.orientation || 'both';
    const fullPipe = ans.fullPipe || 'unknown';
    const reverseFlow = ans.reverseFlow || 'unknown';
    const meterArchitecture = ans.meterArchitecture || 'unknown';
    const accuracyPriority = ans.accuracyPriority || 'normal';
    const amr = ans.amr || 'no';
    const tamperDetect = ans.tamperDetect || 'no';
    const budget = ans.budget || 'standard';
    const pipeDN = ans.pipeDN || 'unknown';
    const location = ans.location || 'unknown';
    const freezeRisk = ans.freezeRisk || 'unknown';
    const serviceContinuity = ans.serviceContinuity || 'normal';
    const measurementTechnology = ans.measurementTechnology || 'unknown';
    const historicalData = ans.historicalData || 'unknown';

    const avgHourly = monthlyVolume > 0 ? monthlyVolume / (30 * 24) : 0;
    let designFlow = peakHourlyFlow;
    if (!designFlow && avgHourly && peakFactor) designFlow = avgHourly * peakFactor;
    if (!designFlow && avgHourly) designFlow = avgHourly * 2;
    if (!designFlow) {
      const fallbackByType = {
        res1:1.5, resN:2.5, comSmall:2.5, comBig:6.3, institutional:6.3,
        industrialSmall:10, industrialLarge:25, irrigation:16, bulk:40
      };
      designFlow = fallbackByType[usageType] || 2.5;
      if (meterShared === 'shared' && unitCount > 1) designFlow *= (1 + 0.35 * (Math.sqrt(unitCount) - 1));
    }
    if (pattern === 'wide' && !peakHourlyFlow) designFlow *= 1.15;
    const q3 = snapUp(STD_Q3, Math.max(0.1, designFlow));

    let rBase = 100;
    if (accuracyPriority === 'high' || pattern === 'wide' || usageType === 'comBig' ||
        usageType === 'institutional' || usageType === 'industrialSmall' ||
        usageType === 'industrialLarge' || usageType === 'irrigation' || usageType === 'bulk') rBase = 160;
    if (accuracyPriority === 'critical') rBase = 200;
    const r = snapUp(STD_R, rBase);
    const q1 = q3 / r;
    const q2 = 1.6 * q1;
    const q4 = 1.25 * q3;

    const dnFromFlow = (q) => {
      if (q <= 2.5) return 15;
      if (q <= 4) return 20;
      if (q <= 6.3) return 25;
      if (q <= 10) return 32;
      if (q <= 16) return 40;
      if (q <= 25) return 50;
      if (q <= 40) return 65;
      if (q <= 63) return 80;
      if (q <= 100) return 100;
      if (q <= 160) return 125;
      if (q <= 250) return 150;
      if (q <= 400) return 200;
      if (q <= 630) return 250;
      if (q <= 1000) return 300;
      if (q <= 1600) return 400;
      if (q <= 2500) return 500;
      return 600;
    };
    let dn = dnFromFlow(q3);
    if (pipeDN !== 'unknown') dn = parseInt(pipeDN,10);

    let dpClass = pressure === 'low' ? 16 : pressure === 'mid' ? 40 : 63;
    if (pressure === 'unknown') dpClass = 63;
    const tClass = waterTemp === 'hot' ? 50 : 30;

    const needsStraightener = disturbance === 'yes' || lengthLimit === 'yes';
    let udClass, udNote;
    if (needsStraightener) {
      udClass = 'طبق کلاس نصب تأییدشده سازنده + بررسی Straightener';
      udNote = 'به‌علت اغتشاش یا محدودیت طول مستقیم، کلاس نصب U/D و امکان استفاده از Flow Straightener باید دقیقاً از Type Approval و دستورالعمل نصب همان مدل انتخاب شود؛ صرفاً حدس‌زدن U0/D0 کافی نیست.';
    } else if (lengthLimit === 'no' && disturbance === 'no') {
      udClass = 'U0/D0 یا کلاس تأییدشده مدل';
      udNote = 'فضای مستقیم کافی و نبود منبع اغتشاش گزارش شده است؛ با این حال U/D نهایی باید با کلاس نصب درج‌شده در گواهی/دیتاشیت مدل منتخب تطبیق داده شود.';
    } else {
      udClass = 'نیازمند بررسی محل نصب';
      udNote = 'برای انتخاب قطعی، فاصله واقعی بالادست/پایین‌دست و تجهیزات مجاور باید مشخص شود.';
    }

    const orientationText = orientation === 'h' ? 'افقی (H)' :
      orientation === 'v' ? 'عمودی (V)' : 'افقی یا عمودی — فقط طبق تأیید مدل';

    let architectureTitle = 'کنتور تک (Single) با Q3 مناسب';
    let architectureNote = 'برای یک خط با دامنه دبی معمولی، کنتور تک با Q3 و R مناسب گزینه اولیه است.';
    if (pattern === 'wide' || lowNightFlow === 'yes' || (minFlow > 0 && minFlow < q1)) {
      architectureTitle = 'بررسی کنتور با R بالاتر یا کنتور ترکیبی (Combination)';
      architectureNote = 'به‌دلیل دامنه وسیع بین کمترین و بیشترین دبی، انتخاب صرفاً بر اساس Q3 کافی نیست. باید Q1، R و در صورت نیاز کنتور ترکیبی/آرایش مناسب با نقطه تغییر دبی در دیتاشیت بررسی شود.';
    }
    if (meterArchitecture === 'wide') architectureTitle = 'پیشنهاد اولیه: بررسی Combination Meter';

    let smartTitle, smartNote;
    const wantsSmart = amr === 'yes' || tamperDetect === 'yes' || budget === 'advanced';
    if (wantsSmart) {
      smartTitle = budget === 'advanced' ? 'کنتور هوشمند با ارتباط و ثبت رخداد' : 'کنتور با خروجی/ارتباط مناسب AMR/AMI';
      smartNote = 'نوع ارتباط، باتری، ثبت رخداد، تشخیص دستکاری و پروتکل باید در مشخصات همان مدل و الزامات پروژه بررسی شود؛ فناوری ارتباطی به‌تنهایی معیار انتخاب Q3 نیست.';
    } else {
      smartTitle = 'کنتور استاندارد بدون نیاز اجباری به ارتباط';
      smartNote = 'در صورت نیاز آتی به قرائت از راه دور، قابلیت Pulse/پورت یا ماژول سازگار را هنگام خرید بررسی کنید.';
    }

    const notes = [];
    if (monthlyVolume > 0) notes.push(`میانگین مصرف محاسبه‌شده از حجم ماهانه: ${faNum(avgHourly.toFixed(3))} m³/h؛ حجم ماهانه به‌تنهایی برای تعیین Q3 کافی نیست و دبی اوج ساعتی اهمیت دارد.`);
    if (peakHourlyFlow > 0 && peakHourlyFlow > q3) notes.push('دبی اوج واردشده از Q3 انتخاب‌شده بیشتر است؛ این مورد باید در انتخاب مدل/قطر بازبینی شود.');
    if (minFlow > 0 && minFlow < q1) notes.push('دبی کمینه واردشده پایین‌تر از Q1 محاسبه‌شده است؛ برای این کاربرد R بالاتر یا راهکار اندازه‌گیری ترکیبی باید بررسی شود.');
    if (fullPipe === 'no') notes.push('اگر لوله در محل کنتور کاملاً پر نباشد، اندازه‌گیری می‌تواند نامعتبر شود؛ محل نصب باید اصلاح شود.');
    if (reverseFlow === 'yes') notes.push('احتمال جریان برگشتی وجود دارد؛ نیاز به راهکار کنترل/تشخیص جریان برگشتی طبق مدل و دستورالعمل نصب بررسی شود.');
    if (waterQuality === 'sediment') notes.push('وجود ذرات/رسوب می‌تواند بر عملکرد اثر بگذارد؛ حفاظت و صافی مناسب طبق دستورالعمل سازنده بررسی شود.');
    if (waterQuality === 'aggressive') notes.push('برای آب خورنده یا شرایط خاص، جنس قطعات در تماس با آب و سازگاری متریال باید از دیتاشیت سازنده کنترل شود.');
    if (freezeRisk === 'yes') notes.push('در خطر یخ‌زدگی، حفاظت محیطی و شرایط نصب باید مطابق دستورالعمل سازنده تأمین شود.');
    if (pipeDN !== 'unknown' && parseInt(pipeDN,10) !== dn) notes.push(`قطر لوله موجود DN${faNum(pipeDN)} با قطر غربالگری‌شده DN${faNum(dn)} متفاوت است؛ انتخاب نهایی باید افت فشار، سرعت، اتصالات و مدل واقعی را هم بررسی کند.`);
    if (usageType === 'industrialLarge' || usageType === 'bulk') notes.push('برای صنعتی بزرگ/عمده، انتخاب نهایی باید با دبی طراحی، پروفایل جریان، فشار کاری، افت فشار مجاز، کلاس دقت و Type Approval مدل منتخب انجام شود؛ این فرم فقط پیش‌انتخاب است.');
    if (serviceContinuity === 'critical') notes.push('تداوم اندازه‌گیری حیاتی است؛ ذخیره‌سازی داده در قطع برق، وضعیت باتری و ثبت رخدادها را در مشخصات فنی بررسی کنید.');
    if (measurementTechnology !== 'unknown') notes.push('فناوری اندازه‌گیری ترجیحی: ' + (measurementTechnology === 'mechanical' ? 'مکانیکی' : measurementTechnology === 'ultrasonic' ? 'اولتراسونیک' : 'الکترومغناطیسی') + '. انتخاب نهایی باید با توجه به دامنه دبی، کیفیت آب، شرایط نصب، الزامات مترولوژیکی و Type Approval همان مدل انجام شود.');
    if (historicalData === 'yes') notes.push('ثبت تاریخچه مصرف موردنیاز است؛ وجود دیتالاگر/پروفایل، ظرفیت حافظه، بازه نمونه‌برداری، نگهداری داده هنگام قطع برق و امکان استخراج داده باید در مشخصات فنی مدل بررسی شود.');

    return {
      q3, r, q1, q2, q4, dn, dpClass, tClass, udClass, udNote, orientationText,
      architectureTitle, architectureNote, smartTitle, smartNote, notes,
      monthlyVolume, avgHourly, peakHourlyFlow, minFlow, measurementTechnology, historicalData
    };
  }
  function renderRecommendationResult(res) {
    const wrap = $('advResultWrap');
    wrap.innerHTML = `
      <div class="adv-result-card">
        <h4>🧭 پیشنهاد آموزشی مشخصات کنتور</h4>
        <div class="adv-result-grid">
          <div class="adv-result-item"><span>مترولوژی</span><b>Q3 = ${faNum(res.q3)} m³/h &nbsp;|&nbsp; R${faNum(res.r)}</b></div>
          <div class="adv-result-item"><span>Q1 / Q2</span><b>${faNum(res.q1.toFixed(3))} / ${faNum(res.q2.toFixed(3))} m³/h</b></div>
          <div class="adv-result-item"><span>Q4</span><b>${faNum(res.q4.toFixed(3))} m³/h</b></div>
          <div class="adv-result-item"><span>هیدرولیک</span><b>DN${faNum(res.dn)} &nbsp;|&nbsp; Δp${faNum(res.dpClass)}</b></div>
          <div class="adv-result-item"><span>دما</span><b>T${faNum(res.tClass)}</b></div>
          <div class="adv-result-item"><span>کلاس نصب</span><b>${esc(res.udClass)}</b></div>
          <div class="adv-result-item"><span>جهت نصب</span><b>${esc(res.orientationText)}</b></div>
        </div>
        <div class="adv-result-note">📊 حجم ماهانه: ${res.monthlyVolume ? faNum(res.monthlyVolume.toFixed(1)) + ' m³' : 'ثبت نشده'} &nbsp;|&nbsp; دبی اوج: ${res.peakHourlyFlow ? faNum(res.peakHourlyFlow.toFixed(2)) + ' m³/h' : 'ثبت نشده'}</div>
        <div class="adv-result-note">📐 ${esc(res.udNote)}</div>
        <div class="adv-result-smart"><h5>${esc(res.architectureTitle)}</h5><p>${esc(res.architectureNote)}</p></div>
        <div class="adv-result-smart">
          <h5>${esc(res.smartTitle)}</h5>
          <p>${esc(res.smartNote)}</p>
        </div>
        <div class="adv-result-smart">
          <h5>فناوری و تاریخچه داده</h5>
          <p>فناوری ترجیحی: ${esc(res.measurementTechnology === 'mechanical' ? 'مکانیکی' : res.measurementTechnology === 'ultrasonic' ? 'اولتراسونیک' : res.measurementTechnology === 'electromagnetic' ? 'الکترومغناطیسی' : 'نامشخص')} &nbsp;|&nbsp; ثبت داده تاریخی: ${esc(res.historicalData === 'yes' ? 'لازم است' : res.historicalData === 'no' ? 'لازم نیست' : 'نامشخص')}</p>
        </div>
        ${res.notes.length ? `<div class="adv-result-notes"><h5>نکات تکمیلی</h5><ul>${res.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul></div>` : ''}
        <div class="tech-callout warn">⚠️ این خروجی صرفاً یک پیشنهاد آموزشی بر مبنای پارامترهای عمومی مرجع فنی است و جایگزین دیتاشیت سازنده، گواهی تأیید نوع (Type Approval) و مقررات رسمی آبفا نیست.</div>
        <button type="button" class="btn-mini" id="advGotoTechBtn">📘 مطالعه مرجع فنی کامل</button>
      </div>
    `;
    $('advGotoTechBtn').onclick = () => jumpToTechChapter(2);
    wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
})();
