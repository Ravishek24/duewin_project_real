// Backend/routes/wageringRoutes.js
const express = require('express');
const router = express.Router();
const { getUserWageringDetails, checkWithdrawalEligibility } = require('../controllers/wageringController');
const { auth } = require('../middleware/auth');

/**
 * @route   GET /api/wagering/details
 * @desc    Get wagering details for current user
 * @access  Private (User)
 */
router.get('/details', auth, async (req, res) => {
    try {
        const userId = req.user.user_id;
        const result = await getUserWageringDetails(userId);
        
        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        console.error('❌ Error in current user wagering route:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/wagering/eligibility
 * @desc    Check current user's withdrawal eligibility
 * @access  Private (User)
 */
router.get('/eligibility', auth, async (req, res) => {
    try {
        const userId = req.user.user_id;
        const result = await checkWithdrawalEligibility(userId);
        
        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        console.error('❌ Error in current user eligibility route:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/wagering/details/:userId
 * @desc    Get detailed wagering information for user
 * @access  Private (Admin/User)
 */
router.get('/details/:userId', auth, async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Check if user is authorized to view this user's data
        if (req.user.role !== 'admin' && req.user.user_id != userId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied - you can only view your own wagering details'
            });
        }

        const result = await getUserWageringDetails(userId);
        
        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        console.error('❌ Error in wagering details route:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/wagering/eligibility/:userId
 * @desc    Check if user is eligible for withdrawal
 * @access  Private (Admin/User)
 */
router.get('/eligibility/:userId', auth, async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Check if user is authorized to view this user's data
        if (req.user.role !== 'admin' && req.user.user_id != userId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied - you can only check your own eligibility'
            });
        }

        const result = await checkWithdrawalEligibility(userId);
        
        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        console.error('❌ Error in withdrawal eligibility route:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

module.exports = router;
