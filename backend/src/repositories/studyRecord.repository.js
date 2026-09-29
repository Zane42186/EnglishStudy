'use strict';

const { query, queryOn, executeOn } = require('../config/db');

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

/** 新增一条学习记录；返回自增 id */
async function insert(exec, { studentId, lessonId, recordType, summary, payload }) {
  const result = await executeOn(exec,
    `INSERT INTO study_records (student_id, lesson_id, record_type, summary, payload)
     VALUES (?, ?, ?, ?, ?)`,
    [
      studentId,
      lessonId ?? null,
      recordType,
      summary ?? null,
      payload === undefined || payload === null ? null : JSON.stringify(payload),
    ]
  );
  return result.insertId;
}

/**
 * 幂等命中查询：某条 review 记录是否已带过同一 clientEventId。
 * 复习事件当前落在 study_records(record_type='review')，待 mistake_events 建表后改为读该表。
 */
async function findReviewByClientEventId(exec, studentId, clientEventId) {
  const rows = await queryOn(exec,
    `SELECT id, payload FROM study_records
     WHERE student_id = ? AND record_type = 'review'
       AND JSON_UNQUOTE(JSON_EXTRACT(payload, '$.clientEventId')) = ?
     ORDER BY id ASC LIMIT 1`,
    [studentId, clientEventId]
  );
  return rows[0] || null;
}

/** 某类型最近一条记录（快照 lastRecommendation 的数据来源） */
async function findLatestByType(studentId, recordType, exec = null) {
  const rows = await queryOn(exec,
    `SELECT id, record_type, summary, payload, lesson_id, created_at
     FROM study_records
     WHERE student_id = ? AND record_type = ?
     ORDER BY created_at DESC, id DESC LIMIT 1`,
    [studentId, recordType]
  );
  return rows[0] || null;
}

/** 全部 grade 记录（用于把 payload.byType 并入 errorTrend） */
async function listGrades(studentId) {
  return query(
    `SELECT id, lesson_id, payload, created_at FROM study_records
     WHERE student_id = ? AND record_type = 'grade'
     ORDER BY created_at DESC, id DESC`,
    [studentId]
  );
}

module.exports = { count, list, statsByType, insert, findReviewByClientEventId, findLatestByType, listGrades };
