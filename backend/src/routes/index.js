const express = require('express');
const controllers = require('../controllers');

const model = require('../models');

const router = express.Router();

router.get('/interface', controllers.interfaces);
router.get('/queue', controllers.queue);
router.post('/chat', controllers.chat);
router.get('/health/deepseek', controllers.deepseekStatus);
router.get('/', controllers.home);

module.exports = router;