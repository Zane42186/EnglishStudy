'use strict';

const express = require('express');
const controller = require('../controllers/lesson.controller');

const router = express.Router();

// 注意：固定路径必须注册在 /:id 之前，否则会被 :id 抢先匹配
router.post('/', controller.create);
router.put('/:id', controller.update);
router.get('/', controller.list);
router.get('/all', controller.listAll);
router.get('/latest', controller.latest);
router.get('/error-trend', controller.errorTrend);
router.get('/:id/exercises', controller.exercises);
router.get('/:id', controller.detail);

module.exports = router;
