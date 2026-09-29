'use strict';

const vocabularyRepository = require('../repositories/vocabulary.repository');
const ApiError = require('../utils/ApiError');

function mapVocabulary(row) {
  return {
    id: row.id,
    word: row.word,
    phonetic: row.phonetic,
    meaning: row.meaning,
    example: row.example,
    firstLessonId: row.first_lesson_id,
    firstLessonNo: row.first_lesson_no ?? null,
    createdAt: row.created_at,
  };
}

async function listVocabulary(studentId, filters, paging) {
  const [total, rows] = await Promise.all([
    vocabularyRepository.count(studentId, filters),
    vocabularyRepository.list(studentId, filters, paging),
  ]);
  return { list: rows.map(mapVocabulary), total };
}

async function getVocabulary(studentId, id) {
  const row = await vocabularyRepository.findById(id, studentId);
  if (!row) throw ApiError.notFound('VOCABULARY_NOT_FOUND', `词汇不存在：id=${id}`);
  return mapVocabulary(row);
}

/** 词汇统计：总数 + 首字母分布（词汇卡页分组索引用） */
async function getStats(studentId) {
  return vocabularyRepository.stats(studentId);
}

module.exports = { listVocabulary, getVocabulary, getStats, mapVocabulary };
