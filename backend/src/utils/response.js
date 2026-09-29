'use strict';

/**
 * 统一响应包络（用户指定格式）：
 *   成功：{ code: 200, message: 'success', data: ... }
 *   失败：{ code: <状态码>, message: '<说明>', data: null }
 *
 * `code` 直接取 HTTP 状态码，便于前端/脚本一把判断。
 */

function ok(res, data = null, message = 'success') {
  return res.status(200).json({ code: 200, message, data });
}

/**
 * 分页列表：data 统一为 { list, total, page, size }
 */
function okList(res, list, total, page, size) {
  return res.status(200).json({
    code: 200,
    message: 'success',
    data: { list, total, page, size },
  });
}

function created(res, data = null, message = 'created') {
  return res.status(201).json({ code: 201, message, data });
}

function fail(res, status, message, data = null) {
  return res.status(status).json({ code: status, message, data });
}

/** 解析分页参数，带边界保护 */
function parsePaging(query, { defaultSize = 20, maxSize = 500 } = {}) {
  let page = Number.parseInt(query.page, 10);
  let size = Number.parseInt(query.size, 10);
  if (!Number.isFinite(page) || page < 1) page = 1;
  if (!Number.isFinite(size) || size < 1) size = defaultSize;
  if (size > maxSize) size = maxSize;
  return { page, size, offset: (page - 1) * size };
}

module.exports = { ok, okList, created, fail, parsePaging };
