'use strict';

const express = require('express');
const controller = require('../controllers/studyRecord.controller');

const router = express.Router();

router.get('/', controller.list);
router.get('/stats', controller.stats);

module.exports = router;
