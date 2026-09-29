'use strict';

const asyncHandler = require('../utils/asyncHandler');
const { ok, okList, parsePaging } = require('../utils/response');
const { validate } = require('../utils/validate');
const studentService = require('../services/student.service');
const studyRecordService = require('../services/studyRecord.service');
const { RECORD_TYPE } = require('../constants');

const LIST_SCHEMA = {
  page: { type: 'int', min: 1 },
  size: { type: 'int', min: 1, max: 100 },
  type: { type: 'string', enum: RECORD_TYPE },
  lessonId: { type: 'int', min: 1 },
  from: { type: 'string', maxLength: 10 },
  to: { type: 'string', maxLength: 10 },
  studentId: { type: 'int', min: 1 },
};

const STUDENT_SCHEMA = { studentId: { type: 'int', min: 1 } };

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

module.exports = { list, stats };
