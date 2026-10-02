/* 真机验证：4 个改造后的页面（index / words / wrong / lesson）
 *
 * 前置条件（两个服务都必须活着）：
 *   1) 后端：curl --noproxy '*' http://localhost:4000/api/health  → code=200
 *      未启动则：cd E:\English\backend && npm start
 *   2) 静态服务（根目录 review/，端口 5500）：
 *      cd E:\English\review && python -m http.server 5500
 *
 * 运行（必须带 NODE_PATH）：
 *   NODE_PATH="C:\Users\lenovo\.workbuddy\binaries\node\workspace\node_modules" \
 *     node E:/English/backend/scripts/verify-frontend-pages.js
 *
 * 覆盖：index 统计卡 / 课程卡 / F6 趋势图 / 搜索过滤；words 口径 51 / 分组 / 翻卡 / 过滤；
 *       wrong F2 四项硬指标 / 状态·类型筛选 / P3 复习队列（只读校验，不提交写接口）；
 *       lesson ?no=N 八节 / 折叠默认 / 深链 / 缺失占位 / 空态。
 * 所有可见性判定一律用 getComputedStyle(el).display，不做 class 断言。
 * 退出码：0 = 全通过，1 = 有失败，2 = 脚本自身异常。
 */
const { chromium } = require('playwright-core');
const SITE = 'http://localhost:5500';
const results = [];
const ok = (name, cond, detail) => results.push({ name, pass: !!cond, detail: detail == null ? '' : String(detail) });

async function waitRendered(page, sel, timeout = 8000) {
  await page.waitForSelector(sel, { timeout });
}

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });

  // ============ 首页 ============
  {
    const page = await browser.newPage();
    const jsErr = [];
    page.on('pageerror', e => jsErr.push(e.message));
    await page.goto(SITE + '/index.html', { waitUntil: 'networkidle' });
    await waitRendered(page, '#lessonList .lesson');
    // 需求⑥：默认展示最新一课 —— 等该课正文渲染完（#stageTitle 非空）再断言
    await page.waitForSelector('#stageTitle:not(:empty)', { timeout: 8000 }).catch(() => { });

    const d = await page.evaluate(async () => {
      const txt = id => (document.getElementById(id) || {}).textContent;
      const cs = n => getComputedStyle(n).display;
      const ms = await API.get('/mistakes/stats');
      const rs = await API.get('/readings/stats');
      const ls = await API.getPage('/lessons', 1, 1);
      const vs = await API.get('/vocabulary/stats');
      /* 2026-10-02 首页改版（负责人 6 条需求）后：
       *  · 课程区改「阅读板块同构」（左侧目录 #lessonList + 中间 #stageBody 完整正文 + 上一课/下一课），
       *    旧断言的 `#lessonList .lesson a.btn`（查看全文）已不存在；
       *  · 「为什么今天学这个」(#whyBlock) 与「近 6 课错误趋势」(#trendBox) **被注释隐藏**，
       *    其 DOM 不再存在 —— 断言据此改为「不存在」，而非旧的 lastRecommendation 联动。
       *  统计口径仍一律与接口值比对，不写死常数。 */
      const idx = await API.lessonIndex();
      const maxNo = Math.max.apply(null, (idx.list || []).map(l => l.lessonNo));
      const tocItems = document.querySelectorAll('#lessonList .ltoc-item');
      const firstItem = tocItems[0];
      return {
        // 统计口径不写死常数：一律与接口值比对
        apiLessonTotal: String(ls.total),
        apiVocab: String(vs.total),
        apiMaxNo: String(maxNo),
        lessons: txt('statLessons'), level: txt('statLevel'), vocab: txt('statVocab'),
        reading: txt('statReading'), readingTitle: document.getElementById('statReading').title,
        mistakes: txt('statMistakes'),
        apiPending: String(ms.pending),
        apiPieces: String(rs.pieceCount),
        apiDays: String(rs.totalDays),
        statCount: document.querySelectorAll('.board-main .stats .stat').length,
        // 2026-10-02 二轮改：跳转块升级为全站顶部导航（横向 4 块、当前页高亮），旧 .entries-v 移除
        navCount: document.querySelectorAll('.site-nav a').length,
        navOn: (document.querySelector('.site-nav a.on') || {}).textContent || null,
        navRow: (function () { const n = document.querySelector('.site-nav'); return !!n && cs(n) === 'flex' && getComputedStyle(n).flexDirection === 'row'; })(),
        noEntriesV: document.querySelector('.entries-v') === null,
        // 需求⑥：课程目录 = 课程总数；默认展示最新一课（首项高亮 on）
        tocCount: tocItems.length,
        stageTitle: txt('stageTitle'),
        firstOnToc: firstItem ? firstItem.classList.contains('on') : false,
        hasPrev: !!document.getElementById('lsPrev'),
        hasNext: !!document.getElementById('lsNext'),
        // 需求⑤：两块已注释隐藏 ⇒ DOM 中不存在
        noTrendBox: document.getElementById('trendBox') === null,
        noWhyBlock: document.getElementById('whyBlock') === null,
        errHidden: cs(document.getElementById('apiError')),
      };
    });
    ok('[index] 已上课数 = /lessons.total', d.lessons === d.apiLessonTotal, `got=${d.lessons} api=${d.apiLessonTotal}`);
    ok('[index] 当前级别 = Level 2', d.level === 'Level 2', 'got=' + d.level);
    ok('[index] 累计生词 = /vocabulary/stats.total（按 word 去重）',
      d.vocab === d.apiVocab, `got=${d.vocab} api=${d.apiVocab}`);
    ok('[index] 未过关错词 = /mistakes/stats.pending', d.mistakes === d.apiPending, `got=${d.mistakes} api=${d.apiPending}`);
    // 2026-09-30 更新：阅读篇数接 `/readings/stats.pieceCount`，并顺带校验 title 的「读了 N 天」来自 `totalDays`。
    ok('[index] 阅读篇数 = /readings/stats.pieceCount 且 title 含「读了 N 天」',
      d.reading === d.apiPieces && new RegExp(`读了 ${d.apiDays} 天`).test(d.readingTitle || ''),
      `got=${d.reading} api=${d.apiPieces} title=${d.readingTitle}`);
    // 需求③：5 张统计卡（已上课数/当前级别/累计生词/阅读篇数/未过关错词）缩小左对齐后仍齐
    ok('[index] 统计卡 5 张', d.statCount === 5, 'count=' + d.statCount);
    // 需求④（2026-10-02 二轮改）：跳转块升级为全站顶部导航（首页/阅读/词汇卡/错词本），当前页蓝底高亮
    ok('[index] 顶部导航 4 块横向、「首页」高亮、旧右侧跳转栏已移除',
      d.navCount === 4 && d.navOn === '首页' && d.navRow && d.noEntriesV,
      `n=${d.navCount} on=${d.navOn} row=${d.navRow} noOld=${d.noEntriesV}`);
    // 需求⑤：「为什么今天学这个」「近 6 课错误趋势」注释隐藏 ⇒ DOM 中不存在
    ok('[index] 「为什么今天学这个」「近 6 课错误趋势」已隐藏（DOM 不存在）',
      d.noWhyBlock && d.noTrendBox, `noWhy=${d.noWhyBlock} noTrend=${d.noTrendBox}`);
    // 需求⑥：课程区改阅读板块同构 —— 左侧目录项数 = 课程总数
    ok('[index] 课程目录（左侧）项数 = /lessons.total',
      d.tocCount === Number(d.apiLessonTotal), `toc=${d.tocCount} api=${d.apiLessonTotal}`);
    // 需求⑥：默认展示最新一课（首项高亮，stageTitle 含最大课号）
    ok('[index] 默认展示最新一课（#stageTitle 含第 max 课，首项高亮）',
      new RegExp('第 ' + d.apiMaxNo + ' 课').test(d.stageTitle || '') && d.firstOnToc,
      `title="${d.stageTitle}" max=${d.apiMaxNo} firstOn=${d.firstOnToc}`);
    // 需求⑥：底部《上一课》《下一课》按钮存在（不再「查看全文」跳转）
    ok('[index] 底部《上一课》《下一课》按钮存在', d.hasPrev && d.hasNext, `prev=${d.hasPrev} next=${d.hasNext}`);
    ok('[index] 无错误时横幅 computed display = none', d.errHidden === 'none', 'display=' + d.errHidden);
    // 负责人补充：「全部展开/隐藏」功能保留（与 lesson.html 同构）——点一次全开、再点全合，按钮文案随之切换
    const t = await page.evaluate(() => {
      const btn = document.getElementById('toggleAll');
      if (!btn) { return { has: false }; }
      const all = document.querySelectorAll('#stageBody details');
      btn.click();
      const opened = Array.prototype.filter.call(all, x => x.open).length;
      const labelAfter = btn.textContent;
      btn.click();
      const closed = Array.prototype.filter.call(all, x => x.open).length;
      return { has: true, total: all.length, opened, labelAfter, back: btn.textContent, closed };
    });
    ok('[index] 课程区「全部展开/折叠」按钮可用（点开→全开、再点→全合，文案切换）',
      t.has && t.total > 0 && t.opened === t.total && /折叠/.test(t.labelAfter || '') && t.closed === 0,
      JSON.stringify(t));
    // bug 回归（2026-10-02 负责人报）：全开后手动折叠单节 → 按钮文案须立即同步为「全部展开」，
    // 此时点击执行「全部展开」—— 文案与动作一致（旧实现只在点击按钮时更新文案，会残留「全部折叠」）。
    // ⚠️ details 的 toggle 事件是**异步派发**的 → 设置 open 后必须等一拍再读文案，
    //    否则读到的是残留值（曾让 index 断言假阳性通过、lesson 断言假阴性失败）。
    const t2 = await page.evaluate(async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const btn = document.getElementById('toggleAll');
      const all = document.querySelectorAll('#stageBody details');
      Array.prototype.forEach.call(all, d => { d.open = true; });
      all[0].open = false;                       // 手动折叠单节（经 toggle 事件同步文案）
      await sleep(0);
      const labelAfterManual = btn.textContent;
      btn.click();                               // 此时点击应执行「全部展开」
      await sleep(0);
      return {
        labelAfterManual,
        openedAfterClick: Array.prototype.filter.call(all, x => x.open).length,
        labelAfterClick: btn.textContent,
      };
    });
    ok('[index] 手动折叠单节后按钮文案实时同步（文案与点击动作一致）',
      t2.labelAfterManual === '全部展开' && t2.openedAfterClick === t.total && t2.labelAfterClick === '全部折叠',
      JSON.stringify(t2));
    // 搜索过滤：隐藏项 computed display 必须 none（目录项为 .ltoc-item.lesson）
    const f = await page.evaluate(() => {
      const q = document.getElementById('q');
      q.value = 'was';
      q.dispatchEvent(new Event('input'));
      const cards = document.querySelectorAll('#lessonList .lesson');
      const disp = Array.prototype.map.call(cards, c => getComputedStyle(c).display);
      return { total: cards.length, none: disp.filter(x => x === 'none').length, shown: disp.filter(x => x !== 'none').length };
    });
    ok('[index] 搜索「was」按 data-text 过滤（有隐藏有显示，隐藏项 display=none）',
      f.total === Number(d.apiLessonTotal) && f.none > 0 && f.shown > 0, JSON.stringify(f));
    ok('[index] 无 JS 运行时异常', jsErr.length === 0, jsErr.join(' ; '));
    await page.close();
  }

  // ============ 词汇卡 ============
  {
    const page = await browser.newPage();
    const jsErr = [];
    page.on('pageerror', e => jsErr.push(e.message));
    await page.goto(SITE + '/words.html', { waitUntil: 'networkidle' });
    await waitRendered(page, '#wordGroups .wcard');

    const d = await page.evaluate(async () => {
      const cs = n => getComputedStyle(n).display;
      const first = document.querySelector('#wordGroups .wcard');
      const before = { c: cs(first.querySelector('.c')), e: cs(first.querySelector('.e')) };
      first.click();
      const after = { c: cs(first.querySelector('.c')), e: cs(first.querySelector('.e')) };
      const vs = await API.get('/vocabulary/stats');
      const all = await API.getAll('/vocabulary', { size: 50 });
      return {
        apiVocab: vs.total,
        apiLetters: Object.keys(vs.byLetter || {}).length,
        apiDistinct: new Set(all.list.map(v => v.word)).size,
        apiRows: all.total,
        note: document.getElementById('totalNote').textContent,
        navs: document.querySelectorAll('#letterNav a').length,
        siteNavCount: document.querySelectorAll('.site-nav a').length,
        siteNavOn: (document.querySelector('.site-nav a.on') || {}).textContent || null,
        groups: document.querySelectorAll('#wordGroups h2[id^=letter-]').length,
        cards: document.querySelectorAll('#wordGroups .wcard').length,
        sumCounts: Array.prototype.reduce.call(document.querySelectorAll('#wordGroups .words'), (a, w) => a + w.querySelectorAll('.wcard').length, 0),
        before, after,
      };
    });
    // 口径：按 word 全局去重（/vocabulary/stats.total），不是 lesson_vocabulary 关联行数。
    // 2026-10-01 起与接口比对，不再写死 51/52。
    ok('[words] 顶部标注口径 = /vocabulary/stats.total（按单词去重）',
      new RegExp(`共 ${d.apiVocab} 个词条`).test(d.note), `note=${d.note} api=${d.apiVocab}`);
    ok('[words] 字母导航数 = byLetter 键数', d.navs === d.apiLetters, `navs=${d.navs} api=${d.apiLetters}`);
    ok('[words] 词汇卡数 = 去重词条数（非 /vocabulary 原始行数）',
      d.cards === d.apiVocab && d.apiDistinct === d.apiVocab,
      `cards=${d.cards} distinct=${d.apiDistinct} api=${d.apiVocab} rows=${d.apiRows}`);
    ok('[words] 分组内卡片数合计 = 顶部口径', d.sumCounts === d.apiVocab, `sum=${d.sumCounts} api=${d.apiVocab}`);
    ok('[words] 点击卡片 .c/.e 由 none 变可见（getComputedStyle）',
      d.before.c === 'none' && d.before.e === 'none' && d.after.c !== 'none' && d.after.e !== 'none',
      JSON.stringify(d.after));
    ok('[words] 顶部导航 4 块且「词汇卡」高亮', d.siteNavCount === 4 && d.siteNavOn === '词汇卡',
      `n=${d.siteNavCount} on=${d.siteNavOn}`);
    // 2026-10-02 负责人需求：字母索引左栏两列网格、块放大 ~1.5 倍、搜索框在索引上方、sticky 跟随滚动
    const navPos = await page.evaluate(() => {
      const nav = document.getElementById('letterNav');
      const q = document.getElementById('q');
      const side = nav.closest('.words-side');
      const csN = getComputedStyle(nav);
      const qFirst = !!(side && q && side.contains(q)
        && (q.compareDocumentPosition(nav) & Node.DOCUMENT_POSITION_FOLLOWING));
      const firstA = nav.querySelector('a');
      const h2 = document.querySelector('#wordGroups > h2:first-child');
      const qEl = document.getElementById('q');
      const aligned = !!(h2 && qEl)
        && Math.abs(h2.getBoundingClientRect().top - qEl.getBoundingClientRect().top) <= 4;
      return {
        grid2: csN.display === 'grid' && csN.gridTemplateColumns.trim().split(/\s+/).length === 2,
        sticky: !!side && getComputedStyle(side).position === 'sticky',
        qFirst,
        bigTile: !!firstA && firstA.getBoundingClientRect().height >= 38,
        aligned,
        count: nav.querySelectorAll('a').length,
      };
    });
    ok('[words] 字母索引左栏两列网格 + 块放大 + 搜索框在其上方 + sticky',
      navPos.grid2 && navPos.sticky && navPos.qFirst && navPos.bigTile && navPos.count > 0,
      JSON.stringify(navPos));
    ok('[words] 首个字母组标题「A」与左栏搜索框顶部对齐（±4px）', navPos.aligned === true,
      'aligned=' + navPos.aligned);
    // 过滤
    const f = await page.evaluate(() => {
      const q = document.getElementById('q');
      q.value = 'book';
      q.dispatchEvent(new Event('input'));
      const cards = document.querySelectorAll('#wordGroups .wcard');
      const disp = Array.prototype.map.call(cards, c => getComputedStyle(c).display);
      return { none: disp.filter(x => x === 'none').length, shown: disp.filter(x => x !== 'none').length };
    });
    ok('[words] 搜索「book」过滤生效（隐藏项 display=none）', f.shown > 0 && f.none > 0, JSON.stringify(f));
    ok('[words] 无 JS 运行时异常', jsErr.length === 0, jsErr.join(' ; '));
    await page.close();
  }

  // ============ 错词本 ============
  {
    const page = await browser.newPage();
    const jsErr = [];
    page.on('pageerror', e => jsErr.push(e.message));
    await page.goto(SITE + '/wrong.html', { waitUntil: 'networkidle' });
    await waitRendered(page, '#mistakeList .mcard');

    const d = await page.evaluate(() => {
      const txt = id => (document.getElementById(id) || {}).textContent;
      const card = document.querySelector('#mistakeList .mcard');
      const html = document.getElementById('mistakeList').innerHTML;
      return {
        total: txt('stTotal'), pending: txt('stPending'), passed: txt('stPassed'),
        siteNavCount: document.querySelectorAll('.site-nav a').length,
        siteNavOn: (document.querySelector('.site-nav a.on') || {}).textContent || null,
        cards: document.querySelectorAll('#mistakeList .mcard').length,
        hasStreakBar: !!card.querySelector('.streak .bar i'),
        hasWrongCount: /第 \d+ 次犯/.test(html),
        hasPriority: /priority-(high|medium|low)/.test(html),
        hasErrorType: /class="tag">(语法|拼写|标点|用词|大小写|其他)/.test(html),
        hasSource: /来源 第 \d+ 课/.test(html),
        whyVisible: getComputedStyle(card.querySelector('.why')).display !== 'none',
        typeTabs: document.querySelectorAll('#typeTabs button').length,
      };
    });
    const nTotal = Number(d.total), nPending = Number(d.pending), nPassed = Number(d.passed);
    ok('[wrong] 统计三项均为数字且 pending+passed=total', nPending + nPassed === nTotal && nTotal > 0,
      `total=${d.total} pending=${d.pending} passed=${d.passed}`);
    ok('[wrong] 错词卡张数 = total', d.cards === nTotal, `cards=${d.cards} total=${d.total}`);
    ok('[wrong] F2 四项硬指标齐：wrongCount / streak 进度条 / priority / errorType + 来源课号',
      d.hasWrongCount && d.hasStreakBar && d.hasPriority && d.hasErrorType && d.hasSource,
      JSON.stringify(d));
    ok('[wrong] 错因默认展开可见（getComputedStyle != none）', d.whyVisible, 'whyVisible=' + d.whyVisible);
    ok('[wrong] 类型筛选 tab 含「全部类型」+ byType（≥2 个）', d.typeTabs >= 2, 'tabs=' + d.typeTabs);
    ok('[wrong] 顶部导航 4 块且「错词本」高亮', d.siteNavCount === 4 && d.siteNavOn === '错词本',
      `n=${d.siteNavCount} on=${d.siteNavOn}`);
    // 状态筛选：点「已过关」后仅剩 passed 张可见，其余 computed display = none
    const f = await page.evaluate(() => {
      const btns = document.querySelectorAll('#statusTabs button');
      btns[2].click(); // 已过关
      const cards = document.querySelectorAll('#mistakeList .mcard');
      const disp = Array.prototype.map.call(cards, c => getComputedStyle(c).display);
      return { shown: disp.filter(x => x !== 'none').length, none: disp.filter(x => x === 'none').length };
    });
    ok('[wrong] 状态筛选「已过关」只显示已过关卡、其余 display=none',
      f.shown === nPassed && f.none === nTotal - nPassed, JSON.stringify(f) + ` expected shown=${nPassed}`);

    // P3 复习面板：只验证「起队列 + 只读渲染 + 不做前端重排」，不点提交（避免改学习数据）
    const p3 = await page.evaluate(async () => {
      document.getElementById('startReview').click();
      await new Promise(r => { const t = setInterval(() => { if (document.querySelector('#reviewPanel .review')) { clearInterval(t); r(); } }, 50); setTimeout(r, 4000); });
      const panel = document.querySelector('#reviewPanel .review');
      const first = panel && panel.querySelector('.qtext');
      const api = await API.get('/mistakes/pending?limit=5');
      return {
        hasPanel: !!panel,
        prog: panel ? panel.querySelector('.rprog').textContent : '',
        firstText: first ? first.textContent : '',
        apiFirst: (api.list[0] || {}).wrongText || '',
        apiLen: api.list.length,
        whyVisible: panel ? getComputedStyle(panel.querySelector('.why')).display !== 'none' : false,
        hasOk: !!document.querySelector('#reviewPanel button[data-r=correct]'),
        hasNo: !!document.querySelector('#reviewPanel button[data-r=wrong]'),
      };
    });
    ok('[wrong] P3 复习面板可起队列并渲染第 1 题', p3.hasPanel && /第 1 \/ \d+ 题/.test(p3.prog), JSON.stringify(p3).slice(0, 140));
    ok('[wrong] P3 队列首题 = /mistakes/pending 默认序首条（前端未重排）', p3.firstText === p3.apiFirst, `got="${p3.firstText}" want="${p3.apiFirst}"`);
    ok('[wrong] P3 错因在复习面板默认展开可见', p3.whyVisible, 'whyVisible=' + p3.whyVisible);
    ok('[wrong] P3 「我答对了/又错了」按钮齐（未提交，避免改数据）', p3.hasOk && p3.hasNo, JSON.stringify(p3));

    // P3 答后文案 + 题量：用 route 打桩拦截 POST，**不触碰数据库**
    await page.route('**/api/mistakes/*/review', route => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ code: 200, message: 'success', data: { id: 1, streak: 2, wrongCount: 3, status: 'passed', priority: 'high', lastReviewedAt: '2026-09-29 18:00:00' } })
    }));
    const fb = await page.evaluate(async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const waitFor = async (fn, ms = 3000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn()) { return true; } await sleep(30); } return false; };
      const out = {};
      out.prog = (document.querySelector('#reviewPanel .rprog') || {}).textContent || '';
      document.querySelector('#reviewPanel button[data-r=correct]').click();
      await waitFor(() => document.querySelector('#reviewPanel .feedback'));
      out.lines1 = Array.prototype.map.call(document.querySelectorAll('#reviewPanel .feedback p'), p => p.textContent);
      document.getElementById('nextQ').click();
      await waitFor(() => document.querySelector('#reviewPanel button[data-r=wrong]') && !document.querySelector('#reviewPanel .feedback'));
      document.querySelector('#reviewPanel button[data-r=wrong]').click();
      await waitFor(() => document.querySelector('#reviewPanel .feedback'));
      out.lines2 = Array.prototype.map.call(document.querySelectorAll('#reviewPanel .feedback p'), p => p.textContent);
      return out;
    });
    await page.unroute('**/api/mistakes/*/review');
    ok('[wrong] P3 题量按 D=0 取 5 题（Amy 断更规则）', /第 1 \/ 5 题/.test(fb.prog), 'prog=' + fb.prog);
    ok('[wrong] P3 答对文案 == Amy 原文（L617）',
      fb.lines1[0] === '✅ 答对了 · 连续答对 2/2' && fb.lines1[1] === '—— 已过关，退出复习队列',
      JSON.stringify(fb.lines1));
    ok('[wrong] P3 答错文案 == Amy 原文（L618）',
      fb.lines2[0] === '❌ 又错了 · 连续答对清零' && /^这是第 3 次犯，上次在(第 \d+ 课|诊断)$/.test(fb.lines2[1] || ''),
      JSON.stringify(fb.lines2));
    ok('[wrong] 无 JS 运行时异常', jsErr.length === 0, jsErr.join(' ; '));
    await page.close();
  }

  // ============ 课程详情（参数化） ============
  {
    const page = await browser.newPage();
    const jsErr = [];
    page.on('pageerror', e => jsErr.push(e.message));
    await page.goto(SITE + '/lessons/lesson.html?no=6', { waitUntil: 'networkidle' });
    await waitRendered(page, '#lessonBody .sec');

    const d = await page.evaluate(() => {
      const types = Array.prototype.map.call(document.querySelectorAll('#lessonBody .sec'), s => s.dataset.type);
      const openTypes = Array.prototype.map.call(document.querySelectorAll('#lessonBody .sec details'), (dt, i) => dt.open ? types[i] : null).filter(Boolean);
      return {
        title: document.getElementById('ltitle').textContent,
        siteNavCount: document.querySelectorAll('.site-nav a').length,
        siteNavOn: (document.querySelector('.site-nav a.on') || {}).textContent || null,
        types,
        openTypes,
        vocabRows: document.querySelectorAll('#lessonBody > table tbody tr').length,
        hasSelfCheck: /提交前自查清单/.test(document.getElementById('lessonBody').textContent),
        grammarHasContent: /was|过去/.test((document.querySelector('#sec-grammar') || {}).innerHTML || ''),
        missingCount: document.querySelectorAll('#lessonBody .sec.missing').length,
        toggleBtn: !!document.getElementById('toggleAll'),
        notRenderExpectedMistakes: types.indexOf('expected_mistakes') === -1,
        linksToStatic: /lesson-6\.html/.test(document.getElementById('lessonBody').innerHTML),
      };
    });
    ok('[lesson] 标题含第 6 课', /第 6 课/.test(d.title), d.title);
    ok('[lesson] 顶部导航 4 块且「首页」高亮（替代旧「← 返回看板」）',
      d.siteNavCount === 4 && d.siteNavOn === '首页', `n=${d.siteNavCount} on=${d.siteNavOn}`);
    ok('[lesson] 8 个契约小节全部出现（含未入库占位，不静默少给）', d.types.length >= 8, 'types=' + d.types.join(','));
    ok('[lesson] 桌面默认展开 = 语法/例句/作业/批改', JSON.stringify(d.openTypes) === JSON.stringify(['grammar', 'examples', 'homework', 'grading']), 'open=' + d.openTypes.join(','));
    ok('[lesson] grammar 有真实正文（库内已有）', d.grammarHasContent, 'grammar=' + d.grammarHasContent);
    ok('[lesson] 缺失小节标注 .missing 并给静态版入口', d.missingCount >= 1 && d.linksToStatic, 'missing=' + d.missingCount + ' link=' + d.linksToStatic);
    ok('[lesson] F4-a 自查清单区块存在（当前占位）', d.hasSelfCheck, 'hasSelfCheck=' + d.hasSelfCheck);
    ok('[lesson] F10 expected_mistakes 不渲染（Amy 裁定）', d.notRenderExpectedMistakes, 'present=' + !d.notRenderExpectedMistakes);
    ok('[lesson] 一键展开按钮存在', d.toggleBtn, 'btn=' + d.toggleBtn);
    ok('[lesson] 本课词汇表渲染 10 行', d.vocabRows === 10, 'rows=' + d.vocabRows);
    // 一键全展开
    const t = await page.evaluate(() => {
      document.getElementById('toggleAll').click();
      const dts = document.querySelectorAll('#lessonBody details');
      return { opened: Array.prototype.filter.call(dts, x => x.open).length, total: dts.length, label: document.getElementById('toggleAll').textContent };
    });
    ok('[lesson] 一键全展开后所有 details 打开', t.opened === t.total && /折叠/.test(t.label), JSON.stringify(t));
    // bug 回归（2026-10-02，与 index 同款修复）：手动折叠单节后按钮文案须实时同步（toggle 异步 → 等一拍）
    const t3 = await page.evaluate(async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const btn = document.getElementById('toggleAll');
      const all = document.querySelectorAll('#lessonBody details');
      Array.prototype.forEach.call(all, d => { d.open = true; });
      all[0].open = false;                       // 手动折叠单节（toggle 事件同步文案）
      await sleep(0);
      const labelAfterManual = btn.textContent;
      btn.click();
      await sleep(0);
      return {
        labelAfterManual,
        opened: Array.prototype.filter.call(all, x => x.open).length,
        total: all.length,
        after: btn.textContent,
      };
    });
    ok('[lesson] 手动折叠单节后按钮文案实时同步（文案与点击动作一致）',
      t3.labelAfterManual === '全部展开' && t3.opened === t3.total && t3.after === '全部折叠',
      JSON.stringify(t3));
    // 深链
    await page.goto(SITE + '/lessons/lesson.html?no=6#sec-review', { waitUntil: 'networkidle' });
    await waitRendered(page, '#lessonBody .sec');
    const hl = await page.evaluate(() => {
      const dt = document.querySelector('#sec-review details');
      return dt ? dt.open : null;
    });
    ok('[lesson] URL 深链 #sec-review 让该小节默认展开', hl === true, 'open=' + hl);
    ok('[lesson] 无 JS 运行时异常', jsErr.length === 0, jsErr.join(' ; '));
    await page.close();
  }

  // ============ 不存在的课号 ============
  {
    const page = await browser.newPage();
    await page.goto(SITE + '/lessons/lesson.html?no=999', { waitUntil: 'networkidle' });
    await waitRendered(page, '#lessonBody .state');
    const d = await page.evaluate(() => document.getElementById('lessonBody').textContent);
    ok('[lesson] 不存在的课号显示空态而非报错', /没有第 999 课/.test(d), d.slice(0, 80));
    await page.close();
  }

  // ============ 缺课号参数 ============
  {
    const page = await browser.newPage();
    await page.goto(SITE + '/lessons/lesson.html', { waitUntil: 'domcontentloaded' });
    await waitRendered(page, '#lessonBody .state');
    const d = await page.evaluate(() => document.getElementById('lessonBody').textContent);
    ok('[lesson] 缺 no 参数给出用法提示', /缺少课号参数/.test(d), d.slice(0, 80));
    await page.close();
  }

  await browser.close();
  const pass = results.filter(r => r.pass).length;
  console.log('\n===== 页面级真机验证结果 =====');
  results.forEach(r => console.log((r.pass ? 'PASS ' : 'FAIL ') + r.name + (r.pass ? '' : ('\n       实测: ' + r.detail))));
  console.log(`\n合计 ${pass}/${results.length} 通过`);
  process.exit(pass === results.length ? 0 : 1);
})().catch(e => { console.error('HARNESS ERROR:', e); process.exit(2); });
