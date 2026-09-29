'use strict';

const progressRepository = require('../repositories/progress.repository');
const lessonRepository = require('../repositories/lesson.repository');
const studyRecordRepository = require('../repositories/studyRecord.repository');
const { withTransaction } = require('../config/db');
const ApiError = require('../utils/ApiError');
const { todayAppTz } = require('../utils/datetime');

const LEVELS = ['Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5'];

/**
 * 级别 → 数字，便于比较与推导（用于返回「下一级别」等展示信息）。
 */
function levelToNumber(level) {
  const m = /Level\s*(\d+)/i.exec(level || '');
  return m ? Number.parseInt(m[1], 10) : null;
}

function levelIndex(level) {
  const i = LEVELS.indexOf(level);
  return i >= 0 ? i : 0;
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

module.exports = { getProgress, submitFeedback };

/**
 * POST /api/progress/feedback —— 难度反馈触发升降级。
 *
 * 规则（对齐 progress.md，教学策略类守门规则不在此实现）：
 *   too_easy  → easy_streak+1；达 2 且未被冻结 → 升 1 级并清零
 *   too_hard  → 降 1 级（下限 Level 1），upgrade_frozen_until = lessonNo + 3
 *   just_right→ easy_streak 清零，仅记录
 * 级别与连击必须原子，故在单事务 + progress 行锁内读写。
 */
async function submitFeedback(studentId, { lessonNo, feedback, note, nextRecommendation }) {
  const lesson = await lessonRepository.findByNo(studentId, lessonNo);
  const lessonDate = lesson && lesson.lesson_date ? lesson.lesson_date : null;

  return withTransaction(async (conn) => {
    const row = await progressRepository.lockByStudentId(conn, studentId);
    if (!row) {
      throw ApiError.notFound(
        'PROGRESS_NOT_FOUND',
        `学生 ${studentId} 的进度记录不存在，请先执行 npm run db:init`
      );
    }

    const levelBefore = row.current_level;
    let level = levelBefore;
    let easyStreak = row.easy_streak;
    let frozen = row.upgrade_frozen_until;
    let message;

    if (feedback === 'too_easy') {
      easyStreak = row.easy_streak + 1;
      if (easyStreak >= 2 && frozen < lessonNo) {
        const idx = levelIndex(levelBefore);
        level = LEVELS[Math.min(idx + 1, LEVELS.length - 1)];
        easyStreak = 0;
        message = level === levelBefore
          ? `已在最高级 ${level}，连击清零`
          : `升 1 级：${levelBefore} → ${level}`;
      } else if (easyStreak >= 2 && frozen >= lessonNo) {
        message = `太简单连击 ${easyStreak}，但升级冻结至第 ${frozen} 课，本课不升级`;
      } else {
        message = `维持 ${level}（太简单连击 ${easyStreak}/2）`;
      }
    } else if (feedback === 'too_hard') {
      const idx = levelIndex(levelBefore);
      level = LEVELS[Math.max(idx - 1, 0)];
      easyStreak = 0;
      frozen = lessonNo + 3;
      message = level === levelBefore
        ? `已在最低级 ${level}，升级冻结至第 ${frozen} 课`
        : `降 1 级：${levelBefore} → ${level}，升级冻结至第 ${frozen} 课`;
    } else {
      easyStreak = 0;
      message = `维持 ${level}（连击清零）`;
    }

    const currentLessonNo = Math.max(row.current_lesson_no, lessonNo);
    await progressRepository.update(conn, studentId, {
      currentLevel: level,
      currentLessonNo,
      lastFeedback: feedback,
      easyStreak,
      upgradeFrozenUntil: frozen,
      lastClassDate: lessonDate || todayAppTz(),
    });

    // 课不存在时影响 0 行，不影响反馈本身的生效
    if (lesson) {
      await lessonRepository.updateFeedback(studentId, lessonNo, feedback, conn);
    }

    const payload = {
      lessonNo,
      feedback,
      levelBefore,
      levelAfter: level,
      easyStreak,
      upgradeFrozenUntil: frozen,
    };
    if (note) payload.note = note;
    if (nextRecommendation) payload.nextRecommendation = nextRecommendation;

    await studyRecordRepository.insert(conn, {
      studentId,
      lessonId: lesson ? lesson.id : null,
      recordType: 'feedback',
      summary: `第 ${lessonNo} 课反馈：${feedback}`,
      payload,
    });

    return {
      levelBefore,
      levelAfter: level,
      easyStreak,
      upgradeFrozenUntil: frozen,
      message,
    };
  });
}
