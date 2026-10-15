const express = require('express');
const router = express.Router();
const { handleRevenueCatWebhook } = require('../controllers/webhookController');

// IMPORTANT: no authentication middleware here
router.post('/revenuecat', handleRevenueCatWebhook);

module.exports = router;
