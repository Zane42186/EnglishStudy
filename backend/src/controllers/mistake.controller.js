'use strict';

const asyncHandler = require('../utils/asyncHandler');
const { ok, okList, parsePaging } = require('../utils/response');
const { validate } = require('../utils/validate');
const studentService = require('../services/student.service');
const mistakeService = require('../services/mistake.service');
const { MISTAKE_STATUS, ERROR_TYPE } = require('../constants');

const LIST_SCHEMA = {
  page: { type: 'int', min: 1 },
  size: { type: 'int', min: 1, max: 100 },
  status: { type: 'string', enum: MISTAKE_STATUS },
  errorType: { type: 'string', enum: ERROR_TYPE },
  q: { type: 'string', maxLength: 100 },
  studentId: { type: 'int', min: 1 },
};

const ID_SCHEMA = { id: { type: 'int', min: 1, required: true } };
const STUDENT_SCHEMA = { studentId: { type: 'int', min: 1 } };

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

module.exports = { list, pending, stats, detail };
