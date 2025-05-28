// Backend/routes/gameRoutes.js - CORRECTED VERSION
const express = require('express');
const { auth, requirePhoneVerification } = require('../middlewares/authMiddleware');
const rateLimiters = require('../middleware/rateLimiter');
const validationRules = require('../middleware/inputValidator');
const gameLogicService = require('../services/gameLogicService');

const router = express.Router();

/**
 * ======================
 * PUBLIC ROUTES (No Auth)
 * ======================
 */

// Get last result for a specific game and duration
router.get('/:gameType/:duration/last-result', async (req, res) => {
  try {
    const { gameType, duration } = req.params;
    
    // Validate game type
    const validGameTypes = ['wingo', 'trx_wix', 'k3', '5d', 'fiveD'];
    if (!validGameTypes.includes(gameType.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid game type. Valid types: wingo, trx_wix, k3, 5d'
      });
    }

    // Validate duration
    const validDurations = {
      'wingo': [30, 60, 180, 300],
      'trx_wix': [30, 60, 180, 300],
      'k3': [60, 180, 300, 600],
      '5d': [60, 180, 300, 600],
      'fiveD': [60, 180, 300, 600]
    };

    const durationNum = parseInt(duration);
    const gameTypeLower = gameType.toLowerCase();
    const mappedGameType = gameTypeLower === '5d' ? 'fiveD' : gameTypeLower;
    
    if (!validDurations[mappedGameType]?.includes(durationNum)) {
      return res.status(400).json({
        success: false,
        message: `Invalid duration for ${gameType}. Valid durations: ${validDurations[mappedGameType]?.join(', ')}`
      });
    }

    const result = await gameLogicService.getLastResult(mappedGameType, durationNum);
    return res.json(result);
  } catch (error) {
    console.error('Error getting last result:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get last result'
    });
  }
});

// Get game history with pagination
router.get('/:gameType/:duration/history', async (req, res) => {
  try {
    const { gameType, duration } = req.params;
    const { page = 1, limit = 10, offset } = req.query;
    
    // Validate parameters
    const validGameTypes = ['wingo', 'trx_wix', 'k3', '5d', 'fiveD'];
    if (!validGameTypes.includes(gameType.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid game type'
      });
    }

    const durationNum = parseInt(duration);
    const pageNum = parseInt(page);
    const limitNum = Math.min(parseInt(limit), 50); // Max 50 results per page
    const offsetNum = offset ? parseInt(offset) : (pageNum - 1) * limitNum;

    // Map game type
    const gameTypeLower = gameType.toLowerCase();
    const mappedGameType = gameTypeLower === '5d' ? 'fiveD' : gameTypeLower;

    console.log(`Getting history for ${mappedGameType}, duration ${durationNum}, limit ${limitNum}, offset ${offsetNum}`);

    const result = await gameLogicService.getGameHistory(
      mappedGameType,
      durationNum,
      limitNum,
      offsetNum
    );

    if (!result.success) {
      return res.status(500).json(result);
    }

    // Format response consistently
    const formattedResults = result.data.results.map(item => {
      if (mappedGameType === 'trx_wix') {
        return {
          periodId: item.period || item.periodId,
          result: item.result,
          verification: {
            hash: item.verification_hash,
            link: item.verification_link
          },
          createdAt: item.created_at || item.timestamp,
          gameType: mappedGameType,
          duration: durationNum
        };
      } else if (mappedGameType === 'wingo') {
        return {
          periodId: item.bet_number || item.periodId,
          result: {
            number: item.result_of_number || item.result?.number,
            color: item.result_of_color || item.result?.color,
            size: item.result_of_size || item.result?.size
          },
          createdAt: item.created_at || item.timestamp,
          gameType: mappedGameType,
          duration: durationNum
        };
      } else if (mappedGameType === 'k3') {
        return {
          periodId: item.bet_number || item.periodId,
          result: {
            dice_1: item.dice_1 || item.result?.dice_1,
            dice_2: item.dice_2 || item.result?.dice_2,
            dice_3: item.dice_3 || item.result?.dice_3,
            sum: item.sum || item.result?.sum,
            has_pair: item.has_pair || item.result?.has_pair,
            has_triple: item.has_triple || item.result?.has_triple,
            is_straight: item.is_straight || item.result?.is_straight,
            sum_size: item.sum_size || item.result?.sum_size,
            sum_parity: item.sum_parity || item.result?.sum_parity
          },
          createdAt: item.created_at || item.timestamp,
          gameType: mappedGameType,
          duration: durationNum
        };
      } else if (mappedGameType === 'fiveD') {
        return {
          periodId: item.bet_number || item.periodId,
          result: {
            A: item.result_a || item.result?.A,
            B: item.result_b || item.result?.B,
            C: item.result_c || item.result?.C,
            D: item.result_d || item.result?.D,
            E: item.result_e || item.result?.E,
            sum: item.total_sum || item.result?.sum
          },
          createdAt: item.created_at || item.timestamp,
          gameType: mappedGameType,
          duration: durationNum
        };
      }
      return item;
    });

    return res.json({
      success: true,
      data: {
        results: formattedResults,
        pagination: {
          total: result.data.pagination.total,
          page: pageNum,
          limit: limitNum,
          offset: offsetNum,
          hasMore: result.data.pagination.hasMore,
          totalPages: Math.ceil(result.data.pagination.total / limitNum)
        }
      },
      gameType: mappedGameType,
      duration: durationNum
    });

  } catch (error) {
    console.error('Error getting game history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get game history',
      error: error.message
    });
  }
});

/**
 * ======================
 * AUTHENTICATED ROUTES
 * ======================
 */

// Middleware for all routes below
router.use(auth);
router.use(requirePhoneVerification);

// Get current active periods for all games
router.get('/active-periods', async (req, res) => {
  try {
    const allActivePeriods = {};
    const gameTypes = ['wingo', 'trx_wix', 'k3', 'fiveD'];
    
    for (const gameType of gameTypes) {
      const periods = await gameLogicService.getActivePeriods(gameType);
      allActivePeriods[gameType] = periods;
    }

    res.json({
      success: true,
      data: allActivePeriods
    });
  } catch (error) {
    console.error('Error getting active periods:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get active periods'
    });
  }
});

// Get specific period details
router.get('/:gameType/:duration/period/:periodId', async (req, res) => {
  try {
    const { gameType, duration, periodId } = req.params;
    const durationNum = parseInt(duration);
    
    const gameTypeLower = gameType.toLowerCase();
    const mappedGameType = gameTypeLower === '5d' ? 'fiveD' : gameTypeLower;
    
    const periodDetails = await gameLogicService.getPeriodStatus(mappedGameType, durationNum, periodId);
    
    res.json({
      success: true,
      data: periodDetails
    });
  } catch (error) {
    console.error('Error getting period details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get period details'
    });
  }
});

// Check user's game balance
router.get('/balance', rateLimiters.gameBalance, async (req, res) => {
  try {
    const userId = req.user.user_id;
    
    // Check balance logic here (implement based on your existing logic)
    // This should check both main wallet and third-party wallet
    
    res.json({
      success: true,
      balance: {
        mainWallet: 0, // Get from database
        thirdPartyWallet: 0, // Get from third party service
        totalAvailable: 0
      }
    });
  } catch (error) {
    console.error('Error checking balance:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check balance'
    });
  }
});

/**
 * ======================
 * BET PLACEMENT ROUTES
 * ======================
 */

// Place bet for any game type and duration
router.post('/:gameType/:duration/bet', 
  rateLimiters.internalCrashGame, // Use appropriate rate limiter
  async (req, res) => {
    try {
      const { gameType, duration } = req.params;
      const { betType, betValue, betAmount, periodId } = req.body;
      const userId = req.user.user_id;

      // Validate required fields
      if (!betType || !betValue || !betAmount || !periodId) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: betType, betValue, betAmount, periodId'
        });
      }

      // Validate game type and duration
      const gameTypeLower = gameType.toLowerCase();
      const mappedGameType = gameTypeLower === '5d' ? 'fiveD' : gameTypeLower;
      const durationNum = parseInt(duration);

      const validGameTypes = ['wingo', 'trx_wix', 'k3', 'fiveD'];
      if (!validGameTypes.includes(mappedGameType)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid game type'
        });
      }

      // Validate bet amount
      const betAmountNum = parseFloat(betAmount);
      if (isNaN(betAmountNum) || betAmountNum <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid bet amount'
        });
      }

      // Validate bet type and value based on game type
      const betValidation = validateBetTypeAndValue(mappedGameType, betType, betValue);
      if (!betValidation.valid) {
        return res.status(400).json({
          success: false,
          message: betValidation.message
        });
      }

      // Check if betting period is still active
      const periodStatus = await gameLogicService.getPeriodStatus(mappedGameType, durationNum, periodId);
      if (!periodStatus.active || periodStatus.timeRemaining <= 5) {
        return res.status(400).json({
          success: false,
          message: 'Betting period has ended'
        });
      }

      // Process the bet
      const betData = {
        userId,
        gameType: mappedGameType,
        duration: durationNum,
        periodId,
        betType,
        betValue,
        betAmount: betAmountNum,
        odds: gameLogicService.calculateOdds(mappedGameType, betType, betValue)
      };

      const result = await gameLogicService.processBet(betData);

      if (!result.success) {
        return res.status(400).json(result);
      }

      // Store bet in database as well (implement based on your models)
      await storeBetInDatabase(betData);

      res.json({
        success: true,
        message: 'Bet placed successfully',
        data: {
          betId: `${userId}_${periodId}_${Date.now()}`,
          gameType: mappedGameType,
          duration: durationNum,
          periodId,
          betType,
          betValue,
          betAmount: betAmountNum,
          odds: betData.odds,
          expectedWin: betAmountNum * betData.odds,
          timeRemaining: periodStatus.timeRemaining
        }
      });

    } catch (error) {
      console.error('Error placing bet:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to place bet',
        error: error.message
      });
    }
  }
);

// Get user's bet history for a specific game
router.get('/:gameType/:duration/my-bets', async (req, res) => {
  try {
    const { gameType, duration } = req.params;
    const { page = 1, limit = 10, periodId } = req.query;
    const userId = req.user.user_id;

    const gameTypeLower = gameType.toLowerCase();
    const mappedGameType = gameTypeLower === '5d' ? 'fiveD' : gameTypeLower;
    
    // Get user's bets (implement based on your database structure)
    const userBets = await getUserBets(userId, mappedGameType, parseInt(duration), {
      page: parseInt(page),
      limit: parseInt(limit),
      periodId
    });

    res.json({
      success: true,
      data: userBets
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
 * ======================
 * HELPER FUNCTIONS
 * ======================
 */

// Validate bet type and value based on game type
function validateBetTypeAndValue(gameType, betType, betValue) {
  switch (gameType) {
    case 'wingo':
    case 'trx_wix':
      const validWingoBets = {
        'NUMBER': (val) => /^[0-9]$/.test(val),
        'COLOR': (val) => ['red', 'green', 'violet'].includes(val.toLowerCase()),
        'SIZE': (val) => ['big', 'small'].includes(val.toLowerCase()),
        'PARITY': (val) => ['odd', 'even'].includes(val.toLowerCase())
      };
      
      if (!validWingoBets[betType]) {
        return { valid: false, message: `Invalid bet type for ${gameType}` };
      }
      if (!validWingoBets[betType](betValue)) {
        return { valid: false, message: `Invalid bet value for ${betType}` };
      }
      break;

    case 'k3':
      const validK3Bets = {
        'SUM': (val) => /^([3-9]|1[0-8])$/.test(val),
        'SUM_CATEGORY': (val) => ['big', 'small', 'odd', 'even'].includes(val.toLowerCase()),
        'MATCHING_DICE': (val) => ['triple_any', 'pair_any'].includes(val.toLowerCase()) || /^(triple|pair)_[1-6](_[1-6])?$/.test(val),
        'PATTERN': (val) => ['all_different', 'straight', 'two_different'].includes(val.toLowerCase())
      };
      
      if (!validK3Bets[betType]) {
        return { valid: false, message: `Invalid bet type for ${gameType}` };
      }
      if (!validK3Bets[betType](betValue)) {
        return { valid: false, message: `Invalid bet value for ${betType}` };
      }
      break;

    case 'fiveD':
      const validFiveDConventions = {
        'POSITION': (val) => /^[ABCDE]_[1-6]$/.test(val),
        'POSITION_SIZE': (val) => /^[ABCDE]_(big|small)$/.test(val),
        'POSITION_PARITY': (val) => /^[ABCDE]_(odd|even)$/.test(val),
        'SUM': (val) => ['big', 'small', 'odd', 'even'].includes(val.toLowerCase())
      };
      
      if (!validFiveDConventions[betType]) {
        return { valid: false, message: `Invalid bet type for ${gameType}` };
      }
      if (!validFiveDConventions[betType](betValue)) {
        return { valid: false, message: `Invalid bet value for ${betType}` };
      }
      break;

    default:
      return { valid: false, message: 'Unsupported game type' };
  }

  return { valid: true };
}

// Store bet in database (implement based on your models)
async function storeBetInDatabase(betData) {
  try {
    // This should be implemented based on your database models
    // For now, just log the bet data
    console.log('Storing bet in database:', betData);
    
    // Example implementation:
    // const models = await gameLogicService.ensureModelsInitialized();
    // 
    // switch (betData.gameType) {
    //   case 'wingo':
    //     await models.BetRecordWingo.create({
    //       user_id: betData.userId,
    //       period: betData.periodId,
    //       bet_type: `${betData.betType}:${betData.betValue}`,
    //       bet_amount: betData.betAmount,
    //       odds: betData.odds,
    //       status: 'pending'
    //     });
    //     break;
    //   // ... other game types
    // }
    
    return true;
  } catch (error) {
    console.error('Error storing bet in database:', error);
    throw error;
  }
}

// Get user bets (implement based on your models)
async function getUserBets(userId, gameType, duration, options) {
  try {
    // This should be implemented based on your database models
    console.log('Getting user bets:', { userId, gameType, duration, options });
    
    // Return mock data for now
    return {
      bets: [],
      pagination: {
        total: 0,
        page: options.page,
        limit: options.limit,
        hasMore: false
      }
    };
  } catch (error) {
    console.error('Error getting user bets:', error);
    throw error;
  }
}

module.exports = router;