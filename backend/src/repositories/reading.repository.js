'use strict';

/**
 * 阅读数据访问（readings / reading_pieces / reading_questions 三表）。
 * 只写 SQL，不做业务判断；日期一律按 DATE 字符串比较，避免时区偏移。
 */

const { query, queryOn, executeOn } = require('../config/db');

/** 篇与篇之间的标题分隔符：用不可见字符，避免标题里本身含逗号把列表切错 */
const TITLE_SEP = '\u001f';

function buildDateWhere(studentId, filters = {}) {
  const where = ['r.student_id = ?'];
  const params = [studentId];
  if (filters.from) {
    where.push('r.read_date >= ?');
    params.push(filters.from);
  }
  if (filters.to) {
    where.push('r.read_date <= ?');
    params.push(filters.to);
  }
  return { clause: `WHERE ${where.join(' AND ')}`, params };
}

function splitTitles(raw) {
  if (!raw) return [];
  return String(raw)
    .split(TITLE_SEP)
    .map((t) => t.trim())
    .filter(Boolean);
}

/** 阅读日总数 / 篇数 / 词数 / 按月篇数 / 最近阅读日 */
async function summary(studentId) {
  const rows = await query(
    `SELECT
       (SELECT COUNT(*) FROM readings r WHERE r.student_id = ?)                  AS total_days,
       (SELECT COUNT(*) FROM reading_pieces p
          JOIN readings r ON r.id = p.reading_id WHERE r.student_id = ?)         AS piece_count,
       (SELECT COALESCE(SUM(p.word_count), 0) FROM reading_pieces p
          JOIN readings r ON r.id = p.reading_id WHERE r.student_id = ?)         AS word_total,
       (SELECT MAX(r.read_date) FROM readings r WHERE r.student_id = ?)          AS last_read_date`,
    [studentId, studentId, studentId, studentId]
  );
  const byMonth = await query(
    `SELECT DATE_FORMAT(r.read_date, '%Y-%m') AS ym, COUNT(p.id) AS piece_count
       FROM readings r
       LEFT JOIN reading_pieces p ON p.reading_id = r.id
      WHERE r.student_id = ?
      GROUP BY ym
      ORDER BY ym`,
    [studentId]
  );
  return {
    totalDays: Number(rows[0].total_days),
    pieceCount: Number(rows[0].piece_count),
    wordCountTotal: Number(rows[0].word_total),
    lastReadDate: rows[0].last_read_date || null,
    byMonth: byMonth.reduce((acc, r) => {
      acc[r.ym] = Number(r.piece_count);
      return acc;
    }, {}),
  };
}

/** 全部阅读日（倒序），用于算连续阅读天数 */
async function listDatesDesc(studentId, limit = 400) {
  const rows = await query(
    `SELECT r.read_date FROM readings r WHERE r.student_id = ?
      ORDER BY r.read_date DESC LIMIT ${Number(limit)}`,
    [studentId]
  );
  return rows.map((r) => r.read_date);
}

async function countDays(studentId, filters = {}) {
  const { clause, params } = buildDateWhere(studentId, filters);
  const rows = await query(`SELECT COUNT(*) AS total FROM readings r ${clause}`, params);
  return Number(rows[0].total);
}

/** 日清单（倒序）：{date, sourceFile, pieceCount, titles[]} */
async function listDays(studentId, filters = {}, paging = { offset: 0, size: 20 }) {
  const { clause, params } = buildDateWhere(studentId, filters);
  const sql = `
    SELECT r.id, r.read_date, r.source_file,
           COUNT(p.id) AS piece_count,
           GROUP_CONCAT(p.title ORDER BY p.piece_no SEPARATOR '${TITLE_SEP}') AS titles_raw
      FROM readings r
      LEFT JOIN reading_pieces p ON p.reading_id = r.id
      ${clause}
      GROUP BY r.id, r.read_date, r.source_file
      ORDER BY r.read_date DESC
      LIMIT ${Number(paging.size)} OFFSET ${Number(paging.offset)}`;
  const rows = await query(sql, params);
  return rows.map((r) => ({
    date: r.read_date,
    sourceFile: r.source_file,
    pieceCount: Number(r.piece_count),
    titles: splitTitles(r.titles_raw),
  }));
}

/** 某一天的阅读日行 */
async function findDay(studentId, date) {
  const rows = await query(
    'SELECT id, read_date, source_file FROM readings WHERE student_id = ? AND read_date = ? LIMIT 1',
    [studentId, date]
  );
  return rows[0] || null;
}

/** 某一天的阅读日行（走事务连接：判重与插入必须同一事务） */
async function findDayOn(conn, studentId, date) {
  const rows = await queryOn(
    conn,
    'SELECT id, read_date, source_file FROM readings WHERE student_id = ? AND read_date = ? LIMIT 1',
    [studentId, date]
  );
  return rows[0] || null;
}

/** 某阅读日下的所有篇 */
async function findPieces(readingId) {
  return query(
    `SELECT id, piece_no, level_code, source, source_url, title, body_md, vocabulary_notes, word_count
       FROM reading_pieces WHERE reading_id = ? ORDER BY piece_no ASC`,
    [readingId]
  );
}

/** 若干篇的理解题，按篇号 + 题号升序 */
async function findQuestions(pieceIds) {
  if (!pieceIds.length) return [];
  const placeholders = pieceIds.map(() => '?').join(',');
  return query(
    `SELECT piece_id, question_no, question, answer
       FROM reading_questions WHERE piece_id IN (${placeholders})
      ORDER BY piece_id ASC, question_no ASC`,
    pieceIds
  );
}

/** 快照 readingCatalog：只返回判断「当天是否已生成」所需的最小字段 */
async function catalog(studentId, limit = 30) {
  const rows = await query(
    `SELECT r.read_date, COUNT(p.id) AS piece_count,
            GROUP_CONCAT(p.title ORDER BY p.piece_no SEPARATOR '${TITLE_SEP}') AS titles_raw
       FROM readings r
       LEFT JOIN reading_pieces p ON p.reading_id = r.id
      WHERE r.student_id = ?
      GROUP BY r.id, r.read_date
      ORDER BY r.read_date DESC
      LIMIT ${Number(limit)}`,
    [studentId]
  );
  return rows.map((r) => ({
    date: r.read_date,
    pieceCount: Number(r.piece_count),
    titles: splitTitles(r.titles_raw),
  }));
}

/**
 * 复用同一连接、同一套语句的写路径。
 * 一律走 `*On(conn, ...)`：由 service 传入事务连接，保证「读旧值 → 判重 → 写入」在同一事务里，
 * 避免并发下两个请求都判定「日期不存在」而各写一天。
 */

async function insertReading(conn, studentId, date, sourceFile) {
  const result = await executeOn(
    conn,
    'INSERT INTO readings (student_id, read_date, source_file) VALUES (?, ?, ?)',
    [studentId, date, sourceFile ?? null]
  );
  return result.insertId;
}

async function insertPiece(conn, readingId, piece) {
  const result = await executeOn(
    conn,
    `INSERT INTO reading_pieces
       (reading_id, piece_no, level_code, source, source_url, title, body_md,
        vocabulary_notes, word_count, order_index)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [
      readingId,
      piece.pieceNo,
      piece.levelCode,
      piece.source,
      piece.sourceUrl,
      piece.title,
      piece.bodyMd,
      piece.vocabularyNotes,
      piece.wordCount,
      piece.orderIndex,
    ]
  );
  return result.insertId;
}

async function insertQuestion(conn, pieceId, question) {
  await executeOn(
    conn,
    `INSERT INTO reading_questions (piece_id, question_no, question, answer, order_index)
     VALUES (?,?,?,?,?)`,
    [pieceId, question.questionNo, question.question, question.answer, question.orderIndex]
  );
}

/** 清空某阅读日的子行（questions → pieces），供 force 重建使用；不动 readings 行本身 */
async function deleteChildren(conn, readingId) {
  await executeOn(
    conn,
    `DELETE q FROM reading_questions q
       JOIN reading_pieces p ON p.id = q.piece_id
      WHERE p.reading_id = ?`,
    [readingId]
  );
  await executeOn(conn, 'DELETE FROM reading_pieces WHERE reading_id = ?', [readingId]);
}

async function updateSourceFile(conn, readingId, sourceFile) {
  await executeOn(conn, 'UPDATE readings SET source_file = ? WHERE id = ?', [sourceFile ?? null, readingId]);
}

module.exports = {
  TITLE_SEP,
  summary,
  listDatesDesc,
  countDays,
  listDays,
  findDay,
  findDayOn,
  findPieces,
  findQuestions,
  catalog,
  insertReading,
  insertPiece,
  insertQuestion,
  deleteChildren,
  updateSourceFile,
};
