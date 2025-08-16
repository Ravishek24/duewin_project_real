// routes/referralRoutes.js - FIXED VERSION
const express = require('express');

// Import controller functions
const {
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
} = require('../controllers/referralController');

// Import the referral service for inline route handlers
const referralService = require('../services/referralService');

// NOTE: Auth middleware is applied at router level in index.js
const rateLimiters = require('../middleware/rateLimiter');

const router = express.Router();

// Direct referrals - Rate limited
router.get('/direct', rateLimiters.referralSystem, getDirectReferralsController);

// Team referrals - Rate limited
router.get('/team', rateLimiters.referralSystem, getTeamReferralsController);

// Direct referral deposits - both singular and plural paths - Rate limited
router.get('/direct/deposits', rateLimiters.referralSystem, getDirectReferralDepositsController);
router.get('/direct/deposit', rateLimiters.referralSystem, getDirectReferralDepositsController);

// Team referral deposits - Rate limited
router.get('/team/deposits', rateLimiters.referralSystem, getTeamReferralDepositsController);
router.get('/team/deposit', rateLimiters.referralSystem, getTeamReferralDepositsController);

// Commission earnings - Rate limited
router.get('/commissions', rateLimiters.referralSystem, getCommissionEarningsController);

// Referral tree details - Rate limited
router.get('/tree', rateLimiters.referralSystem, getReferralTreeDetailsController);

// Analytics - Rate limited
router.get('/analytics/direct', rateLimiters.referralSystem, getDirectReferralAnalyticsController);
router.get('/analytics/team', rateLimiters.referralSystem, getTeamReferralAnalyticsController);

// Admin team referrals - Rate limited + Admin only
router.get('/admin/team', rateLimiters.referralSystem, (req, res, next) => {
    // Check if user is admin
    if (!req.user || !req.user.is_admin) {
        return res.status(403).json({
            success: false,
            message: 'Admin access required'
        });
    }
    next();
}, getTeamReferralsForAdminController);

// Valid referral history - Rate limited
router.get('/valid/history', rateLimiters.referralSystem, async (req, res) => {
    try {
        console.log('👥 DEBUG: Valid referral history route hit');
        const userId = req.user.user_id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        
        console.log('🆔 User ID:', userId, 'Page:', page, 'Limit:', limit);
        
        if (!referralService || !referralService.getValidReferralHistory) {
            return res.status(500).json({
                success: false,
                message: 'Valid referral history service not available'
            });
        }
        
        const result = await referralService.getValidReferralHistory(userId, page, limit);
        console.log('📋 Valid referral history result:', result);

        if (result.success) {
            return res.status(200).json(result);
        } else {
            return res.status(400).json(result);
        }
    } catch (error) {
        console.error('💥 Error in valid referral history route:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error getting valid referral history',
            debug: { error: error.message }
        });
    }
});

// Attendance bonus endpoints - FIXED WITH PROPER ASYNC HANDLERS - Rate limited
router.post('/attendance', rateLimiters.referralSystem, async (req, res) => {
    try {
        console.log('📅 DEBUG: Attendance route hit');
        const userId = req.user.user_id;
        console.log('🆔 User ID:', userId);
        
        if (!referralService || !referralService.recordAttendance) {
            return res.status(500).json({
                success: false,
                message: 'Attendance service not available'
            });
        }
        
        const result = await referralService.recordAttendance(userId);
        console.log('📋 Attendance result:', result);

        if (result.success) {
            return res.status(200).json(result);
        } else {
            return res.status(400).json(result);
        }
    } catch (error) {
        console.error('💥 Error in attendance route:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error recording attendance',
            debug: { error: error.message }
        });
    }
});

router.get('/attendance/unclaimed', async (req, res) => {
    try {
        console.log('📅 DEBUG: Unclaimed attendance route hit');
        const userId = req.user.user_id;
        
        if (!referralService || !referralService.getUnclaimedAttendanceBonuses) {
            return res.status(500).json({
                success: false,
                message: 'Attendance service not available'
            });
        }
        
        const result = await referralService.getUnclaimedAttendanceBonuses(userId);

        if (result.success) {
            return res.status(200).json(result);
        } else {
            return res.status(400).json(result);
        }
    } catch (error) {
        console.error('💥 Error in unclaimed attendance route:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error getting unclaimed bonuses',
            debug: { error: error.message }
        });
    }
});

router.post('/attendance/claim',  async (req, res) => {
    try {
        console.log('📅 DEBUG: Claim attendance route hit');
        const userId = req.user.user_id;
        const { attendanceDate } = req.body;
        
        if (!referralService || !referralService.claimAttendanceBonus) {
            return res.status(500).json({
                success: false,
                message: 'Attendance service not available'
            });
        }

        const result = await referralService.claimAttendanceBonus(userId, attendanceDate);

        if (result.success) {
            return res.status(200).json(result);
        } else {
            return res.status(400).json(result);
        }
    } catch (error) {
        console.error('💥 Error in claim attendance route:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error claiming bonus',
            debug: { error: error.message }
        });
    }
});

// Invitation bonus endpoints
router.get('/invitation/status',  async (req, res) => {
    try {
        console.log('🎁 DEBUG: Invitation status route hit');
        const userId = req.user.user_id;
        console.log('🆔 User ID:', userId);
        
        if (!referralService || !referralService.getInvitationBonusStatus) {
            return res.status(500).json({
                success: false,
                message: 'Invitation service not available'
            });
        }
        
        const result = await referralService.getInvitationBonusStatus(userId);
        console.log('📋 Invitation status result:', result);
        
        if (result.success) {
            return res.status(200).json(result);
        } else {
            return res.status(400).json(result);
        }
    } catch (error) {
        console.error('💥 Error in invitation status route:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error getting invitation status',
            debug: { error: error.message }
        });
    }
});

router.post('/invitation/claim', async (req, res) => {
    try {
        console.log('🎁 DEBUG: Invitation claim route hit');
        const userId = req.user.user_id;
        console.log('🆔 User ID:', userId);
        
        if (!referralService || !referralService.claimInvitationBonus) {
            return res.status(500).json({
                success: false,
                message: 'Invitation service not available'
            });
        }
        
        const result = await referralService.claimInvitationBonus(userId);
        console.log('📋 Invitation claim result:', result);
        
        if (result.success) {
            return res.status(200).json(result);
        } else {
            return res.status(400).json(result);
        }
    } catch (error) {
        console.error('💥 Error in invitation claim route:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error claiming invitation bonus',
            debug: { error: error.message }
        });
    }
});

// 🆕 NEW: Get invitation reward history
router.get('/invitation/history', async (req, res) => {
    try {
        console.log('🎁 DEBUG: Invitation reward history route hit');
        const userId = req.user.user_id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        
        console.log('🆔 User ID:', userId, 'Page:', page, 'Limit:', limit);
        
        if (!referralService || !referralService.getInvitationRewardHistory) {
            return res.status(500).json({
                success: false,
                message: 'Invitation history service not available'
            });
        }
        
        const result = await referralService.getInvitationRewardHistory(userId, page, limit);
        console.log('📋 Invitation history result:', result);
        
        if (result.success) {
            return res.status(200).json(result);
        } else {
            return res.status(400).json(result);
        }
    } catch (error) {
        console.error('💥 Error in invitation history route:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error getting invitation reward history',
            debug: { error: error.message }
        });
    }
});

// Attendance history endpoint
router.get('/attendance/history', async (req, res) => {
    try {
        console.log('📅 DEBUG: Attendance history route hit');
        const userId = req.user.user_id;
        
        if (!referralService || !referralService.getAttendanceHistory) {
            return res.status(500).json({
                success: false,
                message: 'Attendance service not available'
            });
        }
        
        const result = await referralService.getAttendanceHistory(userId);
        console.log('📋 Attendance history result:', result);

        if (result.success) {
            return res.status(200).json(result);
        } else {
            return res.status(400).json(result);
        }
    } catch (error) {
        console.error('💥 Error in attendance history route:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error getting attendance history',
            debug: { error: error.message }
        });
    }
});

// Self rebate history endpoint
router.get('/self-rebate/history', async (req, res) => {
    try {
        console.log('💰 DEBUG: Self rebate history route hit');
        const userId = req.user.user_id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        
        if (!referralService || !referralService.getSelfRebateHistory) {
            return res.status(500).json({
                success: false,
                message: 'Rebate service not available'
            });
        }
        
        const result = await referralService.getSelfRebateHistory(userId, page, limit);
        console.log('📋 Self rebate history result:', result);

        if (result.success) {
            return res.status(200).json(result);
        } else {
            return res.status(400).json(result);
        }
    } catch (error) {
        console.error('💥 Error in self rebate history route:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error getting self rebate history',
            debug: { error: error.message }
        });
    }
});

// Self rebate statistics endpoint
router.get('/self-rebate/stats', async (req, res) => {
    try {
        console.log('💰 DEBUG: Self rebate stats route hit');
        const userId = req.user.user_id;
        
        if (!referralService || !referralService.getSelfRebateStats) {
            return res.status(500).json({
                success: false,
                message: 'Rebate service not available'
            });
        }
        
        const result = await referralService.getSelfRebateStats(userId);
        console.log('📋 Self rebate stats result:', result);

        if (result.success) {
            return res.status(200).json(result);
        } else {
            return res.status(400).json(result);
        }
    } catch (error) {
        console.error('💥 Error in self rebate stats route:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error getting self rebate statistics',
            debug: { error: error.message }
        });
    }
});

module.exports = router;