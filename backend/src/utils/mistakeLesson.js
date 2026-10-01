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
 * 判定「判重命中」时 `last_lesson_id` 是否应刷新。
 *
 * ⚠️ `currentLessonNo` 是**本次课号**（本次复发出现在第几课），**不是**错词本 8 列里
 *    那个「课号」列 —— 后者是**首次**课号、人工填、已冻结（§11.7 / §11.11 规格 1）。
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
  // §11.11 规格 3：`first_lesson_id` 为 NULL 的行（「诊断」来源）后续命中**也不补填**。
  // 新建时 first 与 last 同源同值，故 first 为 NULL ⇒ last 亦为 NULL ⇒ 整体跳过。
  if (firstLessonId == null) return null;

  // 本次课号不可知（未给 `items[].courseNo` 也未给顶层 `lessonNo`）→ 无从判断，不动
  if (currentLessonNo == null) return null;

  const nextId = idByNo.get(currentLessonNo);
  if (nextId == null) return null; // 课号在库内不存在 —— 交由调用方告警，此处不猜

  const prevNo = lastLessonId == null ? null : (noById.get(lastLessonId) ?? null);
  // 现有值指向的课不可解析（对应课被删）→ 视为「可修」，不构成倒退
  if (prevNo == null) return nextId;

  // 单调守卫：本次课号必须**严格更大**才刷新（相等／更小均保持原值 ⇒ 重放幂等）
  return currentLessonNo > prevNo ? nextId : null;
}

module.exports = { buildLessonMaps, resolveNextLastLessonId };
