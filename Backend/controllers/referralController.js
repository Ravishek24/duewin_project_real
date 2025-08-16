// controllers/referralController.js - DEBUG VERSION
const { Op } = require('sequelize');

// Add detailed error logging for referralService import
let referralService;
try {
    referralService = require('../services/referralService');
    console.log('✅ ReferralService imported successfully from services');
    console.log('🔧 Available functions:', Object.keys(referralService));
} catch (error) {
    console.error('❌ Failed to import referralService:', error);
    console.error('📋 Error stack:', error.stack);
}

/**
 * Get direct referrals - DEBUG VERSION
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getDirectReferralsController = async (req, res) => {
    try {
        console.log('🔍 DEBUG: getDirectReferralsController started');
        console.log('👤 User from req.user:', req.user);
        console.log('🆔 User ID:', req.user?.user_id);
        console.log('📊 Query params:', req.query);
        
        if (!referralService) {
            console.error('❌ ReferralService not available');
            return res.status(500).json({
                success: false,
                message: 'ReferralService not available'
            });
        }

        if (!referralService.getDirectReferrals) {
            console.error('❌ getDirectReferrals function not found in service');
            return res.status(500).json({
                success: false,
                message: 'getDirectReferrals function not found'
            });
        }

        const userId = req.user.user_id;
        if (!userId) {
            console.error('❌ No user ID found');
            return res.status(400).json({
                success: false,
                message: 'User ID not found'
            });
        }

        const { start_date, end_date } = req.query;
        console.log('📅 Date parameters:', { start_date, end_date });
        
        let dateFilter = null;
        if (start_date && end_date) {
            dateFilter = {
                [Op.between]: [new Date(start_date), new Date(end_date)]
            };
        } else if (start_date) {
            dateFilter = {
                [Op.gte]: new Date(start_date)
            };
        } else if (end_date) {
            dateFilter = {
                [Op.lte]: new Date(end_date)
            };
        }
        
        console.log('🔍 Date filter created:', dateFilter);
        console.log('📞 Calling referralService.getDirectReferrals...');
        
        const result = await referralService.getDirectReferrals(userId, dateFilter);
        console.log('📋 Service result received:', result);
        
        if (result.success) {
            console.log('✅ Returning success response');
            return res.status(200).json(result);
        } else {
            console.log('❌ Service returned error:', result.message);
            return res.status(400).json(result);
        }
    } catch (error) {
        console.error('💥 DETAILED ERROR in getDirectReferralsController:');
        console.error('📋 Error message:', error.message);
        console.error('📋 Error name:', error.name);
        console.error('📋 Error stack:', error.stack);
        console.error('📋 Error cause:', error.cause);
        console.error('📋 Full error object:', error);
        
        res.status(500).json({
            success: false,
            message: 'Server error fetching direct referrals',
            debug: {
                errorMessage: error.message,
                errorName: error.name,
                errorStack: error.stack,
                userId: req.user?.user_id,
                hasReferralService: !!referralService,
                hasGetDirectReferrals: !!(referralService && referralService.getDirectReferrals)
            }
        });
    }
};

/**
 * Get team referrals - DEBUG VERSION
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getTeamReferralsController = async (req, res) => {
    try {
        console.log('🏆 DEBUG: getTeamReferralsController started');
        console.log('👤 User from req.user:', req.user);
        console.log('🆔 User ID:', req.user?.user_id);
        console.log('📊 Query params:', req.query);
        
        if (!referralService) {
            console.error('❌ ReferralService not available');
            return res.status(500).json({
                success: false,
                message: 'ReferralService not available'
            });
        }

        if (!referralService.getTeamReferrals) {
            console.error('❌ getTeamReferrals function not found in service');
            return res.status(500).json({
                success: false,
                message: 'getTeamReferrals function not found'
            });
        }

        const userId = req.user.user_id;
        if (!userId) {
            console.error('❌ No user ID found');
            return res.status(400).json({
                success: false,
                message: 'User ID not found'
            });
        }

        const { start_date, end_date, page = 1, limit = 5 } = req.query;
        console.log('📅 Date parameters:', { start_date, end_date });
        
        let dateFilter = null;
        if (start_date && end_date) {
            dateFilter = {
                [Op.between]: [new Date(start_date), new Date(end_date)]
            };
        } else if (start_date) {
            dateFilter = {
                [Op.gte]: new Date(start_date)
            };
        } else if (end_date) {
            dateFilter = {
                [Op.lte]: new Date(end_date)
            };
        }
        
        console.log('🔍 Date filter created:', dateFilter);
        console.log('📞 Calling referralService.getTeamReferrals...');
        console.log('📄 Pagination params:', { page: parseInt(page), limit: parseInt(limit) });
        
        const result = await referralService.getTeamReferrals(userId, dateFilter, parseInt(page), parseInt(limit));
        console.log('📋 Service result received:', result);
        
        if (result.success) {
            console.log('✅ Returning success response');
            return res.status(200).json(result);
        } else {
            console.log('❌ Service returned error:', result.message);
            return res.status(400).json(result);
        }
    } catch (error) {
        console.error('💥 DETAILED ERROR in getTeamReferralsController:');
        console.error('📋 Error message:', error.message);
        console.error('📋 Error name:', error.name);
        console.error('📋 Error stack:', error.stack);
        console.error('📋 Error cause:', error.cause);
        console.error('📋 Full error object:', error);
        
        res.status(500).json({
            success: false,
            message: 'Server error fetching team referrals',
            debug: {
                errorMessage: error.message,
                errorName: error.name,
                errorStack: error.stack,
                userId: req.user?.user_id,
                hasReferralService: !!referralService,
                hasGetTeamReferrals: !!(referralService && referralService.getTeamReferrals)
            }
        });
    }
};

/**
 * Get team referrals for any user (Admin function)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getTeamReferralsForAdminController = async (req, res) => {
    try {
        console.log('👑 [ADMIN] getTeamReferralsForAdminController started');
        
        // Admin check is now handled at route level
        console.log('👑 [ADMIN] User authenticated as admin:', req.user.user_id);

        const { target_user_id, start_date, end_date, page = 1, limit = 5 } = req.query;
        
        if (!target_user_id) {
            return res.status(400).json({
                success: false,
                message: 'target_user_id is required'
            });
        }

        console.log('🎯 Admin query params:', { target_user_id, start_date, end_date, page, limit });
        
        let dateFilter = null;
        if (start_date && end_date) {
            dateFilter = {
                [Op.between]: [new Date(start_date), new Date(end_date)]
            };
        } else if (start_date) {
            dateFilter = {
                [Op.gte]: new Date(start_date)
            };
        } else if (end_date) {
            dateFilter = {
                [Op.lte]: new Date(end_date)
            };
        }
        
        console.log('🔍 Date filter created:', dateFilter);
        console.log('📞 Calling referralService.getTeamReferralsForAdmin...');
        
        const result = await referralService.getTeamReferralsForAdmin(
            parseInt(target_user_id), 
            dateFilter,
            parseInt(page), 
            parseInt(limit)
        );
        
        console.log('📋 Service result received:', result);
        
        if (result.success) {
            console.log('✅ Returning success response');
            return res.status(200).json(result);
        } else {
            console.log('❌ Service returned error:', result.message);
            return res.status(400).json(result);
        }
    } catch (error) {
        console.error('💥 [ADMIN] Error in getTeamReferralsForAdminController:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching team referrals for admin',
            error: error.message
        });
    }
};

/**
 * Get direct referral deposits - DEBUG VERSION
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getDirectReferralDepositsController = async (req, res) => {
    try {
        console.log('💰 DEBUG: getDirectReferralDepositsController started');
        console.log('👤 User from req.user:', req.user);
        console.log('🆔 User ID:', req.user?.user_id);
        console.log('📊 Query params:', req.query);
        
        if (!referralService) {
            console.error('❌ ReferralService not available');
            return res.status(500).json({
                success: false,
                message: 'ReferralService not available'
            });
        }

        if (!referralService.getDirectReferralDeposits) {
            console.error('❌ getDirectReferralDeposits function not found in service');
            return res.status(500).json({
                success: false,
                message: 'getDirectReferralDeposits function not found'
            });
        }

        const userId = req.user.user_id;
        if (!userId) {
            console.error('❌ No user ID found');
            return res.status(400).json({
                success: false,
                message: 'User ID not found'
            });
        }

        const { start_date, end_date } = req.query;
        console.log('📅 Date parameters:', { start_date, end_date });
        
        let dateFilter = null;
        if (start_date && end_date) {
            dateFilter = {
                [Op.between]: [new Date(start_date), new Date(end_date)]
            };
        } else if (start_date) {
            dateFilter = {
                [Op.gte]: new Date(start_date)
            };
        } else if (end_date) {
            dateFilter = {
                [Op.lte]: new Date(end_date)
            };
        }
        
        console.log('🔍 Date filter created:', dateFilter);
        console.log('📞 Calling referralService.getDirectReferralDeposits...');
        
        const result = await referralService.getDirectReferralDeposits(userId, dateFilter);
        console.log('📋 Service result received:', result);
        
        if (result.success) {
            console.log('✅ Returning success response');
            return res.status(200).json(result);
        } else {
            console.log('❌ Service returned error:', result.message);
            return res.status(400).json(result);
        }
    } catch (error) {
        console.error('💥 DETAILED ERROR in getDirectReferralDepositsController:');
        console.error('📋 Error message:', error.message);
        console.error('📋 Error name:', error.name);
        console.error('📋 Error stack:', error.stack);
        console.error('📋 Error cause:', error.cause);
        console.error('📋 Full error object:', error);
        
        res.status(500).json({
            success: false,
            message: 'Server error fetching direct referral deposits',
            debug: {
                errorMessage: error.message,
                errorName: error.name,
                errorStack: error.stack,
                userId: req.user?.user_id,
                hasReferralService: !!referralService,
                hasGetDirectReferralDeposits: !!(referralService && referralService.getDirectReferralDeposits)
            }
        });
    }
};

// Keep other controller functions as they were, but add similar debugging
const getTeamReferralDepositsController = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { start_date, end_date } = req.query;
        
        let dateFilter = null;
        if (start_date && end_date) {
            dateFilter = {
                [Op.between]: [new Date(start_date), new Date(end_date)]
            };
        } else if (start_date) {
            dateFilter = {
                [Op.gte]: new Date(start_date)
            };
        } else if (end_date) {
            dateFilter = {
                [Op.lte]: new Date(end_date)
            };
        }
        
        const result = await referralService.getTeamReferralDeposits(userId, dateFilter);
        
        if (result.success) {
            return res.status(200).json(result);
        } else {
            return res.status(400).json(result);
        }
    } catch (error) {
        console.error('Error in getTeamReferralDepositsController:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching team referral deposits'
        });
    }
};

const getCommissionEarningsController = async (req, res) => {
    try {
        console.log('💸 DEBUG: getCommissionEarningsController started');
        console.log('🆔 User ID:', req.user?.user_id);
        
        const userId = req.user.user_id;
        const { start_date, end_date, page = 1, limit = 20 } = req.query;
        
        // Parse pagination parameters
        const pageNum = parseInt(page) || 1;
        const limitNum = parseInt(limit) || 20;
        
        // Validate pagination parameters
        if (pageNum < 1) {
            return res.status(400).json({
                success: false,
                message: 'Page number must be greater than 0'
            });
        }
        
        if (limitNum < 1 || limitNum > 100) {
            return res.status(400).json({
                success: false,
                message: 'Limit must be between 1 and 100'
            });
        }
        
        let dateFilter = null;
        if (start_date && end_date) {
            dateFilter = {
                [Op.between]: [new Date(start_date), new Date(end_date)]
            };
        } else if (start_date) {
            dateFilter = {
                [Op.gte]: new Date(start_date)
            };
        } else if (end_date) {
            dateFilter = {
                [Op.lte]: new Date(end_date)
            };
        }
        
        console.log('📞 Calling referralService.getCommissionEarnings...');
        console.log(`📄 Pagination: Page ${pageNum}, Limit ${limitNum}`);
        const result = await referralService.getCommissionEarnings(userId, dateFilter, pageNum, limitNum);
        console.log('📋 Service result received:', result);
        
        if (result.success) {
            return res.status(200).json(result);
        } else {
            return res.status(400).json(result);
        }
    } catch (error) {
        console.error('💥 DETAILED ERROR in getCommissionEarningsController:');
        console.error('📋 Error message:', error.message);
        console.error('📋 Error stack:', error.stack);
        
        res.status(500).json({
            success: false,
            message: 'Server error fetching commission earnings',
            debug: {
                errorMessage: error.message,
                errorStack: error.stack,
                userId: req.user?.user_id
            }
        });
    }
};

const getReferralTreeDetailsController = async (req, res) => {
    try {
        console.log('🌳 DEBUG: getReferralTreeDetailsController started');
        console.log('🆔 User ID:', req.user?.user_id);
        
        if (!referralService) {
            console.error('❌ ReferralService not available');
            return res.status(500).json({
                success: false,
                message: 'ReferralService not available'
            });
        }

        if (!referralService.getReferralTreeDetails) {
            console.error('❌ getReferralTreeDetails function not found in service');
            return res.status(500).json({
                success: false,
                message: 'getReferralTreeDetails function not found'
            });
        }

        const userId = req.user.user_id;
        const { level } = req.query;
        
        const maxLevel = level ? parseInt(level) : 6;
        
        console.log('📞 Calling referralService.getReferralTreeDetails...');
        const result = await referralService.getReferralTreeDetails(userId, maxLevel);
        console.log('📋 Service result received:', result);
        
        if (result.success !== false) {
            return res.status(200).json({
                success: true,
                ...result
            });
        } else {
            return res.status(400).json(result);
        }
    } catch (error) {
        console.error('💥 ERROR in getReferralTreeDetailsController:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching referral tree details',
            debug: {
                errorMessage: error.message,
                errorStack: error.stack
            }
        });
    }
};

const recordAttendanceController = async (req, res) => {
    try {
        const userId = req.user.user_id;
        
        const result = await referralService.recordAttendance(userId);
        
        if (result.success) {
            return res.status(200).json(result);
        } else {
            return res.status(400).json(result);
        }
    } catch (error) {
        console.error('Error in recordAttendanceController:', error);
        res.status(500).json({
            success: false,
            message: 'Server error recording attendance'
        });
    }
};

const getDirectReferralAnalyticsController = async (req, res) => {
    try {
        const userId = req.user.user_id;
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999);
        
        const todayFilter = {
            [Op.between]: [today, endOfToday]
        };
        
        const directReferralsToday = await referralService.getDirectReferrals(
            userId, 
            { created_at: todayFilter }
        );
        
        const directDepositsToday = await referralService.getDirectReferralDeposits(
            userId, 
            { time_of_request: todayFilter }
        );
        
        const allTimeDirectReferrals = await referralService.getDirectReferrals(userId);
        
        const allTimeDirectDeposits = await referralService.getDirectReferralDeposits(userId);
        
        return res.status(200).json({
            success: true,
            today: {
                referrals: directReferralsToday.success ? directReferralsToday.total : 0,
                deposits: {
                    count: directDepositsToday.success ? directDepositsToday.totalCount : 0,
                    amount: directDepositsToday.success ? directDepositsToday.totalAmount : 0,
                    firstCount: directDepositsToday.success ? directDepositsToday.firstDepositCount : 0,
                    firstAmount: directDepositsToday.success ? directDepositsToday.firstDepositAmount : 0
                }
            },
            allTime: {
                referrals: allTimeDirectReferrals.success ? allTimeDirectReferrals.total : 0,
                deposits: {
                    count: allTimeDirectDeposits.success ? allTimeDirectDeposits.totalCount : 0,
                    amount: allTimeDirectDeposits.success ? allTimeDirectDeposits.totalAmount : 0,
                    firstCount: allTimeDirectDeposits.success ? allTimeDirectDeposits.firstDepositCount : 0,
                    firstAmount: allTimeDirectDeposits.success ? allTimeDirectDeposits.firstDepositAmount : 0
                }
            }
        });
    } catch (error) {
        console.error('Error in getDirectReferralAnalyticsController:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching direct referral analytics'
        });
    }
};

const getTeamReferralAnalyticsController = async (req, res) => {
    try {
        const userId = req.user.user_id;
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999);
        
        const todayFilter = {
            [Op.between]: [today, endOfToday]
        };
        
        const teamReferralsToday = await referralService.getTeamReferrals(
            userId, 
            { created_at: todayFilter }
        );
        
        const teamDepositsToday = await referralService.getTeamReferralDeposits(
            userId, 
            { time_of_request: todayFilter }
        );
        
        const allTimeTeamReferrals = await referralService.getTeamReferrals(userId);
        
        const allTimeTeamDeposits = await referralService.getTeamReferralDeposits(userId);
        
        const commissionsToday = await referralService.getCommissionEarnings(
            userId,
            { created_at: todayFilter }
        );
        
        const allTimeCommissions = await referralService.getCommissionEarnings(userId);
        
        return res.status(200).json({
            success: true,
            today: {
                referrals: teamReferralsToday.success ? teamReferralsToday.total : 0,
                deposits: {
                    count: teamDepositsToday.success ? teamDepositsToday.totalCount : 0,
                    amount: teamDepositsToday.success ? teamDepositsToday.totalAmount : 0,
                    firstCount: teamDepositsToday.success ? teamDepositsToday.firstDepositCount : 0,
                    firstAmount: teamDepositsToday.success ? teamDepositsToday.firstDepositAmount : 0
                },
                commission: commissionsToday.success ? commissionsToday.totalAmount : 0
            },
            allTime: {
                referrals: allTimeTeamReferrals.success ? allTimeTeamReferrals.total : 0,
                deposits: {
                    count: allTimeTeamDeposits.success ? allTimeTeamDeposits.totalCount : 0,
                    amount: allTimeTeamDeposits.success ? allTimeTeamDeposits.totalAmount : 0,
                    firstCount: allTimeTeamDeposits.success ? allTimeTeamDeposits.firstDepositCount : 0,
                    firstAmount: allTimeTeamDeposits.success ? allTimeTeamDeposits.firstDepositAmount : 0
                },
                commission: allTimeCommissions.success ? allTimeCommissions.totalAmount : 0
            }
        });
    } catch (error) {
        console.error('Error in getTeamReferralAnalyticsController:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching team referral analytics'
        });
    }
};

module.exports = {
    getDirectReferralsController,
    getTeamReferralsController,
    getDirectReferralDepositsController,
    getTeamReferralDepositsController,
    getCommissionEarningsController,
    getReferralTreeDetailsController,
    recordAttendanceController,
    getDirectReferralAnalyticsController,
    getTeamReferralAnalyticsController,
    getTeamReferralsForAdminController
};