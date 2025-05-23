// routes/gameRoutes.js
const express = require('express');
const { 
  fetchGameList, 
  handleGameExit, 
  checkGameBalance,
  transferForWithdrawal,
  placeBetController,
  getGameHistoryController,
  getGameStatsController
} = require('../controllers/gameController');
const { auth, requirePhoneVerification } = require('../middlewares/authMiddleware');
const rateLimiters = require('../middleware/rateLimiter');
const validationRules = require('../middleware/inputValidator');

const router = express.Router();

// Public route to fetch game list
router.get('/games', fetchGameList);

// Route to check if user has enough balance to play games
router.get('/check-balance', 
    auth, 
    rateLimiters.gameBalance,
    checkGameBalance
);

// Route to handle game exit and transfer funds back to main wallet
router.post('/exit', 
    auth, 
    rateLimiters.gameExit,
    handleGameExit
);

// Route to transfer funds from third-party wallet to main wallet for withdrawal
router.post('/transfer-for-withdrawal', 
    auth, 
    rateLimiters.gameTransfer,
    transferForWithdrawal
);

// All game routes require authentication and phone verification
router.use(auth);
router.use(requirePhoneVerification);

// Internal Game Routes
router.post('/internal/crash/bet',
    rateLimiters.internalCrashGame,
    validationRules.game,
    placeBetController
);

router.post('/internal/dice/bet',
    rateLimiters.internalDiceGame,
    validationRules.game,
    placeBetController
);

// External Game Routes
router.post('/external/bet',
    rateLimiters.externalGame,
    validationRules.game,
    placeBetController
);

// Game History Routes
router.get('/internal/history',
    rateLimiters.internalGameHistory,
    getGameHistoryController
);

router.get('/external/history',
    rateLimiters.externalGameHistory,
    getGameHistoryController
);

// Game Stats Routes
router.get('/internal/stats',
    rateLimiters.internalGameStats,
    getGameStatsController
);

router.get('/external/stats',
    rateLimiters.externalGameStats,
    getGameStatsController
);

module.exports = router;
