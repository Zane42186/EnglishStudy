'use strict';

const lessonRepository = require('../repositories/lesson.repository');
const ApiError = require('../utils/ApiError');

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

/** 错误趋势：最近 N 课的错误处数，用于是否加速教学的判断 */
async function getErrorTrend(studentId, limit = 5) {
  const rows = await lessonRepository.errorTrend(studentId, limit);
  const byLesson = rows
    .map((r) => ({ lessonNo: r.lesson_no, lessonDate: r.lesson_date, errorCount: r.error_count }))
    .sort((a, b) => a.lessonNo - b.lessonNo);
  return { windowSize: byLesson.length, byLesson };
}

module.exports = { listLessons, getLessonDetail, getLatestLesson, getErrorTrend, mapLesson };
