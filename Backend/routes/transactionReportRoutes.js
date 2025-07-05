const express = require('express');
const router = express.Router();
const { auth } = require('../middlewares/authMiddleware');
const {
    getUserTransactionReport,
    getUserTransactionStats
} = require('../controllers/transactionReportController');

/**
 * Transaction Report Routes
 * 
 * These routes provide comprehensive transaction reports and statistics
 * for the authenticated user.
 */

// Get comprehensive transaction report for the authenticated user
router.get('/my', auth, getUserTransactionReport);

// Get transaction statistics summary for the authenticated user
router.get('/my/stats', auth, getUserTransactionStats);

module.exports = router; 