// Backend/routes/internalGameRoutes.js
const express = require('express');
const { auth, requirePhoneVerification } = require('../middlewares/authMiddleware');
const { isAdmin } = require('../middleware/authMiddleware');
const gameLogicService = require('../services/gameLogicService');
const models = require('../models');
const rateLimiters = require('../middleware/rateLimiter');
const gameHistoryController = require('../controllers/gameHistoryController');

const router = express.Router();

// Destructure models
const {
    BetRecordWingo,
    BetRecord5D,
    BetRecordK3,
    BetRecordTrxWix
} = models;

/**
 * Get active periods for a game
 */
router.get('/:gameType/active', auth, async (req, res) => {
  try {
    const { gameType } = req.params;
    const activePeriods = await gameLogicService.getActivePeriods(gameType);
    res.json({ success: true, activePeriods });
  } catch (error) {
    console.error('Error getting active periods:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get active periods'
    });
  }
});

/**
 * Get period details with result if available
 */
router.get('/:gameType/periods/:periodId', auth, async (req, res) => {
  try {
    const { gameType, periodId } = req.params;
    const { duration } = req.query;
    
    // Convert duration to number
    const durationNum = duration ? parseInt(duration) : 60;
    
    const periodDetails = await gameLogicService.getPeriodStatus(gameType, durationNum, periodId);
    res.json({ success: true, periodDetails });
  } catch (error) {
    console.error('Error getting period details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get period details'
    });
  }
});

/**
 * Get game history
 */
router.get('/:gameType/history', auth, async (req, res) => {
  try {
    let { gameType } = req.params;
    const { page = 1, limit = 20, duration = 60 } = req.query;
    
    console.log(`History request received for ${gameType}, duration ${duration}, page ${page}, limit ${limit}`);
    
    // Convert page to offset
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    // Map API game types to database game types
    const gameTypeMap = {
      'trx_wix': 'trx_wix',
      '5d': 'fiveD',
      'k3': 'k3',
      'wingo': 'wingo',
      'fiveD': 'fiveD'
    };
    
    // Use the mapped game type or the original if not found
    const mappedGameType = gameTypeMap[gameType.toLowerCase()] || gameType;
    console.log(`Mapped game type from ${gameType} to ${mappedGameType}`);
    
    const history = await gameLogicService.getGameHistory(
      mappedGameType, 
      parseInt(duration),
      parseInt(limit),
      offset
    );
    
    if (history.success === false) {
      console.error(`Error from getGameHistory: ${history.message}`);
      return res.status(500).json(history);
    }
    
    // Log some details about the results
    if (history.results && history.results.length > 0) {
      console.log(`Returning ${history.results.length} results`);
      console.log(`First result: ${JSON.stringify(history.results[0])}`);
      console.log(`Last result: ${JSON.stringify(history.results[history.results.length - 1])}`);
    } else {
      console.log('No results found');
    }
    
    return res.json({ success: true, ...history });
  } catch (error) {
    console.error('Error getting game history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get game history'
    });
  }
});

/**
 * Place a bet
 */
router.post('/:gameType/bet', auth, requirePhoneVerification, async (req, res) => {
  try {
    const { gameType } = req.params;
    const { 
      periodId, 
      duration, 
      betType, 
      betCategory, 
      betValue, 
      betAmount 
    } = req.body;
    
    // Validate required fields
    if (!periodId || !duration || !betType || !betValue || !betAmount) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }
    
    // Process the bet
    const result = await gameLogicService.processBet({
      userId: req.user.user_id,
      gameType,
      duration: parseInt(duration),
      periodId,
      betType,
      betCategory: betCategory || null,
      betValue,
      betAmount: parseFloat(betAmount)
    });
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error placing bet:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to place bet'
    });
  }
});

/**
 * Get user's bets for a game
 */
router.get('/:gameType/user-bets', auth, async (req, res) => {
  try {
    const { gameType } = req.params;
    const { page = 1, limit = 20, periodId } = req.query;
    const userId = req.user.user_id;
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    // Build where condition
    const whereCondition = { user_id: userId };
    if (periodId) {
      whereCondition.period = periodId;
    }
    
    let bets = [];
    let totalCount = 0;
    
    // Get bets from the appropriate table based on game type
    switch (gameType.toLowerCase()) {
      case 'wingo':
        bets = await BetRecordWingo.findAll({
          where: whereCondition,
          order: [['created_at', 'DESC']],
          limit: parseInt(limit),
          offset
        });
        totalCount = await BetRecordWingo.count({
          where: whereCondition
        });
        break;
        
      case '5d':
      case 'fived':
        bets = await BetRecord5D.findAll({
          where: whereCondition,
          order: [['created_at', 'DESC']],
          limit: parseInt(limit),
          offset
        });
        totalCount = await BetRecord5D.count({
          where: whereCondition
        });
        break;
        
      case 'k3':
        bets = await BetRecordK3.findAll({
          where: whereCondition,
          order: [['created_at', 'DESC']],
          limit: parseInt(limit),
          offset
        });
        totalCount = await BetRecordK3.count({
          where: whereCondition
        });
        break;
        
      case 'trx_wix':
        bets = await BetRecordTrxWix.findAll({
          where: whereCondition,
          order: [['created_at', 'DESC']],
          limit: parseInt(limit),
          offset
        });
        totalCount = await BetRecordTrxWix.count({
          where: whereCondition
        });
        break;
        
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid game type'
        });
    }
    
    // Format bets for response
    const formattedBets = bets.map(bet => ({
      id: bet.bet_id,
      periodId: bet.period,
      betType: bet.bet_type,
      betValue: bet.bet_value || null,
      betAmount: parseFloat(bet.bet_amount),
      odds: parseFloat(bet.odds),
      status: bet.status,
      winAmount: bet.win_amount ? parseFloat(bet.win_amount) : 0,
      profitLoss: bet.win_amount ? parseFloat(bet.win_amount) - parseFloat(bet.bet_amount) : -parseFloat(bet.bet_amount),
      createdAt: bet.created_at
    }));
    
    res.json({
      success: true,
      bets: formattedBets,
      pagination: {
        total: totalCount,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(totalCount / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error getting user bets:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user bets'
    });
  }
});

/**
 * Admin endpoints
 */

/**
 * Get bet distribution for a period (admin)
 */
router.get('/admin/:gameType/:duration/:periodId/distribution', 
  auth, 
  isAdmin, 
  async (req, res) => {
    try {
      const { gameType, duration, periodId } = req.params;
      
      const distribution = await gameLogicService.getBetDistribution(
        gameType, 
        parseInt(duration), 
        periodId
      );
      
      res.json({ success: true, distribution });
    } catch (error) {
      console.error('Error getting bet distribution:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get bet distribution'
      });
    }
  }
);

/**
 * Get potential results analysis (admin)
 */
router.get('/admin/:gameType/:duration/:periodId/analysis', 
  auth, 
  isAdmin, 
  async (req, res) => {
    try {
      const { gameType, duration, periodId } = req.params;
      
      const analysis = await gameLogicService.calculateOptimizedResult(
        gameType, 
        parseInt(duration), 
        periodId
      );
      
      // Add period info
      const periodInfo = await gameLogicService.getPeriodStatus(
        gameType, 
        parseInt(duration), 
        periodId
      );
      
      res.json({ 
        success: true, 
        analysis: {
          ...analysis,
          periodInfo
        }
      });
    } catch (error) {
      console.error('Error getting results analysis:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get results analysis'
      });
    }
  }
);

/**
 * Override result for a period (admin)
 */
router.post('/admin/:gameType/:duration/:periodId/override', 
  auth, 
  isAdmin, 
  async (req, res) => {
    try {
      const { gameType, duration, periodId } = req.params;
      const { result } = req.body;
      
      if (!result) {
        return res.status(400).json({
          success: false,
          message: 'Result is required'
        });
      }
      
      const override = await gameLogicService.overrideResult(
        gameType,
        parseInt(duration),
        periodId,
        result,
        req.user.user_id
      );
      
      if (!override.success) {
        return res.status(400).json(override);
      }
      
      res.json(override);
    } catch (error) {
      console.error('Error overriding result:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to override result'
      });
    }
  }
);

/**
 * Get last result for a game
 */
router.get('/:gameType/last-result', async (req, res) => {
  try {
    let { gameType } = req.params;
    const { duration } = req.query;
    
    console.log(`Last result request received for ${gameType}${duration ? `, duration ${duration}` : ''}`);
    
    // Map API game types to database game types
    const gameTypeMap = {
      'trx_wix': 'trx_wix',
      '5d': 'fiveD',
      'k3': 'k3',
      'wingo': 'wingo',
      'fiveD': 'fiveD'
    };
    
    // Use the mapped game type or the original if not found
    const mappedGameType = gameTypeMap[gameType.toLowerCase()] || gameType;
    
    const result = await gameLogicService.getLastResult(
      mappedGameType, 
      duration ? parseInt(duration) : null
    );
    
    return res.json(result);
  } catch (error) {
    console.error('Error getting last result:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get last result'
    });
  }
});

// Middleware
router.use(auth);

// Game history routes for different game types and durations
// Wingo routes
router.get('/wingo/history/30', rateLimiters.gameHistory, gameHistoryController.getWingoHistory30s);
router.get('/wingo/history/60', rateLimiters.gameHistory, gameHistoryController.getWingoHistory60s);
router.get('/wingo/history/180', rateLimiters.gameHistory, gameHistoryController.getWingoHistory180s);
router.get('/wingo/history/300', rateLimiters.gameHistory, gameHistoryController.getWingoHistory300s);

// K3 routes
router.get('/k3/history/60', rateLimiters.gameHistory, gameHistoryController.getK3History60s);
router.get('/k3/history/180', rateLimiters.gameHistory, gameHistoryController.getK3History180s);
router.get('/k3/history/300', rateLimiters.gameHistory, gameHistoryController.getK3History300s);
router.get('/k3/history/600', rateLimiters.gameHistory, gameHistoryController.getK3History600s);

// 5D routes
router.get('/5d/history/60', rateLimiters.gameHistory, gameHistoryController.get5DHistory60s);
router.get('/5d/history/180', rateLimiters.gameHistory, gameHistoryController.get5DHistory180s);
router.get('/5d/history/300', rateLimiters.gameHistory, gameHistoryController.get5DHistory300s);
router.get('/5d/history/600', rateLimiters.gameHistory, gameHistoryController.get5DHistory600s);

// TRX_WIX routes
router.get('/trx_wix/history/30', rateLimiters.gameHistory, gameHistoryController.getTrxWixHistory30s);
router.get('/trx_wix/history/60', rateLimiters.gameHistory, gameHistoryController.getTrxWixHistory60s);
router.get('/trx_wix/history/180', rateLimiters.gameHistory, gameHistoryController.getTrxWixHistory180s);
router.get('/trx_wix/history/300', rateLimiters.gameHistory, gameHistoryController.getTrxWixHistory300s);

// Generic route that requires specifying game type and duration
router.get('/history', rateLimiters.gameHistory, gameHistoryController.getGameHistory);

module.exports = router;