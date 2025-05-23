// controllers/vipController.js
const VipLevel = require('../models/VipLevel');
const User = require('../models/User');
const { Op } = require('sequelize');

/**
 * Get all VIP levels
 * @param {Object} req - Request object
 * @param {Object} res - Response object
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
 * @param {Object} req - Request object
 * @param {Object} res - Response object
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
 * @param {Object} req - Request object
 * @param {Object} res - Response object
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

module.exports = {
  getVIPLevels,
  getUserVIPStatus,
  calculateVIPLevel
}; 