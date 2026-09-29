'use strict';

const ApiError = require('./ApiError');

/**
 * 时间归一化。库内 DATETIME 按应用时区（+08:00）存储，前端可能传
 * 纯日期时间（`2026-09-30 10:20:00`）或带偏移的 ISO（`...T10:20:00+08:00`）。
 * 两种都要落成 `YYYY-MM-DD HH:MM:SS`。
 */

const APP_TZ_OFFSET_MINUTES = 8 * 60;

/** 把 Date 按应用时区格式化为 MySQL DATETIME 字符串 */
function formatAppTz(date) {
  const shifted = new Date(date.getTime() + APP_TZ_OFFSET_MINUTES * 60 * 1000);
  return shifted.toISOString().slice(0, 19).replace('T', ' ');
}

/** 当前时刻（应用时区） */
function nowAppTz() {
  return formatAppTz(new Date());
}

/** 当前日期（应用时区，YYYY-MM-DD） */
function todayAppTz() {
  return formatAppTz(new Date()).slice(0, 10);
}

/**
 * 归一化业务传入时间。
 * - 空值 → 当前时刻
 * - `YYYY-MM-DD[ T]HH:MM[:SS]` → 原样补秒（不改时区，视为应用时区墙钟）
 * - 其他可被 Date 解析的（含 ISO 偏移）→ 转应用时区
 * 非法值抛 400。
 */
function normalizeDateTime(input) {
  if (input === undefined || input === null || input === '') return nowAppTz();
  if (typeof input !== 'string') throw ApiError.badRequest('时间必须是字符串');
  const trimmed = input.trim();
  const wall = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)$/.exec(trimmed);
  if (wall) {
    const time = wall[2].length === 5 ? `${wall[2]}:00` : wall[2];
    return `${wall[1]} ${time}`;
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw ApiError.badRequest(`时间格式非法：${input}（示例：2026-09-30T10:20:00+08:00）`);
  }
  return formatAppTz(parsed);
}

module.exports = { formatAppTz, nowAppTz, todayAppTz, normalizeDateTime };
