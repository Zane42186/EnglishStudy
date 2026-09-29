'use strict';

const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/response');
const { validate } = require('../utils/validate');
const studentService = require('../services/student.service');
const progressService = require('../services/progress.service');

const STUDENT_SCHEMA = { studentId: { type: 'int', min: 1 } };

/** GET /api/progress */
const get = asyncHandler(async (req, res) => {
  const query = validate(req.query, STUDENT_SCHEMA);
  const studentId = await studentService.resolveStudentId({ studentId: query.studentId });
  const data = await progressService.getProgress(studentId);
  return ok(res, data);
});

module.exports = { get };
