'use strict';

/**
 * MySQL 连接池。所有 SQL 一律走 prepared statement（参数化），禁止字符串拼接。
 */

const mysql = require('mysql2/promise');
const { env } = require('./env');

let pool = null;

/** 获取（惰性创建）连接池 */
function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: env.db.host,
      port: env.db.port,
      user: env.db.user,
      password: env.db.password,
      database: env.db.database,
      waitForConnections: true,
      connectionLimit: env.db.poolLimit,
      queueLimit: 0,
      charset: 'utf8mb4_unicode_ci',
      dateStrings: ['DATE', 'DATETIME'], // 日期以字符串返回，避免时区偏移
      timezone: '+08:00',
    });
  }
  return pool;
}

/** 执行查询，返回数据行 */
async function query(sql, params = []) {
  const [rows] = await getPool().execute(sql, params);
  return rows;
}

/** 执行写操作（无结果集），返回 { insertId, affectedRows } */
async function execute(sql, params = []) {
  const [result] = await getPool().execute(sql, params);
  return result;
}

/** 在事务中执行；回调抛错则整体回滚 */
async function withTransaction(handler) {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const result = await handler(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/** 连通性检查 */
async function ping() {
  const rows = await query('SELECT 1 AS ok');
  return rows[0] && rows[0].ok === 1;
}

async function close() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = { getPool, query, execute, withTransaction, ping, close };
