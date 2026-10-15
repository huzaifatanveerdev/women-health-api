const Subscription = require('../models/Subscription');
const subscriptionPlans = require('../config/subscriptionPlans');

function getPlanKeyFromProductId(productId) {
  const plan = subscriptionPlans.find(p => p.productId === productId);

  if (!plan) {
    throw new Error('Invalid productId');
  }

  return plan.key;
}

async function saveOrUpdateSubscription(userId, normalizedData) {
  const {
    platform,
    productId,
    originalTransactionId,
    purchaseDate,
    expiresDate,
    isCanceled,
    isRevoked
  } = normalizedData;

  const planKey = getPlanKeyFromProductId(productId);

  // Check if subscription already exists by storeSubscriptionId and userId
  let subscription = await Subscription.findOne({
    storeSubscriptionId: originalTransactionId,
    userId
  });

  if (subscription) {
    // Update existing subscription
    subscription.currentPeriodStart = purchaseDate;
    subscription.currentPeriodEnd = expiresDate;
    subscription.status = expiresDate > new Date() ? 'active' : 'expired';
    subscription.autoRenew = !isCanceled;
    subscription.cancelAtPeriodEnd = isCanceled;
    subscription.lastVerifiedAt = new Date();

    await subscription.save();
    return subscription;
  }

  // Prevent buying new plan if existing active subscription exists
  const existingActive = await Subscription.findOne({
    userId,
    status: 'active',
    currentPeriodEnd: { $gt: new Date() }
  });

  if (existingActive) {
    if (existingActive.planKey !== planKey) {
      throw new Error('Cannot switch subscription plan until current plan expires');
    }
  
    // Same plan purchase (renewal or restore)
    existingActive.currentPeriodStart = purchaseDate;
    existingActive.currentPeriodEnd = expiresDate;
    existingActive.status = expiresDate > new Date() ? 'active' : 'expired';
    existingActive.autoRenew = !isCanceled;
    existingActive.cancelAtPeriodEnd = isCanceled;
    existingActive.lastVerifiedAt = new Date();
  
    await existingActive.save();
    return existingActive;
  }

  // Create new subscription
  subscription = await Subscription.create({
    userId,
    platform,
    productId,
    planKey,
    status: expiresDate > new Date() ? 'active' : 'expired',
    autoRenew: !isCanceled,
    cancelAtPeriodEnd: isCanceled,
    currentPeriodStart: purchaseDate,
    currentPeriodEnd: expiresDate,
    storeSubscriptionId: originalTransactionId,
    lastVerifiedAt: new Date()
  });

  return subscription;
}

module.exports = {
  saveOrUpdateSubscription
};
