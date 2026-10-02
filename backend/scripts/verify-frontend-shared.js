/* Vue 版共享层回归（2026-10-02 随原生版退役迁移）
 *
 * 原脚本验证 `review/assets/{api.js,ui.js,board.css}`；原生站退役后（frontend-plan §14），
 * 等价对象变为 Vue 工程：`frontend/src/api.js`（api.js 逐字移植为 ESM）、
 * `frontend/src/utils/markdown.js`（renderMarkdown 连同防死循环兜底逐字移植）、
 * `frontend/src/utils/labels.js`、`frontend/src/components/ApiErrorBar.vue`（原 UI.error/clearError）。
 *
 * 迁移对照（**逐条**，不做假通过）：
 *   · api.js 9 条（包络/getPage/getAll/404/400/网络中断/daysSince/lessonIndex）→ **原样保留**，改为模块级导入；
 *   · renderMarkdown 2 条（表格/引用/列表 + 2026-10-01 死循环回归）→ **原样保留**；
 *   · esc / label 2 条 → **原样保留**（均为 Vue 侧模块）；
 *   · 四态与 `.hide`（F5 陷阱）→ 在 Vue 站上以「路由拦截喂失败包络」实测 ApiErrorBar；
 *   · 组件字符串断言 8 条（stateHTML/streakBar/lessonCard/wordCard/mistakeCard×2/trendChart×2/sectionBlock）
 *     → **随 ui.js 退役**：Vue 版由组件承担，等价覆盖在 `frontend/scripts/verify-vue.cjs`
 *       （错词卡四项硬指标 + streak 条、词卡翻面、小节区块、导航等），此处仅打印对照说明，不伪装成通过。
 *
 * 前置：
 *   1) 后端：curl --noproxy '*' http://localhost:4000/api/health  → code=200
 *   2) **Vue dev server（5173）**：本脚本按源码模块导入（`/src/...`），故必须用 dev；
 *      `cd E:\English\frontend && npm run dev`
 *
 * 运行（需 NODE_PATH）：
 *   NODE_PATH="C:\Users\lenovo\.workbuddy\binaries\node\workspace\node_modules" \
 *     node backend/scripts/verify-frontend-shared.js [BASE]      # BASE 默认 http://localhost:5173
 *
 * 退出码：0 = 全通过，1 = 有失败（各条已打印实测值），2 = 脚本自身异常。
 */
'use strict';

const { chromium } = require('playwright-core');

const SITE = process.env.BASE || process.argv[2] || 'http://localhost:5173';
const results = [];
function ok(name, cond, detail) {
  results.push({ name, pass: !!cond, detail: detail == null ? '' : String(detail) });
}

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage();
  const jsErrors = [];
  page.on('pageerror', e => jsErrors.push(e.message));

  /* 打开任意 Vue 页面（同源），再把源码模块暴露到 window（dev server 提供 /src/ 模块） */
  await page.goto(SITE + '/words', { waitUntil: 'networkidle' });
  await page.addScriptTag({
    type: 'module',
    content:
      "import { renderMarkdown, esc } from '/src/utils/markdown.js';\n" +
      "import { label } from '/src/utils/labels.js';\n" +
      "import { API } from '/src/api.js';\n" +
      'window.__shared = { renderMarkdown, esc, label, API };\n' +
      'window.__sharedReady = true;\n'
  });
  await page.waitForFunction(() => window.__sharedReady === true, null, { timeout: 10000 });

  // ---------- api.js：正常包络 ----------
  const health = await page.evaluate(async () => {
    try { const d = await window.__shared.API.get('/health'); return { ok: true, d }; }
    catch (e) { return { ok: false, code: e.code, msg: e.message }; }
  });
  ok('api.js: /health resolves 且只吐 data（data.service 存在，无 code 包裹）',
    health.ok && health.d && health.d.service === 'english-learning-backend' && health.d.code === undefined,
    JSON.stringify(health).slice(0, 160));

  // 口径不写死常数：① stats.total === getAll 去重后的词条数；② getAll 不静默截断。
  const vocab = await page.evaluate(async () => {
    const API = window.__shared.API;
    const vs = await API.get('/vocabulary/stats');
    const all = await API.getAll('/vocabulary', { size: 20 });
    return {
      total: vs.total, letters: Object.keys(vs.byLetter || {}).length, len: all.list.length, apiTotal: all.total,
      distinct: new Set(all.list.map(v => v.word)).size
    };
  });
  ok('api.js: /vocabulary/stats.total === getAll 去重词条数（口径：按 word 去重）',
    Number.isInteger(vocab.total) && vocab.total > 0 && vocab.total === vocab.distinct,
    JSON.stringify(vocab));

  // ---------- api.js：分页 ----------
  const pg = await page.evaluate(() => window.__shared.API.getPage('/vocabulary', 1, 3));
  ok('api.js: getPage 返回 {list,total,page,size}',
    pg && Array.isArray(pg.list) && pg.list.length === 3 && pg.total === vocab.total && pg.page === 1 && pg.size === 3,
    JSON.stringify({
      len: pg && pg.list && pg.list.length, total: pg && pg.total, page: pg && pg.page, size: pg && pg.size,
      expectTotal: vocab.total
    }));

  // ---------- api.js：getAll 循环取全量（规避 size 上限静默截断） ----------
  const all = await page.evaluate(() => window.__shared.API.getAll('/vocabulary', { size: 20 }));
  ok('api.js: getAll 循环取全量（无静默截断）',
    all && all.list.length === vocab.total && all.total === vocab.total,
    'len=' + (all && all.list.length) + ' total=' + (all && all.total) + ' expect=' + vocab.total);

  // ---------- api.js：业务错误分支（404） ----------
  const e404 = await page.evaluate(async () => {
    try { await window.__shared.API.get('/lessons/99999'); return { threw: false }; }
    catch (e) { return { threw: true, name: e.name, code: e.code, msg: e.message, data: e.data }; }
  });
  ok('api.js: 404 抛 ApiError（code=404，name=ApiError，data=null）',
    e404.threw && e404.name === 'ApiError' && e404.code === 404 && e404.data === null,
    JSON.stringify(e404));

  // ---------- api.js：400 参数校验分支（字段明细拼进 message） ----------
  const e400 = await page.evaluate(async () => {
    try { await window.__shared.API.get('/lessons/abc'); return { threw: false }; }
    catch (e) { return { threw: true, code: e.code, msg: e.message, isArr: Array.isArray(e.data) }; }
  });
  ok('api.js: 400 抛 ApiError 且把 data 字段明细拼进 message',
    e400.threw && e400.code === 400 && e400.isArr && /id/.test(e400.msg),
    JSON.stringify(e400));

  // ---------- api.js：网络失败分支（code=0） ----------
  await page.route('**/api/progress', route => route.abort('failed'));
  const eNet = await page.evaluate(async () => {
    try { await window.__shared.API.get('/progress'); return { threw: false }; }
    catch (e) { return { threw: true, code: e.code, msg: e.message }; }
  });
  await page.unroute('**/api/progress');
  ok('api.js: 网络中断抛 ApiError code=0（供 UI 提示「后端是否在运行」）',
    eNet.threw && eNet.code === 0, JSON.stringify(eNet));

  // ---------- api.js：daysSince ----------
  const ds = await page.evaluate(() => window.__shared.API.daysSince('2026-09-29'));
  ok('api.js: daysSince 返回整数天数（相对当天）', Number.isInteger(ds), 'daysSince=' + ds);

  // ---------- api.js：lessonIndex（优先 /lessons/all，含 grammarPoint） ----------
  const li = await page.evaluate(() => window.__shared.API.lessonIndex().then(d => ({
    n: d.list.length, total: d.total, hasGP: d.list.every(x => 'grammarPoint' in x),
    map: d.list.map(x => x.lessonNo + ':' + x.id).join(',')
  })));
  // 课数不写死：只要求「全量（n === total）」且「含 grammarPoint 键」；另查 /lessons 分页 total 交叉校验。
  const lt = await page.evaluate(() => window.__shared.API.getPage('/lessons', 1, 1).then(d => d.total));
  ok('api.js: lessonIndex 返回全量课程且含 grammarPoint（用于 lessonNo↔id 映射）',
    li.n === li.total && li.n === lt && li.hasGP && li.n > 0,
    JSON.stringify(li) + ' lessonsTotal=' + lt);

  // ---------- 纯函数：esc / label / renderMarkdown ----------
  const pure = await page.evaluate(() => {
    const S = window.__shared;
    const out = {};
    out.esc = S.esc('<a href="x">&"\'');
    out.label = S.label('priority', 'high') + '/' + S.label('errorType', 'word_choice') + '/' + S.label('status', 'passed');
    out.mdTable = S.renderMarkdown('| a | b |\n|---|---|\n| 1 | 2 |');
    out.mdQuote = S.renderMarkdown('> 中文对照');
    out.mdList = S.renderMarkdown('- 一\n- 二');
    // 2026-10-01 回归：以 -/* 开头但后面不是空格的行（`---` 分隔线、`**加粗**`）曾命中段落分支
    // 却被旧终止条件挡下 → i 不前进 → 死循环（RangeError: Invalid array length，课程页整页崩）。
    out.mdDash = S.renderMarkdown('正文一\n---\n正文二');
    out.mdBold = S.renderMarkdown('**加粗**开头');
    out.mdHyphen = S.renderMarkdown('-没有空格');
    out.mdMixed = S.renderMarkdown('段落\n---\n**粗体**\n- 列表项');
    return out;
  });
  ok('markdown.js: esc 转义 &<>"\'', pure.esc === '&lt;a href=&quot;x&quot;&gt;&amp;&quot;&#39;', pure.esc);
  ok('labels.js: label 枚举中文化', pure.label === '高优先/用词/已过关', pure.label);
  ok('markdown.js: renderMarkdown 支持表格/引用/列表',
    /<table>/.test(pure.mdTable) && /<blockquote>/.test(pure.mdQuote) && /<ul><li>/.test(pure.mdList),
    [pure.mdTable.slice(0, 30), pure.mdQuote.slice(0, 30), pure.mdList.slice(0, 30)].join(' | '));
  // 回归断言：只要这条跑得到，就说明 renderMarkdown 没有死循环（死循环会抛 RangeError 让本套件整体失败）
  ok('markdown.js: renderMarkdown 对 `---` / `**粗体**` / `-无空格` 不死循环且不漏内容（2026-10-01 回归）',
    /正文一/.test(pure.mdDash) && /正文二/.test(pure.mdDash) && /---/.test(pure.mdDash)
    && /\*\*加粗\*\*开头/.test(pure.mdBold) && !/undefined/.test(pure.mdBold)
    && /-没有空格/.test(pure.mdHyphen) && !/undefined/.test(pure.mdHyphen)
    && /段落/.test(pure.mdMixed) && /<ul><li>列表项<\/li><\/ul>/.test(pure.mdMixed),
    ['dash=' + pure.mdDash.slice(0, 60), 'bold=' + pure.mdBold.slice(0, 40),
      'hyph=' + pure.mdHyphen.slice(0, 40), 'mixed=' + pure.mdMixed.slice(0, 80)].join(' | '));

  ok('无 JS 运行时异常（dev 页 pageerror 为空）', jsErrors.length === 0, jsErrors.join(' ; '));
  await page.close();

  // ---------- 四态 + .hide 可见性（getComputedStyle，对应原 UI.error/clearError） ----------
  {
    const p = await browser.newPage();
    // 局部失败：喂一个业务失败包络（code 500）给「错词统计」→ 错误横幅应可见
    await p.route('**/api/mistakes/stats', route => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ code: 500, message: '模拟失败', data: null })
    }));
    await p.goto(SITE + '/wrong', { waitUntil: 'domcontentloaded' });
    await p.waitForSelector('#apiError', { timeout: 10000 });
    await p.waitForFunction(
      () => getComputedStyle(document.getElementById('apiError')).display !== 'none',
      null, { timeout: 10000 }
    ).catch(() => { });
    const shown = await p.evaluate(() => ({
      display: getComputedStyle(document.getElementById('apiError')).display,
      text: (document.getElementById('apiErrorMsg') || {}).textContent,
      hasRetry: !!document.getElementById('apiRetry')
    }));
    ok('四态: 局部失败让错误横幅可见（display != none）且文案含「加载失败」',
      shown.display !== 'none' && /加载失败/.test(shown.text || ''), JSON.stringify(shown));
    ok('四态: 横幅带「重试」按钮', shown.hasRetry, 'hasRetry=' + shown.hasRetry);
    await p.close();

    const p2 = await browser.newPage();
    await p2.goto(SITE + '/wrong', { waitUntil: 'networkidle' });
    await p2.waitForSelector('#mistakeList .mcard', { timeout: 15000 });
    const disp = await p2.evaluate(() => {
      const err = document.getElementById('apiError');
      const card = document.querySelector('#mistakeList .mcard');
      const tag = card.querySelector('.tag');
      return {
        errHidden: getComputedStyle(err).display,
        cardDisplay: getComputedStyle(card).display,
        tagDisplay: getComputedStyle(tag).display
      };
    });
    ok('四态: 无错误时 #apiError computed display === none（F5 陷阱不复现）',
      disp.errHidden === 'none', 'display=' + disp.errHidden);
    ok('可见性: 正常态 .mcard / .tag 可见（display != none）',
      disp.cardDisplay !== 'none' && disp.tagDisplay !== 'none', JSON.stringify(disp));
    await p2.close();
  }

  await browser.close();

  /* ---- 已随 ui.js 退役的 8 条组件字符串断言（打印对照，不伪装成通过） ---- */
  console.log('\n[迁移说明] 以下断言随 `review/assets/ui.js` 退役，等价覆盖已转移（不计入下方通过率）：');
  [
    'ui.js: stateHTML          → Vue 各视图的 .state 占位（verify-vue.cjs [home]/[lesson] 空态断言）',
    'ui.js: streakBar          → MistakeCard 的 .streak/.bar/i（verify-vue.cjs [wrong] 四项硬指标断言）',
    'ui.js: lessonCard         → HomeView 目录项 .ltoc-item（verify-vue.cjs [home] 目录/搜索断言）',
    'ui.js: wordCard           → WordsView 卡片（verify-vue.cjs [words] 卡片/翻面/搜索断言）',
    'ui.js: mistakeCard ×2     → MistakeCard.vue（verify-vue.cjs [wrong] 硬指标/来源「诊断」覆盖）',
    'ui.js: trendChart ×2      → 首页「错误趋势」已按负责人需求隐藏，Vue 版不渲染（无对应组件）',
    'ui.js: sectionBlock       → LessonSections.vue（verify-vue.cjs [lesson] 8 小节/默认展开断言）'
  ].forEach(function (line) { console.log('  - ' + line); });

  const pass = results.filter(r => r.pass).length;
  console.log('\n===== Vue 版共享层回归（原 review/assets/ → frontend/src/）=====');
  results.forEach(r => console.log((r.pass ? 'PASS ' : 'FAIL ') + r.name + (r.pass ? '' : '\n       实测: ' + r.detail)));
  console.log(`\n合计 ${pass}/${results.length} 通过  |  期望值来源: 后端 4000 现取（vocabTotal=${vocab.total} lessons=${li.n}）`);
  process.exit(pass === results.length ? 0 : 1);
})().catch(e => { console.error('HARNESS ERROR:', e); process.exit(2); });
