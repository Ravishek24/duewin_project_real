const express = require('express');
const router = express.Router();
const Joi = require('joi');
// NOTE: Auth middleware is applied at router level in index.js
const { validateRequest } = require('../middleware/validation');
const selfRebateService = require('../services/selfRebateService');
const activityRewardsService = require('../services/activityRewardsService');
const rateLimiters = require('../middleware/rateLimiter');

// Validation schemas
const historyQuerySchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    days: Joi.number().integer().min(1).max(90).default(30)
});

// GET /api/self-rebate/history - Rate limited
router.get('/self-rebate/history', rateLimiters.activityRewards, validateRequest(historyQuerySchema, 'query'), async (req, res) => {
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
router.get('/self-rebate/stats', validateRequest(historyQuerySchema, 'query'), async (req, res) => {
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
router.get('/status', async (req, res) => {
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
router.get('/history', validateRequest(historyQuerySchema, 'query'), async (req, res) => {
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

// POST /api/activity/claim
router.post('/claim', async (req, res) => {
    try {
        const { milestoneType, milestoneKey } = req.body;
        
        if (!milestoneType || !milestoneKey) {
            return res.status(400).json({
                success: false,
                message: 'Missing required parameters: milestoneType and milestoneKey'
            });
        }

        const result = await activityRewardsService.claimMilestoneReward(
            req.user.user_id,
            milestoneType,
            milestoneKey
        );
        
        if (!result.success) {
            return res.status(400).json(result);
        }
        
        res.json(result);
    } catch (error) {
        console.error('Error claiming activity reward:', error);
        res.status(500).json({
            success: false,
            message: 'Error claiming activity reward'
        });
    }
});

module.exports = router; 