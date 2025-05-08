// routes/referralRoutes.js
const express = require('express');
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

// Import the new functions
const {
    recordAttendance,
    getUnclaimedAttendanceBonuses,
    claimAttendanceBonus,
    getInvitationBonusStatus,
    claimInvitationBonus
    // ...other imports
} = require('../services/referralService');

const { auth, requirePhoneVerification } = require('../middlewares/authMiddleware');

const router = express.Router();

// All routes require authentication
router.use(auth);

// Direct referrals
router.get('/direct', getDirectReferralsController);

// Team referrals
router.get('/team', getTeamReferralsController);

// Direct referral deposits
router.get('/direct/deposits', getDirectReferralDepositsController);

// Team referral deposits
router.get('/team/deposits', getTeamReferralDepositsController);

// Commission earnings
router.get('/commissions', getCommissionEarningsController);

// Referral tree details
router.get('/tree', getReferralTreeDetailsController);

// Record attendance
router.post('/attendance', recordAttendanceController);

// Analytics
router.get('/analytics/direct', getDirectReferralAnalyticsController);
router.get('/analytics/team', getTeamReferralAnalyticsController);

// Attendance bonus endpoints
router.post('/attendance', auth, async (req, res) => {
    const userId = req.user.user_id;
    const result = await recordAttendance(userId);

    if (result.success) {
        return res.status(200).json(result);
    } else {
        return res.status(400).json(result);
    }
});

router.get('/attendance/unclaimed', auth, async (req, res) => {
    const userId = req.user.user_id;
    const result = await getUnclaimedAttendanceBonuses(userId);

    if (result.success) {
        return res.status(200).json(result);
    } else {
        return res.status(400).json(result);
    }
});

router.post('/attendance/claim', auth, async (req, res) => {
    const userId = req.user.user_id;
    const { attendanceDate } = req.body;

    const result = await claimAttendanceBonus(userId, attendanceDate);

    if (result.success) {
        return res.status(200).json(result);
    } else {
        return res.status(400).json(result);
    }
});


// Invitation bonus endpoints
router.get('/invitation/status', auth, async (req, res) => {
    const userId = req.user.user_id;
    const result = await getInvitationBonusStatus(userId);
    
    if (result.success) {
        return res.status(200).json(result);
    } else {
        return res.status(400).json(result);
    }
});

router.post('/invitation/claim', auth, async (req, res) => {
    const userId = req.user.user_id;
    const result = await claimInvitationBonus(userId);
    
    if (result.success) {
        return res.status(200).json(result);
    } else {
        return res.status(400).json(result);
    }
});


module.exports = router;