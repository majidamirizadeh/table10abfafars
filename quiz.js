/* ============================================================
   quiz.js — سامانه تعیین سطح امور مشترکین
   ------------------------------------------------------------
   این ماژول کاملاً مستقل است و هیچ بخشی از منطق قبلی برنامه را
   تغییر نمی‌دهد. تنها از دو امکان موجود استفاده می‌کند:
     • SCREEN_META  (افزودن صفحات جدید آزمون)
     • showScreen() (ناوبری یکپارچه)

   افزودن سؤال یا بخش جدید بدون تغییر کد:
     ۱) فایل JSON بخش را در پوشه data/quiz/ بسازید
     ۲) یک عضو به آرایه sections در data/quiz/index.json اضافه کنید
   سهم هر بخش در هر آزمون به نسبت تعداد سؤالات همان بخش و به‌صورت
   خودکار محاسبه می‌شود (روش بزرگ‌ترین باقی‌مانده).
   ============================================================ */
(function () {
  'use strict';

  const BASE = './data/quiz/';
  const HISTORY_KEY = 'abfaplus_quiz_history_v1';
  const HISTORY_MAX = 100;

  /* ---------------------- ابزار کمکی محلی ---------------------- */
  const $ = (id) => document.getElementById(id);
  const faNum = (n) => String(n).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function pickRandom(arr, n) {
    return shuffle(arr).slice(0, Math.max(0, Math.min(n, arr.length)));
  }

  /* ---------------------- وضعیت ماژول ---------------------- */
  const state = {
    manifest: null,
    banks: null,        // { sectionId: [questions] }
    loading: false,
    exam: null,         // { items:[{...}], startedAt }
    lastResult: null
  };

  /* ---------------------- بارگذاری بانک سؤال ---------------------- */
  async function loadBank() {
    if (state.banks) return true;
    if (state.loading) return false;
    state.loading = true;
    try {
      const man = await (await fetch(BASE + 'index.json', { cache: 'no-cache' })).json();
      const banks = {};
      await Promise.all(
        (man.sections || []).map(async (sec) => {
          try {
            const data = await (await fetch(BASE + sec.file, { cache: 'no-cache' })).json();
            const list = Array.isArray(data) ? data : (data.questions || []);
            banks[sec.id] = list.filter((q) => q && q.q && Array.isArray(q.options) && q.options.length > 1);
          } catch (e) {
            banks[sec.id] = [];
          }
        })
      );
      state.manifest = man;
      state.banks = banks;
      return true;
    } catch (e) {
      state.manifest = null;
      state.banks = null;
      return false;
    } finally {
      state.loading = false;
    }
  }

  /* --------- تخصیص نسبتی سهم هر بخش (روش بزرگ‌ترین باقی‌مانده) --------- */
  function allocate(sections, banks, total) {
    const avail = sections.map((s) => ({ id: s.id, n: (banks[s.id] || []).length }));
    const sum = avail.reduce((a, b) => a + b.n, 0);
    if (!sum) return {};
    const target = Math.min(total, sum);
    const raw = avail.map((s) => ({ id: s.id, n: s.n, exact: (s.n * target) / sum }));
    const out = {};
    let used = 0;
    raw.forEach((s) => {
      const base = Math.min(s.n, Math.floor(s.exact));
      out[s.id] = base;
      used += base;
    });
    // توزیع باقی‌مانده بر اساس بزرگ‌ترین کسر اعشاری
    const rest = raw
      .map((s) => ({ id: s.id, n: s.n, frac: s.exact - Math.floor(s.exact) }))
      .sort((a, b) => b.frac - a.frac || b.n - a.n);
    let guard = 0;
    while (used < target && guard < 1000) {
      let moved = false;
      for (const s of rest) {
        if (used >= target) break;
        if (out[s.id] < s.n) { out[s.id]++; used++; moved = true; }
      }
      if (!moved) break;
      guard++;
    }
    return out;
  }

  /* ---------------------- ساخت یک آزمون تازه ---------------------- */
  function buildExam() {
    const man = state.manifest;
    const perExam = Number(man.questionsPerExam) || 15;
    const quota = allocate(man.sections || [], state.banks, perExam);
    let items = [];
    (man.sections || []).forEach((sec) => {
      const bank = state.banks[sec.id] || [];
      pickRandom(bank, quota[sec.id] || 0).forEach((q) => {
        const opts = shuffle(q.options.map((text, i) => ({ text, correct: i === Number(q.answer) })));
        items.push({
          sectionId: sec.id,
          sectionTitle: sec.short || sec.title,
          sectionIcon: sec.icon || '📄',
          q: q.q,
          explain: q.explain || '',
          options: opts,
          correctIndex: opts.findIndex((o) => o.correct),
          chosen: null
        });
      });
    });
    items = shuffle(items);
    return { items, startedAt: Date.now() };
  }

  function levelFor(score) {
    const levels = (state.manifest && state.manifest.levels) || [];
    const sorted = levels.slice().sort((a, b) => Number(b.min) - Number(a.min));
    return sorted.find((l) => score >= Number(l.min)) || { title: '—', icon: '📄', color: 'teal', note: '' };
  }

  /* ---------------------- سوابق (آفلاین) ---------------------- */
  function readHistory() {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }
  function writeHistory(arr) {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(arr.slice(0, HISTORY_MAX))); } catch (e) {}
  }
  function addHistory(rec) { const a = readHistory(); a.unshift(rec); writeHistory(a); }
  function faDateTime(ts) {
    const d = new Date(ts);
    try {
      const date = d.toLocaleDateString('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit' });
      const time = d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
      return { date, time };
    } catch (e) { return { date: String(ts), time: '' }; }
  }

  /* ---------------------- صفحه خانه آزمون ---------------------- */
  async function renderHome() {
    const box = $('quizHomeStats');
    if (!box) return;
    box.innerHTML = '<div class="quiz-loading">در حال بارگذاری بانک سؤالات…</div>';
    const ok = await loadBank();
    if (!ok) {
      box.innerHTML = '<div class="quiz-error">بارگذاری بانک سؤالات ممکن نشد. اتصال اینترنت را بررسی کنید یا برنامه را دوباره باز کنید.</div>';
      return;
    }
    const man = state.manifest;
    const perExam = Number(man.questionsPerExam) || 15;
    const quota = allocate(man.sections || [], state.banks, perExam);
    const total = (man.sections || []).reduce((a, s) => a + (state.banks[s.id] || []).length, 0);

    let rows = (man.sections || []).map((s) => {
      const n = (state.banks[s.id] || []).length;
      return '<div class="quiz-sec-row">' +
        '<span class="quiz-sec-ico">' + esc(s.icon || '📄') + '</span>' +
        '<span class="quiz-sec-name">' + esc(s.title) + '</span>' +
        '<span class="quiz-sec-nums"><b>' + faNum(quota[s.id] || 0) + '</b> از ' + faNum(n) + '</span>' +
        '</div>';
    }).join('');

    box.innerHTML =
      '<div class="quiz-stat-grid">' +
        '<div class="quiz-stat"><b>' + faNum(total) + '</b><span>سؤال در بانک</span></div>' +
        '<div class="quiz-stat"><b>' + faNum(perExam) + '</b><span>سؤال در هر آزمون</span></div>' +
        '<div class="quiz-stat"><b>' + faNum((man.sections || []).length) + '</b><span>سرفصل</span></div>' +
      '</div>' +
      '<div class="quiz-sec-list"><div class="quiz-sec-head">سهم هر سرفصل در آزمون (به‌صورت نسبی و خودکار)</div>' + rows + '</div>';

    const lvl = (man.levels || []).slice().sort((a, b) => Number(b.min) - Number(a.min));
    const lvlBox = $('quizLevelsBox');
    if (lvlBox) {
      lvlBox.innerHTML = lvl.map((l) => {
        const label = Number(l.min) > 0 ? faNum(l.min) + ' نمره و بالاتر' : 'کمتر از ' + faNum((lvl[lvl.length - 2] && lvl[lvl.length - 2].min) || 7) + ' نمره';
        return '<div class="quiz-level-row lvl-' + esc(l.color || 'teal') + '">' +
          '<span class="quiz-level-ico">' + esc(l.icon || '📄') + '</span>' +
          '<span class="quiz-level-title">' + esc(l.title) + '</span>' +
          '<span class="quiz-level-range">' + label + '</span></div>';
      }).join('');
    }

    const hist = readHistory();
    const hb = $('quizHomeHistoryHint');
    if (hb) hb.textContent = hist.length ? 'تا کنون ' + faNum(hist.length) + ' آزمون در این دستگاه ثبت شده است.' : 'هنوز آزمونی در این دستگاه ثبت نشده است.';
  }

  /* ---------------------- صفحه آزمون ---------------------- */
  async function startExam() {
    const ok = await loadBank();
    if (!ok) { alert('بانک سؤالات بارگذاری نشد.'); return; }
    state.exam = buildExam();
    if (!state.exam.items.length) { alert('سؤالی برای شروع آزمون یافت نشد.'); return; }
    renderPlay();
    showScreen('quizplay');
  }

  function renderPlay() {
    const wrap = $('quizPlayWrap');
    if (!wrap || !state.exam) return;
    wrap.innerHTML = state.exam.items.map((it, qi) => {
      const opts = it.options.map((o, oi) =>
        '<button type="button" class="quiz-opt' + (it.chosen === oi ? ' selected' : '') + '" data-q="' + qi + '" data-o="' + oi + '">' +
          '<span class="quiz-opt-mark">' + faNum(oi + 1) + '</span>' +
          '<span class="quiz-opt-text">' + esc(o.text) + '</span>' +
        '</button>'
      ).join('');
      return '<div class="quiz-card" id="quizQ' + qi + '">' +
        '<div class="quiz-card-head"><span class="quiz-qnum">سؤال ' + faNum(qi + 1) + '</span>' +
        '<span class="quiz-qtag">' + esc(it.sectionIcon) + ' ' + esc(it.sectionTitle) + '</span></div>' +
        '<p class="quiz-qtext">' + esc(it.q) + '</p>' +
        '<div class="quiz-opts">' + opts + '</div>' +
        '</div>';
    }).join('');
    updateProgress();
  }

  function updateProgress() {
    if (!state.exam) return;
    const total = state.exam.items.length;
    const done = state.exam.items.filter((i) => i.chosen !== null).length;
    const bar = $('quizProgressFill');
    const txt = $('quizProgressText');
    if (bar) bar.style.width = (total ? (done / total) * 100 : 0) + '%';
    if (txt) txt.textContent = 'پاسخ داده‌شده: ' + faNum(done) + ' از ' + faNum(total);
    const btn = $('quizSubmitBtn');
    if (btn) btn.textContent = done < total ? 'ثبت نهایی آزمون (' + faNum(total - done) + ' سؤال بی‌پاسخ)' : '✅ ثبت نهایی آزمون';
  }

  function onPlayClick(e) {
    const btn = e.target.closest('.quiz-opt');
    if (!btn || !state.exam) return;
    const qi = Number(btn.dataset.q);
    const oi = Number(btn.dataset.o);
    const item = state.exam.items[qi];
    if (!item) return;
    item.chosen = (item.chosen === oi) ? null : oi; // امکان تغییر یا لغو انتخاب تا قبل از ثبت نهایی
    const card = $('quizQ' + qi);
    if (card) card.querySelectorAll('.quiz-opt').forEach((b) => {
      b.classList.toggle('selected', Number(b.dataset.o) === item.chosen);
    });
    updateProgress();
  }

  /* ---------------------- ثبت و نتیجه ---------------------- */
  function submitExam() {
    if (!state.exam) return;
    const total = state.exam.items.length;
    const unanswered = state.exam.items.filter((i) => i.chosen === null).length;
    if (unanswered && !confirm('برای ' + faNum(unanswered) + ' سؤال پاسخی انتخاب نکرده‌اید. آزمون ثبت شود؟')) return;
    const score = state.exam.items.filter((i) => i.chosen === i.correctIndex).length;
    const percent = total ? Math.round((score / total) * 100) : 0;
    const lvl = levelFor(score);
    state.lastResult = { score, total, percent, level: lvl, at: Date.now(), items: state.exam.items };
    addHistory({
      at: state.lastResult.at,
      score, total, percent,
      level: lvl.title, icon: lvl.icon || '📄', color: lvl.color || 'teal'
    });
    renderResult();
    showScreen('quizresult');
  }

  function renderResult() {
    const r = state.lastResult;
    if (!r) return;
    const head = $('quizResultHead');
    const dt = faDateTime(r.at);
    if (head) {
      head.className = 'quiz-result-head lvl-' + (r.level.color || 'teal');
      head.innerHTML =
        '<div class="quiz-result-ico">' + esc(r.level.icon || '📄') + '</div>' +
        '<div class="quiz-result-score"><b>' + faNum(r.score) + '</b><span>از ' + faNum(r.total) + '</span></div>' +
        '<div class="quiz-result-ring"><span>' + faNum(r.percent) + '٪</span><small>درصد موفقیت</small></div>' +
        '<div class="quiz-result-level">سطح شما: <b>' + esc(r.level.title) + '</b></div>' +
        '<p class="quiz-result-note">' + esc(r.level.note || '') + '</p>' +
        '<div class="quiz-result-bar"><span style="width:' + r.percent + '%"></span></div>' +
        '<div class="quiz-result-date">📅 ' + esc(dt.date) + ' — 🕒 ' + esc(dt.time) + '</div>';
    }

    // کارنامه هر سرفصل
    const per = {};
    r.items.forEach((it) => {
      per[it.sectionTitle] = per[it.sectionTitle] || { icon: it.sectionIcon, ok: 0, n: 0 };
      per[it.sectionTitle].n++;
      if (it.chosen === it.correctIndex) per[it.sectionTitle].ok++;
    });
    const secBox = $('quizResultSections');
    if (secBox) {
      secBox.innerHTML = '<div class="quiz-sec-head">کارنامه سرفصل‌ها</div>' +
        Object.keys(per).map((k) => {
          const p = per[k];
          const pc = Math.round((p.ok / p.n) * 100);
          return '<div class="quiz-sec-row"><span class="quiz-sec-ico">' + esc(p.icon) + '</span>' +
            '<span class="quiz-sec-name">' + esc(k) + '</span>' +
            '<span class="quiz-sec-nums"><b>' + faNum(p.ok) + '</b> از ' + faNum(p.n) + ' (' + faNum(pc) + '٪)</span></div>';
        }).join('');
    }

    const wrap = $('quizReviewWrap');
    if (!wrap) return;
    wrap.innerHTML = r.items.map((it, qi) => {
      const isRight = it.chosen === it.correctIndex;
      const opts = it.options.map((o, oi) => {
        let cls = 'quiz-rev-opt';
        let badge = '';
        if (oi === it.correctIndex) { cls += ' correct'; badge = '<span class="quiz-badge ok">✔️</span>'; }
        if (it.chosen === oi && oi !== it.correctIndex) { cls += ' wrong'; badge = '<span class="quiz-badge no">❌</span>'; }
        if (it.chosen === oi) cls += ' chosen';
        return '<div class="' + cls + '"><span class="quiz-opt-text">' + esc(o.text) + '</span>' + badge +
          (it.chosen === oi ? '<span class="quiz-yours">پاسخ شما</span>' : '') + '</div>';
      }).join('');
      return '<div class="quiz-card quiz-rev-card ' + (isRight ? 'is-right' : (it.chosen === null ? 'is-blank' : 'is-wrong')) + '">' +
        '<div class="quiz-card-head"><span class="quiz-qnum">سؤال ' + faNum(qi + 1) + '</span>' +
        '<span class="quiz-qtag">' + esc(it.sectionIcon) + ' ' + esc(it.sectionTitle) + '</span>' +
        '<span class="quiz-rev-flag">' + (isRight ? '✔️ صحیح' : (it.chosen === null ? '➖ بی‌پاسخ' : '❌ نادرست')) + '</span></div>' +
        '<p class="quiz-qtext">' + esc(it.q) + '</p>' +
        '<div class="quiz-rev-opts">' + opts + '</div>' +
        (it.explain ? '<div class="quiz-explain"><b>توضیح:</b> ' + esc(it.explain) + '</div>' : '') +
        '</div>';
    }).join('');
  }

  /* ---------------------- صفحه سوابق ---------------------- */
  function renderHistory() {
    const wrap = $('quizHistoryWrap');
    if (!wrap) return;
    const hist = readHistory();
    if (!hist.length) {
      wrap.innerHTML = '<div class="quiz-empty">هنوز آزمونی ثبت نشده است. پس از انجام نخستین آزمون، نتیجه آن به‌صورت آفلاین در همین دستگاه ذخیره می‌شود.</div>';
      const c = $('quizHistoryClearBtn'); if (c) c.hidden = true;
      const s = $('quizHistorySummary'); if (s) s.innerHTML = '';
      return;
    }
    const c = $('quizHistoryClearBtn'); if (c) c.hidden = false;
    const best = Math.max.apply(null, hist.map((h) => h.percent || 0));
    const avg = Math.round(hist.reduce((a, h) => a + (h.percent || 0), 0) / hist.length);
    const s = $('quizHistorySummary');
    if (s) {
      s.innerHTML = '<div class="quiz-stat-grid">' +
        '<div class="quiz-stat"><b>' + faNum(hist.length) + '</b><span>آزمون ثبت‌شده</span></div>' +
        '<div class="quiz-stat"><b>' + faNum(best) + '٪</b><span>بهترین نتیجه</span></div>' +
        '<div class="quiz-stat"><b>' + faNum(avg) + '٪</b><span>میانگین</span></div>' +
        '</div>';
    }
    wrap.innerHTML = hist.map((h, i) => {
      const dt = faDateTime(h.at);
      return '<div class="quiz-hist-row lvl-' + esc(h.color || 'teal') + '">' +
        '<span class="quiz-hist-ico">' + esc(h.icon || '📄') + '</span>' +
        '<div class="quiz-hist-info">' +
          '<b>' + esc(h.level || '') + '</b>' +
          '<span>' + faNum(h.score) + ' از ' + faNum(h.total) + ' — ' + faNum(h.percent) + '٪</span>' +
          '<small>📅 ' + esc(dt.date) + ' — 🕒 ' + esc(dt.time) + '</small>' +
        '</div>' +
        '<button type="button" class="quiz-hist-del" data-i="' + i + '" aria-label="حذف این نتیجه">🗑</button>' +
        '</div>';
    }).join('');
  }

  function onHistoryClick(e) {
    const del = e.target.closest('.quiz-hist-del');
    if (!del) return;
    const i = Number(del.dataset.i);
    const hist = readHistory();
    if (i >= 0 && i < hist.length && confirm('این نتیجه حذف شود؟')) {
      hist.splice(i, 1);
      writeHistory(hist);
      renderHistory();
    }
  }

  /* ---------------------- ثبت صفحات و رویدادها ---------------------- */
  function register() {
    if (typeof SCREEN_META === 'undefined' || typeof showScreen !== 'function') return;
    SCREEN_META.quizhome = { theme: 'blue', icon: '🎓', title: 'سامانه تعیین سطح امور مشترکین', sub: 'آزمون تصادفی ۱۵ سؤالی از بانک سؤالات تخصصی', back: true, parent: 'mainhome' };
    SCREEN_META.quizplay = { theme: 'teal', icon: '📝', title: 'آزمون در جریان', sub: 'به همه سؤال‌ها پاسخ دهید و سپس ثبت کنید', back: true, parent: 'quizhome', help: false };
    SCREEN_META.quizresult = { theme: 'green', icon: '📊', title: 'نتیجه آزمون', sub: 'نمره، درصد موفقیت و پاسخ‌های صحیح', back: true, parent: 'quizhome', help: false };
    SCREEN_META.quizhistory = { theme: 'orange', icon: '🗂️', title: 'سوابق نتایج آزمون', sub: 'ذخیره‌شده به‌صورت آفلاین در همین دستگاه', back: true, parent: 'quizhome', help: false };

    const goQuiz = $('goQuiz');
    if (goQuiz) goQuiz.onclick = () => { showScreen('quizhome'); renderHome(); };

    const startBtn = $('quizStartBtn');
    if (startBtn) startBtn.onclick = startExam;

    const histBtn = $('quizHistoryBtn');
    if (histBtn) histBtn.onclick = () => { renderHistory(); showScreen('quizhistory'); };

    const playWrap = $('quizPlayWrap');
    if (playWrap) playWrap.addEventListener('click', onPlayClick);

    const submit = $('quizSubmitBtn');
    if (submit) submit.onclick = submitExam;

    const cancel = $('quizCancelBtn');
    if (cancel) cancel.onclick = () => {
      if (confirm('آزمون فعلی رها شود؟ پاسخ‌های انتخاب‌شده ذخیره نمی‌شود.')) {
        state.exam = null;
        showScreen('quizhome');
        renderHome();
      }
    };

    const again = $('quizAgainBtn');
    if (again) again.onclick = startExam;

    const toHist = $('quizResultHistoryBtn');
    if (toHist) toHist.onclick = () => { renderHistory(); showScreen('quizhistory'); };

    const histWrap = $('quizHistoryWrap');
    if (histWrap) histWrap.addEventListener('click', onHistoryClick);

    const clearBtn = $('quizHistoryClearBtn');
    if (clearBtn) clearBtn.onclick = () => {
      if (confirm('همه سوابق نتایج آزمون پاک شود؟ این عمل قابل بازگشت نیست.')) {
        writeHistory([]);
        renderHistory();
      }
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', register);
  } else {
    register();
  }
})();
