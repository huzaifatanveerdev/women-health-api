const mongoose = require('mongoose');

const menstrualCycleSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  cycleNumber: {
    type: Number,
    required: true
  },
  lastPeriodStartDate: {
    type: Date,
    required: true
  },
  averagePeriodDuration: {
    type: Number,
    required: true
  },
  averageMenstrualCycleLength: {
    type: Number,
    required: true
  },
  // Calculated dates
  periodEndDate: {
    type: Date,
    required: true
  },
  cycleEndDate: {
    type: Date,
    required: true
  },
  // Phase dates
  menstrualPhaseStartDate: {
    type: Date,
    required: true
  },
  menstrualPhaseEndDate: {
    type: Date,
    required: true
  },
  ovulationDate: {
    type: Date,
    required: true
  },
  fertileWindowStartDate: {
    type: Date,
    required: true
  },
  fertileWindowEndDate: {
    type: Date,
    required: true
  },
  follicularPhaseStartDate: {
    type: Date,
    required: true
  },
  follicularPhaseEndDate: {
    type: Date,
    required: true
  },
  lutealPhaseStartDate: {
    type: Date,
    required: true
  },
  lutealPhaseEndDate: {
    type: Date,
    required: true
  },
  nextPeriodStartDate: {
    type: Date,
    required: true
  },
  // Current phase information
  currentPhase: {
    type: String,
    enum: ['Menstrual Phase', 'Follicular Phase', 'Ovulation Day', 'Ovulatory Phase', 'Luteal Phase'],
    default: null
  },
  daysRemainingInCycle: {
    type: Number,
    default: null
  },
  nextPeriodIn: {
    type: Number,
    default: null
  },
  // Cycle status
  status: {
    type: String,
    enum: ['OnGoing', 'Completed', 'UpComing'],
    default: 'OnGoing'
  },
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for efficient queries
menstrualCycleSchema.index({ userId: 1, status: 1 });
menstrualCycleSchema.index({ userId: 1, cycleNumber: 1 });

module.exports = mongoose.model('MenstrualCycle', menstrualCycleSchema);
