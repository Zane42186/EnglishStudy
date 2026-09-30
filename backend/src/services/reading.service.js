'use strict';

/**
 * 阅读业务层（R1 阅读统计 / R7 阅读接口）。
 * 数据源：`readings` / `reading_pieces` / `reading_questions` 三表，
 * 由 `db/migration/import_json.js` 从 `read/*.md` 回填，前端与 Amy 只读接口。
 */

const readingRepository = require('../repositories/reading.repository');
const db = require('../config/db');
const ApiError = require('../utils/ApiError');
const { todayAppTz } = require('../utils/datetime');
const { LEVEL_CODE, READING_PIECE_MAX, READING_QUESTION_COUNT } = require('../constants');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SOURCE_FILE_RE = /^\d{4}-\d{2}-\d{2}-read\.md$/;

/**
 * 把段落数组渲染成落库用的 body_md（英文行 + `> 中文` 行，段间空行）。
 * **与 `parseBodyMd()` 严格互逆**，且与 `db/migration/import_json.js` 共用同一实现，
 * 避免「md 回填」与「接口写入」两条路径产出不同的正文格式。
 */
function renderBodyMd(paragraphs) {
  return (paragraphs || [])
    .map((p) => {
      const en = String(p.en || '').trim();
      const zh = String((p.zh ?? '') || '').trim();
      return zh ? `${en}\n> ${zh}` : en;
    })
    .filter(Boolean)
    .join('\n\n');
}

/** 英文词数：与导出器同一算法（只数英文词，不含中文） */
function countWords(paragraphs) {
  const text = (paragraphs || []).map((p) => p.en || '').join(' ');
  const words = text.match(/[A-Za-z][A-Za-z'’-]*/g);
  return words ? words.length : 0;
}

/** 真日历校验：挡掉 2026-02-31 这类「格式对但不存在」的日期 */
function isRealDate(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function bad(field, message) {
  return { field, message };
}

/**
 * 校验 `ReadingSet`（docs/schemas/reading-set.schema.json）。
 * 规则与该 schema 保持一致：pieces 1—3 篇、每篇 questions 恰好 2 道、en/source/title 非空。
 * 只做「schema 已声明」的约束，不额外发明规则。
 */
function validateReadingSet(body) {
  const errors = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw ApiError.badRequest('请求体必须是 ReadingSet 对象', [bad('body', '必须是对象')]);
  }

  if (!isRealDate(body.date)) errors.push(bad('date', '必填，且必须是真实存在的 YYYY-MM-DD 日期'));
  if (!LEVEL_CODE.includes(body.levelCode)) {
    errors.push(bad('levelCode', `必填，取值必须是 ${LEVEL_CODE.join(' / ')} 之一`));
  }
  if (body.sourceFile != null && !SOURCE_FILE_RE.test(String(body.sourceFile))) {
    errors.push(bad('sourceFile', '若提供，必须形如 2026-09-30-read.md'));
  }

  const pieces = body.pieces;
  if (!Array.isArray(pieces) || pieces.length < 1) {
    errors.push(bad('pieces', '必填，至少 1 篇'));
  } else if (pieces.length > READING_PIECE_MAX) {
    errors.push(bad('pieces', `不能超过 ${READING_PIECE_MAX} 篇`));
  } else {
    const seenPieceNo = new Set();
    pieces.forEach((p, i) => {
      const at = `pieces[${i}]`;
      if (!p || typeof p !== 'object' || Array.isArray(p)) {
        errors.push(bad(at, '必须是对象'));
        return;
      }
      if (!Number.isInteger(p.pieceNo) || p.pieceNo < 1 || p.pieceNo > READING_PIECE_MAX) {
        errors.push(bad(`${at}.pieceNo`, `必填，且必须是 1—${READING_PIECE_MAX} 的整数`));
      } else if (seenPieceNo.has(p.pieceNo)) {
        errors.push(bad(`${at}.pieceNo`, `篇号重复：${p.pieceNo}`));
      } else {
        seenPieceNo.add(p.pieceNo);
      }
      if (typeof p.source !== 'string' || !p.source.trim()) {
        errors.push(bad(`${at}.source`, '必填非空（自编时写「自编」）'));
      }
      if (p.sourceUrl != null && typeof p.sourceUrl !== 'string') {
        errors.push(bad(`${at}.sourceUrl`, '必须是字符串或 null'));
      }
      if (typeof p.title !== 'string' || !p.title.trim()) {
        errors.push(bad(`${at}.title`, '必填非空'));
      }
      if (p.levelCode != null && !LEVEL_CODE.includes(p.levelCode)) {
        errors.push(bad(`${at}.levelCode`, `必须是 ${LEVEL_CODE.join(' / ')} 之一`));
      }
      if (p.wordCount != null && (!Number.isInteger(p.wordCount) || p.wordCount < 1)) {
        errors.push(bad(`${at}.wordCount`, '若提供，必须是 ≥1 的整数'));
      }

      if (!Array.isArray(p.paragraphs) || p.paragraphs.length < 1) {
        errors.push(bad(`${at}.paragraphs`, '必填，至少 1 段'));
      } else {
        p.paragraphs.forEach((para, j) => {
          if (!para || typeof para !== 'object' || Array.isArray(para)) {
            errors.push(bad(`${at}.paragraphs[${j}]`, '必须是对象'));
            return;
          }
          if (typeof para.en !== 'string' || !para.en.trim()) {
            errors.push(bad(`${at}.paragraphs[${j}].en`, '必填非空'));
          }
          if (para.zh != null && typeof para.zh !== 'string') {
            errors.push(bad(`${at}.paragraphs[${j}].zh`, '必须是字符串或 null'));
          }
        });
      }

      if (!Array.isArray(p.questions) || p.questions.length !== READING_QUESTION_COUNT) {
        errors.push(bad(`${at}.questions`, `必填，且必须恰好 ${READING_QUESTION_COUNT} 道理解题`));
      } else {
        const seenQNo = new Set();
        p.questions.forEach((q, j) => {
          if (!q || typeof q !== 'object' || Array.isArray(q)) {
            errors.push(bad(`${at}.questions[${j}]`, '必须是对象'));
            return;
          }
          if (!Number.isInteger(q.questionNo) || q.questionNo < 1) {
            errors.push(bad(`${at}.questions[${j}].questionNo`, '必填，且必须是 ≥1 的整数'));
          } else if (seenQNo.has(q.questionNo)) {
            errors.push(bad(`${at}.questions[${j}].questionNo`, `题号重复：${q.questionNo}`));
          } else {
            seenQNo.add(q.questionNo);
          }
          if (typeof q.question !== 'string' || !q.question.trim()) {
            errors.push(bad(`${at}.questions[${j}].question`, '必填非空'));
          }
          if (typeof q.answer !== 'string' || !q.answer.trim()) {
            errors.push(bad(`${at}.questions[${j}].answer`, '必填非空（理解题不允许无答案）'));
          }
        });
      }
    });
  }

  if (errors.length) throw ApiError.badRequest('ReadingSet 校验失败', errors);
}

/** 把已校验的 ReadingSet 规范化为落库行 */
function normalize(body) {
  return {
    date: body.date,
    sourceFile: body.sourceFile ?? null,
    pieces: body.pieces
      .slice()
      .sort((a, b) => a.pieceNo - b.pieceNo)
      .map((p, index) => ({
        pieceNo: p.pieceNo,
        levelCode: p.levelCode ?? body.levelCode,
        source: p.source.trim(),
        sourceUrl: p.sourceUrl ? String(p.sourceUrl).trim() : null,
        title: p.title.trim(),
        bodyMd: renderBodyMd(p.paragraphs),
        vocabularyNotes: p.vocabularyNotes ? String(p.vocabularyNotes).trim() : null,
        // 与导入器一致：未提供就按正文算，避免同一批数据两条路径算出不同词数
        wordCount: p.wordCount ?? countWords(p.paragraphs),
        orderIndex: index,
        questions: p.questions
          .slice()
          .sort((a, b) => a.questionNo - b.questionNo)
          .map((q, qi) => ({
            questionNo: q.questionNo,
            question: q.question.trim(),
            answer: q.answer.trim(),
            orderIndex: qi,
          })),
      })),
  };
}

/**
 * 写入当天阅读（R7）。
 *
 * 「当天不覆盖」是硬规则：同一 `read_date` 已存在即 **409**，不静默覆盖。
 * 唯一例外是学生明确要求重出（`reading-set.schema.json` 写明的例外）——此时需显式传
 * `force=true`，在同一事务里删掉该日的篇/题后重建（`readings` 行本身复用，id 不变）。
 *
 * 全程单事务：读旧值 → 判重 → 插入三表同属一个事务，避免并发写入产生半份数据。
 */
async function createReading(studentId, body, { force = false } = {}) {
  validateReadingSet(body);
  const normalized = normalize(body);

  return db.withTransaction(async (conn) => {
    const existing = await readingRepository.findDayOn(conn, studentId, normalized.date);
    if (existing && !force) {
      throw ApiError.conflict(`该日期已有阅读：${normalized.date} —— 「当天不覆盖」；确需重出请显式传 force=true`);
    }

    let readingId;
    let replaced = false;
    if (existing) {
      readingId = existing.id;
      await readingRepository.deleteChildren(conn, readingId);
      await readingRepository.updateSourceFile(conn, readingId, normalized.sourceFile);
      replaced = true;
    } else {
      readingId = await readingRepository.insertReading(conn, studentId, normalized.date, normalized.sourceFile);
    }

    for (const piece of normalized.pieces) {
      const pieceId = await readingRepository.insertPiece(conn, readingId, piece);
      for (const q of piece.questions) {
        await readingRepository.insertQuestion(conn, pieceId, q);
      }
    }

    return {
      id: readingId,
      date: normalized.date,
      pieceCount: normalized.pieces.length,
      levelCode: body.levelCode,
      replaced,
    };
  });
}

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
      sourceUrl: p.source_url,
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
  renderBodyMd,
  countWords,
  streakFromDatesDesc,
  validateReadingSet,
  getStats,
  listReadings,
  getReadingByDate,
  getCatalog,
  createReading,
};
