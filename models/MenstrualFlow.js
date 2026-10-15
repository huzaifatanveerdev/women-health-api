const mongoose = require('mongoose');

const menstrualFlowSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  flow: {
    type: String,
    enum: ['Light', 'Medium', 'Heavy'],
    required: true
  },
  recordedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

menstrualFlowSchema.index({ userId: 1, recordedAt: -1 }); // Index for efficient retrieval of user's flow records

module.exports = mongoose.model('MenstrualFlow', menstrualFlowSchema);
