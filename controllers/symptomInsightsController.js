const symptomInsightsService = require('../services/symptomInsightsService');
const symptomInsightsByCycleService = require('../services/symptomInsightsByCycleService');
const symptomInsightsPatternsService = require('../services/symptomInsightsPatternsService');

/**
 * Symptoms by phase for the user's OnGoing cycle only
 * @route   GET /api/symptoms/insights/ongoing-phases
 * @access  Protected
 */
const getOngoingCycleSymptomPhases = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { timezone = 'UTC' } = req.query;

    const data = await symptomInsightsByCycleService.getOngoingCycleSymptomPhases(
      userId,
      { timezone },
      req.language || 'en'
    );

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Symptoms by phase for a specific cycle
 * @route   GET /api/symptoms/insights/cycle
 * @access  Protected
 */
const getSymptomPhasesByCycleId = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { cycleId, timezone = 'UTC' } = req.query;

    const data = await symptomInsightsByCycleService.getSymptomPhasesByCycleId(
      userId,
      { cycleId, timezone },
      req.language || 'en'
    );

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cross-cycle symptom patterns (cycles + phase frequency per symptom)
 * @route   GET /api/symptoms/insights/patterns
 * @access  Protected
 */
const getSymptomInsightsPatterns = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { timezone = 'UTC' } = req.query;

    const data = await symptomInsightsPatternsService.getSymptomInsightsPatterns(
      userId,
      { timezone },
      req.language || 'en'
    );

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Filtered symptoms with logged dates
 * @route   GET /api/symptoms/insights/by-date
 * @access  Protected
 */
const getSymptomsWithLoggedDates = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const {
      filter,
      timezone = 'UTC',
      startDate,
      endDate
    } = req.query;

    const data = await symptomInsightsService.getSymptomsWithLoggedDates(
      userId,
      { filter, timezone, startDate, endDate },
      req.language || 'en'
    );

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getOngoingCycleSymptomPhases,
  getSymptomPhasesByCycleId,
  getSymptomInsightsPatterns,
  getSymptomsWithLoggedDates
};
