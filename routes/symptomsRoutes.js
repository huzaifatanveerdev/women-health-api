const express = require('express');
const router = express.Router();
const { seedSymptoms, getSymptoms, submitDailySymptoms, getTodayDailySymptoms, getDailySymptomsByDate } = require('../controllers/symptomsController');
const {
  getOngoingCycleSymptomPhases,
  getSymptomPhasesByCycleId,
  getSymptomInsightsPatterns,
  getSymptomsWithLoggedDates
} = require('../controllers/symptomInsightsController');
const { authenticateToken } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/adminAuth');

// Get symptoms grouped by category (protected)
router.get('/', authenticateToken, getSymptoms);

// Symptom insights / reporting (protected) — must be before /daily/:date
router.get('/insights/ongoing-phases', authenticateToken, getOngoingCycleSymptomPhases);
router.get('/insights/cycle', authenticateToken, getSymptomPhasesByCycleId);
router.get('/insights/by-date', authenticateToken, getSymptomsWithLoggedDates);
router.get('/insights/patterns', authenticateToken, getSymptomInsightsPatterns);

// Get today's symptoms (protected)
router.get('/daily', authenticateToken, getTodayDailySymptoms);

// Get symptoms by date (protected)
router.get('/daily/:date', authenticateToken, getDailySymptomsByDate);

// Submit daily symptoms (protected)
router.post('/daily', authenticateToken, submitDailySymptoms);

// Seed symptoms (protected - admin only)
router.post('/seed', authenticateToken, requireAdmin, seedSymptoms);

module.exports = router;
