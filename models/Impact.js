const mongoose = require('mongoose');

const impactSchema = new mongoose.Schema({
  targetCount: {
    type: Number,
    required: [true, 'Target count is required'],
    min: [0, 'Target count must be a positive number']
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Impact', impactSchema);

