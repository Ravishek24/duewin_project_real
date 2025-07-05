const express = require('express');
const router = express.Router();
const { auth } = require('../middlewares/authMiddleware');
const {
    getUserGameMoveTransactions,
    getGameMoveTransactionStats,
    getGameMoveTransactionById
} = require('../controllers/gameMoveTransactionController');

/**
 * Game Move Transaction Routes
 * 
 * These routes allow users to view their game move in/out transactions
 * that are recorded when they join and leave game rooms.
 */

// Get user's game move transactions with pagination and filters
router.get('/my', auth, getUserGameMoveTransactions);

// Get game move transaction statistics for user
router.get('/stats', auth, getGameMoveTransactionStats);

// Get specific game move transaction by ID
router.get('/:id', auth, getGameMoveTransactionById);

module.exports = router; 