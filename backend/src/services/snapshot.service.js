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
  // 因此不再计入 degradation；backlog 是当前唯一「表都还没建」的缺口。
  affected.push('backlog');
  if (!lastRecommendation) affected.push('lastRecommendation', 'lastIncomplete');

  // 降级说明按「实际 affected 字段」逐项生成，**不写死全局结论** ——
  // 旧实现把「待知识库建表」与「待教学侧写 nextRecommendation」写死在同一句里，
  // 2026-10-01 teach:sync 回填 lastRecommendation 后该句即失真（A12 根因）。
  const DEGRADE_HINT = {
    backlog: '待 knowledge_points 建表',
    'errorTrend.byType': '待对应课的 grade 记录带 byType',
    lastRecommendation: '待教学侧写入 feedback 记录',
    lastIncomplete: '待教学侧写入 feedback 记录',
  };

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
    // lastIncomplete 与 lastRecommendation **同源但不同形状/语义**：
    //   lastIncomplete  —— 给 Skill 断更接续用，含「未完成的教学动作」incompleteStep（有才带）
    //   lastRecommendation —— 「当时的建议」原样，严格 {lessonNo, text}（契约 agent-snapshot §lastRecommendation）
    // 二者仅在「库内无 feedback 记录」时才降级为 null。2026-10-01 `teach:sync` 回填后已有值
    // （实测 = {lessonNo:7, nextRecommendation:'第 8 课：…'}）→ **G4 已关闭**，不再是常态降级项。
    lastIncomplete: lastRecommendation
      ? {
          lessonNo: lastRecommendation.lessonNo,
          nextRecommendation: lastRecommendation.text,
          ...(lastRecommendation.incompleteStep
            ? { incompleteStep: lastRecommendation.incompleteStep }
            : {}),
        }
      : null,
    lastRecommendation: lastRecommendation
      ? { lessonNo: lastRecommendation.lessonNo, text: lastRecommendation.text }
      : null,
    degradation: affected.length
      ? {
          degraded: true,
          reason: `以下字段暂无数据来源，已降级返回：${affected
            .map((f) => `${f}（${DEGRADE_HINT[f] || '待补齐'}）`)
            .join('、')}`,
          affected,
        }
      : { degraded: false, affected: [] },
  };

  return snapshot;
}

module.exports = { getSnapshot };
