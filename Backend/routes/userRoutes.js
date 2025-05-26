const express = require('express');
const { 
    loginController, 
    registerController,
    forgotPasswordController,
    validateTokenController,
    resetPasswordController,
    getProfileController,
    updateProfileController,
    getUserDetailsForAdmin,
    getUserBetHistory,
    getUserDepositHistory,
    getUserWithdrawalHistory,
    getUserBankDetails,
    getUserTransactionHistory,
    getUserTeamSummary,
    getUserRebateEarnings,
    getUserDetails
} = require('../controllers/userController/index');
const { auth, isAdmin, requirePhoneVerification } = require('../middlewares/authMiddleware');
const validationRules = require('../middleware/inputValidator');

const router = express.Router();

// Auth routes (no middleware)
router.post('/signup', validationRules.signup, registerController);
router.post('/login', validationRules.login, loginController);
router.post('/forgot-password', forgotPasswordController);
router.post('/reset-password', resetPasswordController);
router.get('/validate-reset-token/:token', validateTokenController);

// Protected routes (require authentication)
router.get('/profile', auth, getProfileController);
router.put('/profile', auth, updateProfileController);

// Protected routes that require phone verification
router.get('/dashboard', auth, requirePhoneVerification, (req, res) => {
    res.status(200).json({
        success: true,
        message: 'This is a protected route that requires phone verification.'
    });
});

// Admin routes
router.get('/admin/users', auth, isAdmin, getUserDetailsForAdmin);
router.get('/admin/users/:user_id/bet-history', auth, isAdmin, getUserBetHistory);
router.get('/admin/users/:user_id/deposit-history', auth, isAdmin, getUserDepositHistory);
router.get('/admin/users/:user_id/withdrawal-history', auth, isAdmin, getUserWithdrawalHistory);
router.get('/admin/users/:user_id/bank-details', auth, isAdmin, getUserBankDetails);
router.get('/admin/users/:user_id/transaction-history', auth, isAdmin, getUserTransactionHistory);
router.get('/admin/users/:user_id/team-summary', auth, isAdmin, getUserTeamSummary);
router.get('/admin/users/:user_id/rebate-earnings', auth, isAdmin, getUserRebateEarnings);

module.exports = router;