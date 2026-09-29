'use strict';

const progressRepository = require('../repositories/progress.repository');
const lessonRepository = require('../repositories/lesson.repository');
const ApiError = require('../utils/ApiError');

/**
 * 级别 → 数字，便于比较与推导（用于返回「下一级别」等展示信息）。
 */
function levelToNumber(level) {
  const m = /Level\s*(\d+)/i.exec(level || '');
  return m ? Number.parseInt(m[1], 10) : null;
}

async function getProgress(studentId) {
  const row = await progressRepository.findByStudentId(studentId);
  if (!row) {
    throw ApiError.notFound(
      'PROGRESS_NOT_FOUND',
      `学生 ${studentId} 的进度记录不存在，请先执行 npm run db:init`
    );
  }

  const latest = await lessonRepository.findLatest(studentId);
  const maxLessonNo = latest ? latest.lesson_no : 0;

  // 课号以实际课程记录为准（断更不断号），与 progress 表不一致时以课程为准
  const currentLessonNo = Math.max(row.current_lesson_no, maxLessonNo);
  const lessonNoAligned = currentLessonNo === row.current_lesson_no;

  return {
    studentId: row.student_id,
    currentLevel: row.current_level,
    currentLevelNumber: levelToNumber(row.current_level),
    currentLessonNo,
    nextLessonNo: currentLessonNo + 1,
    lastFeedback: row.last_feedback,
    easyStreak: row.easy_streak,
    upgradeFrozenUntil: row.upgrade_frozen_until,
    upgradeFrozen: row.upgrade_frozen_until >= currentLessonNo + 1 && row.upgrade_frozen_until > 0,
    lastClassDate: row.last_class_date,
    note: row.note,
    updatedAt: row.updated_at,
    lessonNoAligned,
  };
}

module.exports = { getProgress };
