'use strict';

/**
 * 数据库初始化：建库 → 建表 → 写入种子数据。
 *
 * 用法：
 *   npm run db:init            建库建表 + 幂等写入种子数据（已有数据不重复写）
 *   npm run db:reset           先 DROP DATABASE 再重建（危险，会清空全部数据）
 *
 * 成功输出 DB_INIT_OK 及各表行数；失败输出 DB_INIT_FAIL 且不残留半成品表结构。
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { env, assertEnv } = require('../src/config/env');
const { seed } = require('./seed');

const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

function baseConfig() {
  return {
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    multipleStatements: true,
    charset: 'utf8mb4_unicode_ci',
  };
}

async function summarize(conn) {
  const tables = ['students', 'lessons', 'lesson_sections', 'vocabulary', 'lesson_vocabulary', 'mistakes', 'study_records', 'progress'];
  const counts = {};
  for (const t of tables) {
    const [[row]] = await conn.query(`SELECT COUNT(*) AS cnt FROM \`${t}\``);
    counts[t] = row.cnt;
  }
  return counts;
}

async function main() {
  const reset = process.argv.includes('--reset');
  assertEnv();

  const dbName = env.db.database;

  // ---- 1. 建库（不指定 database 连接） ----
  const root = await mysql.createConnection(baseConfig());
  try {
    if (reset) {
      await root.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
      console.log(`[db:init] 已删除数据库 ${dbName}（--reset）`);
    }
    await root.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbName}\`
       DEFAULT CHARACTER SET utf8mb4 DEFAULT COLLATE utf8mb4_unicode_ci`
    );
    console.log(`[db:init] 数据库就绪：${dbName}`);
  } finally {
    await root.end();
  }

  // ---- 2. 建表 ----
  const conn = await mysql.createConnection({ ...baseConfig(), database: dbName });
  try {
    const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf8');
    await conn.query(schemaSql);
    console.log('[db:init] 表结构与视图已创建');

    // ---- 3. 种子数据 ----
    const result = await seed(conn);
    console.log(
      `[db:init] 种子数据写入完成：课程 ${result.lessons} · 词汇 ${result.uniqueVocab}（按课累计 ${result.lessonVocab}）· 错词 ${result.mistakes}`
    );

    // ---- 4. 汇总 ----
    const counts = await summarize(conn);
    console.log('');
    console.log('DB_INIT_OK');
    for (const [table, cnt] of Object.entries(counts)) {
      console.log(`  ${table.padEnd(20, ' ')} ${cnt}`);
    }
    return 0;
  } finally {
    await conn.end();
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error('');
    console.error(`DB_INIT_FAIL 原因=${err.message}`);
    if (err.code === 'ECONNREFUSED') {
      console.error('  提示：MySQL 未启动，或 backend/.env 的 DB_HOST / DB_PORT 不正确。');
    }
    if (err.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('  提示：数据库账号或密码不正确，请检查 backend/.env 的 DB_USER / DB_PASSWORD。');
    }
    process.exit(1);
  });
