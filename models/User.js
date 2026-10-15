const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    select: false
  },
  authProvider: {
    type: String,
    enum: ['email', 'google', 'apple'],
    default: 'email'
  },
  googleSub: {
    type: String,
    trim: true
  },
  appleSub: {
    type: String,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  gender: {
    type: String,
    enum: ['Male', 'Female', 'Other'],
    trim: true
  },
  dob: {
    type: Date
  },
  profilePicture: {
    url: {
      type: String,
      trim: true
    },
    publicId: {
      type: String,
      trim: true
    }
  },
  settings: {
    periodStartReminder: { type: Boolean, default: false },
    cycleInsightWeekly: { type: Boolean, default: false },
    language: { type: String, default: 'English' }
  },
  personalization: {
    lastPeriodStartDate: { type: Date },
    averageMenstrualCycleLength: { type: String },
    averagePeriodDuration: { type: Number }
  },
  IsDeleted: {
    type: Boolean,
    default: false
  },
  DeletedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Create partial unique index on email for non-deleted users only
userSchema.index(
  { email: 1 },
  {
    unique: true,
    partialFilterExpression: { IsDeleted: { $ne: true } }
  }
);

userSchema.index({ googleSub: 1 }, { unique: true, sparse: true });
userSchema.index({ appleSub: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('User', userSchema);
