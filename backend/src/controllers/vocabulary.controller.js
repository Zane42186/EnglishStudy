'use strict';

const asyncHandler = require('../utils/asyncHandler');
const { ok, okList, parsePaging } = require('../utils/response');
const { validate } = require('../utils/validate');
const studentService = require('../services/student.service');
const vocabularyService = require('../services/vocabulary.service');

const LIST_SCHEMA = {
  page: { type: 'int', min: 1 },
  size: { type: 'int', min: 1, max: 100 },
  letter: { type: 'string', maxLength: 1 },
  q: { type: 'string', maxLength: 100 },
  lessonId: { type: 'int', min: 1 },
  studentId: { type: 'int', min: 1 },
};

const ID_SCHEMA = { id: { type: 'int', min: 1, required: true } };
const STUDENT_SCHEMA = { studentId: { type: 'int', min: 1 } };

/** GET /api/vocabulary */
const list = asyncHandler(async (req, res) => {
  const query = validate(req.query, LIST_SCHEMA);
  const paging = parsePaging(query, { defaultSize: 50 });
  const studentId = await studentService.resolveStudentId({ studentId: query.studentId });
  const { list: rows, total } = await vocabularyService.listVocabulary(studentId, query, paging);
  return okList(res, rows, total, paging.page, paging.size);
});

/** GET /api/vocabulary/stats */
const stats = asyncHandler(async (req, res) => {
  const query = validate(req.query, STUDENT_SCHEMA);
  const studentId = await studentService.resolveStudentId({ studentId: query.studentId });
  const data = await vocabularyService.getStats(studentId);
  return ok(res, data);
});

/** GET /api/vocabulary/:id */
const detail = asyncHandler(async (req, res) => {
  const params = validate(req.params, ID_SCHEMA);
  const query = validate(req.query, STUDENT_SCHEMA);
  const studentId = await studentService.resolveStudentId({ studentId: query.studentId });
  const data = await vocabularyService.getVocabulary(studentId, params.id);
  return ok(res, data);
});

module.exports = { list, stats, detail };
