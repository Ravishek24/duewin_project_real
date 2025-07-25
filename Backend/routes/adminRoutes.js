// routes/adminRoutes.js - FIXED VERSION
const express = require('express');
const { 
  getPendingWithdrawalsController,
  getWithdrawalsController,
  processWithdrawalActionController,
  getSuccessfulWithdrawalsController,
  getFailedWithdrawalsController
} = require('../controllers/adminController/withdrawalController');
const {
  createAdminController,
  getAllAdminsController,
  updateAdminController,
  removeAdminController
} = require('../controllers/adminController/adminController');
const {
  updateAdminProfileController,
  getAdminProfileController
} = require('../controllers/adminController/adminProfileController');
const {
  sendAdminOtpController,
  verifyAdminOtpController
} = require('../controllers/adminController/adminOtpController');
const { auth, isAdmin } = require('../middlewares/authMiddleware');
const adminIpWhitelist = require('../middleware/adminIpWhitelist');
const { 
  loginSystemConfig,
  getSystemConfigProfile, 
  updateSystemConfigProfile 
} = require('../controllers/adminController/systemConfigController');
const { 
    getTotalUsers, 
    getTodayRegistrations, 
    getUserStats,
    getTotalCommission
} = require('../controllers/adminController/adminStatsController');
const { 
    blockUser, 
    unblockUser, 
    getBlockedUsers,
    updateUserBalance 
} = require('../controllers/adminController/userManagementController');
const { 
    getTodayProfit,
    getWeeklyProfit,
    getMonthlyProfit,
    getProfitStats
} = require('../controllers/adminController/gameProfitController');
const { getTodayFinancialStats, getTotalFinancialStats, getCompleteFinancialStats } = require('../controllers/adminController/financialStatsController');
const { getActivePeriods, getCurrentPeriod, getRecentPeriods, getWingoStats, setWingoResult, getPeriodStatusForOverride } = require('../controllers/adminController/wingoGameController');
const { 
  getAllPendingRechargesController,
  processRechargeActionController,
  getAllSuccessfulRechargesController,
  getFirstRechargesController,
  getTodayTopDepositsController,
  getTodayTopWithdrawalsController
} = require('../controllers/adminController/rechargeController');
const {
  getAllPaymentGatewaysController,
  getAvailableDepositGatewaysController,
  getAvailableWithdrawalGatewaysController,
  toggleDepositStatusController,
  toggleWithdrawalStatusController,
  updateDepositLimitsController,
  getPaymentGatewayStatsController
} = require('../controllers/adminController/paymentGatewayController');
const { getBlockedEntities, unblockEntity, getViolationHistory } = require('../controllers/adminController/blockedEntitiesController');
const { createGiftCode, getGiftCodeByCode, getGiftCodeStatus, getAllGiftCodes, getGiftCodeStats } = require('../controllers/adminController/giftCodeController');
const { 
  getSpribeTransactionStatsController,
  getSeamlessTransactionStatsController,
  getCombinedTransactionStatsController
} = require('../controllers/adminController/gameTransactionStatsController');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

// Admin OTP routes (no auth required)
router.post('/otp/send', sendAdminOtpController);
router.post('/otp/verify', verifyAdminOtpController);

// TESTING ONLY: Direct admin login without OTP (bypass for testing)
// FIXED: Make sure this is properly async
router.post('/direct-login', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }
    
    // Find admin user
    const admin = await User.findOne({
      where: {
        email: email,
        is_admin: true
      }
    });
    
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }
    
    console.log('⚠️ WARNING: Using direct admin login (OTP bypassed) for testing purposes');
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        user_id: admin.user_id,
        is_admin: true
      },
      process.env.JWT_SECRET || 'default_jwt_secret_for_development_only',
      { expiresIn: '24h' }
    );
    
    // Remove sensitive data
    const adminData = admin.toJSON();
    delete adminData.password;
    
    return res.json({
      success: true,
      message: 'Direct admin login successful (for testing only)',
      data: {
        token,
        user: adminData
      }
    });
  } catch (error) {
    console.error('Error in direct admin login:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// System Config Login Route (no auth required)
router.post('/system-config/login', loginSystemConfig);

// Apply IP whitelist and auth middleware to protected routes
router.use(adminIpWhitelist);
router.use(auth);

// Admin profile management routes
router.get('/profile', getAdminProfileController);
router.put('/profile', updateAdminProfileController);

// System Config Profile Routes
router.get('/system-config/profile', getSystemConfigProfile);
router.put('/system-config/profile', updateSystemConfigProfile);

// Admin management routes
router.post('/admins', createAdminController);
router.get('/admins', getAllAdminsController);
router.put('/admins/:admin_id', updateAdminController);
router.delete('/admins/:admin_id', removeAdminController);

// Withdrawal management routes
router.get('/withdrawals/pending', getPendingWithdrawalsController);
router.get('/withdrawals/successful', getSuccessfulWithdrawalsController);
router.get('/withdrawals/failed', getFailedWithdrawalsController);
router.get('/withdrawals', getWithdrawalsController);
router.post('/withdrawals/process', processWithdrawalActionController);

// Recharge management routes
router.get('/recharges/pending', getAllPendingRechargesController);
router.post('/recharges/process', processRechargeActionController);
router.get('/recharges/successful', getAllSuccessfulRechargesController);
router.get('/recharges/first-time', getFirstRechargesController);
router.get('/recharges/top-today', getTodayTopDepositsController);
router.get('/withdrawals/top-today', getTodayTopWithdrawalsController);

// Admin statistics routes
router.get('/stats/total-users', getTotalUsers);
router.get('/stats/today-registrations', getTodayRegistrations);
router.get('/stats/user-stats', getUserStats);
router.get('/stats/total-commission', getTotalCommission);

// Game profit statistics routes
router.get('/stats/profit/today', getTodayProfit);
router.get('/stats/profit/weekly', getWeeklyProfit);
router.get('/stats/profit/monthly', getMonthlyProfit);
router.get('/stats/profit', getProfitStats);

// Financial Statistics Routes
router.get('/stats/financial/today', getTodayFinancialStats);
router.get('/stats/financial/total', getTotalFinancialStats);
router.get('/stats/financial', getCompleteFinancialStats);

// User management routes
router.post('/users/:user_id/block', blockUser);
router.post('/users/:user_id/unblock', unblockUser);
router.get('/users/blocked', getBlockedUsers);
router.post('/users/:user_id/balance', updateUserBalance);

// Wingo Game Routes
router.get('/games/wingo/active-periods', getActivePeriods);
router.get('/games/wingo/current', getCurrentPeriod);
router.get('/games/wingo/recent', getRecentPeriods);
router.get('/games/wingo/stats', getWingoStats);
// 🔐 ENABLED - Safe admin override with proper game logic integration
router.post('/games/wingo/set-result', setWingoResult);
router.get('/games/wingo/period/:periodId/status', getPeriodStatusForOverride);

// Payment Gateway Routes
router.get('/payment-gateways', getAllPaymentGatewaysController);
router.put('/payment-gateways/:id/toggle-deposit', toggleDepositStatusController);
router.put('/payment-gateways/:id/toggle-withdrawal', toggleWithdrawalStatusController);
router.put('/payment-gateways/:id/deposit-limits', updateDepositLimitsController);
router.get('/payment-gateways/stats', getPaymentGatewayStatsController);

// Public Payment Gateway Routes
router.get('/payment-gateways/deposit', getAvailableDepositGatewaysController);
router.get('/payment-gateways/withdrawal', getAvailableWithdrawalGatewaysController);

// Blocked entities management routes
router.get('/blocked-entities', getBlockedEntities);
router.post('/unblock-entity', unblockEntity);
router.get('/violation-history', getViolationHistory);

// Gift Code Management Routes
router.post('/gift-codes', createGiftCode);
router.get('/gift-codes/stats', getGiftCodeStats);
router.get('/gift-codes', getAllGiftCodes);
router.get('/gift-codes/:code', getGiftCodeByCode);
router.get('/gift-codes/:code/status', getGiftCodeStatus);

// Game Transaction Statistics Routes
router.get('/stats/games/spribe', getSpribeTransactionStatsController);
router.get('/stats/games/seamless', getSeamlessTransactionStatsController);
router.get('/stats/games/combined', getCombinedTransactionStatsController);

module.exports = router;