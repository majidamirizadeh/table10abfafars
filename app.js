

/* ===== بخش ۱: تابع فوتر (به‌روزرسانی تاریخ، اشتراک‌گذاری برنامه) ===== */
document.getElementById('lastUpdate').textContent =
    new Date(document.lastModified).toLocaleDateString('fa-IR', { year:'numeric', month:'long', day:'numeric' });

  (function(){
    try{
      const shareAppBtn = document.getElementById('shareAppBtn');
      if(!shareAppBtn) return;
      const APP_URL = 'https://majidamirizadeh.github.io/table10abfafars/';
      shareAppBtn.addEventListener('click', async ()=>{
        if(navigator.share){
          try{
            await navigator.share({title:'آب و فاضلاب استان فارس', text:'جداول الگوی مصرف و ماشین‌حساب آب و فاضلاب استان فارس', url:APP_URL});
            return;
          }catch(e){
            if(e && e.name === 'AbortError') return; // کاربر خودش انصراف داد؛ کاری انجام نشود
            // در غیر این صورت به روش کپی ادامه بده
          }
        }
        try{
          await navigator.clipboard.writeText(APP_URL);
          const prevText = shareAppBtn.textContent;
          shareAppBtn.textContent = '✔ لینک در کلیپ‌بورد کپی شد';
          setTimeout(()=> shareAppBtn.textContent = prevText, 1600);
        }catch(e){
          window.prompt('برنامه‌ای برای اشتراک‌گذاری یا دسترسی به کلیپ‌بورد یافت نشد؛ لینک زیر را کپی کنید:', APP_URL);
        }
      });
    }catch(e){}
  })();


/* ===== بخش ۲: منطق اصلی برنامه (داده جداول، آیین‌نامه، قوانین، ناوبری، ماشین‌حساب، ثبت Service Worker) ===== */
/* =========================================================================
   داده جداول دهگانه
   ------------------------------------------------------------------------
   ⚠️ به‌خاطر حجم زیاد، ردیف‌های هر جدول فعلاً خالی (rows: []) گذاشته شده‌اند.
   جای هر جدول (باکس/کارت آن در فهرست) حفظ شده و بعداً می‌توانید rows هر
   جدول را با همان ساختار قبلی (row, category, unit, literPerDay,
   m3PerMonth, minMonthly, extra, desc, composite) پر کنید. هیچ بخش دیگری
   از کد نیاز به تغییر ندارد.
   ========================================================================= */
let TABLES = [];

/* =========================================================================
   داده هفت فصل آیین‌نامه — شماره‌گذاری بندها دقیقاً مطابق متن اصلی (۴-۱ تا ۴-۶۴)
   ========================================================================= */
let CHAPTERS = [];

/* ========================= ابزار کمکی مشترک ========================= */
const fa = n => Number(n).toLocaleString('fa-IR', {maximumFractionDigits:3});
const rialFa = n => Math.round(n).toLocaleString('fa-IR');
function toFa(n){
  const map={'0':'۰','1':'۱','2':'۲','3':'۳','4':'۴','5':'۵','6':'۶','7':'۷','8':'۸','9':'۹'};
  return String(n).replace(/[0-9]/g, d=>map[d]);
}
function escapeHtml(s){
  return s.replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
function escapeRegExp(s){ return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }
function normalizeDigits(s){ return toFa(s); }
function highlight(text, q){
  const safe = escapeHtml(text);
  if(!q) return safe;
  const re = new RegExp('('+escapeRegExp(escapeHtml(q))+')','gi');
  return safe.replace(re, '<mark>$1</mark>');
}

/* ========================= ناوبری یکپارچه بین صفحات ========================= */
const SCREEN_META = {
  mainhome: { theme:'neutral', icon:'💧', title:'آب و فاضلاب استان فارس', sub:'آیین‌نامه، جداول مصرف و ماشین‌حساب', back:false, parent:null },
  tables:   { theme:'green',   icon:'💧', title:'جداول دهگانه الگوی مصرف', sub:'ظرفیت قراردادی بر اساس نوع کاربری', back:true, parent:'mainhome' },
  table:    { theme:'green',   icon:'💧', back:true, parent:'tables', help:false },
  regs:     { theme:'blue',    icon:'📘', title:'آیین‌نامه آب و فاضلاب', sub:'هفت فصل آیین‌نامه عملیاتی و شرایط تعرفه‌ها', back:true, parent:'mainhome' },
  chapter:  { theme:'blue',    icon:'📘', back:true, parent:'regs', help:false },
  calc:     { theme:'orange',  icon:'🧮', title:'ماشین‌حساب مصرف و صورتحساب', sub:'محاسبه حجم و مبلغ بر اساس جداول دهگانه', back:true, parent:'mainhome' },
  lawshome: { theme:'orange',  icon:'📜', title:'قوانین مهم آب و فاضلاب', sub:'سه قانون کلیدی حوزه آب و فاضلاب', back:true, parent:'mainhome' },
  lawschapter: { theme:'orange', icon:'📜', back:true, parent:'lawshome', help:false },
};
let currentScreen = 'mainhome';

function showScreen(name, opts){
  opts = opts || {};
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById('screen-'+name).classList.add('active');
  currentScreen = name;
  const meta = SCREEN_META[name];
  const header = document.getElementById('appbar');
  header.className = 'appbar theme-' + meta.theme;
  document.getElementById('brandMark').textContent = meta.icon;
  if(meta.title) document.getElementById('headerTitle').textContent = meta.title;
  if(meta.sub) document.getElementById('headerSub').textContent = meta.sub;
  document.getElementById('backBtn').classList.toggle('show', !!meta.back);
  const brandHelpBtn = document.getElementById('brandMark');
  if(brandHelpBtn) brandHelpBtn.style.display = (meta.help === false) ? 'none' : '';
  window.scrollTo(0,0);
  updateStepNav(name);
  // به‌ازای هر پیمایش به داخل برنامه، دقیقاً یک ورودی به تاریخچه مرورگر اضافه می‌شود
  // (مگر آنکه این فراخوانی خودِ نتیجه یک popstate/برگشت باشد، که در آن صورت نباید دوباره push شود)
  if(opts.push !== false){
    try{ history.pushState({screen:name, infoModal:false, installModal:false}, '', location.href); }catch(e){}
  }
}

/* ---------- نشانگر پله‌ای مسیر: خط عمودی + دایره‌ها کنار صفحه ----------
   هر چه کاربر در عمق صفحات (زیرصفحه‌ها) جلوتر می‌رود، دایره‌های بیشتری
   رنگ می‌شوند. عمق و مسیر از همان SCREEN_META محاسبه می‌شود، بدون هیچ
   داده یا state جدید، و بدون اثر روی سرعت یا منطق ناوبری فعلی. */
const STEP_THEME_COLOR = { neutral:'var(--teal)', green:'var(--green)', blue:'var(--blue)', orange:'var(--orange)' };
function updateStepNav(name){
  const nav = document.getElementById('stepNav');
  if(!nav) return;
  // ساخت زنجیره از ریشه (mainhome) تا صفحه فعلی با دنبال‌کردن parent
  const chain = [];
  let cur = name;
  let guard = 0;
  while(cur && SCREEN_META[cur] && guard < 12){
    chain.unshift(cur);
    cur = SCREEN_META[cur].parent;
    guard++;
  }
  // در صفحه اصلی، پله‌ای برای نمایش وجود ندارد
  if(chain.length <= 1){
    nav.classList.remove('show');
    nav.innerHTML = '';
    return;
  }
  const color = STEP_THEME_COLOR[SCREEN_META[name].theme] || 'var(--accent)';
  const lastIndex = chain.length - 1;
  let html = '';
  chain.forEach((scr, i)=>{
    const filled = i <= lastIndex; // همه پله‌های طی‌شده تا اینجا رنگ می‌شوند
    const isCurrent = i === lastIndex;
    html += '<span class="step-dot' + (filled ? ' filled' : '') + (isCurrent ? ' current' : '') +
      '" style="--step-color:' + color + '" title="' + escapeHtml((SCREEN_META[scr].title) || scr) + '"></span>';
    if(i < lastIndex){
      html += '<span class="step-line filled" style="--step-color:' + color + '"></span>';
    }
  });
  nav.innerHTML = html;
  nav.classList.add('show');
}
document.getElementById('backBtn').onclick = ()=>{
  // دکمه برگشت داخل برنامه هم دقیقاً از همان مسیر کلید فیزیکی برگشت (تاریخچه مرورگر) عبور می‌کند
  // تا هر دو رفتار کاملاً یکسان و قابل پیش‌بینی باشند
  try{ history.back(); }
  catch(e){
    const meta = SCREEN_META[currentScreen];
    showScreen(meta && meta.parent ? meta.parent : 'mainhome', {push:false});
  }
};
document.getElementById('goRegs').onclick = ()=> showScreen('regs');
document.getElementById('goTables').onclick = ()=> showScreen('tables');
document.getElementById('goLaws').onclick = ()=> showScreen('lawshome');
document.getElementById('fabCalc').onclick = ()=>{ resetCalcForm(); showScreen('calc'); };

/* ========================= جداول دهگانه: رندر و نمایش ========================= */
function renderTablesHome(){
  const grid = document.getElementById('tableGrid');
  grid.innerHTML = TABLES.map(t=>{
    const empty = !t.rows || t.rows.length===0;
    return `<div class="table-card ${empty?'empty':''}" data-id="${t.id}">
      <div class="icon">${t.icon}</div>
      <div class="info">
        <h3>${t.title}</h3>
        <span>${empty ? 'به‌زودی تکمیل می‌شود' : fa(t.rows.length)+' ردیف الگوی مصرف'}</span>
      </div>
      <div class="chev">‹</div>
    </div>`;
  }).join('');
  Array.from(grid.children).forEach(el=>{
    el.onclick = ()=> openTable(parseInt(el.dataset.id,10));
  });
}

function openTable(id){
  const t = TABLES.find(x=>x.id===id);
  if(!t) return;
  const wrap = document.getElementById('tableWrap');
  if(!t.rows || t.rows.length===0){
    wrap.innerHTML = `<div class="empty-state">📭 داده‌های این جدول هنوز اضافه نشده است.<br>به‌زودی تکمیل خواهد شد.</div>`;
  } else {
    wrap.innerHTML = `<table class="data-table">
      <thead><tr>
        <th>ردیف</th><th>دسته‌بندی</th><th>واحد محاسبه</th>
        <th>لیتر در روز</th><th>متر مکعب در ماه</th><th>توضیحات</th>
      </tr></thead>
      <tbody>
        ${t.rows.map(r=>`
          <tr class="${r.composite?'composite-row':''}">
            <td>${fa(r.row)}</td>
            <td>${r.category}</td>
            <td>${r.unit}</td>
            <td>${r.composite?'—':(r.literPerDay!=null?fa(r.literPerDay):'—')}</td>
            <td>${r.composite?'—':(r.m3PerMonth!=null?fa(r.m3PerMonth):'—')}</td>
            <td>${[r.desc, r.extra?('➕ '+r.extra.label+': '+fa(r.extra.literPerDay)+' لیتر/روز ('+fa(r.extra.m3PerMonth)+' m³/ماه)'):'', r.minMonthly?('حداقل '+fa(r.minMonthly)+' m³/ماه'):''].filter(Boolean).join('<br>')}</td>
          </tr>`).join('')}
      </tbody>`;
  }
  showScreen('table');
  document.getElementById('headerTitle').textContent = t.title;
  document.getElementById('headerSub').textContent = 'جدول ' + fa(t.id) + ' از ' + fa(TABLES.length) + ' جدول';
}

/* ========================= آیین‌نامه: فهرست مسطح برای جست‌وجوی سراسری ========================= */
let FLAT = [];
function buildFlat(){
  FLAT = [];
  CHAPTERS.forEach((c, ci)=> c.items.forEach((it, ii)=> FLAT.push({ci, ii, chapter:c, item:it})));
}

function renderRegsHome(){
  document.getElementById('chapterGrid').innerHTML = CHAPTERS.map(c=>{
    const empty = c.items.length===0;
    return `
    <div class="table-card ${empty?'empty':''}" data-ci="${c.id-1}">
      <div class="icon">${c.icon}</div>
      <div class="info">
        <h3>${c.title}</h3>
        <span>${empty ? 'به‌زودی تکمیل می‌شود' : toFa(c.items.length) + ' بند'}</span>
      </div>
      <div class="chev">‹</div>
    </div>`;
  }).join('');
  Array.from(document.getElementById('chapterGrid').children).forEach(el=>{
    el.onclick = ()=> openChapter(parseInt(el.dataset.ci,10));
  });
}

/* جست‌وجوی سراسری (صفحه فهرست آیین‌نامه) */
const homeInput = document.getElementById('homeSearchInput');
const homeResults = document.getElementById('homeSearchResults');
const homeSelectedWrap = document.getElementById('homeSelectedWrap');

homeInput.addEventListener('input', ()=>{
  const q = normalizeDigits(homeInput.value.trim());
  homeSelectedWrap.innerHTML = '';
  if(!q){ homeResults.classList.remove('show'); homeResults.innerHTML=''; return; }
  const matches = FLAT.filter(x => x.item.title.includes(q) || x.item.text.includes(q) || x.item.code.includes(q));
  renderResultsList(homeResults, matches, q, (m)=> selectGlobal(m, q));
  homeResults.classList.add('show');
});

function renderResultsList(container, matches, q, onPick){
  if(matches.length===0){
    container.innerHTML = `<div class="empty-state">نتیجه‌ای یافت نشد</div>`;
    return;
  }
  container.innerHTML = matches.slice(0,60).map((m,i)=>`
    <div class="search-result-item" data-idx="${i}">
      <div class="sr-icon">${m.chapter.icon}</div>
      <div class="sr-text">
        <div class="sr-cat">${highlight(m.item.code + ' — ' + m.item.title, q)}</div>
        <div class="sr-snip">${highlight(m.item.text, q)}</div>
        <div class="sr-table">${m.chapter.title}</div>
      </div>
    </div>`).join('');
  Array.from(container.children).forEach((el,i)=>{
    el.onclick = ()=> onPick(matches[i]);
  });
}

function selectGlobal(m, q){
  homeInput.value = '';
  homeResults.classList.remove('show');
  homeResults.innerHTML = '';
  homeSelectedWrap.innerHTML = detailCardHtml(m, q, true);
  bindDetailCard(homeSelectedWrap, m, ()=> homeSelectedWrap.innerHTML = '');
  homeSelectedWrap.querySelector('.btn-goto').onclick = ()=>{
    openChapter(m.ci, m.ii);
  };
  homeSelectedWrap.scrollIntoView({behavior:'smooth', block:'nearest'});
}

function detailCardHtml(m, q, withGoto){
  return `
    <div class="selected-row-card">
      <div class="sel-head">
        <div class="sr-icon">${m.chapter.icon}</div>
        <div class="sel-code">${m.item.code}</div>
        <div class="sel-title">${escapeHtml(m.item.title)}</div>
      </div>
      <div class="sel-chapter">${m.chapter.title}</div>
      <div class="sel-text">${highlight(m.item.text, q||'')}</div>
      <div class="sel-actions">
        <button class="btn-mini btn-copy" data-copy="${m.item.code} ${escapeHtml(m.item.title)} — ${escapeHtml(m.item.text)}">📋 کپی متن و کد</button>
        ${withGoto ? '<button class="btn-mini btn-goto">↗ مشاهده در فصل</button>' : ''}
        <button class="btn-mini btn-clear">حذف</button>
      </div>
    </div>`;
}
function bindDetailCard(container, m, onClear){
  const copyBtn = container.querySelector('.btn-copy');
  copyBtn.onclick = ()=> copyToClipboard(m.item.code + ' — ' + m.item.title + '\n' + m.item.text, copyBtn);
  const clearBtn = container.querySelector('.btn-clear');
  if(clearBtn) clearBtn.onclick = onClear;
}
function copyToClipboard(text, btn){
  const done = ()=>{
    const original = btn.innerHTML;
    btn.classList.add('copied');
    btn.innerHTML = '✓ کپی شد';
    setTimeout(()=>{ btn.classList.remove('copied'); btn.innerHTML = original; }, 1600);
  };
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(done).catch(()=>fallbackCopy(text, done));
  } else {
    fallbackCopy(text, done);
  }
}
function fallbackCopy(text, done){
  const ta = document.createElement('textarea');
  ta.value = text; ta.style.position='fixed'; ta.style.opacity='0';
  document.body.appendChild(ta); ta.select();
  try{ document.execCommand('copy'); }catch(e){}
  document.body.removeChild(ta);
  done();
}

/* صفحه فصل */
let currentChapterIndex = null;

function openChapter(ci, focusItemIndex){
  currentChapterIndex = ci;
  const c = CHAPTERS[ci];
  document.getElementById('chapterIntro').textContent = c.intro;

  if(c.items.length===0){
    document.getElementById('chapterMeta').textContent = c.title + ' • در حال تکمیل';
    document.getElementById('chapterItemsWrap').innerHTML = `<div class="empty-state">📭 محتوای این فصل هنوز اضافه نشده است.<br>به‌زودی تکمیل خواهد شد.</div>`;
  } else {
    document.getElementById('chapterMeta').textContent = c.title + ' • ' + toFa(c.items.length) + ' بند';
    document.getElementById('chapterItemsWrap').innerHTML = c.items.map((it, ii)=>`
      <div class="article-card" id="art-${ci}-${ii}" data-ci="${ci}" data-ii="${ii}">
        <div class="article-code">${it.code}</div>
        <div class="article-body">
          <h5>${escapeHtml(it.title)}</h5>
          <p class="art-text">${escapeHtml(it.text)}</p>
        </div>
      </div>`).join('');
    Array.from(document.getElementById('chapterItemsWrap').children).forEach(el=>{
      el.onclick = ()=> selectChapterItem(parseInt(el.dataset.ci,10), parseInt(el.dataset.ii,10));
    });
  }

  chapterInput.value = '';
  chapterResults.classList.remove('show');
  chapterResults.innerHTML = '';
  chapterSelectedWrap.innerHTML = '';

  showScreen('chapter');
  document.getElementById('headerTitle').textContent = c.title;
  document.getElementById('headerSub').textContent = 'فصل ' + toFa(c.id) + ' از ۷ فصل آیین‌نامه';

  if(focusItemIndex !== undefined && c.items.length>0){
    setTimeout(()=> selectChapterItem(ci, focusItemIndex, true), 200);
  }
}

/* جست‌وجو داخل فصل */
const chapterInput = document.getElementById('chapterSearchInput');
const chapterResults = document.getElementById('chapterSearchResults');
const chapterSelectedWrap = document.getElementById('chapterSelectedWrap');

chapterInput.addEventListener('input', ()=>{
  const q = normalizeDigits(chapterInput.value.trim());
  if(!q){
    chapterResults.classList.remove('show'); chapterResults.innerHTML='';
    clearChapterHighlighting();
    return;
  }
  const matches = FLAT.filter(x => x.ci === currentChapterIndex &&
    (x.item.title.includes(q) || x.item.text.includes(q) || x.item.code.includes(q)));
  renderResultsList(chapterResults, matches, q, (m)=> selectChapterItem(m.ci, m.ii, true, q));
  chapterResults.classList.add('show');
  applyChapterHighlighting(q);
});

function applyChapterHighlighting(q){
  let firstMatch = null;
  document.querySelectorAll('#chapterItemsWrap .article-card').forEach(card=>{
    const ii = parseInt(card.dataset.ii,10);
    const it = CHAPTERS[currentChapterIndex].items[ii];
    const isMatch = it.title.includes(q) || it.text.includes(q) || it.code.includes(q);
    const p = card.querySelector('.art-text');
    p.innerHTML = highlight(it.text, q);
    card.classList.toggle('match', isMatch);
    card.classList.toggle('dimmed', !isMatch);
    if(isMatch && !firstMatch) firstMatch = card;
  });
  if(firstMatch) firstMatch.scrollIntoView({behavior:'smooth', block:'center'});
}
function clearChapterHighlighting(){
  document.querySelectorAll('#chapterItemsWrap .article-card').forEach(card=>{
    const ii = parseInt(card.dataset.ii,10);
    const it = CHAPTERS[currentChapterIndex] ? CHAPTERS[currentChapterIndex].items[ii] : null;
    if(!it) return;
    card.querySelector('.art-text').innerHTML = escapeHtml(it.text);
    card.classList.remove('match','dimmed');
  });
}

function selectChapterItem(ci, ii, scrollTo, q){
  const m = {ci, ii, chapter:CHAPTERS[ci], item:CHAPTERS[ci].items[ii]};
  chapterInput.value = q || '';
  chapterResults.classList.remove('show');
  chapterResults.innerHTML = '';
  chapterSelectedWrap.innerHTML = detailCardHtml(m, q, false);
  bindDetailCard(chapterSelectedWrap, m, ()=> chapterSelectedWrap.innerHTML = '');

  const card = document.getElementById(`art-${ci}-${ii}`);
  if(card){
    document.querySelectorAll('#chapterItemsWrap .article-card').forEach(c=>c.classList.remove('flash'));
    card.classList.add('flash');
    setTimeout(()=> card.classList.remove('flash'), 1800);
  }
  if(scrollTo){
    chapterSelectedWrap.scrollIntoView({behavior:'smooth', block:'center'});
  }
}

/* =========================================================================
   قوانین مهم آب و فاضلاب — سه قانون کلیدی (بخش جدید، مستقل از آیین‌نامه بالا)
   شماره‌گذاری هر بند دقیقاً مطابق متن اصلی است. نام‌گذاری توابع و متغیرها
   عمداً با پیشوند law/Law جدا شده تا با بخش «آیین‌نامه» بالا تداخلی نداشته باشد.
   ========================================================================= */
function lawT(code, section, text){ return {code:code, section:section||null, title:"", text:text||""}; }

let LAW_CHAPTERS = [];
/* ========================= فهرست مسطح برای جست‌وجوی سراسری در قوانین مهم ========================= */
let LAWS_FLAT = [];
function buildLawsFlat(){
  LAWS_FLAT = [];
  LAW_CHAPTERS.forEach((c, ci)=> c.items.forEach((it, ii)=> LAWS_FLAT.push({ci, ii, chapter:c, item:it})));
}

/* ========================= رندر صفحه فهرست قوانین مهم ========================= */
function renderLawsHome(){
  document.getElementById('lawsChapterGrid').innerHTML = LAW_CHAPTERS.map(c=>{
    const empty = c.items.length===0;
    return `
    <div class="table-card ${empty?'empty':''}" data-ci="${c.id-1}">
      <div class="icon">${c.icon}</div>
      <div class="info">
        <h3>${c.title}</h3>
        <span>${empty ? 'به‌زودی تکمیل می‌شود' : c.meta}</span>
      </div>
      <div class="chev">‹</div>
    </div>`;
  }).join('');
  Array.from(document.getElementById('lawsChapterGrid').children).forEach(el=>{
    el.onclick = ()=> openLawChapter(parseInt(el.dataset.ci,10));
  });
}

/* ========================= جست‌وجوی سراسری (صفحه فهرست قوانین مهم) ========================= */
const lawsHomeInput = document.getElementById('lawsHomeSearchInput');
const lawsHomeResults = document.getElementById('lawsHomeSearchResults');
const lawsHomeSelectedWrap = document.getElementById('lawsHomeSelectedWrap');

lawsHomeInput.addEventListener('input', ()=>{
  const q = normalizeDigits(lawsHomeInput.value.trim());
  lawsHomeSelectedWrap.innerHTML = '';
  if(!q){ lawsHomeResults.classList.remove('show'); lawsHomeResults.innerHTML=''; return; }
  const matches = LAWS_FLAT.filter(x => x.item.title.includes(q) || x.item.text.includes(q) || x.item.code.includes(q) || (x.item.section||'').includes(q));
  renderResultsList(lawsHomeResults, matches, q, (m)=> selectLawGlobal(m, q));
  lawsHomeResults.classList.add('show');
});

function selectLawGlobal(m, q){
  lawsHomeInput.value = '';
  lawsHomeResults.classList.remove('show');
  lawsHomeResults.innerHTML = '';
  lawsHomeSelectedWrap.innerHTML = lawDetailCardHtml(m, q, true);
  lawsBindDetailCard(lawsHomeSelectedWrap, m, ()=> lawsHomeSelectedWrap.innerHTML = '');
  lawsHomeSelectedWrap.querySelector('.btn-goto').onclick = ()=>{
    openLawChapter(m.ci, m.ii);
  };
  lawsHomeSelectedWrap.scrollIntoView({behavior:'smooth', block:'nearest'});
}

/* ========================= کارت جزئیات بند انتخاب‌شده در قوانین مهم (عنوان از روی «فصل/بخش» بند است نه تیتر خالی) ========================= */
function lawDetailCardHtml(m, q, withGoto){
  return `
    <div class="selected-row-card">
      <div class="sel-head">
        <div class="sr-icon">${m.chapter.icon}</div>
        <div class="sel-code">${m.item.code}</div>
        <div class="sel-title">${m.item.section ? escapeHtml(m.item.section) : escapeHtml(m.item.title)}</div>
      </div>
      <div class="sel-chapter">${m.chapter.title}</div>
      <div class="sel-text">${highlight(m.item.text, q||'')}</div>
      <div class="sel-actions">
        <button class="btn-mini btn-copy" data-copy="${m.item.code} ${escapeHtml(m.item.section||'')} — ${escapeHtml(m.item.text)}">📋 کپی متن و کد</button>
        ${withGoto ? '<button class="btn-mini btn-goto">↗ مشاهده در قانون</button>' : ''}
        <button class="btn-mini btn-clear">حذف</button>
      </div>
    </div>`;
}
function lawsBindDetailCard(container, m, onClear){
  const copyBtn = container.querySelector('.btn-copy');
  copyBtn.onclick = ()=> copyToClipboard(m.item.code + ' — ' + m.chapter.title + '\n' + (m.item.text||'متن این بند هنوز وارد نشده است.'), copyBtn);
  const clearBtn = container.querySelector('.btn-clear');
  if(clearBtn) clearBtn.onclick = onClear;
}

/* ========================= صفحه متن قانون ========================= */
let currentLawChapterIndex = null;

function openLawChapter(ci, focusItemIndex){
  currentLawChapterIndex = ci;
  const c = LAW_CHAPTERS[ci];
  document.getElementById('lawsChapterIntro').textContent = c.intro;

  if(c.items.length===0){
    document.getElementById('lawsChapterMeta').textContent = c.title + ' • در حال تکمیل';
    document.getElementById('lawsItemsWrap').innerHTML = `<div class="empty-state">📭 محتوای این قانون هنوز اضافه نشده است.<br>به‌زودی تکمیل خواهد شد.</div>`;
  } else {
    document.getElementById('lawsChapterMeta').textContent = c.meta;
    let html = '';
    let lastSection = undefined;
    c.items.forEach((it, ii)=>{
      if(it.section && it.section !== lastSection){
        html += `<div class="section-divider">${escapeHtml(it.section)}</div>`;
        lastSection = it.section;
      }
      html += `
      <div class="article-card" id="lawart-${ci}-${ii}" data-ci="${ci}" data-ii="${ii}">
        <div class="article-code">${it.code}</div>
        <div class="article-body">
          ${it.title ? `<h5>${escapeHtml(it.title)}</h5>` : ''}
          <p class="art-text">${escapeHtml(it.text)}</p>
        </div>
      </div>`;
    });
    document.getElementById('lawsItemsWrap').innerHTML = html;
    Array.from(document.querySelectorAll('#lawsItemsWrap .article-card')).forEach(el=>{
      el.onclick = ()=> selectLawChapterItem(parseInt(el.dataset.ci,10), parseInt(el.dataset.ii,10));
    });
  }

  lawsChapterInput.value = '';
  lawsChapterResults.classList.remove('show');
  lawsChapterResults.innerHTML = '';
  lawsChapterSelectedWrap.innerHTML = '';

  showScreen('lawschapter');
  document.getElementById('headerTitle').textContent = c.title;
  document.getElementById('headerSub').textContent = 'قانون ' + toFa(c.id) + ' از ' + toFa(LAW_CHAPTERS.length) + ' قانون';

  if(focusItemIndex !== undefined && c.items.length>0){
    setTimeout(()=> selectLawChapterItem(ci, focusItemIndex, true), 200);
  }
}

/* ========================= جست‌وجو داخل قانون ========================= */
const lawsChapterInput = document.getElementById('lawsChapterSearchInput');
const lawsChapterResults = document.getElementById('lawsChapterSearchResults');
const lawsChapterSelectedWrap = document.getElementById('lawsChapterSelectedWrap');

lawsChapterInput.addEventListener('input', ()=>{
  const q = normalizeDigits(lawsChapterInput.value.trim());
  if(!q){
    lawsChapterResults.classList.remove('show'); lawsChapterResults.innerHTML='';
    clearLawChapterHighlighting();
    return;
  }
  const matches = LAWS_FLAT.filter(x => x.ci === currentLawChapterIndex &&
    (x.item.title.includes(q) || x.item.text.includes(q) || x.item.code.includes(q) || (x.item.section||'').includes(q)));
  renderResultsList(lawsChapterResults, matches, q, (m)=> selectLawChapterItem(m.ci, m.ii, true, q));
  lawsChapterResults.classList.add('show');
  applyLawChapterHighlighting(q);
});

function applyLawChapterHighlighting(q){
  let firstMatch = null;
  document.querySelectorAll('#lawsItemsWrap .article-card').forEach(card=>{
    const ii = parseInt(card.dataset.ii,10);
    const it = LAW_CHAPTERS[currentLawChapterIndex].items[ii];
    const isMatch = it.title.includes(q) || it.text.includes(q) || it.code.includes(q) || (it.section||'').includes(q);
    const p = card.querySelector('.art-text');
    p.innerHTML = highlight(it.text, q);
    card.classList.toggle('match', isMatch);
    card.classList.toggle('dimmed', !isMatch);
    if(isMatch && !firstMatch) firstMatch = card;
  });
  if(firstMatch) firstMatch.scrollIntoView({behavior:'smooth', block:'center'});
}
function clearLawChapterHighlighting(){
  document.querySelectorAll('#lawsItemsWrap .article-card').forEach(card=>{
    const ii = parseInt(card.dataset.ii,10);
    const it = LAW_CHAPTERS[currentLawChapterIndex] ? LAW_CHAPTERS[currentLawChapterIndex].items[ii] : null;
    if(!it) return;
    card.querySelector('.art-text').innerHTML = escapeHtml(it.text);
    card.classList.remove('match','dimmed');
  });
}

function selectLawChapterItem(ci, ii, scrollTo, q){
  const m = {ci, ii, chapter:LAW_CHAPTERS[ci], item:LAW_CHAPTERS[ci].items[ii]};
  lawsChapterInput.value = q || '';
  lawsChapterResults.classList.remove('show');
  lawsChapterResults.innerHTML = '';
  lawsChapterSelectedWrap.innerHTML = lawDetailCardHtml(m, q, false);
  lawsBindDetailCard(lawsChapterSelectedWrap, m, ()=> lawsChapterSelectedWrap.innerHTML = '');

  const card = document.getElementById(`lawart-${ci}-${ii}`);
  if(card){
    document.querySelectorAll('#lawsItemsWrap .article-card').forEach(c=>c.classList.remove('flash'));
    card.classList.add('flash');
    setTimeout(()=> card.classList.remove('flash'), 1800);
  }
  if(scrollTo){
    lawsChapterSelectedWrap.scrollIntoView({behavior:'smooth', block:'center'});
  }
}

/* ========================= ماشین‌حساب مصرف و صورتحساب ========================= */
let selectedRow = null; // { table, row }

let flatRows = [];
function buildFlatRows(){
  flatRows = [];
  TABLES.forEach(t=> (t.rows||[]).forEach(r=>{ if(!r.composite) flatRows.push({table:t, row:r}); }));
}

const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');

searchInput.addEventListener('input', ()=>{
  const q = searchInput.value.trim();
  if(!q){ searchResults.classList.remove('show'); searchResults.innerHTML=''; return; }
  const matches = flatRows.filter(x => x.row.category.includes(q) || x.table.title.includes(q));
  if(matches.length===0){
    searchResults.innerHTML = `<div class="empty-state">نتیجه‌ای یافت نشد<br><span style="font-size:10.5px;">(داده‌های جداول هنوز اضافه نشده‌اند)</span></div>`;
  } else {
    searchResults.innerHTML = matches.map((m,i)=>`
      <div class="search-result-item" data-idx="${i}">
        <div class="sr-icon">${m.table.icon}</div>
        <div class="sr-text">
          <div class="sr-cat">${m.row.category}</div>
          <div class="sr-table">${m.table.title} · واحد: ${m.row.unit}</div>
        </div>
      </div>`).join('');
    Array.from(searchResults.children).forEach((el,i)=>{
      el.onclick = ()=> selectRow(matches[i]);
    });
  }
  searchResults.classList.add('show');
});

function selectRow(m){
  selectedRow = m;
  searchInput.value = '';
  searchResults.classList.remove('show');
  searchResults.innerHTML = '';
  const wrap = document.getElementById('selectedRowWrap');
  const monthlyVal = m.row.m3PerMonth != null ? fa(m.row.m3PerMonth) + ' m³' : '—';
  const extraInfo = m.row.extra ? ` • ${m.row.extra.label}: <b>${fa(m.row.extra.m3PerMonth)} m³</b>` : '';
  wrap.innerHTML = `
    <div class="selected-row-card calc-variant">
      <div class="sr-icon">${m.table.icon}</div>
      <div class="sr-text">${m.row.category}<br><span style="font-weight:400;color:var(--muted);font-size:11px;">واحد محاسبه: ${m.row.unit}</span></div>
      <button class="sr-clear" id="clearRowBtn">حذف</button>
    </div>
    <div class="row-info-note">واحد محاسبه: <b>${m.row.unit}</b> • مصرف ماهانه هر واحد (طبق جدول): <b>${monthlyVal}</b>${extraInfo}</div>`;
  document.getElementById('clearRowBtn').onclick = ()=>{
    selectedRow = null;
    wrap.innerHTML = '';
    document.getElementById('extraQtyField').style.display = 'none';
  };
  document.getElementById('qtyLabel').textContent = 'تعداد واحد (' + m.row.unit + ')';
  const extraField = document.getElementById('extraQtyField');
  if(m.row.extra){
    extraField.style.display = 'block';
    document.getElementById('extraQtyLabel').textContent = m.row.extra.label;
  } else {
    extraField.style.display = 'none';
  }
}

function resetCalcForm(){
  selectedRow = null;
  document.getElementById('selectedRowWrap').innerHTML = '';
  document.getElementById('searchInput').value = '';
  document.getElementById('searchResults').classList.remove('show');
  document.getElementById('searchResults').innerHTML = '';
  document.getElementById('qtyInput').value = '';
  document.getElementById('extraQtyInput').value = '';
  document.getElementById('illegalDaysInput').value = '';
  document.getElementById('freeWaterPriceInput').value = '';
  document.getElementById('cityCoefInput').value = '';
  document.getElementById('extraQtyField').style.display = 'none';
  document.getElementById('qtyLabel').textContent = 'تعداد واحد';
  document.getElementById('resultsWrap').style.display = 'none';
  const summaryCard = document.getElementById('calcSummaryCard');
  if(summaryCard){ summaryCard.style.display = 'none'; summaryCard.textContent = ''; }
}

function numOr0(id, fallback){
  const v = document.getElementById(id).value;
  if(v === '' || v === null || v === undefined) return fallback !== undefined ? fallback : 0;
  const n = parseFloat(v);
  return isNaN(n) ? (fallback !== undefined ? fallback : 0) : n;
}

// متن توضیحی خلاصه محاسبه بر اساس اطلاعات وارد شده توسط کاربر (فقط نمایشی؛ در محاسبات دخالتی ندارد)
function buildCalcSummaryText(row, qty, extraQty, illegalDays){
  if(!row) return '';
  let extraLabelShort = '';
  if(row.extra && row.extra.label){
    extraLabelShort = row.extra.label.replace(/^به ازای هر\s*/, '').trim();
  }
  let text = 'محاسبه برای ' + row.category + ' با ' + fa(qty) + ' ' + row.unit;
  if(row.extra && extraQty > 0){
    text += ' و ' + fa(extraQty) + ' ' + extraLabelShort;
  }
  if(illegalDays > 0){
    text += ' و ' + fa(illegalDays) + ' روز استفاده غیرمجاز';
  }
  text += ' انجام شد.';
  return text;
}

document.getElementById('calcBtn').onclick = ()=>{
  const qty        = numOr0('qtyInput', 0);
  const extraQty   = numOr0('extraQtyInput', 0);
  const illegalDays= numOr0('illegalDaysInput', 0);
  const cityCoef   = numOr0('cityCoefInput', 1);
 // فعال بشه باکس اب ازاد صفر میشه  const freePrice  = 0;
  const freePrice = numOr0('freeWaterPriceInput', 0);

  const r = selectedRow ? selectedRow.row : null;

  const litPerDay   = r && r.literPerDay   != null ? r.literPerDay   : 0;
  const m3PerMonth  = r && r.m3PerMonth    != null ? r.m3PerMonth    : 0;
  const extraLit    = r && r.extra ? r.extra.literPerDay : 0;
  const extraM3     = r && r.extra ? r.extra.m3PerMonth  : 0;

  let stdVolume = qty*m3PerMonth + extraQty*extraM3;
  if(r && r.minMonthly != null && qty > 0){
    stdVolume = Math.max(stdVolume, r.minMonthly);
  }

  const illVolume = illegalDays * ( qty*litPerDay + extraQty*extraLit ) / 1000;
  const stdCost = stdVolume * freePrice * cityCoef;
  const illCost = illVolume * freePrice * cityCoef;

  document.getElementById('stdVolOut').textContent = fa(stdVolume.toFixed(3)) + ' m³';
  document.getElementById('illVolOut').textContent = fa(illVolume.toFixed(3)) + ' m³';
  document.getElementById('illCostOut').innerHTML = rialFa(illCost) + ' <small>ریال</small>';

  const summaryCard = document.getElementById('calcSummaryCard');
  if(summaryCard){
    const summaryText = buildCalcSummaryText(r, qty, extraQty, illegalDays);
    if(summaryText){
      summaryCard.textContent = summaryText;
      summaryCard.style.display = 'block';
    } else {
      summaryCard.style.display = 'none';
      summaryCard.textContent = '';
    }
  }

  document.getElementById('resultsWrap').style.display = 'grid';
  document.getElementById('resultsWrap').scrollIntoView({behavior:'smooth', block:'nearest'});
};

/* =========================================================================
   راه‌اندازی — بارگذاری ناهمگام داده‌ها از فایل‌های JSON مستقل
   ------------------------------------------------------------------------
   TABLES/CHAPTERS/LAW_CHAPTERS دیگر مستقیماً داخل این فایل تعریف نشده‌اند؛
   بلکه از data/tables.json ،data/chapters.json و data/laws.json خوانده
   می‌شوند. این کار باعث می‌شود:
   ۱) حجم app.js کوچک و قابل نگهداری بماند و افزودن جدول/فصل/قانون جدید
      فقط به معنی ویرایش یک فایل JSON باشد، نه این فایل.
   ۲) Service Worker بتواند این فایل‌های JSON را مستقل کش کند (نگاه کنید
      به APP_SHELL در sw.js) تا کارکرد آفلاین کامل حفظ شود.
   در صورت شکست fetch (نبود اینترنت و نبود کش از قبل)، پیام خطا با دکمه
   تلاش مجدد نمایش داده می‌شود؛ در غیر این صورت کاربر با صفحه سفید یا
   نیمه‌کاره مواجه می‌شود که تجربه بدی است.
   ========================================================================= */
async function loadAppData(){
  const loader = document.getElementById('appLoader');
  const loaderError = document.getElementById('appLoaderError');
  const retryBtn = document.getElementById('appLoaderRetry');
  if(loaderError) loaderError.style.display = 'none';
  try{
    const [tablesRes, chaptersRes, lawsRes] = await Promise.all([
      fetch('./data/tables.json'),
      fetch('./data/chapters.json'),
      fetch('./data/laws.json')
    ]);
    if(!tablesRes.ok || !chaptersRes.ok || !lawsRes.ok){
      throw new Error('پاسخ شبکه نامعتبر بود');
    }
    const [tablesData, chaptersData, lawsData] = await Promise.all([
      tablesRes.json(), chaptersRes.json(), lawsRes.json()
    ]);
    TABLES = tablesData;
    CHAPTERS = chaptersData;
    LAW_CHAPTERS = lawsData;
    buildFlat();
    buildLawsFlat();
    buildFlatRows();

    renderTablesHome();
    renderRegsHome();
    renderLawsHome();
    showScreen('mainhome', {push:false});
    // این ورودی، «کف» پشته تاریخچه برنامه است؛ برگشت از همین‌جا یعنی خروج از برنامه (رفتار طبیعی و مورد انتظار)
    try{ history.replaceState({screen:'mainhome', infoModal:false, installModal:false}, '', location.href); }catch(e){}

    if(loader){ loader.classList.add('hide'); setTimeout(()=> loader.style.display='none', 260); }
  }catch(err){
    console.error('خطا در بارگذاری داده‌های برنامه:', err);
    if(loaderError) loaderError.style.display = 'block';
  }
}
if(document.getElementById('appLoaderRetry')){
  document.getElementById('appLoaderRetry').addEventListener('click', loadAppData);
}
loadAppData();

/* ========================= کلید بازگشت فیزیکی گوشی (بازنگری اساسی) =========================
   روش قبلی با «انباشتن چند ورودی نگهبان» در تاریخچه مرورگر کار می‌کرد؛ همین انباشت نامنظم باعث
   دو دسته اشکال می‌شد: در برخی گوشی‌ها با فشردن کلید برگشت، برنامه اصلاً بسته نمی‌شد (چون هنوز
   ورودی‌های نگهبان اضافی در پشته باقی مانده بود) و در برخی دیگر، با یک یا دو بار برگشت، بدون رسیدن
   به صفحه اصلی، کلاً از برنامه خارج می‌شد (چون تعداد ورودی‌های واقعی پشته با تعداد سطوح ناوبری برنامه
   همخوانی نداشت).

   روش جدید: به هیچ عنوان ورودی «اضافی» یا «نگهبان» به تاریخچه اضافه نمی‌شود. برای هر پیمایش واقعی
   به داخل برنامه (رفتن به یک صفحه جدید، یا باز شدن مودال اطلاعات/نصب) دقیقاً یک ورودی تاریخچه
   ثبت می‌شود (نگاه کنید به showScreen و openModal/openInstallModal) و بستن آن هم دقیقاً همان یک
   ورودی را مصرف می‌کند. بنابراین پشته تاریخچه مرورگر همیشه، ورودی‌به‌ورودی، با وضعیت واقعی برنامه
   یکی است؛ کلید فیزیکی برگشت و دکمه برگشت داخل برنامه هر دو از همین پشته عبور می‌کنند و رفتاری
   یکسان، قابل پیش‌بینی و بدون پرش یا گیر کردن خواهند داشت. وقتی کاربر در صفحه اصلی برگشت بزند،
   دیگر هیچ ورودی داخلی باقی نمانده و رفتار پیش‌فرض سیستم‌عامل/مرورگر (خروج از برنامه) طی می‌شود. */
(function(){
 try{
  function isAnySearchOpen(){
    return Array.from(document.querySelectorAll('.search-results.show')).length > 0;
  }
  function closeAllSearch(){
    document.querySelectorAll('.search-results.show').forEach(el=> el.classList.remove('show'));
  }

  window.addEventListener('popstate', function(ev){
    // نتایج جست‌وجوی باز (اگر بود) را می‌بندیم؛ این‌ها هرگز ورودی جداگانه‌ای در تاریخچه ندارند
    // پس بستن‌شان به‌عنوان یک اقدام جانبیِ رایگان همراه با هر برگشت انجام می‌شود، نه به‌جای آن
    if(isAnySearchOpen()) closeAllSearch();

    // مراجع overlayها اینجا و در همین لحظه گرفته می‌شوند، نه یک‌بار در بالای این IIFE؛
    // چون این اسکریپت پیش از پارس‌شدن HTML مودال‌ها اجرا می‌شود و مقداردهی زودهنگام
    // باعث می‌شد این متغیرها همیشه null بمانند و بستن با کلید فیزیکی/دکمه بستن به دو بار کلیک نیاز داشته باشد
    const infoOverlay = document.getElementById('infoModalOverlay');
    const installOverlay = document.getElementById('installModalOverlay');
    const installProgressOverlay = document.getElementById('installProgressOverlay');

    const st = ev.state || {screen:'mainhome', infoModal:false, installModal:false};

    if(infoOverlay && infoOverlay.classList.contains('show') && !st.infoModal){
      infoOverlay.classList.remove('show');
    }
    if(installOverlay && installOverlay.classList.contains('show') && !st.installModal){
      installOverlay.classList.remove('show');
    }
    if(installProgressOverlay && installProgressOverlay.classList.contains('show') && !st.installModal){
      installProgressOverlay.classList.remove('show');
    }
    if(st.screen && st.screen !== currentScreen){
      showScreen(st.screen, {push:false});
    }
  });
 }catch(e){ console.warn('خطا در راه‌اندازی کلید بازگشت:', e); }
})();

/* ========================= ثبت Service Worker برای PWA =========================
   نکته: این بلوک دیگر به window.addEventListener('load', ...) گره نخورده است.
   دلیل حذف: در نسخه قبلی، اگر رویداد load صفحه (مثلاً به‌خاطر یک درخواست
   شبکه‌ای معلق/مسدود مانند فونت گوگل) دیر اتفاق می‌افتاد یا اصلاً کامل
   نمی‌شد، ثبت Service Worker هم به تعویق می‌افتاد یا هرگز اجرا نمی‌شد؛
   همین باعث می‌شد مرورگر شرایط لازم برای پیشنهاد «نصب» را تشخیص ندهد
   و به‌جای آن فقط گزینه «افزودن میانبر» را نشان دهد. حالا ثبت بلافاصله
   پس از اجرای این اسکریپت (که خودش پایین صفحه و بعد از DOM قرار دارد)
   انجام می‌شود، مستقل از تکمیل یا عدم تکمیل رویداد load. */
if('serviceWorker' in navigator && (location.protocol==='https:' || location.hostname==='localhost')){
  try{
    // اگر پیش از ثبت، از قبل یک Service Worker صفحه را کنترل می‌کرده، یعنی این بازدید «اولین بار» نیست
    // و اگر بعداً controllerchange رخ دهد، واقعاً یک بروزرسانی نسخه است؛ در غیر این صورت (اولین بازدید/اولین نصب)
    // اولین controllerchange صرفاً به‌دست‌گرفتن کنترل اولیه است، نه بروزرسانی، و نباید صفحه را رفرش کند
    const hadControllerBefore = !!navigator.serviceWorker.controller;
    // scope صریح './' و مسیر نسبی sw.js تا روی GitHub Pages شرایط نصب‌پذیری (installability) پایدار بماند
    navigator.serviceWorker.register('./sw.js', { scope: './' }).then((reg)=>{
      // وقتی نسخه جدید Service Worker نصب شد، آن را فعال کن تا کاربر همیشه آخرین نسخه را ببیند
      reg.addEventListener('updatefound', ()=>{
        const newWorker = reg.installing;
        if(!newWorker) return;
        newWorker.addEventListener('statechange', ()=>{
          if(newWorker.state === 'installed' && navigator.serviceWorker.controller){
            newWorker.postMessage('SKIP_WAITING');
          }
        });
      });
      // آماده‌بودن SW به مرورگر سیگنال می‌دهد که معیارهای نصب PWA برقرار است
      try{ navigator.serviceWorker.ready.catch(function(){}); }catch(_e){}
    }).catch(()=>{});
    // پس از فعال شدن نسخه جدید، صفحه یک‌بار به‌صورت خودکار تازه‌سازی می‌شود
    let swRefreshed = false;
    function isInstallFlowOpen(){
      const io = document.getElementById('installModalOverlay');
      const po = document.getElementById('installProgressOverlay');
      return (io && io.classList.contains('show')) || (po && po.classList.contains('show'));
    }
    navigator.serviceWorker.addEventListener('controllerchange', ()=>{
      if(swRefreshed) return;
      if(!hadControllerBefore) return; // اولین بازدید: این تغییر، بروزرسانی واقعی نیست؛ رفرش لازم نیست
      swRefreshed = true;
      // اگر همین لحظه پنجره نصب PWA باز است، رفرش فوری باعث از بین رفتن deferredPrompt و نیمه‌کاره
      // ماندن نصب (و در نتیجه ساخته شدن یک میانبر ساده به‌جای نصب کامل) می‌شود؛ پس صبر می‌کنیم تا
      // کاربر جریان نصب را ببندد و سپس صفحه را تازه‌سازی می‌کنیم
      if(isInstallFlowOpen()){
        const waitForInstallClose = setInterval(()=>{
          if(!isInstallFlowOpen()){
            clearInterval(waitForInstallClose);
            location.reload();
          }
        }, 400);
      } else {
        location.reload();
      }
    });
  }catch(e){ /* در محیط‌های محدود (مثل پیش‌نمایش درون‌برنامه‌ای) بی‌صدا نادیده گرفته شود */ }
}


/* ===== بخش ۳: مودال نصب PWA (اصلاح‌شده) ===== */
(function(){
 try{
  let deferredPrompt = null;
  const installOverlay = document.getElementById('installModalOverlay');
  const installBtn = document.getElementById('installBtn');
  const installModalDesc = document.getElementById('installModalDesc');
  const progressOverlay = document.getElementById('installProgressOverlay');
  const progressFill = document.getElementById('installProgressFill');
  const progressPercent = document.getElementById('installProgressPercent');
  const progressTitle = document.getElementById('installProgressTitle');
  const progressSub = document.getElementById('installProgressSub');
  const progressHint = document.getElementById('installProgressHint');
  const progressIcon = document.getElementById('installProgressIcon');
  if(!installOverlay || !installBtn) return;

  // ===== تشخیص اجرا داخل APK بسته‌بندی‌شده (TWA) =====
  // وقتی این PWA با ابزارهایی مثل Bubblewrap یا PWABuilder به یک اپ اندرویدی (APK) تبدیل می‌شود،
  // اندروید صفحه را داخل یک Trusted Web Activity باز می‌کند که همیشه referrer آن دقیقاً برابر است با
  // چیزی که با «android-app://» شروع می‌شود؛ این تنها سیگنال قابل‌اعتماد برای تشخیص «اجرای واقعی از
  // داخل همان اپ نصب‌شده APK» است (برخلاف isStandaloneMode در پایین همین فایل که یک PWA نصب‌شده معمولی
  // از طریق مرورگر را هم standalone تشخیص می‌دهد). در این حالت برنامه از قبل به‌صورت اپ اندروید نصب شده
  // است، پس کل مودال/درخواست نصب PWA (که فقط برای صفحه باز در مرورگر معنا دارد) باید کاملاً غیرفعال بماند
  // تا نه دوباره تلاش به نصب کند و نه میانبر تکراری بسازد؛ این بخش فقط داخل مرورگر معمولی فعال می‌ماند.
  function isPackagedApk(){
    try{
      return typeof document.referrer === 'string' && document.referrer.indexOf('android-app://') === 0;
    }catch(e){ return false; }
  }
  if(isPackagedApk()) return;

  function toFaLocal(n){
    try{ return typeof toFa === 'function' ? toFa(n) : String(n); }catch(e){ return String(n); }
  }

  // نمایش حالت عادی مودال (دکمه نصب) — تنها حالت معتبر، چون رویداد beforeinstallprompt
  // فقط زمانی توسط مرورگر ارسال می‌شود که برنامه واقعاً نصب نباشد؛ بنابراین همیشه دکمه نصب نمایش داده می‌شود
  function setInstallModalNormalMode(){
    installModalDesc.textContent = 'برای دسترسی سریع‌تر، برنامه را روی صفحه اصلی گوشی نصب کنید';
    installBtn.style.display = '';
  }

  function openInstallModal(){
    if(installOverlay.classList.contains('show') || (progressOverlay && progressOverlay.classList.contains('show'))) return;
    installOverlay.classList.add('show');
    // یک ورودی تاریخچه اضافه می‌شود که هم مرحله دکمه نصب و هم مرحله نوار پیشرفت را پوشش می‌دهد
    // تا کلید فیزیکی برگشت بتواند در هر دو مرحله، دقیقاً همین جریان نصب را ببندد
    try{ history.pushState({screen: (typeof currentScreen !== 'undefined' ? currentScreen : 'mainhome'), infoModal:false, installModal:true}, '', location.href); }catch(e){}
  }
  function hideInstallOverlays(){
    installOverlay.classList.remove('show');
    if(progressOverlay) progressOverlay.classList.remove('show');
  }
  function closeInstallModal(){
    const isOpen = installOverlay.classList.contains('show') || (progressOverlay && progressOverlay.classList.contains('show'));
    if(!isOpen) return;
    if(history.state && history.state.installModal){
      // همان ورودی تاریخچه‌ای که هنگام باز شدن اضافه شد را مصرف می‌کند تا پشته تاریخچه هم‌راستا بماند
      history.back();
    } else {
      hideInstallOverlays();
    }
  }

  // مرحله نوار پیشرفت: نمایش «در حال نصب... صبر کنید»، پر شدن تدریجی نوار (~۲٫۵ ثانیه)، سپس «نصب شد!»
  function runInstallProgress(){
    if(!progressOverlay || !progressFill){ closeInstallModal(); return; }
    installOverlay.classList.remove('show');
    progressOverlay.classList.add('show');

    progressFill.classList.remove('done');
    progressPercent.classList.remove('done');
    progressIcon.classList.remove('done');
    progressIcon.textContent = '📲';
    progressTitle.textContent = 'در حال نصب... صبر کنید';
    progressSub.textContent = 'اپلیکیشن در حال آماده‌سازی روی گوشی شماست';
    if(progressHint){ progressHint.textContent = ''; progressHint.classList.remove('show'); }
    progressFill.style.transition = 'none';
    progressFill.style.width = '0%';
    progressPercent.textContent = toFaLocal(0) + '٪';
    void progressFill.offsetWidth; // reflow برای اعمال شدن حالت اولیه پیش از شروع انیمیشن

    const DURATION = 2500;
    const start = performance.now();
    progressFill.style.transition = 'width ' + DURATION + 'ms cubic-bezier(.22,1,.36,1)';
    requestAnimationFrame(()=>{ progressFill.style.width = '100%'; });

    function tick(now){
      if(!progressOverlay.classList.contains('show')) return; // کاربر مودال را زودتر بست
      const t = Math.min(1, (now - start) / DURATION);
      progressPercent.textContent = toFaLocal(Math.round(t * 100)) + '٪';
      if(t < 1){
        requestAnimationFrame(tick);
      } else {
        onInstallDone();
      }
    }
    requestAnimationFrame(tick);
  }

  function onInstallDone(){
    progressFill.classList.add('done');
    progressPercent.classList.add('done');
    progressIcon.classList.add('done');
    progressIcon.textContent = '✅';
    progressTitle.textContent = 'برنامه نصب شد';
    progressSub.textContent = 'برای استفاده از برنامه، به صفحه برنامه‌های گوشی مراجعه فرمایید.';
    if(progressHint){ progressHint.textContent = ''; progressHint.classList.remove('show'); }
    progressPercent.textContent = toFaLocal(100) + '٪';
    // پس از نمایش کوتاه پیام موفقیت، مودال بسته می‌شود و برنامه (همین صفحه) به‌صورت خودکار نمایان/فعال می‌شود
    setTimeout(()=>{
      if(!progressOverlay.classList.contains('show')) return;
      closeInstallModal();
      try{ window.scrollTo({top:0, behavior:'smooth'}); }catch(e){}
      try{ window.focus(); }catch(e){}
    }, 1100);
  }

  // نکته فنی درباره حذف پرچم localStorage قبلی:
  // نسخه‌های پیشین این کد، بعد از اولین نصب موفق، یک پرچم در localStorage ثبت می‌کرد و
  // تا ابد پاپ‌آپ خودکار نصب را سرکوب می‌کرد. مشکل این بود که localStorage با حذف برنامه
  // از گوشی پاک نمی‌شود (چون به مرورگر تعلق دارد، نه به برنامه نصب‌شده)؛ نتیجه این بود که
  // حتی بعد از Uninstall کامل، پاپ‌آپ دیگر هرگز دوباره ظاهر نمی‌شد. رفع شد: تصمیم‌گیری
  // درباره نمایش پاپ‌آپ اکنون فقط بر اساس سیگنال زنده‌ی خود مرورگر است (فایر شدن رویداد
  // beforeinstallprompt)، نه یک پرچم ذخیره‌شده‌ی قدیمی. فراخوانی e.preventDefault() در ادامه
  // به‌تنهایی کافی است تا بنر خودکار خود کروم نمایش داده نشود و به‌جایش پاپ‌آپ ما باز شود؛
  // بنابراین نیازی به این پرچم دستی برای جلوگیری از تداخل دو پاپ‌آپ نبوده است.
  let autoInstallShownOnce = false;
  function isStandaloneMode(){
    try{
      return window.matchMedia('(display-mode: standalone)').matches
        || window.matchMedia('(display-mode: minimal-ui)').matches
        || window.navigator.standalone === true;
    }catch(e){ return false; }
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    // اگر همین الان داخل حالت نصب‌شده هستیم، پاپ‌آپ لازم نیست
    if(isStandaloneMode()) return;
    // مرورگر گاهی این رویداد را بیش از یک‌بار در همان بارگذاری صفحه ارسال می‌کند؛
    // deferredPrompt هر بار به‌روزرسانی می‌شود (تا دکمه نصب همیشه معتبر بماند)، اما باز شدنِ خودکارِ
    // پاپ‌آپ فقط یک‌بار در هر بارگذاری صفحه انجام می‌شود تا برای کاربر تکراری/دیرهنگام دیده نشود
    if(autoInstallShownOnce) return;
    autoInstallShownOnce = true;
    setInstallModalNormalMode();
    // کمی تأخیر تا Service Worker و UI صفحه کامل آماده شوند (جلوگیری از از دست رفتن deferredPrompt)
    setTimeout(function(){
      if(!deferredPrompt || isStandaloneMode()) return;
      openInstallModal();
    }, 600);
  });

  installBtn.addEventListener('click', async () => {
    installBtn.disabled = true;

    if (!deferredPrompt) {
      // مرورگر اجازه نصب واقعی (WebAPK) را هنوز صادر نکرده — به‌جای نمایش دروغین «نصب موفق»
      // که فقط یک میانبر ساده روی صفحه اصلی می‌سازد، کاربر را به روش دستی مرورگر راهنمایی می‌کنیم
      installBtn.disabled = false;
      installModalDesc.textContent = 'نصب خودکار هم‌اکنون در دسترس نیست. از منوی مرورگر (⋮) گزینه «نصب برنامه / Install app» را انتخاب کنید (نه «افزودن به صفحه اصلی»). چند ثانیه صبر کرده و دوباره تلاش کنید.';
      return;
    }

    let accepted = false;
    try{
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      accepted = choice.outcome === 'accepted';
    }catch(e){ accepted = false; }
    deferredPrompt = null;
    installBtn.disabled = false;

    if (accepted) {
      runInstallProgress();
    } else {
      closeInstallModal();
    }
  });
  installOverlay.addEventListener('click', (e)=>{ if(e.target === installOverlay) closeInstallModal(); });
  document.addEventListener('keydown', (e)=>{ if(e.key === 'Escape') closeInstallModal(); });

  if (isStandaloneMode()) {
    hideInstallOverlays();
  }
  window.addEventListener('appinstalled', ()=>{
    deferredPrompt = null;
    // اگر نوار پیشرفت نصب در حال نمایش است، اجازه بده خودش با انیمیشن کامل شود و ببندد؛
    // اینجا فقط وقتی مودال/پیشرفت باز نیست (مثلاً نصب از منوی خود مرورگر) آن را می‌بندیم
    if(progressOverlay && progressOverlay.classList.contains('show')) return;
    closeInstallModal();
  });

  // این تابع در بخش کلید فیزیکی برگشت هم استفاده می‌شود
  window.__closeInstallModal = closeInstallModal;
 }catch(e){}
})();


/* ===== بخش ۴: پاپ‌آپ راهنما + افکت Ripple ===== */
(function(){
 try{
  const overlay = document.getElementById('infoModalOverlay');
  const openBtn = document.getElementById('brandMark');
  const closeBtn = document.getElementById('infoModalClose');
  if(!overlay || !openBtn || !closeBtn) return;

  const HELP = {
    mainhome: {
      icon:'💧', title:'آب و فاضلاب استان فارس',
      sub:'با سپاس از حمایت جناب مهندس علی شبانی، مدیرعامل محترم آبفا فارس',
      desc:'این برنامه به شما کمک می‌کند به‌سرعت به آیین‌نامه عملیاتی، جداول الگوی مصرف و ماشین‌حساب صورتحساب دسترسی داشته باشید.',
      features:[
        '📘 آیین‌نامه: مطالعه و جست‌وجوی هفت فصل مقررات و شرایط تعرفه‌ها',
        '💧 جداول دهگانه: ظرفیت قراردادی بر اساس نوع کاربری مشترکین',
        '🧮 ماشین‌حساب: محاسبه حجم و مبلغ آب مصرفی از دکمه شناور پایین صفحه'
      ]
    },
    tables: {
      icon:'💧', title:'جداول دهگانه الگوی مصرف',
      sub:'راهنمای این بخش',
      desc:'در این بخش، ده جدول مرجع برای تعیین الگوی مصرف و ظرفیت قراردادی مشترکین غیرخانگی بر اساس نوع کاربری آن‌ها ارائه شده است.',
      features:[
        '📋 هر جدول مربوط به یک گروه از مشاغل (رستوران، هتل، بیمارستان و ...) است',
        '👆 با زدن روی هر جدول، تمام ردیف‌ها و مقادیر آن نمایش داده می‌شود',
        '↔️ در صورت طولانی بودن جدول، آن را به چپ و راست بکشید'
      ]
    },
    regs: {
      icon:'📘', title:'آیین‌نامه آب و فاضلاب',
      sub:'راهنمای این بخش',
      desc:'متن کامل هفت فصل آیین‌نامه عملیاتی و شرایط عمومی تعرفه‌های آب و فاضلاب در این بخش قرار دارد.',
      features:[
        '📑 فصل‌ها به‌ترتیب از فهرست قابل انتخاب و مطالعه هستند',
        '🔍 با جست‌وجوی یک کلمه یا عبارت، بندهای مرتبط در کل آیین‌نامه پیدا می‌شود',
        '🖍 نتایج جست‌وجو با رنگ مشخص در متن هایلایت می‌شوند'
      ]
    },
    calc: {
      icon:'🧮', title:'ماشین‌حساب مصرف و صورتحساب',
      sub:'راهنمای این بخش',
      desc:'با این ابزار می‌توانید حجم آب مجاز و غیرمجاز و همچنین مبلغ قابل‌محاسبه برای هر مشترک را بر اساس جداول دهگانه به دست آورید.',
      features:[
        '🔍 ابتدا دسته‌بندی مصرف را جست‌وجو و از لیست انتخاب کنید',
        '📐 تعداد واحد و در صورت نیاز مدت انشعاب غیرمجاز را وارد کنید',
        '💰 با زدن دکمه محاسبه، نتیجه به‌صورت کارت‌های جداگانه نمایش داده می‌شود',
        '📤 نتیجه را می‌توانید ذخیره یا با دیگران به اشتراک بگذارید'
      ]
    },
    lawshome: {
      icon:'📜', title:'قوانین مهم آب و فاضلاب',
      sub:'راهنمای این بخش',
      desc:'متن کامل سه قانون کلیدی حوزه آب و فاضلاب، به‌همراه مواد و تبصره‌های آن‌ها.',
      features:[
        '📜 یکی از سه قانون را برای مشاهده متن کامل انتخاب کنید',
        '🔍 با جست‌وجو، ماده یا موضوع مورد نظر را سریع پیدا کنید'
      ]
    }
  };
  const GROUP = {mainhome:'mainhome', tables:'tables', table:'tables', regs:'regs', chapter:'regs', calc:'calc', lawshome:'lawshome', lawschapter:'lawshome'};

  function openModal(){
    const key = GROUP[typeof currentScreen !== 'undefined' ? currentScreen : 'mainhome'] || 'mainhome';
    const h = HELP[key];
    document.getElementById('infoModalIcon').textContent = h.icon;
    document.getElementById('infoModalTitle').textContent = h.title;
    document.getElementById('infoModalSub').textContent = h.sub;
    document.getElementById('infoModalDesc').textContent = h.desc;
    document.getElementById('infoModalFeatures').innerHTML = h.features.map(f=>{
      const parts = f.split(' ');
      const ico = parts.shift();
      return `<li><span class="mf-ico">${ico}</span><span>${parts.join(' ')}</span></li>`;
    }).join('');
    overlay.classList.add('show');
    // یک ورودی تاریخچه اضافه می‌شود تا کلید فیزیکی برگشت بتواند دقیقاً همین کادر را ببندد
    try{ history.pushState({screen: (typeof currentScreen !== 'undefined' ? currentScreen : 'mainhome'), infoModal:true, installModal:false}, '', location.href); }catch(e){}
  }
  function closeModal(){
    if(!overlay.classList.contains('show')) return;
    if(history.state && history.state.infoModal){
      // همان ورودی تاریخچه‌ای که هنگام باز شدن اضافه شد را مصرف می‌کند تا پشته تاریخچه هم‌راستا بماند
      history.back();
    } else {
      overlay.classList.remove('show');
    }
  }
  openBtn.addEventListener('click', openModal);
  closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', (e)=>{ if(e.target === overlay) closeModal(); });
  document.addEventListener('keydown', (e)=>{ if(e.key === 'Escape') closeModal(); });
 }catch(e){}
})();

document.addEventListener('click', function(e){
  const el = e.target.closest('.table-card, .btn-mini, .calc-btn, .fab, .fab-back, .search-result-item, .brand-mark, .modal-close');
  if(!el) return;
  const rect = el.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height) * 1.4;
  const ripple = document.createElement('span');
  ripple.className = 'rippler';
  ripple.style.width = ripple.style.height = size + 'px';
  ripple.style.left = (e.clientX - rect.left - size/2) + 'px';
  ripple.style.top = (e.clientY - rect.top - size/2) + 'px';
  const prevPosition = getComputedStyle(el).position;
  if(prevPosition === 'static') el.style.position = 'relative';
  el.style.overflow = el.style.overflow || 'hidden';
  el.appendChild(ripple);
  setTimeout(()=> ripple.remove(), 600);
}, {passive:true});


/* ===== بخش ۵: حالت تیره/روشن، نوار پیشرفت، آفلاین، تاریخچه محاسبات، بنر به‌روزرسانی ===== */
/* ---------- ۱) حالت تیره/روشن ---------- */
(function(){
  try{
    const root = document.documentElement;
    const btn = document.getElementById('darkModeBtn');
    if(!btn) return;
    const KEY = 'abfa_theme';
    function apply(theme){
      if(theme === 'dark'){ root.setAttribute('data-theme','dark'); }
      else{ root.removeAttribute('data-theme'); }
    }
    let saved = null;
    try{ saved = localStorage.getItem(KEY); }catch(e){}
    // طبق درخواست: صرف‌نظر از تنظیم تیره/روشن سیستم‌عامل، حالت پیش‌فرض برنامه همیشه «روشن» است
    // و فقط زمانی تیره می‌شود که خود کاربر قبلاً آن را از داخل برنامه انتخاب کرده باشد
    apply(saved === 'dark' ? 'dark' : 'light');
    btn.addEventListener('click', ()=>{
      const isDark = root.getAttribute('data-theme') === 'dark';
      const next = isDark ? 'light' : 'dark';
      apply(next);
      try{ localStorage.setItem(KEY, next); }catch(e){}
    });
  }catch(e){}
})();

/* ---------- ۲) نوار پیشرفت بالای صفحه هنگام جابه‌جایی بین بخش‌ها ---------- */
(function(){
  try{
    const bar = document.getElementById('topProgressBar');
    const headerEl = document.getElementById('appbar');
    if(!bar || !headerEl) return;
    const obs = new MutationObserver(()=>{
      bar.classList.remove('run');
      void bar.offsetWidth;
      bar.classList.add('run');
    });
    obs.observe(headerEl, {attributes:true, attributeFilter:['class']});
  }catch(e){}
})();

/* ---------- ۳) نشانگر وضعیت آفلاین/آنلاین ---------- */
(function(){
  try{
    const ind = document.getElementById('offlineIndicator');
    if(!ind) return;
    function update(){
      if(navigator.onLine){ ind.classList.remove('show'); }
      else{ ind.classList.add('show'); }
    }
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    update();
  }catch(e){}
})();

/* ---------- ۴) دکمه بازگشت به بالا ---------- */
(function(){
  try{
    const btn = document.getElementById('backToTopBtn');
    if(!btn) return;
    function toggle(){
      if(window.scrollY > 420){ btn.classList.add('show'); }
      else{ btn.classList.remove('show'); }
    }
    window.addEventListener('scroll', toggle, {passive:true});
    btn.addEventListener('click', ()=> window.scrollTo({top:0, behavior:'smooth'}));
    toggle();
  }catch(e){}
})();

/* ---------- ۵) بنر به‌روزرسانی PWA (فقط خواندن وضعیت Service Worker موجود) ---------- */
(function(){
  try{
    if(!('serviceWorker' in navigator)) return;
    const banner = document.getElementById('updateBanner');
    const reloadBtn = document.getElementById('updateReloadBtn');
    if(!banner || !reloadBtn) return;
    // اگر پیش از این هیچ Service Worker صفحه را کنترل نمی‌کرده، یعنی این نصب/بازدید اولیه است؛
    // اولین controllerchange در این حالت صرفاً به‌دست‌گرفتن کنترل اولیه است، نه یک نسخه جدید،
    // پس نباید بنر «نسخه جدید در دسترس است» نمایش داده شود
    const hadControllerBefore = !!navigator.serviceWorker.controller;
    let refreshed = false;
    navigator.serviceWorker.addEventListener('controllerchange', ()=>{
      if(refreshed) return;
      if(!hadControllerBefore) return;
      refreshed = true;
      banner.classList.add('show');
    });
    navigator.serviceWorker.getRegistration().then(reg=>{
      if(!reg) return;
      reg.addEventListener('updatefound', ()=>{
        const nw = reg.installing;
        if(!nw) return;
        nw.addEventListener('statechange', ()=>{
          if(nw.state === 'installed' && navigator.serviceWorker.controller){
            banner.classList.add('show');
          }
        });
      });
    }).catch(()=>{});
    reloadBtn.addEventListener('click', ()=> window.location.reload());
  }catch(e){ /* در محیط‌های محدود (مثل پیش‌نمایش درون‌برنامه‌ای) بی‌صدا نادیده گرفته شود */ }
})();

/* ---------- ۶) تاریخچه محاسبات + اشتراک‌گذاری نتیجه (فقط خواندن نتایج نمایش‌داده‌شده، بدون تغییر منطق محاسبه) ---------- */
(function(){
 try{
  const KEY = 'abfa_calc_history';
  const historySection = document.getElementById('historySection');
  const historyList = document.getElementById('historyList');
  const shareBtn = document.getElementById('shareResultBtn');
  const saveBtn = document.getElementById('saveHistoryBtn');
  const clearBtn = document.getElementById('clearHistoryBtn');
  const calcBtn = document.getElementById('calcBtn');
  if(!calcBtn) return;

  function loadHistory(){
    try{ return JSON.parse(localStorage.getItem(KEY) || '[]'); }catch(e){ return []; }
  }
  function saveHistory(list){
    try{ localStorage.setItem(KEY, JSON.stringify(list.slice(0,10))); }catch(e){}
  }
  function renderHistory(){
    const list = loadHistory();
    if(list.length === 0){
      historySection.style.display = 'none';
      return;
    }
    historySection.style.display = 'block';
    historyList.innerHTML = list.map((h,i)=>`
      <div class="history-item">
        <div class="hi-main">
          <div class="hi-cat">${h.category || 'بدون دسته‌بندی'}</div>
          <div class="hi-meta">ظرفیت: ${h.stdVol} • دوره غیرمجاز: ${h.illVol} • مبلغ: ${h.illCost} ریال • ${h.date}</div>
        </div>
        <button class="hi-del" data-idx="${i}" title="حذف">✕</button>
      </div>`).join('');
    Array.from(historyList.querySelectorAll('.hi-del')).forEach(b=>{
      b.onclick = ()=>{
        const idx = parseInt(b.dataset.idx, 10);
        const l = loadHistory();
        l.splice(idx,1);
        saveHistory(l);
        renderHistory();
      };
    });
  }

  function currentResultText(){
    const catEl = document.querySelector('#selectedRowWrap .sr-text');
    const category = catEl ? catEl.textContent.split('\n')[0].trim() : '';
    const stdVol = (document.getElementById('stdVolOut')||{}).textContent || '۰ m³';
    const illVol = (document.getElementById('illVolOut')||{}).textContent || '۰ m³';
    const illCost = (document.getElementById('illCostOut')||{}).textContent || '۰ ریال';
    return {category, stdVol, illVol, illCost};
  }

  if(saveBtn){
    saveBtn.addEventListener('click', ()=>{
      const r = currentResultText();
      const list = loadHistory();
      list.unshift({
        category: r.category,
        stdVol: r.stdVol,
        illVol: r.illVol,
        illCost: r.illCost,
        date: new Date().toLocaleDateString('fa-IR', {year:'numeric', month:'2-digit', day:'2-digit'})
      });
      saveHistory(list);
      renderHistory();
      const prevText = saveBtn.textContent;
      saveBtn.textContent = '✔ ذخیره شد';
      setTimeout(()=> saveBtn.textContent = prevText, 1400);
    });
  }

  if(clearBtn){
    clearBtn.addEventListener('click', ()=>{
      saveHistory([]);
      renderHistory();
    });
  }

  if(shareBtn){
    shareBtn.addEventListener('click', async ()=>{
      const r = currentResultText();
      const summaryEl = document.getElementById('calcSummaryCard');
      const summaryLine = (summaryEl && summaryEl.style.display !== 'none' && summaryEl.textContent) ? summaryEl.textContent + '\n' : '';
      const text = `آب و فاضلاب استان فارس\n${summaryLine}${r.category ? 'دسته‌بندی: ' + r.category + '\n' : ''}ظرفیت قراردادی: ${r.stdVol}\nحجم دوره غیرمجاز: ${r.illVol}\nمبلغ دوره غیرمجاز: ${r.illCost}`;
      if(navigator.share){
        try{
          await navigator.share({title:'نتیجه محاسبه', text});
          return;
        }catch(e){
          if(e && e.name === 'AbortError') return; // کاربر خودش انصراف داد؛ کاری انجام نشود
          // در غیر این صورت به روش کپی ادامه بده
        }
      }
      try{
        await navigator.clipboard.writeText(text);
        const prevText = shareBtn.textContent;
        shareBtn.textContent = '✔ در کلیپ‌بورد کپی شد';
        setTimeout(()=> shareBtn.textContent = prevText, 1600);
      }catch(e){
        // آخرین راه‌حل: نمایش متن برای کپی دستی
        window.prompt('برنامه‌ای برای اشتراک‌گذاری یا دسترسی به کلیپ‌بورد یافت نشد؛ متن زیر را کپی کنید:', text);
      }
    });
  }

  renderHistory();
 }catch(e){}
})();
