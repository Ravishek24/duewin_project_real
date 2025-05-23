// Backend/services/gameLogicService.js
const redisClient = require('../config/redisConfig').redis;
const { sequelize } = require('../config/db');
const User = require('../models/User');
const BetRecordWingo = require('../models/BetRecordWingo');
const BetRecord5D = require('../models/BetRecord5D');
const BetRecordK3 = require('../models/BetRecordK3');
const BetResultWingo = require('../models/BetResultWingo');
const BetResult5D = require('../models/BetResult5D');
const BetResultK3 = require('../models/BetResultK3');
const BetRecordTrxWix = require('../models/BetRecordTrxWix');
const BetResultTrxWix = require('../models/BetResultTrxWix');
const { v4: uuidv4 } = require('uuid');
const referralService = require('./referralService');
const winston = require('winston');
const path = require('path');
const tronHashService = require('./tronHashService');
const periodService = require('./periodService');

// Configure Winston logger
const logger = winston.createLogger({
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ 
            filename: path.join('logs', 'game-results.log') 
        }),
        new winston.transports.File({ 
            filename: path.join('logs', 'game-errors.log'),
            level: 'error'
        })
    ]
});

// Updated Risk Thresholds
const RISK_THRESHOLDS = {
    LOW: {
        maxPayoutPercent: 60,
        maxBetAmount: 1000,
        maxConsecutiveWins: 3
    },
    MEDIUM: {
        maxPayoutPercent: 70,
        maxBetAmount: 5000,
        maxConsecutiveWins: 5
    },
    HIGH: {
        maxPayoutPercent: 75,
        maxBetAmount: 10000,
        maxConsecutiveWins: 7
    }
};

/**
 * Validate 60/40 algorithm results for safety
 * @param {Object} result - Result object
 * @param {number} totalBetAmount - Total bet amount
 * @param {number} expectedPayout - Expected payout
 * @returns {Object} - Validation result
 */
const validate60_40Result = async (result, totalBetAmount, expectedPayout) => {
    try {
        // Calculate payout percentage
        const payoutPercentage = (expectedPayout / totalBetAmount) * 100;
        
        // Calculate house edge
        const houseEdge = totalBetAmount - expectedPayout;
        const houseEdgePercent = (houseEdge / totalBetAmount) * 100;
        
        // Safety thresholds
        const MIN_HOUSE_EDGE = 40; // Minimum 40% house edge
        const MAX_PAYOUT_PERCENT = 60; // Maximum 60% payout
        const MIN_BET_AMOUNT = 10; // Minimum bet amount to consider
        
        // Validation checks
        const validations = {
            isSafe: true,
            warnings: [],
            houseEdgePercent,
            payoutPercentage
        };
        
        // Check minimum bet amount
        if (totalBetAmount < MIN_BET_AMOUNT) {
            validations.isSafe = false;
            validations.warnings.push('Total bet amount too low');
        }
        
        // Check house edge
        if (houseEdgePercent < MIN_HOUSE_EDGE) {
            validations.isSafe = false;
            validations.warnings.push(`House edge too low: ${houseEdgePercent}%`);
        }
        
        // Check payout percentage
        if (payoutPercentage > MAX_PAYOUT_PERCENT) {
            validations.isSafe = false;
            validations.warnings.push(`Payout percentage too high: ${payoutPercentage}%`);
        }
        
        // Log validation results
        logger.info('60/40 result validation', {
            result,
            validations,
            totalBetAmount,
            expectedPayout
        });
        
        return validations;
        
    } catch (error) {
        logger.error('Error validating 60/40 result', {
            error: error.message,
            stack: error.stack,
            result,
            totalBetAmount,
            expectedPayout
        });
        
        return {
            isSafe: false,
            warnings: ['Error during validation'],
            houseEdgePercent: 0,
            payoutPercentage: 0
        };
    }
};

/**
 * Determine if current period should use minimum bet result
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 * @param {string} periodId - Period ID
 * @returns {boolean} - Whether to use minimum bet result
 */
const shouldUseMinimumBetResult = async (gameType, duration, periodId) => {
    try {
        // Get current hour's minimum bet periods from Redis
        const now = new Date();
        const hourKey = now.toISOString().slice(0, 13); // YYYY-MM-DDTHH
        const durationKey = duration === 30 ? '30s' : 
                          duration === 60 ? '1m' : 
                          duration === 180 ? '3m' : 
                          duration === 300 ? '5m' : '10m';

        const minBetPeriodsKey = `${gameType}:${durationKey}:${hourKey}:min_bet_periods`;
        let minBetPeriods = await redisClient.get(minBetPeriodsKey);

        if (!minBetPeriods) {
            // Generate 3 random periods for this hour if not exists
            const totalPeriodsInHour = 3600 / duration; // Total periods in an hour
            const periods = new Set();
            
            while (periods.size < 3) {
                const randomPeriod = Math.floor(Math.random() * totalPeriodsInHour);
                periods.add(randomPeriod);
            }
            
            minBetPeriods = JSON.stringify(Array.from(periods));
            await redisClient.set(minBetPeriodsKey, minBetPeriods);
            await redisClient.expire(minBetPeriodsKey, 3600); // Expire after 1 hour
        }

        // Calculate current period number within the hour
        const periodNumber = parseInt(periodId.slice(-9), 10) % (3600 / duration);
        
        // Check if current period is one of the minimum bet periods
        const minBetPeriodsArray = JSON.parse(minBetPeriods);
        return minBetPeriodsArray.includes(periodNumber);

    } catch (error) {
        logger.error('Error determining minimum bet result period', {
            error: error.message,
            stack: error.stack,
            gameType,
            duration,
            periodId
        });
        return false;
    }
};

/**
 * Get minimum bet result for current period
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 * @param {string} periodId - Period ID
 * @returns {Object} - Minimum bet result
 */
const getMinimumBetResult = async (gameType, duration, periodId) => {
    try {
        const durationKey = duration === 30 ? '30s' : 
                          duration === 60 ? '1m' : 
                          duration === 180 ? '3m' : 
                          duration === 300 ? '5m' : '10m';

        // Get all possible results
        const possibleResults = await generateAllPossibleResults(gameType);
        
        // Calculate bet amounts for each result
        const resultWithBets = await Promise.all(possibleResults.map(async (result) => {
            const expectedPayout = await calculateExpectedPayout(gameType, durationKey, periodId, result);
            return {
                result,
                betAmount: expectedPayout
            };
        }));

        // Sort by bet amount (ascending)
        resultWithBets.sort((a, b) => a.betAmount - b.betAmount);

        // Get the result with minimum bet amount
        const minimumBetResult = resultWithBets[0];

        logger.info('Minimum bet result selected', {
            gameType,
            duration,
            periodId,
            result: minimumBetResult.result,
            betAmount: minimumBetResult.betAmount
        });

        return minimumBetResult;

    } catch (error) {
        logger.error('Error getting minimum bet result', {
            error: error.message,
            stack: error.stack,
            gameType,
            duration,
            periodId
        });
        return null;
    }
};

/**
 * Calculate optimized game result based on 60/40 algorithm
 * @param {string} gameType - Game type (wingo, fiveD, k3)
 * @param {number} duration - Duration in seconds
 * @param {string} periodId - Period identifier
 * @returns {Object} - Optimized result and expected payout
 */
const calculateOptimizedResult = async (gameType, duration, periodId) => {
    try {
        logger.info('Starting result calculation', { gameType, duration, periodId });

        // Check if this period should use minimum bet result
        const useMinimumBet = await shouldUseMinimumBetResult(gameType, duration, periodId);
        
        if (useMinimumBet) {
            logger.info('Using minimum bet result for period', { gameType, duration, periodId });
            const minimumBetResult = await getMinimumBetResult(gameType, duration, periodId);
            
            if (minimumBetResult) {
                return {
                    optimalResult: {
                        result: minimumBetResult.result,
                        expectedPayout: minimumBetResult.betAmount,
                        houseEdgePercent: 100,
                        validation: { isSafe: true, warnings: [] }
                    },
                    lowestPayouts: {
                        lowest: minimumBetResult,
                        secondLowest: minimumBetResult,
                        thirdLowest: minimumBetResult
                    },
                    highestPayout: minimumBetResult,
                    totalBetAmount: minimumBetResult.betAmount,
                    targetPayout: minimumBetResult.betAmount
                };
            }
        }

        // Continue with normal 60/40 logic if not using minimum bet result
        const durationKey = duration === 30 ? '30s' : 
                          duration === 60 ? '1m' : 
                          duration === 180 ? '3m' : 
                          duration === 300 ? '5m' : '10m';
        
        // Get total bet amount for this period
        const totalBetAmount = parseFloat(
            await redisClient.get(`trx_wix:${durationKey}:${periodId}:total`) || 0
        );
        
        logger.info('Total bet amount retrieved', { totalBetAmount });
      
        // If no bets placed, use the enhanced fallback
        if (totalBetAmount === 0) {
            logger.info('No bets placed, using fallback result');
            return await generateFallbackResult(gameType);
        }
      
        // Target 60% of bets as payout
        const targetPayout = totalBetAmount * 0.6;
      
        // Generate all possible results
        const possibleResults = await generateAllPossibleResults(gameType);
      
        // Calculate payout for each possible result
        const resultPayouts = await Promise.all(possibleResults.map(async (result) => {
            const expectedPayout = await calculateExpectedPayout(gameType, durationKey, periodId, result);
            
            // Validate the result
            const validation = await validate60_40Result(result, totalBetAmount, expectedPayout);
            
            // Calculate risk level based on payout percentage
            const payoutPercentage = (expectedPayout / totalBetAmount) * 100;
            let riskLevel = 'LOW';
            
            if (payoutPercentage > RISK_THRESHOLDS.HIGH.maxPayoutPercent) {
                riskLevel = 'HIGH';
            } else if (payoutPercentage > RISK_THRESHOLDS.MEDIUM.maxPayoutPercent) {
                riskLevel = 'MEDIUM';
            }
        
            // Calculate how close this result is to the target payout (60%)
            const distanceFromTarget = Math.abs(expectedPayout - targetPayout);
            const houseEdge = totalBetAmount - expectedPayout;
            const houseEdgePercent = (houseEdge / totalBetAmount) * 100;
            
            logger.info('Result analysis', {
                result,
                expectedPayout,
                payoutPercentage,
                riskLevel,
                houseEdgePercent,
                validation
            });
        
            return {
                result,
                expectedPayout,
                distanceFromTarget,
                houseEdgePercent,
                riskLevel,
                validation
            };
        }));
      
        // Filter out unsafe results
        const safeResults = resultPayouts.filter(r => r.validation.isSafe);
        
        // If no safe results found, use fallback
        if (safeResults.length === 0) {
            logger.warn('No safe results found, using fallback');
            return await generateFallbackResult(gameType);
        }
        
        // Sort safe results by distance from target payout (closest to 60% rule)
        safeResults.sort((a, b) => a.distanceFromTarget - b.distanceFromTarget);
      
        // Find the most optimal result (closest to 60% payout)
        const optimalResult = safeResults[0];
      
        // Get lowest payouts (best for house)
        const lowestPayouts = [...safeResults].sort((a, b) => a.expectedPayout - b.expectedPayout);
      
        // Get highest payout (best for players)
        const highestPayout = [...safeResults].sort((a, b) => b.expectedPayout - a.expectedPayout)[0];
        
        logger.info('Optimal result selected', {
            optimalResult,
            riskLevel: optimalResult.riskLevel,
            houseEdgePercent: optimalResult.houseEdgePercent,
            validation: optimalResult.validation
        });
      
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
        logger.error('Error calculating optimized result', {
            error: error.message,
            stack: error.stack,
            gameType,
            duration,
            periodId
        });
        return await generateFallbackResult(gameType);
    }
};

/**
 * Validate fallback result for safety
 * @param {Object} result - Result object
 * @param {string} gameType - Game type
 * @returns {Object} - Validation result
 */
const validateFallbackResult = async (result, gameType) => {
    try {
        // Basic validation for each game type
        const validations = {
            isSafe: true,
            warnings: []
        };

        switch (gameType) {
            case 'trx_wix':
                // Validate number range
                if (result.number < 0 || result.number > 9) {
                    validations.isSafe = false;
                    validations.warnings.push('Invalid number range');
                }
                
                // Validate color
                const validColors = ['red', 'green', 'violet', 'red_violet', 'green_violet'];
                if (!validColors.includes(result.color)) {
                    validations.isSafe = false;
                    validations.warnings.push('Invalid color');
                }
                
                // Validate size
                if (!['Big', 'Small'].includes(result.size)) {
                    validations.isSafe = false;
                    validations.warnings.push('Invalid size');
                }
                break;

            case 'fiveD':
                // Validate each position (A-E)
                for (const pos of ['A', 'B', 'C', 'D', 'E']) {
                    if (result[pos] < 0 || result[pos] > 9) {
                        validations.isSafe = false;
                        validations.warnings.push(`Invalid value for position ${pos}`);
                    }
                }
                break;

            case 'k3':
                // Validate dice values
                for (let i = 1; i <= 3; i++) {
                    const diceValue = result[`dice_${i}`];
                    if (diceValue < 1 || diceValue > 6) {
                        validations.isSafe = false;
                        validations.warnings.push(`Invalid value for dice_${i}`);
                    }
                }
                break;
        }

        // Log validation results
        logger.info('Fallback result validation', {
            gameType,
            result,
            validations
        });

        return validations;

    } catch (error) {
        logger.error('Error validating fallback result', {
            error: error.message,
            stack: error.stack,
            gameType,
            result
        });

        return {
            isSafe: false,
            warnings: ['Error during validation']
        };
    }
};

/**
 * Generate a fallback result when the 60/40 algorithm fails
 * @param {string} gameType - Game type (wingo, fiveD, k3)
 * @returns {Object} - Fallback result and expected payout
 */
const generateFallbackResult = async (gameType) => {
    try {
        logger.info('Generating fallback result', { gameType });
        
        // When no bets are placed, use truly random generation
        const totalBetAmount = 0; // Since there are no bets
        
        // Use crypto for better randomness if available
        let randomResult;
        try {
            const crypto = require('crypto');
            
            // Get current timestamp for additional entropy
            const timestamp = Date.now();
            
            // Create a combination of sources for better randomness
            const randomBuffer = crypto.randomBytes(8);
            const random1 = randomBuffer.readUInt32BE(0) / 0xFFFFFFFF;
            const random2 = randomBuffer.readUInt32BE(4) / 0xFFFFFFFF;
            
            // Combine multiple random sources
            const combinedRandom = (timestamp % 997 * random1 + random2) % 1;
            
            // Generate different result for each game type
            switch (gameType) {
                case 'trx_wix':
                    const number = Math.floor(combinedRandom * 10); // 0-9
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
                    
                    randomResult = { number, color, size };
                    break;
                    
                case 'fiveD':
                    randomResult = {
                        A: Math.floor(random1 * 10),
                        B: Math.floor(random2 * 10),
                        C: Math.floor(combinedRandom * 10),
                        D: Math.floor((random1 + timestamp % 97) % 1 * 10),
                        E: Math.floor((random2 + timestamp % 89) % 1 * 10)
                    };
                    break;
                    
                case 'k3':
                    randomResult = {
                        dice_1: Math.floor(random1 * 6) + 1,
                        dice_2: Math.floor(random2 * 6) + 1,
                        dice_3: Math.floor(combinedRandom * 6) + 1
                    };
                    break;
                    
                default:
                    randomResult = generateRandomResult(gameType);
                    break;
            }
        } catch (cryptoError) {
            // Fallback if crypto is not available
            logger.warn('Crypto random generation failed, using Math.random', { error: cryptoError.message });
            randomResult = generateRandomResult(gameType);
        }
        
        const validation = await validateFallbackResult(randomResult, gameType);
        
        logger.info('Generated truly random fallback result', {
            gameType,
            randomResult,
                validation
        });
            
            return {
            result: randomResult,
                expectedPayout: 0,
                houseEdgePercent: 100,
            validation
        };
    } catch (error) {
        logger.error('Error generating fallback result', {
            error: error.message,
            stack: error.stack,
            gameType
        });
        
        // Last resort fallback
        const randomResult = generateRandomResult(gameType);
        return {
            result: randomResult,
            expectedPayout: 0,
            houseEdgePercent: 100,
            validation: { isSafe: true, warnings: [] }
        };
    }
};

/**
 * Generate random result based on game type
 * @param {string} gameType - Game type (wingo, fiveD, k3)
 * @returns {Object} - Random result object
 */
const generateRandomResult = (gameType) => {
  switch (gameType) {
    case 'trx_wix':
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
const generateAllPossibleResults = async (gameType) => {
  switch (gameType) {
    case 'trx_wix':
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
          C: Math.floor(Math.random() * 10),
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
const calculateExpectedPayout = async (gameType, durationKey, periodId, result) => {
  let totalPayout = 0;
  
  switch (gameType) {
    case 'trx_wix':
      // Calculate number bets
      const numberBetAmount = parseFloat(
        await redisClient.get(`trx_wix:${durationKey}:${periodId}:number:${result.number}`) || 0
      );
      totalPayout += numberBetAmount * 9; // 9x multiplier for number bets
      
      // Calculate color bets
      const colorBetAmount = parseFloat(
        await redisClient.get(`trx_wix:${durationKey}:${periodId}:color:${result.color}`) || 0
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
        await redisClient.get(`trx_wix:${durationKey}:${periodId}:size:${result.size.toLowerCase()}`) || 0
      );
      totalPayout += sizeBetAmount * 2; // 2x for big/small
      
      // Calculate odd/even bets
      const parity = result.number % 2 === 0 ? 'even' : 'odd';
      const parityBetAmount = parseFloat(
        await redisClient.get(`trx_wix:${durationKey}:${periodId}:parity:${parity}`) || 0
      );
      totalPayout += parityBetAmount * 2; // 2x for odd/even
      
      break;
      
    case 'fiveD':
      // Calculate individual position bets (A-E)
      for (const pos of ['A', 'B', 'C', 'D', 'E']) {
        const posBetAmount = parseFloat(
          await redisClient.get(`fiveD:${durationKey}:${periodId}:${pos}:number:${result[pos]}`) || 0
        );
        totalPayout += posBetAmount * 9; // 9x multiplier for exact number
      }
      
      // Calculate sum bets
      const sum = result.A + result.B + result.C + result.D + result.E;
      const sumBetAmount = parseFloat(
        await redisClient.get(`fiveD:${durationKey}:${periodId}:sum:number:${sum}`) || 0
      );
      totalPayout += sumBetAmount * 9; // 9x multiplier for sum
      
      // Calculate big/small bets (sum > 22.5 is big)
      const sumCategory = sum > 22.5 ? 'big' : 'small';
      const sumCategoryBetAmount = parseFloat(
        await redisClient.get(`fiveD:${durationKey}:${periodId}:sum:category:${sumCategory}`) || 0
      );
      totalPayout += sumCategoryBetAmount * 2; // 2x for big/small
      
      // Calculate odd/even bets for sum
      const sumParity = sum % 2 === 0 ? 'even' : 'odd';
      const sumParityBetAmount = parseFloat(
        await redisClient.get(`fiveD:${durationKey}:${periodId}:sum:parity:${sumParity}`) || 0
      );
      totalPayout += sumParityBetAmount * 2; // 2x for odd/even
      
      break;
      
    case 'k3':
      // Calculate sum bets
      const diceSum = result.dice_1 + result.dice_2 + result.dice_3;
      const diceSumBetAmount = parseFloat(
        await redisClient.get(`k3:${durationKey}:${periodId}:sum:${diceSum}`) || 0
      );
      totalPayout += diceSumBetAmount * 9; // 9x multiplier for exact sum
      
      // Calculate sum category bets (big/small)
      const diceSumCategory = diceSum > 10.5 ? 'big' : 'small';
      const diceCategoryBetAmount = parseFloat(
        await redisClient.get(`k3:${durationKey}:${periodId}:sum_category:${diceSumCategory}`) || 0
      );
      totalPayout += diceCategoryBetAmount * 2; // 2x for big/small
      
      // Calculate matching dice bets
      const diceCounts = [result.dice_1, result.dice_2, result.dice_3].reduce((acc, val) => {
        acc[val] = (acc[val] || 0) + 1;
        return acc;
      }, {});
      
      // Check for triplets
      if (Object.values(diceCounts).includes(3)) {
        const tripletBetAmount = parseFloat(
          await redisClient.get(`k3:${durationKey}:${periodId}:matching_dice:triplet:${result.dice_1}`) || 0
        );
        totalPayout += tripletBetAmount * 30; // 30x for triplets
      }
      
      // Check for pairs
      const pairs = Object.entries(diceCounts).filter(([_, count]) => count === 2);
      if (pairs.length > 0) {
        const pairValue = pairs[0][0];
        const pairBetAmount = parseFloat(
          await redisClient.get(`k3:${durationKey}:${periodId}:matching_dice:pair:${pairValue}`) || 0
        );
        totalPayout += pairBetAmount * 15; // 15x for pairs
      }
      
      // Calculate number pattern bets
      const pattern = [result.dice_1, result.dice_2, result.dice_3].sort().join('');
      const patternBetAmount = parseFloat(
        await redisClient.get(`k3:${durationKey}:${periodId}:number_pattern:${pattern}`) || 0
      );
      totalPayout += patternBetAmount * 9; // 9x for number patterns
      
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
const storeBetInRedis = async (
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
      case 'trx_wix':
        redisKey = `trx_wix:${durationKey}:${periodId}:${betType.toLowerCase()}:${betValue.toLowerCase()}`;
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
    await redisClient.incrByFloat(redisKey, betAmount);
    
    // Update total bet amount for this period
    const totalKey = `${gameType}:${durationKey}:${periodId}:total`;
    await redisClient.incrByFloat(totalKey, betAmount);
    
    // Set expiry for these keys (e.g., 24 hours)
    const EXPIRY_SECONDS = 24 * 60 * 60;
    await redisClient.expire(redisKey, EXPIRY_SECONDS);
    await redisClient.expire(totalKey, EXPIRY_SECONDS);
    
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
const processBet = async (betData) => {
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
    // Check if betting is frozen for this period
    const frozen = await isBettingFrozen(gameType, duration, periodId);
    if (frozen) {
      await t.rollback();
      return {
        success: false,
        message: 'Betting is frozen for this period'
      };
    }

    // Validate bet before processing
    const validation = await validateBet(betData);
    if (!validation.valid) {
      await t.rollback();
      return {
        success: false,
        message: validation.message
      };
    }

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
      case 'trx_wix':
        betRecord = await BetRecordTrxWix.create({
          user_id: userId,
          period: periodId,
          bet_type: `${betType}:${betValue}`,
          bet_amount: betAmount,
          odds: calculateOdds(gameType, betType, betValue),
          status: 'pending'
        }, { transaction: t });
        break;
      
      case 'fiveD':
        betRecord = await BetRecord5D.create({
          user_id: userId,
          period: periodId,
          bet_type: `${betType}:${betValue}`,
          bet_amount: betAmount,
          odds: calculateOdds(gameType, betType, betValue),
          status: 'pending'
        }, { transaction: t });
        break;
      
      case 'k3':
        betRecord = await BetRecordK3.create({
          user_id: userId,
          period: periodId,
          bet_type: `${betType}:${betValue}`,
          bet_amount: betAmount,
          odds: calculateOdds(gameType, betType, betValue),
          status: 'pending'
        }, { transaction: t });
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
 * Calculate odds for a bet type
 * @param {string} gameType - Game type
 * @param {string} betType - Type of bet (NUMBER, COLOR, SIZE, etc.)
 * @param {string} betValue - Value of the bet
 * @returns {number} - Odds multiplier
 */
const calculateOdds = (gameType, betType, betValue) => {
  switch (gameType) {
    case 'trx_wix':
      if (betType === 'NUMBER') {
        return 9.0; // 9x for number bets
      } else if (betType === 'COLOR') {
        if (betValue === 'violet') {
          return 4.5; // 4.5x for violet
        } else if (betValue === 'green_violet' || betValue === 'red_violet') {
          return 2.0; // 2x for dual colors
        } else {
          return 2.0; // 2x for regular colors (red/green)
        }
      } else if (betType === 'SIZE') {
        return 2.0; // 2x for big/small
      } else if (betType === 'PARITY') {
        return 2.0; // 2x for odd/even
      }
      break;
      
    case 'fiveD':
      // 5D odds calculation
      return 9.0; // Default
      
    case 'k3':
      // K3 odds calculation
      return 6.0; // Default
  }
  
  return 1.0; // Default fallback
};

/**
 * Get active periods for a game type
 * @param {string} gameType - Game type
 * @returns {Array} - Active periods
 */
const getActivePeriods = async (gameType) => {
    try {
        const now = new Date();
        let activePeriods = [];

        // Get current periods for each duration
        if (gameType === 'wingo') {
            activePeriods.push(await periodService.generatePeriodId(gameType, 30, now));
            activePeriods.push(await periodService.generatePeriodId(gameType, 60, now));
            activePeriods.push(await periodService.generatePeriodId(gameType, 180, now));
            activePeriods.push(await periodService.generatePeriodId(gameType, 300, now));
        } else if (gameType === 'fiveD') {
            activePeriods.push(await periodService.generatePeriodId(gameType, 60, now));
            activePeriods.push(await periodService.generatePeriodId(gameType, 180, now));
            activePeriods.push(await periodService.generatePeriodId(gameType, 300, now));
            activePeriods.push(await periodService.generatePeriodId(gameType, 600, now));
        } else if (gameType === 'k3') {
            activePeriods.push(await periodService.generatePeriodId(gameType, 60, now));
            activePeriods.push(await periodService.generatePeriodId(gameType, 180, now));
            activePeriods.push(await periodService.generatePeriodId(gameType, 300, now));
            activePeriods.push(await periodService.generatePeriodId(gameType, 600, now));
        }

        // Add next periods if needed
        activePeriods = await periodService.addPeriods(activePeriods, gameType, 30, now);
        activePeriods = await periodService.addPeriods(activePeriods, gameType, 60, now);
        activePeriods = await periodService.addPeriods(activePeriods, gameType, 180, now);
        activePeriods = await periodService.addPeriods(activePeriods, gameType, 300, now);
        if (gameType !== 'wingo') {
            activePeriods = await periodService.addPeriods(activePeriods, gameType, 600, now);
        }

        return activePeriods;
    } catch (error) {
        logger.error('Error getting active periods:', {
            error: error.message,
            stack: error.stack,
            gameType
        });
        return [];
    }
};

/**
 * Get status of a period
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 * @param {string} periodId - Period ID
 * @returns {Object} - Period status
 */
const getPeriodStatus = periodService.getPeriodStatus;

/**
 * Store temporary result in Redis
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 * @param {string} periodId - Period ID
 * @param {Object} result - Result object
 */
const storeTemporaryResult = async (gameType, duration, periodId, result) => {
  try {
  const durationKey = duration === 30 ? '30s' : 
                      duration === 60 ? '1m' : 
                      duration === 180 ? '3m' : 
                      duration === 300 ? '5m' : '10m';
  
    // Key for individual result
    const resultKey = `${gameType}:${durationKey}:${periodId}:result`;
  
    // Store the result in Redis
    await redisClient.set(resultKey, JSON.stringify(result));
  
    // Set expiry for individual result (24 hours)
    const EXPIRY_SECONDS = 24 * 60 * 60;
    await redisClient.expire(resultKey, EXPIRY_SECONDS);
    
    // Safe handling of sorted set operations
    try {
      // Key for list of recent results
      const listKey = `${gameType}:${durationKey}:recent_results`;
      
      // Check if zadd is available, some Redis clients have different method names
      if (typeof redisClient.zAdd === 'function') {
        // Add period ID to the sorted list (using timestamp as score for sorting)
        const now = Date.now();
        await redisClient.zAdd(listKey, { score: now, value: periodId });
        
        // Keep only the 10 most recent results in the sorted set
        // Use the alternative zRemRangeByRank method if available
        if (typeof redisClient.zRemRangeByRank === 'function') {
          await redisClient.zRemRangeByRank(listKey, 0, -11);
        }
        
        // Set expiry for the list itself (7 days)
        await redisClient.expire(listKey, 7 * 24 * 60 * 60);
      } else if (typeof redisClient.zadd === 'function') {
        // Legacy Redis client
        const now = Date.now();
        await redisClient.zadd(listKey, now, periodId);
        
        // Keep only the 10 most recent results in the sorted set
        await redisClient.zremrangebyrank(listKey, 0, -11);
        
        // Set expiry for the list itself (7 days)
        await redisClient.expire(listKey, 7 * 24 * 60 * 60);
      } else {
        // Fallback to using a normal key if sorted sets are not available
        const fallbackListKey = `${gameType}:${durationKey}:recent_results_list`;
        const recentList = JSON.parse(await redisClient.get(fallbackListKey) || '[]');
        
        // Add new period to the list
        recentList.push({
          periodId,
          timestamp: Date.now()
        });
        
        // Keep only 10 most recent
        const sortedList = recentList.sort((a, b) => b.timestamp - a.timestamp).slice(0, 10);
        
        // Save back to Redis
        await redisClient.set(fallbackListKey, JSON.stringify(sortedList));
        await redisClient.expire(fallbackListKey, 7 * 24 * 60 * 60);
      }
    } catch (redisError) {
      console.error('Error with Redis sorted set operations:', redisError);
      // Continue execution - the main result is still stored
    }
    
    // Log successful storage
    console.log(`Stored ${gameType} ${durationKey} result for period ${periodId} in Redis`);
  
  } catch (error) {
    console.error('Error storing temporary result in Redis:', error);
    // Still attempt to store the basic result even if our cleanup logic fails
    const fallbackKey = `${gameType}:${duration}:${periodId}:result`;
    
    try {
      await redisClient.set(fallbackKey, JSON.stringify(result));
      await redisClient.expire(fallbackKey, 24 * 60 * 60);
    } catch (finalError) {
      console.error('Final fallback Redis storage also failed:', finalError);
      // At this point we've done all we can - the DB record is still preserved
    }
  }
};

/**
 * Store minimum combinations for the current hour
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 * @param {string} periodId - Period ID
 * @param {Array} combinations - Array of minimum combinations
 */
const storeHourlyMinimumCombinations = async (gameType, duration, periodId, combinations) => {
    try {
        const durationKey = duration === 30 ? '30s' : 
                          duration === 60 ? '1m' : 
                          duration === 180 ? '3m' : 
                          duration === 300 ? '5m' : '10m';

        // Get current hour timestamp
        const now = new Date();
        const hourKey = now.toISOString().slice(0, 13); // Format: YYYY-MM-DDTHH

        // Create Redis key for this hour's combinations
        const hourlyKey = `${gameType}:${durationKey}:hourly:${hourKey}`;

        // Store combinations with metadata
        await redisClient.set(hourlyKey, JSON.stringify({
            timestamp: now.toISOString(),
            periodId,
            combinations: combinations.slice(0, 3), // Store top 3 minimum combinations
            gameType,
            duration
        }));

        // Set expiry for 24 hours
        const EXPIRY_SECONDS = 24 * 60 * 60;
        await redisClient.expire(hourlyKey, EXPIRY_SECONDS);

        logger.info('Stored hourly minimum combinations', {
            gameType,
            duration,
            periodId,
            hourKey,
            combinations: combinations.slice(0, 3)
        });

    } catch (error) {
        logger.error('Error storing hourly minimum combinations', {
            error: error.message,
            stack: error.stack,
            gameType,
            duration,
            periodId
        });
    }
};

/**
 * Get minimum combinations for the current hour
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 * @returns {Array} - Array of minimum combinations
 */
const getHourlyMinimumCombinations = async (gameType, duration) => {
    try {
        const durationKey = duration === 30 ? '30s' : 
                          duration === 60 ? '1m' : 
                          duration === 180 ? '3m' : 
                          duration === 300 ? '5m' : '10m';

        // Get current hour timestamp
        const now = new Date();
        const hourKey = now.toISOString().slice(0, 13);

        // Get combinations from Redis
        const hourlyKey = `${gameType}:${durationKey}:hourly:${hourKey}`;
        const combinationsStr = await redisClient.get(hourlyKey);

        if (!combinationsStr) {
            return [];
        }

        const data = JSON.parse(combinationsStr);
        return data.combinations;

    } catch (error) {
        logger.error('Error getting hourly minimum combinations', {
            error: error.message,
            stack: error.stack,
            gameType,
            duration
        });
        return [];
    }
};

/**
 * Track bet combinations continuously during the period
 * @param {string} gameType - Game type (wingo, fiveD, k3)
 * @param {number} duration - Duration in seconds
 * @param {string} periodId - Period ID
 */
const trackBetCombinations = async (gameType, duration, periodId) => {
    try {
        const durationKey = duration === 30 ? '30s' : 
                          duration === 60 ? '1m' : 
                          duration === 180 ? '3m' : 
                          duration === 300 ? '5m' : '10m';
        
        // Standard expiry for all Redis keys - 24 hours
        const EXPIRY_SECONDS = 24 * 60 * 60;

        // Get all possible results
        const possibleResults = await generateAllPossibleResults(gameType);
        
        // Calculate bet amounts for each result
        const resultWithBets = await Promise.all(possibleResults.map(async (result) => {
            const expectedPayout = await calculateExpectedPayout(gameType, durationKey, periodId, result);
            return {
                result,
                betAmount: expectedPayout
            };
        }));

        // Sort by bet amount (ascending)
        resultWithBets.sort((a, b) => a.betAmount - b.betAmount);

        // Get top 3 minimum combinations
        const minimumCombinations = resultWithBets.slice(0, 3);

        // Store in Redis for current period with expiration
        const lowestComboKey = `${gameType}:${durationKey}:${periodId}:lowest_combinations`;
        await redisClient.set(lowestComboKey, JSON.stringify(minimumCombinations));
        await redisClient.expire(lowestComboKey, EXPIRY_SECONDS);

        // Store for hourly tracking
        await storeHourlyMinimumCombinations(gameType, duration, periodId, resultWithBets);

        // Calculate 60/40 optimized result
        const optimizedResult = await calculateOptimizedResult(gameType, duration, periodId);
        
        // Store optimized result in Redis with expiration
        const optimizedResultKey = `${gameType}:${durationKey}:${periodId}:optimized_result`;
        await redisClient.set(optimizedResultKey, JSON.stringify(optimizedResult));
        await redisClient.expire(optimizedResultKey, EXPIRY_SECONDS);
        
        // Add to the list of tracked periods
        const trackedPeriodsKey = `${gameType}:${durationKey}:tracked_periods`;
        await redisClient.zadd(trackedPeriodsKey, Date.now(), periodId);
        
        // Keep only the last 20 tracked periods
        await redisClient.zremrangebyrank(trackedPeriodsKey, 0, -21);
        await redisClient.expire(trackedPeriodsKey, EXPIRY_SECONDS);

        logger.info('Bet combinations tracked', {
            gameType,
            periodId,
            minimumCombinations,
            optimizedResult
        });

    } catch (error) {
        logger.error('Error tracking bet combinations', {
            error: error.message,
            stack: error.stack,
            gameType,
            periodId
        });
    }
};

/**
 * Start continuous tracking for a period
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 * @param {string} periodId - Period ID
 */
const startPeriodTracking = async (gameType, duration, periodId) => {
    try {
        // Calculate tracking interval (update every 5 seconds)
        const trackingInterval = 5000;
        
        // Start tracking immediately
        await trackBetCombinations(gameType, duration, periodId);
        
        // Set up interval for continuous tracking
        const intervalId = setInterval(async () => {
            const periodStatus = await getPeriodStatus(gameType, duration, periodId);
            
            // Stop tracking if period is no longer active
            if (!periodStatus.active) {
                clearInterval(intervalId);
                return;
            }
            
            await trackBetCombinations(gameType, duration, periodId);
        }, trackingInterval);

        // Store interval ID in Redis for cleanup
        const durationKey = duration === 30 ? '30s' : 
                          duration === 60 ? '1m' : 
                          duration === 180 ? '3m' : 
                          duration === 300 ? '5m' : '10m';
        
        await redisClient.set(
            `${gameType}:${durationKey}:${periodId}:tracking_interval`,
            intervalId.toString()
        );

        logger.info('Period tracking started', {
            gameType,
            periodId,
            duration,
            trackingInterval
        });

    } catch (error) {
        logger.error('Error starting period tracking', {
            error: error.message,
            stack: error.stack,
            gameType,
            periodId
        });
    }
};

/**
 * Get pre-calculated results for a period
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 * @param {string} periodId - Period ID
 * @returns {Object} - Pre-calculated results
 */
const getPreCalculatedResults = async (gameType, duration, periodId) => {
    try {
        const durationKey = duration === 30 ? '30s' : 
                          duration === 60 ? '1m' : 
                          duration === 180 ? '3m' : 
                          duration === 300 ? '5m' : '10m';

        // Get lowest combinations
        const lowestCombinationsStr = await redisClient.get(
            `${gameType}:${durationKey}:${periodId}:lowest_combinations`
        );
        const lowestCombinations = lowestCombinationsStr ? JSON.parse(lowestCombinationsStr) : [];

        // Get optimized result
        const optimizedResultStr = await redisClient.get(
            `${gameType}:${durationKey}:${periodId}:optimized_result`
        );
        const optimizedResult = optimizedResultStr ? JSON.parse(optimizedResultStr) : null;

        return {
            lowestCombinations,
            optimizedResult
        };
    } catch (error) {
        logger.error('Error getting pre-calculated results', {
            error: error.message,
            stack: error.stack,
            gameType,
            periodId
        });
        return {
            lowestCombinations: [],
            optimizedResult: null
        };
    }
};

/**
 * Initialize a new game period
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 * @param {string} periodId - Period ID
 */
const initializePeriod = periodService.initializePeriod;

/**
 * Log suspicious activity for monitoring
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 * @param {string} periodId - Period ID
 * @param {Object} validations - Validation results
 */
const logSuspiciousActivity = async (gameType, duration, periodId, validations) => {
    try {
        const durationKey = duration === 30 ? '30s' : 
                          duration === 60 ? '1m' : 
                          duration === 180 ? '3m' : 
                          duration === 300 ? '5m' : '10m';

        // Store suspicious activity in Redis
        const suspiciousKey = `${gameType}:${durationKey}:${periodId}:suspicious`;
        await redisClient.set(suspiciousKey, JSON.stringify({
            timestamp: new Date().toISOString(),
            validations,
            action: 'result_override'
        }));

        // Set expiry for suspicious activity log (7 days)
        const EXPIRY_SECONDS = 7 * 24 * 60 * 60;
        await redisClient.expire(suspiciousKey, EXPIRY_SECONDS);

        // Log to file
        logger.error('Suspicious activity detected', {
            gameType,
            periodId,
            duration,
            validations,
            action: 'result_override'
        });

    } catch (error) {
        logger.error('Error logging suspicious activity', {
            error: error.message,
            stack: error.stack,
            gameType,
            periodId
        });
    }
};

/**
 * Additional safety checks for bet processing
 * @param {Object} betData - Bet data
 * @returns {Object} - Validation result
 */
const validateBet = async (betData) => {
    const {
        userId,
        gameType,
        duration,
        periodId,
        betType,
        betValue,
        betAmount
    } = betData;

    try {
        // Check if period is still open for betting
        const periodStatus = await getPeriodStatus(gameType, duration, periodId);
        if (!periodStatus.active || periodStatus.timeRemaining < 5) {
            return {
                valid: false,
                message: 'Betting for this period is closed'
            };
        }

        // Check bet amount limits
        if (betAmount > RISK_THRESHOLDS.HIGH.maxBetAmount) {
            return {
                valid: false,
                message: 'Bet amount exceeds maximum limit'
            };
        }

        // Check user's betting frequency
        const userBets = await getUserBetCount(userId, gameType, periodId);
        if (userBets >= 10) {
            return {
                valid: false,
                message: 'Maximum bets per period reached'
            };
        }

        // Check for rapid betting
        const lastBetTime = await getLastBetTime(userId, gameType);
        const timeSinceLastBet = Date.now() - lastBetTime;
        if (timeSinceLastBet < 1000) { // Less than 1 second between bets
            return {
                valid: false,
                message: 'Betting too rapidly'
            };
        }

        // Check total bets on this outcome
        const totalBetsOnOutcome = await getTotalBetsOnOutcome(gameType, duration, periodId, betType, betValue);
        if (totalBetsOnOutcome > RISK_THRESHOLDS.HIGH.maxBetAmount) {
            return {
                valid: false,
                message: 'Maximum bets on this outcome reached'
            };
        }

        return {
            valid: true,
            message: 'Bet validated successfully'
        };

    } catch (error) {
        logger.error('Error validating bet', {
            error: error.message,
            stack: error.stack,
            betData
        });
        return {
            valid: false,
            message: 'Error validating bet'
        };
    }
};

/**
 * Get user's bet count for current period
 * @param {string} userId - User ID
 * @param {string} gameType - Game type
 * @param {string} periodId - Period ID
 * @returns {number} - Number of bets
 */
const getUserBetCount = async (userId, gameType, periodId) => {
    try {
        let betCount = 0;
        switch (gameType) {
            case 'trx_wix':
                betCount = await BetRecordWingo.count({
                    where: {
                        user_id: userId,
                        period: periodId
                    }
                });
                break;
            case 'fiveD':
                betCount = await BetRecord5D.count({
                    where: {
                        user_id: userId,
                        period: periodId
                    }
                });
                break;
            case 'k3':
                betCount = await BetRecordK3.count({
                    where: {
                        user_id: userId,
                        period: periodId
                    }
                });
                break;
        }
        return betCount;
    } catch (error) {
        logger.error('Error getting user bet count', {
            error: error.message,
            stack: error.stack,
            userId,
            gameType,
            periodId
        });
        return 0;
    }
};

/**
 * Get user's last bet time
 * @param {string} userId - User ID
 * @param {string} gameType - Game type
 * @returns {number} - Timestamp of last bet
 */
const getLastBetTime = async (userId, gameType) => {
    try {
        let lastBet;
        switch (gameType) {
            case 'trx_wix':
                lastBet = await BetRecordWingo.findOne({
                    where: { user_id: userId },
                    order: [['created_at', 'DESC']]
                });
                break;
            case 'fiveD':
                lastBet = await BetRecord5D.findOne({
                    where: { user_id: userId },
                    order: [['created_at', 'DESC']]
                });
                break;
            case 'k3':
                lastBet = await BetRecordK3.findOne({
                    where: { user_id: userId },
                    order: [['created_at', 'DESC']]
                });
                break;
        }
        return lastBet ? new Date(lastBet.created_at).getTime() : 0;
    } catch (error) {
        logger.error('Error getting last bet time', {
            error: error.message,
            stack: error.stack,
            userId,
            gameType
        });
        return 0;
    }
};

/**
 * Get total bets on specific outcome
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 * @param {string} periodId - Period ID
 * @param {string} betType - Type of bet
 * @param {string} betValue - Value bet on
 * @returns {number} - Total bet amount
 */
const getTotalBetsOnOutcome = async (gameType, duration, periodId, betType, betValue) => {
    try {
        const durationKey = duration === 30 ? '30s' : 
                          duration === 60 ? '1m' : 
                          duration === 180 ? '3m' : 
                          duration === 300 ? '5m' : '10m';

        const redisKey = `${gameType}:${durationKey}:${periodId}:${betType.toLowerCase()}:${betValue.toLowerCase()}`;
        return parseFloat(await redisClient.get(redisKey) || 0);
    } catch (error) {
        logger.error('Error getting total bets on outcome', {
            error: error.message,
            stack: error.stack,
            gameType,
            periodId,
            betType,
            betValue
        });
        return 0;
    }
};

// Add function to get all minimum combinations for a game type
const getAllMinimumCombinations = async (gameType) => {
    try {
        const combinations = {};
        const durations = [30, 60, 180, 300, 600]; // All possible durations

        for (const duration of durations) {
            const durationKey = duration === 30 ? '30s' : 
                              duration === 60 ? '1m' : 
                              duration === 180 ? '3m' : 
                              duration === 300 ? '5m' : '10m';

            // Get current hour's combinations
            const hourlyCombinations = await getHourlyMinimumCombinations(gameType, duration);
            
            if (hourlyCombinations.length > 0) {
                combinations[durationKey] = hourlyCombinations;
            }
        }

        return combinations;

    } catch (error) {
        logger.error('Error getting all minimum combinations', {
            error: error.message,
            stack: error.stack,
            gameType
        });
        return {};
    }
};

/**
 * Calculate game result with TRON hash verification
 * @param {string} gameType - Game type
 * @param {string} duration - Game duration
 * @param {string} periodId - Period ID
 * @returns {Promise<Object>} - Result with verification
 */
const calculateResultWithVerification = async (gameType, duration, periodId) => {
    try {
        // Calculate the result using existing logic
        let result;
        
        try {
            result = await calculateOptimizedResult(gameType, duration, periodId);
        } catch (calcError) {
            console.log(`Error calculating optimized result for ${gameType}:`, calcError.message);
            
            // Fall back to generating a result directly based on game type
            console.log(`Generating fallback result for ${gameType}`);
            
            // Use fallback result generation
            if (gameType === 'wingo') {
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
                
                result = {
                    optimalResult: {
                        result: { number, color, size },
                        expectedPayout: 0,
                        houseEdgePercent: 100,
                        validation: { isSafe: true, warnings: [] }
                    }
                };
            } else if (gameType === 'fiveD') {
                const A = Math.floor(Math.random() * 10);
                const B = Math.floor(Math.random() * 10);
                const C = Math.floor(Math.random() * 10);
                const D = Math.floor(Math.random() * 10);
                const E = Math.floor(Math.random() * 10);
                const sum = A + B + C + D + E;
                
                result = {
                    optimalResult: {
                        result: { A, B, C, D, E, sum },
                        expectedPayout: 0,
                        houseEdgePercent: 100,
                        validation: { isSafe: true, warnings: [] }
                    }
                };
            } else if (gameType === 'k3') {
                const dice_1 = Math.floor(Math.random() * 6) + 1;
                const dice_2 = Math.floor(Math.random() * 6) + 1;
                const dice_3 = Math.floor(Math.random() * 6) + 1;
                const sum = dice_1 + dice_2 + dice_3;
                const sum_size = sum > 10 ? 'big' : 'small';
                const sum_parity = sum % 2 === 0 ? 'even' : 'odd';
                
                // Check for pairs and triples
                const diceCounts = {};
                [dice_1, dice_2, dice_3].forEach(dice => {
                    diceCounts[dice] = (diceCounts[dice] || 0) + 1;
                });
                
                const has_pair = Object.values(diceCounts).includes(2);
                const has_triple = Object.values(diceCounts).includes(3);
                
                // Check for straights (123, 234, 345, 456)
                const sortedDice = [dice_1, dice_2, dice_3].sort((a, b) => a - b);
                const is_straight = 
                    (sortedDice[0] === sortedDice[1] - 1 && sortedDice[1] === sortedDice[2] - 1) ||
                    (sortedDice[0] === 4 && sortedDice[1] === 5 && sortedDice[2] === 6);
                
                result = {
                    optimalResult: {
                        result: { 
                            dice_1, 
                            dice_2, 
                            dice_3, 
                            sum,
                            sum_size,
                            sum_parity,
                            has_pair,
                            has_triple,
                            is_straight
                        },
                        expectedPayout: 0,
                        houseEdgePercent: 100,
                        validation: { isSafe: true, warnings: [] }
                    }
                };
            } else if (gameType === 'trx_wix') {
                // Similar to wingo
                const number = Math.floor(Math.random() * 10);
                let color = '';
                let size = number >= 5 ? 'Big' : 'Small';
                
                if (number === 0) {
                    color = 'violet';
                } else if (number === 5) {
                    color = 'green_violet';
                } else if ([1, 3, 7, 9].includes(number)) {
                    color = 'green';
                } else {
                    color = 'red';
                }
                
                result = {
                    optimalResult: {
                        result: { number, color, size },
                        expectedPayout: 0,
                        houseEdgePercent: 100,
                        validation: { isSafe: true, warnings: [] }
                    }
                };
            }
        }
        
        // Extract the actual result from the optimization result
        let gameResult;
        if (result && result.optimalResult && result.optimalResult.result) {
            gameResult = result.optimalResult.result;
        } else if (result && result.result) {
            gameResult = result.result;
        } else {
            // Create a default game result if everything else fails
            switch (gameType) {
                case 'wingo':
                case 'trx_wix':
                    const number = Math.floor(Math.random() * 10);
                    let color = number === 0 ? 'violet' : number === 5 ? 'green_violet' : 
                        [1, 3, 7, 9].includes(number) ? 'green' : 'red';
                    let size = number >= 5 ? 'Big' : 'Small';
                    gameResult = { number, color, size };
                    break;
                case 'fiveD':
                    gameResult = {
                        A: Math.floor(Math.random() * 10),
                        B: Math.floor(Math.random() * 10),
                        C: Math.floor(Math.random() * 10),
                        D: Math.floor(Math.random() * 10),
                        E: Math.floor(Math.random() * 10)
                    };
                    gameResult.sum = gameResult.A + gameResult.B + gameResult.C + gameResult.D + gameResult.E;
                    break;
                case 'k3':
                    const dice_1 = Math.floor(Math.random() * 6) + 1;
                    const dice_2 = Math.floor(Math.random() * 6) + 1;
                    const dice_3 = Math.floor(Math.random() * 6) + 1;
                    gameResult = { 
                        dice_1, dice_2, dice_3,
                        sum: dice_1 + dice_2 + dice_3,
                        sum_size: (dice_1 + dice_2 + dice_3) > 10 ? 'big' : 'small',
                        sum_parity: (dice_1 + dice_2 + dice_3) % 2 === 0 ? 'even' : 'odd'
                    };
                    break;
            }
        }
        
        // Get verification hash for the result
        let numberForVerification;
        if (gameType === 'wingo' || gameType === 'trx_wix') {
            numberForVerification = gameResult.number;
        } else if (gameType === 'fiveD') {
            numberForVerification = gameResult.sum % 10; // Use last digit of sum
        } else if (gameType === 'k3') {
            numberForVerification = gameResult.sum % 10; // Use last digit of sum
        }
        
        const verification = await tronHashService.getResultWithVerification(numberForVerification);
        
        // Log the result with verification
        logger.info('Game result with verification', {
            gameType,
            duration,
            periodId,
            result: verification
        });
        
        return {
            success: true,
            result: gameResult,
            verification: verification
        };
    } catch (error) {
        logger.error('Error calculating result with verification:', error);
        
        // As a last resort, return a simple valid result based on game type
        const defaultResult = generateRandomResult(gameType);
        
        return {
            success: false,
            message: error.message,
            result: defaultResult
        };
    }
};

// Update the endRound function to use the new verification system
const endRound = async (gameType, duration, periodId) => {
    try {
        // Get the result with verification
        const resultWithVerification = await calculateResultWithVerification(gameType, duration, periodId);
        
        // Store the result with verification
        await storeTemporaryResult(gameType, duration, periodId, resultWithVerification);
        
        // Check winners and announce
        const winners = await checkWinners(gameType, duration, periodId, resultWithVerification.result);
        
        // Start a new round
        await startRound(gameType, duration);
        
        return {
            result: resultWithVerification.result,
            verification: {
                hash: resultWithVerification.hash,
                link: resultWithVerification.link
            },
            winners
        };
    } catch (error) {
        logger.error(`Error ending round for ${gameType}:`, error);
        throw error;
    }
};

/**
 * Override result for a period (admin only)
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 * @param {string} periodId - Period ID
 * @param {Object} result - Result to override with
 * @param {string} adminId - Admin user ID
 * @returns {Object} - Override result
 */
const overrideResult = async (gameType, duration, periodId, result, adminId) => {
    try {
        // Validate period status
        const periodStatus = await getPeriodStatus(gameType, duration, periodId);
        if (!periodStatus) {
            return {
                success: false,
                message: 'Period not found'
            };
        }

        // Validate result format based on game type
        const validation = await validateFallbackResult(result, gameType);
        if (!validation.isSafe) {
            return {
                success: false,
                message: 'Invalid result format',
                validation
            };
        }

        // Store the override result
        await storeTemporaryResult(gameType, duration, periodId, result);

        // Log the override action
        logger.info('Result overridden by admin', {
            gameType,
            duration,
            periodId,
            result,
            adminId,
            timestamp: new Date().toISOString()
        });

        // Log suspicious activity
        await logSuspiciousActivity(gameType, duration, periodId, {
            type: 'result_override',
            adminId,
            originalResult: periodStatus.result,
            newResult: result
        });

        return {
            success: true,
            message: 'Result overridden successfully',
            result
        };
    } catch (error) {
        logger.error('Error overriding result', {
            error: error.message,
            stack: error.stack,
            gameType,
            periodId,
            adminId
        });
        return {
            success: false,
            message: 'Failed to override result'
        };
    }
};

/**
 * Get bet distribution for a period
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 * @param {string} periodId - Period ID
 * @returns {Object} - Bet distribution data
 */
const getBetDistribution = async (gameType, duration, periodId) => {
    try {
        const durationKey = duration === 30 ? '30s' : 
                          duration === 60 ? '1m' : 
                          duration === 180 ? '3m' : 
                          duration === 300 ? '5m' : '10m';

        // Get all possible results for the game type
        const possibleResults = await generateAllPossibleResults(gameType);
        
        // Get bet amounts for each possible result
        const distribution = await Promise.all(possibleResults.map(async (result) => {
            const expectedPayout = await calculateExpectedPayout(gameType, durationKey, periodId, result);
            return {
                result,
                betAmount: expectedPayout
            };
        }));

        // Get total bet amount
        const totalBetAmount = parseFloat(
            await redisClient.get(`${gameType}:${durationKey}:${periodId}:total`) || 0
        );

        // Calculate percentages
        const distributionWithPercentages = distribution.map(item => ({
            ...item,
            percentage: totalBetAmount > 0 ? (item.betAmount / totalBetAmount) * 100 : 0
        }));

        // Sort by bet amount (descending)
        distributionWithPercentages.sort((a, b) => b.betAmount - a.betAmount);

        return {
            totalBetAmount,
            distribution: distributionWithPercentages,
            periodId,
            gameType,
            duration
        };

    } catch (error) {
        logger.error('Error getting bet distribution', {
            error: error.message,
            stack: error.stack,
            gameType,
            periodId
        });
        return {
            totalBetAmount: 0,
            distribution: [],
            periodId,
            gameType,
            duration
        };
    }
};

/**
 * Get game history
 * @param {string} gameType - Game type (wingo, fiveD, k3, trx_wix)
 * @param {number} duration - Duration in seconds
 * @param {number} limit - Number of records to return
 * @param {number} offset - Offset for pagination
 * @returns {Object} - Game history with pagination
 */
const getGameHistory = async (gameType, duration, limit = 20, offset = 0) => {
    try {
        // Input validation and logging
        if (!gameType) {
            throw new Error('Game type is required');
        }
        
        if (!duration || ![30, 60, 180, 300, 600].includes(parseInt(duration))) {
            throw new Error('Valid duration is required (30, 60, 180, 300, or 600 seconds)');
        }
        
        // Ensure limit and offset are integers
        limit = parseInt(limit);
        offset = parseInt(offset);
        
        // Log request parameters for debugging
        logger.info('Getting game history', {
            gameType,
            duration,
                    limit,
            offset,
            timestamp: new Date().toISOString()
        });

        // Build WHERE condition with proper duration filter
        const durationValue = parseInt(duration);
        const whereCondition = { time: durationValue };
        
        // Special case for trx_wix which stores duration differently or doesn't store it
        const finalWhereCondition = gameType.toLowerCase() === 'trx_wix' ? {} : whereCondition;
        
        // Standardize game type for database queries
        const mappedGameType = {
            'wingo': 'wingo',
            'fived': 'fiveD',
            '5d': 'fiveD',
            'k3': 'k3',
            'trx_wix': 'trx_wix'
        }[gameType.toLowerCase()] || gameType;
        
        // Select appropriate model based on game type
        let Model;
        switch (mappedGameType) {
            case 'wingo':
                Model = BetResultWingo;
                break;
            case 'fiveD':
                Model = BetResult5D;
                break;
            case 'k3':
                Model = BetResultK3;
                break;
            case 'trx_wix':
                Model = BetResultTrxWix;
                break;
            default:
                throw new Error(`Unsupported game type: ${gameType}`);
        }
        
        // For TRX_WIX, add duration filter if available
        if (mappedGameType === 'trx_wix' && duration) {
            try {
                // Try to check if duration column exists
                const columns = await sequelize.query(
                    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
                     WHERE TABLE_NAME = 'bet_result_trx_wix' AND COLUMN_NAME = 'duration'`,
                    { type: sequelize.QueryTypes.SELECT }
                );
                
                if (columns.length > 0) {
                    finalWhereCondition.duration = duration;
                    logger.info('Added duration filter for TRX_WIX', { duration });
                }
            } catch (error) {
                logger.warn('Error checking for duration column in TRX_WIX', { error: error.message });
                // Proceed without duration filter
            }
        }
        
        // Query for results with explicit ordering by created_at DESC
        const results = await Model.findAll({
            where: finalWhereCondition,
            order: [['created_at', 'DESC']], // Always sort newest first
            limit: limit,
            offset: offset
        });
        
        // Check if we got results
        if (results.length === 0) {
            logger.info('No results found for query', {
                gameType: mappedGameType,
                duration,
                whereCondition: finalWhereCondition
            });
        } else {
            logger.info(`Found ${results.length} results for ${mappedGameType}`);
        }

        // Get total count for pagination
        const totalCount = await Model.count({
            where: finalWhereCondition
        });

        // Format results based on game type
        const formattedResults = results.map(result => {
            try {
                switch(mappedGameType) {
                    case 'wingo':
                        return {
                            periodId: result.bet_number,
                            result: {
                                number: result.result_of_number,
                                color: result.result_of_color,
                                size: result.result_of_size
                            },
                            createdAt: result.created_at,
                            duration: result.time,
                            gameType: 'wingo'
                        };
                        
            case 'fiveD':
                        return {
                            periodId: result.bet_number,
                            result: {
                                A: result.result_a,
                                B: result.result_b,
                                C: result.result_c,
                                D: result.result_d,
                                E: result.result_e,
                                sum: result.total_sum
                            },
                            createdAt: result.created_at,
                            duration: result.time,
                            gameType: 'fiveD'
                        };
                        
            case 'k3':
                        return {
                            periodId: result.bet_number,
                            result: {
                                dice_1: result.dice_1,
                                dice_2: result.dice_2,
                                dice_3: result.dice_3,
                                sum: result.sum,
                                has_pair: result.has_pair,
                                has_triple: result.has_triple,
                                is_straight: result.is_straight,
                                sum_size: result.sum_size,
                                sum_parity: result.sum_parity
                            },
                            createdAt: result.created_at,
                            duration: result.time,
                            gameType: 'k3'
                        };
                        
                    case 'trx_wix':
                        // Parse result if it's stored as a string
                        let resultData;
                        try {
                            resultData = typeof result.result === 'string' 
                                ? JSON.parse(result.result) 
                                : result.result;
                                
                            // Handle null or undefined result
                            if (!resultData) {
                                resultData = { number: 0, color: 'red', size: 'Small' };
                                logger.warn('Null or undefined result data for TRX_WIX', {
                                    periodId: result.period
                                });
                            }
                        } catch (err) {
                            logger.error('Error parsing result data for TRX_WIX', {
                                error: err.message,
                                result: result.result,
                                periodId: result.period
                            });
                            resultData = { number: 0, color: 'red', size: 'Small' };
                        }
                        
                        return {
            periodId: result.period,
                            result: resultData,
                            verification: {
                                hash: result.verification_hash || '',
                                link: result.verification_link || ''
                            },
            createdAt: result.created_at,
                            duration: result.duration || duration, // Use duration from DB if available
                            gameType: 'trx_wix'
                        };
                        
                    default:
                        // Generic fallback format
        return {
                            periodId: result.bet_number || result.period,
                            result: result.result || {
                                number: result.result_of_number || 0,
                                color: result.result_of_color || 'red',
                                size: result.result_of_size || 'Small'
                            },
                            createdAt: result.created_at,
                            duration: result.time || result.duration || duration,
                            gameType: mappedGameType
                        };
                }
            } catch (err) {
                logger.error('Error formatting result', {
                    error: err.message,
                    stack: err.stack,
                    gameType: mappedGameType,
                    resultId: result.id || result.bet_id || result.result_id
                });
                
                // Return a safe default value
                return {
                    periodId: result.bet_number || result.period || 'unknown',
                    result: { error: 'Error formatting result' },
                    createdAt: result.created_at || new Date(),
                    duration: duration,
                    gameType: mappedGameType
                };
            }
        });

        // Double-check sort order is newest first (by createdAt)
        formattedResults.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        // Log success
        logger.info('Game history retrieved successfully', {
            gameType: mappedGameType,
            count: formattedResults.length,
            duration,
            firstPeriodId: formattedResults[0]?.periodId || 'none'
        });

        return {
            success: true,
            results: formattedResults,
            pagination: {
                total: totalCount,
                limit,
                offset,
                pages: Math.ceil(totalCount / limit)
            },
            gameType: mappedGameType,
            duration
        };

    } catch (error) {
        logger.error('Error getting game history', {
            error: error.message,
            stack: error.stack,
            gameType,
            duration
        });
        
        return {
            success: false,
            message: error.message,
            results: [],
            pagination: {
                total: 0,
                limit,
                offset,
                pages: 0
            }
        };
    }
};

/**
 * Process game results for a period
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 * @param {string} periodId - Period ID
 * @returns {Object} - Processing result
 */
const processGameResults = async (gameType, duration, periodId) => {
    let t;
    try {
        logger.info('Processing game results', { gameType, duration, periodId });
        
        // Check if results already processed
        const durationKey = duration === 30 ? '30s' : 
                          duration === 60 ? '1m' : 
                          duration === 180 ? '3m' : 
                          duration === 300 ? '5m' : '10m';
        
        const resultKey = `${gameType}:${durationKey}:${periodId}:result`;
        const resultExists = await redisClient.exists(resultKey);
        
        if (resultExists) {
            // Results already processed
            const resultStr = await redisClient.get(resultKey);
            const result = JSON.parse(resultStr);
            
            logger.info('Results already processed', { 
                gameType, 
                duration, 
                periodId,
                result 
            });
            
            return {
                success: true,
                result,
                message: 'Results already processed'
            };
        }
        
        // Start a transaction
        t = await sequelize.transaction();
        
        // Check if there are any bets for this period
        const periodHasBets = await hasBets(gameType, duration, periodId);
        
        let result;
        
        if (periodHasBets) {
            // If there are bets, calculate optimized result
            logger.info('Period has bets, calculating optimized result', { 
                gameType, 
                duration, 
                periodId 
            });
            
            const calculatedResult = await calculateResultWithVerification(gameType, duration, periodId);
            
            if (calculatedResult.success) {
                result = calculatedResult.result;
            } else {
                // If result calculation fails, generate a random result
                logger.warn('Result calculation failed, using random result', { 
                    gameType, 
                    duration, 
                    periodId,
                    error: calculatedResult.message 
                });
                
                result = generateRandomResult(gameType);
            }
        } else {
            // If no bets, generate a random result
            logger.info('No bets for period, using random result', { 
                gameType, 
                duration, 
                periodId 
            });
            
            result = generateRandomResult(gameType);
        }
        
        // Store result in database based on game type
        let resultModel;
        let resultData = {};
        
        switch (gameType) {
            case 'wingo':
                resultModel = BetResultWingo;
                resultData = {
                    bet_number: periodId,
                    result_of_number: result.number,
                    result_of_size: result.size,
                    result_of_color: result.color,
                    duration: duration,
                    timeline: duration === 30 ? '30s' : 
                             duration === 60 ? '1m' : 
                             duration === 180 ? '3m' : 
                             duration === 300 ? '5m' : 'default'
                };
                break;
                
            case 'fiveD':
                resultModel = BetResult5D;
                resultData = {
                    bet_number: periodId,
                    result_of_numbers: JSON.stringify(result.numbers),
                    result_of_sum: result.sum,
                    result_of_dragon_tiger: result.dragonTiger,
                    time: duration
                };
                break;
                
            case 'k3':
                resultModel = BetResultK3;
                resultData = {
                    bet_number: periodId,
                    result_of_numbers: JSON.stringify(result.numbers),
                    result_of_sum: result.sum,
                    result_of_type: result.type,
                    time: duration
                };
                break;
                
            case 'trx_wix':
                resultModel = BetResultTrxWix;
                resultData = {
                    bet_number: periodId,
                    result_of_hash: result.hash,
                    result_of_number: result.number,
                    result_of_color: result.color,
                    time: duration
                };
                break;
                
            default:
                throw new Error(`Invalid game type: ${gameType}`);
        }
        
        // Save result to database
        const savedResult = await resultModel.create(resultData, { transaction: t });
        
        // Process winning bets if there are any
        if (periodHasBets) {
            await processWinningBets(gameType, duration, periodId, result, t);
        }
        
        // Store result in Redis
        await redisClient.set(resultKey, JSON.stringify(result), 'EX', 86400); // Expire after 24 hours
        
        // Commit transaction
        await t.commit();
        
        // Update game history in Redis
        await updateGameHistory(gameType, duration, periodId, result);
        
        logger.info('Results processed successfully', { 
            gameType, 
            duration, 
            periodId,
            result 
        });
        
        return {
            success: true,
            result,
            message: 'Results processed successfully'
        };
    } catch (error) {
        // Rollback transaction if it exists
        if (t) {
            await t.rollback();
        }
        
        logger.error('Error processing game results', {
            error: error.message,
            stack: error.stack,
            gameType,
            duration,
            periodId
        });
        
        return {
            success: false,
            message: 'Failed to process game results',
            error: error.message
        };
    }
};

/**
 * Process winning bets for a period
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 * @param {string} periodId - Period ID
 * @param {Object} result - Game result
 * @returns {Array} - Array of winning bets
 */
const processWinningBets = async (gameType, duration, periodId, result, t) => {
    try {
        let winningBets = [];

            // Get all bets for this period
            let bets;
            switch (gameType) {
                case 'trx_wix':
                    bets = await BetRecordWingo.findAll({
                        where: { period: periodId },
                        transaction: t
                    });
                    break;
                case 'fiveD':
                    bets = await BetRecord5D.findAll({
                        where: { period: periodId },
                        transaction: t
                    });
                    break;
                case 'k3':
                    bets = await BetRecordK3.findAll({
                        where: { period: periodId },
                        transaction: t
                    });
                    break;
            }

            // Process each bet
            for (const bet of bets) {
                const isWinner = checkBetWin(bet, result, gameType);
                if (isWinner) {
                    // Calculate winnings
                    const winnings = calculateWinnings(bet, gameType);
                    
                    // Update user balance
                    await User.increment('wallet_balance', {
                        by: winnings,
                        where: { user_id: bet.user_id },
                        transaction: t
                    });

                    // Update bet status
                    await bet.update({
                        status: 'won',
                        payout: winnings
                    }, { transaction: t });

                    winningBets.push({
                        userId: bet.user_id,
                        betId: bet.bet_id,
                        winnings,
                        betAmount: bet.bet_amount
                    });
                } else {
                    // Mark bet as lost
                    await bet.update({
                        status: 'lost',
                        payout: 0
                    }, { transaction: t });
                }
            }

            return winningBets;

    } catch (error) {
        logger.error('Error processing winning bets', {
            error: error.message,
            stack: error.stack,
            gameType,
            periodId
        });
        return [];
    }
};

/**
 * Check if a bet is a winner
 * @param {Object} bet - Bet record
 * @param {Object} result - Game result
 * @param {string} gameType - Game type
 * @returns {boolean} - Whether bet is a winner
 */
const checkBetWin = (bet, result, gameType) => {
    const [betType, betValue] = bet.bet_type.split(':');
    
    switch (gameType) {
        case 'trx_wix':
            if (betType === 'NUMBER') {
                return result.number === parseInt(betValue);
            } else if (betType === 'COLOR') {
                return result.color.toLowerCase() === betValue.toLowerCase();
            } else if (betType === 'SIZE') {
                return result.size.toLowerCase() === betValue.toLowerCase();
            } else if (betType === 'PARITY') {
                const isEven = result.number % 2 === 0;
                return (isEven && betValue === 'even') || (!isEven && betValue === 'odd');
            }
            break;
            
        case 'fiveD':
            if (betType === 'POSITION') {
                const [pos, value] = betValue.split('_');
                return result[pos] === parseInt(value);
            } else if (betType === 'SUM') {
                const sum = result.A + result.B + result.C + result.D + result.E;
                return sum === parseInt(betValue);
            }
            break;
            
        case 'k3':
            if (betType === 'SUM') {
                const sum = result.dice_1 + result.dice_2 + result.dice_3;
                return sum === parseInt(betValue);
            } else if (betType === 'MATCHING_DICE') {
                const dice = [result.dice_1, result.dice_2, result.dice_3];
                const counts = dice.reduce((acc, val) => {
                    acc[val] = (acc[val] || 0) + 1;
                    return acc;
                }, {});
                
                if (betValue === 'triplet') {
                    return Object.values(counts).includes(3);
                } else if (betValue === 'pair') {
                    return Object.values(counts).includes(2);
                }
            }
            break;
    }
    
    return false;
};

/**
 * Calculate winnings for a winning bet
 * @param {Object} bet - Bet record
 * @param {string} gameType - Game type
 * @returns {number} - Winnings amount
 */
const calculateWinnings = (bet, gameType) => {
    const odds = bet.odds || calculateOdds(gameType, bet.bet_type.split(':')[0], bet.bet_type.split(':')[1]);
    return bet.bet_amount * odds;
};

/**
 * Get the last result for a game type
 * @param {string} gameType - Game type (wingo, fiveD, k3, trx_wix)
 * @param {number} duration - Duration in seconds (optional)
 * @returns {Object} - The last game result
 */
const getLastResult = async (gameType, duration = null) => {
  try {
    let result;
    const whereClause = duration ? { duration: duration } : {};

    switch (gameType) {
      case 'wingo':
        result = await BetResultWingo.findOne({
          where: whereClause,
          order: [['created_at', 'DESC']] // Order by created_at DESC
        });
        if (result) {
          return {
            success: true,
            result: {
              periodId: result.bet_number,
              result: {
                number: result.result_of_number,
                color: result.result_of_color,
                size: result.result_of_size
              },
              createdAt: result.created_at,
              duration: result.duration,
              timeline: result.timeline,
              gameType
            }
          };
        }
        break;
      
      case 'fiveD':
        result = await BetResult5D.findOne({
          where: whereClause,
          order: [['created_at', 'DESC']] // Order by created_at DESC
        });
        if (result) {
          return {
            success: true,
            result: {
              periodId: result.bet_number,
              result: {
                A: result.result_a,
                B: result.result_b,
                C: result.result_c,
                D: result.result_d,
                E: result.result_e,
                sum: result.total_sum
              },
              createdAt: result.created_at,
              duration: result.duration,
              gameType
            }
          };
        }
        break;
      
      case 'k3':
        result = await BetResultK3.findOne({
          where: whereClause,
          order: [['created_at', 'DESC']] // Order by created_at DESC
        });
        if (result) {
          return {
            success: true,
            result: {
              periodId: result.bet_number,
              result: {
                dice_1: result.dice_1,
                dice_2: result.dice_2,
                dice_3: result.dice_3,
                sum: result.sum,
                has_pair: result.has_pair,
                has_triple: result.has_triple,
                is_straight: result.is_straight,
                sum_size: result.sum_size,
                sum_parity: result.sum_parity
              },
              createdAt: result.created_at,
              duration: result.time,
              gameType
            }
          };
        }
        break;
      
      case 'trx_wix':
        result = await BetResultTrxWix.findOne({
          order: [['created_at', 'DESC']] // Order by created_at DESC
        });
        if (result) {
          let resultData;
          try {
            // Try to parse the result if it's stored as a string
            resultData = typeof result.result === 'string' ? JSON.parse(result.result) : result.result;
          } catch (err) {
            console.error('Error parsing result data:', err);
            resultData = result.result || { number: 0, color: 'red', size: 'Small' };
          }
          
          return {
            success: true,
            result: {
              periodId: result.period,
              result: resultData,
              verification: {
                hash: result.verification_hash,
                link: result.verification_link
              },
              createdAt: result.created_at,
              gameType
            }
          };
        }
        break;
    }

    return {
      success: false,
      message: 'No results found'
    };
  } catch (error) {
    console.error('Error getting last result:', error);
    return {
      success: false,
      message: 'Error retrieving last result',
      error: error.message
    };
  }
};

/**
 * Clean up old Redis data to prevent memory issues
 * @param {boolean} aggressive - Whether to perform aggressive cleanup
 * @returns {Object} - Cleanup summary
 */
const cleanupRedisData = async (aggressive = false) => {
  const summary = {
    cleaned: 0,
    errors: 0,
    skipped: 0
  };

  try {
    console.log('Starting Redis cleanup process...');
    
    // Game types and durations to check
    const gameTypes = ['wingo', 'fiveD', 'k3', 'trx_wix'];
    const durations = ['30s', '1m', '3m', '5m', '10m'];
    
    // Get the current date
    const now = new Date();
    const yesterday = new Date(now.getTime() - (24 * 60 * 60 * 1000));
    const threeDaysAgo = new Date(now.getTime() - (3 * 24 * 60 * 60 * 1000));
    
    // Convert to YYYYMMDD format for period ID matching
    const yesterdayStr = yesterday.toISOString().slice(0, 10).replace(/-/g, '');
    const threeDaysAgoStr = threeDaysAgo.toISOString().slice(0, 10).replace(/-/g, '');
    
    // Iterate through each game type and duration
    for (const gameType of gameTypes) {
      for (const duration of durations) {
        try {
          // 1. Clean up result data older than yesterday (or 3 days ago for aggressive mode)
          const compareDate = aggressive ? threeDaysAgoStr : yesterdayStr;
          
          // Find all result keys
          const resultKeys = await redisClient.keys(`${gameType}:${duration}:*:result`);
          
          for (const key of resultKeys) {
            // Extract periodId from key
            const keyParts = key.split(':');
            const periodId = keyParts[keyParts.length - 2];
            
            // If period date is older than our threshold, delete it
            if (periodId && periodId.startsWith('20') && periodId.slice(0, 8) < compareDate) {
              await redisClient.del(key);
              summary.cleaned++;
            }
          }
          
          // 2. Clean up bet tracking data (always aggressive)
          const betKeys = await redisClient.keys(`${gameType}:${duration}:*:total`);
          for (const key of betKeys) {
            const keyParts = key.split(':');
            const periodId = keyParts[2];
            
            // If period is older than yesterday, remove it
            if (periodId && periodId.startsWith('20') && periodId.slice(0, 8) < yesterdayStr) {
              await redisClient.del(key);
              
              // Also remove related keys
              const relatedPrefix = `${gameType}:${duration}:${periodId}`;
              const relatedKeys = await redisClient.keys(`${relatedPrefix}:*`);
              
              for (const relatedKey of relatedKeys) {
                await redisClient.del(relatedKey);
                summary.cleaned++;
              }
            }
          }
          
          // 3. Only keep last 10 periods in recent_results list
          const recentResultsKey = `${gameType}:${duration}:recent_results`;
          await redisClient.zremrangebyrank(recentResultsKey, 0, -11);
          
          // 4. Only keep last 20 tracked periods
          const trackedPeriodsKey = `${gameType}:${duration}:tracked_periods`;
          await redisClient.zremrangebyrank(trackedPeriodsKey, 0, -21);
        } catch (err) {
          console.error(`Error cleaning Redis data for ${gameType}:${duration}:`, err);
          summary.errors++;
        }
      }
    }
    
    console.log('Redis cleanup completed:', summary);
    return summary;
  } catch (error) {
    console.error('Error in Redis cleanup:', error);
    summary.errors++;
    return summary;
  }
};

// Add these functions near line 600 after the generateRandomResult function

/**
 * Check if betting is frozen for the current period
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 * @param {string} periodId - Period ID
 * @returns {boolean} - Whether betting is frozen
 */
const isBettingFrozen = async (gameType, duration, periodId) => {
    try {
        // Get period end time
        const endTime = calculatePeriodEndTime(periodId, duration);
        const now = new Date();
        
        // Calculate time remaining in seconds
        const timeRemaining = Math.max(0, (endTime - now) / 1000);
        
        // Betting is frozen in the last 5 seconds
        return timeRemaining <= 5;
    } catch (error) {
        logger.error('Error checking if betting is frozen', {
            error: error.message,
            stack: error.stack,
            gameType,
            duration,
            periodId
        });
        
        // Default to frozen in case of error
    return true;
    }
};

/**
 * Check if there are any bets for the current period
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 * @param {string} periodId - Period ID
 * @returns {boolean} - Whether there are any bets
 */
const hasBets = async (gameType, duration, periodId) => {
    try {
        // Get duration key for Redis
        const durationKey = duration === 30 ? '30s' : 
                          duration === 60 ? '1m' : 
                          duration === 180 ? '3m' : 
                          duration === 300 ? '5m' : '10m';
        
        // Create Redis key for bets
        const betsKey = `${gameType}:${durationKey}:${periodId}:bets`;
        
        // Get bets from Redis
        const betsStr = await redisClient.get(betsKey);
        
        if (!betsStr) {
            return false;
        }
        
        const bets = JSON.parse(betsStr);
        
        return bets.length > 0;
  } catch (error) {
        logger.error('Error checking if period has bets', {
            error: error.message,
            stack: error.stack,
            gameType,
            duration,
            periodId
        });
        
    return false;
  }
};

/**
 * Update game history in Redis
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 * @param {string} periodId - Period ID
 * @param {Object} result - Game result
 */
const updateGameHistory = async (gameType, duration, periodId, result) => {
    try {
        // Get duration key for Redis
        const durationKey = duration === 30 ? '30s' : 
                          duration === 60 ? '1m' : 
                          duration === 180 ? '3m' : 
                          duration === 300 ? '5m' : '10m';
        
        // Create Redis key for history
        const historyKey = `${gameType}:${durationKey}:history`;
        
        // Get current history
        let history = await redisClient.get(historyKey);
        
        if (!history) {
            history = '[]';
        }
        
        const historyData = JSON.parse(history);
        
        // Add new result to history
        const historyItem = {
            periodId,
            result,
            timestamp: new Date().toISOString()
        };
        
        // Add to the beginning of the array
        historyData.unshift(historyItem);
        
        // Limit to 100 items
        if (historyData.length > 100) {
            historyData.pop();
        }
        
        // Save updated history
        await redisClient.set(historyKey, JSON.stringify(historyData), 'EX', 86400); // Expire after 24 hours
    } catch (error) {
        logger.error('Error updating game history', {
            error: error.message,
            stack: error.stack,
            gameType,
            duration,
            periodId
        });
    }
};

module.exports = {
    validate60_40Result,
    shouldUseMinimumBetResult,
    getMinimumBetResult,
    calculateOptimizedResult,
    validateFallbackResult,
    generateFallbackResult,
    generateRandomResult,
    generateAllPossibleResults,
    calculateExpectedPayout,
    storeBetInRedis,
    processBet,
    calculateOdds,
    getActivePeriods,
    storeTemporaryResult,
    storeHourlyMinimumCombinations,
    getHourlyMinimumCombinations,
    trackBetCombinations,
    startPeriodTracking,
    getPreCalculatedResults,
    logSuspiciousActivity,
    validateBet,
    getUserBetCount,
    getLastBetTime,
    getTotalBetsOnOutcome,
    getAllMinimumCombinations,
    calculateResultWithVerification,
    endRound,
    overrideResult,
    getBetDistribution,
    getGameHistory,
    processGameResults,
    processWinningBets,
    checkBetWin,
    calculateWinnings,
    getLastResult,
    cleanupRedisData,
    isBettingFrozen,
    hasBets,
    updateGameHistory
};