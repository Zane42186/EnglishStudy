'use strict';

/**
 * 环境配置：统一从 backend/.env 读取，集中校验。
 * 任何模块都不得直接读 process.env，一律通过本模块，避免密钥散落。
 */

const path = require('path');

// 无论从哪个目录启动，都定位到 backend/.env
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

function toInt(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

const env = {
  port: toInt(process.env.PORT, 4000),
  nodeEnv: process.env.NODE_ENV || 'development',
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: toInt(process.env.DB_PORT, 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'english_platform',
    poolLimit: toInt(process.env.DB_POOL_LIMIT, 10),
  },
  defaultStudentName: process.env.DEFAULT_STUDENT_NAME || 'Zane',
};

/** 启动前校验必需项，缺失即快速失败，避免带着半配置运行 */
function assertEnv() {
  const missing = [];
  if (!env.db.host) missing.push('DB_HOST');
  if (!env.db.user) missing.push('DB_USER');
  if (!env.db.database) missing.push('DB_NAME');
  if (env.db.password === '') missing.push('DB_PASSWORD');
  if (missing.length) {
    throw new Error(
      `缺少必需的环境变量：${missing.join(', ')}。请在 backend/.env 中补齐（可参考 .env.example）。`
    );
  }
}

module.exports = { env, assertEnv };
