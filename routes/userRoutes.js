const express = require('express');
const router = express.Router();
const { 
  registerUser, 
  loginUser, 
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
  getDailySymptomsByDate,
  getSymptomHistory,
  getAvailableTimezones,
  getProfileStatusMe,
  completePersonalizationMe,
  DeleteAccount,
  hasInsightsAccess
} = require('../controllers/userController');
const { 
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
} = require('../controllers/menstrualCycleController');
const { 
  getAllFeatures,
  voteOnFeature,
  submitUserIdea
} = require('../controllers/featureController');
const { authenticateToken } = require('../middleware/auth');
const { uploadProfilePicture: uploadMiddleware } = require('../middleware/uploadMiddleware');

// Get all allowed symptoms (public endpoint) - MUST come before /:id routes
router.get('/symptoms', getAllSymptoms);

// Get available timezones (public endpoint)
router.get('/timezones', getAvailableTimezones);

// Delete user account (soft delete)
router.delete('/me/account', authenticateToken, DeleteAccount);

// Get current user's settings (no userId in URL)
router.get('/me/settings', authenticateToken, getUserSettingsMe);

// Update current user's settings (no userId in URL)
router.patch('/me/settings', authenticateToken, updateUserSettingsMe);

// Submit daily symptoms for current user
router.post('/me/daily-symptoms', authenticateToken, submitDailySymptoms);

// Get today's symptoms for current user
router.get('/me/daily-symptoms', authenticateToken, getDailySymptoms);



// Get symptoms for a specific date
router.get('/me/daily-symptoms/:date', authenticateToken, getDailySymptomsByDate);

// Get symptom history for current user (last 30 days)
router.get('/me/symptom-history', authenticateToken, getSymptomHistory);

// Menstrual cycle routes
router.post('/me/menstrual-cycle', authenticateToken, calculateMenstrualCycle);
router.get('/me/menstrual-cycle/current', authenticateToken, getCurrentMenstrualCycle);
router.get('/me/menstrual-cycle/history', authenticateToken, getCycleHistory);
router.get('/me/menstrual-cycle/cycle-summary', authenticateToken, getCycleSummary);
router.get('/me/menstrual-cycle/active-cycles', authenticateToken, getActiveCyclesList);
router.post('/me/calculate-cycle', authenticateToken, calculateCycle);
// router.put('/me/menstrual-cycle/start-date', authenticateToken, updateOnGoingCycleStartDate);
router.put('/me/menstrual-cycle/end-date', authenticateToken, updateOnGoingCycleEndDate);
router.post('/me/menstrual-cycle/predict', authenticateToken, predictTargetCycle);
router.put('/me/menstrual-cycle', authenticateToken, updateCycleById);

// Temporary testing route
router.delete('/me/menstrual-cycle/temp-delete', authenticateToken, tempDeleteData);

// Menstrual flow routes
router.post('/me/menstrual-flow', authenticateToken, storeMenstrualFlow);
router.get('/me/menstrual-flow/latest', authenticateToken, getLatestMenstrualFlow);

// Feature voting routes
router.get('/features', authenticateToken, getAllFeatures);
router.post('/me/features/vote', authenticateToken, voteOnFeature);
router.post('/me/ideas', authenticateToken, submitUserIdea);

// Get current user's information (from token)
router.get('/me', authenticateToken, getUserById);

// Check insights access (subscription or admin)
router.get('/me/has-insights-access', authenticateToken, hasInsightsAccess);

// Get profile completion status (from token)
router.get('/me/profile-status', authenticateToken, getProfileStatusMe);

// Complete personalization (cycle onboarding fields)
router.patch('/me/personalization', authenticateToken, completePersonalizationMe);

// Update current user's profile fields and profile picture (from token)
router.patch('/me', authenticateToken, uploadMiddleware, updateUser);

// Get user settings (only for authenticated user)
router.get('/:id/settings', authenticateToken, getUserSettings);

// Update user settings (only for authenticated user)
router.patch('/:id/settings', authenticateToken, updateUserSettings);

// Upload profile picture (only for authenticated user)
router.post('/:id/profile-picture', authenticateToken, uploadMiddleware, uploadProfilePicture);

// Delete profile picture (only for authenticated user)
router.delete('/:id/profile-picture', authenticateToken, deleteProfilePicture);

// Get current user's settings (no userId in URL)
router.get('/me/settings', authenticateToken, getUserSettingsMe);

// Update current user's settings (no userId in URL)
router.patch('/me/settings', authenticateToken, updateUserSettingsMe);

module.exports = router; 