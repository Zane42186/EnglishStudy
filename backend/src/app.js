'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');

const requestContext = require('./middlewares/requestContext');
const notFound = require('./middlewares/notFound');
const errorHandler = require('./middlewares/errorHandler');
const apiRoutes = require('./routes');
const { env } = require('./config/env');

function createApp() {
  const app = express();

  app.disable('x-powered-by');

  // 安全响应头。第一阶段的静态看板通过 file:// 或本地服务打开，
  // 这里放宽 CSP，避免前端接入时被拦截；上线前需收紧。
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));

  // CORS：本地个人项目，开发期放开；生产环境应改为白名单。
  app.use(cors({ origin: true, credentials: false }));

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false }));

  app.use(requestContext);
  app.use(
    morgan(env.nodeEnv === 'production' ? 'combined' : ':method :url :status :response-time ms', {
      skip: (req) => req.path === '/api/health',
    })
  );

  app.use('/api', apiRoutes);

  // 根路径给出指引，避免误以为服务未启动
  app.get('/', (req, res) => {
    res.json({
      code: 200,
      message: 'success',
      data: {
        name: 'English Learning Platform Backend',
        apiBase: '/api',
        health: '/api/health',
        docs: 'backend/docs/05-api-reference.md',
      },
    });
  });

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
