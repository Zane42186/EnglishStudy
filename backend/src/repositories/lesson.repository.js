'use strict';

const { query, queryOn, executeOn } = require('../config/db');

const LIST_COLUMNS = `
  l.id, l.lesson_no, l.lesson_date, l.level_code, l.summary, l.grammar_point,
  l.vocab_count, l.exercise_count, l.error_count, l.feedback, l.source_file,
  l.status, l.created_at`;

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
    SELECT ${LIST_COLUMNS},
           (SELECT COUNT(*) FROM lesson_vocabulary lv WHERE lv.lesson_id = l.id) AS vocab_linked
    FROM lessons l
    ${clause}
    ORDER BY l.lesson_no DESC
    LIMIT ${paging.size} OFFSET ${paging.offset}`;
  return query(sql, params);
}

/**
 * 全量课程列表（不分页）。字段与 list 完全一致（含 grammarPoint），
 * 供前端 /api/lessons/all 替代会被静默截断的 ?size=100。
 */
async function listAll(studentId, filters = {}) {
  const { clause, params } = buildWhere(studentId, filters);
  const sql = `
    SELECT ${LIST_COLUMNS},
           (SELECT COUNT(*) FROM lesson_vocabulary lv WHERE lv.lesson_id = l.id) AS vocab_linked
    FROM lessons l
    ${clause}
    ORDER BY l.lesson_no DESC`;
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

async function findByNo(studentId, lessonNo, exec = null) {
  const rows = await queryOn(exec,
    'SELECT id, lesson_no, lesson_date FROM lessons WHERE student_id = ? AND lesson_no = ? LIMIT 1',
    [studentId, lessonNo]
  );
  return rows[0] || null;
}

/** 写回某课的难度反馈（课不存在时影响 0 行，由调用方决定是否容忍） */
async function updateFeedback(studentId, lessonNo, feedback, exec = null) {
  const result = await executeOn(exec,
    'UPDATE lessons SET feedback = ? WHERE student_id = ? AND lesson_no = ?',
    [feedback, studentId, lessonNo]
  );
  return result.affectedRows;
}

/** 某课首次犯错引入的错词条数（快照 recentLessons[].mistakeCount） */
async function countMistakesByLesson(studentId, lessonId) {
  const rows = await query(
    'SELECT COUNT(*) AS total FROM mistakes WHERE student_id = ? AND first_lesson_id = ?',
    [studentId, lessonId]
  );
  return rows[0].total;
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
    `SELECT id, lesson_no, error_count, lesson_date
     FROM lessons WHERE student_id = ?
     ORDER BY lesson_no DESC LIMIT ${Number(limit) || 5}`,
    [studentId]
  );
}

module.exports = {
  count, list, listAll, findById, findByNo, findLatest, findSections, findVocabulary,
  errorTrend, updateFeedback, countMistakesByLesson,
};
