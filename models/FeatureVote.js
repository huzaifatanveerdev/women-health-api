const mongoose = require('mongoose');

const featureVoteSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  featureId: {
    type: Number,
    required: true,
    enum: [1, 2, 3] // 1: Mood Tracker, 2: Share cycle, 3: Login with Apple or Google
  },
  votedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound index to ensure one vote per user per feature
featureVoteSchema.index({ userId: 1, featureId: 1 }, { unique: true });

module.exports = mongoose.model('FeatureVote', featureVoteSchema);
