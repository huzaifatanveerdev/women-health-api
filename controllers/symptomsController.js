const symptomsService = require('../services/symptomsService');
const { getLocalizedMessageFromRequest } = require('../utils/localization');

/**
 * Seed symptoms from config
 * @route   POST /api/symptoms/seed
 * @access  Protected (Admin only)
 */
const seedSymptoms = async (req, res, next) => {
  try {
    const count = await symptomsService.seedSymptoms();

    res.status(200).json({
      success: true,
      message: 'Symptoms seeded successfully',
      data: {
        upsertedCount: count
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get symptoms grouped by category from database
 * @route   GET /api/symptoms
 * @access  Protected
 */
const getSymptoms = async (req, res, next) => {
  try {
    const language = req.language || 'en';
    const symptoms = await symptomsService.getSymptoms(language);

    res.status(200).json(symptoms);
  } catch (error) {
    next(error);
  }
};


// @desc    Submit daily symptoms for the logged-in user (can also remove symptoms if array is empty)
// @route   POST /api/symptoms/daily
// @access  Protected
const submitDailySymptoms = async (req, res, next) => {
  try {
    const authenticatedUserId = req.user.userId;
    const { symptoms, timezone = 'UTC' } = req.body;
console.log('timezone:', timezone);
    if (!symptoms || !Array.isArray(symptoms)) {
      return res.status(400).json({
        success: false,
        message: getLocalizedMessageFromRequest('error.symptoms.array.required', req)
      });
    }

    let result;

    if (symptoms.length === 0) {
      const today = new Date();
      const todayDateString = today.toISOString().split('T')[0];

      const entries = await symptomsService.getDailySymptoms(authenticatedUserId, timezone, req.language || 'en');
console.log('entries:', entries);
      if (entries) {
        await symptomsService.deleteDailySymptom(entries._id, req.language || 'en');
        result = {
          message: getLocalizedMessageFromRequest('symptoms.removed', req),
          removedEntry: entries,
          date: todayDateString
        };
      } else {
        result = {
          message: getLocalizedMessageFromRequest('symptoms.not.found', req),
          removedEntry: null,
          date: todayDateString
        };
      }

      res.status(200).json({
        success: true,
        message: getLocalizedMessageFromRequest('symptoms.removed', req),
        data: result
      });
    } else {
      const dailyEntry = await symptomsService.submitDailySymptoms(authenticatedUserId, symptoms, timezone, req.language || 'en');

      res.status(200).json({
        success: true,
        message: getLocalizedMessageFromRequest('symptoms.submitted', req),
        data: dailyEntry
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Get today's symptoms for the logged-in user
 * @route   GET /api/symptoms/daily
 * @access  Protected
 */
const getTodayDailySymptoms = async (req, res, next) => {
  try {
    const authenticatedUserId = req.user.userId;
    const { timezone = 'UTC' } = req.query;
    const language = req.language || 'en';

    const result = await symptomsService.getTodayDailySymptoms(authenticatedUserId, timezone, language);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get symptoms for a specific date for the logged-in user
 * @route   GET /api/symptoms/daily/:date
 * @access  Protected
 */
const getDailySymptomsByDate = async (req, res, next) => {
  try {
    const authenticatedUserId = req.user.userId;
    const { date } = req.params;
    const { timezone = 'UTC' } = req.query;
    const language = req.language || 'en';

    const result = await symptomsService.getDailySymptomsByDate(authenticatedUserId, date, timezone, language);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  seedSymptoms,
  getSymptoms,
  submitDailySymptoms,
  getTodayDailySymptoms,
  getDailySymptomsByDate
};
