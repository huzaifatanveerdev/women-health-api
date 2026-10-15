const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { getSubscriptionStatus } = require('../controllers/subscriptionController');
const { generateAppleAuthToken } = require('../utils/appleAuth');
const { testAppleConnection } = require('../services/appleService');
const { verifySubscription } = require('../controllers/subscriptionController');

// GET /status (protected)
router.get('/status', authenticateToken, getSubscriptionStatus);

// TEMP TEST ROUTE - REMOVE LATER
router.get('/apple-test-token', async (req, res) => {
    try {
      const token = generateAppleAuthToken();
      return res.status(200).json({ success: true, token });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: error.message });
    }
  });

  // TEMP TEST ROUTE - REMOVE LATER
router.get('/apple-test-connection', async (req, res) => {
    try {
      const result = await testAppleConnection();
      return res.status(200).json(result);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: error.message });
    }
  });
  
  const { getTransactionDetails } = require('../services/appleService');

// TEMP TEST ROUTE - REMOVE LATER
router.get('/apple-test-transaction/:transactionId', async (req, res) => {
  try {
    const result = await getTransactionDetails(req.params.transactionId);
    return res.status(200).json(result);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: error.message });
  }
});

router.post('/verify', authenticateToken, verifySubscription);

module.exports = router;
