const mongoose = require('mongoose');

const otpVerificationSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    trim: true,
    lowercase: true
  },
  otp: {
    type: String,
    required: [true, 'OTP is required'],
    length: [6, 'OTP must be exactly 6 digits']
  },
  expiresAt: {
    type: Date,
    required: [true, 'Expiry time is required']
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  isUsed: {
    type: Boolean,
    default: false
  },
  attempts: {
    type: Number,
    default: 0
  },
  maxAttempts: {
    type: Number,
    default: 3
  },
  otpType: {
    type: String,
    enum: ['registration', 'reset-password'],
    required: [true, 'OTP type is required']
  }
}, {
  timestamps: true
});

// Index for efficient queries
otpVerificationSchema.index({ email: 1, createdAt: -1 });
otpVerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Method to check if OTP is expired
otpVerificationSchema.methods.isExpired = function() {
  return new Date() > this.expiresAt;
};

// Method to check if OTP is valid (not expired and not used)
otpVerificationSchema.methods.isValid = function() {
  return !this.isExpired() && !this.isUsed && this.attempts < this.maxAttempts;
};

// Method to increment attempts
otpVerificationSchema.methods.incrementAttempts = function() {
  this.attempts += 1;
  return this.save();
};

// Method to mark as verified
otpVerificationSchema.methods.markAsVerified = function() {
  this.isVerified = true;
  this.isUsed = true;
  return this.save();
};

module.exports = mongoose.model('OtpVerification', otpVerificationSchema); 