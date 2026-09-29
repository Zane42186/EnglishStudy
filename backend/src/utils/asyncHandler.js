'use strict';

/**
 * 包裹 async 路由处理器，自动把 reject 交给错误中间件。
 * 避免每个 controller 都写 try/catch。
 */
module.exports = function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
