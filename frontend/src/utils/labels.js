/* 枚举中文化（2026-10-02 从 review/assets/ui.js 的 LABEL / label **逐字移植**）
 * 枚举取值必须与 backend/schema.sql 严格一致（契约见 backend/docs/05-api-reference.md）。
 */
export const LABEL = {
  sectionType: {
    review: '复习', grammar: '今日语法', vocab_table: '词汇', examples: '例句',
    homework: '作业', my_answer: '我的作答', grading: '批改', feedback: '难度反馈',
    objectives: '本课目标', expected_mistakes: '本课易错预警', selfcheck: '提交前自查清单'
  },
  errorType: {
    grammar: '语法', spelling: '拼写', punctuation: '标点',
    word_choice: '用词', capitalization: '大小写', other: '其他'
  },
  priority: { high: '高优先', medium: '中优先', low: '低优先' },
  status: { pending: '未过关', passed: '已过关' },
  feedback: { too_easy: '太简单', just_right: '刚好', too_hard: '太难' }
};

export function label(group, value) {
  if (value == null) { return ''; }
  const map = LABEL[group] || {};
  return map[value] || value;
}

export default label;
