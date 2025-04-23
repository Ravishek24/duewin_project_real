// Backend/services/gameLogicService.js
import { redis } from '../config/redisConfig.js';
import { sequelize } from '../config/db.js';
import User from '../models/User.js';
import BetRecordWingo from '../models/BetRecordWingo.js';
import BetResultWingo from '../models/BetResultWingo.js';
import { v4 as uuidv4 } from 'uuid';
import referralService from './referralService.js';


/**
 * Calculate optimized game result based on 60/40 algorithm
 * @param {string} gameType - Game type (wingo, fiveD, k3)
 * @param {number} duration - Duration in seconds
 * @param {string} periodId - Period identifier
 * @returns {Object} - Optimized result and expected payout
 */
export const calculateOptimizedResult = async (gameType, duration, periodId) => {
  try {
    const durationKey = duration === 30 ? '30s' : 
                        duration === 60 ? '1m' : 
                        duration === 180 ? '3m' : 
                        duration === 300 ? '5m' : '10m';
    
    // Get total bet amount for this period
    const totalBetAmount = parseFloat(
      await redis.get(`${gameType}:${durationKey}:${periodId}:total`) || 0
    );
    
    // If no bets placed, generate random result
    if (totalBetAmount === 0) {
      return {
        result: generateRandomResult(gameType),
        expectedPayout: 0,
        houseEdgePercent: 100
      };
    }
    
    // Target 60% of bets as payout
    const targetPayout = totalBetAmount * 0.6;
    
    // Generate all possible results
    const possibleResults = await generateAllPossibleResults(gameType);
    
    // Calculate payout for each possible result
    const resultPayouts = await Promise.all(possibleResults.map(async (result) => {
      const expectedPayout = await calculateExpectedPayout(gameType, durationKey, periodId, result);
      
      // Calculate how close this result is to the target payout (60%)
      const distanceFromTarget = Math.abs(expectedPayout - targetPayout);
      const houseEdge = totalBetAmount - expectedPayout;
      const houseEdgePercent = (houseEdge / totalBetAmount) * 100;
      
      return {
        result,
        expectedPayout,
        distanceFromTarget,
        houseEdgePercent
      };
    }));
    
    // Sort results by distance from target payout (closest to 60% rule)
    resultPayouts.sort((a, b) => a.distanceFromTarget - b.distanceFromTarget);
    
    // Find the most optimal result (closest to 60% payout)
    const optimalResult = resultPayouts[0];
    
    // Get lowest payouts (best for house)
    const lowestPayouts = [...resultPayouts].sort((a, b) => a.expectedPayout - b.expectedPayout);
    
    // Get highest payout (best for players)
    const highestPayout = [...resultPayouts].sort((a, b) => b.expectedPayout - a.expectedPayout)[0];
    
    return {
      optimalResult,
      lowestPayouts: {
        lowest: lowestPayouts[0],
        secondLowest: lowestPayouts[1],
        thirdLowest: lowestPayouts[2]
      },
      highestPayout,
      totalBetAmount,
      targetPayout
    };
  } catch (error) {
    console.error('Error calculating optimized result:', error);
    return {
      result: generateRandomResult(gameType),
      expectedPayout: 0,
      houseEdgePercent: 100
    };
  }
};

/**
 * Generate random result based on game type
 * @param {string} gameType - Game type (wingo, fiveD, k3)
 * @returns {Object} - Random result object
 */
export const generateRandomResult = (gameType) => {
  switch (gameType) {
    case 'wingo':
      const number = Math.floor(Math.random() * 10); // 0-9
      let color = '';
      let size = number >= 5 ? 'Big' : 'Small';
      
      // Determine color based on number
      if (number === 0) {
        color = 'violet';
      } else if (number === 5) {
        color = 'green_violet';
      } else if ([1, 3, 7, 9].includes(number)) {
        color = 'green';
      } else {
        color = 'red';
      }
      
      return { number, color, size };
      
    case 'fiveD':
      return {
        A: Math.floor(Math.random() * 10),
        B: Math.floor(Math.random() * 10),
        C: Math.floor(Math.random() * 10),
        D: Math.floor(Math.random() * 10),
        E: Math.floor(Math.random() * 10)
      };
      
    case 'k3':
      return {
        dice_1: Math.floor(Math.random() * 6) + 1,
        dice_2: Math.floor(Math.random() * 6) + 1,
        dice_3: Math.floor(Math.random() * 6) + 1
      };
      
    default:
      return { number: Math.floor(Math.random() * 10) };
  }
};

/**
 * Generate all possible results for a game type
 * @param {string} gameType - Game type (wingo, fiveD, k3)
 * @returns {Array} - Array of all possible results
 */
export const generateAllPossibleResults = async (gameType) => {
  switch (gameType) {
    case 'wingo':
      // For Wingo, there are 10 possible results (0-9)
      const results = [];
      for (let i = 0; i < 10; i++) {
        let color = '';
        let size = i >= 5 ? 'Big' : 'Small';
        
        // Determine color based on number
        if (i === 0) {
          color = 'violet';
        } else if (i === 5) {
          color = 'green_violet';
        } else if ([1, 3, 7, 9].includes(i)) {
          color = 'green';
        } else {
          color = 'red';
        }
        
        results.push({ number: i, color, size });
      }
      return results;
    
    case 'fiveD':
      // For 5D, there are too many combinations to generate all
      // Instead, generate a subset of possible results
      const fiveDResults = [];
      for (let i = 0; i < 50; i++) {
        fiveDResults.push({
          A: Math.floor(Math.random() * 10),
          B: Math.floor(Math.random() * 10),
          C: Math.floor(Math.random* 10),
          D: Math.floor(Math.random() * 10),
          E: Math.floor(Math.random() * 10)
        });
      }
      return fiveDResults;
    
    case 'k3':
      // For K3, generate all combinations of dice (216 combinations)
      const k3Results = [];
      for (let d1 = 1; d1 <= 6; d1++) {
        for (let d2 = 1; d2 <= 6; d2++) {
          for (let d3 = 1; d3 <= 6; d3++) {
            k3Results.push({ dice_1: d1, dice_2: d2, dice_3: d3 });
          }
        }
      }
      return k3Results;
    
    default:
      return [generateRandomResult(gameType)];
  }
};

/**
 * Calculate expected payout for a result
 * @param {string} gameType - Game type (wingo, fiveD, k3)
 * @param {string} durationKey - Duration key (30s, 1m, etc.)
 * @param {string} periodId - Period identifier
 * @param {Object} result - Result object
 * @returns {number} - Expected payout
 */
export const calculateExpectedPayout = async (gameType, durationKey, periodId, result) => {
  let totalPayout = 0;
  
  switch (gameType) {
    case 'wingo':
      // Calculate number bets
      const numberBetAmount = parseFloat(
        await redis.get(`wingo:${durationKey}:${periodId}:number:${result.number}`) || 0
      );
      totalPayout += numberBetAmount * 9; // 9x multiplier for number bets
      
      // Calculate color bets
      const colorBetAmount = parseFloat(
        await redis.get(`wingo:${durationKey}:${periodId}:color:${result.color}`) || 0
      );
      
      // Different multipliers based on color
      let colorMultiplier = 2; // Default for red/green
      if (result.color === 'violet') {
        colorMultiplier = 4.5;
      } else if (result.color === 'green_violet' || result.color === 'red_violet') {
        colorMultiplier = 2; // Simplified for the example
      }
      
      totalPayout += colorBetAmount * colorMultiplier;
      
      // Calculate size bets
      const sizeBetAmount = parseFloat(
        await redis.get(`wingo:${durationKey}:${periodId}:size:${result.size.toLowerCase()}`) || 0
      );
      totalPayout += sizeBetAmount * 2; // 2x for big/small
      
      // Calculate odd/even bets
      const parity = result.number % 2 === 0 ? 'even' : 'odd';
      const parityBetAmount = parseFloat(
        await redis.get(`wingo:${durationKey}:${periodId}:parity:${parity}`) || 0
      );
      totalPayout += parityBetAmount * 2; // 2x for odd/even
      
      break;
      
    case 'fiveD':
      // Implement 5D calculation logic
      // Similar to Wingo but with five positions (A-E)
      break;
      
    case 'k3':
      // Implement K3 calculation logic
      // Calculation for dice combinations
      break;
  }
  
  return totalPayout;
};

/**
 * Store bet in Redis for real-time analysis
 * @param {string} gameType - Game type (wingo, fiveD, k3)
 * @param {number} duration - Duration in seconds
 * @param {string} periodId - Period identifier
 * @param {string} betType - Type of bet (number, color, etc.)
 * @param {string} betCategory - Category of bet (A, B, etc. for 5D)
 * @param {string} betValue - Value that was bet on
 * @param {number} betAmount - Effective bet amount
 */
export const storeBetInRedis = async (
  gameType, 
  duration, 
  periodId, 
  betType, 
  betCategory, 
  betValue, 
  betAmount
) => {
  try {
    const durationKey = duration === 30 ? '30s' : 
                        duration === 60 ? '1m' : 
                        duration === 180 ? '3m' : 
                        duration === 300 ? '5m' : '10m';
    
    // Build Redis key based on game type and bet details
    let redisKey;
    
    switch (gameType) {
      case 'wingo':
        redisKey = `wingo:${durationKey}:${periodId}:${betType.toLowerCase()}:${betValue.toLowerCase()}`;
        break;
      
      case 'fiveD':
        if (['A', 'B', 'C', 'D', 'E'].includes(betCategory)) {
          redisKey = `fiveD:${durationKey}:${periodId}:${betCategory}:${betType.toLowerCase()}:${betValue.toLowerCase()}`;
        } else { // Sum bet
          redisKey = `fiveD:${durationKey}:${periodId}:sum:${betType.toLowerCase()}:${betValue.toLowerCase()}`;
        }
        break;
      
      case 'k3':
        if (betType === 'SUM') {
          redisKey = `k3:${durationKey}:${periodId}:sum:${betValue}`;
        } else if (betType === 'SUM_CATEGORY') {
          redisKey = `k3:${durationKey}:${periodId}:sum_category:${betValue.toLowerCase()}`;
        } else if (betType === 'MATCHING_DICE') {
          redisKey = `k3:${durationKey}:${periodId}:matching_dice:${betCategory.toLowerCase()}:${betValue.toLowerCase()}`;
        } else if (betType === 'NUMBER_PATTERN') {
          redisKey = `k3:${durationKey}:${periodId}:number_pattern:${betValue.toLowerCase()}`;
        }
        break;
    }
    
    // Update bet amount in Redis (increment)
    await redis.incrByFloat(redisKey, betAmount);
    
    // Update total bet amount for this period
    const totalKey = `${gameType}:${durationKey}:${periodId}:total`;
    await redis.incrByFloat(totalKey, betAmount);
    
    // Set expiry for these keys (e.g., 24 hours)
    const EXPIRY_SECONDS = 24 * 60 * 60;
    await redis.expire(redisKey, EXPIRY_SECONDS);
    await redis.expire(totalKey, EXPIRY_SECONDS);
    
    return true;
  } catch (error) {
    console.error('Error storing bet in Redis:', error);
    return false;
  }
};

/**
 * Process a bet on a game
 * @param {Object} betData - Bet data
 * @returns {Object} - Processing result
 */
export const processBet = async (betData) => {
  const {
    userId,
    gameType,
    duration,
    periodId,
    betType,
    betCategory,
    betValue,
    betAmount
  } = betData;
  
  const t = await sequelize.transaction();
  
  try {
    // Check if period is still open for betting
    const periodStatus = await getPeriodStatus(gameType, duration, periodId);
    if (!periodStatus.active || periodStatus.timeRemaining < 5) { // 5 seconds safety margin
      await t.rollback();
      return {
        success: false,
        message: 'Betting for this period is closed'
      };
    }
    
    // Get user with locking to prevent race conditions
    const user = await User.findByPk(userId, {
      lock: true,
      transaction: t
    });
    
    if (!user) {
      await t.rollback();
      return {
        success: false,
        message: 'User not found'
      };
    }
    
    // Check if user has sufficient balance
    if (parseFloat(user.wallet_balance) < parseFloat(betAmount)) {
      await t.rollback();
      return {
        success: false,
        message: 'Insufficient wallet balance'
      };
    }
    
    // Apply platform fee (2% of bet amount)
    const fee = parseFloat(betAmount) * 0.02;
    const effectiveBetAmount = parseFloat(betAmount) - fee;
    
    // Update user's wallet balance
    const newBalance = parseFloat(user.wallet_balance) - parseFloat(betAmount);
    await User.update(
      { wallet_balance: newBalance },
      { 
        where: { user_id: userId },
        transaction: t 
      }
    );

    await referralService.recordBetExperience(userId, effectiveBetAmount);
    
    // Store bet in Redis for real-time analysis
    await storeBetInRedis(
      gameType,
      duration,
      periodId,
      betType,
      betCategory,
      betValue,
      effectiveBetAmount // Store the effective amount after fee
    );
    
    // Create bet record in database
    let betRecord;
    
    switch (gameType) {
      case 'wingo':
        betRecord = await BetRecordWingo.create({
          user_id: userId,
          bet_number: betType === 'NUMBER' ? betValue : null,
          bet_color: betType === 'COLOR' ? betValue : null,
          bet_size: betType === 'SIZE' ? betValue : null,
          time: new Date(),
          duration
        }, { transaction: t });
        break;
      
      case 'fiveD':
        // Create 5D bet record
        break;
      
      case 'k3':
        // Create K3 bet record
        break;
    }
    
    await t.commit();
    
    return {
      success: true,
      message: 'Bet placed successfully',
      betId: betRecord.bet_id,
      newBalance
    };
  } catch (error) {
    await t.rollback();
    console.error('Error processing bet:', error);
    
    return {
      success: false,
      message: 'Server error processing bet'
    };
  }
};

/**
 * Get active game periods
 * @param {string} gameType - Game type (wingo, fiveD, k3)
 * @returns {Array} - Array of active periods
 */
export const getActivePeriods = async (gameType) => {
  try {
    const activePeriods = [];
    
    // Get current time
    const now = new Date();
    
    // Generate periods based on game type
    switch (gameType) {
      case 'wingo':
        // 30s periods
        addPeriods(activePeriods, gameType, 30, now);
        // 1m periods
        addPeriods(activePeriods, gameType, 60, now);
        // 3m periods
        addPeriods(activePeriods, gameType, 180, now);
        // 5m periods
        addPeriods(activePeriods, gameType, 300, now);
        break;
        
      case 'fiveD':
        // 1m periods
        addPeriods(activePeriods, gameType, 60, now);
        // 3m periods
        addPeriods(activePeriods, gameType, 180, now);
        // 5m periods
        addPeriods(activePeriods, gameType, 300, now);
        // 10m periods
        addPeriods(activePeriods, gameType, 600, now);
        break;
        
      case 'k3':
        // 1m periods
        addPeriods(activePeriods, gameType, 60, now);
        // 3m periods
        addPeriods(activePeriods, gameType, 180, now);
        // 5m periods
        addPeriods(activePeriods, gameType, 300, now);
        // 10m periods
        addPeriods(activePeriods, gameType, 600, now);
        break;
    }
    
    return activePeriods;
  } catch (error) {
    console.error('Error getting active periods:', error);
    return [];
  }
};

/**
 * Helper function to add periods to the active periods array
 * @param {Array} activePeriods - Array to add periods to
 * @param {string} gameType - Game type
 * @param {number} duration - Period duration in seconds
 * @param {Date} now - Current date/time
 */
const addPeriods = (activePeriods, gameType, duration, now) => {
  // Generate current period
  const currentPeriod = generatePeriodId(gameType, duration, now);
  const currentEnd = calculatePeriodEndTime(currentPeriod, duration);
  
  // Add current period
  activePeriods.push({
    periodId: currentPeriod,
    gameType,
    duration,
    endTime: currentEnd,
    timeRemaining: Math.max(0, (currentEnd - now) / 1000)
  });
  
  // Generate next period
  const nextPeriod = generateNextPeriodId(currentPeriod);
  const nextEnd = new Date(currentEnd.getTime() + duration * 1000);
  
  // Add next period
  activePeriods.push({
    periodId: nextPeriod,
    gameType,
    duration,
    endTime: nextEnd,
    timeRemaining: (nextEnd - now) / 1000
  });
};

/**
 * Generate period ID based on game type, duration, and current time
 * @param {string} gameType - Game type
 * @param {number} duration - Period duration in seconds
 * @param {Date} now - Current date/time
 * @returns {string} - Period ID
 */
export const generatePeriodId = (gameType, duration, now = new Date()) => {
  const date = now.toISOString().split('T')[0].replace(/-/g, '');
  
  // Calculate period number based on duration
  const secondsInDay = 24 * 60 * 60;
  const secondsSinceMidnight = 
    now.getUTCHours() * 3600 + 
    now.getUTCMinutes() * 60 + 
    now.getUTCSeconds();
  
  const periodNumber = Math.floor(secondsSinceMidnight / duration) + 1;
  
  // Format period number with leading zeros
  const periodStr = periodNumber.toString().padStart(5, '0');
  
  return `${gameType}${date}${periodStr}`;
};

/**
 * Generate next period ID
 * @param {string} currentPeriodId - Current period ID
 * @returns {string} - Next period ID
 */
export const generateNextPeriodId = (currentPeriodId) => {
  // Extract the numerical part of the period ID
  const prefix = currentPeriodId.replace(/\d+$/, '');
  const periodNumber = parseInt(currentPeriodId.match(/\d+$/)[0], 10);
  
  // Increment period number
  const nextPeriodNumber = periodNumber + 1;
  
  // Format with leading zeros
  const periodStr = nextPeriodNumber.toString().padStart(5, '0');
  
  return `${prefix}${periodStr}`;
};

/**
 * Calculate end time for a period
 * @param {string} periodId - Period ID
 * @param {number} duration - Duration in seconds
 * @returns {Date} - End time
 */
export const calculatePeriodEndTime = (periodId, duration) => {
  // Extract date from period ID
  const dateStr = periodId.match(/\d{8}/)[0];
  const year = parseInt(dateStr.substring(0, 4), 10);
  const month = parseInt(dateStr.substring(4, 6), 10) - 1; // Months are 0-indexed
  const day = parseInt(dateStr.substring(6, 8), 10);
  
  // Extract period number
  const periodNumber = parseInt(periodId.match(/\d+$/)[0], 10);
  
  // Calculate seconds from midnight
  const secondsFromMidnight = (periodNumber - 1) * duration;
  
  // Create date object for midnight
  const midnight = new Date(Date.UTC(year, month, day));
  
  // Add seconds to midnight
  return new Date(midnight.getTime() + secondsFromMidnight * 1000 + duration * 1000);
};

/**
 * Get status of a period
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 * @param {string} periodId - Period ID
 * @returns {Object} - Period status
 */
export const getPeriodStatus = async (gameType, duration, periodId) => {
  try {
    // Calculate end time
    const endTime = calculatePeriodEndTime(periodId, duration);
    
    // Check if period is still active
    const now = new Date();
    const timeRemaining = Math.max(0, (endTime - now) / 1000);
    const active = timeRemaining > 0;
    
    // Check if result is available
    const durationKey = duration === 30 ? '30s' : 
                        duration === 60 ? '1m' : 
                        duration === 180 ? '3m' : 
                        duration === 300 ? '5m' : '10m';
    
    const resultKey = `${gameType}:${durationKey}:${periodId}:result`;
    const resultStr = await redis.get(resultKey);
    const result = resultStr ? JSON.parse(resultStr) : null;
    
    return {
      periodId,
      gameType,
      duration,
      endTime,
      timeRemaining,
      active,
      hasResult: !!result,
      result
    };
  } catch (error) {
    console.error('Error getting period status:', error);
    return {
      active: false,
      hasResult: false
    };
  }
};

/**
 * Store temporary result in Redis
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 * @param {string} periodId - Period ID
 * @param {Object} result - Result object
 */
export const storeTemporaryResult = async (gameType, duration, periodId, result) => {
  const durationKey = duration === 30 ? '30s' : 
                      duration === 60 ? '1m' : 
                      duration === 180 ? '3m' : 
                      duration === 300 ? '5m' : '10m';
  
  const redisKey = `${gameType}:${durationKey}:${periodId}:result`;
  
  await redis.set(redisKey, JSON.stringify(result));
  
  // Set expiry for result keys (24 hours)
  const EXPIRY_SECONDS = 24 * 60 * 60;
  await redis.expire(redisKey, EXPIRY_SECONDS);
};

/**
 * Process game results and update user bets
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 * @param {string} periodId - Period ID
 */
export const processGameResults = async (gameType, duration, periodId) => {
  const t = await sequelize.transaction();
  
  try {
    // Generate 60/40 optimized result
    const analysis = await calculateOptimizedResult(gameType, duration, periodId);
    const result = analysis.optimalResult.result;
    
    // Store result in Redis
    await storeTemporaryResult(gameType, duration, periodId, result);
    
    // Store result in database based on game type
    switch (gameType) {
      case 'wingo':
        await BetResultWingo.create({
          bet_number: periodId,
          result_of_number: result.number,
          result_of_size: result.size,
          result_of_color: result.color,
          time: duration
        }, { transaction: t });
        break;
        
      case 'fiveD':
        // Store 5D result
        break;
        
      case 'k3':
        // Store K3 result
        break;
    }
    
    // Process user bets for the period
    await processUserBets(gameType, duration, periodId, result, t);
    
    await t.commit();
    
    return {
      success: true,
      result,
      expectedPayout: analysis.optimalResult.expectedPayout,
      houseEdgePercent: analysis.optimalResult.houseEdgePercent
    };
  } catch (error) {
    await t.rollback();
    console.error('Error processing game results:', error);
    
    return {
      success: false,
      message: 'Server error processing game results'
    };
  }
};

/**
 * Process user bets for a period
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 * @param {string} periodId - Period ID
 * @param {Object} result - Result object
 * @param {Object} transaction - Database transaction
 */
export const processUserBets = async (gameType, duration, periodId, result, transaction) => {
  try {
    // Get all bets for this period
    let userBets;
    
    switch (gameType) {
      case 'wingo':
        userBets = await BetRecordWingo.findAll({
          where: {
            duration: duration,
            // Additional filters to match the period
          },
          transaction
        });
        break;
        
      case 'fiveD':
        // Get 5D bets
        break;
        
      case 'k3':
        // Get K3 bets
        break;
    }
    
    // Process each bet
    for (const bet of userBets) {
      let win = false;
      let winAmount = 0;
      
      // Determine if the bet is a winner based on game type
      switch (gameType) {
        case 'wingo':
          if (bet.bet_number !== null && parseInt(bet.bet_number) === result.number) {
            win = true;
            winAmount = parseFloat(bet.bet_amount) * 9; // 9x for number
          } else if (bet.bet_color !== null && bet.bet_color === result.color) {
            win = true;
            // Different multipliers based on color
            let colorMultiplier = 2; // Default for red/green
            if (result.color === 'violet') {
              colorMultiplier = 4.5;
            } else if (result.color === 'green_violet' || result.color === 'red_violet') {
              colorMultiplier = 2; // Simplified
            }
            winAmount = parseFloat(bet.bet_amount) * colorMultiplier;
          } else if (bet.bet_size !== null && bet.bet_size === result.size) {
            win = true;
            winAmount = parseFloat(bet.bet_amount) * 2; // 2x for big/small
          }
          break;
          
        case 'fiveD':
          // Process 5D bets
          break;
          
        case 'k3':
          // Process K3 bets
          break;
      }
      
      // Update bet record with result
      await bet.update({
        result_number: result.number,
        result_color: result.color,
        result_size: result.size,
        win_loss: win
      }, { transaction });
      
      // If bet won, update user wallet
      if (win) {
        const user = await User.findByPk(bet.user_id, {
          lock: true,
          transaction
        });
        
        if (user) {
          const newBalance = parseFloat(user.wallet_balance) + winAmount;
          await User.update(
            { wallet_balance: newBalance },
            { 
              where: { user_id: user.user_id },
              transaction
            }
          );
        }
      }
    }
  } catch (error) {
    console.error('Error processing user bets:', error);
    throw error;
  }
};

/**
 * Get bet distribution for admin analysis
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 * @param {string} periodId - Period ID
 * @returns {Object} - Bet distribution data
 */
export const getBetDistribution = async (gameType, duration, periodId) => {
  try {
    const durationKey = duration === 30 ? '30s' : 
                        duration === 60 ? '1m' : 
                        duration === 180 ? '3m' : 
                        duration === 300 ? '5m' : '10m';
    
    // Get total bet amount
    const totalAmount = parseFloat(
      await redis.get(`${gameType}:${durationKey}:${periodId}:total`) || 0
    );
    
    // If no bets placed yet
    if (totalAmount === 0) {
      return {
        totalAmount: 0,
        totalBets: 0,
        uniqueBettors: 0,
        distribution: {}
      };
    }
    
    let distribution = {};
    
    switch (gameType) {
      case 'wingo':
        // Get number bets
        const numberBets = [];
        for (let i = 0; i < 10; i++) {
          const amount = parseFloat(
            await redis.get(`wingo:${durationKey}:${periodId}:number:${i}`) || 0
          );
          numberBets.push({
            value: i,
            amount,
            percentage: totalAmount > 0 ? (amount / totalAmount) * 100 : 0
          });
        }
        
        // Get color bets
        const colorBets = [];
        for (const color of ['red', 'green', 'violet', 'red_violet', 'green_violet']) {
          const amount = parseFloat(
            await redis.get(`wingo:${durationKey}:${periodId}:color:${color}`) || 0
          );
          colorBets.push({
            value: color,
            amount,
            percentage: totalAmount > 0 ? (amount / totalAmount) * 100 : 0
          });
        }
        
        // Get size bets
        const sizeBets = [];
        for (const size of ['big', 'small']) {
          const amount = parseFloat(
            await redis.get(`wingo:${durationKey}:${periodId}:size:${size}`) || 0
          );
          sizeBets.push({
            value: size,
            amount,
            percentage: totalAmount > 0 ? (amount / totalAmount) * 100 : 0
          });
        }
        
        // Get parity bets
        const parityBets = [];
        for (const parity of ['odd', 'even']) {
          const amount = parseFloat(
            await redis.get(`wingo:${durationKey}:${periodId}:parity:${parity}`) || 0
          );
          parityBets.push({
            value: parity,
            amount,
            percentage: totalAmount > 0 ? (amount / totalAmount) * 100 : 0
          });
        }
        
        distribution = {
          numberBets,
          colorBets,
          sizeBets,
          parityBets
        };
        break;
      
      case 'fiveD':
        // Implement 5D distribution analysis
        break;
      
      case 'k3':
        // Implement K3 distribution analysis
        break;
    }
    
    // Prepare chart data for visualization
    const chartData = [];
    
    if (gameType === 'wingo') {
      // Extract data for pie chart
      for (const bet of distribution.numberBets) {
        if (bet.amount > 0) {
          chartData.push({
            name: `Number ${bet.value}`,
            value: bet.amount,
            category: 'Numbers'
          });
        }
      }
      
      for (const bet of distribution.colorBets) {
        if (bet.amount > 0) {
          chartData.push({
            name: `Color ${bet.value}`,
            value: bet.amount,
            category: 'Colors'
          });
        }
      }
      
      for (const bet of distribution.sizeBets) {
        if (bet.amount > 0) {
          chartData.push({
            name: `Size ${bet.value}`,
            value: bet.amount,
            category: 'Sizes'
          });
        }
      }
      
      for (const bet of distribution.parityBets) {
        if (bet.amount > 0) {
          chartData.push({
            name: `Parity ${bet.value}`,
            value: bet.amount,
            category: 'Parities'
          });
        }
      }
    }
    
    // Get total bet count and unique bettors
    // This would require additional storage or queries to track individual bets
    const totalBets = chartData.reduce((sum, item) => sum + item.value, 0);
    const uniqueBettors = 0; // Would require actual tracking in a real implementation
    
    return {
      totalAmount,
      totalBets,
      uniqueBettors,
      distribution,
      chartData
    };
  } catch (error) {
    console.error('Error getting bet distribution:', error);
    return {
      success: false,
      message: 'Server error fetching bet distribution'
    };
  }
};

/**
 * Override a game result (admin only)
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 * @param {string} periodId - Period ID
 * @param {Object} result - Result object to override with
 * @param {number} adminId - Admin user ID
 * @returns {Object} - Override result
 */
export const overrideResult = async (gameType, duration, periodId, result, adminId) => {
  try {
    // Validate that the period has not ended yet
    const periodStatus = await getPeriodStatus(gameType, duration, periodId);
    if (!periodStatus.active) {
      return {
        success: false,
        message: 'Cannot override result for a period that has already ended'
      };
    }
    
    // Store the override result
    const durationKey = duration === 30 ? '30s' : 
                        duration === 60 ? '1m' : 
                        duration === 180 ? '3m' : 
                        duration === 300 ? '5m' : '10m';
    
    const overrideKey = `${gameType}:${durationKey}:${periodId}:result:override`;
    await redis.set(overrideKey, JSON.stringify({
      ...result,
      overrideBy: adminId,
      overrideTime: new Date().toISOString()
    }));
    
    // Set expiry for override key (24 hours)
    const EXPIRY_SECONDS = 24 * 60 * 60;
    await redis.expire(overrideKey, EXPIRY_SECONDS);
    
    return {
      success: true,
      message: 'Result override set successfully',
      result
    };
  } catch (error) {
    console.error('Error overriding result:', error);
    return {
      success: false,
      message: 'Server error overriding result'
    };
  }
};

/**
 * Get game history
 * @param {string} gameType - Game type
 * @param {number} page - Page number
 * @param {number} limit - Results per page
 * @returns {Object} - Game history data
 */
export const getGameHistory = async (gameType, page = 1, limit = 20) => {
  try {
    const offset = (page - 1) * limit;
    let results;
    
    switch (gameType) {
      case 'wingo':
        results = await BetResultWingo.findAndCountAll({
          order: [['bet_id', 'DESC']],
          limit,
          offset
        });
        break;
        
      case 'fiveD':
        // Get 5D results
        break;
        
      case 'k3':
        // Get K3 results
        break;
    }
    
    return {
      results: results.rows,
      pagination: {
        total: results.count,
        page,
        limit,
        pages: Math.ceil(results.count / limit)
      }
    };
  } catch (error) {
    console.error('Error fetching game history:', error);
    return {
      success: false,
      message: 'Server error fetching game history'
    };
  }
};

export default {
  calculateOptimizedResult,
  generateRandomResult,
  processBet,
  getActivePeriods,
  getPeriodStatus,
  processGameResults,
  getBetDistribution,
  overrideResult,
  getGameHistory,
  generatePeriodId,
  calculatePeriodEndTime
};