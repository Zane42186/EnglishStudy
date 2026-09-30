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

    const d = await page.evaluate(async () => {
      const txt = id => (document.getElementById(id) || {}).textContent;
      const cs = n => getComputedStyle(n).display;
      const ms = await API.get('/mistakes/stats');
      const rs = await API.get('/readings/stats');
      return {
        lessons: txt('statLessons'), level: txt('statLevel'), vocab: txt('statVocab'),
        reading: txt('statReading'), readingTitle: document.getElementById('statReading').title,
        mistakes: txt('statMistakes'),
        apiPending: String(ms.pending),
        apiPieces: String(rs.pieceCount),
        apiDays: String(rs.totalDays),
        cardCount: document.querySelectorAll('#lessonList .lesson').length,
        firstHref: (document.querySelector('#lessonList .lesson a.btn') || {}).getAttribute
          ? document.querySelector('#lessonList .lesson a.btn').getAttribute('href') : null,
        count: txt('lessonCount'),
        trendCols: document.querySelectorAll('#trendBox .trend-col').length,
        hasBand: /目标带 2—4/.test(document.getElementById('trendBox').innerHTML),
        whyHTML: document.getElementById('whyBlock').innerHTML,
        errHidden: cs(document.getElementById('apiError')),
      };
    });
    ok('[index] 已上课数 = 6', d.lessons === '6', 'got=' + d.lessons);
    ok('[index] 当前级别 = Level 2', d.level === 'Level 2', 'got=' + d.level);
    ok('[index] 累计生词 = 51（口径 51）', d.vocab === '51', 'got=' + d.vocab);
    ok('[index] 未过关错词 = /mistakes/stats.pending', d.mistakes === d.apiPending, `got=${d.mistakes} api=${d.apiPending}`);
    // 2026-09-30 更新：阅读篇数已由占位 `—` 改为接 `/readings/stats.pieceCount`（前端 18749e1）。
    // 旧断言仍期望占位符，属**测试滞后**，此处改为与接口值比对（同 mistakes 的写法），
    // 并顺带校验 title 的「读了 N 天」来自 `totalDays`。
    ok('[index] 阅读篇数 = /readings/stats.pieceCount 且 title 含「读了 N 天」',
      d.reading === d.apiPieces && new RegExp(`读了 ${d.apiDays} 天`).test(d.readingTitle || ''),
      `got=${d.reading} api=${d.apiPieces} title=${d.readingTitle}`);
    ok('[index] 课程卡 6 张', d.cardCount === 6, 'got=' + d.cardCount);
    ok('[index] 课程卡链接指向参数化页 lesson.html?no=', /lessons\/lesson\.html\?no=\d+/.test(d.firstHref || ''), 'href=' + d.firstHref);
    ok('[index] F6 趋势图 6 根柱 + 目标带 2—4', d.trendCols === 6 && d.hasBand, 'cols=' + d.trendCols + ' band=' + d.hasBand);
    ok('[index] lastRecommendation=null 时「为什么今天学这个」整块不渲染（无空白框）',
      d.whyHTML === '' , 'whyBlock="' + String(d.whyHTML).slice(0, 60) + '"');
    ok('[index] 无错误时横幅 computed display = none', d.errHidden === 'none', 'display=' + d.errHidden);
    // 搜索过滤：隐藏项 computed display 必须 none
    const f = await page.evaluate(() => {
      const q = document.getElementById('q');
      q.value = 'was';
      q.dispatchEvent(new Event('input'));
      const cards = document.querySelectorAll('#lessonList .lesson');
      const disp = Array.prototype.map.call(cards, c => getComputedStyle(c).display);
      return { total: cards.length, none: disp.filter(x => x === 'none').length, shown: disp.filter(x => x !== 'none').length };
    });
    ok('[index] 搜索「was」按 data-text 过滤（有隐藏有显示，隐藏项 display=none）',
      f.total === 6 && f.none > 0 && f.shown > 0, JSON.stringify(f));
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

    const d = await page.evaluate(() => {
      const cs = n => getComputedStyle(n).display;
      const first = document.querySelector('#wordGroups .wcard');
      const before = { c: cs(first.querySelector('.c')), e: cs(first.querySelector('.e')) };
      first.click();
      const after = { c: cs(first.querySelector('.c')), e: cs(first.querySelector('.e')) };
      return {
        note: document.getElementById('totalNote').textContent,
        navs: document.querySelectorAll('#letterNav a').length,
        groups: document.querySelectorAll('#wordGroups h2[id^=letter-]').length,
        cards: document.querySelectorAll('#wordGroups .wcard').length,
        sumCounts: Array.prototype.reduce.call(document.querySelectorAll('#wordGroups .words'), (a, w) => a + w.querySelectorAll('.wcard').length, 0),
        before, after,
      };
    });
    ok('[words] 顶部标注口径 51（按单词去重）', /共 51 个词条/.test(d.note), 'note=' + d.note);
    ok('[words] 字母导航 20 个（= byLetter 键数）', d.navs === 20, 'navs=' + d.navs);
    ok('[words] 词汇卡 51 张（去重后，非 52）', d.cards === 51, 'cards=' + d.cards);
    ok('[words] 分组内卡片数合计 = 51，与顶部口径一致', d.sumCounts === 51, 'sum=' + d.sumCounts);
    ok('[words] 点击卡片 .c/.e 由 none 变可见（getComputedStyle）',
      d.before.c === 'none' && d.before.e === 'none' && d.after.c !== 'none' && d.after.e !== 'none',
      JSON.stringify(d.after));
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
