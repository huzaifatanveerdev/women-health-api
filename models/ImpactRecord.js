const mongoose = require('mongoose');

const impactRecordSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  planKey: {
    type: String,
    // `impact_legacy_yearly` is grandfathered: yearly Impact subscribers from
    // before the plan became monthly. Each renewal still credits 3 months.
    enum: ['impact', 'impactplus', 'maximpact', 'impact_legacy_yearly'],
    required: true
  },
  monthsCommitted: {
    type: Number,
    required: true
  },
  transactionId: {
    type: String,
    required: true,
    unique: true  // prevents duplicate records for same transaction
  },
  eventType: {
    type: String,
    enum: ['INITIAL_PURCHASE', 'RENEWAL', 'RESUBSCRIBE'],
    required: true
  },
  purchaseDate: {
    type: Date,
    required: true
  },
  commitmentEndDate: {
    type: Date,
    required: true
  },
  platform: {
    type: String,
    enum: ['google', 'apple'],
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('ImpactRecord', impactRecordSchema);