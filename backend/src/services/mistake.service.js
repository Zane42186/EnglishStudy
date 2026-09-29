'use strict';

const mistakeRepository = require('../repositories/mistake.repository');
const lessonRepository = require('../repositories/lesson.repository');
const studyRecordRepository = require('../repositories/studyRecord.repository');
const { withTransaction } = require('../config/db');
const ApiError = require('../utils/ApiError');
const { parseJsonColumn } = require('../utils/json');
const { normalizeDateTime } = require('../utils/datetime');

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

/** 未过关错词按 error_type 分布（快照 pendingMistakeStats） */
async function getPendingByType(studentId) {
  const rows = await mistakeRepository.pendingByType(studentId);
  const byType = {};
  let total = 0;
  for (const row of rows) {
    byType[row.error_type] = row.cnt;
    total += row.cnt;
  }
  return { total, byType };
}

/**
 * POST /api/mistakes/:id/review —— 复习结果回写。
 *
 * 规则（只搬运 wrong-words.md，不重设计）：
 *   wrong   → wrong_count+1、streak=0、status='pending'
 *   correct → streak+1；streak>=2 → status='passed'
 * 两者都写 last_reviewed_at，并留一条复习流水。
 *
 * 幂等：clientEventId 命中已存在的 review 流水时直接返回首次结果，
 * 不重复累加（配合 mistakes 行锁，单错词维度的重复提交是串行的）。
 */
async function reviewMistake(studentId, mistakeId, { result, lessonNo, answeredAt, clientEventId }) {
  const reviewedAt = normalizeDateTime(answeredAt);

  let lessonId = null;
  if (Number.isInteger(lessonNo)) {
    const lesson = await lessonRepository.findByNo(studentId, lessonNo);
    lessonId = lesson ? lesson.id : null;
  }

  return withTransaction(async (conn) => {
    const lockedId = await mistakeRepository.lockRow(conn, mistakeId, studentId);
    if (!lockedId) {
      throw ApiError.notFound('MISTAKE_NOT_FOUND', `错词不存在：id=${mistakeId}`);
    }
    const row = await mistakeRepository.findByIdOn(conn, mistakeId, studentId);

    if (clientEventId) {
      const dup = await studyRecordRepository.findReviewByClientEventId(conn, studentId, clientEventId);
      if (dup) {
        const prev = parseJsonColumn(dup.payload) || {};
        const streak = Number.isInteger(prev.streak) ? prev.streak : row.streak;
        const wrongCount = Number.isInteger(prev.wrongCount) ? prev.wrongCount : row.wrong_count;
        const status = prev.status || row.status;
        return {
          id: row.id,
          streak,
          wrongCount,
          status,
          priority: derivePriority({ wrong_count: wrongCount, streak }),
          lastReviewedAt: row.last_reviewed_at,
        };
      }
    }

    let next;
    if (result === 'wrong') {
      next = { streak: 0, wrongCount: row.wrong_count + 1, status: 'pending' };
    } else {
      const streak = row.streak + 1;
      next = { streak, wrongCount: row.wrong_count, status: streak >= 2 ? 'passed' : 'pending' };
    }

    await mistakeRepository.updateReviewState(conn, mistakeId, { ...next, lastReviewedAt: reviewedAt });
    await studyRecordRepository.insert(conn, {
      studentId,
      lessonId,
      recordType: 'review',
      summary: `错词复习：${result === 'correct' ? '答对' : '答错'}（mistakeId=${mistakeId}）`,
      payload: {
        mistakeId,
        result,
        lessonNo: Number.isInteger(lessonNo) ? lessonNo : null,
        clientEventId: clientEventId || null,
        streak: next.streak,
        wrongCount: next.wrongCount,
        status: next.status,
      },
    });

    return {
      id: row.id,
      streak: next.streak,
      wrongCount: next.wrongCount,
      status: next.status,
      priority: derivePriority({ wrong_count: next.wrongCount, streak: next.streak }),
      lastReviewedAt: reviewedAt,
    };
  });
}

module.exports = {
  listMistakes, getMistake, getPendingMistakes, getStats, getPendingByType, reviewMistake, mapMistake,
};
