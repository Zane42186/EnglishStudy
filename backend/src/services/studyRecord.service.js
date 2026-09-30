'use strict';

const studyRecordRepository = require('../repositories/studyRecord.repository');
const lessonRepository = require('../repositories/lesson.repository');
const ApiError = require('../utils/ApiError');
const { parseJsonColumn } = require('../utils/json');
const { RECORD_TYPE, FEEDBACK } = require('../constants');

/** MySQL JSON 列兜底解析 */
const parsePayload = parseJsonColumn;

/**
 * payload 键白名单（05-api-reference R5 + backend-plan 2.3）。
 * 同时接受 snake_case 别名，统一落成 camelCase，避免写入侧口径漂移。
 */
const PAYLOAD_ALIASES = {
  next_recommendation: 'nextRecommendation',
  by_type: 'byType',
  error_count: 'errorCount',
  exercise_count: 'exerciseCount',
  study_minutes: 'studyMinutes',
  incomplete_step: 'incompleteStep',
};
const PAYLOAD_ALLOWED = new Set([
  'lessonNo', 'level', 'feedback', 'errorCount', 'exerciseCount',
  'byType', 'nextRecommendation', 'studyMinutes', 'incompleteStep',
]);

/** 归一化 payload：别名转正 + 白名单过滤 + 轻量类型校验 */
function normalizePayload(raw = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw ApiError.badRequest('payload 必须是对象');
  }
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    const normalized = PAYLOAD_ALIASES[key] || key;
    if (!PAYLOAD_ALLOWED.has(normalized)) continue; // 白名单外的键忽略
    out[normalized] = value;
  }
  if (out.lessonNo !== undefined && !Number.isInteger(out.lessonNo)) {
    throw ApiError.badRequest('payload.lessonNo 必须是整数');
  }
  if (out.feedback !== undefined && !FEEDBACK.includes(out.feedback)) {
    throw ApiError.badRequest(`payload.feedback 取值必须是 ${FEEDBACK.join(' / ')} 之一`);
  }
  if (out.byType !== undefined) {
    if (!out.byType || typeof out.byType !== 'object' || Array.isArray(out.byType)) {
      throw ApiError.badRequest('payload.byType 必须是 { errorType: count } 对象');
    }
  }
  if (out.nextRecommendation !== undefined && typeof out.nextRecommendation !== 'string') {
    throw ApiError.badRequest('payload.nextRecommendation 必须是字符串');
  }
  return out;
}

function mapRecord(row) {
  return {
    id: row.id,
    recordType: row.record_type,
    summary: row.summary,
    payload: parsePayload(row.payload),
    lessonId: row.lesson_id,
    lessonNo: row.lesson_no ?? null,
    lessonDate: row.lesson_date ?? null,
    createdAt: row.created_at,
  };
}

async function listRecords(studentId, filters, paging) {
  const [total, rows] = await Promise.all([
    studyRecordRepository.count(studentId, filters),
    studyRecordRepository.list(studentId, filters, paging),
  ]);
  return { list: rows.map(mapRecord), total };
}

/** 按记录类型聚合（Amy / 学情分析用） */
async function getStats(studentId) {
  const rows = await studyRecordRepository.statsByType(studentId);
  const byType = {};
  let total = 0;
  for (const row of rows) {
    byType[row.record_type] = row.cnt;
    total += row.cnt;
  }
  return { total, byType };
}

/** POST /api/study-records —— 写入一条学习记录 */
async function createRecord(studentId, { recordType, lessonNo, summary, payload }) {
  if (!RECORD_TYPE.includes(recordType)) {
    throw ApiError.badRequest(`recordType 取值必须是 ${RECORD_TYPE.join(' / ')} 之一`);
  }
  const normalized = normalizePayload(payload || {});
  const effectiveLessonNo =
    lessonNo !== undefined ? lessonNo : (Number.isInteger(normalized.lessonNo) ? normalized.lessonNo : undefined);
  if (effectiveLessonNo !== undefined && normalized.lessonNo === undefined) {
    normalized.lessonNo = effectiveLessonNo;
  }

  let lessonId = null;
  if (Number.isInteger(effectiveLessonNo)) {
    const lesson = await lessonRepository.findByNo(studentId, effectiveLessonNo);
    lessonId = lesson ? lesson.id : null;
  }

  const id = await studyRecordRepository.insert(null, {
    studentId,
    lessonId,
    recordType,
    summary: summary || defaultSummary(recordType, effectiveLessonNo, normalized),
    payload: normalized,
  });

  return { id, recordType, createdAt: new Date().toISOString() };
}

function defaultSummary(recordType, lessonNo, payload) {
  const prefix = Number.isInteger(lessonNo) ? `第 ${lessonNo} 课` : '学习';
  switch (recordType) {
    case 'grade':
      return `${prefix}作业批改：错误 ${payload.errorCount ?? '?'} 处`;
    case 'feedback':
      return `${prefix}反馈：${payload.feedback ?? '未标注'}`;
    case 'attend':
      return `${prefix}上课`;
    case 'review':
      return `${prefix}复习`;
    case 'reading':
      return `${prefix}阅读`;
    case 'homework_submit':
      return `${prefix}交作业`;
    default:
      return `${prefix}记录`;
  }
}

/**
 * 最近一条 feedback 记录的 nextRecommendation（快照 lastRecommendation 数据源）。
 * 无记录 / 无该字段时返回 null，绝不抛错。
 * 若该记录还带 `incompleteStep`（未完成的教学动作），一并带出 —— 供快照 lastIncomplete 投影，
 * 是 G4「断更接续」的判据（docs/ai-teacher.md §11.2 第 5 条题量上浮依赖）。
 */
async function getLastRecommendation(studentId) {
  const row = await studyRecordRepository.findLatestByType(studentId, 'feedback');
  if (!row) return null;
  const payload = parsePayload(row.payload) || {};
  const text = payload.nextRecommendation || payload.next_recommendation;
  if (!text) return null;
  const lessonNo = payload.lessonNo ?? null;
  const incompleteStep = payload.incompleteStep || payload.incomplete_step || null;
  return incompleteStep ? { lessonNo, text, incompleteStep } : { lessonNo, text };
}

module.exports = {
  listRecords, getStats, createRecord, mapRecord, getLastRecommendation, normalizePayload, parsePayload,
};
