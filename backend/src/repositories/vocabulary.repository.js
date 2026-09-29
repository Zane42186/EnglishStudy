'use strict';

const { query } = require('../config/db');

function buildWhere(studentId, filters = {}) {
  const where = ['v.student_id = ?'];
  const params = [studentId];

  if (filters.letter) {
    // 首字母分组：A–Z 用前缀匹配；# 表示非字母开头
    if (filters.letter === '#') {
      where.push('v.word NOT REGEXP ?');
      params.push('^[A-Za-z]');
    } else {
      where.push('v.word LIKE ?');
      params.push(`${filters.letter}%`);
    }
  }
  if (filters.q) {
    where.push('(v.word LIKE ? OR v.meaning LIKE ?)');
    params.push(`%${filters.q}%`, `%${filters.q}%`);
  }
  if (filters.lessonId) {
    where.push('EXISTS (SELECT 1 FROM lesson_vocabulary lv WHERE lv.vocabulary_id = v.id AND lv.lesson_id = ?)');
    params.push(filters.lessonId);
  }
  return { clause: `WHERE ${where.join(' AND ')}`, params };
}

async function count(studentId, filters = {}) {
  const { clause, params } = buildWhere(studentId, filters);
  const rows = await query(`SELECT COUNT(*) AS total FROM vocabulary v ${clause}`, params);
  return rows[0].total;
}

async function list(studentId, filters = {}, paging = { offset: 0, size: 20 }) {
  const { clause, params } = buildWhere(studentId, filters);
  const sql = `
    SELECT v.id, v.word, v.phonetic, v.meaning, v.example, v.first_lesson_id, v.created_at,
           (SELECT l.lesson_no FROM lessons l WHERE l.id = v.first_lesson_id) AS first_lesson_no
    FROM vocabulary v
    ${clause}
    ORDER BY v.word ASC
    LIMIT ${paging.size} OFFSET ${paging.offset}`;
  return query(sql, params);
}

async function findById(id, studentId) {
  const rows = await query(
    `SELECT v.id, v.word, v.phonetic, v.meaning, v.example, v.first_lesson_id, v.created_at
     FROM vocabulary v WHERE v.id = ? AND v.student_id = ? LIMIT 1`,
    [id, studentId]
  );
  return rows[0] || null;
}

/** 词汇统计：总数 + 首字母分布 */
async function stats(studentId) {
  const rows = await query(
    `SELECT UPPER(LEFT(v.word, 1)) AS letter, COUNT(*) AS cnt
     FROM vocabulary v WHERE v.student_id = ?
     GROUP BY letter ORDER BY letter ASC`,
    [studentId]
  );
  const byLetter = {};
  let total = 0;
  for (const row of rows) {
    const key = /[A-Z]/.test(row.letter) ? row.letter : '#';
    byLetter[key] = (byLetter[key] || 0) + row.cnt;
    total += row.cnt;
  }
  return { total, byLetter };
}

module.exports = { count, list, findById, stats };
