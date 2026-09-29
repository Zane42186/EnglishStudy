'use strict';

/**
 * MySQL JSON 列在 mysql2 下一般已自动解析为对象，这里做一次兜底，
 * 避免拿到字符串时上层各处重复 try/catch。
 */
function parseJsonColumn(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return value;
}

module.exports = { parseJsonColumn };
