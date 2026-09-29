'use strict';

const ApiError = require('../utils/ApiError');
const { env } = require('../config/env');

/** MySQL 驱动错误码 → 业务错误 的映射 */
const DB_ERROR_MAP = {
  ER_DUP_ENTRY: () => ApiError.conflict('唯一键冲突：记录已存在'),
  ER_NO_REFERENCED_ROW_2: () => ApiError.badRequest('引用了不存在的关联对象'),
  ER_ROW_IS_REFERENCED_2: () => ApiError.conflict('该记录被其他数据引用，不能删除'),
  ER_DATA_TOO_LONG: () => ApiError.badRequest('字段长度超出限制'),
  ER_BAD_NULL_ERROR: () => ApiError.badRequest('必填字段不能为空'),
};

/**
 * 统一错误出口。对外只返回 {code, message, data}，
 * 不泄露堆栈、SQL 语句与表结构细节。
 */
// eslint-disable-next-line no-unused-vars
module.exports = function errorHandler(err, req, res, next) {
  let apiError;

  if (err instanceof ApiError) {
    apiError = err;
  } else if (err && DB_ERROR_MAP[err.code]) {
    apiError = DB_ERROR_MAP[err.code]();
  } else if (err && (err.code === 'ECONNREFUSED' || err.code === 'PROTOCOL_CONNECTION_LOST')) {
    apiError = new ApiError('DB_UNAVAILABLE', 503, '数据库连接不可用，请检查 MySQL 是否启动');
  } else if (err && err.type === 'entity.parse.failed') {
    apiError = ApiError.badRequest('请求体不是合法 JSON');
  } else {
    apiError = ApiError.internal();
  }

  // 服务端日志：保留完整信息，便于排错
  const logLine = `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} → ${apiError.status} ${apiError.code} ${apiError.message}`;
  if (apiError.status >= 500) {
    console.error(logLine);
    if (env.nodeEnv !== 'production' && err && err.stack) {
      console.error(err.stack);
    }
  } else {
    console.warn(logLine);
  }

  if (res.headersSent) return next(err);

  return res.status(apiError.status).json({
    code: apiError.status,
    message: apiError.message,
    data: apiError.details,
  });
};
