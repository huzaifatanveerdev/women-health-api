// src/services/subscriptionService.js

const Subscription = require('../models/Subscription');

async function getUserSubscription(userId) {
  return await Subscription.findOne({
    userId,
    currentPeriodEnd: { $gt: new Date() }
  }).sort({ createdAt: -1 });
}

async function hasActiveSubscription(userId) {
  const subscription = await getUserSubscription(userId);
  return !!subscription;
}

async function canPurchaseNewSubscription(userId) {
  const subscription = await getUserSubscription(userId);

  if (!subscription) return true;

  // User must wait until current period ends
  return subscription.currentPeriodEnd <= new Date();
}

module.exports = {
  getUserSubscription,
  hasActiveSubscription,
  canPurchaseNewSubscription
};
