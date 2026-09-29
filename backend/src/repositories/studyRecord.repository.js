'use strict';

const { query } = require('../config/db');

function buildWhere(studentId, filters = {}) {
  const where = ['r.student_id = ?'];
  const params = [studentId];

  if (filters.type) {
    where.push('r.record_type = ?');
    params.push(filters.type);
  }
  if (filters.lessonId) {
    where.push('r.lesson_id = ?');
    params.push(filters.lessonId);
  }
  if (filters.from) {
    where.push('r.created_at >= ?');
    params.push(`${filters.from} 00:00:00`);
  }
  if (filters.to) {
    where.push('r.created_at <= ?');
    params.push(`${filters.to} 23:59:59`);
  }
  return { clause: `WHERE ${where.join(' AND ')}`, params };
}

async function count(studentId, filters = {}) {
  const { clause, params } = buildWhere(studentId, filters);
  const rows = await query(`SELECT COUNT(*) AS total FROM study_records r ${clause}`, params);
  return rows[0].total;
}

async function list(studentId, filters = {}, paging = { offset: 0, size: 20 }) {
  const { clause, params } = buildWhere(studentId, filters);
  const sql = `
    SELECT r.id, r.record_type, r.summary, r.payload, r.lesson_id, r.created_at,
           l.lesson_no, l.lesson_date
    FROM study_records r
    LEFT JOIN lessons l ON l.id = r.lesson_id
    ${clause}
    ORDER BY r.created_at DESC, r.id DESC
    LIMIT ${paging.size} OFFSET ${paging.offset}`;
  return query(sql, params);
}

/** 按类型聚合（给 Amy / 学情分析用） */
async function statsByType(studentId) {
  return query(
    `SELECT record_type, COUNT(*) AS cnt FROM study_records WHERE student_id = ?
     GROUP BY record_type ORDER BY cnt DESC`,
    [studentId]
  );
}

module.exports = { count, list, statsByType };
