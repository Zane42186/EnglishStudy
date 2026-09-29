'use strict';

/**
 * 统一业务错误。错误码与 HTTP 状态码分离：
 * - status：HTTP 状态码
 * - code：业务错误码（字符串），供前端 /Skill 分支判断
 */

class ApiError extends Error {
  constructor(code, status, message, details = null) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
    Error.captureStackTrace(this, ApiError);
  }

  static badRequest(message = '请求参数有误', details = null) {
    return new ApiError('VALIDATION_ERROR', 400, message, details);
  }

  static notFound(code = 'NOT_FOUND', message = '资源不存在') {
    return new ApiError(code, 404, message);
  }

  static conflict(message = '资源冲突') {
    return new ApiError('CONFLICT', 409, message);
  }

  static internal(message = '服务器内部错误') {
    return new ApiError('INTERNAL_ERROR', 500, message);
  }

  static db(message = '数据库错误') {
    return new ApiError('DB_ERROR', 500, message);
  }
}

module.exports = ApiError;
