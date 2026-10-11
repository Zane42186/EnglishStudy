'use strict';

/**
 * 以**隔离测试库**启动 API 服务（D1 方案二 / 2026-10-03）。
 *
 * 目的：让 test:api / test:write 打在一个与生产互不干扰的端口+库上，
 * 避免测试写操作推进生产库的 AUTO_INCREMENT（lessons.id 跳号）。
 *
 * 默认：DB_NAME=english_platform_test、PORT=4100。
 * 可用环境变量覆盖（须在启动本脚本前设置）：
 *   DB_NAME=xxx PORT=4200 npm run start:test     # bash
 * 前置：先 `npm run db:test:clone` 造好测试库。
 *
 * 说明：本脚本**先**设置 process.env，再 require 服务入口；
 * src/config/env.js 的 dotenv 是「不覆盖已有环境变量」语义，
 * 因此这里的赋值会胜过 backend/.env 里的 DB_NAME=english_platform。
 * 生产默认值不受影响（`npm start` 仍连 english_platform / 4000）。
 */

process.env.DB_NAME = process.env.DB_NAME || 'english_platform_test';
process.env.PORT = process.env.PORT || '4100';
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

const { env } = require('../src/config/env');

// 双保险：装配后再校验一次，防止有人用 .env 把测试实例指回生产库
if (env.db.database === 'english_platform') {
  console.error(
    '[start:test] 拒绝启动：目标库是生产库 english_platform。' +
    '请先 `npm run db:test:clone`，或显式设置 DB_NAME=<something>_test。'
  );
  process.exit(1);
}

console.log(`[start:test] 隔离实例 → 库=${env.db.database} 端口=${env.port}（生产 4000 不受影响）`);

require('../src/server.js');
