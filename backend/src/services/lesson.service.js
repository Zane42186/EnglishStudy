'use strict';

const lessonRepository = require('../repositories/lesson.repository');
const studyRecordRepository = require('../repositories/studyRecord.repository');
const ApiError = require('../utils/ApiError');
const { parseJsonColumn } = require('../utils/json');

function mapLesson(row) {
  return {
    id: row.id,
    lessonNo: row.lesson_no,
    lessonDate: row.lesson_date,
    level: row.level_code,
    summary: row.summary,
    grammarPoint: row.grammar_point,
    vocabCount: row.vocab_count,
    exerciseCount: row.exercise_count,
    errorCount: row.error_count,
    feedback: row.feedback,
    sourceFile: row.source_file,
    status: row.status,
    createdAt: row.created_at,
  };
}

function mapSection(row) {
  return {
    sectionType: row.section_type,
    content: row.content_md,
    orderIndex: row.order_index,
  };
}

function mapVocab(row) {
  return {
    id: row.id,
    word: row.word,
    phonetic: row.phonetic,
    meaning: row.meaning,
    example: row.example,
    isNew: row.is_new === 1,
    orderIndex: row.order_index,
  };
}

/** 课程列表（分页 + 过滤） */
async function listLessons(studentId, filters, paging) {
  const [total, rows] = await Promise.all([
    lessonRepository.count(studentId, filters),
    lessonRepository.list(studentId, filters, paging),
  ]);
  return { list: rows.map(mapLesson), total };
}

/**
 * 全量课程列表（不分页）。字段与 /api/lessons 列表完全一致（含 grammarPoint），
 * 供前端替换会被静默截断的 ?size=100。
 */
async function listAllLessons(studentId, filters) {
  const rows = await lessonRepository.listAll(studentId, filters);
  return { list: rows.map(mapLesson), total: rows.length };
}

/** 课程详情：主表 + 小节正文 + 本课词汇 */
async function getLessonDetail(studentId, lessonId) {
  const row = await lessonRepository.findById(lessonId, studentId);
  if (!row) {
    throw ApiError.notFound('LESSON_NOT_FOUND', `课程不存在：id=${lessonId}`);
  }
  const [sections, vocab] = await Promise.all([
    lessonRepository.findSections(lessonId),
    lessonRepository.findVocabulary(lessonId),
  ]);
  return {
    ...mapLesson(row),
    sections: sections.map(mapSection),
    vocabulary: vocab.map(mapVocab),
  };
}

/**
 * 最近一课。用于回答「上次学到哪了」：
 * 同时给出下一课号（= 最大课号 + 1，断更不断号）。
 */
async function getLatestLesson(studentId) {
  const row = await lessonRepository.findLatest(studentId);
  if (!row) {
    return { latest: null, nextLessonNo: 1, message: '还没有课程记录' };
  }
  return {
    latest: mapLesson(row),
    nextLessonNo: row.lesson_no + 1,
  };
}

/**
 * 错误趋势：最近 N 课的错误处数，用于是否加速教学的判断。
 * 若对应课的 grade 记录 payload 带 byType（写入路径 P-1），一并返回；
 * 无该数据的课省略 byType 键（不编造）。
 */
async function getErrorTrend(studentId, limit = 5) {
  const [rows, grades] = await Promise.all([
    lessonRepository.errorTrend(studentId, limit),
    studyRecordRepository.listGrades(studentId),
  ]);

  const idToLessonNo = new Map(rows.map((r) => [r.id, r.lesson_no]));
  const byTypeByLessonNo = {};
  for (const grade of grades) {
    const payload = parseJsonColumn(grade.payload) || {};
    const byType = payload.byType || payload.by_type;
    if (!byType || typeof byType !== 'object' || Array.isArray(byType)) continue;
    // 优先用 payload.lessonNo；课尚未归档（lesson_id 为空）时也不丢数据
    const lessonNo = Number.isInteger(payload.lessonNo)
      ? payload.lessonNo
      : idToLessonNo.get(grade.lesson_id);
    // grades 已按时间倒序，首次出现即该课最新一条
    if (Number.isInteger(lessonNo) && !byTypeByLessonNo[lessonNo]) {
      byTypeByLessonNo[lessonNo] = byType;
    }
  }

  const byLesson = rows
    .map((r) => {
      const item = { lessonNo: r.lesson_no, lessonDate: r.lesson_date, errorCount: r.error_count };
      if (byTypeByLessonNo[r.lesson_no]) item.byType = byTypeByLessonNo[r.lesson_no];
      return item;
    })
    .sort((a, b) => a.lessonNo - b.lessonNo);
  return { windowSize: byLesson.length, byLesson };
}

/**
 * 某一课的练习与批改结论（N4）。
 * summary.byType 只统计已批改且答错的题，与错词本的 errorType 同源。
 */
async function getLessonExercises(studentId, lessonId) {
  const lesson = await lessonRepository.findById(lessonId, studentId);
  if (!lesson) {
    throw ApiError.notFound('LESSON_NOT_FOUND', `课程不存在：id=${lessonId}`);
  }
  const rows = await lessonRepository.findExercises(lessonId);
  const byType = {};
  let correctCount = 0;

  const list = rows.map((r) => {
    if (r.is_correct === 1) correctCount += 1;
    if (r.is_correct === 0 && r.error_type) {
      byType[r.error_type] = (byType[r.error_type] || 0) + 1;
    }
    return {
      exerciseNo: r.exercise_no,
      exerciseType: r.exercise_type,
      prompt: r.prompt,
      referenceAnswer: r.reference_answer,
      targetPoint: r.target_point,
      userAnswer: r.user_answer,
      isCorrect: r.is_correct === null ? null : r.is_correct === 1,
      errorType: r.error_type,
      errorNote: r.error_note,
      revisedAnswer: r.revised_answer,
    };
  });

  return {
    list,
    summary: { exerciseCount: list.length, correctCount, byType },
  };
}

module.exports = {
  listLessons, listAllLessons, getLessonDetail, getLessonExercises, getLatestLesson, getErrorTrend, mapLesson,
};
