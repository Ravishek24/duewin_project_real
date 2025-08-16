// routes/index.js - FIXED VERSION
const express = require('express');
const jwt = require('jsonwebtoken');

// Import all route modules
const userRoutes = require('./userRoutes');
const optimizedUserRoutes = require('./optimizedUserRoutes'); // NEW: Import optimized routes
const bankRoutes = require('./bankRoutes');
const usdtRoutes = require('./usdtRoutes');
const walletRoutes = require('./walletRoutes');
const gameRoutes = require('./gameRoutes');
const paymentRoutes = require('./paymentRoutes');
const paymentGatewayRoutes = require('./paymentGatewayRoutes');
const spribeRoutes = require('./spribeRoutes');
const seamlessWalletRoutes = require('./seamlessWalletRoutes');
const seamlessRoutes = require('./seamlessRoutes');
const referralRoutes = require('./referralRoutes');
const otpRoutes = require('./otpRoutes');
const adminRoutes = require('./adminRoutes');
// const mxPayRoutes = require('./mxPayRoutes'); // TODO: Fix auth import and add to router if needed
const vipRoutes = require('./vipRoutes');
const thirdPartyWalletRoutes = require('./thirdPartyWalletRoutes');
const internalGameRoutes = require('./internalGameRoutes');
const vaultRoutes = require('./vaultRoutes');
const activityRoutes = require('./activityRoutes');
const websocketDebugRoutes = require('./websocketDebug');
const announcementRoutes = require('./announcementRoutes');
const feedbackRoutes = require('./feedbackRoutes');
const gameMoveTransactionRoutes = require('./gameMoveTransactionRoutes');
const transactionReportRoutes = require('./transactionReportRoutes');
const giftRoutes = require('./giftRoutes');
const ppayproRoutes = require('./ppayproRoutes'); // Add PPayPro routes
const playwin6Routes = require('./playwin6Routes'); // Add PlayWin6 routes
const wageringRoutes = require('./wageringRoutes'); // Add Wagering routes
const { paymentCallbackWhitelist } = require('../middleware/paymentCallbackWhitelist');

// Remove direct import of auth, isAdmin
// const { auth, isAdmin } = require('../middlewares/authMiddleware');

module.exports = (authMiddleware) => {
  const router = express.Router();

  // CRITICAL: Health check route (should be first)
  router.get('/health', (req, res) => {
    res.json({
      success: true,
      message: 'API is healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });

  // Debug routes (should be early for testing)
  router.get('/debug/token', (req, res) => {
    const authHeader = req.header('Authorization');
    const token = authHeader ? authHeader.replace('Bearer ', '') : null;
    console.log('🐛 Debug token endpoint hit');
    console.log('🐛 Auth header:', authHeader);
    console.log('🐛 Extracted token:', token);
    if (!token) {
      return res.json({
        success: false,
        message: 'No token provided',
        authHeader,
        headers: req.headers
      });
    }
    try {
      const decoded = jwt.decode(token);
      console.log('🐛 Decoded token (no verification):', decoded);
      res.json({
        success: true,
        message: 'Token debug info',
        token: token.substring(0, 20) + '...',
        decoded,
        authHeader,
        envSecret: process.env.JWT_SECRET ? 'Present' : 'Missing',
        configSecret: require('../config/config').jwtSecret ? 'Present' : 'Missing'
      });
    } catch (error) {
      res.json({
        success: false,
        message: 'Failed to decode token',
        error: error.message,
        token: token.substring(0, 20) + '...'
      });
    }
  });

  // Test auth middleware
  router.get('/debug/auth', authMiddleware.auth, (req, res) => {
    res.json({
      success: true,
      message: 'Auth middleware passed',
      user: {
        user_id: req.user.user_id,
        user_name: req.user.user_name,
        is_admin: req.user.is_admin,
      },
      session: req.session
    });
  });

  // Test referral endpoint specifically
  router.get('/debug/referral', authMiddleware.auth, (req, res) => {
    res.json({
      success: true,
      message: 'Referral debug endpoint reached',
      user: {
        user_id: req.user.user_id,
        user_name: req.user.user_name,
        is_phone_verified: req.user.is_phone_verified
      },
      timestamp: new Date().toISOString()
    });
  });

  // CRITICAL: Routes that don't require authentication (MUST be before auth-required routes)
  router.use('/users', userRoutes(authMiddleware)); // Pass authMiddleware object
  router.use('/users-optimized', optimizedUserRoutes.router); // NEW: Optimized routes for testing
  router.use('/otp', otpRoutes(authMiddleware));
  router.use('/seamless', seamlessRoutes(authMiddleware));
  router.use('/seamless-wallet', authMiddleware.auth, seamlessWalletRoutes);
  router.use('/websocket-debug', websocketDebugRoutes);
  router.use('/wallet', authMiddleware.auth, walletRoutes);
  router.use('/announcements', announcementRoutes(authMiddleware)); // Public route for latest announcements

  // Payment callback routes (public, no auth required) - MUST BE BEFORE PROTECTED ROUTES
  router.use('/payments/ppaypro', ppayproRoutes); // PPayPro callback routes
  router.use('/playwin6', playwin6Routes(authMiddleware)); // PlayWin6 provider routes (public and protected)

  // OKPAY callback routes (public, no auth required)
  const { okPayCallbackController, payOutCallbackController } = require('../controllers/paymentController');

  // OKPAY callback routes
  router.post('/payments/okpay/payin-callback', paymentCallbackWhitelist, okPayCallbackController);
  router.post('/payments/okpay/payout-callback', paymentCallbackWhitelist, payOutCallbackController);

  // L Pay callback routes (public, no auth required)
  const { lPayDepositCallbackController, lPayWithdrawalCallbackController } = require('../controllers/paymentController');

  // L Pay callback routes
  router.post('/payments/lpay/payin-callback', paymentCallbackWhitelist, lPayDepositCallbackController);
  router.post('/payments/lpay/payout-callback', paymentCallbackWhitelist, lPayWithdrawalCallbackController);

  // USDT WG Pay callback routes (public, no auth required)
  const { usdtwgPayDepositCallbackController, usdtwgPayWithdrawalCallbackController } = require('../controllers/paymentController');

  // USDT WG Pay callback routes
  router.post('/payments/usdtwgpay/payin-callback', paymentCallbackWhitelist, usdtwgPayDepositCallbackController);
  router.post('/payments/usdtwgpay/payout-callback', paymentCallbackWhitelist, usdtwgPayWithdrawalCallbackController);

  // 101pay callback routes (public, no auth required)
  const { pay101PayinCallbackController, pay101PayoutCallbackController, pay101UTRCallbackController } = require('../controllers/paymentController');

  // 101pay callback routes
  router.post('/payments/101pay/payin-callback', paymentCallbackWhitelist, pay101PayinCallbackController);
  router.post('/payments/101pay/payout-callback', paymentCallbackWhitelist, pay101PayoutCallbackController);
  router.post('/payments/101pay/utr-callback', paymentCallbackWhitelist, pay101UTRCallbackController);

  // SPRIBE routes - public endpoints first, then protected ones
  router.use('/spribe', spribeRoutes);  // This will handle both public and protected routes

  // PROTECTED ROUTES (require authentication)
  router.use('/bank-accounts', authMiddleware.auth, bankRoutes);
  router.use('/usdt-accounts', authMiddleware.auth, usdtRoutes);
  router.use('/games', authMiddleware.auth, gameRoutes);
  router.use('/internal', authMiddleware.auth, internalGameRoutes);
  router.use('/payments', authMiddleware.auth, paymentRoutes); // This now only handles protected payment routes
  router.use('/payment-gateways', authMiddleware.auth, paymentGatewayRoutes);
  router.use('/feedback', authMiddleware.auth, feedbackRoutes); // Protected feedback routes
  router.use('/vault', authMiddleware.auth, vaultRoutes); // Add vault routes
  router.use('/vip', authMiddleware.auth, vipRoutes); // Add vip routes
  router.use('/third-party-wallets', authMiddleware.auth, thirdPartyWalletRoutes); // Add third party wallet routes
  router.use('/activity', authMiddleware.auth, activityRoutes); // Add activity routes
  router.use('/announcements', authMiddleware.auth, announcementRoutes(authMiddleware)); // Add announcement routes
  router.use('/game-move-transactions', authMiddleware.auth, gameMoveTransactionRoutes); // Add game move transaction routes
  router.use('/transaction-reports', authMiddleware.auth, transactionReportRoutes); // Add transaction report routes (user access)
  router.use('/gift', authMiddleware.auth, giftRoutes); // Add gift routes
  // Add referral routes
  router.use('/referral', authMiddleware.auth, referralRoutes);

  // Wagering routes (protected)
  router.use('/wagering', authMiddleware.auth, wageringRoutes);

  // Admin routes (handle their own auth internally)
  router.use('/admin', adminRoutes(authMiddleware));

  // ADDED: Test route to check third-party wallet integration
  router.get('/debug/wallet-flow/:userId', authMiddleware.auth, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const User = require('../models/User');
      const ThirdPartyWallet = require('../models/ThirdPartyWallet');
      
      // Check user
      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
      
      // Check third-party wallet
      const wallet = await ThirdPartyWallet.findOne({
        where: { user_id: userId }
      });
      
      res.json({
        success: true,
        user: {
          id: user.user_id,
          name: user.user_name,
          mainWalletBalance: user.wallet_balance
        },
        thirdPartyWallet: wallet ? {
          id: wallet.wallet_id,
          balance: wallet.balance,
          currency: wallet.currency,
          isActive: wallet.is_active
        } : null,
        walletExists: !!wallet
      });
    } catch (error) {
      console.error('Wallet flow debug error:', error);
      res.status(500).json({
        success: false,
        message: 'Error checking wallet flow',
        error: error.message
      });
    }
  });

  // ADDED: Quick seamless test route
  router.get('/debug/seamless-test', authMiddleware.auth, (req, res) => {
    res.json({
      success: true,
      message: 'Seamless test endpoint reached',
      user: req.user.user_id,
      seamlessConfig: {
        apiLogin: process.env.SEAMLESS_API_LOGIN ? 'SET' : 'NOT SET',
        apiPassword: process.env.SEAMLESS_API_PASSWORD ? 'SET' : 'NOT SET',
        saltKey: process.env.SEAMLESS_SALT_KEY ? 'SET' : 'NOT SET',
        apiUrl: process.env.SEAMLESS_API_URL || 'DEFAULT'
      }
    });
  });

  // Debug route to list all available routes
  router.get('/debug/routes', (req, res) => {
    const routes = [];
    router.stack.forEach((middleware) => {
      if (middleware.route) {
        // Routes registered directly on the router
        routes.push({
          path: middleware.route.path,
          methods: Object.keys(middleware.route.methods)
        });
      } else if (middleware.name === 'router') {
        // Router middleware
        middleware.handle.stack.forEach((handler) => {
          if (handler.route) {
            routes.push({
              path: handler.route.path,
              methods: Object.keys(handler.route.methods)
            });
          }
        });
      }
    });
    res.json({
      success: true,
      message: 'Available routes',
      routes: routes,
      baseUrl: req.baseUrl,
      originalUrl: req.originalUrl
    });
  });

  // CATCH-ALL: 404 handler for unmatched routes
  router.use('*', (req, res) => {
    res.status(404).json({
      success: false,
      message: 'Route not found',
      path: req.originalUrl,
      method: req.method,
      timestamp: new Date().toISOString()
    });
  });

  return router;
};