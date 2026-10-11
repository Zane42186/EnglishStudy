'use strict';

/**
 * 隔离测试运行器（D1 方案二 / 2026-10-03）。
 *
 * 作用：把 `DB_NAME` 指向隔离测试库，再运行既有测试脚本，并强制 BASE 指向测试端口。
 * 为什么需要这层壳：`scripts/write-api-check.js` 除了打 API，还会**直连数据库**
 * 做「清理前后全库计数」自证；若不改 `DB_NAME`，它会连到**生产库**，
 * 造成「写测试库、验生产库」的错位（自证失效且误导）。
 *
 * 用法（前置：先 `npm run db:test:clone`、另开终端 `npm run start:test`）：
 *   node scripts/isolated.js smoke [base]    # = smoke-test.js（test:api）
 *   node scripts/isolated.js write [base]    # = write-api-check.js（test:write）
 * base 缺省 http://localhost:4100。
 */

const mode = process.argv[2];
const base = process.argv[3] || 'http://localhost:4100';

process.env.DB_NAME = process.env.DB_NAME || 'english_platform_test';

if (process.env.DB_NAME === 'english_platform') {
  console.error('[isolated] 拒绝运行：DB_NAME 指向生产库 english_platform。');
  process.exit(1);
}

console.log(`[isolated] 库=${process.env.DB_NAME}  BASE=${base}`);

// 让被 require 的脚本把 base 当作 argv[2]（它们都是 `process.argv[2] || PORT||4000`）
process.argv = [process.argv[0], process.argv[1], base];

if (mode === 'smoke') {
  require('./smoke-test.js');
} else if (mode === 'write') {
  require('./write-api-check.js');
} else {
  console.error('用法：node scripts/isolated.js <smoke|write> [base]');
  process.exit(1);
}
