const userService = require('../services/userService');
const { getInsightsAccess } = require('../services/insightsAccessService');
const { getCommonTimezones } = require('../utils/timezone');
const { getLocalizedMessageFromRequest } = require('../utils/localization');
const { getAuthProvider, deriveIsProfileComplete } = require('../utils/userAuthHelpers');
const menstrualCycleService = require('../services/menstrualCycleService');


// @desc    Get current user's information (from token)
// @route   GET /api/users/me
// @access  Protected
const getUserById = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const user = await userService.getUserById(userId, req.language || 'en');

    const userObj = user.toObject ? user.toObject() : user;
    res.status(200).json({
      success: true,
      data: {
        ...userObj,
        authProvider: getAuthProvider(user),
        isProfileComplete: deriveIsProfileComplete(user)
      }
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Update current user's profile fields (name, phone, gender, dob, profilePicture)
// @route   PATCH /api/users/me
// @access  Protected
const updateUser = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    // Extract profile fields from request body
    const { name, phone, gender, dob } = req.body;
    const updateData = { name, phone, gender, dob };

    // Handle profile picture if uploaded
    let imageBuffer = null;
    if (req.file) {
      imageBuffer = req.file.buffer;
    }

    const updatedUser = await userService.updateUserWithProfilePicture(userId, updateData, imageBuffer, req.language || 'en');
    
    res.status(200).json({
      success: true,
      message: getLocalizedMessageFromRequest('user.updated', req),
      data: updatedUser
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user settings
// @route   GET /api/users/:id/settings
// @access  Protected (only the user themself)
const getUserSettings = async (req, res, next) => {
  try {
    const authenticatedUserId = req.user.userId;

    const settings = await userService.getUserSettings(authenticatedUserId, req.language || 'en');
    
    res.status(200).json({
      success: true,
      data: settings
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user settings
// @route   PATCH /api/users/:id/settings
// @access  Protected (only the user themself)
const updateUserSettings = async (req, res, next) => {
  try {
    const authenticatedUserId = req.user.userId;

    const updatedSettings = await userService.updateUserSettings(authenticatedUserId, req.body, req.language || 'en');

    res.status(200).json({
      success: true,
      message: getLocalizedMessageFromRequest('user.settings.updated', req),
      data: updatedSettings
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Upload profile picture
// @route   POST /api/users/:id/profile-picture
// @access  Protected (only the user themself)
const uploadProfilePicture = async (req, res, next) => {
  try {
    const { id } = req.params;
    const authenticatedUserId = req.user.userId;
    
    if (id !== authenticatedUserId) {
      return res.status(403).json({
        success: false,
        message: getLocalizedMessageFromRequest('error.access.denied.picture', req)
      });
    }

    const imageBuffer = req.file.buffer;
    const updatedUser = await userService.updateProfilePicture(id, imageBuffer, req.language || 'en');

    res.status(200).json({
      success: true,
      message: getLocalizedMessageFromRequest('user.profile.picture.uploaded', req),
      data: {
        profilePicture: updatedUser.profilePicture,
        user: {
          _id: updatedUser._id,
          name: updatedUser.name,
          email: updatedUser.email
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete profile picture
// @route   DELETE /api/users/:id/profile-picture
// @access  Protected (only the user themself)
const deleteProfilePicture = async (req, res, next) => {
  try {
    const { id } = req.params;
    const authenticatedUserId = req.user.userId;
    
    if (id !== authenticatedUserId) {
      return res.status(403).json({
        success: false,
        message: getLocalizedMessageFromRequest('error.access.denied.delete.picture', req)
      });
    }

    const updatedUser = await userService.deleteProfilePicture(id, req.language || 'en');

    res.status(200).json({
      success: true,
      message: getLocalizedMessageFromRequest('user.profile.picture.deleted', req),
      data: {
        user: {
          _id: updatedUser._id,
          name: updatedUser.name,
          email: updatedUser.email,
          profilePicture: updatedUser.profilePicture
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current user's settings (from token)
// @route   GET /api/users/me/settings
// @access  Protected
const getUserSettingsMe = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const settings = await userService.getUserSettings(userId, req.language || 'en');
    res.status(200).json({
      success: true,
      data: settings
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update current user's settings (from token)
// @route   PATCH /api/users/me/settings
// @access  Protected
const updateUserSettingsMe = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const updatedSettings = await userService.updateUserSettings(userId, req.body, req.language || 'en');
    res.status(200).json({
      success: true,
      message: getLocalizedMessageFromRequest('user.settings.updated', req),
      data: updatedSettings
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all allowed symptoms (static list)
// @route   GET /api/users/symptoms
// @access  Public
const getAllSymptoms = async (req, res, next) => {
  try {
    const symptoms = userService.getAllSymptoms();
    
    res.status(200).json({
      success: true,
      data: symptoms
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Submit daily symptoms for the logged-in user (can also remove symptoms if array is empty)
// @route   POST /api/users/me/daily-symptoms
// @access  Protected
const submitDailySymptoms = async (req, res, next) => {
  try {
    const authenticatedUserId = req.user.userId;
    const { symptoms, timezone = 'UTC' } = req.body;

    if (!symptoms || !Array.isArray(symptoms)) {
      return res.status(400).json({
        success: false,
        message: getLocalizedMessageFromRequest('error.symptoms.array.required', req)
      });
    }

    let result;
    
    if (symptoms.length === 0) {
      // If symptoms array is empty, find and remove today's symptoms
      const today = new Date();
      const todayDateString = today.toISOString().split('T')[0];
      
      // Find today's entry and remove it if it exists
      const entries = await userService.getDailySymptoms(authenticatedUserId, timezone, req.language || 'en');
      
      if (entries) {
        // Remove the entry
        await userService.deleteDailySymptom(entries._id, req.language || 'en');
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
      // If symptoms array has items, add/update symptoms as before
      const dailyEntry = await userService.submitDailySymptoms(authenticatedUserId, symptoms, timezone, req.language || 'en');
      
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

// @desc    Get today's symptoms for the logged-in user
// @route   GET /api/users/me/daily-symptoms
// @access  Protected
const getDailySymptoms = async (req, res, next) => {
  try {
    const authenticatedUserId = req.user.userId;
    const { timezone = 'UTC' } = req.query;
    
    const dailyEntry = await userService.getDailySymptoms(authenticatedUserId, timezone, req.language || 'en');
    
    res.status(200).json({
      success: true,
      data: dailyEntry
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update today's symptoms for the logged-in user
// @route   PUT /api/users/me/daily-symptoms
// @access  Protected
const updateDailySymptoms = async (req, res, next) => {
  try {
    const authenticatedUserId = req.user.userId;
    const { symptoms, timezone = 'UTC' } = req.body;

    if (!symptoms || !Array.isArray(symptoms)) {
      return res.status(400).json({
        success: false,
        message: getLocalizedMessageFromRequest('error.symptoms.array.invalid', req)
      });
    }

    const dailyEntry = await userService.updateDailySymptoms(authenticatedUserId, symptoms, timezone, req.language || 'en');
    
    res.status(200).json({
      success: true,
      message: getLocalizedMessageFromRequest('symptoms.updated', req),
      data: dailyEntry
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get symptoms for a specific date
// @route   GET /api/users/me/daily-symptoms/:date
// @access  Protected
const getDailySymptomsByDate = async (req, res, next) => {
  try {
    const authenticatedUserId = req.user.userId;
    const { date } = req.params;
    const { timezone = 'UTC' } = req.query;
    
    const dailyEntry = await userService.getDailySymptomsByDate(authenticatedUserId, date, timezone, req.language || 'en');
    
    res.status(200).json({
      success: true,
      data: dailyEntry
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get symptom history for the logged-in user (last 30 days)
// @route   GET /api/users/me/symptom-history
// @access  Protected
const getSymptomHistory = async (req, res, next) => {
  try {
    const authenticatedUserId = req.user.userId;
    const { timezone = 'UTC' } = req.query;
    
    const history = await userService.getSymptomHistory(authenticatedUserId, timezone, req.language || 'en');
    
    res.status(200).json({
      success: true,
      data: history
    });
  } catch (error) {
    next(error);
  }
};



// @desc    Get available timezones
// @route   GET /api/users/timezones
// @access  Public
const getAvailableTimezones = async (req, res, next) => {
  try {
    const timezones = getCommonTimezones();
    
    res.status(200).json({
      success: true,
      data: timezones
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get whether current user's personalization profile is complete
// @route   GET /api/users/me/profile-status
// @access  Protected
const getProfileStatusMe = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const status = await userService.getProfileStatus(userId, req.language || 'en');

    res.status(200).json({
      success: true,
      data: status
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Complete personalization profile (cycle onboarding fields)
// @route   PATCH /api/users/me/personalization
// @access  Protected
const completePersonalizationMe = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    console.log('completePersonalizationMe', userId, req.body, req.language || 'en');
    const result = await userService.completePersonalization(
      userId,
      req.body,
      req.language || 'en'
    );

    console.log('completePersonalization completed for userId', userId);

    console.log('calculateCycle starting for userId', userId);

    menstrualCycleService.calculateCycle(req.user.userId);

    console.log('calculateCycle completed for userId', userId);

    res.status(200).json({
      success: true,
      message: getLocalizedMessageFromRequest('personalization.completed', req),
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete user account (soft delete)
// @route   DELETE /api/users/me/account
// @access  Protected
const DeleteAccount = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    
    const deletedUser = await userService.deleteAccount(userId, req.language || 'en');
    
    res.status(200).json({
      success: true,
      message: getLocalizedMessageFromRequest('account.deleted', req),
      data: {
        _id: deletedUser._id,
        email: deletedUser.email,
        IsDeleted: deletedUser.IsDeleted,
        DeletedAt: deletedUser.DeletedAt
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Check whether the current user has access to insights features
// @route   GET /api/users/me/has-insights-access
// @access  Protected
const hasInsightsAccess = async (req, res, next) => {
  try {
    const data = await getInsightsAccess(req.user.userId, req.user.email);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUserById,
  updateUser,
  getUserSettings,
  updateUserSettings,
  uploadProfilePicture,
  deleteProfilePicture,
  getUserSettingsMe,
  updateUserSettingsMe,
  getAllSymptoms,
  submitDailySymptoms,
  getDailySymptoms,
  updateDailySymptoms,
  getDailySymptomsByDate,
  getSymptomHistory,
  getAvailableTimezones,
  getProfileStatusMe,
  completePersonalizationMe,
  DeleteAccount,
  hasInsightsAccess
}; 