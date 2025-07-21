// services/gameService.js
const axios = require('axios');
const { Game, GameHistory, GameStats } = require('../models');
const { createTransaction } = require('./transactionService');
const { updateWalletBalance } = require('./walletServices');

const API_URL = 'https://api.provider.com'; // Replace with the actual API URL
const API_LOGIN = 'xapitest'; // Replace with your API login
const API_PASSWORD = 'xapitest'; // Replace with your API password

const getGameList = async (currency = 'INR', showSystems = 0, showAdditional = false) => {
  try {
    const response = await axios.post(API_URL, {
      api_login: API_LOGIN,
      api_password: API_PASSWORD,
      method: 'getGameList',
      show_systems: showSystems,
      show_additional: showAdditional,
      currency: currency,
    });

    if (response.data.error === 0) {
      return response.data.response;
    } else {
      throw new Error('Error fetching game list');
    }
  } catch (error) {
    console.error('getGameList Error:', error.message);
    throw error;
  }
};

const getGameDetails = async (gameId) => {
  // Implementation of getGameDetails
};

const getGameBalance = async (gameId) => {
  // Implementation of getGameBalance
};

/**
 * Place a bet in a crash game
 * @param {number} userId - User ID
 * @param {number} amount - Bet amount
 * @param {string} betType - Type of bet (cashout or auto-cashout)
 * @param {number} target - Target multiplier for auto-cashout
 */
const placeCrashBet = async (userId, amount, betType, target) => {
  try {
    // Validate user has sufficient balance
    const user = await User.findByPk(userId);
    if (!user || user.wallet_balance < amount) {
      return {
        success: false,
        message: 'Insufficient balance'
      };
    }

    // Create game record
    const game = await Game.create({
      user_id: userId,
      game_type: 'crash',
      bet_amount: amount,
      bet_type: betType,
      target_multiplier: target,
      status: 'pending'
    });

    // Deduct amount from wallet
    await updateWalletBalance(userId, -amount, 'game_bet');

    // Create transaction record
    await createTransaction({
      user_id: userId,
      type: 'game_bet',
      amount: amount,
      status: 'completed',
      reference_id: game.id,
      description: `Bet placed in crash game`
    });

    return {
      success: true,
      game_id: game.id,
      message: 'Bet placed successfully'
    };
  } catch (error) {
    console.error('Error placing crash bet:', error);
    return {
      success: false,
      message: 'Failed to place bet'
    };
  }
};

/**
 * Place a bet in a dice game
 * @param {number} userId - User ID
 * @param {number} amount - Bet amount
 * @param {string} betType - Type of bet (over/under)
 * @param {number} target - Target number for the bet
 */
const placeDiceBet = async (userId, amount, betType, target) => {
  try {
    // Validate user has sufficient balance
    const user = await User.findByPk(userId);
    if (!user || user.wallet_balance < amount) {
      return {
        success: false,
        message: 'Insufficient balance'
      };
    }

    // Create game record
    const game = await Game.create({
      user_id: userId,
      game_type: 'dice',
      bet_amount: amount,
      bet_type: betType,
      target_number: target,
      status: 'pending'
    });

    // Deduct amount from wallet
    await updateWalletBalance(userId, -amount, 'game_bet');

    // Create transaction record
    await createTransaction({
      user_id: userId,
      type: 'game_bet',
      amount: amount,
      status: 'completed',
      reference_id: game.id,
      description: `Bet placed in dice game`
    });

    return {
      success: true,
      game_id: game.id,
      message: 'Bet placed successfully'
    };
  } catch (error) {
    console.error('Error placing dice bet:', error);
    return {
      success: false,
      message: 'Failed to place bet'
    };
  }
};

/**
 * Get game history for a user
 * @param {number} userId - User ID
 * @param {string} gameType - Type of game
 * @param {number} page - Page number
 * @param {number} limit - Number of records per page
 */
const getGameHistory = async (userId, gameType, page = 1, limit = 10) => {
  try {
    const offset = (page - 1) * limit;
    
    const { count, rows } = await GameHistory.findAndCountAll({
      where: {
        user_id: userId,
        game_type: gameType
      },
      order: [['created_at', 'DESC']],
      limit,
      offset
    });

    return {
      success: true,
      data: rows,
      pagination: {
        total: count,
        page,
        limit,
        pages: Math.ceil(count / limit)
      }
    };
  } catch (error) {
    console.error('Error getting game history:', error);
    return {
      success: false,
      message: 'Failed to get game history'
    };
  }
};

/**
 * Get game statistics for a user
 * @param {number} userId - User ID
 * @param {string} gameType - Type of game
 * @param {string} period - Time period (day/week/month)
 */
const getGameStats = async (userId, gameType, period) => {
  try {
    const stats = await GameStats.findOne({
      where: {
        user_id: userId,
        game_type: gameType,
        period
      }
    });

    if (!stats) {
      return {
        success: true,
        data: {
          total_bets: 0,
          total_won: 0,
          total_lost: 0,
          win_rate: 0,
          average_bet: 0
        }
      };
    }

    return {
      success: true,
      data: stats
    };
  } catch (error) {
    console.error('Error getting game stats:', error);
    return {
      success: false,
      message: 'Failed to get game stats'
    };
  }
};

module.exports = {
  getGameList,
  getGameDetails,
  getGameBalance,
  placeCrashBet,
  placeDiceBet,
  getGameHistory,
  getGameStats
};
