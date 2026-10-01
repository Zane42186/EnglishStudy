'use strict';

const mistakeRepository = require('../repositories/mistake.repository');
const lessonRepository = require('../repositories/lesson.repository');
const { withTransaction } = require('../config/db');
const ApiError = require('../utils/ApiError');
const { normalizeDateTime } = require('../utils/datetime');
// 判重键**唯一实现**：与 `db:sync-mistakes` 共用，两条「错词本 → 库」路径
// 对「同一行」的判断必须逐字一致（否则即 DQ1 成因）。
const { normKey } = require('../utils/mistakeKey');
// 课号两列定则**唯一实现**：同两条路径共用（§11.11）。
const { buildLessonMaps, resolveNextLastLessonId } = require('../utils/mistakeLesson');
// 枚举白名单只取 `src/constants.js`（唯一来源，与 schema.sql 的 ENUM 同源）
const { ERROR_TYPE, MISTAKE_STATUS } = require('../constants');

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
 * 两者都写 last_reviewed_at，并在 mistake_events 留一条复习流水。
 *
 * 幂等：clientEventId 命中 mistake_events.client_event_id（唯一键）时直接返回首次结果，
 * 不重复累加。配合 mistakes 行锁，同一错词的重复提交是串行的。
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
      const dup = await mistakeRepository.findEventByClientId(conn, studentId, clientEventId);
      if (dup) {
        // 幂等命中：返回与首次调用完全一致的形状（不夹带 mapMistake 的额外字段）
        return {
          id: row.id,
          streak: row.streak,
          wrongCount: row.wrong_count,
          status: row.status,
          priority: derivePriority(row),
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
    await mistakeRepository.insertEvent(conn, {
      studentId,
      mistakeId,
      lessonId,
      result,
      clientEventId,
      answeredAt: reviewedAt,
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

/** GET /api/mistakes/:id/events —— 某错词的复习流水（N2） */
async function getMistakeEvents(studentId, mistakeId, limit = 50) {
  const rows = await mistakeRepository.listEvents(studentId, mistakeId, limit);
  if (rows === null) {
    throw ApiError.notFound('MISTAKE_NOT_FOUND', `错词不存在：id=${mistakeId}`);
  }
  return {
    list: rows.map((r) => ({
      eventId: r.id,
      result: r.result,
      lessonNo: r.lesson_no ?? null,
      clientEventId: r.client_event_id ?? null,
      answeredAt: r.answered_at,
      createdAt: r.created_at,
    })),
    total: rows.length,
  };
}

/* ===================== 写路径：POST /api/mistakes ===================== */

/** 单批上限。错词本现 26 条，200 足够；设上限是为防误传超大数组拖垮事务。 */
const MAX_BATCH_ITEMS = 200;
/** 与 `mistakes.wrong_text / correct_text / error_reason` 的 varchar(512) 同源 */
const TEXT_MAX = 512;

/**
 * 校验批量错词入参（R3：**只喂原始错词条目** —— 即 `wrong-words.md` 的 8 列）。
 * 字段级错误以 400 抛出（`data: [{field, message}]`），与 `POST /api/readings` 同范式。
 * 返回 `{ items }`，每项带派生出的 `normKey`。
 */
function validateMistakeBatch(body = {}) {
  const errors = [];
  const b = body && typeof body === 'object' ? body : {};

  let lessonNo = null;
  if (b.lessonNo !== undefined && b.lessonNo !== null) {
    if (!Number.isInteger(b.lessonNo) || b.lessonNo < 1) {
      errors.push({ field: 'lessonNo', message: '必须是 ≥1 的整数' });
    } else {
      lessonNo = b.lessonNo;
    }
  }

  const rawItems = b.items;
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    // 没有条目就没法继续 —— 直接抛，避免后续空循环给出「成功但什么都没做」的假象
    errors.push({ field: 'items', message: '必填，且至少 1 条' });
    throw ApiError.badRequest('批量错词校验失败', errors);
  }
  if (rawItems.length > MAX_BATCH_ITEMS) {
    errors.push({ field: 'items', message: `单批最多 ${MAX_BATCH_ITEMS} 条，收到 ${rawItems.length} 条` });
  }

  const items = [];
  const seen = new Map(); // normKey → 首次出现的下标

  rawItems.forEach((raw, i) => {
    const at = `items[${i}]`;
    const push = (field, message) => errors.push({ field: `${at}.${field}`, message });

    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      push('', '必须是对象');
      return;
    }

    let wrongText = null;
    if (typeof raw.wrongText !== 'string' || raw.wrongText.trim() === '') {
      push('wrongText', '必填，且必须是非空字符串');
    } else if (raw.wrongText.length > TEXT_MAX) {
      push('wrongText', `长度不能超过 ${TEXT_MAX}`);
    } else if (/（[^）]*）/.test(raw.wrongText)) {
      // DQ1 守卫：错词本硬规范是「错误点只写错误形式本身、不得夹带括号批注」。
      // 写接口若原样落库，批注就会进 `wrong_text`，迁移时被 `uk_mistakes_text`
      // 拆成两行 —— 正是 DQ1 的成因。故在边界直接拒收（批注应写 errorReason）。
      push('wrongText', '不得夹带全角括号批注（批注请写 errorReason）——「错误点只写错误形式本身」');
    } else {
      wrongText = raw.wrongText;
    }

    // correctText：库内 NOT NULL，故选填会静默写成 NULL 报错，这里要求必填
    let correctText = null;
    if (typeof raw.correctText !== 'string' || raw.correctText.trim() === '') {
      push('correctText', '必填，且必须是非空字符串');
    } else if (raw.correctText.length > TEXT_MAX) {
      push('correctText', `长度不能超过 ${TEXT_MAX}`);
    } else {
      correctText = raw.correctText;
    }

    // error_type / wrong_count 只由人工判定 —— 此处只校验合法性，**不做任何推导**
    if (!ERROR_TYPE.includes(raw.errorType)) {
      push('errorType', `必填，取值必须是 ${ERROR_TYPE.join(' / ')} 之一`);
    }
    if (!Number.isInteger(raw.wrongCount) || raw.wrongCount < 1) {
      push('wrongCount', '必填，必须是 ≥1 的整数（人工判定值，服务端不推导）');
    }

    if (raw.errorReason !== undefined && raw.errorReason !== null) {
      if (typeof raw.errorReason !== 'string') push('errorReason', '必须是字符串');
      else if (raw.errorReason.length > TEXT_MAX) push('errorReason', `长度不能超过 ${TEXT_MAX}`);
    }

    let streak = 0;
    if (raw.streak !== undefined && raw.streak !== null) {
      if (!Number.isInteger(raw.streak) || raw.streak < 0) push('streak', '必须是 ≥0 的整数');
      else streak = raw.streak;
    }

    let status = 'pending';
    if (raw.status !== undefined && raw.status !== null) {
      if (!MISTAKE_STATUS.includes(raw.status)) push('status', `取值必须是 ${MISTAKE_STATUS.join(' / ')} 之一`);
      else status = raw.status;
    }

    let courseNo = lessonNo;
    if (raw.courseNo !== undefined && raw.courseNo !== null) {
      if (!Number.isInteger(raw.courseNo) || raw.courseNo < 1) push('courseNo', '必须是 ≥1 的整数');
      else courseNo = raw.courseNo;
    }

    const key = wrongText ? normKey(wrongText) : null;
    if (key) {
      if (seen.has(key)) {
        // 同批重复判重键：显式报错，别静默取一条 —— 那会把 Skill 侧缺陷藏起来
        push('wrongText', `与 items[${seen.get(key)}] 规范化后同键（「${rawItems[seen.get(key)].wrongText}」）—— 同一批不得重复`);
      } else {
        seen.set(key, i);
      }
    }

    items.push({
      wrongText,
      correctText,
      errorType: raw.errorType,
      errorReason: raw.errorReason ?? null,
      streak,
      status,
      wrongCount: raw.wrongCount,
      courseNo,
      normKey: key,
    });
  });

  if (errors.length) throw ApiError.badRequest('批量错词校验失败', errors);
  return { lessonNo, items };
}

/**
 * POST /api/mistakes —— 批量写入错词本条目（Step 2b）。
 *
 * 口径与 `db:sync-mistakes` **逐列一致**（共用 `normKey`、`MISTAKE_CONTENT_COLS` 与课号定则）：
 *   - 判重键 = `normKey(wrongText)`（去全角括号批注 + 折叠空白 + 转小写），**只在本人范围内比对**
 *   - 命中   → 同步 7 个内容列；`first_lesson_id` **冻结不动**（首次出错课）；
 *              `last_lesson_id` **按 `max(现有课号, 本次课号)` 单调刷新**（§11.11）
 *   - 未命中 → 新建（`first_lesson_id = last_lesson_id = courseNo` 对应的课）
 *   - `wrong_count` **以入参人工值为准覆盖写**；库内自动累计值与人工值不一致时
 *     **逐条写入 `warnings`**（R3：人工值为准 + 差异告警，绝不静默改写人工判定）
 *   - `error_type` / `wrong_count` / `streak` / `status` **一律取入参、绝不推导**
 *
 * 幂等：同一 payload 重复提交，第二次起 `created=0` / `unchanged=N`。
 *       （课号刷新同样幂等：本次课号不大于现有值时定则返回「不改」→ 该行仍计 `unchanged`。）
 * 单事务：任一条失败整体回滚。
 */
async function createMistakesBatch(studentId, body) {
  const { items } = validateMistakeBatch(body);
  const warnings = [];

  // 课号两向映射（lessons 在一批之内不会变，故在事务外读；分层上仍只走 repository）
  const lessonRows = await lessonRepository.listAll(studentId, {});
  const { idByNo, noById } = buildLessonMaps(lessonRows);

  return withTransaction(async (conn) => {
    const dbRows = await mistakeRepository.listByStudentOn(conn, studentId);
    const byKey = new Map();
    for (const r of dbRows) {
      const k = normKey(r.wrong_text);
      if (byKey.has(k)) continue; // 库内历史重复：取先遍历到的那条（与 sync 同口径）
      byKey.set(k, r);
    }

    const results = [];
    let created = 0;
    let updated = 0;
    let unchanged = 0;

    for (const it of items) {
      const target = {
        wrong_text: it.wrongText,
        correct_text: it.correctText,
        error_reason: it.errorReason,
        error_type: it.errorType,
        streak: it.streak,
        wrong_count: it.wrongCount,
        status: it.status,
      };

      const existing = byKey.get(it.normKey);

      if (!existing) {
        let lessonId = null;
        if (it.courseNo != null) {
          lessonId = idByNo.get(it.courseNo) ?? null;
          if (lessonId == null) {
            // 刻意不丢词：宁可课号置空也要把错词收进来，但必须显式告警（勿静默）
            warnings.push(`「${it.wrongText}」找不到第 ${it.courseNo} 课，已写入但 first/last_lesson_id 为空`);
          }
        }
        const id = await mistakeRepository.insertMistakeOn(conn, {
          studentId,
          firstLessonId: lessonId,
          lastLessonId: lessonId,
          wrongText: target.wrong_text,
          correctText: target.correct_text,
          errorType: target.error_type,
          errorReason: target.error_reason,
          streak: target.streak,
          wrongCount: target.wrong_count,
          status: target.status,
        });
        created += 1;
        byKey.set(it.normKey, { id, ...target });
        results.push({
          id, action: 'created', wrongText: it.wrongText,
          status: it.status, wrongCount: it.wrongCount,
        });
        continue;
      }

      const changed = mistakeRepository.MISTAKE_CONTENT_COLS
        .filter((c) => String(existing[c] ?? '') !== String(target[c] ?? ''));

      // §11.11：命中时刷新「最近一次出错课」—— `max(现有课号, 本次课号)` 单调守卫。
      // 返回 `null` ＝ 不该刷（`first` 为 NULL 的「诊断」行 / 本次课号不可知 / 课号不存在 /
      // 本次课号不大于现有值）。两条写入路径共用同一份定则，避免漂移。
      const nextLastLessonId = resolveNextLastLessonId({
        firstLessonId: existing.first_lesson_id,
        lastLessonId: existing.last_lesson_id,
        currentLessonNo: it.courseNo,
        idByNo,
        noById,
      });

      if (!changed.length && nextLastLessonId == null) {
        unchanged += 1;
        results.push({
          id: existing.id, action: 'unchanged', wrongText: it.wrongText,
          status: it.status, wrongCount: it.wrongCount,
        });
        continue;
      }

      // R3：人工值为准 —— wrong_count 差异必须逐条告警，不静默改写人工判定
      if (String(existing.wrong_count) !== String(target.wrong_count)) {
        warnings.push(
          `「${it.wrongText}」wrong_count：库内自动累计值 ${existing.wrong_count} ≠ 人工判定值 ${target.wrong_count}`
          + '（可能含未留档的复发）→ 已按人工值覆盖'
        );
      }

      if (changed.length) await mistakeRepository.updateContentOn(conn, existing.id, target);

      if (nextLastLessonId != null) {
        await mistakeRepository.refreshLastLessonOn(conn, existing.id, nextLastLessonId);
        // 计入 `changed`：让响应能看出「本次只前进了课号、内容列未变」
        changed.push('last_lesson_id');
      }

      updated += 1;
      byKey.set(it.normKey, {
        id: existing.id,
        ...target,
        first_lesson_id: existing.first_lesson_id,
        last_lesson_id: nextLastLessonId ?? existing.last_lesson_id,
      });
      results.push({
        id: existing.id, action: 'updated', wrongText: it.wrongText,
        status: it.status, wrongCount: it.wrongCount, changed,
      });
    }

    return { created, updated, unchanged, total: items.length, items: results, warnings };
  });
}

module.exports = {
  listMistakes, getMistake, getPendingMistakes, getStats, getPendingByType,
  reviewMistake, getMistakeEvents, mapMistake,
  validateMistakeBatch, createMistakesBatch,
};
