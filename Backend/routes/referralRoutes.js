// routes/referralRoutes.js
import express from 'express';
import { 
    getDirectReferralsController,
    getTeamReferralsController,
    getDirectReferralDepositsController,
    getTeamReferralDepositsController,
    getCommissionEarningsController,
    getReferralTreeDetailsController,
    recordAttendanceController,
    getDirectReferralAnalyticsController,
    getTeamReferralAnalyticsController
} from '../controllers/referralController.js';
import { auth, requireEmailVerification } from '../middlewares/authMiddleware.js';

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

export default router;