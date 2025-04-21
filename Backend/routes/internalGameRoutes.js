// Backend/routes/internalGameRoutes.js
import express from 'express';
import { auth, requireEmailVerification } from '../middlewares/authMiddleware.js';
import { isAdmin } from '../middlewares/adminMiddleware.js';
import gameLogicService from '../services/gameLogicService.js';

const router = express.Router();

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
    const { gameType } = req.params;
    const { page = 1, limit = 20 } = req.query;
    
    const history = await gameLogicService.getGameHistory(
      gameType, 
      parseInt(page), 
      parseInt(limit)
    );
    
    res.json({ success: true, ...history });
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
router.post('/:gameType/bet', auth, requireEmailVerification, async (req, res) => {
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
    
    // This endpoint would typically query bet records from the database
    // For this implementation, we'll return a placeholder response
    
    // In a real implementation, you would:
    // 1. Query the appropriate bet record table based on gameType
    // 2. Filter by user_id and optionally by periodId
    // 3. Apply pagination
    // 4. Return the results
    
    res.json({
      success: true,
      message: 'User bets endpoint - Implementation to be completed',
      bets: [],
      pagination: {
        total: 0,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: 0
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

export default router;