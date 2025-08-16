const express = require('express');
const router = express.Router();
const vipController = require('../controllers/vipController');
// NOTE: Auth middleware is applied at router level in index.js
const { sequelize } = require('../config/db');
const VipLevel = require('../models/VipLevel');
const User = require('../models/User');
const VipReward = require('../models/VipReward');
const { Op } = require('sequelize');
const rateLimiters = require('../middleware/rateLimiter');

// Helper function to wrap async middleware
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// Information and Status Endpoints - Rate limited for authenticated routes
router.get('/info', rateLimiters.vipSystem, vipController.getVIPInfo);
router.get('/levels', vipController.getVIPLevels); // Public route - no rate limiting
router.get('/status', rateLimiters.vipSystem, vipController.getUserVIPStatus);
router.get('/calculate', rateLimiters.vipSystem, vipController.calculateVIPLevel);

// Reward Claim Endpoints - Rate limited
router.post('/claim-level-reward', rateLimiters.vipSystem, vipController.claimLevelReward);
router.post('/claim-monthly-reward', rateLimiters.vipSystem, vipController.claimMonthlyReward);

// Experience History Endpoint - Rate limited
router.get('/experience-history', rateLimiters.vipSystem, vipController.getVIPExperienceHistory);

module.exports = router; 