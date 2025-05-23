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
const { auth } = require('../middleware/auth');
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
router.get('/dashboard', auth, (req, res) => {
    if (!req.user.is_phone_verified) {
        return res.status(403).json({
            success: false,
            message: 'Phone verification required'
        });
    }
    res.status(200).json({
        success: true,
        message: 'This is a protected route that requires phone verification.'
    });
});

// Admin routes
router.get('/admin/users', auth, getUserDetailsForAdmin);
router.get('/admin/users/:user_id/bet-history', auth, getUserBetHistory);
router.get('/admin/users/:user_id/deposit-history', auth, getUserDepositHistory);
router.get('/admin/users/:user_id/withdrawal-history', auth, getUserWithdrawalHistory);
router.get('/admin/users/:user_id/bank-details', auth, getUserBankDetails);
router.get('/admin/users/:user_id/transaction-history', auth, getUserTransactionHistory);
router.get('/admin/users/:user_id/team-summary', auth, getUserTeamSummary);
router.get('/admin/users/:user_id/rebate-earnings', auth, getUserRebateEarnings);

module.exports = router;