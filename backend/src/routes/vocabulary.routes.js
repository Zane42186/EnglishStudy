'use strict';

const express = require('express');
const controller = require('../controllers/vocabulary.controller');

const router = express.Router();

router.get('/', controller.list);
router.get('/stats', controller.stats);
router.get('/:id', controller.detail);

module.exports = router;
