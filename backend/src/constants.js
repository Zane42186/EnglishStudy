'use strict';

/**
 * 枚举唯一来源：与 db/schema.sql 的 ENUM 定义严格一致。
 * 修改枚举必须先改表，再改这里，避免两端漂移。
 */

const FEEDBACK = ['too_easy', 'just_right', 'too_hard'];
const FEEDBACK_LABEL = {
  too_easy: '太简单',
  just_right: '刚好',
  too_hard: '太难',
};

const MISTAKE_STATUS = ['pending', 'passed'];
const MISTAKE_STATUS_LABEL = { pending: '未过关', passed: '已过关' };

const ERROR_TYPE = ['grammar', 'spelling', 'punctuation', 'word_choice', 'capitalization', 'other'];
const ERROR_TYPE_LABEL = {
  grammar: '语法',
  spelling: '拼写',
  punctuation: '标点',
  word_choice: '用词',
  capitalization: '大小写',
  other: '其他',
};

const RECORD_TYPE = ['attend', 'homework_submit', 'grade', 'review', 'feedback', 'reading'];
const RECORD_TYPE_LABEL = {
  attend: '上课',
  homework_submit: '交作业',
  grade: '批改',
  review: '复习',
  feedback: '难度反馈',
  reading: '阅读',
};

const SECTION_TYPE = [
  'review', 'grammar', 'vocab_table', 'examples',
  'homework', 'my_answer', 'grading', 'feedback',
  'objectives', 'expected_mistakes',
];
const SECTION_TYPE_LABEL = {
  review: '复习',
  grammar: '今日语法',
  vocab_table: '词汇',
  examples: '例句',
  homework: '作业',
  my_answer: '我的作答',
  grading: '批改',
  feedback: '难度反馈',
  objectives: '本课目标',
  expected_mistakes: '预期易错点',
};

const LESSON_STATUS = ['planned', 'taught', 'archived'];

module.exports = {
  FEEDBACK, FEEDBACK_LABEL,
  MISTAKE_STATUS, MISTAKE_STATUS_LABEL,
  ERROR_TYPE, ERROR_TYPE_LABEL,
  RECORD_TYPE, RECORD_TYPE_LABEL,
  SECTION_TYPE, SECTION_TYPE_LABEL,
  LESSON_STATUS,
};
