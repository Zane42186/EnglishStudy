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

/**
 * 新增一条学习记录；返回自增 id。
 *
 * `dedupeKey`（可选，2026-10-01 起）对应 `uk_study_records_dedupe (student_id, dedupe_key)`：
 *   - **不传 → 写入 NULL → 行为与改动前完全一致**（唯一键不约束 NULL）；
 *   - 传入 → 该 (student_id, dedupeKey) 只能存在一行，重复插入会**抛 ER_DUP_ENTRY 而不是静默翻倍**。
 * 只有 `teach:sync` 这类「批量归档」写手会传它；API 路径暂不传（避免改变既有写入语义）。
 */
async function insert(exec, { studentId, lessonId, recordType, summary, payload, dedupeKey = null }) {
  const result = await executeOn(exec,
    `INSERT INTO study_records (student_id, lesson_id, record_type, dedupe_key, summary, payload)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      studentId,
      lessonId ?? null,
      recordType,
      dedupeKey,
      summary ?? null,
      payload === undefined || payload === null ? null : JSON.stringify(payload),
    ]
  );
  return result.insertId;
}

/** 按幂等键查已有行（teach:sync 的 SELECT-then-write 前置查询） */
async function findByDedupeKey(studentId, dedupeKey, exec = null) {
  const rows = await queryOn(exec,
    `SELECT id, record_type, summary, payload, lesson_id, created_at
     FROM study_records
     WHERE student_id = ? AND dedupe_key = ?
     LIMIT 1`,
    [studentId, dedupeKey]
  );
  return rows[0] || null;
}

/** 更新既有行的 payload/summary（幂等 upsert 的 UPDATE 分支） */
async function updateById(exec, id, { summary, payload }) {
  const result = await executeOn(exec,
    `UPDATE study_records SET summary = ?, payload = ? WHERE id = ?`,
    [
      summary ?? null,
      payload === undefined || payload === null ? null : JSON.stringify(payload),
      id,
    ]
  );
  return result.affectedRows;
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

module.exports = {
  count, list, statsByType, insert, findLatestByType, listGrades,
  findByDedupeKey, updateById,
};
