// controllers/vipController.js
const VipLevel = require('../models/VipLevel');
const User = require('../models/User');
const VipReward = require('../models/VipReward');
const { Op } = require('sequelize');
const { sequelize } = require('../config/db');
const VipExperienceHistory = require('../models/VipExperienceHistory');

/**
 * Get user's VIP level information
 */
const getVIPInfo = async (req, res) => {
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
};

/**
 * Get all VIP levels
 */
const getVIPLevels = async (req, res) => {
    try {
        const vipLevels = await VipLevel.findAll({
            order: [['level', 'ASC']]
        });
        
        res.status(200).json({
            success: true,
            levels: vipLevels
        });
    } catch (error) {
        console.error('Error fetching VIP levels:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch VIP levels'
        });
    }
};

/**
 * Get user's VIP status
 */
const getUserVIPStatus = async (req, res) => {
    try {
        const userId = req.user.user_id;
        
        // Get user with VIP info
        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
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
            progress = Math.min(100, Math.max(0, (userProgress / expNeeded) * 100));
        }
        
        res.status(200).json({
            success: true,
            vipStatus: {
                currentLevel: currentLevel ? currentLevel.level : 0,
                currentExp: user.vip_exp,
                nextLevel: nextLevel ? nextLevel.level : null,
                progressToNext: progress.toFixed(2),
                currentLevelDetails: currentLevel ? {
                    level: currentLevel.level,
                    bonus_amount: currentLevel.bonus_amount,
                    monthly_reward: currentLevel.monthly_reward,
                    rebate_rate: currentLevel.rebate_rate
                } : null,
                nextLevelDetails: nextLevel ? {
                    level: nextLevel.level,
                    required_exp: nextLevel.required_exp,
                    bonus_amount: nextLevel.bonus_amount,
                    monthly_reward: nextLevel.monthly_reward,
                    rebate_rate: nextLevel.rebate_rate
                } : null
            }
        });
    } catch (error) {
        console.error('Error fetching user VIP status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch VIP status'
        });
    }
};

/**
 * Calculate VIP level based on wagering amount
 */
const calculateVIPLevel = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { wageringAmount } = req.query;
        
        if (!wageringAmount || isNaN(parseFloat(wageringAmount))) {
            return res.status(400).json({
                success: false,
                message: 'Valid wagering amount is required'
            });
        }
        
        // Get user
        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        // Calculate exp to add (1 exp per rupee bet)
        const vipExpFromWagering = Math.floor(parseFloat(wageringAmount));
        
        // Get VIP level based on calculated exp
        const vipLevel = await VipLevel.findOne({
            where: {
                required_exp: {
                    [Op.lte]: vipExpFromWagering
                }
            },
            order: [['level', 'DESC']]
        });
        
        res.status(200).json({
            success: true,
            calculation: {
                wageringAmount: parseFloat(wageringAmount),
                estimatedVipExp: vipExpFromWagering,
                estimatedVipLevel: vipLevel ? vipLevel.level : 0,
                vipLevelDetails: vipLevel || null
            }
        });
    } catch (error) {
        console.error('Error calculating VIP level:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to calculate VIP level'
        });
    }
};

/**
 * Claim level up reward
 */
const claimLevelReward = async (req, res) => {
    const t = await sequelize.transaction();
    
    try {
        const user = await User.findByPk(req.user.user_id, {
            attributes: ['user_id', 'vip_level', 'wallet_balance'],
            transaction: t
        });

        if (!user) {
            await t.rollback();
            return res.status(404).json({ message: 'User not found' });
        }

        const currentLevel = await VipLevel.findOne({
            where: { level: user.vip_level },
            transaction: t
        });

        if (!currentLevel) {
            await t.rollback();
            return res.status(404).json({ message: 'VIP level not found' });
        }

        // Check if reward already claimed
        const existingReward = await VipReward.findOne({
            where: {
                user_id: user.user_id,
                level: currentLevel.level,
                reward_type: 'level_up'
            },
            transaction: t
        });

        if (existingReward) {
            await t.rollback();
            return res.status(400).json({ message: 'Level up reward already claimed' });
        }

        // Create reward record
        await VipReward.create({
            user_id: user.user_id,
            level: currentLevel.level,
            reward_type: 'level_up',
            amount: currentLevel.bonus_amount,
            claimed_at: new Date()
        }, { transaction: t });

        // Update wallet balance
        await User.update(
            {
                wallet_balance: sequelize.literal(`wallet_balance + ${currentLevel.bonus_amount}`)
            },
            {
                where: { user_id: user.user_id },
                transaction: t
            }
        );

        // Log transaction
        await sequelize.query(
            `INSERT INTO transactions (user_id, amount, type, note, created_at)
             VALUES (:userId, :amount, 'credit', 'VIP level up reward', NOW())`,
            {
                replacements: {
                    userId: user.user_id,
                    amount: currentLevel.bonus_amount
                },
                type: sequelize.QueryTypes.INSERT,
                transaction: t
            }
        );

        await t.commit();
        res.json({ message: 'Level up reward claimed successfully' });
    } catch (error) {
        await t.rollback();
        console.error('Error claiming level up reward:', error);
        res.status(500).json({ message: 'Error claiming level up reward' });
    }
};

/**
 * Claim monthly reward
 */
const claimMonthlyReward = async (req, res) => {
    const t = await sequelize.transaction();
    
    try {
        const user = await User.findByPk(req.user.user_id, {
            attributes: ['user_id', 'vip_level', 'wallet_balance'],
            transaction: t
        });

        if (!user) {
            await t.rollback();
            return res.status(404).json({ message: 'User not found' });
        }

        const currentLevel = await VipLevel.findOne({
            where: { level: user.vip_level },
            transaction: t
        });

        if (!currentLevel) {
            await t.rollback();
            return res.status(404).json({ message: 'VIP level not found' });
        }

        // Check if reward already claimed this month
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const existingReward = await VipReward.findOne({
            where: {
                user_id: user.user_id,
                level: currentLevel.level,
                reward_type: 'monthly',
                claimed_at: { [Op.gte]: startOfMonth }
            },
            transaction: t
        });

        if (existingReward) {
            await t.rollback();
            return res.status(400).json({ message: 'Monthly reward already claimed this month' });
        }

        // Create reward record
        await VipReward.create({
            user_id: user.user_id,
            level: currentLevel.level,
            reward_type: 'monthly',
            amount: currentLevel.monthly_reward,
            claimed_at: new Date()
        }, { transaction: t });

        // Update wallet balance
        await User.update(
            {
                wallet_balance: sequelize.literal(`wallet_balance + ${currentLevel.monthly_reward}`)
            },
            {
                where: { user_id: user.user_id },
                transaction: t
            }
        );

        // Log transaction
        await sequelize.query(
            `INSERT INTO transactions (user_id, amount, type, note, created_at)
             VALUES (:userId, :amount, 'credit', 'Monthly VIP reward', NOW())`,
            {
                replacements: {
                    userId: user.user_id,
                    amount: currentLevel.monthly_reward
                },
                type: sequelize.QueryTypes.INSERT,
                transaction: t
            }
        );

        await t.commit();
        res.json({ message: 'Monthly reward claimed successfully' });
    } catch (error) {
        await t.rollback();
        console.error('Error claiming monthly reward:', error);
        res.status(500).json({ message: 'Error claiming monthly reward' });
    }
};

/**
 * Get user's VIP experience history with pagination
 */
const getVIPExperienceHistory = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 15;
        const offset = (page - 1) * limit;

        // Get total count for pagination
        const totalCount = await sequelize.models.VipExperienceHistory.count({
            where: { user_id: userId }
        });

        // Get experience history with pagination
        const history = await sequelize.models.VipExperienceHistory.findAll({
            where: { user_id: userId },
            order: [['created_at', 'DESC']],
            limit: limit,
            offset: offset,
            attributes: [
                'id',
                'exp_gained',
                'bet_amount',
                'game_type',
                'game_id',
                'exp_before',
                'exp_after',
                'created_at'
            ],
            raw: true
        });

        // Format the response
        const formattedHistory = history.map(record => ({
            id: record.id,
            exp_gained: record.exp_gained,
            bet_amount: parseFloat(record.bet_amount),
            game_type: record.game_type,
            game_id: record.game_id,
            exp_before: record.exp_before,
            exp_after: record.exp_after,
            date: record.created_at
        }));

        res.status(200).json({
            success: true,
            data: {
                history: formattedHistory,
                pagination: {
                    current_page: page,
                    total_pages: Math.ceil(totalCount / limit),
                    total_records: totalCount,
                    records_per_page: limit
                }
            }
        });
    } catch (error) {
        console.error('Error fetching VIP experience history:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch VIP experience history'
        });
    }
};

module.exports = {
    getVIPInfo,
    getVIPLevels,
    getUserVIPStatus,
    calculateVIPLevel,
    claimLevelReward,
    claimMonthlyReward,
    getVIPExperienceHistory
}; 