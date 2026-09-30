'use strict';

/**
 * 前后端联调验证脚本（只读，不修改任何前后端代码）
 *
 * 做三件事：
 *   A. 正常链路：从静态服务器加载真实 review/index.html，
 *      在 jsdom 中真实执行页面脚本，让 window.fetch 真实打到后端 API，
 *      然后读取渲染后的 DOM，验证「DB → API → 前端显示」。
 *   B. 空数据：把 API 响应替换成空列表，验证 Empty 态。
 *   C. 请求失败：让 fetch 抛错，验证 Error 态（错误提示 + 重试按钮）。
 *
 * 用法：
 *   NODE_PATH=<managed node workspace/node_modules> node backend/scripts/integration-check.js
 */

const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const PAGE_URL = process.env.PAGE_URL || 'http://localhost:5500/index.html';
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

function realFetch(url, opts) {
  return fetch(url, opts);
}

let RAW_HTML = '';

/** 构造一个 jsdom 实例并加载真实页面 HTML */
async function loadPage(fetchImpl) {
  const html = await (await fetch(PAGE_URL)).text();
  RAW_HTML = html;
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (e) => errors.push('jsdomError: ' + e.message));
  virtualConsole.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));

  const dom = new JSDOM(html, {
    url: PAGE_URL,
    runScripts: 'dangerously',
    resources: 'usable', // P0 起页面依赖外部 assets/*.js，必须真加载
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse(window) {
      // 页面内联脚本在构造期间即执行，因此必须在 beforeParse 里就挂上 fetch
      window.__netLog = [];
      window.fetch = function (url, opts) {
        window.__netLog.push(String(url));
        return fetchImpl(url, opts);
      };
    },
  });

  return { dom, errors };
}

/** 轮询等待，直到页面把某个统计卡写成非 loading 值 */
function waitFor(fn, timeoutMs = 8000) {
  const start = Date.now();
  return new Promise((resolve) => {
    (function tick() {
      let done = false;
      try {
        done = fn();
      } catch {
        done = false;
      }
      if (done || Date.now() - start > timeoutMs) return resolve(done);
      setTimeout(tick, 60);
    })();
  });
}

(async function main() {
  console.log('==================================================');
  console.log(' 前后端联调验证：Frontend → API → Database');
  console.log(' 页面：' + PAGE_URL);
  console.log(' 接口：' + API_ORIGIN);
  console.log('==================================================');

  // ---------- A. 正常链路 ----------
  console.log('\n[A] 正常链路（真实 API + 真实数据库）');
  const { dom, errors } = await loadPage(realFetch);
  const { window } = dom;
  const doc = window.document;

  const ok = await waitFor(() => {
    const el = doc.getElementById('statLessons');
    return el && el.textContent !== '…' && el.textContent !== '';
  });

  check('页面脚本执行完成（统计卡不再是 loading）', ok, ok ? '异步数据已回填' : '超时未回填');
  check('浏览器控制台无 JS 错误', errors.length === 0, errors.slice(0, 3).join(' | '));

  const statLessons = doc.getElementById('statLessons').textContent;
  const statLevel = doc.getElementById('statLevel').textContent;
  const statVocab = doc.getElementById('statVocab').textContent;
  const statMistakes = doc.getElementById('statMistakes').textContent;
  const cards = doc.querySelectorAll('.card.lesson');
  const lessonCount = doc.getElementById('lessonCount').textContent;
  const firstCard = cards[0];

  check('已上课数（来自 GET /api/lessons 的 total）', /^\d+$/.test(statLessons) && statLessons !== '0', '显示 = ' + statLessons);
  check('当前级别（来自 GET /api/progress.currentLevel）', /Level\s*\d/.test(statLevel), '显示 = ' + statLevel);
  check('累计生词（来自 GET /api/vocabulary/stats.total）', /^\d+$/.test(statVocab) && statVocab !== '0', '显示 = ' + statVocab);
  check('未过关错词（来自 GET /api/mistakes/stats.pending）', /^\d+$/.test(statMistakes) && statMistakes !== '0', '显示 = ' + statMistakes);
  check('课程卡片已渲染', cards.length > 0, '卡片数 = ' + cards.length);
  check('课程数量文案已回填', /共\s*\d+\s*课/.test(lessonCount), '显示 = "' + lessonCount + '"');

  if (firstCard) {
    const title = firstCard.querySelector('h3').textContent;
    check('首张卡片含真实课号与日期', /第\s*\d+\s*课/.test(title), title.trim());
    const link = firstCard.querySelector('a.btn');
    // P2 起详情页参数化为 lessons/lesson.html?no=N，旧的 lesson-N.html 仍兼容
    check(
      '卡片带「查看全文」详情链接',
      !!link && /lessons\/(lesson-\d+\.html|lesson\.html\?no=\d+)$/.test(link.getAttribute('href')),
      link ? link.getAttribute('href') : '无'
    );
  }

  // 请求契约核对：页面真实发出的 URL 必须全部落在后端已实现接口上。
  // 不写死前端路径（写死过一次：前端从 ?size=100 改到 /lessons/all 后即误报），
  // 改为向后端接口索引核对「请求的是不是真实存在的接口」，避免随前端演进再次过期。
  const requested = [...new Set(window.__netLog.map((u) => u.replace(API_ORIGIN, '')))]
    .filter((u) => u.startsWith('/api'));
  console.log('  ℹ️  页面实际请求：' + requested.join(' , '));

  const indexBody = await (await fetch(API_ORIGIN + '/api')).json();
  const known = new Set((indexBody.data.endpoints || []).map((e) => e.replace(/^\w+\s+/, '')));
  const unknown = requested.filter((u) => {
    const p = u.split('?')[0];
    if (known.has(p)) return false;
    return ![...known].some((k) =>
      k.includes(':') && new RegExp('^' + k.replace(/:[a-zA-Z]+/g, '[^/]+') + '$').test(p)
    );
  });
  check(
    '页面请求全部落在后端已实现接口上（无 404 风险）',
    unknown.length === 0,
    unknown.length ? '未知路径 ' + unknown.join(' , ') : `${requested.length} 个请求全部命中`
  );

  const requiredSubset = ['/api/progress', '/api/vocabulary/stats', '/api/mistakes/stats', '/api/lessons/all', '/api/agent/snapshot'];
  const missing = requiredSubset.filter((e) => !requested.includes(e));
  check(
    '首页必需接口均已调用',
    missing.length === 0,
    missing.length ? '缺失 ' + missing.join(' , ') : `${requiredSubset.length}/${requiredSubset.length} 命中`
  );

  // Loading 态证据：P0 起样式抽到 assets/board.css，需连外部样式一起校验
  let css = '';
  try {
    css = await (await fetch(new URL('assets/board.css', PAGE_URL))).text();
  } catch {
    css = '';
  }
  check(
    'Loading 态已实现（.state.loading + 转圈动画）',
    /class="state loading"/.test(RAW_HTML) && /@keyframes\s+spin/.test(RAW_HTML + css),
    '首屏占位存在；转圈动画在 ' + (/@keyframes\s+spin/.test(RAW_HTML) ? '内联样式' : 'assets/board.css')
  );
  dom.window.close();

  // ---------- B. 空数据 ----------
  console.log('\n[B] 空数据态（API 返回空列表）');
  const emptyFetch = (url) => {
    if (String(url).includes('/api/lessons')) {
      return Promise.resolve(jsonResponse({ code: 200, message: 'success', data: { list: [], total: 0, page: 1, size: 100 } }));
    }
    if (String(url).includes('/api/progress')) {
      return Promise.resolve(jsonResponse({ code: 200, message: 'success', data: { currentLevel: 'Level 0' } }));
    }
    return Promise.resolve(jsonResponse({ code: 200, message: 'success', data: { total: 0, pending: 0 } }));
  };
  const domB = (await loadPage(emptyFetch)).dom;
  await waitFor(() => domB.window.document.getElementById('lessonList').textContent.indexOf('暂无课程记录') !== -1);
  const emptyText = domB.window.document.getElementById('lessonList').textContent.trim();
  check('空列表渲染为「暂无课程记录」', emptyText.indexOf('暂无课程记录') !== -1, '"' + emptyText + '"');
  domB.window.close();

  // ---------- C. 请求失败 ----------
  console.log('\n[C] 错误态（网络失败）');
  const failFetch = () => Promise.reject(new Error('Failed to fetch'));
  const domC = (await loadPage(failFetch)).dom;
  await waitFor(() => !domC.window.document.getElementById('apiError').classList.contains('hide'));
  const errBox = domC.window.document.getElementById('apiError');
  const errMsg = domC.window.document.getElementById('apiErrorMsg').textContent;
  check('错误提示条已显示', !errBox.classList.contains('hide'), 'class="' + errBox.className + '"');
  check('提示文案含失败原因与排查指引', /加载失败/.test(errMsg) && /后端服务/.test(errMsg), '"' + errMsg + '"');
  check('提供「重试」按钮', !!domC.window.document.getElementById('apiRetry'), 'button#apiRetry');
  domC.window.close();

  console.log('\n==================================================');
  console.log(` 结果：${pass} 通过 / ${fail} 失败`);
  console.log('==================================================');
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => {
  console.error('联调脚本异常：', e);
  process.exit(2);
});

function jsonResponse(body) {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  };
}
