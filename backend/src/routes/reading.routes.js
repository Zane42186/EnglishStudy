'use strict';

const express = require('express');
const controller = require('../controllers/reading.controller');

const router = express.Router();

router.get('/', controller.list);
router.get('/stats', controller.stats);
router.get('/:date', controller.detail);

module.exports = router;
