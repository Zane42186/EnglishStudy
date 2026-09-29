'use strict';

const mistakeRepository = require('../repositories/mistake.repository');
const ApiError = require('../utils/ApiError');

/**
 * 优先级判定（依据 docs/skills.md 4.2 缺口 G2 的口径）：
 *   wrongCount >= 2        → high
 *   streak === 1           → medium
 *   其余                    → low
 * 同一优先级内按 wrongCount 降序、updatedAt 升序（最久没复习的先考）。
 */
function derivePriority(row) {
  if (row.wrong_count >= 2) return 'high';
  if (row.streak === 1) return 'medium';
  return 'low';
}

function mapMistake(row) {
  return {
    id: row.id,
    wrongText: row.wrong_text,
    correctText: row.correct_text,
    errorType: row.error_type,
    errorReason: row.error_reason,
    streak: row.streak,
    wrongCount: row.wrong_count,
    status: row.status,
    priority: derivePriority(row),
    firstLessonNo: row.first_lesson_no ?? null,
    lastLessonNo: row.last_lesson_no ?? null,
    lastReviewedAt: row.last_reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function listMistakes(studentId, filters, paging) {
  const [total, rows] = await Promise.all([
    mistakeRepository.count(studentId, filters),
    mistakeRepository.list(studentId, filters, paging),
  ]);
  return { list: rows.map(mapMistake), total };
}

async function getMistake(studentId, id) {
  const row = await mistakeRepository.findById(id, studentId);
  if (!row) throw ApiError.notFound('MISTAKE_NOT_FOUND', `错词不存在：id=${id}`);
  return mapMistake(row);
}

/** 未过关错词（digest.md 待复习段的 API 形态），已按优先级排序 */
async function getPendingMistakes(studentId, limit) {
  const rows = await mistakeRepository.findPending(studentId, limit);
  return rows.map(mapMistake);
}

async function getStats(studentId) {
  return mistakeRepository.stats(studentId);
}

module.exports = { listMistakes, getMistake, getPendingMistakes, getStats, mapMistake };
