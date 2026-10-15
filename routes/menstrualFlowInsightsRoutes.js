const express = require('express');
const router = express.Router();
const {
  getMenstrualFlowCycleDetail,
  getMenstrualFlowInsightsDistribution
} = require('../controllers/menstrualFlowInsightsController');
const { authenticateToken } = require('../middleware/auth');

router.get('/insights/distribution', authenticateToken, getMenstrualFlowInsightsDistribution);
router.get('/insights/cycle', authenticateToken, getMenstrualFlowCycleDetail);

module.exports = router;
