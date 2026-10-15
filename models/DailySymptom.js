const mongoose = require('mongoose');

const dailySymptomSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  date: {
    type: Date,
    required: [true, 'Date is required']
  },
  symptoms: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Symptom',
    required: [true, 'Symptom is required']
  }]
}, {
  timestamps: true
});

// Compound index to ensure one entry per user per day
dailySymptomSchema.index({ userId: 1, date: 1 }, { unique: true });

// Virtual for formatted date (YYYY-MM-DD)
dailySymptomSchema.virtual('formattedDate').get(function() {
  return this.date.toISOString().split('T')[0];
});

// Method to check if entry is from today (user's local time)
dailySymptomSchema.methods.isFromToday = function(userTimezone = 'UTC') {
  const now = new Date();
  const userDate = new Date(now.toLocaleString('en-US', { timeZone: userTimezone }));
  const entryDate = new Date(this.date.toLocaleString('en-US', { timeZone: userTimezone }));
  
  return userDate.toDateString() === entryDate.toDateString();
};

// Method to check if entry can be modified (same day)
dailySymptomSchema.methods.canBeModified = function(userTimezone = 'UTC') {
  return this.isFromToday(userTimezone);
};

// Static method to get today's date in user's timezone
dailySymptomSchema.statics.getTodayDate = function(userTimezone = 'UTC') {
  const now = new Date();
  
  // Get today's date string in user's timezone (YYYY-MM-DD)
  const todayString = now.toLocaleDateString('en-CA', { timeZone: userTimezone });
  
  // Create the date by parsing the date string and setting it to midnight
  // This ensures the date represents the correct day in the user's timezone
  const [year, month, day] = todayString.split('-').map(Number);
  
  // Create a new Date object with the user's local date
  // This approach avoids timezone conversion issues
  const userDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  
  return userDate;
};

// Static method to get start and end of day for a given date in user's timezone
dailySymptomSchema.statics.getDayBoundaries = function(date, userTimezone = 'UTC') {
  // Create a date object for the target date
  const targetDate = new Date(date);
  
  // Get the date string in user's timezone (YYYY-MM-DD)
  const dateString = targetDate.toLocaleDateString('en-CA', { timeZone: userTimezone }); // en-CA gives YYYY-MM-DD format
  
  // Parse the date string to get year, month, and day
  const [year, month, day] = dateString.split('-').map(Number);
  
  // Create start of day in user's timezone using the same approach as getTodayDate
  const startOfDay = new Date(year, month - 1, day, 0, 0, 0, 0);
  
  // Create end of day in user's timezone
  const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);
  
  return { startOfDay, endOfDay };
};

module.exports = mongoose.model('DailySymptom', dailySymptomSchema);
