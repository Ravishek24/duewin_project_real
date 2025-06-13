const express = require('express');
const router = express.Router();
const vipController = require('../controllers/vipController');
const { auth } = require('../middlewares/authMiddleware');
const { sequelize } = require('../config/db');
const VipLevel = require('../models/VipLevel');
const User = require('../models/User');
const VipReward = require('../models/VipReward');
const { Op } = require('sequelize');

// Helper function to wrap async middleware
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// Information and Status Endpoints
router.get('/info', auth, vipController.getVIPInfo);
router.get('/levels', vipController.getVIPLevels);
router.get('/status', auth, vipController.getUserVIPStatus);
router.get('/calculate', auth, vipController.calculateVIPLevel);

// Reward Claim Endpoints
router.post('/claim-level-reward', auth, vipController.claimLevelReward);
router.post('/claim-monthly-reward', auth, vipController.claimMonthlyReward);

// Experience History Endpoint
router.get('/experience-history', auth, vipController.getVIPExperienceHistory);

module.exports = router; 