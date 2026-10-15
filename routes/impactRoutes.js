const express = require('express');
const router = express.Router();
const { setTargetCount, getCollectiveProgress, getCollectiveProgressV1, getUserImpact, addToWomenHelpApiSupportList, checkUserInWomenHelpApiSupportList, storeInviteLinks, getInviteLink, getImpactSummary } = require('../controllers/impactController');
const { authenticateToken } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/adminAuth');

// Get collective progress (protected - requires authentication)
//router.get('/collective-progress', authenticateToken, getCollectiveProgress);

// Get collective progress V1 — totalMonthsHelped instead of totalWomenHelped (protected)
router.get('/v1/collective-progress', authenticateToken, getCollectiveProgressV1);

// Get current user's impact (protected - requires authentication)
router.get('/user-impact', authenticateToken, getUserImpact);

// Set target count (protected - admin only)
router.post('/set-target-count', authenticateToken, requireAdmin, setTargetCount);

// Get impact summary (protected - admin only)
router.get('/impact-summary', authenticateToken, requireAdmin, getImpactSummary);

// Add to women-help-api support waiting list (protected)
router.post('/add-to-women-help-api-support-list', authenticateToken, addToWomenHelpApiSupportList);

// Check if user is in women-help-api support waiting list (protected)
router.get('/check-women-help-api-support-list', authenticateToken, checkUserInWomenHelpApiSupportList);

// Store invite links (protected - admin only)
router.post('/store-invite-links', authenticateToken, requireAdmin, storeInviteLinks);

// Get invite link by key (public)
router.get('/get-invite-link/:key', getInviteLink);

module.exports = router;

