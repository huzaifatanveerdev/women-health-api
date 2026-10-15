const FeatureVote = require('../models/FeatureVote');
const UserIdea = require('../models/UserIdea');
const { ValidationError, DatabaseError } = require('../utils/errors');
const { getLocalizedMessageFromRequest } = require('../utils/localization');

// Static features list — voting candidates surfaced on the Feedback screen.
//
// `name` is stored as a `{ en, de }` map so the API can return the user's
// preferred language (driven by the global `languageMiddleware`, which sets
// `req.language` from the `Accept-Language` header). The HTTP response shape
// stays flat (`{ id, name: <string>, voteCount, currentUserVoted }`) so the
// frontend does not need to change — it still renders `item.name` directly.
const FEATURES = [
  {
    id: 1,
    name: {
      en: 'Mood Tracker',
      de: 'Stimmungs-Tracker'
    }
  },
  {
    id: 2,
    name: {
      en: 'Share my cycle with my partner',
      de: 'Teile meinen Zyklus mit meinem Partner'
    }
  },
  {
    id: 3,
    name: {
      en: 'No periods while taking the pill',
      de: 'Keine Periode durch die Pille'
    }
  }
];

/**
 * Resolve a feature's display name in the requested language, falling back to
 * English if the requested language is missing. Tolerant of legacy string-only
 * `name` values just in case the array is ever reverted to the old shape.
 *
 * @param {{ name: string | { en?: string, de?: string } } | undefined} feature
 * @param {string} language - 'en' or 'de'
 * @returns {string}
 */
const getLocalizedFeatureName = (feature, language) => {
  if (!feature || feature.name == null) return '';
  if (typeof feature.name === 'string') return feature.name;
  return feature.name[language] || feature.name.en || '';
};

/**
 * Get all features with vote counts and current user's vote status
 */
const getAllFeatures = async (req, res, next) => {
  try {
    const language = req.language || 'en';
    const featuresWithVotes = [];
    
    // Get current user's votes (if authenticated)
    let userVotes = [];
    if (req.user && req.user.userId) {
      userVotes = await FeatureVote.find({ userId: req.user.userId });
    }

    for (const feature of FEATURES) {
      const voteCount = await FeatureVote.countDocuments({ featureId: feature.id });
      const currentUserVoted = userVotes.some(vote => vote.featureId === feature.id);
      
      featuresWithVotes.push({
        id: feature.id,
        name: getLocalizedFeatureName(feature, language),
        voteCount,
        currentUserVoted
      });
    }

    res.json({
      success: true,
      data: featuresWithVotes
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Vote on a feature
 */
const voteOnFeature = async (req, res, next) => {
  try {
    const { featureId } = req.body;
    
    if (!featureId) {
      return res.status(400).json({
        success: false,
        message: getLocalizedMessageFromRequest('feature.id.required', req),
        data: null
      });
    }

    // Validate feature ID
    if (!FEATURES.find(f => f.id === featureId)) {
      return res.status(400).json({
        success: false,
        message: getLocalizedMessageFromRequest('feature.id.invalid', req),
        data: null
      });
    }

    // Check if user already voted on this specific feature
    const existingVote = await FeatureVote.findOne({ 
      userId: req.user.userId,
      featureId 
    });
    
    if (existingVote) {
      return res.status(400).json({
        success: false,
        message: getLocalizedMessageFromRequest('feature.already.voted', req),
        data: null
      });
    }

    // Create new vote
    const vote = new FeatureVote({
      userId: req.user.userId,
      featureId
    });

    await vote.save();

    const language = req.language || 'en';
    res.json({
      success: true,
      message: getLocalizedMessageFromRequest('feature.vote.submitted', req),
      data: {
        featureId,
        featureName: getLocalizedFeatureName(FEATURES.find(f => f.id === featureId), language),
        votedAt: vote.votedAt
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Submit user idea for app improvement
 */
const submitUserIdea = async (req, res, next) => {
  try {
    const { idea } = req.body;
    
    if (!idea || idea.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: getLocalizedMessageFromRequest('idea.required', req),
        data: null
      });
    }

    if (idea.trim().length > 1000) {
      return res.status(400).json({
        success: false,
        message: getLocalizedMessageFromRequest('idea.too.long', req),
        data: null
      });
    }

    // Create new idea
    const userIdea = new UserIdea({
      userId: req.user.userId,
      idea: idea.trim()
    });

    await userIdea.save();

    res.json({
      success: true,
      message: getLocalizedMessageFromRequest('idea.submitted', req),
      data: {
        ideaId: userIdea._id,
        idea: userIdea.idea,
        submittedAt: userIdea.submittedAt
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllFeatures,
  voteOnFeature,
  submitUserIdea
};