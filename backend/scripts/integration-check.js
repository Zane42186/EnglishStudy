/* 前后端联调验证（只读，不修改任何前后端代码）—— 2026-10-02 迁到 Vue 版
 *
 * 原生版退役（见 docs/plans/frontend-plan.md §14）后，本脚本由 **jsdom 执行 review/index.html**
 * 改为 **playwright 驱动 Vue 站**。之所以必须换引擎：Vue 站是 Vite 的 ESM 产物，jsdom 不支持 ES 模块。
 *
 * 做三件事：
 *   A. 正常链路：加载 Vue 首页，让 window.fetch 真实打到后端 API，读取渲染后的 DOM，
 *      验证「DB → API → 前端显示」，并把页面**实际请求的路径**与后端接口索引核对。
 *   B. 空数据：用路由拦截把列表接口替换成空列表，验证 Empty 态。
 *   C. 请求失败：用路由拦截把**所有** `/api/**` 替换成失败包络，验证 Error 态（错误横幅 + 重试按钮）。
 *      注：必须拦全部接口。原先只拦 `/api/lessons/all` 会**误判**——`API.lessonIndex()` 对 /all 失败
 *      内置了「回退分页 /lessons」的容错，单点失败会被静默兜住，横幅当然不出现。
 *      （退役前 jsdom 版就是让 fetch 全量 reject，此处恢复同一语义。）
 *
 * 前置：后端 4000 在线；Vue 站已起（`cd frontend && npm run dev` 或 `node frontend/serve.cjs 8080`）
 * 用法：
 *   NODE_PATH=<managed node workspace/node_modules> node backend/scripts/integration-check.js [BASE]
 *   BASE 默认 http://localhost:5173
 *
 * 注：原 jsdom 版的 17 条断言中，「页级 UI 行为」部分（卡片链接、搜索、翻页等）
 *     已由 frontend/scripts/verify-vue.cjs 的 64 条全站断言覆盖；本脚本只保留**联调**关注点。
 */
'use strict';

const { chromium } = require('playwright-core');

const SITE = process.env.BASE || process.argv[2] || 'http://localhost:5173';
const API_ORIGIN = process.env.API_ORIGIN || 'http://localhost:4000';

let pass = 0;
let fail = 0;

function check(label, ok, detail) {
  if (ok) {
    pass += 1;
    console.log(`  ✅ ${label}${detail ? '  → ' + detail : ''}`);
  } else {
    fail += 1;
    console.log(`  ❌ ${label}${detail ? '  → ' + detail : ''}`);
  }
}

const EMPTY_PAGE = JSON.stringify({ code: 200, message: 'success', data: { list: [], total: 0, page: 1, size: 100 } });
const FAIL_ENVELOPE = JSON.stringify({ code: 500, message: '联调模拟失败', data: null });

(async function main() {
  console.log('==================================================');
  console.log(' 前后端联调验证：Frontend(Vue) → API → Database');
  console.log(' 站点：' + SITE);
  console.log(' 接口：' + API_ORIGIN);
  console.log('==================================================');

  const browser = await chromium.launch({ channel: 'msedge', headless: true });

  // ---------- A. 正常链路 ----------
  console.log('\n[A] 正常链路（真实 API + 真实数据库）');
  {
    const page = await browser.newPage();
    const jsErrors = [];
    const netLog = [];
    page.on('pageerror', e => jsErrors.push(e.message));
    page.on('request', r => netLog.push(r.url()));

    await page.goto(SITE + '/', { waitUntil: 'networkidle' });
    await page.waitForSelector('#lessonList .ltoc-item', { timeout: 15000 });

    // 期望值直接从后端取，避免与接口口径漂移
    const api = {
      lessons: await (await fetch(API_ORIGIN + '/api/lessons?page=1&size=1')).json(),
      vocab: await (await fetch(API_ORIGIN + '/api/vocabulary/stats')).json(),
      mistakes: await (await fetch(API_ORIGIN + '/api/mistakes/stats')).json(),
      progress: await (await fetch(API_ORIGIN + '/api/progress')).json()
    };

    const d = await page.evaluate(() => {
      const txt = id => (document.getElementById(id) || {}).textContent;
      const toc = document.querySelectorAll('#lessonList .ltoc-item');
      return {
        lessons: txt('statLessons'), level: txt('statLevel'), vocab: txt('statVocab'), mistakes: txt('statMistakes'),
        tocCount: toc.length,
        lessonCount: txt('lessonCount'),
        firstTitle: toc[0] ? toc[0].querySelector('b').textContent : '',
        loadingLeft: document.querySelectorAll('.state.loading').length
      };
    });

    check('页面脚本执行完成（统计卡不再是 loading 占位）',
      d.lessons !== '…' && d.lessons !== '' && d.loadingLeft === 0, `statLessons=${d.lessons} loading占位=${d.loadingLeft}`);
    check('浏览器控制台无 JS 错误', jsErrors.length === 0, jsErrors.slice(0, 3).join(' | '));
    check('已上课数 === GET /api/lessons 的 total（DB→API→页面）',
      d.lessons === String(api.lessons.data.total), `显示=${d.lessons} 接口=${api.lessons.data.total}`);
    check('当前级别 === GET /api/progress.currentLevel',
      d.level === String(api.progress.data.currentLevel), `显示=${d.level} 接口=${api.progress.data.currentLevel}`);
    check('累计生词 === GET /api/vocabulary/stats.total',
      d.vocab === String(api.vocab.data.total), `显示=${d.vocab} 接口=${api.vocab.data.total}`);
    check('未过关错词 === GET /api/mistakes/stats.pending',
      d.mistakes === String(api.mistakes.data.pending), `显示=${d.mistakes} 接口=${api.mistakes.data.pending}`);
    check('课程目录已渲染且项数 = total',
      d.tocCount > 0 && d.tocCount === api.lessons.data.total, `目录=${d.tocCount} 接口=${api.lessons.data.total}`);
    check('课程数量文案已回填', /共\s*\d+\s*课/.test(d.lessonCount || ''), '显示 = "' + d.lessonCount + '"');
    check('首个目录项含真实课号与日期', /第\s*\d+\s*课/.test(d.firstTitle || ''), (d.firstTitle || '').trim());

    // 请求契约核对：页面真实发出的 URL 必须全部落在后端已实现接口上
    const requested = [...new Set(netLog.filter(u => u.startsWith(API_ORIGIN + '/api'))
      .map(u => u.replace(API_ORIGIN, '').split('?')[0]))];
    console.log('  ℹ️  页面实际请求：' + requested.join(' , '));
    const indexBody = await (await fetch(API_ORIGIN + '/api')).json();
    const known = new Set((indexBody.data.endpoints || []).map(e => e.replace(/^\w+\s+/, '')));
    const unknown = requested.filter(p => {
      if (known.has(p)) return false;
      return ![...known].some(k => k.includes(':') && new RegExp('^' + k.replace(/:[a-zA-Z]+/g, '[^/]+') + '$').test(p));
    });
    check('页面请求全部落在后端已实现接口上（无 404 风险）',
      unknown.length === 0,
      unknown.length ? '未知路径 ' + unknown.join(' , ') : `${requested.length} 个请求全部命中`);

    const required = ['/api/progress', '/api/vocabulary/stats', '/api/mistakes/stats', '/api/lessons/all', '/api/readings/stats'];
    const missing = required.filter(e => !requested.includes(e));
    check('首页必需接口均已调用', missing.length === 0,
      missing.length ? '缺失 ' + missing.join(' , ') : `${required.length}/${required.length} 命中`);

    // Loading 态证据：需连样式一起校验（Vue 版样式来自 board.css，dev 下由模块注入 / 生产为独立 CSS）
    let css = await page.evaluate(() => {
      const l = document.querySelector('link[rel=stylesheet]');
      return l ? l.href : '';
    });
    css = css ? await (await fetch(css)).text() : '';
    if (!css) { try { css = await (await fetch(SITE + '/src/styles/board.css')).text(); } catch { css = ''; } }
    check('Loading 态已实现（.state.loading + 转圈动画）',
      /@keyframes\s+spin/.test(css), css ? '样式含 @keyframes spin' : '未取到样式表');

    await page.close();
  }

  // ---------- B. 空数据 ----------
  console.log('\n[B] 空数据态（列表接口返回空）');
  {
    const page = await browser.newPage();
    await page.route('**/api/**', route => {
      const u = route.request().url();
      // 只把「列表类」接口置空，其余（/progress 等）放行真实后端
      if (/\/(lessons|vocabulary|mistakes|readings)(\?|\/|$)/.test(u.replace(API_ORIGIN, '')) && !/\/stats/.test(u)) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: EMPTY_PAGE });
      }
      return route.continue();
    });
    await page.goto(SITE + '/', { waitUntil: 'networkidle' });
    await page.waitForSelector('#lessonList .state', { timeout: 15000 }).catch(() => { });
    const d = await page.evaluate(() => ({
      tocText: document.getElementById('lessonList').textContent.trim(),
      stageText: document.getElementById('stageBody').textContent.trim(),
      hasState: document.querySelectorAll('#lessonList .state').length > 0
    }));
    check('空数据 → 课程目录走 Empty 态（.state 占位）', d.hasState && /暂无课程记录/.test(d.tocText), d.tocText.slice(0, 40));
    check('空数据 → 正文区同样给出 Empty 文案（不空白、不报错）', /暂无课程记录/.test(d.stageText), d.stageText.slice(0, 40));
    await page.close();
  }

  // ---------- C. 请求失败 ----------
  console.log('\n[C] 请求失败态（所有接口返回失败包络）');
  {
    const page = await browser.newPage();
    // 拦全部 /api/**：任一单点失败会被 lessonIndex 的回退容错兜住，必须全量失败才能进 Error 态
    await page.route('**/api/**', route => route.fulfill({
      status: 200, contentType: 'application/json', body: FAIL_ENVELOPE
    }));
    await page.goto(SITE + '/', { waitUntil: 'networkidle' });
    await page.waitForFunction(
      () => getComputedStyle(document.getElementById('apiError')).display !== 'none',
      null, { timeout: 15000 }
    ).catch(() => { });
    const d = await page.evaluate(() => ({
      errDisplay: getComputedStyle(document.getElementById('apiError')).display,
      errText: (document.getElementById('apiErrorMsg') || {}).textContent,
      hasRetry: !!document.getElementById('apiRetry'),
      stageText: document.getElementById('stageBody').textContent.trim()
    }));
    check('请求失败 → 错误横幅可见（computed display != none）',
      d.errDisplay !== 'none', 'display=' + d.errDisplay);
    check('错误文案为局部降级（含「加载失败」+ 原因）', /加载失败/.test(d.errText || ''), d.errText);
    check('横幅带「重试」按钮', d.hasRetry, 'hasRetry=' + d.hasRetry);
    check('失败时不白屏（正文区仍有可读文案）', d.stageText.length > 0, d.stageText.slice(0, 40));
    await page.close();
  }

  await browser.close();

  console.log('\n==================================================');
  console.log(` 结果：通过 ${pass} 项，失败 ${fail} 项`);
  console.log('==================================================');
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error('HARNESS ERROR:', e); process.exit(2); });
