'use strict';

const lessonRepository = require('../repositories/lesson.repository');
const studyRecordRepository = require('../repositories/studyRecord.repository');
const db = require('../config/db');
const ApiError = require('../utils/ApiError');
const { parseJsonColumn } = require('../utils/json');
const {
  LEVEL_CODE, SECTION_TYPE, EXERCISE_TYPE, EXERCISE_BLOCK_KIND, LESSON_STATUS, FEEDBACK,
} = require('../constants');

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
      blockKind: r.block_kind,
      blockNo: r.block_no,
      exerciseNo: r.exercise_no,
      exerciseType: r.exercise_type,
      prompt: r.prompt,
      selfCheck: r.self_check,
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

// ===========================================================================
// 写路径：LessonRecord → 课程归档（POST /api/lessons、PUT /api/lessons/:id）
//
// 契约 = `docs/schemas/lesson-record.schema.json`（**本接口按契约实现，不改契约**）。
// 产出者 = Skill 侧 `daily-lesson` 归档步（`docs/skills.md` §3.1 第 8 步）。
// ===========================================================================

/**
 * 写路径切换点（2026-10-01 负责人拍板）：
 * **第 8 课起由本接口归档**，`db:export`/`db:import` 退化为「历史回填 + 只读校验」，
 * 故 `db:import` 会跳过 `lesson_no >= 8`。
 *
 * 同一个阈值也决定「三项计数能否按子表派生」：
 * 第 1—6 课是 Amy 手工口径（第 1 课 `exercise_count=7` 而子表仅 4 行），
 * 拍板前一个数字都不动 —— 因此本接口**只对 ≥8 的课回写计数**。
 */
const WRITE_API_FROM_LESSON_NO = 8;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SOURCE_FILE_RE = /^day-\d{2}-\d{2}\.md$/;

function bad(field, message) {
  return { field, message };
}

/**
 * 校验 `LessonRecord`。
 *
 * - `partial=true`（PUT）：所有字段可选，但**凡出现的字段一律按同一套规则校验**，
 *   这样「回填批改」可以只提交 `{ exercises: [...] }`。
 * - 只做 schema 已声明的约束，不额外发明规则。
 * - 契约里**没有落库点**的字段（`studyMinutes` / `knowledgePoints` / `skillRunIds`）
 *   不报错，而是收进 `ignored` 由调用方以 `warnings` 告知 —— 契约演进要求
 *   「加字段不升版本、忽略未知字段」，静默丢弃与硬报错都不合适。
 */
function validateLessonRecord(body, { partial = false } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw ApiError.badRequest('请求体必须是 LessonRecord 对象', [bad('body', '必须是对象')]);
  }
  const errors = [];
  const ignored = [];

  // ---------- 契约 required：lessonNo / levelCode / summary / sections ----------
  if (!partial || body.lessonNo !== undefined) {
    if (!Number.isInteger(body.lessonNo) || body.lessonNo < 1) {
      errors.push(bad('lessonNo', '必填，且必须是 ≥1 的整数'));
    }
  }
  if (!partial || body.levelCode !== undefined) {
    if (!LEVEL_CODE.includes(body.levelCode)) {
      errors.push(bad('levelCode', `必填，取值必须是 ${LEVEL_CODE.join(' / ')} 之一`));
    }
  }
  if (!partial || body.summary !== undefined) {
    if (typeof body.summary !== 'string' || !body.summary.trim()) {
      errors.push(bad('summary', '必填非空'));
    } else if (body.summary.length > 255) {
      errors.push(bad('summary', '长度不能超过 255'));
    }
  }
  if (!partial || body.sections !== undefined) {
    if (!Array.isArray(body.sections) || body.sections.length < 1) {
      errors.push(bad('sections', '必填，至少 1 个小节'));
    }
  }

  // ---------- 其他标量字段 ----------
  if (body.lessonDate != null && !DATE_RE.test(String(body.lessonDate))) {
    errors.push(bad('lessonDate', '若提供，必须形如 2026-10-01'));
  }
  if (body.status != null && !LESSON_STATUS.includes(body.status)) {
    errors.push(bad('status', `若提供，取值必须是 ${LESSON_STATUS.join(' / ')} 之一`));
  }
  if (body.sourceFile != null && !SOURCE_FILE_RE.test(String(body.sourceFile))) {
    errors.push(bad('sourceFile', '若提供，必须形如 day-08-14.md'));
  }
  // ⚠️ grammarPoint 是**契约之外的新增请求**（LessonRecord 未定义该字段），
  //    但 lessons.grammar_point 是前端课程列表的可见列。此处按「加字段不升版本」
  //    作可选扩展接收；契约侧是否补写由 Skill 设计师定（已登记为待确认项）。
  if (body.grammarPoint != null) {
    if (typeof body.grammarPoint !== 'string') errors.push(bad('grammarPoint', '必须是字符串'));
    else if (body.grammarPoint.length > 128) errors.push(bad('grammarPoint', '长度不能超过 128'));
  }
  if (body.studyMinutes != null) {
    ignored.push(bad('studyMinutes', 'lessons 无 study_minutes 列（G5 维持降级）：已接收但不写库'));
  }

  // ---------- sections ----------
  if (Array.isArray(body.sections)) {
    const seenType = new Set();
    body.sections.forEach((s, i) => {
      const at = `sections[${i}]`;
      if (!s || typeof s !== 'object' || Array.isArray(s)) {
        errors.push(bad(at, '必须是对象'));
        return;
      }
      if (!SECTION_TYPE.includes(s.sectionType)) {
        errors.push(bad(`${at}.sectionType`, `必填，取值必须是 ${SECTION_TYPE.join(' / ')} 之一`));
      } else if (seenType.has(s.sectionType)) {
        errors.push(bad(`${at}.sectionType`, `本课同类型只能一条（唯一键 lesson_id + section_type）：重复 ${s.sectionType}`));
      } else {
        seenType.add(s.sectionType);
      }
      if (typeof s.contentMd !== 'string' || !s.contentMd.trim()) {
        errors.push(bad(`${at}.contentMd`, '必填非空'));
      }
      if (s.orderIndex !== undefined && (!Number.isInteger(s.orderIndex) || s.orderIndex < 0)) {
        errors.push(bad(`${at}.orderIndex`, '若提供，必须是 ≥0 的整数'));
      }
    });
  }

  // ---------- exercises ----------
  if (body.exercises !== undefined) {
    if (!Array.isArray(body.exercises)) {
      errors.push(bad('exercises', '必须是数组'));
    } else {
      const seenKey = new Set();
      body.exercises.forEach((e, i) => {
        const at = `exercises[${i}]`;
        if (!e || typeof e !== 'object' || Array.isArray(e)) {
          errors.push(bad(at, '必须是对象'));
          return;
        }
        const blockKind = e.blockKind === undefined || e.blockKind === null ? 'homework' : e.blockKind;
        const blockKindOk = EXERCISE_BLOCK_KIND.includes(blockKind);
        if (!blockKindOk) {
          errors.push(bad(`${at}.blockKind`, `取值必须是 ${EXERCISE_BLOCK_KIND.join(' / ')} 之一（省略视为 homework）`));
        }
        let blockNo = 0;
        if (blockKind === 'backfill') {
          if (!Number.isInteger(e.blockNo) || e.blockNo < 1) {
            errors.push(bad(`${at}.blockNo`, 'blockKind=backfill 时必填，且必须是 ≥1 的整数'));
          } else {
            blockNo = e.blockNo;
          }
        } else if (e.blockNo !== undefined && e.blockNo !== null && e.blockNo !== 0) {
          errors.push(bad(`${at}.blockNo`, 'homework 题的 blockNo 必须为 0 或省略'));
        }
        if (!Number.isInteger(e.exerciseNo) || e.exerciseNo < 1) {
          errors.push(bad(`${at}.exerciseNo`, '必填，且必须是 ≥1 的整数'));
        }
        if (!EXERCISE_TYPE.includes(e.exerciseType)) {
          errors.push(bad(`${at}.exerciseType`, `必填，取值必须是 ${EXERCISE_TYPE.join(' / ')} 之一`));
        }
        if (typeof e.prompt !== 'string' || !e.prompt.trim()) {
          errors.push(bad(`${at}.prompt`, '必填非空'));
        }
        if (e.selfCheck != null && (typeof e.selfCheck !== 'string' || e.selfCheck.length > 128)) {
          errors.push(bad(`${at}.selfCheck`, '若提供，必须是长度 ≤128 的字符串'));
        }
        if (e.isCorrect != null && typeof e.isCorrect !== 'boolean') {
          errors.push(bad(`${at}.isCorrect`, '若提供，必须是布尔或 null（null = 未批改）'));
        }
        // 唯一键 uk_exercise 的前置校验：同课同题块内题号不得重复
        if (blockKindOk && Number.isInteger(e.exerciseNo)) {
          const key = `${blockKind}#${blockNo}#${e.exerciseNo}`;
          if (seenKey.has(key)) {
            errors.push(bad(at, `同题块内题号重复（唯一键 lesson_id + block_kind + block_no + exercise_no）：${key}`));
          } else {
            seenKey.add(key);
          }
        }
      });
    }
  }

  // ---------- vocabulary ----------
  if (body.vocabulary !== undefined) {
    if (!Array.isArray(body.vocabulary)) {
      errors.push(bad('vocabulary', '必须是数组'));
    } else {
      body.vocabulary.forEach((v, i) => {
        const at = `vocabulary[${i}]`;
        if (!v || typeof v !== 'object' || Array.isArray(v)) {
          errors.push(bad(at, '必须是对象'));
          return;
        }
        if (typeof v.word !== 'string' || !v.word.trim()) errors.push(bad(`${at}.word`, '必填非空'));
        else if (v.word.trim().length > 64) errors.push(bad(`${at}.word`, '长度不能超过 64'));
        if (typeof v.isNew !== 'boolean') errors.push(bad(`${at}.isNew`, '必填，必须是布尔（本课是否首次出现）'));
      });
    }
  }

  // ---------- gradeSummary / feedback ----------
  if (body.gradeSummary !== undefined) {
    const gs = body.gradeSummary;
    if (!gs || typeof gs !== 'object' || Array.isArray(gs)) {
      errors.push(bad('gradeSummary', '必须是对象'));
    } else {
      if (!Number.isInteger(gs.exerciseCount) || gs.exerciseCount < 0) {
        errors.push(bad('gradeSummary.exerciseCount', '必填，且必须是 ≥0 的整数'));
      }
      if (!Number.isInteger(gs.errorCount) || gs.errorCount < 0) {
        errors.push(bad('gradeSummary.errorCount', '必填，且必须是 ≥0 的整数（作业错误处数，不折算百分制）'));
      }
    }
  }
  if (body.feedback !== undefined) {
    const fb = body.feedback;
    if (!fb || typeof fb !== 'object' || Array.isArray(fb)) {
      errors.push(bad('feedback', '必须是对象'));
    } else {
      if (!FEEDBACK.includes(fb.feedback)) {
        errors.push(bad('feedback.feedback', `必填，取值必须是 ${FEEDBACK.join(' / ')} 之一`));
      }
      if (!LEVEL_CODE.includes(fb.levelBefore)) errors.push(bad('feedback.levelBefore', '必填，必须是合法 LevelCode'));
      if (!LEVEL_CODE.includes(fb.levelAfter)) errors.push(bad('feedback.levelAfter', '必填，必须是合法 LevelCode'));
    }
  }

  // ---------- 契约内、但当前无落库点的字段 ----------
  if (body.knowledgePoints !== undefined) {
    ignored.push(bad('knowledgePoints', 'knowledge_points / lesson_knowledge_points 尚未建表（P1）：已接收但不写库'));
  }
  if (body.skillRunIds !== undefined) {
    ignored.push(bad('skillRunIds', 'skill_runs 尚未建表（P2）：已接收但不写库'));
  }

  if (errors.length) throw ApiError.badRequest('LessonRecord 校验失败', errors);
  return { ignored };
}

/** 写小节 / 练习 / 词汇三组子行（POST 与 PUT 共用） */
async function writeLessonChildren(conn, studentId, lessonId, body) {
  const sections = body.sections || [];
  for (let i = 0; i < sections.length; i += 1) {
    const s = sections[i];
    await lessonRepository.upsertSection(
      conn, lessonId, s.sectionType, s.contentMd.trim(),
      Number.isInteger(s.orderIndex) ? s.orderIndex : i
    );
  }

  const exercises = body.exercises || [];
  for (let i = 0; i < exercises.length; i += 1) {
    const e = exercises[i];
    const blockKind = e.blockKind === undefined || e.blockKind === null ? 'homework' : e.blockKind;
    await lessonRepository.upsertExercise(conn, lessonId, {
      blockKind,
      blockNo: blockKind === 'homework' ? 0 : e.blockNo,
      exerciseNo: e.exerciseNo,
      exerciseType: e.exerciseType,
      prompt: e.prompt,
      selfCheck: e.selfCheck,
      referenceAnswer: e.referenceAnswer,
      targetPoint: e.targetPoint,
      userAnswer: e.userAnswer,
      isCorrect: e.isCorrect === undefined ? null : e.isCorrect,
      errorNote: e.errorNote,
      revisedAnswer: e.revisedAnswer,
    }, i);
  }

  let vocabularyCount = 0;
  const vocabulary = body.vocabulary || [];
  for (let i = 0; i < vocabulary.length; i += 1) {
    const v = vocabulary[i];
    const id = await lessonRepository.upsertVocabularyEntry(
      conn, studentId, lessonId, v, Number.isInteger(v.orderIndex) ? v.orderIndex : i
    );
    if (id) vocabularyCount += 1;
  }

  return { sectionCount: sections.length, vocabularyCount, exerciseCount: exercises.length };
}

/**
 * 回写 `lessons` 三项计数（派生口径）。
 *
 * - 只对 `lessonNo >= WRITE_API_FROM_LESSON_NO` 生效（见常量处说明）；
 *   历史课返回 `null` 并给出 `countsSkipped` 告警，**绝不覆盖 Amy 的手工口径**。
 * - `error_count` 优先取 `gradeSummary.errorCount`（作业口径、不含补漏块），
 *   缺失时回落为「作业块判错题数」——与 `import_json.syncLessonCounts` 同一口径。
 */
async function refreshLessonCounts(conn, lessonId, lessonNo, body) {
  if (!(lessonNo >= WRITE_API_FROM_LESSON_NO)) {
    return { vocabCount: null, exerciseCount: null, errorCount: null, countsSkipped: true };
  }
  const { vocabCount, exerciseCount } = await lessonRepository.countChildren(conn, lessonId);
  const gs = body.gradeSummary;
  const errorCount = gs && Number.isInteger(gs.errorCount)
    ? gs.errorCount
    : await lessonRepository.countHomeworkErrors(conn, lessonId);
  await lessonRepository.updateLessonFields(conn, lessonId, {
    vocab_count: vocabCount, exercise_count: exerciseCount, error_count: errorCount,
  });
  return { vocabCount, exerciseCount, errorCount, countsSkipped: false };
}

/** 把 `ignored` 与计数跳过合成对外的 `warnings`（不静默丢弃任何「收到了但没写」的东西） */
function buildWarnings(ignored, countsSkipped) {
  const warnings = ignored.map((w) => `${w.field}：${w.message}`);
  if (countsSkipped) {
    warnings.push(`三项计数未回写：第 <${WRITE_API_FROM_LESSON_NO} 课沿用 Amy 手工口径（切换点=${WRITE_API_FROM_LESSON_NO}）`);
  }
  return warnings;
}

/**
 * 新建课程归档（`POST /api/lessons`）。
 * 课号已存在 → **409**，不静默覆盖：POST 只负责新建，「回填批改与反馈」走 PUT。
 */
async function createLesson(studentId, body) {
  const { ignored } = validateLessonRecord(body, { partial: false });

  return db.withTransaction(async (conn) => {
    const existing = await lessonRepository.findByNo(studentId, body.lessonNo, conn);
    if (existing) {
      throw ApiError.conflict(
        `第 ${body.lessonNo} 课已存在（id=${existing.id}）—— POST 只新建；回填批改与反馈请用 PUT /api/lessons/${existing.id}`
      );
    }

    const lessonId = await lessonRepository.insertLesson(conn, studentId, {
      lessonNo: body.lessonNo,
      lessonDate: body.lessonDate ?? null,
      levelCode: body.levelCode,
      summary: body.summary.trim(),
      grammarPoint: body.grammarPoint ?? null,
      feedback: body.feedback ? body.feedback.feedback : null,
      sourceFile: body.sourceFile ?? null,
      status: body.status ?? 'taught',
    });

    const written = await writeLessonChildren(conn, studentId, lessonId, body);
    const counts = await refreshLessonCounts(conn, lessonId, body.lessonNo, body);

    return {
      id: lessonId,
      lessonNo: body.lessonNo,
      levelCode: body.levelCode,
      status: body.status ?? 'taught',
      sectionCount: written.sectionCount,
      vocabCount: counts.vocabCount,
      exerciseCount: counts.exerciseCount,
      errorCount: counts.errorCount,
      warnings: buildWarnings(ignored, counts.countsSkipped),
    };
  });
}

/**
 * 回填批改与反馈（`PUT /api/lessons/:id`）。
 *
 * ⚠️ `:id` 是 `lessons.id` **主键**、不是课号（第 7 课 id=47）。
 * **部分更新**：只写请求里出现的字段；小节 / 练习 / 词汇按各自唯一键 upsert
 * （请求里没出现的子行**不删除**，与 `db:import` 同为「只增改、不删」）。
 */
async function updateLesson(studentId, lessonId, body) {
  const { ignored } = validateLessonRecord(body, { partial: true });

  return db.withTransaction(async (conn) => {
    const lesson = await lessonRepository.findById(lessonId, studentId, conn);
    if (!lesson) {
      throw ApiError.notFound('LESSON_NOT_FOUND', `课程不存在：id=${lessonId}`);
    }

    const changes = {};
    if (body.lessonDate !== undefined) changes.lesson_date = body.lessonDate;
    if (body.levelCode !== undefined) changes.level_code = body.levelCode;
    if (body.summary !== undefined) changes.summary = String(body.summary).trim();
    if (body.grammarPoint !== undefined) changes.grammar_point = body.grammarPoint;
    if (body.sourceFile !== undefined) changes.source_file = body.sourceFile;
    if (body.status !== undefined) changes.status = body.status;
    if (body.feedback !== undefined) changes.feedback = body.feedback ? body.feedback.feedback : null;
    await lessonRepository.updateLessonFields(conn, lessonId, changes);

    const written = await writeLessonChildren(conn, studentId, lessonId, body);
    const counts = await refreshLessonCounts(conn, lessonId, lesson.lesson_no, body);

    return {
      id: lessonId,
      lessonNo: lesson.lesson_no,
      levelCode: body.levelCode ?? lesson.level_code,
      status: body.status ?? lesson.status,
      sectionCount: written.sectionCount,
      vocabCount: counts.vocabCount,
      exerciseCount: counts.exerciseCount,
      errorCount: counts.errorCount,
      warnings: buildWarnings(ignored, counts.countsSkipped),
    };
  });
}

module.exports = {
  listLessons, listAllLessons, getLessonDetail, getLessonExercises, getLatestLesson, getErrorTrend, mapLesson,
  validateLessonRecord, createLesson, updateLesson, WRITE_API_FROM_LESSON_NO,
};
