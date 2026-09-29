'use strict';

const asyncHandler = require('../utils/asyncHandler');
const { ok, okList, created, parsePaging } = require('../utils/response');
const { validate } = require('../utils/validate');
const studentService = require('../services/student.service');
const studyRecordService = require('../services/studyRecord.service');
const { RECORD_TYPE } = require('../constants');

const LIST_SCHEMA = {
  page: { type: 'int', min: 1 },
  size: { type: 'int', min: 1, max: 500 },
  type: { type: 'string', enum: RECORD_TYPE },
  lessonId: { type: 'int', min: 1 },
  from: { type: 'string', maxLength: 10 },
  to: { type: 'string', maxLength: 10 },
  studentId: { type: 'int', min: 1 },
};

const STUDENT_SCHEMA = { studentId: { type: 'int', min: 1 } };

const CREATE_SCHEMA = {
  recordType: { type: 'string', required: true, enum: RECORD_TYPE },
  lessonNo: { type: 'int', min: 1 },
  summary: { type: 'string', maxLength: 255 },
  payload: { type: 'object' },
};

/** GET /api/study-records */
const list = asyncHandler(async (req, res) => {
  const query = validate(req.query, LIST_SCHEMA);
  const paging = parsePaging(query);
  const studentId = await studentService.resolveStudentId({ studentId: query.studentId });
  const { list: rows, total } = await studyRecordService.listRecords(studentId, query, paging);
  return okList(res, rows, total, paging.page, paging.size);
});

/** GET /api/study-records/stats */
const stats = asyncHandler(async (req, res) => {
  const query = validate(req.query, STUDENT_SCHEMA);
  const studentId = await studentService.resolveStudentId({ studentId: query.studentId });
  const data = await studyRecordService.getStats(studentId);
  return ok(res, data);
});

/**
 * POST /api/study-records —— 写入学习记录。
 * 约定：grade 记录可带 payload.byType；feedback 记录可带 payload.nextRecommendation。
 */
const create = asyncHandler(async (req, res) => {
  const query = validate(req.query, STUDENT_SCHEMA);
  const body = validate(req.body || {}, CREATE_SCHEMA);
  const studentId = await studentService.resolveStudentId({ studentId: query.studentId });
  const data = await studyRecordService.createRecord(studentId, body);
  return created(res, data);
});

module.exports = { list, stats, create };
