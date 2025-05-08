// controllers/referralController.js
const referralService = require('../services/referralService');
const { Op } = require('sequelize');

/**
 * Get direct referrals
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getDirectReferralsController = async (req, res) => {
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
        
        const result = await referralService.getDirectReferrals(userId, dateFilter);
        
        if (result.success) {
            return res.status(200).json(result);
        } else {
            return res.status(400).json(result);
        }
    } catch (error) {
        console.error('Error in getDirectReferralsController:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching direct referrals'
        });
    }
};

/**
 * Get team referrals
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getTeamReferralsController = async (req, res) => {
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
        
        const result = await referralService.getTeamReferrals(userId, dateFilter);
        
        if (result.success) {
            return res.status(200).json(result);
        } else {
            return res.status(400).json(result);
        }
    } catch (error) {
        console.error('Error in getTeamReferralsController:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching team referrals'
        });
    }
};

/**
 * Get direct referral deposits
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getDirectReferralDepositsController = async (req, res) => {
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
        
        const result = await referralService.getDirectReferralDeposits(userId, dateFilter);
        
        if (result.success) {
            return res.status(200).json(result);
        } else {
            return res.status(400).json(result);
        }
    } catch (error) {
        console.error('Error in getDirectReferralDepositsController:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching direct referral deposits'
        });
    }
};

/**
 * Get team referral deposits
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
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

/**
 * Get commission earnings
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getCommissionEarningsController = async (req, res) => {
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
        
        const result = await referralService.getCommissionEarnings(userId, dateFilter);
        
        if (result.success) {
            return res.status(200).json(result);
        } else {
            return res.status(400).json(result);
        }
    } catch (error) {
        console.error('Error in getCommissionEarningsController:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching commission earnings'
        });
    }
};

/**
 * Get referral tree details
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getReferralTreeDetailsController = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { level } = req.query;
        
        const maxLevel = level ? parseInt(level) : 6;
        
        const result = await referralService.getReferralTreeDetails(userId, maxLevel);
        
        if (result.success) {
            return res.status(200).json(result);
        } else {
            return res.status(400).json(result);
        }
    } catch (error) {
        console.error('Error in getReferralTreeDetailsController:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching referral tree details'
        });
    }
};

/**
 * Record attendance
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
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

/**
 * Get direct referral analytics
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getDirectReferralAnalyticsController = async (req, res) => {
    try {
        const userId = req.user.user_id;
        
        // Get today's date range
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999);
        
        const todayFilter = {
            [Op.between]: [today, endOfToday]
        };
        
        // Get direct referrals for today
        const directReferralsToday = await referralService.getDirectReferrals(
            userId, 
            { created_at: todayFilter }
        );
        
        // Get direct referral deposits for today
        const directDepositsToday = await referralService.getDirectReferralDeposits(
            userId, 
            { time_of_request: todayFilter }
        );
        
        // Get all-time direct referrals
        const allTimeDirectReferrals = await referralService.getDirectReferrals(userId);
        
        // Get all-time direct deposits
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

/**
 * Get team referral analytics
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getTeamReferralAnalyticsController = async (req, res) => {
    try {
        const userId = req.user.user_id;
        
        // Get today's date range
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999);
        
        const todayFilter = {
            [Op.between]: [today, endOfToday]
        };
        
        // Get team referrals for today
        const teamReferralsToday = await referralService.getTeamReferrals(
            userId, 
            { created_at: todayFilter }
        );
        
        // Get team referral deposits for today
        const teamDepositsToday = await referralService.getTeamReferralDeposits(
            userId, 
            { time_of_request: todayFilter }
        );
        
        // Get all-time team referrals
        const allTimeTeamReferrals = await referralService.getTeamReferrals(userId);
        
        // Get all-time team deposits
        const allTimeTeamDeposits = await referralService.getTeamReferralDeposits(userId);
        
        // Get commission earnings
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
    getTeamReferralAnalyticsController
};