'use strict';

const express = require('express');
const controller = require('../controllers/mistake.controller');

const router = express.Router();

router.get('/', controller.list);
router.get('/pending', controller.pending);
router.get('/stats', controller.stats);
router.get('/:id', controller.detail);

module.exports = router;
