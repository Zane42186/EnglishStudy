'use strict';

const progressService = require('./progress.service');
const lessonService = require('./lesson.service');
const mistakeService = require('./mistake.service');
const studyRecordService = require('./studyRecord.service');
const readingService = require('./reading.service');
const lessonRepository = require('../repositories/lesson.repository');

/**
 * GET /api/agent/snapshot —— 九个 Skill 的统一输入。
 *
 * 目标：把「9 次请求」降为 1 次。两条硬约束：
 *   1) pendingMistakes / errorTrend 必须复用既有 service，避免两套排序漂移；
 *   2) 缺数据的字段一律降级（null / [] / 省略键）+ degradation，**绝不 500**。
 */
async function getSnapshot(studentId, { recent = 3 } = {}) {
  const [
    progress,
    recentPage,
    pendingMistakes,
    pendingStats,
    errorTrend,
    lastRecommendation,
    catalogRows,
    readingCatalog,
  ] = await Promise.all([
    progressService.getProgress(studentId),
    lessonService.listLessons(studentId, {}, { offset: 0, size: recent }),
    mistakeService.getPendingMistakes(studentId, 200),
    mistakeService.getPendingByType(studentId),
    lessonService.getErrorTrend(studentId, 6),
    studyRecordService.getLastRecommendation(studentId),
    lessonRepository.listAll(studentId, {}),
    // 阅读日清单（2026-09-30 起有真实数据源：readings 三表）
    readingService.getCatalog(studentId, 30),
  ]);

  const courseCatalog = catalogRows.map((row) => ({
    lessonNo: row.lesson_no,
    lessonDate: row.lesson_date,
    levelCode: row.level_code,
    summary: row.summary,
  }));

  const recentLessons = await Promise.all(
    recentPage.list.map(async (lesson) => {
      const [vocabulary, mistakeCount] = await Promise.all([
        lessonRepository.findVocabulary(lesson.id),
        lessonRepository.countMistakesByLesson(studentId, lesson.id),
      ]);
      return {
        lessonNo: lesson.lessonNo,
        lessonDate: lesson.lessonDate,
        levelCode: lesson.level,
        summary: lesson.summary,
        grammarPoint: lesson.grammarPoint,
        vocabulary: vocabulary.map((v) => v.word),
        feedback: lesson.feedback,
        mistakeCount,
        errorCount: lesson.errorCount,
      };
    })
  );

  const pending = pendingMistakes.map((m) => {
    const item = { ...m, firstCourseNo: m.firstLessonNo, lastCourseNo: m.lastLessonNo };
    // courseNo 契约要求 minimum 1，无来源课号（DQ4 脏值）时省略该键而不是塞 null
    if (m.firstLessonNo == null) delete item.firstCourseNo;
    if (m.lastLessonNo == null) delete item.lastCourseNo;
    return item;
  });

  const affected = [];
  const hasByType = errorTrend.byLesson.some((item) => item.byType);
  if (!hasByType) affected.push('errorTrend.byType');
  // readingCatalog 自 2026-09-30 起有真实数据源（readings 三表），空数组代表「确实没阅读」，
  // 因此不再计入 degradation；只有 backlog 仍缺数据源。
  affected.push('backlog');
  if (!lastRecommendation) affected.push('lastRecommendation', 'lastIncomplete');

  const snapshot = {
    deploymentMode: 'backend',
    progress: {
      currentLevel: progress.currentLevel,
      currentCourseNo: progress.currentLessonNo,
      currentLessonNo: progress.currentLessonNo,
      nextLessonNo: progress.nextLessonNo,
      lastFeedback: progress.lastFeedback,
      easyStreak: progress.easyStreak,
      upgradeFrozenUntil: progress.upgradeFrozenUntil,
      lastClassDate: progress.lastClassDate,
    },
    courseCatalog,
    recentLessons,
    pendingMistakes: pending,
    pendingMistakeStats: pendingStats,
    errorTrend,
    readingCatalog,
    backlog: null,
    lastIncomplete: lastRecommendation
      ? { lessonNo: lastRecommendation.lessonNo, nextRecommendation: lastRecommendation.text }
      : null,
    lastRecommendation,
    degradation: affected.length
      ? {
          degraded: true,
          reason: `以下字段暂无数据来源，已降级返回（${affected.join(' / ')}）：待 knowledge_points 建表与教学侧写入 nextRecommendation 后自动补齐`,
          affected,
        }
      : { degraded: false, affected: [] },
  };

  return snapshot;
}

module.exports = { getSnapshot };
