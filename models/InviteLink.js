const mongoose = require('mongoose');

const inviteLinkSchema = new mongoose.Schema({
  invite: {
    android: {
      type: String,
      trim: true,
      default: null
    },
    ios: {
      type: String,
      trim: true,
      default: null
    },
    dynamic: {
      type: String,
      trim: true,
      default: null
    }
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('InviteLink', inviteLinkSchema);

