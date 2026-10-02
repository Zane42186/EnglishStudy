'use strict';

/**
 * 错词「课号」两列口径 —— `last_lesson_id` 刷新定则（**两条写入路径唯一来源**）
 * ---------------------------------------------------------------------------
 * 权威：`docs/ai-teacher.md` §11.11（2026-10-01 裁定）。两列语义**不同**：
 *   - `first_lesson_id`（**首次**出错课）→ **冻结**：命中时永不改写；
 *   - `last_lesson_id`（**最近一次**出错课）→ **随复发刷新**，规则 = `max(现有课号, 本次课号)`。
 *
 * 为什么 `first` 必须冻结：它被 `countMistakesByLesson` 用作快照
 * `recentLessons[].mistakeCount`（＝本课**新引入**错词数）。一旦被复发改写，
 * 老错会被重复计入每一课，「本课新增几条错词」这个教学指标立即失真。
 *
 * 为什么 `last` 必须有**单调守卫**：两条写入路径都可能**重放旧批次**
 * （`db:sync-mistakes` 幂等重跑、切换点前的历史补录）。无守卫会让 `last` **倒退**，
 * 「上次在第 k 课」（§11.3 G4）随之失真 —— 这正是本裁定要修的病。
 *
 * 为什么按**课号**比较、而不是按 `lessons.id`：本库 id 与课号当前同序，但那是
 * 「恰好如此」的环境状态（禁止断言/逻辑依赖环境状态）——`lesson_no` 才是语义上的课序。
 *
 * ⚠️ 本模块**只做判定、不碰 DB、不写库**：返回值由调用方自行落库。
 *    `null` ＝ **不改**（调用方据此把该行判为「无变化」，从而保住幂等语义）。
 */

/**
 * 由 `lessons` 行数组建两张映射（两个方向都要用：新建取 id、比较取课号）。
 * @param {Array<{id:number, lesson_no:number}>} lessonRows
 */
function buildLessonMaps(lessonRows) {
  const idByNo = new Map();
  const noById = new Map();
  for (const r of lessonRows || []) {
    idByNo.set(r.lesson_no, r.id);
    noById.set(r.id, r.lesson_no);
  }
  return { idByNo, noById };
}

/**
 * **定则核心**（课号口径，唯一实现）：`last` 是否应前进到「本次课」。
 *
 * 三条守卫，逐条对应 §11.11：
 *   ① `firstLessonNo == null` → 否。规格 3：`first_lesson_id` 为 NULL 的行（「诊断」来源）
 *      后续命中**也不补填**；新建时 first/last 同源同值，故 first 不可解析 ⇒ 整体跳过。
 *      （用**课号**而非 id 判断：id 指向的课被删时同样不可解析，语义一致。）
 *   ② `currentLessonNo == null` → 否。本次课号不可知，无从判断。
 *   ③ 单调守卫：本次课号必须**严格大于**现有课号才前进（相等／更小均保持原值 ⇒ 重放幂等）；
 *      现有课号不可解析时视为「可修」，允许写入。
 *
 * @param {object} p
 * @param {number|null} p.firstLessonNo   现有 `first_lesson_id` 解析出的**课号**
 * @param {number|null} p.lastLessonNo    现有 `last_lesson_id` 解析出的**课号**
 * @param {number|null} p.currentLessonNo **本次课号**（不是错词本 8 列里的「课号」！）
 * @returns {boolean} 是否应把 `last` 前进到本次课
 */
function shouldAdvanceLast({ firstLessonNo, lastLessonNo, currentLessonNo }) {
  if (firstLessonNo == null) return false;
  if (currentLessonNo == null) return false;
  if (lastLessonNo == null) return true;
  return currentLessonNo > lastLessonNo;
}

/**
 * 适配器 A —— **错词批量写入**（`POST /api/mistakes`）：入参是现有行的 **id**，
 * 需要 `lessons` 双向映射把「本次课号」换成 id、把现有 id 换成课号。
 *
 * @param {object} p
 * @param {number|null} p.firstLessonId  库内现有 `first_lesson_id`
 * @param {number|null} p.lastLessonId   库内现有 `last_lesson_id`
 * @param {number|null} p.currentLessonNo 本次课号
 * @param {Map<number,number>} p.idByNo   课号 → lessons.id
 * @param {Map<number,number>} p.noById   lessons.id → 课号
 * @returns {number|null} 应写入的新 `last_lesson_id`；`null` ＝ 不改
 */
function resolveNextLastLessonId({ firstLessonId, lastLessonId, currentLessonNo, idByNo, noById }) {
  const nextId = currentLessonNo == null ? null : (idByNo.get(currentLessonNo) ?? null);
  if (nextId == null) return null; // 本次课号不可知 / 课号在库内不存在 —— 调用方负责告警，此处不猜
  return shouldAdvanceLast({
    firstLessonNo: firstLessonId == null ? null : (noById.get(firstLessonId) ?? null),
    lastLessonNo: lastLessonId == null ? null : (noById.get(lastLessonId) ?? null),
    currentLessonNo,
  }) ? nextId : null;
}

/**
 * 适配器 B —— **复习回写**（`POST /api/mistakes/:id/review`）：行内课号**已经**由
 * `BASE_SELECT` 的子查询解析好（`first_lesson_no` / `last_lesson_no`），且本次课的
 * `lessonId` 调用方手上就有（它同时要写 `mistake_events.lesson_id`）⇒ **无需任何映射/查询**。
 *
 * ⚠️ 调用方必须只在 `result === 'wrong'`（＝复发）时调它 —— 答对不是复发。
 *
 * @param {object} p
 * @param {number|null} p.firstLessonNo   行内 `first_lesson_no`（课号）
 * @param {number|null} p.lastLessonNo    行内 `last_lesson_no`（课号）
 * @param {number|null} p.currentLessonNo 本次课号
 * @param {number|null} p.currentLessonId 本次课的 `lessons.id`
 * @returns {number|null} 应写入的新 `last_lesson_id`；`null` ＝ 不改
 */
function resolveNextLastLessonIdByNo({ firstLessonNo, lastLessonNo, currentLessonNo, currentLessonId }) {
  if (currentLessonId == null) return null;
  return shouldAdvanceLast({ firstLessonNo, lastLessonNo, currentLessonNo }) ? currentLessonId : null;
}

module.exports = {
  buildLessonMaps,
  shouldAdvanceLast,
  resolveNextLastLessonId,
  resolveNextLastLessonIdByNo,
};
