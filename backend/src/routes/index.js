const express = require('express');
const controllers = require('../controllers');

const model = require('../models');

const router = express.Router();

router.get('/interface', controllers.interfaces);
router.get('/queue', controllers.queue);
router.get('/', controllers.home);

module.exports = router;