const express = require('express');
const router = express.Router();
// NOTE: Auth middleware is applied at router level in index.js (auth)
const {
    getUserTransactionReport,
    getUserTransactionStats
} = require('../controllers/transactionReportController');
const rateLimiters = require('../middleware/rateLimiter');

/**
 * Transaction Report Routes
 * 
 * These routes provide comprehensive transaction reports and statistics
 * for the authenticated user.
 */

// Get comprehensive transaction report for the authenticated user - Rate limited
router.get('/my', rateLimiters.transactionReports, getUserTransactionReport);

// Get transaction statistics summary for the authenticated user - Rate limited
router.get('/my/stats', rateLimiters.transactionReports, getUserTransactionStats);

module.exports = router; 