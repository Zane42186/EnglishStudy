/* 课程小节契约常量与折叠规则（2026-10-02 从 review/index.html 与 lessons/lesson.html 抽出）
 *
 * 折叠（Amy 裁定）：桌面默认展开 语法/例句/作业/批改，其余折叠；移动端只默认展开 批改。
 * 支持 `?open=all` 与 `#sec-<type>` 深链；F10：expected_mistakes 按 Amy 裁定不展示。
 */

/* 契约小节顺序（backend/docs/05-api-reference.md） */
export const ORDER = ['review', 'grammar', 'vocab_table', 'examples', 'homework', 'my_answer', 'grading', 'feedback'];

/* Amy 裁定：本课易错预警不展示 */
export const HIDDEN_TYPES = ['expected_mistakes'];

/* 桌面默认展开的小节 */
export const DEFAULT_OPEN = ['grammar', 'examples', 'homework', 'grading'];

export function isMobileViewport() {
  return !!(window.matchMedia && window.matchMedia('(max-width: 720px)').matches);
}

/**
 * 某个小节初始是否展开。
 * 优先级：?open=all > #sec-<type> 深链 > 移动端（只展开批改）> 桌面默认展开集。
 */
export function shouldOpen(type, opts) {
  const o = opts || {};
  if (o.openAll) { return true; }
  if (o.deepType && o.deepType === type) { return true; }
  if (o.isMobile) { return type === 'grading'; }
  return DEFAULT_OPEN.indexOf(type) !== -1;
}
