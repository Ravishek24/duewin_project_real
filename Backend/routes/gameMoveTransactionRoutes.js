const express = require('express');
const router = express.Router();
// NOTE: Auth middleware is applied at router level in index.js
const {
    getUserGameMoveTransactions,
    getGameMoveTransactionStats,
    getGameMoveTransactionById
} = require('../controllers/gameMoveTransactionController');
const rateLimiters = require('../middleware/rateLimiter');

/**
 * Game Move Transaction Routes
 * 
 * These routes allow users to view their game move in/out transactions
 * that are recorded when they join and leave game rooms.
 */

// Get user's game move transactions with pagination and filters - Rate limited
router.get('/my', rateLimiters.gameMoveTransactions, getUserGameMoveTransactions);

// Get game move transaction statistics for user - Rate limited
router.get('/stats', rateLimiters.gameMoveTransactions, getGameMoveTransactionStats);

// Get specific game move transaction by ID - Rate limited
router.get('/:id', rateLimiters.gameMoveTransactions, getGameMoveTransactionById);

module.exports = router; 