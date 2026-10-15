const mongoose = require('mongoose');

const userIdeaSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  idea: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  submittedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for efficient queries
userIdeaSchema.index({ userId: 1, submittedAt: -1 });

module.exports = mongoose.model('UserIdea', userIdeaSchema);
