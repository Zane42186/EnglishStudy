'use strict';

const { query } = require('../config/db');

/** 按显示名查学生 */
async function findByName(name) {
  const rows = await query(
    'SELECT id, name, nickname, email, target, status, created_at, updated_at FROM students WHERE name = ? LIMIT 1',
    [name]
  );
  return rows[0] || null;
}

/** 按 id 查学生 */
async function findById(id) {
  const rows = await query(
    'SELECT id, name, nickname, email, target, status, created_at, updated_at FROM students WHERE id = ? LIMIT 1',
    [id]
  );
  return rows[0] || null;
}

/** 学生总数（用于健康检查/统计） */
async function count() {
  const rows = await query('SELECT COUNT(*) AS total FROM students');
  return rows[0].total;
}

module.exports = { findByName, findById, count };
