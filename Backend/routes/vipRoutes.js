const express = require('express');
const router = express.Router();
const VipLevel = require('../models/VipLevel');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { Op } = require('sequelize');
const { sequelize } = require('../config/db');
const vipController = require('../controllers/vipController');

// Get user's VIP level information
router.get('/info', auth, async (req, res) => {
    try {
        const user = await User.findByPk(req.user.user_id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Get current VIP level
        const currentLevel = await VipLevel.findOne({
            where: {
                required_exp: {
                    [Op.lte]: user.vip_exp
                }
            },
            order: [['level', 'DESC']]
        });

        // Get next VIP level
        const nextLevel = await VipLevel.findOne({
            where: {
                required_exp: {
                    [Op.gt]: user.vip_exp
                }
            },
            order: [['level', 'ASC']]
        });

        // Calculate progress to next level
        let progress = 0;
        if (nextLevel) {
            const currentLevelExp = currentLevel ? currentLevel.required_exp : 0;
            const nextLevelExp = nextLevel.required_exp;
            const expNeeded = nextLevelExp - currentLevelExp;
            const userProgress = user.vip_exp - currentLevelExp;
            progress = (userProgress / expNeeded) * 100;
        }

        const response = {
            current_level: currentLevel ? currentLevel.level : 0,
            current_exp: user.vip_exp,
            next_level: nextLevel ? nextLevel.level : null,
            progress_to_next: progress,
            current_level_details: currentLevel ? {
                bonus_amount: currentLevel.bonus_amount,
                monthly_reward: currentLevel.monthly_reward,
                rebate_rate: currentLevel.rebate_rate
            } : null,
            next_level_details: nextLevel ? {
                required_exp: nextLevel.required_exp,
                bonus_amount: nextLevel.bonus_amount,
                monthly_reward: nextLevel.monthly_reward,
                rebate_rate: nextLevel.rebate_rate
            } : null
        };

        res.json(response);
    } catch (error) {
        console.error('Error getting VIP info:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Get VIP levels
router.get('/levels', vipController.getVIPLevels);

// Get user's VIP status
router.get('/status', auth, vipController.getUserVIPStatus);

// Calculate VIP level based on wagering amount
router.get('/calculate', auth, vipController.calculateVIPLevel);

module.exports = router; 