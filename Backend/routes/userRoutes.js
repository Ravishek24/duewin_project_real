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
const validationRules = require('../middleware/inputValidator');
const { authenticateToken } = require('../middleware/auth');
const { verifyEmailController } = require('../controllers/userController/emailVerificationController');
const { getUserProfilePicture, updateProfilePicture } = require('../services/userProfileService');
const { getModels } = require('../models');
const rateLimiters = require('../middleware/rateLimiter');

module.exports = (authMiddleware) => {
    const router = express.Router();

    // Auth routes (no middleware) - IP-based rate limiting
    router.post('/signup', rateLimiters.userRegistration, validationRules.signup, registerController);
    router.post('/login', rateLimiters.userLogin, validationRules.login, loginController);
    
    // 🚀 ULTRA-FAST: Optimized login endpoint for performance testing
    const ultraFastLoginController = require('../controllers/userController/ultraFastLoginController');
    router.post('/ultra-fast-login', rateLimiters.userLogin, validationRules.login, ultraFastLoginController);
    
    // 🚀 DIRECT DB: Bypasses Sequelize completely for maximum speed
    const directDatabaseLoginController = require('../controllers/userController/directDatabaseLoginController');
    router.post('/direct-db-login', rateLimiters.userLogin, validationRules.login, directDatabaseLoginController);
    
    // 🚀 RAW SQL: Uses existing Sequelize connection but raw SQL queries
    const rawSqlLoginController = require('../controllers/userController/rawSqlLoginController');
    router.post('/raw-sql-login', rateLimiters.userLogin, validationRules.login, rawSqlLoginController);
    
    router.post('/forgot-password', rateLimiters.userLogin, validationRules.forgotPassword, forgotPasswordController);
    router.post('/validate-token', rateLimiters.userLogin, validationRules.validateToken, validateTokenController);
    router.post('/reset-password', rateLimiters.userLogin, validationRules.resetPassword, resetPasswordController);

    // Protected routes (require authentication) - User-based rate limiting
    router.get('/profile', authMiddleware.auth, rateLimiters.profileManagement, getProfileController);
    router.put('/profile', authMiddleware.auth, rateLimiters.profileManagement, updateProfileController);

    // Profile picture routes - User-based rate limiting
    router.get('/profile/picture', authMiddleware.auth, rateLimiters.profileManagement, async (req, res) => {
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

    router.put('/profile/picture', authMiddleware.auth, rateLimiters.profileManagement, async (req, res) => {
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
    router.get('/dashboard', authMiddleware.auth, rateLimiters.profileManagement, (req, res) => {
        res.status(200).json({
            success: true,
            message: 'This is a protected route that requires phone verification.'
        });
    });

    // Logout route - session-based single-device logout
    router.post('/logout', authMiddleware.auth, async (req, res) => {
        const { logoutController } = require('../controllers/userController/index');
        await logoutController(req, res);
    });

    // Admin routes - No rate limiting for now as requested
    router.get('/admin/users', authMiddleware.auth, authMiddleware.isAdmin, getUserDetailsForAdmin);
    router.get('/admin/users/:user_id/bet-history', authMiddleware.auth, authMiddleware.isAdmin, getUserBetHistory);
    router.get('/admin/users/:user_id/deposit-history', authMiddleware.auth, authMiddleware.isAdmin, getUserDepositHistory);
    router.get('/admin/users/:user_id/withdrawal-history', authMiddleware.auth, authMiddleware.isAdmin, getUserWithdrawalHistory);
    router.get('/admin/users/:user_id/bank-details', authMiddleware.auth, authMiddleware.isAdmin, getUserBankDetails);
    router.get('/admin/users/:user_id/transaction-history', authMiddleware.auth, authMiddleware.isAdmin, getUserTransactionHistory);
    router.get('/admin/users/:user_id/team-summary', authMiddleware.auth, authMiddleware.isAdmin, getUserTeamSummary);
    router.get('/admin/users/:user_id/team-level-stats', authMiddleware.auth, authMiddleware.isAdmin, getUserTeamLevelStats);
    router.get('/admin/users/:user_id/rebate-earnings', authMiddleware.auth, authMiddleware.isAdmin, getUserRebateEarnings);

    // User details route - User-based rate limiting
    router.get('/details', authMiddleware.auth, rateLimiters.profileManagement, getUserDetails);

    // Public routes
    //router.get('/verify-email', verifyEmailController);

    // Get betting requirement status - User-based rate limiting
    router.get('/betting-requirement', authMiddleware.auth, rateLimiters.profileManagement, async (req, res) => {
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

    // In-house games statistics routes - User-based rate limiting
    router.get('/in-house-games/stats', authMiddleware.auth, rateLimiters.profileManagement, getInHouseGamesStatsController);
    router.get('/in-house-games/:gameType/history', authMiddleware.auth, rateLimiters.profileManagement, getGameBetHistoryController);

    // Third-party games statistics routes - User-based rate limiting
    router.get('/third-party-games/stats', authMiddleware.auth, rateLimiters.profileManagement, getThirdPartyGamesStatsController);
    router.get('/third-party-games/:gameType/history', authMiddleware.auth, rateLimiters.profileManagement, getThirdPartyGameHistoryController);

    return router;
};