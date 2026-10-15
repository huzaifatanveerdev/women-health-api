const { getLocalizedMessageFromRequest } = require('../utils/localization');
const impactService = require('../services/impactService');
const CollectiveProgress = require('../models/CollectiveProgress');
const Impact = require('../models/Impact');
const ImpactRecord = require('../models/ImpactRecord');

/**
 * Set target count for Impact
 * @route   POST /api/impact/set-target-count
 * @access  Protected (Admin only)
 */
const setTargetCount = async (req, res, next) => {
  try {
    const { targetCount } = req.body;
    const language = req.language || 'en';

    const result = await impactService.setTargetCount(targetCount, language);

    res.status(200).json({
      success: true,
      message: getLocalizedMessageFromRequest('impact.targetCount.set.success', req) || 'Target count set successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get collective progress - total women helped and percentage
 * Also includes user's impact if they have a subscription plan
 * @route   GET /api/impact/collective-progress
 * @access  Protected
 */
const getCollectiveProgress = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const language = req.language || 'en';

    const result = await impactService.getCollectiveProgress(userId, language);

    res.status(200).json({
      success: true,
      message: getLocalizedMessageFromRequest('impact.collective.progress.retrieved', req) || 'Collective progress retrieved successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get collective progress (V1) — months helped instead of women helped.
 * @route   GET /api/impact/v1/collective-progress
 * @access  Protected
 *
 * Response data shape:
 *   { totalMonthsHelped: <number>, targetCount: <number>, percentage: <number> }
 *
 * Notes:
 *   - `totalMonthsHelped` is summed from every ImpactRecord (Impact = 1, Impact
 *     Plus = 5, Max Impact = 12 per purchase/renewal/resubscribe).
 *   - `targetCount` is now interpreted as the *months* helping target.
 *   - The V0 endpoint (`/collective-progress`) is intentionally left untouched.
 */
const getCollectiveProgressV1 = async (req, res, next) => {
  try {
    const language = req.language || 'en';

    const result = await impactService.getCollectiveProgressV1(language);

    res.status(200).json({
      success: true,
      message: getLocalizedMessageFromRequest('impact.collective.progress.retrieved', req) || 'Collective progress retrieved successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current user's impact (subscription flag + localized impact message)
 * @route   GET /api/impact/user-impact
 * @access  Protected
 *
 * Response data shape:
 *   { hasSubscription: true,  yourImpact: 'You\u2019ve enabled 5 months of access...' }
 *   { hasSubscription: false, yourImpact: null }
 */
const getUserImpact = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const language = req.language || 'en';

    const result = await impactService.getUserImpact(userId, language);

    res.status(200).json({
      success: true,
      message: getLocalizedMessageFromRequest('impact.user.retrieved', req) || 'User impact retrieved successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Add user to women-help-api Support waiting list
 * @route   POST /api/impact/add-to-women-help-api-support-list
 * @access  Protected
 */
const addToWomenHelpApiSupportList = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const language = req.language || 'en';

    const result = await impactService.addToWomenHelpApiSupportList(userId, req.body, language);

    res.status(201).json({
      success: true,
      message: getLocalizedMessageFromRequest('women-help-api.support.added.success', req) || 'Added to women-help-api support waiting list successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Check if user is in women-help-api Support waiting list
 * @route   GET /api/impact/check-women-help-api-support-list
 * @access  Protected
 */
const checkUserInWomenHelpApiSupportList = async (req, res, next) => {
  try {
    console.log('checkUserInWomenHelpApiSupportList is called', req.user);
    const userId = req.user.userId;
    const language = req.language || 'en';

    const result = await impactService.checkUserInWomenHelpApiSupportList(userId, language);

    res.status(200).json({
      success: true,
      message: getLocalizedMessageFromRequest('women-help-api.support.check.success', req) || 'women-help-api support list status retrieved successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Store invite links (Admin only)
 * @route   POST /api/impact/store-invite-links
 * @access  Protected (Admin only)
 */
const storeInviteLinks = async (req, res, next) => {
  try {
    const { invite } = req.body;
    const language = req.language || 'en';

    const result = await impactService.storeInviteLinks(invite, language);

    res.status(200).json({
      success: true,
      message: getLocalizedMessageFromRequest('invite.links.stored.success', req) || 'Invite links stored successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get invite link by key
 * @route   GET /api/impact/get-invite-link/:key
 * @access  Public
 */
const getInviteLink = async (req, res, next) => {
  try {
    const { key } = req.params;
    const language = req.language || 'en';

    const result = await impactService.getInviteLink(key, language);

    res.status(200).json({
      success: true,
      message: getLocalizedMessageFromRequest('invite.link.retrieved.success', req) || 'Invite link retrieved successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get impact summary (target, women helped, breakdowns, monthly trend). Admin only.
 * @route   GET /api/impact/impact-summary
 */
const getImpactSummary = async (req, res) => {
  try {
    // Total target from Impact model
    const impactTarget = await Impact.findOne();
    const targetCount = impactTarget?.targetCount || 0;

    // Total women helped from CollectiveProgress
    const progress = await CollectiveProgress.getOrCreate();
    const totalWomenHelped = progress.womenHelped;

    // Breakdown by plan — all time
    const breakdownByPlan = await ImpactRecord.aggregate([
      {
        $group: {
          _id: '$planKey',
          totalRecords: { $sum: 1 },
          totalMonthsCommitted: { $sum: '$monthsCommitted' }
        }
      }
    ]);

    // Breakdown by event type — all time
    const breakdownByEventType = await ImpactRecord.aggregate([
      {
        $group: {
          _id: '$eventType',
          count: { $sum: 1 }
        }
      }
    ]);

    // Breakdown by platform — all time
    const breakdownByPlatform = await ImpactRecord.aggregate([
      {
        $group: {
          _id: '$platform',
          count: { $sum: 1 }
        }
      }
    ]);

    // Monthly trend — how many women helped per month
    const monthlyTrend = await ImpactRecord.aggregate([
      {
        $group: {
          _id: {
            year: { $year: '$purchaseDate' },
            month: { $month: '$purchaseDate' }
          },
          womenHelped: { $sum: 1 },
          monthsCommitted: { $sum: '$monthsCommitted' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    return res.status(200).json({
      success: true,
      data: {
        targetCount,
        totalWomenHelped,
        progressPercentage: targetCount > 0
          ? Math.min(((totalWomenHelped / targetCount) * 100).toFixed(1), 100)
          : 0,
        breakdownByPlan,
        breakdownByEventType,
        breakdownByPlatform,
        monthlyTrend
      }
    });

  } catch (error) {
    console.error('Failed to fetch impact summary:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch impact summary'
    });
  }
};

module.exports = {
  setTargetCount,
  getCollectiveProgress,
  getCollectiveProgressV1,
  getUserImpact,
  addToWomenHelpApiSupportList,
  checkUserInWomenHelpApiSupportList,
  storeInviteLinks,
  getInviteLink,
  getImpactSummary
};

