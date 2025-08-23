const express = require('express');
const router = express.Router();
const casinoController = require('../controllers/casinoController');
const casinoService = require('../services/casinoService');

/**
 * Casino API Routes
 * All routes require authentication
 */

// Export a function that accepts authMiddleware
module.exports = (authMiddleware) => {
  const router = express.Router();

  // Public routes (no auth required)
  // Callback endpoint for casino provider (no auth required)
  router.post('/callback', async (req, res) => {
    try {
      console.log('📞 === CASINO CALLBACK RECEIVED ===');
      console.log('📞 Headers:', req.headers);
      console.log('📞 Body:', req.body);

      // Process the callback
      const result = await casinoService.processCallback(req.body);

      console.log('📞 === CASINO CALLBACK RESPONSE ===');
      console.log('📞 Response:', result);

      // Return the encrypted response
      return res.status(200).json(result);

    } catch (error) {
      console.error('❌ Casino callback error:', error);
      
      // Return error response
      return res.status(500).json({
        code: 1,
        msg: 'Internal server error',
        payload: ''
      });
    }
  });

  // Health check endpoint (public)
  router.get('/health', (req, res) => {
    res.status(200).json({
      success: true,
      message: 'Casino API is healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    });
  });

  // Protected routes (require authentication)
  // Apply authentication middleware to protected routes only
  router.use(authMiddleware.auth);

// Game Management Routes
router.get('/games', casinoController.getGameList);
router.get('/providers', casinoController.getProviderList);
router.post('/games/:gameUid/launch', casinoController.launchGame);

// Session Management Routes
router.get('/sessions', casinoController.getUserSessions);
router.delete('/sessions/:sessionId', casinoController.closeGameSession);

// Transaction Routes
router.get('/transactions', casinoController.getUserTransactions);

// Statistics Routes
router.get('/stats', casinoController.getUserStats);



// Test endpoint for development
router.post('/test-encryption', async (req, res) => {
  try {
    const { testData } = req.body;
    
    if (!testData) {
      return res.status(400).json({
        success: false,
        message: 'Test data is required'
      });
    }

    const encryption = require('../services/casinoEncryption');
    const config = require('../config/casino.config');
    
    const testEncryption = new encryption(config.aes_key);
    
    // Test encryption
    const encrypted = testEncryption.encrypt(testData);
    const decrypted = testEncryption.decrypt(encrypted);
    
    return res.status(200).json({
      success: true,
      original: testData,
      encrypted: encrypted,
      decrypted: decrypted,
      matches: testData === decrypted
    });

  } catch (error) {
    console.error('❌ Test encryption error:', error);
    return res.status(500).json({
      success: false,
      message: 'Test failed',
      error: error.message
    });
  }
});

// Admin-only routes
router.get('/admin/transactions', async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.is_admin) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { fromDate, toDate, pageNo = 1, pageSize = 30 } = req.query;

    const result = await casinoService.getTransactionHistory({
      fromDate,
      toDate,
      pageNo: parseInt(pageNo),
      pageSize: parseInt(pageSize)
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json({
      success: true,
      data: result.data
    });

  } catch (error) {
    console.error('❌ Admin transaction history error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get transaction history',
      error: error.message
    });
  }
});

// Error handling middleware
router.use((error, req, res, next) => {
  console.error('❌ Casino route error:', error);
  
  return res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: error.message
  });
});

  return router;
};
