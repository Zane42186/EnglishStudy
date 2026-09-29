'use strict';

const { query } = require('../config/db');

function buildWhere(studentId, filters = {}) {
  const where = ['m.student_id = ?'];
  const params = [studentId];

  if (filters.status) {
    where.push('m.status = ?');
    params.push(filters.status);
  }
  if (filters.errorType) {
    where.push('m.error_type = ?');
    params.push(filters.errorType);
  }
  if (filters.q) {
    where.push('(m.wrong_text LIKE ? OR m.correct_text LIKE ? OR m.error_reason LIKE ?)');
    params.push(`%${filters.q}%`, `%${filters.q}%`, `%${filters.q}%`);
  }
  return { clause: `WHERE ${where.join(' AND ')}`, params };
}

const BASE_SELECT = `
  SELECT m.id, m.wrong_text, m.correct_text, m.error_type, m.error_reason,
         m.streak, m.wrong_count, m.status, m.last_reviewed_at, m.created_at, m.updated_at,
         (SELECT l.lesson_no FROM lessons l WHERE l.id = m.first_lesson_id) AS first_lesson_no,
         (SELECT l.lesson_no FROM lessons l WHERE l.id = m.last_lesson_id)  AS last_lesson_no
  FROM mistakes m`;

async function count(studentId, filters = {}) {
  const { clause, params } = buildWhere(studentId, filters);
  const rows = await query(`SELECT COUNT(*) AS total FROM mistakes m ${clause}`, params);
  return rows[0].total;
}

/** 默认排序：待复习优先 → 累计犯错多 → 最久没复习 */
async function list(studentId, filters = {}, paging = { offset: 0, size: 20 }) {
  const { clause, params } = buildWhere(studentId, filters);
  const sql = `
    ${BASE_SELECT}
    ${clause}
    ORDER BY (m.status = 'passed') ASC, m.wrong_count DESC, m.updated_at ASC
    LIMIT ${paging.size} OFFSET ${paging.offset}`;
  return query(sql, params);
}

async function findById(id, studentId) {
  const rows = await query(`${BASE_SELECT} WHERE m.id = ? AND m.student_id = ? LIMIT 1`, [id, studentId]);
  return rows[0] || null;
}

/** 未过关错词（等价 digest.md「待复习」段） */
async function findPending(studentId, limit = 50) {
  return query(
    `${BASE_SELECT} WHERE m.student_id = ? AND m.status = 'pending'
     ORDER BY m.wrong_count DESC, m.updated_at ASC
     LIMIT ${Number(limit) || 50}`,
    [studentId]
  );
}

async function stats(studentId) {
  const byStatus = await query(
    `SELECT status, COUNT(*) AS cnt FROM mistakes WHERE student_id = ? GROUP BY status`,
    [studentId]
  );
  const byType = await query(
    `SELECT error_type, COUNT(*) AS cnt FROM mistakes WHERE student_id = ? GROUP BY error_type ORDER BY cnt DESC`,
    [studentId]
  );
  const statusMap = { pending: 0, passed: 0 };
  for (const row of byStatus) statusMap[row.status] = row.cnt;
  return {
    total: statusMap.pending + statusMap.passed,
    pending: statusMap.pending,
    passed: statusMap.passed,
    byType: byType.map((r) => ({ errorType: r.error_type, count: r.cnt })),
  };
}

module.exports = { count, list, findById, findPending, stats };
