'use strict';

const { randomUUID } = require('crypto');

/**
 * 为每个请求生成 requestId 并记录开始时间，便于日志串联与排错。
 * 响应头 X-Request-Id 便于前端/测试定位同一次请求。
 */
module.exports = function requestContext(req, res, next) {
  req.id = req.get('X-Request-Id') || randomUUID();
  req.startAt = Date.now();
  res.setHeader('X-Request-Id', req.id);
  next();
};
