// routes/playwin6Routes.js - PlayWin6 Provider Routes
const express = require('express');
const { auth } = require('../middlewares/authMiddleware');
const rateLimiters = require('../middleware/rateLimiter');
const playwin6Service = require('../services/playwin6Service');
const playwin6Config = require('../config/playwin6Config');

const router = express.Router();

/**
 * ======================
 * PUBLIC ROUTES (No Auth)
 * ======================
 */

// Health check endpoint
router.get('/health', async (req, res) => {
  try {
    const healthResult = await playwin6Service.healthCheck();
    
    if (healthResult.success) {
      res.status(200).json({
        success: true,
        status: 'healthy',
        provider: 'PlayWin6',
        timestamp: healthResult.timestamp,
        config: healthResult.config
      });
    } else {
      res.status(503).json({
        success: false,
        status: 'unhealthy',
        provider: 'PlayWin6',
        message: healthResult.message,
        timestamp: healthResult.timestamp
      });
    }
  } catch (error) {
    console.error('PlayWin6 health check error:', error);
    res.status(500).json({
      success: false,
      status: 'error',
      provider: 'PlayWin6',
      message: 'Internal server error'
    });
  }
});

// Get available providers
router.get('/providers', async (req, res) => {
  try {
    const { provider } = req.query; // Add query parameter for filtering
    
    const result = await playwin6Service.getProviders();
    
    if (result.success) {
      // If provider filter is specified, filter the results
      if (provider) {
        const filteredData = result.data.data.filter(p => 
          p.provider.toLowerCase() === provider.toLowerCase()
        );
        
        if (filteredData.length === 0) {
          return res.status(404).json({
            success: false,
            message: `Provider '${provider}' not found`
          });
        }
        
        return res.status(200).json({
          success: true,
          data: {
            ...result.data,
            data: filteredData
          },
          providers: [provider]
        });
      }
      
      // Return all providers if no filter
      res.status(200).json({
        success: true,
        data: result.data,
        providers: result.providers
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    console.error('Error getting PlayWin6 providers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get providers'
    });
  }
});

// Get provider game list
router.get('/games/:provider', async (req, res) => {
  try {
    const { provider } = req.params;
    const { count = 12, type = 'Slot Game' } = req.query;
    
    const result = await playwin6Service.getProviderGameList(
      provider,
      parseInt(count),
      type
    );
    
    if (result.success) {
      res.status(200).json({
        success: true,
        data: result.data,
        provider: result.provider,
        count: result.count,
        type: result.type
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    console.error('Error getting PlayWin6 games:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get games'
    });
  }
});

// Callback endpoint for PlayWin6
router.post('/callback', async (req, res) => {
  try {
    const callbackData = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;
    
    console.log('🎮 PlayWin6 callback received:', {
      ip: ipAddress,
      data: callbackData
    });
    
    const result = await playwin6Service.handleCallback(callbackData, ipAddress);
    
    if (result.success) {
      res.status(200).json({
        success: true,
        message: 'Callback processed successfully',
        transactionId: result.transactionId
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    console.error('Error processing PlayWin6 callback:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process callback'
    });
  }
});

/**
 * ======================
 * PROTECTED ROUTES (Auth Required)
 * ======================
 */

// Launch game
router.post('/launch', auth, rateLimiters.gameLaunch, async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { gameUid, walletAmount, token, additionalData } = req.body;
    
    // Validate required fields
    if (!gameUid) {
      return res.status(400).json({
        success: false,
        message: 'Game UID is required'
      });
    }
    
    if (!walletAmount || walletAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid wallet amount is required'
      });
    }
    
    const result = await playwin6Service.launchGame(
      userId,
      gameUid,
      walletAmount,
      token,
      additionalData || {}
    );
    
    if (result.success) {
      res.status(200).json({
        success: true,
        launchUrl: result.launchUrl,
        sessionToken: result.sessionToken,
        userId: result.userId,
        gameUid: result.gameUid,
        timestamp: result.timestamp
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    console.error('Error launching PlayWin6 game:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to launch game'
    });
  }
});

// Get user game history
router.get('/history', auth, async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { 
      gameUid, 
      startDate, 
      endDate, 
      limit = 50, 
      offset = 0 
    } = req.query;
    
    const filters = {
      gameUid,
      startDate,
      endDate,
      limit: Math.min(parseInt(limit), 100),
      offset: parseInt(offset)
    };
    
    const result = await playwin6Service.getUserGameHistory(userId, filters);
    
    if (result.success) {
      res.status(200).json({
        success: true,
        data: result.data
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    console.error('Error getting PlayWin6 game history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get game history'
    });
  }
});

// Get game session
router.get('/session/:sessionToken', auth, async (req, res) => {
  try {
    const { sessionToken } = req.params;
    const userId = req.user.user_id;
    
    const result = await playwin6Service.getGameSession(sessionToken);
    
    if (result.success) {
      // Verify session belongs to user
      if (result.data.userId !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this session'
        });
      }
      
      res.status(200).json({
        success: true,
        data: result.data
      });
    } else {
      res.status(404).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    console.error('Error getting PlayWin6 game session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get game session'
    });
  }
});

// End game session
router.post('/session/:sessionToken/end', auth, async (req, res) => {
  try {
    const { sessionToken } = req.params;
    const userId = req.user.user_id;
    
    // First get session to verify ownership
    const sessionResult = await playwin6Service.getGameSession(sessionToken);
    
    if (!sessionResult.success) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }
    
    // Verify session belongs to user
    if (sessionResult.data.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this session'
      });
    }
    
    const result = await playwin6Service.endGameSession(sessionToken);
    
    if (result.success) {
      res.status(200).json({
        success: true,
        message: result.message
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    console.error('Error ending PlayWin6 game session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to end game session'
    });
  }
});

/**
 * ======================
 * ADMIN ROUTES (Admin Auth Required)
 * ======================
 */

// Clean up expired sessions (admin only)
router.post('/admin/cleanup-sessions', auth, async (req, res) => {
  try {
    // Check if user is admin (you may need to adjust this based on your admin check)
    if (!req.user.is_admin) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }
    
    const result = await playwin6Service.cleanupExpiredSessions();
    
    if (result.success) {
      res.status(200).json({
        success: true,
        message: `Cleaned up ${result.deletedCount} expired sessions`,
        deletedCount: result.deletedCount
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    console.error('Error cleaning up PlayWin6 sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cleanup sessions'
    });
  }
});

// Get all game sessions (admin only)
router.get('/admin/sessions', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.is_admin) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }
    
    const { limit = 50, offset = 0, status } = req.query;
    
    // This would need to be implemented in the service
    // For now, return a placeholder response
    res.status(200).json({
      success: true,
      message: 'Admin sessions endpoint - implementation needed',
      filters: { limit, offset, status }
    });
  } catch (error) {
    console.error('Error getting PlayWin6 admin sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get admin sessions'
    });
  }
});

/**
 * ======================
 * DEBUG ROUTES (Development Only)
 * ======================
 */

// Debug endpoint to test game launch without auth (development only)
if (process.env.NODE_ENV === 'development') {
  router.post('/debug/launch', async (req, res) => {
    try {
      const { userId, gameUid, walletAmount, token } = req.body;
      
      if (!userId || !gameUid || !walletAmount) {
        return res.status(400).json({
          success: false,
          message: 'userId, gameUid, and walletAmount are required'
        });
      }
      
      const result = await playwin6Service.launchGame(
        userId,
        gameUid,
        walletAmount,
        token
      );
      
      res.status(200).json(result);
    } catch (error) {
      console.error('Debug launch error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  });
  
  // Debug endpoint to test provider games (development only)
  router.get('/debug/games/:provider', async (req, res) => {
    try {
      const { provider } = req.params;
      const { count, type } = req.query;
      
      const result = await playwin6Service.getProviderGameList(
        provider,
        count ? parseInt(count) : 5,
        type || 'Slot Game'
      );
      
      res.status(200).json(result);
    } catch (error) {
      console.error('Debug games error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  });
}

module.exports = router; 