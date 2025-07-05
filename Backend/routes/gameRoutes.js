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
router.get('/:gameType/:duration/last-result', auth, async (req, res) => {
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

    // Format response consistently with enhanced data
    const formattedResults = result.data.results.map(item => {
      if (mappedGameType === 'trx_wix') {
        return {
          periodId: item.period || item.periodId,
          result: {
            number: item.result?.number,
            color: item.result?.color,
            size: item.result?.size,
            parity: item.result?.parity || (item.result?.number % 2 === 0 ? 'even' : 'odd') // ENHANCED: Add parity
          },
          verification: { // ENHANCED: Add verification
            hash: item.verification?.hash || item.verification_hash,
            link: item.verification?.link || item.verification_link
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
            size: item.result_of_size || item.result?.size,
            parity: item.result?.parity || ((item.result_of_number || item.result?.number) % 2 === 0 ? 'even' : 'odd') // ENHANCED: Add parity
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
//router.use(requirePhoneVerification);

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

      // Store bet in database
      await storeBetInDatabase(betData);

      // Broadcast bet placement through WebSocket
      const io = require('../config/socketConfig').getIo();
      if (io) {
        const roomName = `${mappedGameType}_${durationNum}`;
        const adminRoomName = `admin_${mappedGameType}_${durationNum}`;

        // Broadcast to game room
        io.to(roomName).emit('newBet', {
          gameType: mappedGameType,
          duration: durationNum,
          periodId,
          betAmount: betAmountNum,
          betType,
          betValue,
          timestamp: new Date().toISOString()
        });

        // Broadcast to admin room
        io.to(adminRoomName).emit('newBet', {
          gameType: mappedGameType,
          duration: durationNum,
          periodId,
          betAmount: betAmountNum,
          betType,
          betValue,
          userId,
          timestamp: new Date().toISOString()
        });

        // Update live bet distribution for admins
        const gameLogicService = require('../services/gameLogicService');
        const distribution = await gameLogicService.getBetDistribution(mappedGameType, durationNum, periodId);
        io.to(adminRoomName).emit('liveBetDistribution', {
          gameType: mappedGameType,
          duration: durationNum,
          periodId,
          distribution,
          timestamp: new Date().toISOString()
        });
      }

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
    const { page = 1, limit = 10, periodId, status, startDate, endDate } = req.query;
    const userId = req.user.user_id;

    const gameTypeLower = gameType.toLowerCase();
    const mappedGameType = gameTypeLower === '5d' ? 'fiveD' : gameTypeLower;
    
    // Validate date parameters if provided
    let dateFilter = {};
    if (startDate || endDate) {
      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          return res.status(400).json({
            success: false,
            message: 'Invalid date format. Use YYYY-MM-DD or ISO date format'
          });
        }
        
        if (start > end) {
          return res.status(400).json({
            success: false,
            message: 'Start date cannot be after end date'
          });
        }
        
        dateFilter = {
          startDate: start,
          endDate: end
        };
      } else {
        return res.status(400).json({
          success: false,
          message: 'Both startDate and endDate are required when using date filtering'
        });
      }
    }
    
    // Get user's bets using the proper implementation
    const result = await gameLogicService.getUserBetHistory(userId, mappedGameType, parseInt(duration), {
      page: parseInt(page),
      limit: parseInt(limit),
      periodId,
      status,
      ...dateFilter
    });

    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error getting user bets:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user bets',
      error: error.message
    });
  }
});

// Get user's bet history for all durations of a specific game type
router.get('/:gameType/my-bets', async (req, res) => {
  try {
    const { gameType } = req.params;
    const { page = 1, limit = 20, status, startDate, endDate } = req.query;
    const userId = req.user.user_id;

    const gameTypeLower = gameType.toLowerCase();
    const mappedGameType = gameTypeLower === '5d' ? 'fiveD' : gameTypeLower;
    
    // Validate game type
    const validGameTypes = ['wingo', 'trx_wix', 'k3', 'fiveD'];
    if (!validGameTypes.includes(mappedGameType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid game type. Valid types: wingo, trx_wix, k3, 5d'
      });
    }
    
    // Validate date parameters if provided
    let dateFilter = {};
    if (startDate || endDate) {
      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          return res.status(400).json({
            success: false,
            message: 'Invalid date format. Use YYYY-MM-DD or ISO date format'
          });
        }
        
        if (start > end) {
          return res.status(400).json({
            success: false,
            message: 'Start date cannot be after end date'
          });
        }
        
        dateFilter = {
          startDate: start,
          endDate: end
        };
      } else {
        return res.status(400).json({
          success: false,
          message: 'Both startDate and endDate are required when using date filtering'
        });
      }
    }
    
    // Get all durations for this game type
    const durations = {
      'wingo': [30, 60, 180, 300],
      'trx_wix': [30, 60, 180, 300],
      'k3': [60, 180, 300, 600],
      'fiveD': [60, 180, 300, 600]
    };
    
    const gameDurations = durations[mappedGameType] || [];
    
    // Get user's bets for all durations
    const allBets = [];
    let totalBets = 0;
    
    for (const duration of gameDurations) {
      try {
        const result = await gameLogicService.getUserBetHistory(userId, mappedGameType, duration, {
          page: 1,
          limit: 1000, // Get all bets for this duration
          status,
          ...dateFilter
        });
        
        if (result.success && result.data && result.data.bets) {
          // Add duration info to each bet
          const betsWithDuration = result.data.bets.map(bet => ({
            ...bet,
            duration: duration,
            gameType: mappedGameType
          }));
          
          allBets.push(...betsWithDuration);
          totalBets += result.data.pagination?.total || 0;
        }
      } catch (error) {
        console.error(`Error getting bets for ${mappedGameType} duration ${duration}:`, error);
        // Continue with other durations even if one fails
      }
    }
    
    // Sort all bets by creation date (newest first)
    allBets.sort((a, b) => new Date(b.createdAt || b.created_at) - new Date(a.createdAt || a.created_at));
    
    // Apply pagination to the combined results
    const pageNum = parseInt(page);
    const limitNum = Math.min(parseInt(limit), 50); // Max 50 per page
    const offset = (pageNum - 1) * limitNum;
    const paginatedBets = allBets.slice(offset, offset + limitNum);
    
    // Calculate pagination info
    const totalPages = Math.ceil(allBets.length / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;
    
    // Calculate summary statistics
    const summary = {
      total_bets: allBets.length,
      total_amount: allBets.reduce((sum, bet) => sum + (parseFloat(bet.betAmount || bet.bet_amount) || 0), 0),
      total_wins: allBets.filter(bet => bet.status === 'won').length,
      total_losses: allBets.filter(bet => bet.status === 'lost').length,
      pending_bets: allBets.filter(bet => bet.status === 'pending').length,
      by_duration: {}
    };
    
    // Group by duration
    gameDurations.forEach(duration => {
      const durationBets = allBets.filter(bet => bet.duration === duration);
      summary.by_duration[duration] = {
        count: durationBets.length,
        total_amount: durationBets.reduce((sum, bet) => sum + (parseFloat(bet.betAmount || bet.bet_amount) || 0), 0),
        wins: durationBets.filter(bet => bet.status === 'won').length,
        losses: durationBets.filter(bet => bet.status === 'lost').length
      };
    });

    res.json({
      success: true,
      data: {
        gameType: mappedGameType,
        bets: paginatedBets,
        summary: summary,
        pagination: {
          current_page: pageNum,
          total_pages: totalPages,
          total_records: allBets.length,
          limit: limitNum,
          has_next_page: hasNextPage,
          has_prev_page: hasPrevPage
        }
      }
    });
    
  } catch (error) {
    console.error('Error getting user bets for all durations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user bets',
      error: error.message
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
        'COLOR': (val) => ['red', 'green', 'violet'].includes(String(val || '').toLowerCase()),
        'SIZE': (val) => ['big', 'small'].includes(String(val || '').toLowerCase()),
        'PARITY': (val) => ['odd', 'even'].includes(String(val || '').toLowerCase())
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
        'SUM_CATEGORY': (val) => ['big', 'small', 'odd', 'even'].includes(String(val || '').toLowerCase()),
        'MATCHING_DICE': (val) => ['triple_any', 'pair_any'].includes(String(val || '').toLowerCase()) || /^(triple|pair)_[1-6](_[1-6])?$/.test(val),
        'PATTERN': (val) => ['all_different', 'straight', 'two_different'].includes(String(val || '').toLowerCase())
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
        'SUM': (val) => ['big', 'small', 'odd', 'even'].includes(String(val || '').toLowerCase())
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