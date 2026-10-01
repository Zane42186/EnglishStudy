'use strict';

const express = require('express');
const db = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/response');
const studentService = require('../services/student.service');

const lessonRoutes = require('./lesson.routes');
const vocabularyRoutes = require('./vocabulary.routes');
const mistakeRoutes = require('./mistake.routes');
const studyRecordRoutes = require('./studyRecord.routes');
const progressRoutes = require('./progress.routes');
const readingRoutes = require('./reading.routes');
const agentRoutes = require('./agent.routes');

const router = express.Router();

/**
 * GET /api/health —— 健康检查：服务 + 数据库 + 默认学生
 */
router.get(
  '/health',
  asyncHandler(async (req, res) => {
    let database = 'down';
    let dbError = null;
    try {
      await db.ping();
      database = 'up';
    } catch (err) {
      dbError = err.message;
    }

    let defaultStudent = null;
    if (database === 'up') {
      try {
        const id = await studentService.resolveStudentId({});
        defaultStudent = await studentService.getStudent(id);
      } catch (err) {
        defaultStudent = null;
      }
    }

    return ok(res, {
      service: 'english-learning-backend',
      version: require('../../package.json').version,
      database,
      dbError,
      defaultStudent,
      time: new Date().toISOString(),
    });
  })
);

/** GET /api —— 接口索引，便于前端/测试快速自查 */
router.get('/', (req, res) =>
  ok(res, {
    basePath: '/api',
    endpoints: [
      'GET /api/health',
      'GET /api/lessons',
      'GET /api/lessons/all',
      'GET /api/lessons/latest',
      'GET /api/lessons/error-trend',
      'GET /api/lessons/:id',
      'GET /api/lessons/:id/exercises',
      'POST /api/lessons',
      'PUT /api/lessons/:id',
      'GET /api/vocabulary',
      'GET /api/vocabulary/stats',
      'GET /api/vocabulary/:id',
      'GET /api/mistakes',
      'GET /api/mistakes/pending',
      'GET /api/mistakes/stats',
      'GET /api/mistakes/:id',
      'GET /api/mistakes/:id/events',
      'POST /api/mistakes/:id/review',
      'GET /api/study-records',
      'GET /api/study-records/stats',
      'POST /api/study-records',
      'GET /api/progress',
      'POST /api/progress/feedback',
      'GET /api/readings',
      'GET /api/readings/stats',
      'GET /api/readings/:date',
      'POST /api/readings',
      'GET /api/agent/snapshot',
    ],
  })
);

router.use('/lessons', lessonRoutes);
router.use('/vocabulary', vocabularyRoutes);
router.use('/mistakes', mistakeRoutes);
router.use('/study-records', studyRecordRoutes);
router.use('/progress', progressRoutes);
router.use('/readings', readingRoutes);
router.use('/agent', agentRoutes);

module.exports = router;
