const mongoose = require('mongoose');

const featureSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  description: {
    type: String,
    required: true
  },
  voteCount: {
    type: Number,
    default: 0
  },
  voters: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
}, {
  timestamps: true
});

// Index for efficient queries
featureSchema.index({ name: 1 });
featureSchema.index({ voteCount: -1 });

module.exports = mongoose.model('Feature', featureSchema);
