const express = require('express');
const { getAppVersion } = require('../controllers/appVersionController');

const router = express.Router();

router.get('/version', getAppVersion);

module.exports = router;
