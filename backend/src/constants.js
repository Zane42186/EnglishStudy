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
  'objectives', 'expected_mistakes', 'backfill',
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
  backfill: '补漏块',
};

/**
 * 题集类型：同一课的两套题号命名空间。
 * 与 lesson_exercises.block_kind 同源；作业题 block_no = 0，补漏块为块号 N。
 */
const EXERCISE_BLOCK_KIND = ['homework', 'backfill'];
const EXERCISE_BLOCK_KIND_LABEL = { homework: '作业', backfill: '补漏块' };

/**
 * 题型，与 lesson_exercises.exercise_type 的 ENUM 及
 * docs/schemas/common.schema.json 的 $defs.ExerciseType 严格同源。
 * 2026-10-01 补：此前只有 `db/migration/import_json.js` 内联了一份局部数组，
 * 写接口校验需要同源取值，故上移到本文件（唯一来源）。
 */
const EXERCISE_TYPE = ['fill_blank', 'translate', 'error_correction', 'reorder', 'open', 'choice'];

const LESSON_STATUS = ['planned', 'taught', 'archived'];

/**
 * 级别代码，与 docs/schemas/common.schema.json 的 $defs.LevelCode 严格同源。
 * 用于写入接口的入参校验（如 POST /api/readings 的 levelCode）。
 */
const LEVEL_CODE = ['Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5'];

/** 阅读篇数上限，与 reading-set.schema.json 的 pieces.maxItems 同源 */
const READING_PIECE_MAX = 3;
/** 每篇理解题数量，与 reading-set.schema.json 的 questions.minItems/maxItems 同源 */
const READING_QUESTION_COUNT = 2;

module.exports = {
  FEEDBACK, FEEDBACK_LABEL,
  MISTAKE_STATUS, MISTAKE_STATUS_LABEL,
  ERROR_TYPE, ERROR_TYPE_LABEL,
  RECORD_TYPE, RECORD_TYPE_LABEL,
  SECTION_TYPE, SECTION_TYPE_LABEL,
  EXERCISE_BLOCK_KIND, EXERCISE_BLOCK_KIND_LABEL,
  EXERCISE_TYPE,
  LESSON_STATUS,
  LEVEL_CODE,
  READING_PIECE_MAX, READING_QUESTION_COUNT,
};
