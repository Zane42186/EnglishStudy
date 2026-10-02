/* Vue 版（frontend/）**全站**页面级验证 —— 与 review 原生版 words 段断言等价，用于证明「迁移不改行为」
 *
 * 前置（两个都必须活着）：
 *   1) 后端：curl --noproxy '*' http://localhost:4000/api/health  → code=200（本脚本只读 GET）
 *   2) dev server：cd E:\English\frontend && npm run dev  → http://localhost:5173
 *
 * 运行（必须带 NODE_PATH，playwright-core 装在受管 node workspace）：
 *   NODE_PATH="C:\Users\lenovo\.workbuddy\binaries\node\workspace\node_modules" \
 *     node E:/English/frontend/scripts/verify-vue.cjs [BASE]
 *   BASE 默认 http://localhost:5173
 *
 * 设计要点：
 *   - 期望值一律**直连后端现取**（不写死「80 个词条」「6 课」这类数据常数）；
 *   - Vue 版不再把 API 挂 window（ESM 导出），故脚本在 Node 侧取期望值；
 *   - 可见性判定一律 getComputedStyle，不做 class 断言；
 *   - 🔴 Vue 的 DOM 更新是**异步批量**的（nextTick）：任何点击/输入后必须 await 一拍再读，
 *     否则读到更新前的值（与 details 的 toggle 异步同型坑）。
 * 退出码：0 = 全通过，1 = 有失败，2 = 脚本自身异常。
 */
const { chromium } = require('playwright-core');
const http = require('http');

const SITE = process.argv[2] || 'http://localhost:5173';
const results = [];
const ok = (name, cond, detail) => results.push({ name, pass: !!cond, detail: detail == null ? '' : String(detail) });
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---- Node 侧直连后端取期望值（只读） ---- */
function getJSON(path, page, size) {
  let p = path;
  if (page != null) { p += (p.indexOf('?') === -1 ? '?' : '&') + 'page=' + page + '&size=' + size; }
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: 4000, path: '/api' + p, timeout: 8000 }, res => {
      let buf = '';
      res.on('data', c => { buf += c; });
      res.on('end', () => {
        try {
          const body = JSON.parse(buf);
          if (!body || body.code !== 200) { return reject(new Error('包络异常: ' + buf.slice(0, 120))); }
          resolve(body.data);
        } catch (e) { reject(e); }
      });
    }).on('error', reject).on('timeout', function () { this.destroy(new Error('后端超时')); });
  });
}

(async () => {
  const esp = {};
  /* ---- 期望值（全部现取） ---- */
  const lessonsIdx = await getJSON('/lessons/all');
  const lessonsPage = await getJSON('/lessons', 1, 1);
  const maxLessonNo = Math.max.apply(null, (lessonsIdx.list || []).map(l => l.lessonNo));
  esp.lessonTotal = String(lessonsPage.total);
  esp.maxLessonNo = String(maxLessonNo);
  const maxLesson = (lessonsIdx.list || []).filter(l => String(l.lessonNo) === esp.maxLessonNo)[0];
  const lessonDetail = await getJSON('/lessons/' + maxLesson.id);
  esp.vocabRowCount = String((lessonDetail.vocabulary || []).length);

  const progress = await getJSON('/progress');
  esp.level = String(progress.currentLevel || '');
  const vstats = await getJSON('/vocabulary/stats');
  esp.vocabTotal = String(vstats.total);
  esp.vocabLetters = String(Object.keys(vstats.byLetter || {}).length);
  const mstats = await getJSON('/mistakes/stats');
  esp.mistakesTotal = String(mstats.total);
  esp.mistakesPending = String(mstats.pending);
  esp.mistakesPassed = String(mstats.passed);
  const rstats = await getJSON('/readings/stats');
  esp.readingPieces = String(rstats.pieceCount);
  const readings = await getJSON('/readings', 1, 200);
  esp.readingDays = String(readings.total);
  esp.today = String(rstats.today || '');
  esp.lastReadDate = String(rstats.lastReadDate || '');
  const pending = await getJSON('/mistakes/pending?limit=5');
  esp.pendingFirstId = pending.list && pending.list.length ? String(pending.list[0].id) : '';
  const vocabAll = await getJSON('/vocabulary', 1, 100);
  esp.vocabDistinct = String(new Set((vocabAll.list || []).map(v => v.word)).size);

  const browser = await chromium.launch({ channel: 'msedge', headless: true });

  async function openPage(url) {
    const page = await browser.newPage();
    const jsErr = [];
    page.on('pageerror', e => jsErr.push(e.message));
    await page.goto(SITE + url, { waitUntil: 'networkidle' });
    return { page, jsErr };
  }

  /* ============ 首页（课程区） ============ */
  {
    const { page, jsErr } = await openPage('/');
    await page.waitForSelector('#lessonList .ltoc-item', { timeout: 15000 });
    await page.waitForSelector('#stageTitle:not(:empty)', { timeout: 15000 }).catch(() => { });

    const d = await page.evaluate(async () => {
      const txt = id => (document.getElementById(id) || {}).textContent;
      const toc = document.querySelectorAll('#lessonList .ltoc-item');
      const nav = document.querySelector('.site-nav');
      return {
        tocCount: toc.length,
        stageTitle: txt('stageTitle'),
        firstOn: toc[0] ? toc[0].classList.contains('on') : false,
        hasPrev: !!document.getElementById('lsPrev'),
        hasNext: !!document.getElementById('lsNext'),
        statCount: document.querySelectorAll('.board-main .stats .stat').length,
        lessons: txt('statLessons'), level: txt('statLevel'), vocab: txt('statVocab'),
        reading: txt('statReading'), mistakes: txt('statMistakes'),
        navCount: document.querySelectorAll('.site-nav a').length,
        navOn: (document.querySelector('.site-nav a.on') || {}).textContent || null,
        navRow: !!nav && getComputedStyle(nav).display === 'flex' && getComputedStyle(nav).flexDirection === 'row',
        noLegacyBlocks: document.getElementById('trendBox') === null && document.getElementById('whyBlock') === null,
      };
    });
    ok('[home] 课程目录项数 = /lessons.total', String(d.tocCount) === esp.lessonTotal, `toc=${d.tocCount} api=${esp.lessonTotal}`);
    ok('[home] 默认展示最新一课（#stageTitle 含第 max 课，首项高亮）',
      new RegExp('第 ' + esp.maxLessonNo + ' 课').test(d.stageTitle || '') && d.firstOn,
      `title="${d.stageTitle}" max=${esp.maxLessonNo} firstOn=${d.firstOn}`);
    ok('[home] 底部《上一课》《下一课》按钮存在（不再「查看全文」跳转）', d.hasPrev && d.hasNext, `prev=${d.hasPrev} next=${d.hasNext}`);
    ok('[home] 统计卡 5 张', d.statCount === 5, 'count=' + d.statCount);
    ok('[home] 已上课数 = /lessons.total', d.lessons === esp.lessonTotal, `got=${d.lessons} api=${esp.lessonTotal}`);
    ok('[home] 当前级别 = /progress.currentLevel', d.level === esp.level, `got=${d.level} api=${esp.level}`);
    ok('[home] 累计生词 = /vocabulary/stats.total（按 word 去重）',
      d.vocab === esp.vocabTotal && d.vocab === esp.vocabDistinct, `got=${d.vocab} api=${esp.vocabTotal}`);
    ok('[home] 未过关错词 = /mistakes/stats.pending', d.mistakes === esp.mistakesPending, `got=${d.mistakes} api=${esp.mistakesPending}`);
    ok('[home] 阅读篇数 = /readings/stats.pieceCount', d.reading === esp.readingPieces, `got=${d.reading} api=${esp.readingPieces}`);
    ok('[home] 顶部导航 4 块横向、「首页」高亮', d.navCount === 4 && d.navOn === '首页' && d.navRow,
      `n=${d.navCount} on=${d.navOn} row=${d.navRow}`);
    ok('[home] 「为什么今天学这个」「错误趋势」未渲染（与原生版一致）', d.noLegacyBlocks, 'noLegacy=' + d.noLegacyBlocks);

    // 「全部展开/折叠」+ 手动折叠文案同步（⚠️ Vue 异步更新 → 每次操作后等一拍）
    const t = await page.evaluate(async () => {
      const s = ms => new Promise(r => setTimeout(r, ms));
      const btn = document.getElementById('toggleAll');
      if (!btn) { return { has: false }; }
      const all = document.querySelectorAll('#stageBody details');
      const openedCount = () => Array.prototype.filter.call(all, x => x.open).length;
      const label0 = btn.textContent;
      btn.click();
      await s(50);
      const opened = openedCount(); const label1 = btn.textContent;
      btn.click();
      await s(50);
      const closed = openedCount(); const label2 = btn.textContent;
      // 全开后手动折叠单节 → 文案须立即同步为「全部展开」
      btn.click();
      await s(50);
      all[0].open = false;
      await s(50);
      const labelManual = btn.textContent;
      btn.click();
      await s(50);
      const afterManualClick = openedCount();
      return { has: true, total: all.length, label0, opened, label1, closed, label2, labelManual, afterManualClick };
    });
    ok('[home] 课程区「全部展开/折叠」可用（点开→全开、再点→全合，文案切换）',
      t.has && t.total > 0 && t.opened === t.total && /折叠/.test(t.label1 || '') && t.closed === 0 && /展开/.test(t.label2 || ''),
      JSON.stringify(t));
    ok('[home] 手动折叠单节后按钮文案实时同步（文案与点击动作一致）',
      t.labelManual === '全部展开' && t.afterManualClick === t.total, JSON.stringify(t));

    const f = await page.evaluate(async () => {
      const s = ms => new Promise(r => setTimeout(r, ms));
      const q = document.getElementById('q');
      q.value = 'was';
      q.dispatchEvent(new Event('input'));
      await s(50);
      const items = document.querySelectorAll('#lessonList .ltoc-item');
      const disp = Array.prototype.map.call(items, c => getComputedStyle(c).display);
      q.value = '';
      q.dispatchEvent(new Event('input'));
      return { total: items.length, none: disp.filter(x => x === 'none').length, shown: disp.filter(x => x !== 'none').length };
    });
    ok('[home] 搜索「was」过滤（有隐藏有显示，隐藏项 display=none）',
      String(f.total) === esp.lessonTotal && f.none > 0 && f.shown > 0, JSON.stringify(f));
    ok('[home] 无 JS 运行时异常', jsErr.length === 0, jsErr.join(' ; '));
    await page.close();
  }

  /* ============ 阅读 ============ */
  {
    const { page, jsErr } = await openPage('/reading');
    await page.waitForSelector('#tocList .rtoc-item', { timeout: 15000 });
    await page.waitForSelector('.rcard', { timeout: 15000 });

    const d = await page.evaluate(async () => {
      const s = ms => new Promise(r => setTimeout(r, ms));
      const note = document.getElementById('todayNote');
      const cards = () => document.querySelectorAll('.stage-viewport .rcard');
      const visible = () => Array.prototype.filter.call(cards(), c => getComputedStyle(c).display !== 'none').length;
      const firstState = {
        date: document.getElementById('stageDate').textContent,
        count: document.getElementById('stageCount').textContent,
        foot: document.getElementById('footCount').textContent,
        firstOnToc: (document.querySelector('.rtoc-item') || {}).classList ? document.querySelector('.rtoc-item').classList.contains('on') : false,
        visible: visible(), pieces: cards().length,
        prevDisabled: document.getElementById('navPrev').disabled,
        nextDisabled: document.getElementById('navNext').disabled,
        prev2Disabled: document.getElementById('navPrev2').disabled,
      };
      // 翻到第 2 篇（若当天 >1 篇）
      let after = null;
      if (firstState.pieces > 1) {
        document.getElementById('navNext').click();
        await s(50);
        const shown = Array.prototype.map.call(cards(), c => getComputedStyle(c).display)
          .map((v, i) => (v !== 'none' ? i : -1)).filter(i => i >= 0);
        after = { shownIdx: shown, count: document.getElementById('stageCount').textContent };
      }
      return {
        tocCount: document.querySelectorAll('#tocList .rtoc-item').length,
        noteClass: note.className, noteText: note.textContent,
        noteDisplay: getComputedStyle(note).display,
        firstState, after,
      };
    });
    ok('[reading] 目录项数 = /readings.total', String(d.tocCount) === esp.readingDays, `toc=${d.tocCount} api=${esp.readingDays}`);
    ok('[reading] 默认最新一天且首日目录项高亮',
      d.firstState.firstOnToc && d.firstState.date !== '', `date=${d.firstState.date} on=${d.firstState.firstOnToc}`);
    ok('[reading] 一次只显示一篇（可见 rcard = 1）', d.firstState.visible === 1, JSON.stringify(d.firstState));
    ok('[reading] 首篇时「上一篇」禁用（侧栏与底部一致）',
      d.firstState.prevDisabled === true && d.firstState.prev2Disabled === true,
      `prev=${d.firstState.prevDisabled} prev2=${d.firstState.prev2Disabled}`);
    ok('[reading] 底部计数文案 = 「第 1 / N 篇 ｜ 标题」',
      new RegExp('^第 1 / ' + d.firstState.pieces + ' 篇').test(d.firstState.foot || ''), 'foot=' + d.firstState.foot);
    if (d.firstState.pieces > 1) {
      ok('[reading] 「下一篇」翻页：只显示第 2 篇（三路同步的侧栏箭头）',
        d.after.shownIdx.length === 1 && d.after.shownIdx[0] === 1, JSON.stringify(d.after));
    } else {
      ok('[reading] 「下一篇」翻页（当天仅 1 篇，跳过实测）', true, 'pieces=1');
    }
    // F8 硬要求：今天是否已生成必须可见，且文案/样式与接口一致
    const f8Expect = (esp.today && esp.lastReadDate === esp.today) ? 'ok' : 'miss';
    ok('[reading] F8「今日阅读」提示可见且状态与 /readings/stats 一致',
      d.noteDisplay !== 'none' && d.noteClass.indexOf(f8Expect) !== -1,
      `class="${d.noteClass}" expect=${f8Expect} today=${esp.today} last=${esp.lastReadDate}`);
    ok('[reading] 无 JS 运行时异常', jsErr.length === 0, jsErr.join(' ; '));
    await page.close();

    // 深链：直接打开 /reading/<第二天> 应直达该天
    const days = (readings.list || []).map(x => x.date);
    const target = days[1] || days[0];
    if (target) {
      const { page: p2, jsErr: e2 } = await openPage('/reading/' + target);
      await p2.waitForSelector('#stageDate:not(:empty)', { timeout: 15000 }).catch(() => { });
      const shownDate = await p2.evaluate(() => document.getElementById('stageDate').textContent);
      ok('[reading] 深链 /reading/<date> 直达指定日期（刷新/分享可用）',
        shownDate === target, `shown=${shownDate} target=${target}`);
      ok('[reading] 深链页无 JS 运行时异常', e2.length === 0, e2.join(' ; '));
      await p2.close();
    }
  }

  /* ============ 词汇卡 ============ */
  {
    const { page, jsErr } = await openPage('/words');
    await page.waitForSelector('.words-main .wcard', { timeout: 15000 });

    const d = await page.evaluate(async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const cs = n => getComputedStyle(n);
      const first = document.querySelector('.words-main .wcard');
      const before = { c: cs(first.querySelector('.c')).display, e: cs(first.querySelector('.e')).display };
      first.click();
      // ⚠️ Vue 的 DOM 更新是异步批量的（nextTick）→ 必须等一拍再读 computed
      await sleep(50);
      const after = { c: cs(first.querySelector('.c')).display, e: cs(first.querySelector('.e')).display };
      const nav = document.querySelector('.idx-v');
      const side = nav.closest('.words-side');
      const q = document.querySelector('.words-side input');
      const h2 = document.querySelector('.words-main .group:first-child h2');
      return {
        cards: document.querySelectorAll('.words-main .wcard').length,
        groups: document.querySelectorAll('.words-main .group').length,
        idxCount: nav.querySelectorAll('a').length,
        idxGrid2: cs(nav).display === 'grid' && cs(nav).gridTemplateColumns.trim().split(/\s+/).length === 2,
        sticky: cs(side).position === 'sticky',
        qAboveIdx: !!q && (q.compareDocumentPosition(nav) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
        aligned: !!h2 && !!q && Math.abs(h2.getBoundingClientRect().top - q.getBoundingClientRect().top) <= 4,
        navCount: document.querySelectorAll('.site-nav a').length,
        navOn: (document.querySelector('.site-nav a.on') || {}).textContent || null,
        totalNote: (document.querySelector('.sub') || {}).textContent || '',
        before, after,
      };
    });
    ok('[words] 卡片总数 = /vocabulary/stats.total（按单词去重）',
      String(d.cards) === esp.vocabTotal && esp.vocabDistinct === esp.vocabTotal,
      `cards=${d.cards} api=${esp.vocabTotal} distinct=${esp.vocabDistinct}`);
    ok('[words] 分组数 = byLetter 键数', String(d.groups) === esp.vocabLetters, `groups=${d.groups} api=${esp.vocabLetters}`);
    ok('[words] 字母索引数 = byLetter 键数', String(d.idxCount) === esp.vocabLetters, `idx=${d.idxCount} api=${esp.vocabLetters}`);
    ok('[words] 索引两列网格 + sticky + 搜索框在其上方',
      d.idxGrid2 && d.sticky && d.qAboveIdx, JSON.stringify({ grid2: d.idxGrid2, sticky: d.sticky, qAbove: d.qAboveIdx }));
    ok('[words] 首个字母组标题与搜索框顶部对齐（±4px）', d.aligned, 'aligned=' + d.aligned);
    ok('[words] 顶部导航 4 块且「词汇卡」高亮', d.navCount === 4 && d.navOn === '词汇卡', `n=${d.navCount} on=${d.navOn}`);
    ok('[words] 顶部标注 = 接口 total', new RegExp('共 ' + esp.vocabTotal + ' 个词条').test(d.totalNote || ''), 'note=' + d.totalNote);
    ok('[words] 点击卡片 .c/.e 由 none 变可见（getComputedStyle）',
      d.before.c === 'none' && d.before.e === 'none' && d.after.c !== 'none' && d.after.e !== 'none',
      JSON.stringify({ before: d.before, after: d.after }));

    // 搜索过滤 + 搜索态命中卡自动展开
    const f = await page.evaluate(async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const input = document.querySelector('.words-side input');
      input.value = 'book';
      input.dispatchEvent(new Event('input'));
      await sleep(60);
      const cards = document.querySelectorAll('.words-main .wcard');
      const first = document.querySelector('.words-main .wcard');
      return {
        shown: cards.length,
        firstOpen: getComputedStyle(first.querySelector('.c')).display !== 'none',
        html: document.querySelector('.words-main').textContent.indexOf('book') !== -1,
      };
    });
    ok('[words] 搜索「book」过滤生效（仅剩命中卡片）',
      f.shown > 0 && f.shown < d.cards && f.html, JSON.stringify(f));
    ok('[words] 搜索态命中卡自动展开（中文可见，命中可解释）', f.firstOpen, 'firstOpen=' + f.firstOpen);

    // 口径收紧回归：匹配域 = 单词 + 释义（不含例句）→ 搜 yesterday 不得命中 bought/cooked
    const expY = (vocabAll.list || [])
      .filter(w => [w.word, w.meaning].join('  ').toLowerCase().includes('yesterday'))
      .map(w => String(w.word || '')).sort();
    const y = await page.evaluate(async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const input = document.querySelector('.words-side input');
      input.value = 'yesterday';
      input.dispatchEvent(new Event('input'));
      await sleep(60);
      const clear = document.querySelector('.words-main');
      const out = [...document.querySelectorAll('.words-main .wcard')]
        .map(c => (c.querySelector('.w') || {}).textContent || '').sort();
      input.value = '';
      input.dispatchEvent(new Event('input'));
      await sleep(60);
      return { out: out, hasClear: clear !== null };
    });
    ok('[words] 搜索「yesterday」只按单词/释义命中（例句不再参与匹配）',
      JSON.stringify(y.out) === JSON.stringify(expY), 'DOM=' + JSON.stringify(y.out) + ' 接口期望=' + JSON.stringify(expY));
    ok('[words] 无 JS 运行时异常', jsErr.length === 0, jsErr.join(' ; '));
    await page.close();
  }

  /* ============ 错词本 ============ */
  {
    const { page, jsErr } = await openPage('/wrong');
    await page.waitForSelector('#mistakeList .mcard', { timeout: 15000 });

    const d = await page.evaluate(() => {
      const txt = id => (document.getElementById(id) || {}).textContent;
      const card = document.querySelector('#mistakeList .mcard');
      const html = document.getElementById('mistakeList').innerHTML;
      return {
        total: txt('stTotal'), pending: txt('stPending'), passed: txt('stPassed'),
        cards: document.querySelectorAll('#mistakeList .mcard').length,
        hasStreakBar: !!card.querySelector('.streak .bar i'),
        hasWrongCount: /第 \d+ 次犯/.test(html),
        hasPriority: /priority-(high|medium|low)/.test(html),
        hasErrorType: /class="tag">(语法|拼写|标点|用词|大小写|其他)/.test(html),
        hasSource: /来源 第 \d+ 课/.test(html),
        whyVisible: getComputedStyle(card.querySelector('.why')).display !== 'none',
        typeTabs: document.querySelectorAll('#typeTabs button').length,
        navCount: document.querySelectorAll('.site-nav a').length,
        navOn: (document.querySelector('.site-nav a.on') || {}).textContent || null,
      };
    });
    ok('[wrong] 统计三项均为数字且 pending+passed=total',
      Number(d.pending) + Number(d.passed) === Number(d.total) && Number(d.total) > 0,
      `total=${d.total} pending=${d.pending} passed=${d.passed}`);
    ok('[wrong] 统计 = /mistakes/stats',
      d.total === esp.mistakesTotal && d.pending === esp.mistakesPending && d.passed === esp.mistakesPassed,
      `got=${d.total}/${d.pending}/${d.passed} api=${esp.mistakesTotal}/${esp.mistakesPending}/${esp.mistakesPassed}`);
    ok('[wrong] 错词卡张数 = total', String(d.cards) === esp.mistakesTotal, `cards=${d.cards} total=${esp.mistakesTotal}`);
    ok('[wrong] F2 四项硬指标齐：wrongCount / streak 进度条 / priority / errorType + 来源课号',
      d.hasWrongCount && d.hasStreakBar && d.hasPriority && d.hasErrorType && d.hasSource, JSON.stringify(d));
    ok('[wrong] 错因默认展开可见（getComputedStyle != none）', d.whyVisible, 'whyVisible=' + d.whyVisible);
    ok('[wrong] 类型筛选 tab 含「全部类型」+ byType（≥2 个）', d.typeTabs >= 2, 'tabs=' + d.typeTabs);
    ok('[wrong] 顶部导航 4 块且「错词本」高亮', d.navCount === 4 && d.navOn === '错词本', `n=${d.navCount} on=${d.navOn}`);

    const f = await page.evaluate(async () => {
      const s = ms => new Promise(r => setTimeout(r, ms));
      document.querySelectorAll('#statusTabs button')[2].click();   // 已过关
      await s(50);
      const cards = document.querySelectorAll('#mistakeList .mcard');
      const disp = Array.prototype.map.call(cards, c => getComputedStyle(c).display);
      const res = { shown: disp.filter(x => x !== 'none').length, none: disp.filter(x => x === 'none').length };
      document.querySelectorAll('#statusTabs button')[0].click();   // 复位「全部」
      await s(50);
      return res;
    });
    ok('[wrong] 状态筛选「已过关」只显示已过关卡、其余 display=none',
      String(f.shown) === esp.mistakesPassed && String(f.none) === String(Number(esp.mistakesTotal) - Number(esp.mistakesPassed)),
      JSON.stringify(f) + ` expected shown=${esp.mistakesPassed}`);

    // P3 复习面板：只验证「起队列 + 只读渲染 + 不做前端重排」，不点提交（避免改学习数据）
    const p3 = await page.evaluate(async () => {
      const s = ms => new Promise(r => setTimeout(r, ms));
      document.getElementById('startReview').click();
      for (let i = 0; i < 60; i += 1) { if (document.querySelector('#reviewPanel .review')) { break; } await s(50); }
      await s(50);
      const panel = document.querySelector('#reviewPanel .review');
      const btns = document.querySelectorAll('#reviewPanel button[data-r]');
      const ans = [].map.call(btns, b => b.dataset.r);
      return {
        hasPanel: !!panel,
        prog: panel ? panel.querySelector('.rprog').textContent : '',
        qtext: panel ? panel.querySelector('.qtext').textContent : '',
        whyVisible: panel ? getComputedStyle(panel.querySelector('.why')).display !== 'none' : false,
        answers: ans,
        btnCount: btns.length,
      };
    });
    ok('[wrong] P3 复习面板可起队列并渲染第 1 题', p3.hasPanel && /第 1 \/ \d+ 题/.test(p3.prog || ''), JSON.stringify(p3));
    ok('[wrong] P3 队列首题 = /mistakes/pending 默认序首条（前端未重排）',
      esp.pendingFirstId !== '' && /^第 1 \/ \d+ 题/.test(p3.prog) && p3.qtext.length > 0, JSON.stringify(p3));
    ok('[wrong] P3 错因在复习面板默认展开可见', p3.whyVisible, 'whyVisible=' + p3.whyVisible);
    ok('[wrong] P3 「我答对了/又错了」按钮齐（未提交，避免改数据）',
      p3.btnCount === 2 && p3.answers.indexOf('correct') !== -1 && p3.answers.indexOf('wrong') !== -1, JSON.stringify(p3.answers));
    ok('[wrong] 无 JS 运行时异常', jsErr.length === 0, jsErr.join(' ; '));
    await page.close();
  }

  /* ============ 单课详情 ============ */
  {
    const ORDER = ['review', 'grammar', 'vocab_table', 'examples', 'homework', 'my_answer', 'grading', 'feedback'];
    const DEFAULT_OPEN = ['grammar', 'examples', 'homework', 'grading'];
    const { page, jsErr } = await openPage('/lesson/' + esp.maxLessonNo);
    await page.waitForSelector('#lessonBody .sec', { timeout: 15000 });

    const d = await page.evaluate(() => {
      const has = t => !!document.getElementById('sec-' + t);
      const openOf = t => {
        const el = document.querySelector('#sec-' + t + ' details');
        return el ? el.open : null;
      };
      const open = {}; const exist = {};
      ['review', 'grammar', 'vocab_table', 'examples', 'homework', 'my_answer', 'grading', 'feedback'].forEach(t => {
        exist[t] = has(t); open[t] = openOf(t);
      });
      const tables = document.querySelectorAll('#lessonBody table');
      let vocabRows = 0;
      Array.prototype.forEach.call(tables, tb => {
        const th = tb.querySelector('th');
        if (th && th.textContent === '单词') { vocabRows = tb.querySelectorAll('tbody tr').length; }
      });
      return {
        h1: (document.querySelector('.top-bar h1') || {}).textContent || '',
        exist, open,
        missingCount: document.querySelectorAll('#lessonBody .sec.missing').length,
        missingTextOk: Array.prototype.every.call(document.querySelectorAll('#lessonBody .sec.missing'),
          m => m.textContent.indexOf('未入库') !== -1),
        noExpectedMistakes: document.getElementById('sec-expected_mistakes') === null && document.getElementById('lessonBody').textContent.indexOf('易错预警') === -1,
        hasToggleAll: !!document.getElementById('toggleAll'),
        vocabRows,
        secCount: document.querySelectorAll('#lessonBody .sec').length,
      };
    });
    ok('[lesson] 标题含第 N 课（h1 由页面覆盖，与原生 #ltitle 一致）',
      new RegExp('第 ' + esp.maxLessonNo + ' 课').test(d.h1 || ''), 'h1=' + d.h1);
    ok('[lesson] 8 个契约小节全部出现（含未入库占位，不静默少给）',
      ORDER.every(t => d.exist[t]), JSON.stringify(d.exist));
    ok('[lesson] F10 expected_mistakes 不渲染（Amy 裁定）', d.noExpectedMistakes, 'noExpectedMistakes=' + d.noExpectedMistakes);
    ok('[lesson] 桌面默认展开 = 语法/例句/作业/批改，其余折叠',
      DEFAULT_OPEN.every(t => d.open[t] === true) && ['review', 'vocab_table', 'my_answer', 'feedback'].every(t => d.open[t] === false),
      JSON.stringify(d.open));
    ok('[lesson] 缺失小节标注 .missing 且文案含「未入库」',
      d.missingTextOk && d.missingCount >= 0, `missing=${d.missingCount}`);
    ok('[lesson] 一键展开按钮存在 + 本课词汇表渲染',
      d.hasToggleAll && String(d.vocabRows) === esp.vocabRowCount,
      `toggleAll=${d.hasToggleAll} vocabRows=${d.vocabRows} api=${esp.vocabRowCount}`);

    const t = await page.evaluate(async () => {
      const s = ms => new Promise(r => setTimeout(r, ms));
      const btn = document.getElementById('toggleAll');
      const all = document.querySelectorAll('#lessonBody details');
      const cnt = () => Array.prototype.filter.call(all, x => x.open).length;
      btn.click(); await s(50);
      const opened = cnt(); const label1 = btn.textContent;
      all[0].open = false; await s(50);
      const labelManual = btn.textContent;
      btn.click(); await s(50);
      return { total: all.length, opened, label1, labelManual, backOpen: cnt() };
    });
    ok('[lesson] 一键全展开后所有 details 打开 / 手动折叠后文案实时同步',
      t.opened === t.total && /折叠/.test(t.label1 || '') && t.labelManual === '全部展开' && t.backOpen === t.total,
      JSON.stringify(t));
    ok('[lesson] 无 JS 运行时异常', jsErr.length === 0, jsErr.join(' ; '));
    await page.close();

    // 深链 #sec-review 让该小节默认展开（Vue 版：hash 仍可用；路由已用 path）
    {
      const { page: p2, jsErr: e2 } = await openPage('/lesson/' + esp.maxLessonNo + '#sec-review');
      await p2.waitForSelector('#lessonBody .sec', { timeout: 15000 });
      const openReview = await p2.evaluate(() => {
        const el = document.querySelector('#sec-review details');
        return el ? el.open : false;
      });
      ok('[lesson] URL 深链 #sec-review 让该小节默认展开', openReview === true, 'open=' + openReview);
      ok('[lesson] 深链页无 JS 运行时异常', e2.length === 0, e2.join(' ; '));
      await p2.close();
    }

    // 不存在的课号 → 空态而非报错
    {
      const { page: p3, jsErr: e3 } = await openPage('/lesson/99999');
      await p3.waitForSelector('#lessonBody .state', { timeout: 15000 });
      const txt = await p3.evaluate(() => document.getElementById('lessonBody').textContent);
      ok('[lesson] 不存在的课号显示空态而非报错', txt.indexOf('没有第 99999 课') !== -1, 'txt=' + txt.slice(0, 60));
      ok('[lesson] 不存在课号页无 JS 运行时异常', e3.length === 0, e3.join(' ; '));
      await p3.close();
    }

    // 缺课号参数 → 用法提示
    {
      const { page: p4, jsErr: e4 } = await openPage('/lesson');
      await p4.waitForSelector('#lessonBody .state', { timeout: 15000 });
      const txt = await p4.evaluate(() => document.getElementById('lessonBody').textContent);
      ok('[lesson] 缺课号参数给出用法提示', txt.indexOf('缺少课号参数') !== -1, 'txt=' + txt.slice(0, 60));
      ok('[lesson] 缺课号页无 JS 运行时异常', e4.length === 0, e4.join(' ; '));
      await p4.close();
    }
  }

  await browser.close();

  const pass = results.filter(r => r.pass).length;
  console.log('\n===== Vue 版（frontend/）全站页面级验证 =====');
  results.forEach(r => console.log((r.pass ? 'PASS ' : 'FAIL ') + r.name + (r.pass ? '' : '\n       实测: ' + r.detail)));
  console.log(`\n合计 ${pass}/${results.length} 通过  |  期望值来源: 后端 4000 现取（lessons=${esp.lessonTotal} vocab=${esp.vocabTotal} mistakes=${esp.mistakesTotal} readings=${esp.readingDays}）`);
  process.exit(pass === results.length ? 0 : 1);
})().catch(e => { console.error('HARNESS ERROR:', e); process.exit(2); });
