const Impact = require('../models/Impact');
const User = require('../models/User');
const WomenHelpApiSupportWaitingList = require('../models/WomenHelpApiSupportWaitingList');
const CollectiveProgress = require('../models/CollectiveProgress');
const ImpactRecord = require('../models/ImpactRecord');
const Subscription = require('../models/Subscription');
const subscriptionPlans = require('../config/subscriptionPlans');
const InviteLink = require('../models/InviteLink');
const { ValidationError, DatabaseError } = require('../utils/errors');
const { getLocalizedMessage } = require('../utils/localization');

/**
 * Set target count for Impact
 * Creates record if it doesn't exist, updates if it exists
 * @param {number} targetCount - Target count value
 * @param {string} language - Language code (en or de)
 * @returns {Object} - Updated/created Impact record
 */
const setTargetCount = async (targetCount, language = 'en') => {
  try {
    // Validate targetCount
    if (targetCount === undefined || targetCount === null) {
      throw new ValidationError(getLocalizedMessage('impact.targetCount.required', language) || 'Target count is required');
    }

    if (typeof targetCount !== 'number' || isNaN(targetCount)) {
      throw new ValidationError(getLocalizedMessage('impact.targetCount.invalid', language) || 'Target count must be a valid number');
    }

    if (targetCount < 0) {
      throw new ValidationError(getLocalizedMessage('impact.targetCount.positive', language) || 'Target count must be a positive number');
    }

    // Find existing record (there should only be one record)
    let impact = await Impact.findOne();

    if (impact) {
      // Update existing record
      impact.targetCount = targetCount;
      await impact.save();
    } else {
      // Create new record
      impact = new Impact({
        targetCount: targetCount
      });
      await impact.save();
    }

    return {
      targetCount: impact.targetCount
    };
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      throw new ValidationError(getLocalizedMessage('error.validation.error', language), validationErrors);
    }
    throw new DatabaseError(getLocalizedMessage('failed.set.target.count', language) || 'Failed to set target count');
  }
};

/** TODO: we will implement this again after AIAP and GPB
 * Get collective progress - total women helped and percentage
 * Also includes user's impact if they have a subscription plan
 * @param {string} userId - User ID from token
 * @param {string} language - Language code (en or de)
 * @returns {Object} - Total women helped, percentage, and user's impact
 */

const getCollectiveProgress = async (userId, language = 'en') => {
  try {
    // Get women helped count from CollectiveProgress collection
    const collectiveProgress = await CollectiveProgress.getOrCreate();
    const totalWomenHelped = collectiveProgress.womenHelped || 0;

    // Get target count from Impact collection
    const impact = await Impact.findOne();
    const targetCount = impact ? impact.targetCount : 0;

    // Calculate percentage
    let percentage = 0;
    if (targetCount > 0) {
      percentage = (totalWomenHelped / targetCount) * 100;
      // Round to 2 decimal places to preserve precision
      percentage = Math.round(percentage * 100) / 100;
    }

    // Get user's subscription plan to determine their impact
    let yourImpact = null;
    if (userId) {
      const subscription = await Subscription.findOne({
        userId,
        status: 'active'
      }).sort({ createdAt: -1 });
      if (subscription && subscription.planKey) {
        const plan = subscriptionPlans.find(p => p.key === subscription.planKey);
        if (plan && plan.description) {
          yourImpact = plan.description[language] || plan.description.en;
        }
      }
    }

    const result = {
      totalWomenHelped,
      targetCount,
      percentage
    };

    // Only include yourImpact if user has a subscription plan
    if (yourImpact) {
      result.yourImpact = yourImpact;
    }

    return result;
  } catch (error) {
    throw new DatabaseError(getLocalizedMessage('failed.get.collective.progress', language) || 'Failed to get collective progress');
  }
};

/**
 * V1 collective progress — focuses on number of months helped instead of women helped.
 *
 * The source of truth is the `ImpactRecord` collection: every INITIAL_PURCHASE /
 * RENEWAL / RESUBSCRIBE creates exactly one ImpactRecord with `monthsCommitted`
 * equal to the plan's contribution (Impact = 1, Impact Plus = 5, Max Impact = 12).
 * The unique `transactionId` index on ImpactRecord guarantees we never double-count
 * even if a webhook is redelivered.
 *
 * Response shape:
 *   { totalMonthsHelped, targetCount, percentage }
 *
 * `targetCount` is read from the `Impact` collection and is interpreted (per the
 * new product spec) as the *months* helping target, not women.
 *
 * @param {string} language - Language code (en or de) — used for error localization only
 * @returns {Promise<{ totalMonthsHelped: number, targetCount: number, percentage: number }>}
 */
const getCollectiveProgressV1 = async (language = 'en') => {
  try {
    // Aggregate total months committed across every ImpactRecord. Returns either
    // `[{ total: <number> }]` or `[]` (when there are no records yet).
    const totals = await ImpactRecord.aggregate([
      { $group: { _id: null, total: { $sum: '$monthsCommitted' } } }
    ]);
    const totalMonthsHelped = totals.length > 0 ? (totals[0].total || 0) : 0;

    const impact = await Impact.findOne();
    const targetCount = impact ? impact.targetCount : 0;

    // Percentage of the months-helped target reached. Rounded to 2 decimals to
    // match the precision convention used by the V0 endpoint.
    let percentage = 0;
    if (targetCount > 0) {
      percentage = (totalMonthsHelped / targetCount) * 100;
      percentage = Math.round(percentage * 100) / 100;
    }

    return { totalMonthsHelped, targetCount, percentage };
  } catch (error) {
    throw new DatabaseError(getLocalizedMessage('failed.get.collective.progress', language) || 'Failed to get collective progress');
  }
};

/**
 * Map a plan key to the localization key for its "yourImpact" copy.
 */
const PLAN_KEY_TO_IMPACT_MESSAGE_KEY = {
  impact: 'impact.yourImpact.impact',
  impactplus: 'impact.yourImpact.plus',
  maximpact: 'impact.yourImpact.max',
  // Grandfathered yearly Impact subscribers: 3 months of access per yearly cycle.
  impact_legacy_yearly: 'impact.yourImpact.impactLegacyYearly'
};

/**
 * Get the current user's impact: whether they have an active subscription
 * and, if so, the localized "yourImpact" message for their plan.
 *
 * Response shape:
 *   { hasSubscription: true,  yourImpact: '...' }   // active subscription
 *   { hasSubscription: false, yourImpact: null }    // no active subscription
 *
 * @param {string} userId - User ID from auth token
 * @param {string} language - Language code (en or de)
 * @returns {Promise<Object>}
 */
const getUserImpact = async (userId, language = 'en') => {
  try {
    if (!userId) {
      throw new ValidationError(getLocalizedMessage('error.user.not.found', language) || 'User not found');
    }

    // Confirm the user still exists and is not soft-deleted before reporting impact.
    const user = await User.findById(userId);
    if (!user || user.isDeleted) {
      return { hasSubscription: false, yourImpact: null };
    }

    // An "active" subscription here means RevenueCat-synced status === 'active'.
    // We sort by createdAt desc to be defensive in case multiple rows exist; the
    // unique partial index on { userId, status: 'active' } means there is at most one.
    const subscription = await Subscription.findOne({
      userId,
      status: 'active'
    }).sort({ createdAt: -1 });

    if (!subscription || !subscription.planKey) {
      return { hasSubscription: false, yourImpact: null };
    }

    const messageKey = PLAN_KEY_TO_IMPACT_MESSAGE_KEY[subscription.planKey];
    if (!messageKey) {
      // Unknown planKey on an active subscription — treat as subscribed but with no
      // recognised copy, rather than misreporting hasSubscription as false.
      console.warn(`getUserImpact: unknown planKey "${subscription.planKey}" for user ${userId}`);
      return { hasSubscription: true, yourImpact: null };
    }

    return {
      hasSubscription: true,
      yourImpact: getLocalizedMessage(messageKey, language)
    };
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new DatabaseError(getLocalizedMessage('failed.get.user.impact', language) || 'Failed to get user impact');
  }
};

/**
 * Add user to women-help-api Support waiting list
 * @param {string} userId - User ID
 * @param {Object} supportData - Support data (firstName, location, contact)
 * @param {string} language - Language code (en or de)
 * @returns {Object} - Created waiting list entry
 */
const addToWomenHelpApiSupportList = async (userId, supportData, language = 'en') => {
  try {
    const { firstName, location, contact } = supportData;

    // Validate required fields
    if (!location || !location.trim()) {
      throw new ValidationError(getLocalizedMessage('women-help-api.support.location.required', language) || 'Location is required');
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      throw new ValidationError(getLocalizedMessage('error.user.not.found', language));
    }

    // Check if user is already in the waiting list
    const existingEntry = await WomenHelpApiSupportWaitingList.findOne({ userId: userId });
    if (existingEntry) {
      throw new ValidationError(getLocalizedMessage('women-help-api.support.already.added', language) || 'You are already added to the waiting list');
    }

    // Create new waiting list entry
    const waitingListEntry = new WomenHelpApiSupportWaitingList({
      userId: userId,
      firstName: firstName ? firstName.trim() : null,
      location: location.trim(),
      contact: contact ? contact.trim() : null
    });

    await waitingListEntry.save();

    return {
      _id: waitingListEntry._id,
      userId: waitingListEntry.userId,
      firstName: waitingListEntry.firstName,
      location: waitingListEntry.location,
      contact: waitingListEntry.contact,
      createdAt: waitingListEntry.createdAt,
      updatedAt: waitingListEntry.updatedAt
    };
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      throw new ValidationError(getLocalizedMessage('error.validation.error', language), validationErrors);
    }
    throw new DatabaseError(getLocalizedMessage('failed.add.women-help-api.support', language) || 'Failed to add to women-help-api support list');
  }
};

/**
 * Check if user is in women-help-api Support waiting list
 * @param {string} userId - User ID
 * @param {string} language - Language code (en or de)
 * @returns {Object} - Status and entry details if found
 */
const checkUserInWomenHelpApiSupportList = async (userId, language = 'en') => {
  try {
    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      throw new ValidationError(getLocalizedMessage('error.user.not.found', language));
    }

    // Check if user is in the waiting list
    const waitingListEntry = await WomenHelpApiSupportWaitingList.findOne({ userId: userId });

    if (waitingListEntry) {
      return {
        isInList: true,
        entry: {
          _id: waitingListEntry._id,
          userId: waitingListEntry.userId,
          firstName: waitingListEntry.firstName,
          location: waitingListEntry.location,
          contact: waitingListEntry.contact,
          createdAt: waitingListEntry.createdAt,
          updatedAt: waitingListEntry.updatedAt
        }
      };
    } else {
      return {
        isInList: false,
        entry: null
      };
    }
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new DatabaseError(getLocalizedMessage('failed.check.women-help-api.support', language) || 'Failed to check women-help-api support list status');
  }
};

/**
 * Increment women helped count by 2 for successful subscription purchase
 * Creates CollectiveProgress record if it doesn't exist
 * @param {string} language - Language code (en or de)
 * @returns {Object} - Updated CollectiveProgress record
 */
const incrementWomenHelped = async (language = 'en') => {
  try {
    // Get or create the collective progress document
    let collectiveProgress = await CollectiveProgress.getOrCreate();
    
    // Increment women helped by 2
    collectiveProgress.womenHelped += 2;
    await collectiveProgress.save();
    
    console.log(`✅ Women helped count incremented by 2. New total: ${collectiveProgress.womenHelped}`);
    
    return {
      womenHelped: collectiveProgress.womenHelped
    };
  } catch (error) {
    console.error('Error incrementing women helped:', error);
    throw new DatabaseError(getLocalizedMessage('failed.increment.women.helped', language) || 'Failed to increment women helped count');
  }
};

/**
 * Store invite links (Admin only)
 * Creates record if it doesn't exist, updates if it exists
 * @param {Object} inviteData - Invite link data (android, ios, dynamic)
 * @param {string} language - Language code (en or de)
 * @returns {Object} - Updated/created InviteLink record
 */
const storeInviteLinks = async (inviteData, language = 'en') => {
  try {
    // Validate inviteData
    if (!inviteData || typeof inviteData !== 'object') {
      throw new ValidationError(getLocalizedMessage('invite.data.required', language) || 'Invite data is required');
    }

    const { android, ios, dynamic } = inviteData;

    // Find existing record (there should only be one record)
    let inviteLink = await InviteLink.findOne();

    if (inviteLink) {
      // Update existing record
      inviteLink.invite.android = android !== undefined ? android : inviteLink.invite.android;
      inviteLink.invite.ios = ios !== undefined ? ios : inviteLink.invite.ios;
      inviteLink.invite.dynamic = dynamic !== undefined ? dynamic : inviteLink.invite.dynamic;
      await inviteLink.save();
    } else {
      // Create new record
      inviteLink = new InviteLink({
        invite: {
          android: android || null,
          ios: ios || null,
          dynamic: dynamic || null
        }
      });
      await inviteLink.save();
    }

    return {
      invite: {
        android: inviteLink.invite.android,
        ios: inviteLink.invite.ios,
        dynamic: inviteLink.invite.dynamic
      }
    };
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      throw new ValidationError(getLocalizedMessage('error.validation.error', language), validationErrors);
    }
    throw new DatabaseError(getLocalizedMessage('failed.store.invite.links', language) || 'Failed to store invite links');
  }
};

/**
 * Get invite link by key (android, ios, or dynamic)
 * @param {string} key - The key to retrieve (android, ios, or dynamic)
 * @param {string} language - Language code (en or de)
 * @returns {Object} - The invite link value
 */
const getInviteLink = async (key, language = 'en') => {
  try {
    // Validate key
    const validKeys = ['android', 'ios', 'dynamic'];
    if (!key || !validKeys.includes(key)) {
      throw new ValidationError(getLocalizedMessage('invite.key.invalid', language) || 'Invalid invite key. Must be one of: android, ios, dynamic');
    }

    // Find the invite link document (should only be one)
    const inviteLink = await InviteLink.findOne();

    if (!inviteLink) {
      throw new ValidationError(getLocalizedMessage('invite.unavailable', language) || 'Invite unavailable, please try again later.');
    }

    const linkValue = inviteLink.invite[key];

    // Check if the requested link value is null
    if (linkValue === null || linkValue === undefined) {
      throw new ValidationError(getLocalizedMessage('invite.unavailable', language) || 'Invite unavailable, please try again later.');
    }

    return {
      key: key,
      link: linkValue
    };
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new DatabaseError(getLocalizedMessage('failed.get.invite.link', language) || 'Failed to get invite link');
  }
};

module.exports = {
  setTargetCount,
  getCollectiveProgress,
  getCollectiveProgressV1,
  getUserImpact,
  addToWomenHelpApiSupportList,
  checkUserInWomenHelpApiSupportList,
  incrementWomenHelped,
  storeInviteLinks,
  getInviteLink
};

