const express = require('express');
const router = express.Router();
const { User, UserRebateLevel, RebateLevel, sequelize } = require('../models');
const { auth } = require('../middlewares/authMiddleware');
const rateLimiters = require('../middleware/rateLimiter');

// Get user's rebate level - Rate limited
router.get('/user-level', auth, rateLimiters.rebateSystem, async (req, res) => {
    try {
        const userRebateLevel = await UserRebateLevel.findOne({
            where: { user_id: req.user.id },
            include: [{
                model: RebateLevel,
                as: 'rebateLevel'
            }]
        });

        if (!userRebateLevel) {
            return res.status(404).json({ message: 'Rebate level not found' });
        }

        res.json(userRebateLevel);
    } catch (error) {
        console.error('Error fetching user rebate level:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Get all rebate levels
router.get('/levels', auth, async (req, res) => {
    try {
        const rebateLevels = await RebateLevel.findAll({
            order: [['level', 'ASC']]
        });
        res.json(rebateLevels);
    } catch (error) {
        console.error('Error fetching rebate levels:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Update user's rebate level (admin only)
router.put('/user-level/:userId', auth, async (req, res) => {
    try {
        // Check if user is admin
        if (!req.user.is_admin) {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        const { level } = req.body;
        const { userId } = req.params;

        // Verify rebate level exists
        const rebateLevel = await RebateLevel.findOne({
            where: { level }
        });

        if (!rebateLevel) {
            return res.status(400).json({ message: 'Invalid rebate level' });
        }

        // Update or create user rebate level
        const [userRebateLevel, created] = await UserRebateLevel.findOrCreate({
            where: { user_id: userId },
            defaults: { rebate_level: level }
        });

        if (!created) {
            userRebateLevel.rebate_level = level;
            await userRebateLevel.save();
        }

        res.json(userRebateLevel);
    } catch (error) {
        console.error('Error updating user rebate level:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Get rebate statistics
router.get('/statistics', auth, async (req, res) => {
    try {
        // Check if user is admin
        if (!req.user.is_admin) {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        const statistics = await UserRebateLevel.findAll({
            include: [{
                model: RebateLevel,
                as: 'rebateLevel'
            }],
            group: ['rebate_level'],
            attributes: [
                'rebate_level',
                [sequelize.fn('COUNT', sequelize.col('user_id')), 'user_count']
            ]
        });

        res.json(statistics);
    } catch (error) {
        console.error('Error fetching rebate statistics:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = router; 