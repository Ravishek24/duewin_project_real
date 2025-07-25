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
    getTeamReferralAnalyticsController
} = require('../controllers/referralController');

// Import the referral service for inline route handlers
const referralService = require('../services/referralService');

const { auth, requirePhoneVerification } = require('../middlewares/authMiddleware');

const router = express.Router();

// Direct referrals
router.get('/direct', auth, getDirectReferralsController);

// Team referrals
router.get('/team', auth, getTeamReferralsController);

// Direct referral deposits - both singular and plural paths
router.get('/direct/deposits', auth,  getDirectReferralDepositsController);
router.get('/direct/deposit', auth,  getDirectReferralDepositsController);

// Team referral deposits
router.get('/team/deposits', auth,  getTeamReferralDepositsController);
router.get('/team/deposit', auth,  getTeamReferralDepositsController);

// Commission earnings
router.get('/commissions', auth,  getCommissionEarningsController);

// Referral tree details
router.get('/tree', auth, getReferralTreeDetailsController);

// Analytics
router.get('/analytics/direct', auth, getDirectReferralAnalyticsController);
router.get('/analytics/team', auth, getTeamReferralAnalyticsController);

// Attendance bonus endpoints - FIXED WITH PROPER ASYNC HANDLERS
router.post('/attendance', auth, async (req, res) => {
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

router.get('/attendance/unclaimed', auth, requirePhoneVerification, async (req, res) => {
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

router.post('/attendance/claim', auth,  async (req, res) => {
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

router.get('/invitation/status', auth,  async (req, res) => {
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

router.post('/invitation/claim', auth, async (req, res) => {
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

// Attendance history endpoint
router.get('/attendance/history', auth, async (req, res) => {
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
router.get('/self-rebate/history', auth, async (req, res) => {
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
router.get('/self-rebate/stats', auth, async (req, res) => {
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