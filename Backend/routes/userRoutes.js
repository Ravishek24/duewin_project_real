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
    getUserTeamLevelStats,
    getUserRebateEarnings,
    getUserDetails,
    getInHouseGamesStatsController,
    getGameBetHistoryController,
    getThirdPartyGamesStatsController,
    getThirdPartyGameHistoryController
} = require('../controllers/userController/index');
const { auth, isAdmin, requirePhoneVerification } = require('../middlewares/authMiddleware');
const validationRules = require('../middleware/inputValidator');
const { authenticateToken } = require('../middleware/auth');
const { verifyEmailController } = require('../controllers/userController/emailVerificationController');
const { getUserProfilePicture, updateProfilePicture } = require('../services/userProfileService');
const { getModels } = require('../models');

const router = express.Router();

// Auth routes (no middleware)
router.post('/signup', validationRules.signup, registerController);
router.post('/login', validationRules.login, loginController);
router.post('/forgot-password', validationRules.forgotPassword, forgotPasswordController);
router.post('/validate-token', validationRules.validateToken, validateTokenController);
router.post('/reset-password', validationRules.resetPassword, resetPasswordController);

// Protected routes (require authentication)
router.get('/profile', auth, getProfileController);
router.put('/profile', auth, updateProfileController);

// Profile picture routes
router.get('/profile/picture', auth, async (req, res) => {
    try {
        const result = await getUserProfilePicture(req.user.user_id);
        if (result.success) {
            res.json(result);
        } else {
            res.status(404).json(result);
        }
    } catch (error) {
        console.error('Error getting profile picture:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error getting profile picture.' 
        });
    }
});

router.put('/profile/picture', auth, async (req, res) => {
    try {
        const { profile_picture_id } = req.body;
        if (!profile_picture_id) {
            return res.status(400).json({
                success: false,
                message: 'Profile picture ID is required'
            });
        }
        const result = await updateProfilePicture(req.user.user_id, profile_picture_id);
        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        console.error('Error updating profile picture:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error updating profile picture.' 
        });
    }
});

// Protected routes that require phone verification
router.get('/dashboard', auth, (req, res) => {
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
router.get('/admin/users/:user_id/team-level-stats', auth, isAdmin, getUserTeamLevelStats);
router.get('/admin/users/:user_id/rebate-earnings', auth, isAdmin, getUserRebateEarnings);

// User details route
router.get('/details', auth, getUserDetails);

// Public routes
//router.get('/verify-email', verifyEmailController);

// Get betting requirement status
router.get('/betting-requirement', auth, async (req, res) => {
    try {
        const userId = req.user.user_id;
        const models = await getModels();
        const User = models.User;

        const user = await User.findByPk(userId, {
            attributes: ['actual_deposit_amount', 'total_bet_amount']
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const actualDeposit = parseFloat(user.actual_deposit_amount || 0);
        const totalBet = parseFloat(user.total_bet_amount || 0);
        const remainingRequirement = Math.max(0, actualDeposit - totalBet);

        res.json({
            success: true,
            data: {
                actual_deposit_amount: actualDeposit,
                total_bet_amount: totalBet,
                remaining_requirement: remainingRequirement,
                requirement_met: totalBet >= actualDeposit
            }
        });

    } catch (error) {
        console.error('Error getting betting requirement:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// In-house games statistics routes
router.get('/in-house-games/stats', auth, getInHouseGamesStatsController);
router.get('/in-house-games/:gameType/history', auth, getGameBetHistoryController);

// Third-party games statistics routes
router.get('/third-party-games/stats', auth, getThirdPartyGamesStatsController);
router.get('/third-party-games/:gameType/history', auth, getThirdPartyGameHistoryController);

module.exports = router;