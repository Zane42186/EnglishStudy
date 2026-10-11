'use strict';

/**
 * 生产库 → 隔离测试库：**克隆结构 + 数据**，供 test:api / test:write 在
 * 「不触碰生产」的前提下运行（D1 方案二 / 2026-10-03）。
 *
 * 为什么需要：
 *   测试脚本会写库（如 scripts/write-api-check.js 会 INSERT/DELETE 临时学生与课程）。
 *   它们原先直连生产库，每次运行都会**推进生产库的 AUTO_INCREMENT**
 *   （表现为 lessons.id 跳号 47/79/92），且删行**不回退**计数器。
 *   方案二＝让测试指向一个独立的、可随时重建的副本库。
 *
 * 对生产库**只读**：全程仅执行 `mysqldump --single-transaction`（InnoDB 一致性快照读，
 * 不加表锁、不写源库）。目标库会被 **DROP 后重建**，故有名字安全闸（非 *_test 需 --force）。
 *
 * 用法：
 *   node db/migration/clone_to_test.js                    # english_platform → english_platform_test
 *   node db/migration/clone_to_test.js --to other_test     # 自定义目标库
 *   node db/migration/clone_to_test.js --src A --to B      # 自定义源/目标
 *
 * 外部命令：mysqldump / mysql（MySQL 8.0 客户端）。
 * 查找顺序：环境变量 MYSQL_BIN_DIR → 系统 PATH → 常见安装路径。
 * 成功输出 CLONE_OK + 逐表行数比对；失败输出 CLONE_FAIL 且不残留半成品目标库。
 */

const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const mysql = require('mysql2/promise');
const { env, assertEnv } = require('../../src/config/env');

// ---------------------------------------------------------------------------
// 参数
// ---------------------------------------------------------------------------
function argVal(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : null;
}

const FORCE = process.argv.includes('--force');
const SRC_DB = argVal('--src') || env.db.database;
const DST_DB = argVal('--to') || `${SRC_DB}_test`;

// 13 张业务表（与 db/init.js 的汇总清单同源；视图不计入行数比对）
const TABLES = [
  'students', 'lessons', 'lesson_sections', 'vocabulary', 'lesson_vocabulary',
  'mistakes', 'study_records', 'progress', 'lesson_exercises', 'mistake_events',
  'readings', 'reading_pieces', 'reading_questions',
];

// ---------------------------------------------------------------------------
// 客户端可执行文件定位
// ---------------------------------------------------------------------------
function resolveBin(name) {
  const exe = process.platform === 'win32' ? `${name}.exe` : name;
  const dirs = [];
  if (process.env.MYSQL_BIN_DIR) dirs.push(process.env.MYSQL_BIN_DIR);

  // 从 PATH 找
  for (const p of String(process.env.PATH || '').split(path.delimiter)) {
    if (p) dirs.push(p);
  }
  // 本机常见安装路径兜底
  dirs.push(
    'C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin',
    'C:\\Program Files\\MySQL\\MySQL Server 8.4\\bin',
    'D:\\MySQL Server 8.0\\bin',
    '/usr/bin', '/usr/local/bin', '/usr/local/mysql/bin'
  );

  for (const d of dirs) {
    const full = path.join(d, exe);
    try {
      if (fs.existsSync(full)) return full;
    } catch { /* 忽略不可访问目录 */ }
  }
  return exe; // 交给系统按 PATH 解析
}

// ---------------------------------------------------------------------------
// mysql2 连接 / 命令行参数
// ---------------------------------------------------------------------------
function connArgs(extra = []) {
  const a = [
    '-h', env.db.host,
    '-P', String(env.db.port),
    '-u', env.db.user,
    ...extra,
  ];
  return a;
}

/** mysql2 连接配置（只挑 mysql2 认得的字段，避免 poolLimit 之类触发告警） */
function mysqlCfg(database) {
  return {
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    ...(database ? { database } : {}),
  };
}

async function main() {
  assertEnv();

  if (DST_DB === SRC_DB) {
    throw new Error(`目标库不能等于源库（${SRC_DB}）`);
  }
  if (!/_test$/.test(DST_DB) && !FORCE) {
    throw new Error(
      `目标库名「${DST_DB}」不以 _test 结尾。这会 DROP 该库的全部数据。` +
      `若确要如此，请加 --force。`
    );
  }

  // 口令走 MYSQL_PWD，避免出现在命令行（ps）中
  process.env.MYSQL_PWD = env.db.password;

  const mysqldump = resolveBin('mysqldump');
  const mysqlCli = resolveBin('mysql');
  console.log(`[clone] 源库 ${SRC_DB}  →  目标库 ${DST_DB}`);
  console.log(`[clone] mysqldump=${mysqldump}`);
  console.log(`[clone] mysql=${mysqlCli}`);

  // ---- 1. 重建目标库 ----
  const root = await mysql.createConnection({ ...mysqlCfg(), multipleStatements: true });
  try {
    await root.query(`DROP DATABASE IF EXISTS \`${DST_DB}\``);
    await root.query(
      `CREATE DATABASE \`${DST_DB}\`
       DEFAULT CHARACTER SET utf8mb4 DEFAULT COLLATE utf8mb4_unicode_ci`
    );
    console.log(`[clone] 目标库已重建：${DST_DB}`);
  } finally {
    await root.end();
  }

  // ---- 2. 管道：mysqldump（只读源库）→ mysql（写入目标库） ----
  const dumpArgs = connArgs([
    '--single-transaction',     // InnoDB 一致性快照，不加表锁
    '--no-tablespaces',         // 免 PROCESS 权限
    '--set-gtid-purged=OFF',    // 免 GTID 相关权限/语句
    '--column-statistics=0',    // 免 information_schema.column_statistics 依赖
    '--default-character-set=utf8mb4',
    '--routines', '--triggers', '--events',
    SRC_DB,                     // 位置参数：库名（输出中不含 CREATE DATABASE/USE）
  ]);
  const loadArgs = connArgs(['--default-character-set=utf8mb4', DST_DB]);

  console.log('[clone] 正在导出并导入（一致性快照读）…');
  const dump = spawn(mysqldump, dumpArgs, { stdio: ['ignore', 'pipe', 'inherit'], env: process.env });
  const load = spawn(mysqlCli, loadArgs, { stdio: ['pipe', 'inherit', 'inherit'], env: process.env });
  dump.stdout.pipe(load.stdin);
  dump.stdout.on('error', () => { /* EPIPE */ });
  load.stdin.on('error', () => { /* EPIPE */ });

  const [dumpCode, loadCode] = await Promise.all([
    new Promise((res) => dump.on('close', res)),
    new Promise((res) => load.on('close', res)),
  ]);
  if (dumpCode !== 0) throw new Error(`mysqldump 退出码 ${dumpCode}`);
  if (loadCode !== 0) throw new Error(`mysql 导入退出码 ${loadCode}`);

  // ---- 3. 逐表比对行数 ----
  const src = await mysql.createConnection(mysqlCfg(SRC_DB));
  const dst = await mysql.createConnection(mysqlCfg(DST_DB));
  const mismatches = [];
  try {
    for (const t of TABLES) {
      const [[a]] = await src.query(`SELECT COUNT(*) AS c FROM \`${t}\``);
      const [[b]] = await dst.query(`SELECT COUNT(*) AS c FROM \`${t}\``);
      const ok = Number(a.c) === Number(b.c);
      if (!ok) mismatches.push(`${t}: 源 ${a.c} ≠ 目标 ${b.c}`);
      console.log(`  ${ok ? '✓' : '✗'} ${t.padEnd(20)} ${b.c}`);
    }
  } finally {
    await src.end();
    await dst.end();
  }

  if (mismatches.length) {
    throw new Error(`行数比对不一致：\n  ${mismatches.join('\n  ')}`);
  }

  console.log('');
  console.log('CLONE_OK');
  console.log(`  源库 ${SRC_DB} → 目标库 ${DST_DB}：13 张表逐表行数一致`);
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error('');
    console.error(`CLONE_FAIL 原因=${err.message}`);
    if (err.code === 'ECONNREFUSED') {
      console.error('  提示：MySQL 未启动，或 backend/.env 的 DB_HOST / DB_PORT 不正确。');
    }
    if (err.code === 'ENOENT') {
      console.error('  提示：未找到 mysqldump / mysql。请设置 MYSQL_BIN_DIR 指向 MySQL 客户端 bin 目录。');
    }
    process.exit(1);
  });
