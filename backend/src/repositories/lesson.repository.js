'use strict';

const { query } = require('../config/db');

/** 组装 WHERE 条件（含参数） */
function buildWhere(studentId, filters = {}) {
  const where = ['l.student_id = ?'];
  const params = [studentId];

  if (filters.level) {
    where.push('l.level_code = ?');
    params.push(filters.level);
  }
  if (filters.q) {
    where.push('(l.summary LIKE ? OR l.grammar_point LIKE ?)');
    params.push(`%${filters.q}%`, `%${filters.q}%`);
  }
  if (filters.from) {
    where.push('l.lesson_date >= ?');
    params.push(filters.from);
  }
  if (filters.to) {
    where.push('l.lesson_date <= ?');
    params.push(filters.to);
  }
  return { clause: `WHERE ${where.join(' AND ')}`, params };
}

async function count(studentId, filters = {}) {
  const { clause, params } = buildWhere(studentId, filters);
  const rows = await query(`SELECT COUNT(*) AS total FROM lessons l ${clause}`, params);
  return rows[0].total;
}

async function list(studentId, filters = {}, paging = { offset: 0, size: 20 }) {
  const { clause, params } = buildWhere(studentId, filters);
  // LIMIT/OFFSET 已在 parsePaging 中校验为整数，直接内联（prepared 不支持 LIMIT 占位）
  const sql = `
    SELECT l.id, l.lesson_no, l.lesson_date, l.level_code, l.summary, l.grammar_point,
           l.vocab_count, l.exercise_count, l.error_count, l.feedback, l.source_file,
           l.status, l.created_at,
           (SELECT COUNT(*) FROM lesson_vocabulary lv WHERE lv.lesson_id = l.id) AS vocab_linked
    FROM lessons l
    ${clause}
    ORDER BY l.lesson_no DESC
    LIMIT ${paging.size} OFFSET ${paging.offset}`;
  return query(sql, params);
}

async function findById(id, studentId) {
  const rows = await query(
    `SELECT l.id, l.lesson_no, l.lesson_date, l.level_code, l.summary, l.grammar_point,
            l.vocab_count, l.exercise_count, l.error_count, l.feedback, l.source_file,
            l.status, l.created_at, l.updated_at
     FROM lessons l
     WHERE l.id = ? AND l.student_id = ?
     LIMIT 1`,
    [id, studentId]
  );
  return rows[0] || null;
}

async function findByNo(studentId, lessonNo) {
  const rows = await query(
    'SELECT id, lesson_no FROM lessons WHERE student_id = ? AND lesson_no = ? LIMIT 1',
    [studentId, lessonNo]
  );
  return rows[0] || null;
}

/** 最近一课（按课号最大） */
async function findLatest(studentId) {
  const rows = await query(
    `SELECT id, lesson_no, lesson_date, level_code, summary, grammar_point, feedback, error_count
     FROM lessons WHERE student_id = ? ORDER BY lesson_no DESC LIMIT 1`,
    [studentId]
  );
  return rows[0] || null;
}

/** 某一课的小节正文 */
async function findSections(lessonId) {
  return query(
    `SELECT section_type, content_md, order_index
     FROM lesson_sections WHERE lesson_id = ? ORDER BY order_index ASC`,
    [lessonId]
  );
}

/** 某一课的词汇（含本课例句） */
async function findVocabulary(lessonId) {
  return query(
    `SELECT v.id, v.word, v.phonetic, v.meaning, lv.example, lv.is_new, lv.order_index
     FROM lesson_vocabulary lv
     JOIN vocabulary v ON v.id = lv.vocabulary_id
     WHERE lv.lesson_id = ?
     ORDER BY lv.order_index ASC, v.id ASC`,
    [lessonId]
  );
}

/** 按课号聚合错误数（错误趋势） */
async function errorTrend(studentId, limit = 5) {
  return query(
    `SELECT lesson_no, error_count, lesson_date
     FROM lessons WHERE student_id = ?
     ORDER BY lesson_no DESC LIMIT ${Number(limit) || 5}`,
    [studentId]
  );
}

module.exports = {
  count, list, findById, findByNo, findLatest, findSections, findVocabulary, errorTrend,
};
