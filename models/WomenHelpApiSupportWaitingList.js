const mongoose = require('mongoose');

const womenHelpApiSupportWaitingListSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  firstName: {
    type: String,
    trim: true,
    default: null
  },
  location: {
    type: String,
    required: [true, 'Location is required'],
    trim: true
  },
  contact: {
    type: String,
    trim: true,
    default: null
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('WomenHelpApiSupportWaitingList', womenHelpApiSupportWaitingListSchema);

