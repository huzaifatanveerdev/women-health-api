const MenstrualCycle = require('../models/MenstrualCycle');
const User = require('../models/User');
const { ValidationError, DatabaseError } = require('../utils/errors');
const { getLocalizedMessage } = require('../utils/localization');

/**
 * Helper function to format date without time
 */
/*
const formatDateOnly = (date) => {
  const newDate = new Date(date);
  newDate.setHours(0, 0, 0, 0);
  return newDate;
};
*/

const formatDateOnly = (date) => {
    const newDate = new Date(date);
    newDate.setUTCHours(0, 0, 0, 0); // 🔑 reset to midnight UTC
    return newDate;
  };

function getDateOnly(date) {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0); // force to midnight UTC
    return d;
  }

/**
 * Calculate and save menstrual cycle information
 */
const calculateAndSaveMenstrualCycle = async (userId, language = 'en') => {
  try {
    // Get user
    const user = await User.findById(userId);
    if (!user) {
      throw new ValidationError('User not found');
    }

    // Check if required fields exist
    if (!user.personalization?.lastPeriodStartDate) {
      return {
        success: false,
        message: getLocalizedMessage('no.period.date', language),
        data: null
      };
    }

    // Check if there's already an "OnGoing" cycle for this user
    const existingOnGoingCycle = await MenstrualCycle.findOne({ 
      userId, 
      status: 'OnGoing' 
    });

    if (existingOnGoingCycle) {
      console.log('Found existing OnGoing cycle, updating instead of creating new one');
      
      // Get values from user.personalization
      const lastPeriodStartDate = formatDateOnly(new Date(user.personalization.lastPeriodStartDate));
      const averagePeriodDuration = user.personalization.averagePeriodDuration || 5;
      const averageMenstrualCycleLength = user.personalization.averageMenstrualCycleLength || 28;
      //const today = formatDateOnly(new Date('2025-09-28T00:00:00.000+00:00')); // Test date for future testing
      const today = formatDateOnly(new Date());

      // Calculate all dates for the existing cycle
      const periodEndDate = formatDateOnly(new Date(lastPeriodStartDate.getTime() + (averagePeriodDuration - 1) * 24 * 60 * 60 * 1000));
      const cycleEndDate = formatDateOnly(new Date(lastPeriodStartDate.getTime() + (averageMenstrualCycleLength - 1) * 24 * 60 * 60 * 1000));
      
      // Check if the existing cycle has ended
      if (cycleEndDate < today) {
        // Cycle has ended, mark as completed
        await MenstrualCycle.findByIdAndUpdate(existingOnGoingCycle._id, {
          status: 'Completed',
          currentPhase: null,
          daysRemainingInCycle: null,
          nextPeriodIn: null
        });

        console.log(`Existing cycle ${existingOnGoingCycle.cycleNumber} marked as completed. Cycle end date: ${cycleEndDate.toISOString().split('T')[0]}`);

        // Update user's lastPeriodStartDate for next cycle calculation
        const nextPeriodStartDate = formatDateOnly(new Date(cycleEndDate.getTime() + 1 * 24 * 60 * 60 * 1000));
        await User.findByIdAndUpdate(userId, {
          'personalization.lastPeriodStartDate': nextPeriodStartDate
        });

        console.log(`Updated user's lastPeriodStartDate to: ${nextPeriodStartDate.toISOString().split('T')[0]}`);

        // Now proceed with normal cycle calculation logic
        return await calculateAndSaveMenstrualCycle(userId);
      } else {
        // Cycle is still ongoing, just update the current phase and remaining days
        const nextPeriodStartDate = formatDateOnly(new Date(cycleEndDate.getTime() + 1 * 24 * 60 * 60 * 1000));
        const daysRemainingInCycle = Math.ceil((cycleEndDate - today) / (24 * 60 * 60 * 1000));
        const nextPeriodIn = Math.ceil((nextPeriodStartDate - today) / (24 * 60 * 60 * 1000));
        
        // Determine current phase
        let currentPhase = null;
        const menstrualPhaseStartDate = formatDateOnly(new Date(lastPeriodStartDate));
        const menstrualPhaseEndDate = formatDateOnly(new Date(periodEndDate));
        
        const ovulationDate = formatDateOnly(new Date(lastPeriodStartDate.getTime() + 13 * 24 * 60 * 60 * 1000));
        const fertileWindowStartDate = formatDateOnly(new Date(ovulationDate.getTime() - 2 * 24 * 60 * 60 * 1000));
        const fertileWindowEndDate = formatDateOnly(new Date(ovulationDate.getTime() + 2 * 24 * 60 * 60 * 1000));
        
        const follicularPhaseStartDate = formatDateOnly(new Date(periodEndDate.getTime() + 1 * 24 * 60 * 60 * 1000));
        const follicularPhaseEndDate = formatDateOnly(new Date(ovulationDate.getTime() - 1 * 24 * 60 * 60 * 1000));
        
        const lutealPhaseStartDate = formatDateOnly(new Date(fertileWindowEndDate.getTime() + 1 * 24 * 60 * 60 * 1000));
        const lutealPhaseEndDate = formatDateOnly(new Date(cycleEndDate.getTime()));

        if (today >= menstrualPhaseStartDate && today <= menstrualPhaseEndDate) {
          currentPhase = 'Menstrual Phase';
        } else if (today >= fertileWindowStartDate && today <= fertileWindowEndDate) {
          currentPhase = 'Ovulatory Phase';
        } else if (today.toISOString().split('T')[0] === ovulationDate.toISOString().split('T')[0]) {
          currentPhase = 'Ovulation Day';
        } else if (today >= follicularPhaseStartDate && today <= follicularPhaseEndDate) {
          currentPhase = 'Follicular Phase';
        } else if (today >= lutealPhaseStartDate && today <= lutealPhaseEndDate) {
          currentPhase = 'Luteal Phase';
        }

        // Update the existing cycle with new phase information
        await MenstrualCycle.findByIdAndUpdate(existingOnGoingCycle._id, {
          currentPhase,
          daysRemainingInCycle,
          nextPeriodIn
        });

        console.log(`Updated existing cycle ${existingOnGoingCycle.cycleNumber} with current phase: ${currentPhase}`);

        // Calculate and save future cycles for the next 3 months
        try {
          await calculateAndSaveFutureCycles(userId, cycleEndDate, existingOnGoingCycle.cycleNumber, averagePeriodDuration, averageMenstrualCycleLength);
        } catch (futureCycleError) {
          console.error('Error creating future cycles:', futureCycleError);
          // Don't fail the entire operation if future cycles fail
        }

        // Return the updated cycle
        const updatedCycle = await MenstrualCycle.findById(existingOnGoingCycle._id);
        return {
          success: true,
          message: 'Existing cycle updated successfully.',
          data: {
            currentCycle: updatedCycle,
            completedCycles: 0,
            totalCyclesProcessed: 1
          }
        };
      }
    }

    // Get values from user.personalization
    let lastPeriodStartDate = formatDateOnly(new Date(user.personalization.lastPeriodStartDate));
    const averagePeriodDuration = user.personalization.averagePeriodDuration || 5;
    const averageMenstrualCycleLength = user.personalization.averageMenstrualCycleLength || 28;
    //const today = formatDateOnly(new Date('2025-09-28T00:00:00.000+00:00')); // Test date for future testing
    const today = formatDateOnly(new Date());

    console.log("Input values:", {
      lastPeriodStartDate: lastPeriodStartDate.toISOString().split('T')[0],
      averagePeriodDuration,
      averageMenstrualCycleLength,
      today: today.toISOString().split('T')[0]
    });

    // Get next cycle number
    const lastCycle = await MenstrualCycle.findOne({ userId }).sort({ cycleNumber: -1 });
    let cycleNumber = lastCycle ? lastCycle.cycleNumber + 1 : 1;

    let currentCycle = null;
    let completedCycles = [];

    // Keep calculating cycles until we find one that's current (cycleEndDate > today)
    while (true) {
      // Calculate all dates for this cycle
      const periodEndDate = formatDateOnly(new Date(lastPeriodStartDate.getTime() + (averagePeriodDuration - 1) * 24 * 60 * 60 * 1000));
      const cycleEndDate = formatDateOnly(new Date(lastPeriodStartDate.getTime() + (averageMenstrualCycleLength - 1) * 24 * 60 * 60 * 1000));
      
      // Phase dates
      const menstrualPhaseStartDate = formatDateOnly(new Date(lastPeriodStartDate));
      const menstrualPhaseEndDate = formatDateOnly(new Date(periodEndDate));
      
      const ovulationDate = formatDateOnly(new Date(lastPeriodStartDate.getTime() + 13 * 24 * 60 * 60 * 1000));
      const fertileWindowStartDate = formatDateOnly(new Date(ovulationDate.getTime() - 2 * 24 * 60 * 60 * 1000));
      const fertileWindowEndDate = formatDateOnly(new Date(ovulationDate.getTime() + 2 * 24 * 60 * 60 * 1000));
      
      const follicularPhaseStartDate = formatDateOnly(new Date(periodEndDate.getTime() + 1 * 24 * 60 * 60 * 1000));
      const follicularPhaseEndDate = formatDateOnly(new Date(ovulationDate.getTime() - 1 * 24 * 60 * 60 * 1000));
      
      const lutealPhaseStartDate = formatDateOnly(new Date(fertileWindowEndDate.getTime() + 1 * 24 * 60 * 60 * 1000));
      const lutealPhaseEndDate = formatDateOnly(new Date(cycleEndDate.getTime()));
      
      const nextPeriodStartDate = formatDateOnly(new Date(cycleEndDate.getTime() + 1 * 24 * 60 * 60 * 1000));

      // Check if this cycle has ended
      if (cycleEndDate < today) {
        // Cycle has ended, mark as completed
        const completedCycle = new MenstrualCycle({
          userId,
          cycleNumber,
          lastPeriodStartDate,
          averagePeriodDuration,
          averageMenstrualCycleLength,
          periodEndDate,
          cycleEndDate,
          menstrualPhaseStartDate,
          menstrualPhaseEndDate,
          ovulationDate,
          fertileWindowStartDate,
          fertileWindowEndDate,
          follicularPhaseStartDate,
          follicularPhaseEndDate,
          lutealPhaseStartDate,
          lutealPhaseEndDate,
          nextPeriodStartDate,
          currentPhase: null,
          daysRemainingInCycle: null,
          nextPeriodIn: null,
          status: 'Completed'
        });

        await completedCycle.save();
        completedCycles.push(completedCycle);
        
        console.log(`Cycle ${cycleNumber} completed and saved. Cycle end date: ${cycleEndDate.toISOString().split('T')[0]}`);

        // Update lastPeriodStartDate for next cycle calculation
        lastPeriodStartDate = nextPeriodStartDate;
        cycleNumber++;

        // Continue to next cycle
        continue;
      } else {
        // This cycle is current/ongoing
        const daysRemainingInCycle = Math.ceil((cycleEndDate - today) / (24 * 60 * 60 * 1000));
        const nextPeriodIn = Math.ceil((nextPeriodStartDate - today) / (24 * 60 * 60 * 1000));
        
        // Determine current phase
        let currentPhase = null;
        if (today >= menstrualPhaseStartDate && today <= menstrualPhaseEndDate) {
          currentPhase = 'Menstrual Phase';
        } else if (today >= fertileWindowStartDate && today <= fertileWindowEndDate) {
          currentPhase = 'Ovulatory Phase';
        } else if (today.toISOString().split('T')[0] === ovulationDate.toISOString().split('T')[0]) {
          currentPhase = 'Ovulation Day';
        } else if (today >= follicularPhaseStartDate && today <= follicularPhaseEndDate) {
          currentPhase = 'Follicular Phase';
        } else if (today >= lutealPhaseStartDate && today <= lutealPhaseEndDate) {
          currentPhase = 'Luteal Phase';
        }

        // Create current cycle record
        currentCycle = new MenstrualCycle({
          userId,
          cycleNumber,
          lastPeriodStartDate,
          averagePeriodDuration,
          averageMenstrualCycleLength,
          periodEndDate,
          cycleEndDate,
          menstrualPhaseStartDate,
          menstrualPhaseEndDate,
          ovulationDate,
          fertileWindowStartDate,
          fertileWindowEndDate,
          follicularPhaseStartDate,
          follicularPhaseEndDate,
          lutealPhaseStartDate,
          lutealPhaseEndDate,
          nextPeriodStartDate,
          currentPhase,
          daysRemainingInCycle,
          nextPeriodIn,
          status: 'OnGoing'
        });

        await currentCycle.save();
        console.log(`Current cycle ${cycleNumber} calculated and saved. Cycle end date: ${cycleEndDate.toISOString().split('T')[0]}`);
        
        // Calculate and save future cycles for the next 3 months
        try {
          await calculateAndSaveFutureCycles(userId, cycleEndDate, cycleNumber, averagePeriodDuration, averageMenstrualCycleLength);
        } catch (futureCycleError) {
          console.error('Error creating future cycles:', futureCycleError);
          // Don't fail the entire operation if future cycles fail
        }
        
        // Break out of the loop since we found the current cycle
        break;
      }
    }

    // Update user's lastPeriodStartDate to the start of the current cycle
    await User.findByIdAndUpdate(userId, {
      'personalization.lastPeriodStartDate': lastPeriodStartDate
    });

    console.log(`Updated user's lastPeriodStartDate to: ${lastPeriodStartDate.toISOString().split('T')[0]}`);

    // Calculate and update user's averages from last 4 cycles
    const updatedAverages = await calculateAndUpdateUserAverages(userId);
    console.log(`Updated user averages - Period Duration: ${updatedAverages.averagePeriodDuration}, Cycle Length: ${updatedAverages.averageMenstrualCycleLength}`);

    // Prepare response message
    let message = 'Menstrual cycle calculated and saved successfully.';
    if (completedCycles.length > 0) {
      message = `Processed ${completedCycles.length} completed cycle(s) and calculated current cycle.`;
    }

    return {
      success: true,
      message,
      data: {
        currentCycle,
        completedCycles: completedCycles.length,
        totalCyclesProcessed: completedCycles.length + 1
      }
    };

  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new DatabaseError('Failed to calculate and save menstrual cycle');
  }
};

/**
 * Get current menstrual cycle for a user
 */
const getCurrentMenstrualCycle = async (userId) => {
  try {
    let currentCycle = await MenstrualCycle.findOne({ 
      userId, 
      status: 'OnGoing' 
    }).sort({ cycleNumber: -1 });
    
    // If no current cycle exists, calculate one
    if (!currentCycle) {
      console.log('No current cycle found, calculating...');
      const result = await calculateAndSaveMenstrualCycle(userId);
      if (result.success && result.data.currentCycle) {
        currentCycle = result.data.currentCycle;
      }
    }
    
    return currentCycle;
  } catch (error) {
    throw new DatabaseError('Failed to retrieve current menstrual cycle');
  }
};

/**
 * Get cycle history for a user
 */
const getCycleHistory = async (userId) => {
  try {
    const cycles = await MenstrualCycle.find({ userId })
      .sort({ cycleNumber: 1 })
      .select('-__v');
    
    return {
      success: true,
      data: cycles
    };
  } catch (error) {
    throw new DatabaseError('Failed to retrieve cycle history');
  }
};

/**
 * List Completed and OnGoing cycles for insights (excludes UpComing).
 * Newest first. No date filter.
 */
const getActiveCyclesList = async (userId) => {
  try {
    const cycles = await MenstrualCycle.find({
      userId,
      status: { $in: ['OnGoing', 'Completed'] }
    })
      .sort({ lastPeriodStartDate: -1 })
      .lean();

    return {
      cycles: cycles.map((cycle) => ({
        cycleId: cycle._id.toString(),
        cycleNumber: cycle.cycleNumber,
        status: cycle.status,
        cycleMonth: {
          startDate: formatDateOnly(cycle.lastPeriodStartDate).toISOString().split('T')[0],
          endDate: formatDateOnly(cycle.cycleEndDate).toISOString().split('T')[0]
        }
      }))
    };
  } catch (error) {
    throw new DatabaseError('Failed to retrieve menstrual cycles');
  }
};

const CYCLE_LENGTH_MIN = 21;
const CYCLE_LENGTH_MAX = 35;

const buildCycleSummaryFields = (cycle) => ({
  startDate: formatDateOnly(cycle.lastPeriodStartDate).toISOString().split('T')[0],
  endDate: formatDateOnly(cycle.cycleEndDate).toISOString().split('T')[0],
  cycleLength: cycle.averageMenstrualCycleLength,
  periodLength: cycle.averagePeriodDuration
});

const isCycleLengthInNormalRange = (cycleLength) =>
  cycleLength >= CYCLE_LENGTH_MIN && cycleLength <= CYCLE_LENGTH_MAX;

const buildCyclesAnalysis = (completedCycles, language = 'en') => {
  const totalCompleted = completedCycles.length;
  const outsideRangeCount = completedCycles.filter(
    (cycle) => !isCycleLengthInNormalRange(cycle.averageMenstrualCycleLength)
  ).length;

  const summary =
    outsideRangeCount === 0
      ? getLocalizedMessage('cycle.analysis.all.in.range', language, { n: totalCompleted })
      : getLocalizedMessage('cycle.analysis.some.out.of.range', language, {
          x: outsideRangeCount,
          n: totalCompleted
        });

  return { summary };
};

/**
 * Cycle summary for insights overview (ongoing cycle when present, otherwise most recent completed)
 */
const getCycleSummary = async (userId, language = 'en') => {
  try {
    const [completedCycles, ongoingCycle] = await Promise.all([
      MenstrualCycle.find({
        userId,
        status: 'Completed'
      })
        .sort({ lastPeriodStartDate: -1 })
        .lean(),
      MenstrualCycle.findOne({
        userId,
        status: 'OnGoing'
      }).lean()
    ]);

    if (ongoingCycle) {
      const result = {
        cycleSummary: {
          ...buildCycleSummaryFields(ongoingCycle),
          status: ongoingCycle.status,
          cyclesAnalysed: completedCycles.length + 1,
          summary: getLocalizedMessage('cycle.summary.in.progress', language)
        }
      };

      if (completedCycles.length > 0) {
        result.cyclesAnalysis = buildCyclesAnalysis(completedCycles, language);
      }

      return result;
    }

    if (completedCycles.length > 0) {
      const [mostRecentCompletedCycle] = completedCycles;

      return {
        cycleSummary: {
          ...buildCycleSummaryFields(mostRecentCompletedCycle),
          status: mostRecentCompletedCycle.status,
          cyclesAnalysed: completedCycles.length
        },
        cyclesAnalysis: buildCyclesAnalysis(completedCycles, language)
      };
    }

    return null;
  } catch (error) {
    throw new DatabaseError('Failed to retrieve cycle summary');
  }
};

/**
 * Calculate new average period duration based on current and previous cycles
 */
const calculateNewAveragePeriodDuration = async (userId, currentPeriodDuration) => {
  try {
    console.log(`Calculating new average period duration for userId: ${userId}, currentPeriodDuration: ${currentPeriodDuration}`);
    
    // Get the current cycle and up to 2 previous cycles
    const recentCycles = await MenstrualCycle.find({ 
      userId, 
      status: 'Completed' 
    })
    .sort({ cycleNumber: -1 })
    .limit(2)
    .select('averagePeriodDuration');

    console.log(`Found ${recentCycles.length} completed cycles for averaging`);

    // Start with the current period duration
    let totalDuration = currentPeriodDuration;
    let cycleCount = 1;

    // Add previous cycle durations if available
    recentCycles.forEach((cycle, index) => {
      if (cycle.averagePeriodDuration) {
        console.log(`Adding cycle ${index + 1} duration: ${cycle.averagePeriodDuration}`);
        totalDuration += cycle.averagePeriodDuration;
        cycleCount++;
      }
    });

    // Calculate average and round to nearest whole number
    const newAverage = Math.round(totalDuration / cycleCount);
    
    console.log(`Calculated average: ${totalDuration} total days / ${cycleCount} cycles = ${newAverage} days`);
    
    return newAverage;
  } catch (error) {
    console.error('Error calculating new average period duration:', error);
    // Return the current cycle duration as fallback
    return currentPeriodDuration;
  }
};


/**
 * Update the previous cycle's averageMenstrualCycleLength when current period start date changes
 */
const updatePreviousCycleLength = async (userId, currentCycleNumber, newStartDate) => {
  try {
    console.log(`Updating previous cycle length for userId: ${userId}, currentCycleNumber: ${currentCycleNumber}`);
    
    // Get the previous cycle (currentCycleNumber - 1)
    const previousCycle = await MenstrualCycle.findOne({ 
      userId, 
      cycleNumber: currentCycleNumber - 1 
    });

    if (!previousCycle) {
      console.log(`No previous cycle found for cycle number ${currentCycleNumber - 1}`);
      return;
    }

    // Calculate the new cycle length for the previous cycle
    const previousCycleStartDate = formatDateOnly(new Date(previousCycle.lastPeriodStartDate));
    const newPreviousCycleEndDate = formatDateOnly(new Date(newStartDate.getTime() - 1 * 24 * 60 * 60 * 1000));
    
    const newPreviousCycleLength = Math.ceil((newPreviousCycleEndDate - previousCycleStartDate) / (24 * 60 * 60 * 1000)) + 1;

    // Validate the new cycle length (should be between 20-45 days)
    if (newPreviousCycleLength < 20 || newPreviousCycleLength > 45) {
      console.log(`Calculated previous cycle length ${newPreviousCycleLength} is outside reasonable range (20-45), keeping current value: ${previousCycle.averageMenstrualCycleLength}`);
      return;
    }

    // Update the previous cycle's averageMenstrualCycleLength
    await MenstrualCycle.findByIdAndUpdate(previousCycle._id, {
      averageMenstrualCycleLength: newPreviousCycleLength,
      cycleEndDate: newPreviousCycleEndDate,
      nextPeriodStartDate: newStartDate
    });

    console.log(`Updated previous cycle ${previousCycle.cycleNumber} length from ${previousCycle.averageMenstrualCycleLength} to ${newPreviousCycleLength} days`);

  } catch (error) {
    console.error('Error updating previous cycle length:', error);
    // Don't throw error to avoid breaking the main operation
  }
};

/**
 * Calculate new average cycle length from last 3 cycles
 */
const calculateNewAverageCycleLength = async (userId, currentCycleLength) => {
  try {
    console.log(`Calculating new average cycle length for userId: ${userId}, currentCycleLength: ${currentCycleLength}`);
    
    // Get the last 3 COMPLETED cycles for this user (exclude current cycle)
    const recentCycles = await MenstrualCycle.find({ 
      userId,
      status: 'Completed'  // Only get completed cycles
    })
    .sort({ cycleNumber: -1 })
    .limit(3)
    .select('averageMenstrualCycleLength');

    console.log(`Found ${recentCycles.length} completed cycles for averaging cycle length`);

    if (recentCycles.length === 0) {
      console.log('No completed cycles found for averaging cycle length, using current value');
      return currentCycleLength;
    }

    // Calculate average cycle length from completed cycles only
    let totalCycleLength = 0;
    let cycleCount = 0;

    recentCycles.forEach((cycle, index) => {
      if (cycle.averageMenstrualCycleLength && cycle.averageMenstrualCycleLength > 0 && cycle.averageMenstrualCycleLength < 100) {
        console.log(`Adding completed cycle ${index + 1} length: ${cycle.averageMenstrualCycleLength}`);
        totalCycleLength += cycle.averageMenstrualCycleLength;
        cycleCount++;
      }
    });

    // If no valid cycles found, return current value
    if (cycleCount === 0) {
      console.log('No valid completed cycles found, using current value');
      return currentCycleLength;
    }

    // Calculate average and round to nearest whole number
    const newAverage = Math.round(totalCycleLength / cycleCount);
    
    console.log(`Calculated average cycle length: ${totalCycleLength} total days / ${cycleCount} cycles = ${newAverage} days`);

    return newAverage;
  } catch (error) {
    console.error('Error calculating new average cycle length:', error);
    // Return the current cycle length as fallback
    return currentCycleLength;
  }
};

/**
 * Delete existing future cycles for a user
 */
const deleteExistingFutureCycles = async (userId) => {
  try {
    console.log(`Deleting existing future cycles for userId: ${userId}`);
    
    const deleteResult = await MenstrualCycle.deleteMany({ 
      userId, 
      status: 'UpComing' 
    });
    
    console.log(`Deleted ${deleteResult.deletedCount} existing future cycles`);
    return deleteResult.deletedCount;
  } catch (error) {
    console.error('Error deleting existing future cycles:', error);
    throw new DatabaseError('Failed to delete existing future cycles');
  }
};

/**
 * Recalculate and save future cycles for the next 3 months
 */
const recalculateFutureCycles = async (userId, currentCycleEndDate, cycleNumber, averagePeriodDuration, averageMenstrualCycleLength) => {
  try {
    console.log(`Recalculating future cycles for userId: ${userId}`);
    
    // Delete existing future cycles
    await deleteExistingFutureCycles(userId);
    
    // Create new future cycles with updated parameters
    const futureCycles = await calculateAndSaveFutureCycles(userId, currentCycleEndDate, cycleNumber, averagePeriodDuration, averageMenstrualCycleLength);
    
    console.log(`Successfully recalculated ${futureCycles.length} future cycles`);
    return futureCycles;
  } catch (error) {
    console.error('Error recalculating future cycles:', error);
    throw new DatabaseError('Failed to recalculate future cycles');
  }
};

/**
 * Calculate and save future cycles for the next 3 months
 */
const calculateAndSaveFutureCycles = async (userId, currentCycleEndDate, cycleNumber, averagePeriodDuration, averageMenstrualCycleLength) => {
  try {
    console.log(`Calculating future cycles for userId: ${userId}`);
    
    // Check if future cycles already exist for this user
    const existingFutureCycles = await MenstrualCycle.find({ 
      userId, 
      status: 'UpComing' 
    }).sort({ cycleNumber: 1 });
    
    if (existingFutureCycles.length >= 3) {
      console.log(`Future cycles already exist for user ${userId}, skipping creation`);
      return existingFutureCycles;
    }
    
    let futureCycleStartDate = formatDateOnly(new Date(currentCycleEndDate.getTime() + 1 * 24 * 60 * 60 * 1000));
    let futureCycleNumber = cycleNumber + 1;
    const futureCycles = [];

    // Calculate missing future cycles (up to 3 total)
    const cyclesToCreate = 3 - existingFutureCycles.length;
    
    // If there are existing future cycles, adjust the start date and cycle number
    if (existingFutureCycles.length > 0) {
      const lastExistingCycle = existingFutureCycles[existingFutureCycles.length - 1];
      futureCycleStartDate = formatDateOnly(new Date(lastExistingCycle.nextPeriodStartDate));
      futureCycleNumber = lastExistingCycle.cycleNumber + 1;
    }
    for (let i = 0; i < cyclesToCreate; i++) {
      // Calculate all dates for this future cycle
      const periodEndDate = formatDateOnly(new Date(futureCycleStartDate.getTime() + (averagePeriodDuration - 1) * 24 * 60 * 60 * 1000));
      const cycleEndDate = formatDateOnly(new Date(futureCycleStartDate.getTime() + (averageMenstrualCycleLength - 1) * 24 * 60 * 60 * 1000));
      
      // Phase dates
      const menstrualPhaseStartDate = formatDateOnly(new Date(futureCycleStartDate));
      const menstrualPhaseEndDate = formatDateOnly(new Date(periodEndDate));
      
      const ovulationDate = formatDateOnly(new Date(futureCycleStartDate.getTime() + 13 * 24 * 60 * 60 * 1000));
      const fertileWindowStartDate = formatDateOnly(new Date(ovulationDate.getTime() - 2 * 24 * 60 * 60 * 1000));
      const fertileWindowEndDate = formatDateOnly(new Date(ovulationDate.getTime() + 2 * 24 * 60 * 60 * 1000));
      
      const follicularPhaseStartDate = formatDateOnly(new Date(periodEndDate.getTime() + 1 * 24 * 60 * 60 * 1000));
      const follicularPhaseEndDate = formatDateOnly(new Date(ovulationDate.getTime() - 1 * 24 * 60 * 60 * 1000));
      
      const lutealPhaseStartDate = formatDateOnly(new Date(fertileWindowEndDate.getTime() + 1 * 24 * 60 * 60 * 1000));
      const lutealPhaseEndDate = formatDateOnly(new Date(cycleEndDate.getTime()));
      
      const nextPeriodStartDate = formatDateOnly(new Date(cycleEndDate.getTime() + 1 * 24 * 60 * 60 * 1000));

      // Create future cycle record
      const futureCycle = new MenstrualCycle({
        userId,
        cycleNumber: futureCycleNumber,
        lastPeriodStartDate: futureCycleStartDate,
        averagePeriodDuration,
        averageMenstrualCycleLength,
        periodEndDate,
        cycleEndDate,
        menstrualPhaseStartDate,
        menstrualPhaseEndDate,
        ovulationDate,
        fertileWindowStartDate,
        fertileWindowEndDate,
        follicularPhaseStartDate,
        follicularPhaseEndDate,
        lutealPhaseStartDate,
        lutealPhaseEndDate,
        nextPeriodStartDate,
        currentPhase: null, // No current phase for future cycles
        daysRemainingInCycle: null, // Will be calculated when cycle becomes current
        nextPeriodIn: null, // Will be calculated when cycle becomes current
        status: 'UpComing'
      });

      await futureCycle.save();
      futureCycles.push(futureCycle);
      
      console.log(`Future cycle ${futureCycleNumber} calculated and saved. Cycle start date: ${futureCycleStartDate.toISOString().split('T')[0]}`);
      
      // Prepare for next cycle
      futureCycleStartDate = nextPeriodStartDate;
      futureCycleNumber++;
    }

    console.log(`Successfully created ${futureCycles.length} future cycles`);
    return [...existingFutureCycles, ...futureCycles];

  } catch (error) {
    console.error('Error calculating future cycles:', error);
    throw new DatabaseError('Failed to calculate and save future cycles');
  }
};

/**
 * Calculate and update user's averages from last 4 cycles (both completed and current)
 */
const calculateAndUpdateUserAverages = async (userId) => {
  try {
    console.log(`Calculating user averages from last 4 cycles for userId: ${userId}`);
    
    // Get the last 4 cycles (both completed and current) for this user
    const recentCycles = await MenstrualCycle.find({ 
      userId 
    })
    .sort({ cycleNumber: -1 })
    .limit(3)
    .select('averagePeriodDuration averageMenstrualCycleLength');

    console.log(`Found ${recentCycles.length} cycles for averaging`);

    if (recentCycles.length === 0) {
      console.log('No cycles found for averaging');
      return { averagePeriodDuration: 5, averageMenstrualCycleLength: 28 };
    }

    // Calculate averages for both fields
    let totalPeriodDuration = 0;
    let totalCycleLength = 0;
    let validPeriodCount = 0;
    let validCycleCount = 0;

    recentCycles.forEach((cycle, index) => {
      if (cycle.averagePeriodDuration) {
        totalPeriodDuration += cycle.averagePeriodDuration;
        validPeriodCount++;
        console.log(`Adding cycle ${index + 1} period duration: ${cycle.averagePeriodDuration}`);
      }
      
      if (cycle.averageMenstrualCycleLength) {
        totalCycleLength += cycle.averageMenstrualCycleLength;
        validCycleCount++;
        console.log(`Adding cycle ${index + 1} cycle length: ${cycle.averageMenstrualCycleLength}`);
      }
    });

    // Calculate averages and round to nearest whole number
    const newAveragePeriodDuration = validPeriodCount > 0 ? Math.round(totalPeriodDuration / validPeriodCount) : 5;
    const newAverageCycleLength = validCycleCount > 0 ? Math.round(totalCycleLength / validCycleCount) : 28;

    console.log(`Calculated averages - Period Duration: ${totalPeriodDuration} total days / ${validPeriodCount} cycles = ${newAveragePeriodDuration} days`);
    console.log(`Calculated averages - Cycle Length: ${totalCycleLength} total days / ${validCycleCount} cycles = ${newAverageCycleLength} days`);

    // Update user's personalization with new averages
    await User.findByIdAndUpdate(userId, {
      'personalization.averagePeriodDuration': newAveragePeriodDuration,
      'personalization.averageMenstrualCycleLength': newAverageCycleLength
    });

    console.log(`Successfully updated user's personalization averages`);

    return {
      averagePeriodDuration: newAveragePeriodDuration,
      averageMenstrualCycleLength: newAverageCycleLength
    };

  } catch (error) {
    console.error('Error calculating and updating user averages:', error);
    // Return default values as fallback
    return { averagePeriodDuration: 5, averageMenstrualCycleLength: 28 };
  }
};

/**
 * Reset corrupted user personalization values to safe defaults
 */
const resetCorruptedUserValues = async (userId) => {
  try {
    console.log(`Resetting corrupted user values for userId: ${userId}`);
    
    const resetResult = await User.findByIdAndUpdate(userId, {
      'personalization.averagePeriodDuration': 5,
      'personalization.averageMenstrualCycleLength': 28
    });

    if (resetResult) {
      console.log(`Successfully reset user values to defaults`);
      return true;
    } else {
      console.log(`Failed to reset user values`);
      return false;
    }
  } catch (error) {
    console.error('Error resetting corrupted user values:', error);
    return false;
  }
};

/**
 * Calculate and update menstrual cycles (comprehensive endpoint)
 */
const calculateCycle = async (userId) => {
  // ───────────────────────────────────────────────────────────────────────────
  // TEMP-CYCLE-DISABLED — search this tag to revert.
  //
  // Cycle calculation is intentionally short-circuited at the service entry
  // point. The controller (`menstrualCycleController.calculateCycle`) does
  // `res.json(result)`, so returning this benign success-shaped payload makes
  // the client receive HTTP 200 with no error — every existing call site uses
  // `.unwrap()` which only rejects on HTTP / RTK error states, not on a
  // `success: false` flag in the body.
  //
  // To restore normal calculation: delete this entire block (down to the
  // matching `return` below) and the function will resume its original logic.
  // ───────────────────────────────────────────────────────────────────────────
  /*console.warn(`[TEMP-CYCLE-DISABLED] calculateCycle short-circuited for userId: ${userId}`);
  return {
    success: true,
    message: 'Cycle calculation skipped',
    data: null
  };*/
  // ───────────────────────────────────────────────────────────────────────────
  // END TEMP-CYCLE-DISABLED — original implementation continues below.
  // ───────────────────────────────────────────────────────────────────────────

  try {
    console.log(`Starting calculateCycle for userId: ${userId}`);
    
    // Get user
    const user = await User.findById(userId);
    if (!user) {
      throw new ValidationError('User not found');
    }

    // Check if required fields exist
    if (!user.personalization?.lastPeriodStartDate) {
      return {
        success: false,
        message: getLocalizedMessage('no.period.date', language),
        data: null
      };
    }

    //const today = formatDateOnly(new Date('2025-09-28T00:00:00.000+00:00')); // Test date for future testing
    const today = formatDateOnly(new Date());
    console.log(`Today's date: ${today.toISOString().split('T')[0]}`);

    // Check if there's an OnGoing cycle
    const onGoingCycle = await MenstrualCycle.findOne({ 
      userId, 
      status: 'OnGoing' 
    });

    let lastPeriodStartDate;
    if (onGoingCycle) {
      lastPeriodStartDate = formatDateOnly(new Date(onGoingCycle.lastPeriodStartDate));
      console.log(`Found OnGoing cycle, using its start date: ${lastPeriodStartDate.toISOString().split('T')[0]}`);
    } else {
      lastPeriodStartDate = formatDateOnly(new Date(user.personalization.lastPeriodStartDate));
      console.log(`No OnGoing cycle found, using user's lastPeriodStartDate: ${lastPeriodStartDate.toISOString().split('T')[0]}`);
    }

    // Calculate averages from completed and OnGoing cycles (exclude UpComing)
    const cyclesForAveraging = await MenstrualCycle.find({ 
      userId, 
      status: { $in: ['Completed', 'OnGoing'] } 
    }).sort({ cycleNumber: 1 });

    let averagePeriodDuration = user.personalization.averagePeriodDuration || 5;
    let averageMenstrualCycleLength = user.personalization.averageMenstrualCycleLength || 28;

    if (cyclesForAveraging.length > 0) {
      const periodDurations = cyclesForAveraging.map(cycle => cycle.averagePeriodDuration).filter(d => d > 0);
      const cycleLengths = cyclesForAveraging.map(cycle => cycle.averageMenstrualCycleLength).filter(d => d > 0);

      if (periodDurations.length > 0) {
        averagePeriodDuration = Math.round(periodDurations.reduce((sum, d) => sum + d, 0) / periodDurations.length);
      }
      if (cycleLengths.length > 0) {
        averageMenstrualCycleLength = Math.round(cycleLengths.reduce((sum, d) => sum + d, 0) / cycleLengths.length);
      }

      // Update user's personalization with new averages
      await User.findByIdAndUpdate(userId, {
        'personalization.averagePeriodDuration': averagePeriodDuration,
        'personalization.averageMenstrualCycleLength': averageMenstrualCycleLength
      });

      console.log(`Updated user averages - Period Duration: ${averagePeriodDuration}, Cycle Length: ${averageMenstrualCycleLength}`);
    }

    // If no cycles exist at all, calculate all cycles from start date
    if (cyclesForAveraging.length === 0) {
      console.log('No cycles exist, calculating all cycles from start date');
      return await calculateAllCyclesFromStart(userId, lastPeriodStartDate, averagePeriodDuration, averageMenstrualCycleLength, today);
    }

    // Check if today lies in OnGoing cycle
    if (onGoingCycle) {
      const cycleEndDate = formatDateOnly(new Date(onGoingCycle.cycleEndDate));
      
      if (today <= cycleEndDate) {
        console.log('Today lies in OnGoing cycle, updating only required fields');
        return await updateOnGoingCycle(onGoingCycle, today, averagePeriodDuration, averageMenstrualCycleLength);
      }
    }

    // Today lies beyond OnGoing cycle, need to recalculate
    console.log('Today lies beyond OnGoing cycle, recalculating all cycles');
    return await recalculateAllCycles(userId, lastPeriodStartDate, averagePeriodDuration, averageMenstrualCycleLength, today);

  } catch (error) {
    console.error('Error in calculateCycle:', error);
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new DatabaseError('Failed to calculate cycle');
  }
};

/**
 * Calculate all cycles from start date when no cycles exist
 */
const calculateAllCyclesFromStart = async (userId, startDate, averagePeriodDuration, averageMenstrualCycleLength, today) => {
  try {
    console.log('Calculating all cycles from start date');
    
    let currentDate = formatDateOnly(new Date(startDate));
    let cycleNumber = 1;
    const completedCycles = [];
    let currentCycle = null;

    // Calculate cycles until we find the current one
    while (currentDate <= today) {
      const cycleEndDate = formatDateOnly(new Date(currentDate.getTime() + (averageMenstrualCycleLength - 1) * 24 * 60 * 60 * 1000));
      
      if (cycleEndDate < today) {
        // This cycle is completed
        const cycle = await createCycleRecord(userId, cycleNumber, currentDate, averagePeriodDuration, averageMenstrualCycleLength, 'Completed');
        completedCycles.push(cycle);
        console.log(`Created completed cycle ${cycleNumber}`);
      } else {
        // This is the current cycle
        currentCycle = await createCycleRecord(userId, cycleNumber, currentDate, averagePeriodDuration, averageMenstrualCycleLength, 'OnGoing', today);
        console.log(`Created OnGoing cycle ${cycleNumber}`);
        break;
      }
      
      currentDate = formatDateOnly(new Date(cycleEndDate.getTime() + 1 * 24 * 60 * 60 * 1000));
      cycleNumber++;
    }

    // Calculate 3 future cycles
    const futureCycles = await calculateAndSaveFutureCycles(userId, currentCycle?.cycleEndDate || formatDateOnly(new Date(currentDate.getTime() + (averageMenstrualCycleLength - 1) * 24 * 60 * 60 * 1000)), cycleNumber, averagePeriodDuration, averageMenstrualCycleLength);

    return {
      success: true,
      message: `Calculated ${completedCycles.length} completed cycles, 1 current cycle, and ${futureCycles.length} future cycles.`,
      data: {
        currentCycle,
        completedCycles: completedCycles.length,
        futureCycles: futureCycles.length,
        totalCyclesProcessed: completedCycles.length + (currentCycle ? 1 : 0) + futureCycles.length
      }
    };

  } catch (error) {
    console.error('Error calculating all cycles from start:', error);
    throw new DatabaseError('Failed to calculate all cycles from start');
  }
};

/**
 * Update OnGoing cycle with current information
 */
const updateOnGoingCycle = async (onGoingCycle, today, averagePeriodDuration, averageMenstrualCycleLength) => {
  try {
    console.log('Updating OnGoing cycle');
    
    const cycleEndDate = formatDateOnly(new Date(onGoingCycle.cycleEndDate));
    const nextPeriodStartDate = formatDateOnly(new Date(cycleEndDate.getTime() + 1 * 24 * 60 * 60 * 1000));
    
    const daysRemainingInCycle = Math.ceil((cycleEndDate - today) / (24 * 60 * 60 * 1000));
    const nextPeriodIn = Math.ceil((nextPeriodStartDate - today) / (24 * 60 * 60 * 1000));
    
    // Determine current phase
    const currentPhase = determineCurrentPhase(today, onGoingCycle);
    
    // Update the cycle
    await MenstrualCycle.findByIdAndUpdate(onGoingCycle._id, {
      currentPhase,
      daysRemainingInCycle,
      nextPeriodIn
    });

    const updatedCycle = await MenstrualCycle.findById(onGoingCycle._id);

    return {
      success: true,
      message: 'OnGoing cycle updated successfully.',
      data: {
        currentCycle: updatedCycle,
        completedCycles: 0,
        futureCycles: 0,
        totalCyclesProcessed: 1
      }
    };

  } catch (error) {
    console.error('Error updating OnGoing cycle:', error);
    throw new DatabaseError('Failed to update OnGoing cycle');
  }
};

/**
 * Update existing cycles and calculate missing ones when today lies beyond OnGoing cycle
 */
const recalculateAllCycles = async (userId, startDate, averagePeriodDuration, averageMenstrualCycleLength, today) => {
  try {
    console.log('Updating existing cycles and calculating missing ones');
    
    // Get all existing cycles sorted by cycle number
    const existingCycles = await MenstrualCycle.find({ userId }).sort({ cycleNumber: 1 });
    console.log(`Found ${existingCycles.length} existing cycles`);
    
    let completedCycles = 0;
    let currentCycle = null;
    let lastCycleEndDate = null;
    
    // Update existing cycles based on today's date
    for (const cycle of existingCycles) {
      const cycleEndDate = formatDateOnly(new Date(cycle.cycleEndDate));
      
      if (cycleEndDate < today) {
        // This cycle should be completed
        await MenstrualCycle.findByIdAndUpdate(cycle._id, {
          status: 'Completed',
          currentPhase: null,
          daysRemainingInCycle: null,
          nextPeriodIn: null
        });
        completedCycles++;
        lastCycleEndDate = cycleEndDate;
        console.log(`Updated cycle ${cycle.cycleNumber} to Completed`);
      } else if (cycle.lastPeriodStartDate <= today && cycleEndDate >= today) {
        // This is the current cycle
        const nextPeriodStartDate = formatDateOnly(new Date(cycleEndDate.getTime() + 1 * 24 * 60 * 60 * 1000));
        const daysRemainingInCycle = Math.ceil((cycleEndDate - today) / (24 * 60 * 60 * 1000));
        const nextPeriodIn = Math.ceil((nextPeriodStartDate - today) / (24 * 60 * 60 * 1000));
        const currentPhase = determineCurrentPhase(today, cycle);
        
        await MenstrualCycle.findByIdAndUpdate(cycle._id, {
          status: 'OnGoing',
          currentPhase,
          daysRemainingInCycle,
          nextPeriodIn
        });
        
        currentCycle = await MenstrualCycle.findById(cycle._id);
        lastCycleEndDate = cycleEndDate;
        console.log(`Updated cycle ${cycle.cycleNumber} to OnGoing`);
      } else {
        // This is a future cycle
        await MenstrualCycle.findByIdAndUpdate(cycle._id, {
          status: 'UpComing',
          currentPhase: null,
          daysRemainingInCycle: null,
          nextPeriodIn: null
        });
        console.log(`Updated cycle ${cycle.cycleNumber} to UpComing`);
      }
    }
    
    // If no current cycle found, we need to calculate missing cycles
    if (!currentCycle) {
      console.log('No current cycle found, calculating missing cycles');
      
      // Find the last completed cycle or start from the original start date
      let nextCycleStartDate;
      if (lastCycleEndDate) {
        nextCycleStartDate = formatDateOnly(new Date(lastCycleEndDate.getTime() + 1 * 24 * 60 * 60 * 1000));
      } else {
        nextCycleStartDate = formatDateOnly(new Date(startDate));
      }
      
      // Calculate cycles until we find the current one
      let cycleNumber = existingCycles.length > 0 ? existingCycles[existingCycles.length - 1].cycleNumber + 1 : 1;
      let currentDate = nextCycleStartDate;
      
      while (currentDate <= today) {
        const cycleEndDate = formatDateOnly(new Date(currentDate.getTime() + (averageMenstrualCycleLength - 1) * 24 * 60 * 60 * 1000));
        
        if (cycleEndDate < today) {
          // This cycle is completed
          await createCycleRecord(userId, cycleNumber, currentDate, averagePeriodDuration, averageMenstrualCycleLength, 'Completed');
          completedCycles++;
          console.log(`Created missing completed cycle ${cycleNumber}`);
        } else {
          // This is the current cycle
          currentCycle = await createCycleRecord(userId, cycleNumber, currentDate, averagePeriodDuration, averageMenstrualCycleLength, 'OnGoing', today);
          console.log(`Created missing OnGoing cycle ${cycleNumber}`);
          break;
        }
        
        currentDate = formatDateOnly(new Date(cycleEndDate.getTime() + 1 * 24 * 60 * 60 * 1000));
        cycleNumber++;
      }
    }
    
    // Ensure we have 3 future cycles
    const futureCycles = await calculateAndSaveFutureCycles(userId, currentCycle?.cycleEndDate || lastCycleEndDate, currentCycle?.cycleNumber || existingCycles.length, averagePeriodDuration, averageMenstrualCycleLength);
    
    return {
      success: true,
      message: `Updated ${completedCycles} completed cycles, 1 current cycle, and ${futureCycles.length} future cycles.`,
      data: {
        currentCycle,
        completedCycles,
        futureCycles: futureCycles.length,
        totalCyclesProcessed: completedCycles + (currentCycle ? 1 : 0) + futureCycles.length
      }
    };

  } catch (error) {
    console.error('Error recalculating all cycles:', error);
    throw new DatabaseError('Failed to recalculate all cycles');
  }
};

/**
 * Create a cycle record
 */
const createCycleRecord = async (userId, cycleNumber, startDate, averagePeriodDuration, averageMenstrualCycleLength, status, today = null) => {
  try {
    const periodEndDate = formatDateOnly(new Date(startDate.getTime() + (averagePeriodDuration - 1) * 24 * 60 * 60 * 1000));
    const cycleEndDate = formatDateOnly(new Date(startDate.getTime() + (averageMenstrualCycleLength - 1) * 24 * 60 * 60 * 1000));
    
    // Phase dates
    const menstrualPhaseStartDate = formatDateOnly(new Date(startDate));
    const menstrualPhaseEndDate = formatDateOnly(new Date(periodEndDate));
    
    const ovulationDate = formatDateOnly(new Date(startDate.getTime() + 13 * 24 * 60 * 60 * 1000));
    const fertileWindowStartDate = formatDateOnly(new Date(ovulationDate.getTime() - 2 * 24 * 60 * 60 * 1000));
    const fertileWindowEndDate = formatDateOnly(new Date(ovulationDate.getTime() + 2 * 24 * 60 * 60 * 1000));
    
    const follicularPhaseStartDate = formatDateOnly(new Date(periodEndDate.getTime() + 1 * 24 * 60 * 60 * 1000));
    const follicularPhaseEndDate = formatDateOnly(new Date(ovulationDate.getTime() - 1 * 24 * 60 * 60 * 1000));
    
    const lutealPhaseStartDate = formatDateOnly(new Date(fertileWindowEndDate.getTime() + 1 * 24 * 60 * 60 * 1000));
    const lutealPhaseEndDate = formatDateOnly(new Date(cycleEndDate.getTime()));
    
    const nextPeriodStartDate = formatDateOnly(new Date(cycleEndDate.getTime() + 1 * 24 * 60 * 60 * 1000));

    let currentPhase = null;
    let daysRemainingInCycle = null;
    let nextPeriodIn = null;

    if (status === 'OnGoing' && today) {
      daysRemainingInCycle = Math.ceil((cycleEndDate - today) / (24 * 60 * 60 * 1000));
      nextPeriodIn = Math.ceil((nextPeriodStartDate - today) / (24 * 60 * 60 * 1000));
      currentPhase = determineCurrentPhase(today, {
        menstrualPhaseStartDate,
        menstrualPhaseEndDate,
        ovulationDate,
        fertileWindowStartDate,
        fertileWindowEndDate,
        follicularPhaseStartDate,
        follicularPhaseEndDate,
        lutealPhaseStartDate,
        lutealPhaseEndDate
      });
    }

    const cycle = new MenstrualCycle({
      userId,
      cycleNumber,
      lastPeriodStartDate: startDate,
      averagePeriodDuration,
      averageMenstrualCycleLength,
      periodEndDate,
      cycleEndDate,
      menstrualPhaseStartDate,
      menstrualPhaseEndDate,
      ovulationDate,
      fertileWindowStartDate,
      fertileWindowEndDate,
      follicularPhaseStartDate,
      follicularPhaseEndDate,
      lutealPhaseStartDate,
      lutealPhaseEndDate,
      nextPeriodStartDate,
      currentPhase,
      daysRemainingInCycle,
      nextPeriodIn,
      status
    });

    await cycle.save();
    return cycle;

  } catch (error) {
    console.error('Error creating cycle record:', error);
    throw new DatabaseError('Failed to create cycle record');
  }
};

/**
 * Determine current phase based on today's date
 */
const determineCurrentPhase = (today, cycleData) => {
  const {
    menstrualPhaseStartDate,
    menstrualPhaseEndDate,
    ovulationDate,
    fertileWindowStartDate,
    fertileWindowEndDate,
    follicularPhaseStartDate,
    follicularPhaseEndDate,
    lutealPhaseStartDate,
    lutealPhaseEndDate
  } = cycleData;

  if (today >= menstrualPhaseStartDate && today <= menstrualPhaseEndDate) {
    return 'Menstrual Phase';
  } else if (today.toISOString().split('T')[0] === ovulationDate.toISOString().split('T')[0]) {
    return 'Ovulation Day';
  } else if (today >= fertileWindowStartDate && today <= fertileWindowEndDate) {
    return 'Ovulatory Phase';
  } else if (today >= follicularPhaseStartDate && today <= follicularPhaseEndDate) {
    return 'Follicular Phase';
  } else if (today >= lutealPhaseStartDate && today <= lutealPhaseEndDate) {
    return 'Luteal Phase';
  }
  
  return null;
};

/**
 * Update OnGoing cycle start date with complex logic
 */
const updateOnGoingCycleStartDate = async (userId, newStartDate) => {
  try {
    console.log(`Starting updateOnGoingCycleStartDate for userId: ${userId}, newStartDate: ${newStartDate}`);
    
    // Get user
    const user = await User.findById(userId);
    if (!user) {
      throw new ValidationError('User not found');
    }

    // Normalize the new start date
    const normalizedNewStartDate = formatDateOnly(new Date(newStartDate));
    const today = formatDateOnly(new Date());

    console.log(`Normalized dates - newStartDate: ${normalizedNewStartDate.toISOString()}, today: ${today.toISOString()}`);

    // Validation: User cannot set a future date
    if (normalizedNewStartDate > today) {
      return {
        success: false,
        message: 'Cannot set period start date to a future date.',
        data: null
      };
    }

    // Get the current OnGoing cycle
    const onGoingCycle = await MenstrualCycle.findOne({ 
      userId, 
      status: 'OnGoing' 
    }).sort({ cycleNumber: -1 });

    if (!onGoingCycle) {
      return {
        success: false,
        message: 'No OnGoing cycle found. Please calculate your cycle first.',
        data: null
      };
    }

    // Validation: New start date cannot be greater than period end date of current OnGoing cycle
    const currentPeriodEndDate = formatDateOnly(new Date(onGoingCycle.periodEndDate));
    if (normalizedNewStartDate > currentPeriodEndDate) {
      return {
        success: false,
        message: 'Period start date cannot be greater than the current period end date.',
        data: null
      };
    }

    console.log(`Found OnGoing cycle: ${onGoingCycle._id}, cycleNumber: ${onGoingCycle.cycleNumber}`);

    const originalStartDate = formatDateOnly(new Date(onGoingCycle.lastPeriodStartDate));
    const averageMenstrualCycleLength = user.personalization.averageMenstrualCycleLength || 28;

    // Check if the new date is more than X days ago (scenario 5)
    const daysDifference = Math.ceil((today - normalizedNewStartDate) / (24 * 60 * 60 * 1000));
    
    if (daysDifference > averageMenstrualCycleLength) {
      console.log(`New start date is more than ${averageMenstrualCycleLength} days ago, marking OnGoing cycle as Completed`);
      return await handleFutureDateScenario(userId, normalizedNewStartDate, today, averageMenstrualCycleLength);
    }

    // Note: We don't update user.personalization.lastPeriodStartDate here
    // as this endpoint only updates the OnGoing cycle's start date

    // Get the previous cycle to update its end dates
    const previousCycle = await MenstrualCycle.findOne({ 
      userId, 
      cycleNumber: onGoingCycle.cycleNumber - 1 
    });

    if (previousCycle) {
      // Update previous cycle's cycleEndDate and lutealPhaseEndDate
      const newPreviousCycleEndDate = formatDateOnly(new Date(normalizedNewStartDate.getTime() - 1 * 24 * 60 * 60 * 1000));
      
      // Calculate new cycle length for the previous cycle
      const previousCycleStartDate = formatDateOnly(new Date(previousCycle.lastPeriodStartDate));
      const newPreviousCycleLength = Math.ceil((newPreviousCycleEndDate - previousCycleStartDate) / (24 * 60 * 60 * 1000)) + 1;
      
      await MenstrualCycle.findByIdAndUpdate(previousCycle._id, {
        cycleEndDate: newPreviousCycleEndDate,
        lutealPhaseEndDate: newPreviousCycleEndDate,
        nextPeriodStartDate: normalizedNewStartDate,
        averageMenstrualCycleLength: newPreviousCycleLength
      });

      console.log(`Updated previous cycle ${previousCycle.cycleNumber} end date to: ${newPreviousCycleEndDate.toISOString().split('T')[0]} and cycle length to: ${newPreviousCycleLength}`);
    }

    // Recalculate OnGoing cycle with new start date
    const averagePeriodDuration = user.personalization.averagePeriodDuration || 5;
    const periodEndDate = formatDateOnly(new Date(normalizedNewStartDate.getTime() + (averagePeriodDuration - 1) * 24 * 60 * 60 * 1000));
    const cycleEndDate = formatDateOnly(new Date(normalizedNewStartDate.getTime() + (averageMenstrualCycleLength - 1) * 24 * 60 * 60 * 1000));
    
    // Phase dates
    const menstrualPhaseStartDate = formatDateOnly(new Date(normalizedNewStartDate));
    const menstrualPhaseEndDate = formatDateOnly(new Date(periodEndDate));
    
    const ovulationDate = formatDateOnly(new Date(normalizedNewStartDate.getTime() + 13 * 24 * 60 * 60 * 1000));
    const fertileWindowStartDate = formatDateOnly(new Date(ovulationDate.getTime() - 2 * 24 * 60 * 60 * 1000));
    const fertileWindowEndDate = formatDateOnly(new Date(ovulationDate.getTime() + 2 * 24 * 60 * 60 * 1000));
    
    const follicularPhaseStartDate = formatDateOnly(new Date(periodEndDate.getTime() + 1 * 24 * 60 * 60 * 1000));
    const follicularPhaseEndDate = formatDateOnly(new Date(ovulationDate.getTime() - 1 * 24 * 60 * 60 * 1000));
    
    const lutealPhaseStartDate = formatDateOnly(new Date(fertileWindowEndDate.getTime() + 1 * 24 * 60 * 60 * 1000));
    const lutealPhaseEndDate = formatDateOnly(new Date(cycleEndDate.getTime()));
    
    const nextPeriodStartDate = formatDateOnly(new Date(cycleEndDate.getTime() + 1 * 24 * 60 * 60 * 1000));

    // Calculate current phase and remaining days
    const daysRemainingInCycle = Math.ceil((cycleEndDate - today) / (24 * 60 * 60 * 1000));
    const nextPeriodIn = Math.ceil((nextPeriodStartDate - today) / (24 * 60 * 60 * 1000));
    
    // Determine current phase
    const currentPhase = determineCurrentPhase(today, {
      menstrualPhaseStartDate,
      menstrualPhaseEndDate,
      ovulationDate,
      fertileWindowStartDate,
      fertileWindowEndDate,
      follicularPhaseStartDate,
      follicularPhaseEndDate,
      lutealPhaseStartDate,
      lutealPhaseEndDate
    });

    // Recalculate averages from last 3 completed cycles (scenario 6)
    const newAverageCycleLength = await calculateNewAverageCycleLength(userId, averageMenstrualCycleLength);

    // Update the OnGoing cycle with the new average cycle length
    await MenstrualCycle.findByIdAndUpdate(onGoingCycle._id, {
      lastPeriodStartDate: normalizedNewStartDate,
      periodEndDate,
      cycleEndDate,
      menstrualPhaseStartDate,
      menstrualPhaseEndDate,
      ovulationDate,
      fertileWindowStartDate,
      fertileWindowEndDate,
      follicularPhaseStartDate,
      follicularPhaseEndDate,
      lutealPhaseStartDate,
      lutealPhaseEndDate,
      nextPeriodStartDate,
      currentPhase,
      daysRemainingInCycle,
      nextPeriodIn,
      averageMenstrualCycleLength: newAverageCycleLength
    });

    console.log(`Updated OnGoing cycle ${onGoingCycle.cycleNumber} with new start date and average cycle length: ${newAverageCycleLength}`);
    
    // Update user's average
    await User.findByIdAndUpdate(userId, {
      'personalization.averageMenstrualCycleLength': newAverageCycleLength
    });
    console.log(`Updated user's average cycle length to: ${newAverageCycleLength}`);

    // Recalculate all UpComing cycles with new averages
    await recalculateFutureCycles(userId, cycleEndDate, onGoingCycle.cycleNumber, averagePeriodDuration, newAverageCycleLength);

    // Get the updated cycle
    const updatedCycle = await MenstrualCycle.findById(onGoingCycle._id);

    return {
      success: true,
      message: 'OnGoing cycle start date updated successfully. All dependent dates and upcoming cycles have been recalculated.',
      data: {
        updatedCycle,
        newStartDate: normalizedNewStartDate,
        newAverageCycleLength
      }
    };

  } catch (error) {
    console.error('Error in updateOnGoingCycleStartDate:', error);
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new DatabaseError('Failed to update OnGoing cycle start date');
  }
};

/**
 * Handle scenario when user sets date more than X days ago
 */
const handleFutureDateScenario = async (userId, newStartDate, today, averageMenstrualCycleLength) => {
  try {
    console.log('Handling future date scenario - marking OnGoing cycle as Completed');
    
    // Get the current OnGoing cycle
    const onGoingCycle = await MenstrualCycle.findOne({ 
      userId, 
      status: 'OnGoing' 
    });

    if (onGoingCycle) {
      // Mark OnGoing cycle as Completed
      await MenstrualCycle.findByIdAndUpdate(onGoingCycle._id, {
        status: 'Completed',
        currentPhase: null,
        daysRemainingInCycle: null,
        nextPeriodIn: null
      });
      console.log(`Marked cycle ${onGoingCycle.cycleNumber} as Completed`);
    }

    // Update user's lastPeriodStartDate
    await User.findByIdAndUpdate(userId, {
      'personalization.lastPeriodStartDate': newStartDate
    });

    // Recalculate averages from last 3 completed cycles
    const newAverageCycleLength = await calculateNewAverageCycleLength(userId, averageMenstrualCycleLength);
    
    // Update user's average if it's reasonable
    if (newAverageCycleLength >= 20 && newAverageCycleLength <= 45) {
      await User.findByIdAndUpdate(userId, {
        'personalization.averageMenstrualCycleLength': newAverageCycleLength
      });
      console.log(`Updated user's average cycle length to: ${newAverageCycleLength}`);
    }

    // Recalculate all cycles from the new start date
    const result = await calculateAllCyclesFromStart(userId, newStartDate, 5, newAverageCycleLength, today);

    return {
      success: true,
      message: 'OnGoing cycle marked as Completed. All cycles recalculated from new start date.',
      data: result.data
    };

  } catch (error) {
    console.error('Error in handleFutureDateScenario:', error);
    throw new DatabaseError('Failed to handle future date scenario');
  }
};

/**
 * Update OnGoing cycle end date with specific field updates
 */
const updateOnGoingCycleEndDate = async (userId, newEndDate) => {
  try {
    console.log(`Starting updateOnGoingCycleEndDate for userId: ${userId}, newEndDate: ${newEndDate}`);
    
    // Get user
    const user = await User.findById(userId);
    if (!user) {
      throw new ValidationError('User not found');
    }

    // Normalize the new end date
    const normalizedNewEndDate = formatDateOnly(new Date(newEndDate));
    const today = formatDateOnly(new Date());

    console.log(`Normalized dates - newEndDate: ${normalizedNewEndDate.toISOString()}, today: ${today.toISOString()}`);

    // Validation: User cannot set a future date
    if (normalizedNewEndDate > today) {
      return {
        success: false,
        message: 'Cannot set period end date to a future date.',
        data: null
      };
    }

    // Get the current OnGoing cycle
    const onGoingCycle = await MenstrualCycle.findOne({ 
      userId, 
      status: 'OnGoing' 
    }).sort({ cycleNumber: -1 });

    if (!onGoingCycle) {
      return {
        success: false,
        message: 'No OnGoing cycle found. Please calculate your cycle first.',
        data: null
      };
    }

    console.log(`Found OnGoing cycle: ${onGoingCycle._id}, cycleNumber: ${onGoingCycle.cycleNumber}`);

    // Get the period start date from the OnGoing cycle
    const periodStartDate = formatDateOnly(new Date(onGoingCycle.lastPeriodStartDate));

    // Validation: End date should be after start date
    if (normalizedNewEndDate < periodStartDate) {
      return {
        success: false,
        message: 'Period end date cannot be before period start date.',
        data: null
      };
    }

    // Calculate new follicularPhaseStartDate (day after period end date)
    const newFollicularPhaseStartDate = formatDateOnly(new Date(normalizedNewEndDate.getTime() + 1 * 24 * 60 * 60 * 1000));

    // Update only the specific fields in OnGoing cycle
    await MenstrualCycle.findByIdAndUpdate(onGoingCycle._id, {
      periodEndDate: normalizedNewEndDate,
      menstrualPhaseEndDate: normalizedNewEndDate,
      follicularPhaseStartDate: newFollicularPhaseStartDate
    });

    console.log(`Updated OnGoing cycle ${onGoingCycle.cycleNumber} with new end date: ${normalizedNewEndDate.toISOString().split('T')[0]}`);

    // Calculate actual period duration for OnGoing cycle (days from start to end)
    const cyclePeriodStartDate = formatDateOnly(new Date(onGoingCycle.lastPeriodStartDate));
    const actualPeriodDuration = Math.ceil((normalizedNewEndDate - cyclePeriodStartDate) / (1000 * 60 * 60 * 24)) + 1;

    // Calculate new average period duration including the updated OnGoing cycle
    const newAveragePeriodDuration = await calculateNewAveragePeriodDuration(userId, actualPeriodDuration);

    console.log(`Calculated new average period duration: ${newAveragePeriodDuration}`);

    // Safety check: if calculation failed, use the actual duration
    const finalAverageDuration = newAveragePeriodDuration || actualPeriodDuration;
    console.log(`Using final average duration: ${finalAverageDuration}`);

    // Update OnGoing cycle's averagePeriodDuration with actual duration
    await MenstrualCycle.findByIdAndUpdate(onGoingCycle._id, {
      averagePeriodDuration: actualPeriodDuration
    });

    // Update user's averagePeriodDuration with average from last 3 completed cycles
    await User.findByIdAndUpdate(userId, {
      'personalization.averagePeriodDuration': finalAverageDuration
    });

    console.log(`Updated OnGoing cycle's actual period duration to: ${actualPeriodDuration} days`);
    console.log(`Updated user's average period duration to: ${finalAverageDuration}`);

    // Update all UpComing cycles with new average period duration
    const upcomingCycles = await MenstrualCycle.find({ 
      userId, 
      status: { $in: ['UpComing'] }
    }).sort({ cycleNumber: 1 });

    console.log(`Found ${upcomingCycles.length} UpComing cycles to update`);
    console.log(`Using finalAverageDuration: ${finalAverageDuration} for UpComing cycles`);

    for (const upcomingCycle of upcomingCycles) {
      // Calculate new period end date based on new average period duration
      const cyclePeriodStartDate = formatDateOnly(new Date(upcomingCycle.lastPeriodStartDate));
      const newPeriodEndDate = formatDateOnly(new Date(cyclePeriodStartDate.getTime() + (finalAverageDuration - 1) * 24 * 60 * 60 * 1000));
      
      // Calculate new follicular phase start date (day after period end date)
      const newFollicularPhaseStartDate = formatDateOnly(new Date(newPeriodEndDate.getTime() + 1 * 24 * 60 * 60 * 1000));

      console.log(`Updating UpComing cycle ${upcomingCycle.cycleNumber}:`);
      console.log(`  - Start date: ${cyclePeriodStartDate.toISOString().split('T')[0]}`);
      console.log(`  - New end date: ${newPeriodEndDate.toISOString().split('T')[0]}`);
      console.log(`  - New follicular start: ${newFollicularPhaseStartDate.toISOString().split('T')[0]}`);

      // Update the UpComing cycle
      const updateResult = await MenstrualCycle.findByIdAndUpdate(upcomingCycle._id, {
        averagePeriodDuration: finalAverageDuration,
        periodEndDate: newPeriodEndDate,
        menstrualPhaseEndDate: newPeriodEndDate,
        follicularPhaseStartDate: newFollicularPhaseStartDate
      });

      console.log(`Updated UpComing cycle ${upcomingCycle.cycleNumber} with new period duration: ${finalAverageDuration} days`);
      console.log(`Update result:`, updateResult ? 'SUCCESS' : 'FAILED');
    }

    // Get the updated cycle
    const updatedCycle = await MenstrualCycle.findById(onGoingCycle._id);

    return {
      success: true,
      message: 'OnGoing cycle end date updated successfully. Period duration average has been recalculated and all UpComing cycles have been updated.',
      data: {
        updatedCycle,
        newEndDate: normalizedNewEndDate,
        newAveragePeriodDuration: finalAverageDuration,
        updatedUpcomingCycles: upcomingCycles.length
      }
    };

  } catch (error) {
    console.error('Error in updateOnGoingCycleEndDate:', error);
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new DatabaseError('Failed to update OnGoing cycle end date');
  }
};

/**
 * Predict target cycle based on provided date
 */
const predictTargetCycle = async (userId, targetDate) => {
  try {
    console.log(`Starting predictTargetCycle for userId: ${userId}, targetDate: ${targetDate}`);
    
    // Get user
    const user = await User.findById(userId);
    if (!user) {
      throw new ValidationError('User not found');
    }

    // Normalize the target date
    const normalizedTargetDate = formatDateOnly(new Date(targetDate));
    const today = formatDateOnly(new Date());
    console.log(`Normalized target date: ${normalizedTargetDate.toISOString()}, today: ${today.toISOString()}`);

    // If user enters a future date, return OnGoing cycle
    if (normalizedTargetDate > today) {
      console.log('Target date is in the future, returning OnGoing cycle');
      
      const onGoingCycle = await MenstrualCycle.findOne({ 
        userId, 
        status: 'OnGoing' 
      }).sort({ cycleNumber: -1 });
      
      if (onGoingCycle) {
        const onGoingCycleStartDate = formatDateOnly(new Date(onGoingCycle.lastPeriodStartDate));
        const distance = Math.abs(Math.ceil((normalizedTargetDate - onGoingCycleStartDate) / (24 * 60 * 60 * 1000)));
        
        return {
          success: true,
          message: 'Target date is in the future. Returning OnGoing cycle.',
          data: {
            targetDate: normalizedTargetDate.toISOString().split('T')[0],
            predictedCycles: [
              {
                cycleNumber: onGoingCycle.cycleNumber,
                cycleId: onGoingCycle._id,
                actualStartDate: onGoingCycle.lastPeriodStartDate,
                distance: distance,
                isExactMatch: false,
                status: onGoingCycle.status,
                periodEndDate: onGoingCycle.periodEndDate,
                cycleEndDate: onGoingCycle.cycleEndDate,
                reason: 'Future date - returning OnGoing cycle'
              }
            ],
            predictionType: 'single'
          }
        };
      } else {
        return {
          success: false,
          message: 'No OnGoing cycle found for future date prediction.',
          data: null
        };
      }
    }

    // Get all cycles for the user, sorted by cycle number
    const allCycles = await MenstrualCycle.find({ userId })
      .sort({ cycleNumber: 1 });

    if (allCycles.length === 0) {
      return {
        success: false,
        message: 'No cycles found. Please calculate your cycle first.',
        data: null
      };
    }

    console.log(`Found ${allCycles.length} cycles for prediction`);

    const targetCycles = [];
    const rangeDays = 5; // 5 days range

    // Check each cycle to see if target date falls within range
    for (let i = 0; i < allCycles.length; i++) {
      const cycle = allCycles[i];
      const cycleStartDate = formatDateOnly(new Date(cycle.lastPeriodStartDate));
      
      // Calculate the range: 5 days before to 5 days after cycle start
      const rangeStart = formatDateOnly(new Date(cycleStartDate.getTime() - rangeDays * 24 * 60 * 60 * 1000));
      const rangeEnd = formatDateOnly(new Date(cycleStartDate.getTime() + rangeDays * 24 * 60 * 60 * 1000));
      
      console.log(`Cycle ${cycle.cycleNumber}: start=${cycleStartDate.toISOString().split('T')[0]}, range=${rangeStart.toISOString().split('T')[0]} to ${rangeEnd.toISOString().split('T')[0]}`);
      
      // Check if target date falls within this cycle's range
      if (normalizedTargetDate >= rangeStart && normalizedTargetDate <= rangeEnd) {
        // Skip UpComing cycles - return OnGoing cycle instead
        if (cycle.status === 'UpComing') {
          console.log(`Target date matches UpComing cycle ${cycle.cycleNumber}, finding OnGoing cycle instead`);
          
          // Find the OnGoing cycle
          const onGoingCycle = await MenstrualCycle.findOne({ 
            userId, 
            status: 'OnGoing' 
          }).sort({ cycleNumber: -1 });
          
          if (onGoingCycle) {
            const onGoingCycleStartDate = formatDateOnly(new Date(onGoingCycle.lastPeriodStartDate));
            const onGoingDistance = Math.abs(Math.ceil((normalizedTargetDate - onGoingCycleStartDate) / (24 * 60 * 60 * 1000)));
            
            targetCycles.push({
              cycle: onGoingCycle,
              distance: onGoingDistance,
              isExactMatch: false,
              reason: 'UpComing cycle replaced with OnGoing cycle'
            });
            console.log(`Replaced UpComing cycle with OnGoing cycle ${onGoingCycle.cycleNumber} (distance: ${onGoingDistance} days)`);
          }
        } else {
          targetCycles.push({
            cycle,
            distance: Math.abs(Math.ceil((normalizedTargetDate - cycleStartDate) / (24 * 60 * 60 * 1000))),
            isExactMatch: normalizedTargetDate.getTime() === cycleStartDate.getTime()
          });
          console.log(`Target date falls within cycle ${cycle.cycleNumber} range (distance: ${Math.abs(Math.ceil((normalizedTargetDate - cycleStartDate) / (24 * 60 * 60 * 1000)))} days)`);
        }
      }
    }

    // If no cycles found within range, check if target date falls between cycles
    if (targetCycles.length === 0) {
      console.log('Target date not within any cycle range, checking if it falls between cycles');
      
      for (let i = 0; i < allCycles.length - 1; i++) {
        const currentCycle = allCycles[i];
        const nextCycle = allCycles[i + 1];
        
        const currentCycleStart = formatDateOnly(new Date(currentCycle.lastPeriodStartDate));
        const nextCycleStart = formatDateOnly(new Date(nextCycle.lastPeriodStartDate));
        
        // Check if target date falls between these two cycles
        if (normalizedTargetDate > currentCycleStart && normalizedTargetDate < nextCycleStart) {
          // Check if it's more than 5 days before the next cycle
          const daysBeforeNext = Math.ceil((nextCycleStart - normalizedTargetDate) / (24 * 60 * 60 * 1000));
          
          if (daysBeforeNext > rangeDays) {
            // If next cycle is UpComing, only return the current cycle (OnGoing)
            if (nextCycle.status === 'UpComing') {
              targetCycles.push({
                cycle: currentCycle,
                distance: Math.ceil((normalizedTargetDate - currentCycleStart) / (24 * 60 * 60 * 1000)),
                isExactMatch: false,
                reason: 'Next cycle is UpComing, returning OnGoing cycle only'
              });
              console.log(`Target date falls between cycle ${currentCycle.cycleNumber} and UpComing cycle ${nextCycle.cycleNumber}, returning only OnGoing cycle`);
            } else {
              // Both cycles are editable (Completed/OnGoing)
              targetCycles.push({
                cycle: currentCycle,
                distance: Math.ceil((normalizedTargetDate - currentCycleStart) / (24 * 60 * 60 * 1000)),
                isExactMatch: false
              });
              targetCycles.push({
                cycle: nextCycle,
                distance: daysBeforeNext,
                isExactMatch: false
              });
              console.log(`Target date falls between cycle ${currentCycle.cycleNumber} and ${nextCycle.cycleNumber}`);
            }
            break;
          }
        }
      }
    }

    if (targetCycles.length === 0) {
      return {
        success: false,
        message: 'No cycles found within the prediction range. Please provide a date closer to an existing cycle.',
        data: null
      };
    }

    // Sort by distance (closest first)
    targetCycles.sort((a, b) => a.distance - b.distance);

    const result = {
      targetDate: normalizedTargetDate.toISOString().split('T')[0],
      predictedCycles: targetCycles.map(tc => ({
        cycleNumber: tc.cycle.cycleNumber,
        cycleId: tc.cycle._id,
        actualStartDate: tc.cycle.lastPeriodStartDate,
        distance: tc.distance,
        isExactMatch: tc.isExactMatch,
        status: tc.cycle.status,
        periodEndDate: tc.cycle.periodEndDate,
        cycleEndDate: tc.cycle.cycleEndDate
      })),
      predictionType: targetCycles.length === 1 ? 'single' : 'multiple'
    };

    console.log(`Prediction complete: found ${targetCycles.length} cycle(s)`);

    return {
      success: true,
      message: `Found ${targetCycles.length} cycle(s) matching the target date.`,
      data: result
    };

  } catch (error) {
    console.error('Error in predictTargetCycle:', error);
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new DatabaseError('Failed to predict target cycle');
  }
};

/**
 * Update cycle by ID with new start date and adjust all related cycles
 */
const updateCycleById = async (userId, cycleId, newStartDate) => {
  try {
    console.log(`Starting updateCycleById for userId: ${userId}, cycleId: ${cycleId}, newStartDate: ${newStartDate}`);
    
    // Get user
    const user = await User.findById(userId);
    if (!user) {
      throw new ValidationError('User not found');
    }

    // Normalize the new start date
    const normalizedNewStartDate = formatDateOnly(new Date(newStartDate));
    const today = formatDateOnly(new Date());

    console.log(`Normalized dates - newStartDate: ${normalizedNewStartDate.toISOString()}, today: ${today.toISOString()}`);

    // Validation: User cannot set a future date
    if (normalizedNewStartDate > today) {
      return {
        success: false,
        message: 'Cannot set period start date to a future date.',
        data: null
      };
    }

    // Get the target cycle
    const targetCycle = await MenstrualCycle.findOne({ 
      _id: cycleId,
      userId 
    });

    if (!targetCycle) {
      return {
        success: false,
        message: 'Cycle not found or does not belong to user.',
        data: null
      };
    }

    // Validation: Cannot edit UpComing cycles
    if (targetCycle.status === 'UpComing') {
      return {
        success: false,
        message: 'Cannot edit a future cycle. Only Completed and OnGoing cycles can be modified.',
        data: null
      };
    }

    console.log(`Found target cycle: ${targetCycle.cycleNumber}, current start: ${targetCycle.lastPeriodStartDate}, status: ${targetCycle.status}`);

    // Get all cycles for the user, sorted by cycle number
    const allCycles = await MenstrualCycle.find({ userId })
      .sort({ cycleNumber: 1 });

    console.log(`Found ${allCycles.length} total cycles`);

    // Get user's current averages
    const averagePeriodDuration = user.personalization.averagePeriodDuration || 5;
    const averageMenstrualCycleLength = user.personalization.averageMenstrualCycleLength || 28;

    // 1. Update the previous cycle (if exists)
    const previousCycle = await MenstrualCycle.findOne({ 
      userId, 
      cycleNumber: targetCycle.cycleNumber - 1 
    });

    if (previousCycle) {
      // Update previous cycle's end dates
      const newPreviousCycleEndDate = formatDateOnly(new Date(normalizedNewStartDate.getTime() - 1 * 24 * 60 * 60 * 1000));
      
      // Calculate new cycle length for the previous cycle
      const previousCycleStartDate = formatDateOnly(new Date(previousCycle.lastPeriodStartDate));
      const newPreviousCycleLength = Math.ceil((newPreviousCycleEndDate - previousCycleStartDate) / (24 * 60 * 60 * 1000)) + 1;
      
      await MenstrualCycle.findByIdAndUpdate(previousCycle._id, {
        cycleEndDate: newPreviousCycleEndDate,
        lutealPhaseEndDate: newPreviousCycleEndDate,
        nextPeriodStartDate: normalizedNewStartDate,
        averageMenstrualCycleLength: newPreviousCycleLength
      });

      console.log(`Updated previous cycle ${previousCycle.cycleNumber} end date to: ${newPreviousCycleEndDate.toISOString().split('T')[0]} and cycle length to: ${newPreviousCycleLength}`);
    }

    // 2. Update the target cycle with new start date
    const periodEndDate = formatDateOnly(new Date(normalizedNewStartDate.getTime() + (averagePeriodDuration - 1) * 24 * 60 * 60 * 1000));
    const cycleEndDate = formatDateOnly(new Date(normalizedNewStartDate.getTime() + (averageMenstrualCycleLength - 1) * 24 * 60 * 60 * 1000));
    
    // Phase dates
    const menstrualPhaseStartDate = formatDateOnly(new Date(normalizedNewStartDate));
    const menstrualPhaseEndDate = formatDateOnly(new Date(periodEndDate));
    
    const ovulationDate = formatDateOnly(new Date(normalizedNewStartDate.getTime() + 13 * 24 * 60 * 60 * 1000));
    const fertileWindowStartDate = formatDateOnly(new Date(ovulationDate.getTime() - 2 * 24 * 60 * 60 * 1000));
    const fertileWindowEndDate = formatDateOnly(new Date(ovulationDate.getTime() + 2 * 24 * 60 * 60 * 1000));
    
    const follicularPhaseStartDate = formatDateOnly(new Date(periodEndDate.getTime() + 1 * 24 * 60 * 60 * 1000));
    const follicularPhaseEndDate = formatDateOnly(new Date(ovulationDate.getTime() - 1 * 24 * 60 * 60 * 1000));
    
    const lutealPhaseStartDate = formatDateOnly(new Date(fertileWindowEndDate.getTime() + 1 * 24 * 60 * 60 * 1000));
    const lutealPhaseEndDate = formatDateOnly(new Date(cycleEndDate.getTime()));
    
    const nextPeriodStartDate = formatDateOnly(new Date(cycleEndDate.getTime() + 1 * 24 * 60 * 60 * 1000));

    // Calculate current phase and remaining days
    const daysRemainingInCycle = Math.ceil((cycleEndDate - today) / (24 * 60 * 60 * 1000));
    const nextPeriodIn = Math.ceil((nextPeriodStartDate - today) / (24 * 60 * 60 * 1000));
    
    // Determine current phase
    const currentPhase = determineCurrentPhase(today, {
      menstrualPhaseStartDate,
      menstrualPhaseEndDate,
      ovulationDate,
      fertileWindowStartDate,
      fertileWindowEndDate,
      follicularPhaseStartDate,
      follicularPhaseEndDate,
      lutealPhaseStartDate,
      lutealPhaseEndDate
    });

    // Update the target cycle
    await MenstrualCycle.findByIdAndUpdate(targetCycle._id, {
      lastPeriodStartDate: normalizedNewStartDate,
      periodEndDate,
      cycleEndDate,
      menstrualPhaseStartDate,
      menstrualPhaseEndDate,
      ovulationDate,
      fertileWindowStartDate,
      fertileWindowEndDate,
      follicularPhaseStartDate,
      follicularPhaseEndDate,
      lutealPhaseStartDate,
      lutealPhaseEndDate,
      nextPeriodStartDate,
      currentPhase,
      daysRemainingInCycle,
      nextPeriodIn,
      averageMenstrualCycleLength
    });

    console.log(`Updated target cycle ${targetCycle.cycleNumber} with new start date`);

    // 3. Update all subsequent cycles
    const subsequentCycles = await MenstrualCycle.find({ 
      userId, 
      cycleNumber: { $gt: targetCycle.cycleNumber } 
    }).sort({ cycleNumber: 1 });

    console.log(`Found ${subsequentCycles.length} subsequent cycles to update`);

    for (const subsequentCycle of subsequentCycles) {
      // Calculate new start date based on previous cycle's end date
      const prevCycle = await MenstrualCycle.findOne({ 
        userId, 
        cycleNumber: subsequentCycle.cycleNumber - 1 
      });

      if (prevCycle) {
        const newStartDate = formatDateOnly(new Date(prevCycle.nextPeriodStartDate));
        const newPeriodEndDate = formatDateOnly(new Date(newStartDate.getTime() + (averagePeriodDuration - 1) * 24 * 60 * 60 * 1000));
        const newCycleEndDate = formatDateOnly(new Date(newStartDate.getTime() + (averageMenstrualCycleLength - 1) * 24 * 60 * 60 * 1000));
        
        // Recalculate all phase dates for subsequent cycle
        const newMenstrualPhaseStartDate = formatDateOnly(new Date(newStartDate));
        const newMenstrualPhaseEndDate = formatDateOnly(new Date(newPeriodEndDate));
        
        const newOvulationDate = formatDateOnly(new Date(newCycleEndDate.getTime() - 13 * 24 * 60 * 60 * 1000));
        const newFertileWindowStartDate = formatDateOnly(new Date(newOvulationDate.getTime() - 2 * 24 * 60 * 60 * 1000));
        const newFertileWindowEndDate = formatDateOnly(new Date(newOvulationDate.getTime() + 2 * 24 * 60 * 60 * 1000));
        
        const newFollicularPhaseStartDate = formatDateOnly(new Date(newPeriodEndDate.getTime() + 1 * 24 * 60 * 60 * 1000));
        const newFollicularPhaseEndDate = formatDateOnly(new Date(newOvulationDate.getTime() - 1 * 24 * 60 * 60 * 1000));
        
        const newLutealPhaseStartDate = formatDateOnly(new Date(newFertileWindowEndDate.getTime() + 1 * 24 * 60 * 60 * 1000));
        const newLutealPhaseEndDate = formatDateOnly(new Date(newCycleEndDate.getTime()));
        
        const newNextPeriodStartDate = formatDateOnly(new Date(newCycleEndDate.getTime() + 1 * 24 * 60 * 60 * 1000));

        // Calculate current phase for subsequent cycle
        const newCurrentPhase = determineCurrentPhase(today, {
          menstrualPhaseStartDate: newMenstrualPhaseStartDate,
          menstrualPhaseEndDate: newMenstrualPhaseEndDate,
          ovulationDate: newOvulationDate,
          fertileWindowStartDate: newFertileWindowStartDate,
          fertileWindowEndDate: newFertileWindowEndDate,
          follicularPhaseStartDate: newFollicularPhaseStartDate,
          follicularPhaseEndDate: newFollicularPhaseEndDate,
          lutealPhaseStartDate: newLutealPhaseStartDate,
          lutealPhaseEndDate: newLutealPhaseEndDate
        });

        // Update subsequent cycle
        await MenstrualCycle.findByIdAndUpdate(subsequentCycle._id, {
          lastPeriodStartDate: newStartDate,
          periodEndDate: newPeriodEndDate,
          cycleEndDate: newCycleEndDate,
          menstrualPhaseStartDate: newMenstrualPhaseStartDate,
          menstrualPhaseEndDate: newMenstrualPhaseEndDate,
          ovulationDate: newOvulationDate,
          fertileWindowStartDate: newFertileWindowStartDate,
          fertileWindowEndDate: newFertileWindowEndDate,
          follicularPhaseStartDate: newFollicularPhaseStartDate,
          follicularPhaseEndDate: newFollicularPhaseEndDate,
          lutealPhaseStartDate: newLutealPhaseStartDate,
          lutealPhaseEndDate: newLutealPhaseEndDate,
          nextPeriodStartDate: newNextPeriodStartDate,
          currentPhase: newCurrentPhase,
          daysRemainingInCycle: null,
          nextPeriodIn: null,
          averageMenstrualCycleLength
        });

        console.log(`Updated subsequent cycle ${subsequentCycle.cycleNumber}`);
      }
    }

    // 4. Recalculate averages from last 3 completed cycles
    const newAverageCycleLength = await calculateNewAverageCycleLength(userId, averageMenstrualCycleLength);
    const newAveragePeriodDuration = await calculateNewAveragePeriodDuration(userId, averagePeriodDuration);

    // Update user's averages
    await User.findByIdAndUpdate(userId, {
      'personalization.averageMenstrualCycleLength': newAverageCycleLength,
      'personalization.averagePeriodDuration': newAveragePeriodDuration
    });

    console.log(`Updated user's average cycle length to: ${newAverageCycleLength} and period duration to: ${newAveragePeriodDuration}`);

    // 5. Recalculate cycle statuses based on where today falls
    console.log('Recalculating cycle statuses based on current date...');
    
    // Get all cycles after the update, sorted by cycle number
    const allUpdatedCycles = await MenstrualCycle.find({ userId })
      .sort({ cycleNumber: 1 });

    // Find which cycle today falls into
    let currentCycleIndex = -1;
    for (let i = 0; i < allUpdatedCycles.length; i++) {
      const cycle = allUpdatedCycles[i];
      const cycleStartDate = formatDateOnly(new Date(cycle.lastPeriodStartDate));
      const cycleEndDate = formatDateOnly(new Date(cycle.cycleEndDate));
      
      if (today >= cycleStartDate && today <= cycleEndDate) {
        currentCycleIndex = i;
        console.log(`Today (${today.toISOString().split('T')[0]}) falls in cycle ${cycle.cycleNumber} (${cycleStartDate.toISOString().split('T')[0]} to ${cycleEndDate.toISOString().split('T')[0]})`);
        break;
      }
    }

    if (currentCycleIndex === -1) {
      console.log('Today does not fall in any cycle, this should not happen');
    } else {
      // Update statuses: current cycle = OnGoing, previous = Completed, future = UpComing
      for (let i = 0; i < allUpdatedCycles.length; i++) {
        const cycle = allUpdatedCycles[i];
        let newStatus;
        
        if (i < currentCycleIndex) {
          newStatus = 'Completed';
        } else if (i === currentCycleIndex) {
          newStatus = 'OnGoing';
        } else {
          newStatus = 'UpComing';
        }

        // Only update if status changed
        if (cycle.status !== newStatus) {
          let updateFields = { status: newStatus };
          
          // If this cycle is now OnGoing, update current phase and remaining days
          if (newStatus === 'OnGoing') {
            const currentPhase = determineCurrentPhase(today, cycle);
            const cycleEndDate = formatDateOnly(new Date(cycle.cycleEndDate));
            const nextPeriodStartDate = formatDateOnly(new Date(cycleEndDate.getTime() + 1 * 24 * 60 * 60 * 1000));
            
            const daysRemainingInCycle = Math.ceil((cycleEndDate - today) / (24 * 60 * 60 * 1000));
            const nextPeriodIn = Math.ceil((nextPeriodStartDate - today) / (24 * 60 * 60 * 1000));
            
            updateFields.currentPhase = currentPhase;
            updateFields.daysRemainingInCycle = daysRemainingInCycle;
            updateFields.nextPeriodIn = nextPeriodIn;
            
            console.log(`Updated OnGoing cycle ${cycle.cycleNumber} with currentPhase: ${currentPhase}, daysRemaining: ${daysRemainingInCycle}, nextPeriodIn: ${nextPeriodIn}`);
          } else if (newStatus === 'UpComing') {
            // Clear these fields for UpComing cycles
            updateFields.currentPhase = null;
            updateFields.daysRemainingInCycle = null;
            updateFields.nextPeriodIn = null;
          }
          
          await MenstrualCycle.findByIdAndUpdate(cycle._id, updateFields);
          console.log(`Updated cycle ${cycle.cycleNumber} status from ${cycle.status} to ${newStatus}`);
        }
      }
    }

    // Get the updated target cycle
    const updatedTargetCycle = await MenstrualCycle.findById(targetCycle._id);

    return {
      success: true,
      message: 'Cycle updated successfully. All related cycles and averages have been recalculated.',
      data: {
        updatedCycle: updatedTargetCycle,
        newStartDate: normalizedNewStartDate,
        newAverageCycleLength,
        newAveragePeriodDuration,
        updatedSubsequentCycles: subsequentCycles.length
      }
    };

  } catch (error) {
    console.error('Error in updateCycleById:', error);
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new DatabaseError('Failed to update cycle by ID');
  }
};

/**
 * Update cycle end date by ID and adjust subsequent cycles if needed
 */
const updateCycleEndDate = async (userId, cycleId, newEndDate) => {
  try {
    console.log(`Starting updateCycleEndDate for userId: ${userId}, cycleId: ${cycleId}, newEndDate: ${newEndDate}`);
    
    // Get user
    const user = await User.findById(userId);
    if (!user) {
      throw new ValidationError('User not found');
    }

    // Normalize the new end date
    const normalizedNewEndDate = formatDateOnly(new Date(newEndDate));
    const today = formatDateOnly(new Date());

    console.log(`Normalized dates - newEndDate: ${normalizedNewEndDate.toISOString()}, today: ${today.toISOString()}`);

    // Validation: User cannot set a future date
    if (normalizedNewEndDate > today) {
      return {
        success: false,
        message: 'Cannot set period end date to a future date.',
        data: null
      };
    }

    // Get the target cycle
    const targetCycle = await MenstrualCycle.findOne({ 
      _id: cycleId,
      userId 
    });

    if (!targetCycle) {
      return {
        success: false,
        message: 'Cycle not found or does not belong to user.',
        data: null
      };
    }

    // Validation: Cannot edit UpComing cycles
    if (targetCycle.status === 'UpComing') {
      return {
        success: false,
        message: 'Cannot edit a future cycle. Only Completed and OnGoing cycles can be modified.',
        data: null
      };
    }

    console.log(`Found target cycle: ${targetCycle.cycleNumber}, status: ${targetCycle.status}`);

    // Get the period start date from the target cycle
    const periodStartDate = formatDateOnly(new Date(targetCycle.lastPeriodStartDate));

    // Validation: End date should be after start date
    if (normalizedNewEndDate < periodStartDate) {
      return {
        success: false,
        message: 'Period end date cannot be before period start date.',
        data: null
      };
    }

    // 1. Calculate actual period duration for target cycle
    const actualPeriodDuration = Math.ceil((normalizedNewEndDate - periodStartDate) / (1000 * 60 * 60 * 24)) + 1;
    console.log(`Actual period duration: ${actualPeriodDuration}`);
    // 2. Calculate new follicularPhaseStartDate (day after period end date)
    const newFollicularPhaseStartDate = formatDateOnly(new Date(normalizedNewEndDate.getTime() + 1 * 24 * 60 * 60 * 1000));

    // 3. Update the target cycle
    let updateFields = {
      periodEndDate: normalizedNewEndDate,
      menstrualPhaseEndDate: normalizedNewEndDate,
      follicularPhaseStartDate: newFollicularPhaseStartDate,
      averagePeriodDuration: actualPeriodDuration
    };

    // If target cycle is OnGoing, update currentPhase as well
    if (targetCycle.status === 'OnGoing') {
      const currentPhase = determineCurrentPhase(today, targetCycle);
      updateFields.currentPhase = currentPhase;
      console.log(`Target cycle is OnGoing, updating currentPhase to: ${currentPhase}`);
    }

    await MenstrualCycle.findByIdAndUpdate(targetCycle._id, updateFields);

    console.log(`Updated target cycle ${targetCycle.cycleNumber} with new end date: ${normalizedNewEndDate.toISOString().split('T')[0]} and period duration: ${actualPeriodDuration}`);

    // 4. Get OnGoing cycle to compare
    const onGoingCycle = await MenstrualCycle.findOne({ 
      userId, 
      status: 'OnGoing' 
    }).sort({ cycleNumber: -1 });

    if (!onGoingCycle) {
      console.log('No OnGoing cycle found, skipping subsequent updates');
      return {
        success: true,
        message: 'Cycle end date updated successfully.',
        data: {
          updatedCycle: await MenstrualCycle.findById(targetCycle._id),
          newEndDate: normalizedNewEndDate,
          actualPeriodDuration
        }
      };
    }

    // 5. Compare cycle numbers
    const cycleDifference = onGoingCycle.cycleNumber - targetCycle.cycleNumber;
    console.log(`Cycle difference: ${onGoingCycle.cycleNumber} - ${targetCycle.cycleNumber} = ${cycleDifference}`);

    if (cycleDifference > 3) {
      console.log('Cycle difference > 3, no additional updates needed');
      return {
        success: true,
        message: 'Cycle end date updated successfully.',
        data: {
          updatedCycle: await MenstrualCycle.findById(targetCycle._id),
          newEndDate: normalizedNewEndDate,
          actualPeriodDuration
        }
      };
    } else {
      console.log('Cycle difference <= 3, updating subsequent cycles');
      
      // 6. Calculate new average period duration
      const newAveragePeriodDuration = await calculateNewAveragePeriodDuration(userId, actualPeriodDuration);
      console.log(`New average period duration: ${newAveragePeriodDuration}`);

      // 7. Update all cycles after the target cycle
      const cyclesToUpdate = await MenstrualCycle.find({ 
        userId, 
        cycleNumber: { $gt: targetCycle.cycleNumber } 
      }).sort({ cycleNumber: 1 });

      console.log(`Found ${cyclesToUpdate.length} cycles to update with new average period duration`);

      for (const cycle of cyclesToUpdate) {
        const cycleStartDate = formatDateOnly(new Date(cycle.lastPeriodStartDate));
        const newPeriodEndDate = formatDateOnly(new Date(cycleStartDate.getTime() + (newAveragePeriodDuration - 1) * 24 * 60 * 60 * 1000));
        const newFollicularStartDate = formatDateOnly(new Date(newPeriodEndDate.getTime() + 1 * 24 * 60 * 60 * 1000));

        await MenstrualCycle.findByIdAndUpdate(cycle._id, {
          periodEndDate: newPeriodEndDate,
          menstrualPhaseEndDate: newPeriodEndDate,
          follicularPhaseStartDate: newFollicularStartDate,
          averagePeriodDuration: newAveragePeriodDuration
        });

        console.log(`Updated cycle ${cycle.cycleNumber} with new period duration: ${newAveragePeriodDuration}`);
      }

      // 8. Update user's personalization
      await User.findByIdAndUpdate(userId, {
        'personalization.averagePeriodDuration': newAveragePeriodDuration
      });

      console.log(`Updated user's average period duration to: ${newAveragePeriodDuration}`);

      // If target cycle is not OnGoing, update OnGoing cycle's currentPhase
      if (targetCycle.status !== 'OnGoing') {
        const updatedOnGoingCycle = await MenstrualCycle.findOne({ 
          userId, 
          status: 'OnGoing' 
        }).sort({ cycleNumber: -1 });

        if (updatedOnGoingCycle) {
          const onGoingCurrentPhase = determineCurrentPhase(today, updatedOnGoingCycle);
          
          await MenstrualCycle.findByIdAndUpdate(updatedOnGoingCycle._id, {
            currentPhase: onGoingCurrentPhase
          });

          console.log(`Updated OnGoing cycle ${updatedOnGoingCycle.cycleNumber} currentPhase to: ${onGoingCurrentPhase}`);
        }
      }

      return {
        success: true,
        message: 'Cycle end date updated successfully. Subsequent cycles and averages have been recalculated.',
        data: {
          updatedCycle: await MenstrualCycle.findById(targetCycle._id),
          newEndDate: normalizedNewEndDate,
          actualPeriodDuration,
          newAveragePeriodDuration,
          updatedCycles: cyclesToUpdate.length
        }
      };
    }

  } catch (error) {
    console.error('Error in updateCycleEndDate:', error);
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new DatabaseError('Failed to update cycle end date');
  }
};

module.exports = {
  calculateAndSaveMenstrualCycle,
  getCurrentMenstrualCycle,
  getCycleHistory,
  getActiveCyclesList,
  getCycleSummary,
  resetCorruptedUserValues,
  calculateAndSaveFutureCycles,
  deleteExistingFutureCycles,
  recalculateFutureCycles,
  updatePreviousCycleLength,
  calculateCycle,
  updateOnGoingCycleStartDate,
  updateOnGoingCycleEndDate,
  predictTargetCycle,
  updateCycleById,
  updateCycleEndDate
};
