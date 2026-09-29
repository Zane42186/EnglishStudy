'use strict';

const ApiError = require('../utils/ApiError');

/**
 * 极简参数校验（第一阶段不引入外部依赖，保持依赖最小）。
 * 用法：validateQuery(req.query, { page: { type:'int', min:1 } })
 */

const RULES = {
  int: (v, rule) => {
    const n = Number.parseInt(v, 10);
    if (!Number.isFinite(n)) return '必须是整数';
    if (rule.min !== undefined && n < rule.min) return `不能小于 ${rule.min}`;
    if (rule.max !== undefined && n > rule.max) return `不能大于 ${rule.max}`;
    return null;
  },
  string: (v, rule) => {
    if (typeof v !== 'string') return '必须是字符串';
    if (rule.maxLength && v.length > rule.maxLength) return `长度不能超过 ${rule.maxLength}`;
    if (rule.enum && !rule.enum.includes(v)) return `取值必须是 ${rule.enum.join(' / ')} 之一`;
    return null;
  },
  object: (v, rule) => {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return '必须是对象';
    if (rule.requiredKeys) {
      const missing = rule.requiredKeys.filter((k) => v[k] === undefined);
      if (missing.length) return `缺少字段 ${missing.join(' / ')}`;
    }
    return null;
  },
};

/**
 * @param {object} source  req.query 或 req.params
 * @param {object} schema  { 字段名: { type, required, ... } }
 * @returns 规范化后的对象
 */
function validate(source, schema) {
  const errors = [];
  const out = {};

  for (const [field, rule] of Object.entries(schema)) {
    const raw = source[field];

    if (raw === undefined || raw === '') {
      if (rule.required) errors.push({ field, message: '必填' });
      continue;
    }

    const checker = RULES[rule.type];
    if (!checker) {
      errors.push({ field, message: `未知校验类型 ${rule.type}` });
      continue;
    }

    const msg = checker(raw, rule);
    if (msg) {
      errors.push({ field, message: msg });
      continue;
    }

    out[field] = rule.type === 'int' ? Number.parseInt(raw, 10) : raw;
  }

  if (errors.length) {
    throw ApiError.badRequest('参数校验失败', errors);
  }
  return out;
}

module.exports = { validate };
