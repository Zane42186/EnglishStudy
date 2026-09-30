'use strict';

const asyncHandler = require('../utils/asyncHandler');
const { ok, okList, created, parsePaging } = require('../utils/response');
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

/**
 * POST /api/readings —— 写入当天阅读（`ReadingSet`）。
 * 同一日期已存在 → 409（「当天不覆盖」硬规则）；`?force=true` 为该规则的显式例外（重出）。
 * 请求体只做 `validate()` 认得出的浅层校验，嵌套结构（pieces/paragraphs/questions）
 * 由 service 按 `reading-set.schema.json` 校验并返回字段级明细。
 */
const create = asyncHandler(async (req, res) => {
  const query = validate(req.query, {
    ...STUDENT_SCHEMA,
    force: { type: 'string', maxLength: 5 },
  });
  const studentId = await studentService.resolveStudentId({ studentId: query.studentId });
  const force = query.force === 'true' || query.force === '1';
  const data = await readingService.createReading(studentId, req.body || {}, { force });
  return created(res, data);
});

module.exports = { stats, list, detail, create };
