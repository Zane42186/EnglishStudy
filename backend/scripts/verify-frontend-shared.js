/* 真机验证：review/assets/{api.js,ui.js,board.css}（共享层）
 *
 * 前置条件（两个服务都必须活着，缺一则失败）：
 *   1) 后端：curl --noproxy '*' http://localhost:4000/api/health  → code=200
 *      未启动则：cd E:\English\backend && npm start
 *   2) 静态服务（根目录 review/，端口 5500）：
 *      cd E:\English\review && python -m http.server 5500
 *
 * 运行（依赖装在受管工作区，必须带 NODE_PATH）：
 *   NODE_PATH="C:\Users\lenovo\.workbuddy\binaries\node\workspace\node_modules" \
 *     node E:/English/backend/scripts/verify-frontend-shared.js
 *
 * 覆盖：包络解析 / getPage / getAll 全量 / 404·400·网络中断三条错误分支 /
 *       lessonIndex(含 grammarPoint) / daysSince / 四态切换 / 渲染函数 /
 *       过滤 / **`.hide` 一律用 getComputedStyle(el).display 判定，不做 class 断言**。
 * 退出码：0 = 全通过，1 = 有失败（各条已打印实测值），2 = 脚本自身异常。
 */
const { chromium } = require('playwright-core');

const SITE = 'http://localhost:5500';
const results = [];
function ok(name, cond, detail) {
  results.push({ name, pass: !!cond, detail: detail == null ? '' : String(detail) });
}

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage();
  const jsErrors = [];       // 真正的 JS 运行时异常（pageerror）
  const resErrors = [];      // 资源加载失败（含负向测试刻意触发的 404/400，仅记录不判失败）
  page.on('console', m => { if (m.type() === 'error') resErrors.push(m.text()); });
  page.on('pageerror', e => jsErrors.push(e.message));

  // 用一个同源页面拿到 origin，再注入共享层（相对路径/CORS 都真实）
  await page.goto(SITE + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.addScriptTag({ url: SITE + '/assets/api.js' });
  await page.addScriptTag({ url: SITE + '/assets/ui.js' });
  await page.waitForFunction(() => window.API && window.UI, null, { timeout: 5000 });

  // ---------- api.js：正常包络 ----------
  const health = await page.evaluate(async () => {
    try { const d = await API.get('/health'); return { ok: true, d }; }
    catch (e) { return { ok: false, code: e.code, msg: e.message }; }
  });
  ok('api.js: /health resolves 且只吐 data（data.service 存在，无 code 包裹）',
    health.ok && health.d && health.d.service === 'english-learning-backend' && health.d.code === undefined,
    JSON.stringify(health).slice(0, 160));

  // 2026-10-01：口径不再写死常数（第 7 课入库后 51→61），改为「接口自身一致 + 与全量去重比对」：
  // ① stats.total === getAll 去重后的词条数；② getAll 不静默截断（len === total）。
  const vocab = await page.evaluate(async () => {
    const vs = await API.get('/vocabulary/stats');
    const all = await API.getAll('/vocabulary', { size: 20 });
    return { total: vs.total, letters: Object.keys(vs.byLetter || {}).length, len: all.list.length, apiTotal: all.total,
      distinct: new Set(all.list.map(v => v.word)).size };
  });
  ok('api.js: /vocabulary/stats.total === getAll 去重词条数（口径：按 word 去重）',
    Number.isInteger(vocab.total) && vocab.total > 0 && vocab.total === vocab.distinct,
    JSON.stringify(vocab));

  // ---------- api.js：分页 ----------
  const pg = await page.evaluate(() => API.getPage('/vocabulary', 1, 3));
  ok('api.js: getPage 返回 {list,total,page,size}',
    pg && Array.isArray(pg.list) && pg.list.length === 3 && pg.total === vocab.total && pg.page === 1 && pg.size === 3,
    JSON.stringify({ len: pg && pg.list && pg.list.length, total: pg && pg.total, page: pg && pg.page, size: pg && pg.size,
      expectTotal: vocab.total }));

  // ---------- api.js：getAll 循环取全量（规避 size 上限静默截断） ----------
  const all = await page.evaluate(() => API.getAll('/vocabulary', { size: 20 }));
  ok('api.js: getAll 循环取全量（无静默截断）',
    all && all.list.length === vocab.total && all.total === vocab.total,
    'len=' + (all && all.list.length) + ' total=' + (all && all.total) + ' expect=' + vocab.total);

  // ---------- api.js：业务错误分支（404） ----------
  const e404 = await page.evaluate(async () => {
    try { await API.get('/lessons/99999'); return { threw: false }; }
    catch (e) { return { threw: true, name: e.name, code: e.code, msg: e.message, data: e.data }; }
  });
  ok('api.js: 404 抛 ApiError（code=404，name=ApiError，data=null）',
    e404.threw && e404.name === 'ApiError' && e404.code === 404 && e404.data === null,
    JSON.stringify(e404));

  // ---------- api.js：400 参数校验分支（字段明细拼进 message） ----------
  const e400 = await page.evaluate(async () => {
    try { await API.get('/lessons/abc'); return { threw: false }; }
    catch (e) { return { threw: true, code: e.code, msg: e.message, isArr: Array.isArray(e.data) }; }
  });
  ok('api.js: 400 抛 ApiError 且把 data 字段明细拼进 message',
    e400.threw && e400.code === 400 && e400.isArr && /id/.test(e400.msg),
    JSON.stringify(e400));

  // ---------- api.js：网络失败分支（code=0） ----------
  await page.route('**/api/progress', route => route.abort('failed'));
  const eNet = await page.evaluate(async () => {
    try { await API.get('/progress'); return { threw: false }; }
    catch (e) { return { threw: true, code: e.code, msg: e.message }; }
  });
  await page.unroute('**/api/progress');
  ok('api.js: 网络中断抛 ApiError code=0（供 UI 提示「后端是否在运行」）',
    eNet.threw && eNet.code === 0, JSON.stringify(eNet));

  // ---------- api.js：daysSince ----------
  const ds = await page.evaluate(() => API.daysSince('2026-09-29'));
  ok('api.js: daysSince 返回整数天数（相对当天）', Number.isInteger(ds), 'daysSince=' + ds);

  // ---------- api.js：lessonIndex（优先 /lessons/all，含 grammarPoint） ----------
  const li = await page.evaluate(() => API.lessonIndex().then(d => ({
    n: d.list.length, total: d.total, hasGP: d.list.every(x => 'grammarPoint' in x),
    map: d.list.map(x => x.lessonNo + ':' + x.id).join(',')
  })));
  // 课数不写死：只要求「全量（n === total）」且「含 grammarPoint 键」；
  // 另查 /lessons 分页 total 做交叉校验，避免 /lessons/all 与分页口径不一致。
  const lt = await page.evaluate(() => API.getPage('/lessons', 1, 1).then(d => d.total));
  ok('api.js: lessonIndex 返回全量课程且含 grammarPoint（用于 lessonNo↔id 映射）',
    li.n === li.total && li.n === lt && li.hasGP && li.n > 0,
    JSON.stringify(li) + ' lessonsTotal=' + lt);

  // ---------- ui.js：纯函数渲染 ----------
  const ui = await page.evaluate(() => {
    const out = {};
    out.esc = UI.esc('<a href="x">&"\'');
    out.state = UI.stateHTML('empty', '暂无XX');
    out.streak1 = UI.streakBar(1, false);
    out.streak2 = UI.streakBar(2, true);
    out.lesson = UI.lessonCard({ lessonNo: 6, lessonDate: '2026-09-29', summary: 's', grammarPoint: 'g', vocabCount: 10, exerciseCount: 9, errorCount: 5 });
    out.word = UI.wordCard({ word: 'like', phonetic: '/laɪk/', meaning: '喜欢', example: 'I like music.', firstLessonNo: 1 });
    out.mistake = UI.mistakeCard({ wrongText: 'Tom play soccer', correctText: 'Tom plays soccer', errorType: 'grammar', errorReason: '三单', streak: 1, wrongCount: 3, status: 'pending', priority: 'high', firstLessonNo: 2 });
    out.mistakeDiag = UI.mistakeCard({ wrongText: 'a', correctText: 'b', errorType: 'other', errorReason: 'r', streak: 0, wrongCount: 1, status: 'passed', priority: 'low', firstLessonNo: null });
    out.trend = UI.trendChart([{ lessonNo: 1, lessonDate: '2026-09-26', errorCount: 3 }, { lessonNo: 4, lessonDate: '2026-09-27', errorCount: 6 }]);
    out.trendEmpty = UI.trendChart([]);
    out.mdTable = UI.renderMarkdown('| a | b |\n|---|---|\n| 1 | 2 |');
    out.mdQuote = UI.renderMarkdown('> 中文对照');
    out.mdList = UI.renderMarkdown('- 一\n- 二');
    out.sec = UI.sectionBlock({ sectionType: 'grammar', content: 'hi' });
    out.label = UI.label('priority', 'high') + '/' + UI.label('errorType', 'word_choice') + '/' + UI.label('status', 'passed');
    return out;
  });
  ok('ui.js: esc 转义 &<>"\'', ui.esc === '&lt;a href=&quot;x&quot;&gt;&amp;&quot;&#39;', ui.esc);
  ok('ui.js: stateHTML 生成 .state 占位', /class="state"/.test(ui.state), ui.state);
  ok('ui.js: streakBar(1) 显示 1/2 且宽度 50%', /连续答对 1 \/ 2/.test(ui.streak1) && /width:50%/.test(ui.streak1), ui.streak1);
  ok('ui.js: streakBar(2,passed) 显示「已过关」且满格', /已过关/.test(ui.streak2) && /width:100%/.test(ui.streak2) && /full/.test(ui.streak2), ui.streak2);
  ok('ui.js: lessonCard 标题/href 参数化正确', /第 6 课/.test(ui.lesson) && /lessons\/lesson\.html\?no=6/.test(ui.lesson), ui.lesson.slice(0, 120));
  ok('ui.js: wordCard 含词/音标/释义/来源课', /like/.test(ui.word) && /\/laɪk\//.test(ui.word) && /第 1 课首次出现/.test(ui.word), ui.word);
  ok('ui.js: mistakeCard 含四项硬指标（wrongCount/priority/errorType/来源课）+ streak 条',
    /第 3 次犯/.test(ui.mistake) && /高优先/.test(ui.mistake) && /语法/.test(ui.mistake) && /来源 第 2 课/.test(ui.mistake) && /class="streak"/.test(ui.mistake),
    ui.mistake.slice(0, 240));
  ok('ui.js: mistakeCard 来源为 null 时显示「诊断」（Amy §B.3.1 L619）、passed 带 passed-item',
    /来源 诊断/.test(ui.mistakeDiag) && /passed-item/.test(ui.mistakeDiag),
    ui.mistakeDiag.slice(0, 120));
  ok('ui.js: trendChart 含目标带 2—4 与柱', /目标带 2—4/.test(ui.trend) && /trend-col/.test(ui.trend) && /bar over/.test(ui.trend), ui.trend.slice(0, 200));
  ok('ui.js: trendChart 空数据走 Empty 态', /state/.test(ui.trendEmpty) && /暂无/.test(ui.trendEmpty), ui.trendEmpty);
  ok('ui.js: renderMarkdown 支持表格/引用/列表',
    /<table>/.test(ui.mdTable) && /<blockquote>/.test(ui.mdQuote) && /<ul><li>/.test(ui.mdList),
    [ui.mdTable.slice(0, 30), ui.mdQuote.slice(0, 30), ui.mdList.slice(0, 30)].join(' | '));
  ok('ui.js: sectionBlock 用中文标签 + data-type', /今日语法/.test(ui.sec) && /data-type="grammar"/.test(ui.sec), ui.sec.slice(0, 120));
  ok('ui.js: label 枚举中文化', ui.label === '高优先/用词/已过关', ui.label);

  // ---------- 四态切换 + .hide 可见性（getComputedStyle） ----------
  const disp = await page.evaluate(async () => {
    const r = {};
    // 造一个沙箱
    const box = document.createElement('div');
    box.innerHTML = '<div id="apiError" class="api-error"><span id="apiErrorMsg"></span></div>'
      + '<div id="apiRetry" class="btn" style="display:inline-block"></div>'
      + '<div id="zone"><p class="state loading">正在加载…</p></div>'
      + '<div class="wcard" id="wc1"></div><div class="wcard" id="wc2"></div>'
      + '<div class="mcard hide" id="mc1"></div><div class="tag hide" id="tg1"></div>'
      + '<input id="q"><div id="list"></div>';
    document.body.appendChild(box);

    const cs = n => getComputedStyle(n).display;

    // Loading 态
    UI.setLoading('zone', '正在加载课程…');
    r.loading = /loading/.test(document.getElementById('zone').innerHTML) && /正在加载课程/.test(document.getElementById('zone').innerHTML);

    // Error 态：.api-error 本身 display:flex，.api-error.hide 必须压过它
    document.getElementById('apiError').classList.add('hide');
    r.errHidden = cs(document.getElementById('apiError'));       // 期望 none
    UI.error('课程列表加载失败');
    r.errShown = cs(document.getElementById('apiError'));        // 期望 flex
    r.errText = document.getElementById('apiErrorMsg').textContent;
    UI.clearError();
    r.errCleared = cs(document.getElementById('apiError'));      // 期望 none

    // 各类 .hide 的 computed display
    r.mcardHide = cs(document.getElementById('mc1'));            // none（.mcard 默认 block）
    r.tagHide = cs(document.getElementById('tg1'));              // none（.tag 默认 inline-block）

    // 正常态渲染
    document.getElementById('list').innerHTML = UI.mistakeCard({ wrongText: 'x', correctText: 'y', errorType: 'grammar', errorReason: 'r', streak: 1, wrongCount: 2, status: 'pending', priority: 'high', firstLessonNo: 1 });
    r.rendered = document.querySelectorAll('#list .mcard').length;

    // bindFilter：输入即过滤，隐藏项 computed display 必须 none
    document.getElementById('list').innerHTML = UI.wordCard({ word: 'like' }) + UI.wordCard({ word: 'book' });
    const apply = UI.bindFilter('q', 'list', '.wcard', '没有匹配的词汇，换个关键词试试');
    document.getElementById('q').value = 'book';
    const res = apply();
    const cards = document.querySelectorAll('#list .wcard');
    r.filterVisible = res.visible;
    r.filterHiddenDisplay = cs(cards[0]);   // like -> none
    r.filterShownDisplay = cs(cards[1]);    // book -> grid/block
    // 无命中 -> 出现提示
    document.getElementById('q').value = 'zzz';
    apply();
    r.filterEmptyTip = !!document.querySelector('#list .filter-empty') && cs(document.querySelector('#list .filter-empty')) !== 'none';

    return r;
  });
  ok('四态: setLoading 写入 loading 态', disp.loading, JSON.stringify(disp).slice(0, 80));
  ok('四态: .api-error.hide 的 getComputedStyle().display === none（F5 陷阱不复现）', disp.errHidden === 'none', 'display=' + disp.errHidden);
  ok('四态: UI.error() 让横幅可见（display=flex）且文案正确', disp.errShown === 'flex' && /加载失败/.test(disp.errText), 'display=' + disp.errShown + ' text=' + disp.errText);
  ok('四态: UI.clearError() 重新隐藏横幅', disp.errCleared === 'none', 'display=' + disp.errCleared);
  ok('可见性: .mcard.hide computed display === none', disp.mcardHide === 'none', 'display=' + disp.mcardHide);
  ok('可见性: .tag.hide computed display === none', disp.tagHide === 'none', 'display=' + disp.tagHide);
  ok('正常态: mistakeCard 渲染出 .mcard 节点', disp.rendered === 1, 'count=' + disp.rendered);
  ok('过滤: bindFilter 命中 1 条', disp.filterVisible === 1, 'visible=' + disp.filterVisible);
  ok('过滤: 隐藏项 computed display === none', disp.filterHiddenDisplay === 'none', 'display=' + disp.filterHiddenDisplay);
  ok('过滤: 显示项 computed display !== none', disp.filterShownDisplay !== 'none', 'display=' + disp.filterShownDisplay);
  ok('过滤: 无命中出现「没有匹配」提示且可见', disp.filterEmptyTip === true, 'tip=' + disp.filterEmptyTip);

  ok('无 JS 运行时异常（pageerror 为空；资源 404/400 为负向测试与 favicon，已排除）',
    jsErrors.length === 0, jsErrors.slice(0, 3).join(' ; '));
  results.push({ name: '【信息】资源加载告警（预期内）', pass: true, detail: resErrors.length + ' 条：' + resErrors.slice(0, 4).join(' | ') });

  await browser.close();

  // ---------- 汇总 ----------
  const pass = results.filter(r => r.pass).length;
  console.log('\n===== 共享层真机验证结果 =====');
  results.forEach(r => {
    console.log((r.pass ? 'PASS ' : 'FAIL ') + r.name + (r.pass ? '' : ('\n       实测: ' + r.detail)));
  });
  console.log(`\n合计 ${pass}/${results.length} 通过`);
  process.exit(pass === results.length ? 0 : 1);
})().catch(e => { console.error('HARNESS ERROR:', e); process.exit(2); });
