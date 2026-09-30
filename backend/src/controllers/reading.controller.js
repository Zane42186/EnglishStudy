'use strict';

const asyncHandler = require('../utils/asyncHandler');
const { ok, okList, parsePaging } = require('../utils/response');
const { validate } = require('../utils/validate');
const studentService = require('../services/student.service');
const readingService = require('../services/reading.service');

const STUDENT_SCHEMA = { studentId: { type: 'int', min: 1 } };

const LIST_SCHEMA = {
  ...STUDENT_SCHEMA,
  page: { type: 'int', min: 1 },
  size: { type: 'int', min: 1, max: 200 },
  from: { type: 'string', maxLength: 10 },
  to: { type: 'string', maxLength: 10 },
};

const DATE_SCHEMA = { date: { type: 'string', required: true, maxLength: 10 } };

/** GET /api/readings/stats —— 阅读统计（R1） */
const stats = asyncHandler(async (req, res) => {
  const query = validate(req.query, STUDENT_SCHEMA);
  const studentId = await studentService.resolveStudentId({ studentId: query.studentId });
  return ok(res, await readingService.getStats(studentId));
});

/** GET /api/readings —— 阅读日清单（倒序，分页） */
const list = asyncHandler(async (req, res) => {
  const query = validate(req.query, LIST_SCHEMA);
  const paging = parsePaging(query);
  const studentId = await studentService.resolveStudentId({ studentId: query.studentId });
  const { list: rows, total } = await readingService.listReadings(
    studentId,
    { from: query.from, to: query.to },
    paging
  );
  return okList(res, rows, total, paging.page, paging.size);
});

/** GET /api/readings/:date —— 某天全文（篇 + 英中对照段落 + 理解题） */
const detail = asyncHandler(async (req, res) => {
  const params = validate(req.params, DATE_SCHEMA);
  const query = validate(req.query, STUDENT_SCHEMA);
  const studentId = await studentService.resolveStudentId({ studentId: query.studentId });
  return ok(res, await readingService.getReadingByDate(studentId, params.date));
});

module.exports = { stats, list, detail };
