'use strict';

/**
 * 阅读业务层（R1 阅读统计 / R7 阅读接口）。
 * 数据源：`readings` / `reading_pieces` / `reading_questions` 三表，
 * 由 `db/migration/import_json.js` 从 `read/*.md` 回填，前端与 Amy 只读接口。
 */

const readingRepository = require('../repositories/reading.repository');
const ApiError = require('../utils/ApiError');
const { todayAppTz } = require('../utils/datetime');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** 把落库的 body_md（英文行 + `> 中文` 行，段间空行）还原成段落数组 */
function parseBodyMd(bodyMd) {
  return String(bodyMd || '')
    .split(/\n{2,}/)
    .map((block) => {
      const lines = block.split('\n');
      const zh = [];
      const en = [];
      for (const line of lines) {
        const m = /^>\s?(.*)$/.exec(line);
        if (m) zh.push(m[1]);
        else if (line.trim()) en.push(line.trim());
      }
      return {
        en: en.join(' ').trim(),
        zh: zh.join(' ').trim() || null,
      };
    })
    .filter((p) => p.en || p.zh);
}

/** 从倒序日期列表算「截至最近一次阅读的连续天数」 */
function streakFromDatesDesc(dates) {
  if (!dates.length) return 0;
  const dayMs = 24 * 60 * 60 * 1000;
  let streak = 1;
  for (let i = 1; i < dates.length; i += 1) {
    const prev = new Date(`${dates[i - 1]}T00:00:00Z`).getTime();
    const cur = new Date(`${dates[i]}T00:00:00Z`).getTime();
    if (prev - cur === dayMs) streak += 1;
    else if (prev - cur > dayMs) break;
  }
  return streak;
}

/**
 * 阅读统计（R1）。
 * `currentStreakDays` 是**截至最近阅读日**的连续天数，不要求最近阅读日就是今天——
 * 「今天有没有读」由前端比 `lastReadDate === 今天` 判断，接口不替它下结论。
 */
async function getStats(studentId) {
  const [base, dates] = await Promise.all([
    readingRepository.summary(studentId),
    readingRepository.listDatesDesc(studentId),
  ]);
  return {
    ...base,
    currentStreakDays: streakFromDatesDesc(dates),
    today: todayAppTz(),
  };
}

/** 阅读日清单（倒序，分页） */
async function listReadings(studentId, filters, paging) {
  const [list, total] = await Promise.all([
    readingRepository.listDays(studentId, filters, paging),
    readingRepository.countDays(studentId, filters),
  ]);
  return { list, total };
}

/** 某一天的阅读全文（篇 + 段落 + 理解题） */
async function getReadingByDate(studentId, date) {
  if (!DATE_RE.test(date)) {
    throw ApiError.badRequest('日期格式必须是 YYYY-MM-DD', [{ field: 'date', message: '格式非法' }]);
  }
  const day = await readingRepository.findDay(studentId, date);
  if (!day) {
    throw ApiError.notFound('READING_NOT_FOUND', `该日期没有阅读：${date}`);
  }
  const pieces = await readingRepository.findPieces(day.id);
  const questions = await readingRepository.findQuestions(pieces.map((p) => p.id));
  const byPiece = new Map();
  for (const q of questions) {
    if (!byPiece.has(q.piece_id)) byPiece.set(q.piece_id, []);
    byPiece.get(q.piece_id).push({
      questionNo: q.question_no,
      question: q.question,
      answer: q.answer,
    });
  }
  return {
    date: day.read_date,
    sourceFile: day.source_file,
    pieceCount: pieces.length,
    pieces: pieces.map((p) => ({
      pieceNo: p.piece_no,
      title: p.title,
      levelCode: p.level_code,
      source: p.source,
      wordCount: p.word_count,
      paragraphs: parseBodyMd(p.body_md),
      vocabularyNotes: p.vocabulary_notes,
      questions: byPiece.get(p.id) || [],
    })),
  };
}

/** 快照 readingCatalog：判断「当天是否已生成阅读」用 */
async function getCatalog(studentId, limit = 30) {
  return readingRepository.catalog(studentId, limit);
}

module.exports = {
  parseBodyMd,
  streakFromDatesDesc,
  getStats,
  listReadings,
  getReadingByDate,
  getCatalog,
};
