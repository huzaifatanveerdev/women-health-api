const menstrualFlowInsightsService = require('../services/menstrualFlowInsightsService');
const menstrualFlowInsightsAccessService = require('../services/menstrualFlowInsightsAccessService');
const { getLocalizedMessageFromRequest } = require('../utils/localization');

/**
 * Full-cycle menstrual flow detail (no calendar filter)
 * @route   GET /api/menstrual-flow/insights/cycle
 * @access  Protected (subscription or admin)
 */
const getMenstrualFlowCycleDetail = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const email = req.user.email;
    const language = req.language || 'en';

    const access = await menstrualFlowInsightsAccessService.getMenstrualFlowInsightsAccess(
      userId,
      email
    );

    if (!access.hasAccess) {
      return res.status(403).json({
        success: false,
        message: getLocalizedMessageFromRequest('flowInsights.access.denied', req)
      });
    }

    const { cycleId, timezone = 'UTC' } = req.query;

    const data = await menstrualFlowInsightsService.getMenstrualFlowCycleDetail(
      userId,
      { cycleId, timezone },
      language
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
 * Distribution-only menstrual flow insights
 * @route   GET /api/menstrual-flow/insights/distribution
 * @access  Protected (subscription or admin)
 *
 * Query: filter=today|7d|30d|custom&timezone=&startDate=&endDate=
 */
const getMenstrualFlowInsightsDistribution = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const email = req.user.email;
    const language = req.language || 'en';

    const access = await menstrualFlowInsightsAccessService.getMenstrualFlowInsightsAccess(
      userId,
      email
    );

    if (!access.hasAccess) {
      return res.status(403).json({
        success: false,
        message: getLocalizedMessageFromRequest('flowInsights.access.denied', req)
      });
    }

    const { filter, timezone = 'UTC', startDate, endDate } = req.query;

    const data = await menstrualFlowInsightsService.getMenstrualFlowDistribution(
      userId,
      { filter, timezone, startDate, endDate },
      language
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
  getMenstrualFlowCycleDetail,
  getMenstrualFlowInsightsDistribution
};
