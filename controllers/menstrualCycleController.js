const menstrualCycleService = require('../services/menstrualCycleService');
const MenstrualFlow = require('../models/MenstrualFlow');
const MenstrualCycle = require('../models/MenstrualCycle');
const User = require('../models/User');
const { ValidationError, DatabaseError, AuthenticationError } = require('../utils/errors');
const { getLocalizedMessageFromRequest } = require('../utils/localization');

/**
 * Calculate and save menstrual cycle for current user
 */
const calculateMenstrualCycle = async (req, res, next) => {
  try {
    const result = await menstrualCycleService.calculateAndSaveMenstrualCycle(req.user.userId, req.language);
    
    // If no current cycle found, return appropriate message
    if (!result.data.currentCycle) {
      return res.json({
        success: false,
        message: getLocalizedMessageFromRequest('cycle.not.found', req),
        data: null
      });
    }
    
    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Get current menstrual cycle for current user
 */
const getCurrentMenstrualCycle = async (req, res, next) => {
  try {
    const currentCycle = await menstrualCycleService.getCurrentMenstrualCycle(req.user.userId);
    
    if (!currentCycle) {
      return res.json({
        success: false,
        message: getLocalizedMessageFromRequest('cycle.not.found', req),
        data: null
      });
    }

    res.json({
      success: true,
      data: currentCycle
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get cycle history for current user
 */
const getCycleHistory = async (req, res, next) => {
  //console.log('getCycleHistory is called', req.user);
  try {
    const user = await User.findById(req.user.userId).select('IsDeleted');
    if (!user || user.IsDeleted === true) {
      console.log('user is deleted', user);
      throw new AuthenticationError('Invalid token');
    }

    const result = await menstrualCycleService.getCycleHistory(req.user.userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Get cycle summary for insights overview
 * @route   GET /api/users/me/menstrual-cycle/cycle-summary
 * @access  Protected
 */
const getCycleSummary = async (req, res, next) => {
  try {
    const data = await menstrualCycleService.getCycleSummary(req.user.userId, req.language);

    if (!data) {
      return res.json({
        success: false,
        message: getLocalizedMessageFromRequest('cycle.not.found', req),
        data: null
      });
    }

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

/**
 * List Completed and OnGoing cycles for insights (no UpComing, no date filter)
 * @route   GET /api/users/me/menstrual-cycle/active-cycles
 * @access  Protected
 */
const getActiveCyclesList = async (req, res, next) => {
  try {
    const data = await menstrualCycleService.getActiveCyclesList(req.user.userId);
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};


/**
 * Calculate and update menstrual cycles (new comprehensive endpoint)
 */
const calculateCycle = async (req, res, next) => {
  try {
    const result = await menstrualCycleService.calculateCycle(req.user.userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Update OnGoing cycle start date
 */
const updateOnGoingCycleStartDate = async (req, res, next) => {
  try {
    const { startDate } = req.body;
    
    if (!startDate) {
      return res.status(400).json({
        success: false,
        message: getLocalizedMessageFromRequest('validation.period.start.required', req),
        data: null
      });
    }

    const result = await menstrualCycleService.updateOnGoingCycleStartDate(req.user.userId, startDate);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Update OnGoing cycle end date
 */
const updateOnGoingCycleEndDate = async (req, res, next) => {
  try {
    const { endDate } = req.body;
    
    if (!endDate) {
      return res.status(400).json({
        success: false,
        message: getLocalizedMessageFromRequest('validation.period.start.required', req),
        data: null
      });
    }

    const result = await menstrualCycleService.updateOnGoingCycleEndDate(req.user.userId, endDate);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Predict target cycle based on provided date
 */
const predictTargetCycle = async (req, res, next) => {
  try {
    const { startDate } = req.body;
    
    if (!startDate) {
      return res.status(400).json({
        success: false,
        message: getLocalizedMessageFromRequest('validation.period.start.required', req),
        data: null
      });
    }

    const result = await menstrualCycleService.predictTargetCycle(req.user.userId, startDate);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Update cycle by ID with new start date or end date
 */
const updateCycleById = async (req, res, next) => {
  try {
    const { cycleId, startDate, endDate } = req.body;
    
    if (!cycleId) {
      return res.status(400).json({
        success: false,
        message: getLocalizedMessageFromRequest('cycle.id.required', req),
        data: null
      });
    }

    if (!startDate && !endDate) {
      return res.status(400).json({
        success: false,
        message: getLocalizedMessageFromRequest('cycle.start.or.end.required', req),
        data: null
      });
    }

    if (startDate && endDate) {
      return res.status(400).json({
        success: false,
        message: getLocalizedMessageFromRequest('cycle.start.or.end.not.both', req),
        data: null
      });
    }

    let result;
    if (startDate) {
      result = await menstrualCycleService.updateCycleById(req.user.userId, cycleId, startDate);
    } else if (endDate) {
      result = await menstrualCycleService.updateCycleEndDate(req.user.userId, cycleId, endDate);
    }

    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Store menstrual flow record
 */
const storeMenstrualFlow = async (req, res, next) => {
  try {
    const { flow } = req.body;
    const userId = req.user.userId;

    if (!flow) {
      return res.status(400).json({
        success: false,
        message: getLocalizedMessageFromRequest('flow.required', req),
        data: null
      });
    }

    if (!['Light', 'Medium', 'Heavy'].includes(flow)) {
      return res.status(400).json({
        success: false,
        message: getLocalizedMessageFromRequest('flow.invalid', req),
        data: null
      });
    }

    const menstrualFlow = new MenstrualFlow({
      userId,
      flow
    });

    await menstrualFlow.save();

    res.json({
      success: true,
      message: getLocalizedMessageFromRequest('flow.recorded', req),
      data: {
        flowId: menstrualFlow._id,
        flow: menstrualFlow.flow,
        recordedAt: menstrualFlow.recordedAt
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get latest menstrual flow record
 */
const getLatestMenstrualFlow = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const latestFlow = await MenstrualFlow.findOne({ userId })
      .sort({ recordedAt: -1 });

    if (!latestFlow) {
      return res.json({
        success: false,
        message: getLocalizedMessageFromRequest('flow.not.found', req),
        data: null
      });
    }

    res.json({
      success: true,
      data: {
        flowId: latestFlow._id,
        flow: latestFlow.flow,
        recordedAt: latestFlow.recordedAt
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Temporary API to delete all menstrual cycle data for testing
 */
const tempDeleteData = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    // Delete all menstrual cycles for this user
    const result = await MenstrualCycle.deleteMany({ userId });

    res.json({
      success: true,
      message: getLocalizedMessageFromRequest('cycle.deleted.count', req, { count: result.deletedCount }),
      data: {
        deletedCount: result.deletedCount,
        userId: userId
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  calculateMenstrualCycle,
  getCurrentMenstrualCycle,
  getCycleHistory,
  getCycleSummary,
  getActiveCyclesList,
  calculateCycle,
  updateOnGoingCycleStartDate,
  updateOnGoingCycleEndDate,
  predictTargetCycle,
  updateCycleById,
  storeMenstrualFlow,
  getLatestMenstrualFlow,
  tempDeleteData
};
