'use strict';

const createApp = require('./app');
const { env, assertEnv } = require('./config/env');
const db = require('./config/db');

async function start() {
  // 配置缺失即快速失败，不带着半配置运行
  assertEnv();

  // 启动前确认数据库可用，避免服务起来了但每个请求都 500
  try {
    await db.ping();
    console.log(`[db] 已连接 MySQL ${env.db.host}:${env.db.port}/${env.db.database}`);
  } catch (err) {
    console.error('[db] 数据库连接失败：', err.message);
    console.error('     请确认 MySQL 已启动、backend/.env 配置正确，并已执行 npm run db:init');
    process.exit(1);
  }

  const app = createApp();
  const server = app.listen(env.port, () => {
    console.log(`[server] English Learning Platform Backend 已启动`);
    console.log(`[server] 环境：${env.nodeEnv}`);
    console.log(`[server] 地址：http://localhost:${env.port}`);
    console.log(`[server] 接口：http://localhost:${env.port}/api`);
    console.log(`[server] 健康：http://localhost:${env.port}/api/health`);
  });

  // 优雅退出：先停止接收新连接，再关闭数据库连接池
  const shutdown = async (signal) => {
    console.log(`\n[server] 收到 ${signal}，正在关闭…`);
    server.close(async () => {
      await db.close().catch(() => {});
      console.log('[server] 已关闭');
      process.exit(0);
    });
    // 兜底：5 秒内没关完就强制退出
    setTimeout(() => process.exit(1), 5000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch((err) => {
  console.error('[server] 启动失败：', err.message);
  process.exit(1);
});
