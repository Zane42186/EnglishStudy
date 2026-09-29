'use strict';

const express = require('express');
const controller = require('../controllers/agent.controller');

const router = express.Router();

router.get('/snapshot', controller.snapshot);

module.exports = router;
