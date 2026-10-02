/* 页级前端验证 —— **Vue 版入口别名**（2026-10-02 随原生版退役迁移）
 *
 * 背景：原生站 `review/` 已退役（见 `docs/plans/frontend-plan.md` §14）。本文件原先针对
 *   `review/{index,words,wrong,lessons/lesson}.html` 的 61 条断言，**已由
 *   `frontend/scripts/verify-vue.cjs` 的 64 条全站断言完整覆盖** ——
 *   两版刻意保持 DOM 的 id/class 同名（`#stageTitle`/`#toggleAll`/`.ltoc-item`/`.mcard`…），
 *   断言逐条可对照（home / reading / words / wrong / lesson 五个区块）。
 *
 * 因此本文件不再维护第二份断言：保留为**入口别名**，真实执行 Vue 版全站验证并透传退出码，
 * 这样既有的调用习惯（脚本路径）与「测试全绿」口径继续成立，且不产生失效脚本。
 *
 * 前置：
 *   1) 后端：curl --noproxy '*' http://localhost:4000/api/health  → code=200
 *   2) Vue 前端站：`cd frontend && npm run dev`（5173）或 `node frontend/serve.cjs 8080`（dist）
 *
 * 运行（需 NODE_PATH，playwright-core 装在受管 node workspace；会一并传给子进程）：
 *   NODE_PATH="C:\Users\lenovo\.workbuddy\binaries\node\workspace\node_modules" \
 *     node backend/scripts/verify-frontend-pages.js
 *   BASE=http://localhost:8080 node backend/scripts/verify-frontend-pages.js   # 验证生产构建
 *
 * 退出码：透传子脚本（0 = 全通过，1 = 有失败，2 = 脚本自身异常）。
 */
'use strict';

const path = require('path');
const { spawnSync } = require('child_process');

const BASE = process.env.BASE || process.argv[2] || 'http://localhost:5173';
const target = path.join(__dirname, '..', '..', 'frontend', 'scripts', 'verify-vue.cjs');

console.log('[verify-frontend-pages] 原生版已退役（frontend-plan §14）→ 转发执行 Vue 版全站验证');
console.log('[verify-frontend-pages] 目标：' + target);
console.log('[verify-frontend-pages] BASE：' + BASE + '\n');

const r = spawnSync(process.execPath, [target, BASE], { stdio: 'inherit', env: process.env });
process.exit(r.status == null ? 2 : r.status);
