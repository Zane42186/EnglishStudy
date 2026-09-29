'use strict';

/**
 * 未匹配到任何路由 → 404。保持与其他响应同构。
 */
module.exports = function notFound(req, res) {
  res.status(404).json({
    code: 404,
    message: `接口不存在：${req.method} ${req.originalUrl}`,
    data: null,
  });
};
