'use strict';

const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/response');
const { validate } = require('../utils/validate');
const studentService = require('../services/student.service');
const progressService = require('../services/progress.service');
const { FEEDBACK } = require('../constants');

const STUDENT_SCHEMA = { studentId: { type: 'int', min: 1 } };

const FEEDBACK_SCHEMA = {
  lessonNo: { type: 'int', min: 1, required: true },
  feedback: { type: 'string', required: true, enum: FEEDBACK },
  note: { type: 'string', maxLength: 255 },
  nextRecommendation: { type: 'string', maxLength: 500 },
  next_recommendation: { type: 'string', maxLength: 500 },
};

/** GET /api/progress */
const get = asyncHandler(async (req, res) => {
  const query = validate(req.query, STUDENT_SCHEMA);
  const studentId = await studentService.resolveStudentId({ studentId: query.studentId });
  const data = await progressService.getProgress(studentId);
  return ok(res, data);
});

/** POST /api/progress/feedback —— 难度反馈，触发升降级 */
const feedback = asyncHandler(async (req, res) => {
  const query = validate(req.query, STUDENT_SCHEMA);
  const body = validate(req.body || {}, FEEDBACK_SCHEMA);
  const studentId = await studentService.resolveStudentId({ studentId: query.studentId });
  const data = await progressService.submitFeedback(studentId, {
    ...body,
    nextRecommendation: body.nextRecommendation || body.next_recommendation || undefined,
  });
  return ok(res, data);
});

module.exports = { get, feedback };
