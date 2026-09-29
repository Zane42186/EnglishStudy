'use strict';

const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/response');
const { validate } = require('../utils/validate');
const studentService = require('../services/student.service');
const snapshotService = require('../services/snapshot.service');

const SNAPSHOT_SCHEMA = {
  recent: { type: 'int', min: 1, max: 10 },
  studentId: { type: 'int', min: 1 },
};

/** GET /api/agent/snapshot —— 教学快照（9 次请求 → 1 次） */
const snapshot = asyncHandler(async (req, res) => {
  const query = validate(req.query, SNAPSHOT_SCHEMA);
  const studentId = await studentService.resolveStudentId({ studentId: query.studentId });
  const data = await snapshotService.getSnapshot(studentId, { recent: query.recent || 3 });
  return ok(res, data);
});

module.exports = { snapshot };
