const express = require('express');
const router = express.Router();
const Joi = require('joi');
const { auth } = require('../middlewares/authMiddleware');
const { validateRequest } = require('../middleware/validation');
const selfRebateService = require('../services/selfRebateService');
const activityRewardsService = require('../services/activityRewardsService');

// Validation schemas
const historyQuerySchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    days: Joi.number().integer().min(1).max(90).default(30)
});

// GET /api/self-rebate/history
router.get('/self-rebate/history', auth, validateRequest(historyQuerySchema, 'query'), async (req, res) => {
    try {
        const { page, limit } = req.query;
        const result = await selfRebateService.getSelfRebateHistory(req.user.user_id, page, limit);
        
        if (!result.success) {
            return res.status(400).json(result);
        }
        
        res.json(result);
    } catch (error) {
        console.error('Error getting self rebate history:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving self rebate history'
        });
    }
});

// GET /api/self-rebate/stats
router.get('/self-rebate/stats', auth, validateRequest(historyQuerySchema, 'query'), async (req, res) => {
    try {
        const { days } = req.query;
        const result = await selfRebateService.getSelfRebateStats(req.user.user_id, days);
        
        if (!result.success) {
            return res.status(400).json(result);
        }
        
        res.json(result);
    } catch (error) {
        console.error('Error getting self rebate stats:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving self rebate statistics'
        });
    }
});

// GET /api/activity/status
router.get('/activity/status', auth, async (req, res) => {
    try {
        const result = await activityRewardsService.getTodayActivityStatus(req.user.user_id);
        
        if (!result.success) {
            return res.status(400).json(result);
        }
        
        res.json(result);
    } catch (error) {
        console.error('Error getting activity status:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving activity status'
        });
    }
});

// GET /api/activity/history
router.get('/activity/history', auth, validateRequest(historyQuerySchema, 'query'), async (req, res) => {
    try {
        const { days } = req.query;
        const result = await activityRewardsService.getActivityRewardHistory(req.user.user_id, days);
        
        if (!result.success) {
            return res.status(400).json(result);
        }
        
        res.json(result);
    } catch (error) {
        console.error('Error getting activity history:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving activity history'
        });
    }
});

module.exports = router; 