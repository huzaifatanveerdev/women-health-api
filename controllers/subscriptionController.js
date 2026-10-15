const subscriptionService = require('../services/subscriptionService');
const { getLocalizedMessageFromRequest } = require('../utils/localization');
const { getTransactionDetails } = require('../services/appleService');
const { getSubscriptionDetailsFromGoogle } = require('../services/googleService');
const {
  normalizeAppleTransaction,
  normalizeGoogleSubscription
} = require('../services/subscriptionNormalizer');
const { saveOrUpdateSubscription } = require('../services/subscriptionPersistenceService');

/**
 * Get subscription status for the authenticated user
 * @route   GET /api/subscription/status
 * @access  Protected
 */
const getSubscriptionStatus = async (req, res) => {
  try {
    const userId = req.user.userId;
    const subscription = await subscriptionService.getUserSubscription(userId);

    if (!subscription) {
      return res.status(200).json({
        subscribed: false
      });
    }

    return res.status(200).json({
      subscribed: true,
      planKey: subscription.planKey,
      platform: subscription.platform,
      status: subscription.status,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      currentPeriodEnd: subscription.currentPeriodEnd
    });
  } catch (error) {
    return res.status(500).json({
      message: getLocalizedMessageFromRequest('subscription.status.fetch.failed', req)
    });
  }
};

/**
 * Verify subscription purchase
 * @route   POST /api/subscriptions/verify
 * @access  Protected
 */
const verifySubscription = async (req, res) => {
  try {
    const { platform } = req.body;

    if (!platform) {
      return res.status(400).json({
        message: 'Platform is required'
      });
    }

    let normalized;

    if (platform === 'apple') {
      const { transactionId } = req.body;

      if (!transactionId) {
        return res.status(400).json({
          message: 'transactionId is required'
        });
      }

      const appleResult = await getTransactionDetails(transactionId);
      normalized = normalizeAppleTransaction(appleResult);

    } else if (platform === 'google') {
      const { packageName, subscriptionId, purchaseToken } = req.body;

      if (!packageName || !subscriptionId || !purchaseToken) {
        return res.status(400).json({
          message: 'Missing Google subscription parameters'
        });
      }

      const googleData = await getSubscriptionDetailsFromGoogle({
        packageName,
        subscriptionId,
        purchaseToken
      });
      
      normalized = normalizeGoogleSubscription(googleData, subscriptionId, purchaseToken);

    } else {
      return res.status(400).json({
        message: 'Invalid platform'
      });
    }

  const userId = req.user._id;

  const savedSubscription = await saveOrUpdateSubscription(userId, normalized);

  return res.status(200).json({
    success: true,
    subscription: {
      planKey: savedSubscription.planKey,
      status: savedSubscription.status,
      currentPeriodEnd: savedSubscription.currentPeriodEnd,
      cancelAtPeriodEnd: savedSubscription.cancelAtPeriodEnd
    }
  });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: 'Subscription verification failed'
    });
  }
};


module.exports = {
  getSubscriptionStatus,
  verifySubscription
};
