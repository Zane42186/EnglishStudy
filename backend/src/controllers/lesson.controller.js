'use strict';

const asyncHandler = require('../utils/asyncHandler');
const { ok, okList, parsePaging } = require('../utils/response');
const { validate } = require('../utils/validate');
const studentService = require('../services/student.service');
const lessonService = require('../services/lesson.service');

const LIST_SCHEMA = {
  page: { type: 'int', min: 1 },
  size: { type: 'int', min: 1, max: 100 },
  level: { type: 'string', maxLength: 10 },
  q: { type: 'string', maxLength: 100 },
  from: { type: 'string', maxLength: 10 },
  to: { type: 'string', maxLength: 10 },
  studentId: { type: 'int', min: 1 },
};

const ID_SCHEMA = { id: { type: 'int', min: 1, required: true } };
const STUDENT_SCHEMA = { studentId: { type: 'int', min: 1 } };

/** GET /api/lessons */
const list = asyncHandler(async (req, res) => {
  const query = validate(req.query, LIST_SCHEMA);
  const paging = parsePaging(query);
  const studentId = await studentService.resolveStudentId({ studentId: query.studentId });
  const { list: rows, total } = await lessonService.listLessons(studentId, query, paging);
  return okList(res, rows, total, paging.page, paging.size);
});

/** GET /api/lessons/latest */
const latest = asyncHandler(async (req, res) => {
  const query = validate(req.query, STUDENT_SCHEMA);
  const studentId = await studentService.resolveStudentId({ studentId: query.studentId });
  const data = await lessonService.getLatestLesson(studentId);
  return ok(res, data);
});

/** GET /api/lessons/error-trend */
const errorTrend = asyncHandler(async (req, res) => {
  const query = validate(req.query, {
    ...STUDENT_SCHEMA,
    limit: { type: 'int', min: 1, max: 20 },
  });
  const studentId = await studentService.resolveStudentId({ studentId: query.studentId });
  const data = await lessonService.getErrorTrend(studentId, query.limit || 5);
  return ok(res, data);
});

/** GET /api/lessons/:id */
const detail = asyncHandler(async (req, res) => {
  const params = validate(req.params, ID_SCHEMA);
  const query = validate(req.query, STUDENT_SCHEMA);
  const studentId = await studentService.resolveStudentId({ studentId: query.studentId });
  const data = await lessonService.getLessonDetail(studentId, params.id);
  return ok(res, data);
});

module.exports = { list, latest, errorTrend, detail };
