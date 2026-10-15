// Debug script to check user's cycle data
// Run this with: node debug-cycle-data.js

const mongoose = require('mongoose');
const User = require('./models/User');
const MenstrualCycle = require('./models/MenstrualCycle');

// Replace with your actual MongoDB connection string
const MONGODB_URI = 'your-mongodb-connection-string';

async function debugUserCycleData(userId) {
  try {
    await mongoose.connect(MONGODB_URI);
    
    console.log('=== USER DATA ===');
    const user = await User.findById(userId);
    if (!user) {
      console.log('User not found');
      return;
    }
    
    console.log('User ID:', user._id);
    console.log('Last Period Start Date:', user.personalization?.lastPeriodStartDate);
    console.log('Average Period Duration:', user.personalization?.averagePeriodDuration, '(type:', typeof user.personalization?.averagePeriodDuration, ')');
    console.log('Average Cycle Length:', user.personalization?.averageMenstrualCycleLength, '(type:', typeof user.personalization?.averageMenstrualCycleLength, ')');
    
    console.log('\n=== EXISTING CYCLES ===');
    const cycles = await MenstrualCycle.find({ userId }).sort({ cycleNumber: 1 });
    
    cycles.forEach(cycle => {
      console.log(`\nCycle #${cycle.cycleNumber}:`);
      console.log('  Status:', cycle.status);
      console.log('  Start Date:', cycle.lastPeriodStartDate);
      console.log('  End Date:', cycle.cycleEndDate);
      console.log('  Current Phase:', cycle.currentPhase);
      console.log('  Days Remaining:', cycle.daysRemainingInCycle);
    });
    
    console.log('\n=== CALCULATION SIMULATION ===');
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    
    const lastPeriodStartDate = new Date(user.personalization.lastPeriodStartDate);
    lastPeriodStartDate.setUTCHours(0, 0, 0, 0);
    
    const averagePeriodDuration = parseInt(user.personalization.averagePeriodDuration) || 5;
    const averageMenstrualCycleLength = parseInt(user.personalization.averageMenstrualCycleLength) || 28;
    
    console.log('Today (normalized):', today.toISOString().split('T')[0]);
    console.log('Last Period Start:', lastPeriodStartDate.toISOString().split('T')[0]);
    console.log('Average Period Duration:', averagePeriodDuration);
    console.log('Average Cycle Length:', averageMenstrualCycleLength);
    
    // Calculate cycle end date
    const cycleEndDate = new Date(lastPeriodStartDate.getTime() + (averageMenstrualCycleLength - 1) * 24 * 60 * 60 * 1000);
    cycleEndDate.setUTCHours(0, 0, 0, 0);
    
    console.log('Calculated Cycle End Date:', cycleEndDate.toISOString().split('T')[0]);
    console.log('Cycle has ended?', cycleEndDate.toISOString().split('T')[0] <= today.toISOString().split('T')[0]);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

// Usage: Replace 'USER_ID_HERE' with actual user ID
// debugUserCycleData('USER_ID_HERE');

module.exports = { debugUserCycleData };
