'use strict';

const express = require('express');
const controller = require('../controllers/progress.controller');

const router = express.Router();

router.get('/', controller.get);
router.post('/feedback', controller.feedback);

module.exports = router;
