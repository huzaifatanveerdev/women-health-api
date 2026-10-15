const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },

    platform: {
      type: String,
      enum: ['apple', 'google'],
      required: true
    },

    productId: {
      type: String,
      required: true
    },

    planKey: {
      type: String,
      // `impact_legacy_yearly` is grandfathered: a small set of users who
      // purchased the original yearly Impact product (`com.women-help-api.impact`)
      // before it became a monthly product. Their renewals must still credit
      // 3 months per cycle (see `monthsMap` in revenuecatWebhookService).
      enum: ['impact', 'impactplus', 'maximpact', 'impact_legacy_yearly'],
      required: true
    },

    status: {
      type: String,
      enum: ['active', 'canceled', 'expired', 'grace'],
      required: true
    },

    autoRenew: {
      type: Boolean,
      default: true
    },

    cancelAtPeriodEnd: {
      type: Boolean,
      default: false
    },

    currentPeriodStart: {
      type: Date,
      required: true
    },

    currentPeriodEnd: {
      type: Date,
      required: true
    },

    // Apple: originalTransactionId
    // Google: purchaseToken
    storeSubscriptionId: {
      type: String,
      required: true
    },

    lastVerifiedAt: {
      type: Date
    }
  },
  { timestamps: true }
);

// A user can only have ONE active subscription at a time
subscriptionSchema.index(
  { userId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'active' } }
);

module.exports = mongoose.model('Subscription', subscriptionSchema);
