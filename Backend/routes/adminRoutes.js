// routes/adminRoutes.js
const express = require('express');
const { 
  getPendingWithdrawalsController,
  getWithdrawalsController,
  processWithdrawalActionController
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
const { auth, authenticateAdmin } = require('../middleware/auth');
const adminIpWhitelist = require('../middleware/adminIpWhitelist');
const { 
  loginSystemConfig,
  getSystemConfigProfile, 
  updateSystemConfigProfile 
} = require('../controllers/adminController/systemConfigController');
const { 
    getTotalUsers, 
    getTodayRegistrations, 
    getUserStats 
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
const { getActivePeriods, getCurrentPeriod, getRecentPeriods, getWingoStats, setWingoResult } = require('../controllers/adminController/wingoGameController');
const { 
  getAllPendingRechargesController, 
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
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

// Apply IP whitelist to all admin routes
router.use(adminIpWhitelist);

// Admin OTP routes (no auth required)
router.post('/otp/send', sendAdminOtpController);
router.post('/otp/verify', verifyAdminOtpController);

// TESTING ONLY: Direct admin login without OTP (bypass for testing)
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

// All other admin routes require authentication and admin privileges
router.use(auth);
router.use(authenticateAdmin);

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
router.get('/withdrawals', getWithdrawalsController);
router.post('/withdrawals/process', processWithdrawalActionController);

// Recharge management routes
router.get('/recharges/pending', getAllPendingRechargesController);
router.get('/recharges/first-time', getFirstRechargesController);
router.get('/recharges/top-today', getTodayTopDepositsController);
router.get('/withdrawals/top-today', getTodayTopWithdrawalsController);

// Admin statistics routes
router.get('/stats/total-users', getTotalUsers);
router.get('/stats/today-registrations', getTodayRegistrations);
router.get('/stats/user-stats', getUserStats);

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
router.post('/games/wingo/set-result', setWingoResult);

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

module.exports = router;