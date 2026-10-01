'use strict';

const asyncHandler = require('../utils/asyncHandler');
const { ok, okList, parsePaging } = require('../utils/response');
const { validate } = require('../utils/validate');
const studentService = require('../services/student.service');
const mistakeService = require('../services/mistake.service');
const { MISTAKE_STATUS, ERROR_TYPE } = require('../constants');

const LIST_SCHEMA = {
  page: { type: 'int', min: 1 },
  size: { type: 'int', min: 1, max: 500 },
  status: { type: 'string', enum: MISTAKE_STATUS },
  errorType: { type: 'string', enum: ERROR_TYPE },
  q: { type: 'string', maxLength: 100 },
  studentId: { type: 'int', min: 1 },
};

const ID_SCHEMA = { id: { type: 'int', min: 1, required: true } };
const STUDENT_SCHEMA = { studentId: { type: 'int', min: 1 } };

const REVIEW_SCHEMA = {
  result: { type: 'string', required: true, enum: ['correct', 'wrong'] },
  lessonNo: { type: 'int', min: 1 },
  answeredAt: { type: 'string', maxLength: 40 },
  clientEventId: { type: 'string', maxLength: 64 },
};

/** GET /api/mistakes */
const list = asyncHandler(async (req, res) => {
  const query = validate(req.query, LIST_SCHEMA);
  const paging = parsePaging(query);
  const studentId = await studentService.resolveStudentId({ studentId: query.studentId });
  const { list: rows, total } = await mistakeService.listMistakes(studentId, query, paging);
  return okList(res, rows, total, paging.page, paging.size);
});

/** GET /api/mistakes/pending —— 未过关错词，按优先级排序 */
const pending = asyncHandler(async (req, res) => {
  const query = validate(req.query, {
    ...STUDENT_SCHEMA,
    limit: { type: 'int', min: 1, max: 200 },
  });
  const studentId = await studentService.resolveStudentId({ studentId: query.studentId });
  const rows = await mistakeService.getPendingMistakes(studentId, query.limit || 50);
  return ok(res, { list: rows, total: rows.length });
});

/** GET /api/mistakes/stats */
const stats = asyncHandler(async (req, res) => {
  const query = validate(req.query, STUDENT_SCHEMA);
  const studentId = await studentService.resolveStudentId({ studentId: query.studentId });
  const data = await mistakeService.getStats(studentId);
  return ok(res, data);
});

/** GET /api/mistakes/:id */
const detail = asyncHandler(async (req, res) => {
  const params = validate(req.params, ID_SCHEMA);
  const query = validate(req.query, STUDENT_SCHEMA);
  const studentId = await studentService.resolveStudentId({ studentId: query.studentId });
  const data = await mistakeService.getMistake(studentId, params.id);
  return ok(res, data);
});

/**
 * POST /api/mistakes/:id/review —— 复习结果回写。
 * clientEventId 幂等：同一事件重复提交不会重复累加 wrong_count。
 */
const review = asyncHandler(async (req, res) => {
  const params = validate(req.params, ID_SCHEMA);
  const query = validate(req.query, STUDENT_SCHEMA);
  const body = validate(req.body || {}, REVIEW_SCHEMA);
  const studentId = await studentService.resolveStudentId({ studentId: query.studentId });
  const data = await mistakeService.reviewMistake(studentId, params.id, body);
  return ok(res, data);
});

/** GET /api/mistakes/:id/events —— 某错词的复习流水（N2，按时间升序） */
const events = asyncHandler(async (req, res) => {
  const params = validate(req.params, ID_SCHEMA);
  const query = validate(req.query, {
    ...STUDENT_SCHEMA,
    limit: { type: 'int', min: 1, max: 200 },
  });
  const studentId = await studentService.resolveStudentId({ studentId: query.studentId });
  const data = await mistakeService.getMistakeEvents(studentId, params.id, query.limit || 50);
  return ok(res, data);
});

/**
 * POST /api/mistakes —— 批量写入错词本条目（Step 2b）。
 * 载荷为「原始错词条目」（`wrong-words.md` 的 8 列），**不喂 `before/after` 全状态**；
 * `error_type` / `wrong_count` / `streak` / `status` 一律取入参、服务端不推导。
 * 字段级校验在 service 内完成（嵌套数组，`validate` 的扁平 DSL 不适用）。
 */
const create = asyncHandler(async (req, res) => {
  const query = validate(req.query, STUDENT_SCHEMA);
  const studentId = await studentService.resolveStudentId({ studentId: query.studentId });
  const data = await mistakeService.createMistakesBatch(studentId, req.body || {});
  return ok(res, data);
});

module.exports = { list, pending, stats, detail, review, events, create };
