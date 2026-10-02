/* 生产构建的静态服务（带 SPA 回退）—— 供 `npm run build` 后的 dist/ 使用
 *
 * 为什么要它：Vue Router 用的是 HTML5 history（干净 URL，如 /reading/2026-09-30）。
 * 直接刷新或直达这类路径时，静态服务器必须回退到 index.html，否则 404。
 * 普通 `python -m http.server` 没有这个能力，故随工程附一个极小的 Node 静态服务。
 *
 * 用法：node serve.cjs [port]      （默认 8080；根目录 = 本文件同级的 dist/）
 * 只读服务：不写文件、不连数据库、不碰后端。
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.argv[2] || 8080);
const ROOT = path.join(__dirname, 'dist');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

if (!fs.existsSync(ROOT)) {
  console.error('[serve] 未找到 dist/，请先执行：npm run build');
  process.exit(1);
}

http.createServer(function (req, res) {
  let urlPath = '/';
  try { urlPath = decodeURIComponent((req.url || '/').split('?')[0]); } catch (e) { urlPath = '/'; }
  const target = path.join(ROOT, urlPath);
  // 目录穿越防护：只允许 ROOT 之内
  if (target !== ROOT && !target.startsWith(ROOT + path.sep)) {
    res.writeHead(403); res.end('forbidden'); return;
  }
  function send(file) {
    fs.readFile(file, function (err, buf) {
      if (err) { res.writeHead(500); res.end('server error'); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      res.end(buf);
    });
  }
  fs.stat(target, function (err, st) {
    if (!err && st.isFile()) { return send(target); }
    // SPA 回退：路由路径（/reading/... 等）→ index.html
    send(path.join(ROOT, 'index.html'));
  });
}).listen(PORT, function () {
  console.log('[serve] dist 已启动：http://localhost:' + PORT + '（SPA 回退已开启）');
});
