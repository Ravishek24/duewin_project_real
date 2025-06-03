// routes/index.js - FIXED VERSION
const express = require('express');
const jwt = require('jsonwebtoken');

// Import all route modules
const userRoutes = require('./userRoutes');
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
const mxPayRoutes = require('./mxPayRoutes');
const vipRoutes = require('./vipRoutes');
const thirdPartyWalletRoutes = require('./thirdPartyWalletRoutes');
const internalGameRoutes = require('./internalGameRoutes');
const vaultRoutes = require('./vaultRoutes');
const activityRoutes = require('./activityRoutes');

// Import middleware
const { auth, isAdmin } = require('../middlewares/authMiddleware');

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
router.get('/debug/auth', auth, (req, res) => {
  res.json({
    success: true,
    message: 'Auth middleware passed',
    user: {
      user_id: req.user.user_id,
      user_name: req.user.user_name,
      is_admin: req.user.is_admin,
      is_phone_verified: req.user.is_phone_verified
    }
  });
});

// Test referral endpoint specifically
router.get('/debug/referral', auth, (req, res) => {
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
router.use('/users', userRoutes);
router.use('/otp', otpRoutes);
router.use('/payments/mxpay', mxPayRoutes);
router.use('/seamless', seamlessRoutes);

// PROTECTED ROUTES (require authentication)
router.use('/bank-accounts', auth, bankRoutes);
router.use('/usdt-accounts', auth, usdtRoutes);
router.use('/wallet', auth, walletRoutes);
router.use('/games', auth, gameRoutes);
router.use('/internal', auth, internalGameRoutes);
router.use('/payments', auth, paymentRoutes);
router.use('/payment-gateways', auth, paymentGatewayRoutes);
router.use('/spribe', auth, spribeRoutes);
router.use('/vault', auth, vaultRoutes);
router.use('/api', auth, activityRoutes);

// FIXED: Seamless wallet routes (protected, different from callback routes)
router.use('/seamless-wallet', auth, seamlessWalletRoutes);

// FIXED: Third-party wallet routes (should require auth)
router.use('/third-party-wallet', auth, thirdPartyWalletRoutes);

// Other protected routes
router.use('/referrals', auth, referralRoutes); // FIXED: Referrals should require auth
router.use('/vip', auth, vipRoutes); // FIXED: VIP routes should require auth

// Admin routes (handle their own auth internally)
router.use('/admin', adminRoutes);

// ADDED: Test route to check third-party wallet integration
router.get('/debug/wallet-flow/:userId', auth, async (req, res) => {
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
router.get('/debug/seamless-test', auth, (req, res) => {
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

module.exports = router;