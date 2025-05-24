// Backend/services/gameLogicService.js
const { sequelize, DataTypes } = require('../config/db');
const models = require('../models');
const redisClient = require('../config/redis');
const periodService = require('./periodService');
const tronHashService = require('./tronHashService');
const winston = require('winston');
const path = require('path');
const logger = require('../utils/logger');

// Configure Winston logger for game results
const gameResultsLogger = winston.createLogger({
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

// Get models
const {
    BetResultWingo,
    BetResult5D,
    BetResultK3,
    BetResultTrxWix,
    BetRecordWingo,
    BetRecord5D,
    BetRecordK3,
    BetRecordTrxWix,
    GamePeriod,
} = models;

const { v4: uuidv4 } = require('uuid');
const referralService = require('./referralService');

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
        console.log('\n=== CALCULATING OPTIMIZED RESULT ===');
        console.log(`Game Type: ${gameType}`);
        console.log(`Duration: ${duration}s`);
        console.log(`Period ID: ${periodId}`);
        
        const durationKey = duration === 30 ? '30s' : 
                          duration === 60 ? '1m' : 
                          duration === 180 ? '3m' : 
                          duration === 300 ? '5m' : '10m';
        
        // Get total bet amount for this period
        const totalBetAmount = parseFloat(
            await redisClient.get(`${gameType}:${durationKey}:${periodId}:total`) || 0
        );
        
        console.log(`Total bet amount: ${totalBetAmount}`);
      
        // Generate result based on game type
        let gameResult;
        console.log('\n--- Generating Result ---');
        switch (gameType.toLowerCase()) {
            case 'wingo':
            case 'trx_wix':
                gameResult = {
                    number: Math.floor(Math.random() * 10),
                    color: ['red', 'green', 'violet', 'green_violet'][Math.floor(Math.random() * 4)],
                    size: Math.random() >= 0.5 ? 'Big' : 'Small'
                };
                console.log('Generated Wingo/TrxWix result:', JSON.stringify(gameResult, null, 2));
                break;
            case 'fived':
            case '5d':
                const numbers = Array(5).fill(0).map(() => Math.floor(Math.random() * 10));
                gameResult = {
                    A: numbers[0],
                    B: numbers[1],
                    C: numbers[2],
                    D: numbers[3],
                    E: numbers[4],
                    sum: numbers.reduce((a, b) => a + b, 0),
                    time: duration
                };
                console.log('Generated FiveD result:', JSON.stringify(gameResult, null, 2));
                break;
            case 'k3':
                const dice = Array(3).fill(0).map(() => Math.floor(Math.random() * 6) + 1);
                const sum = dice.reduce((a, b) => a + b, 0);
                gameResult = {
                    dice_1: dice[0],
                    dice_2: dice[1],
                    dice_3: dice[2],
                    sum: sum,
                    has_pair: new Set(dice).size === 2,
                    has_triple: new Set(dice).size === 1,
                    is_straight: new Set(dice).size === 3 && Math.max(...dice) - Math.min(...dice) === 2,
                    sum_size: sum >= 11 ? 'Big' : 'Small',
                    sum_parity: sum % 2 === 0 ? 'Even' : 'Odd',
                    time: duration
                };
                console.log('Generated K3 result:', JSON.stringify(gameResult, null, 2));
                break;
            default:
                throw new Error(`Invalid game type: ${gameType}`);
        }

        console.log('\n=== RESULT CALCULATION COMPLETED ===\n');
        return gameResult;
    } catch (error) {
        console.error('\n=== RESULT CALCULATION FAILED ===');
        console.error('Error details:', error.message);
        console.error('Stack trace:', error.stack);
        throw error;
    }
};

/**
 * Validate fallback result for safety
 * @param {Object} result - Result object
 * @param {string} gameType - Game type
 * @returns {Object} - Validation result
 */
const validateFallbackResult = async (result, gameType) => {
    const warnings = [];
    
    if (!result) {
        return { isSafe: false, warnings: ['Result is null or undefined'] };
    }

    switch (gameType.toLowerCase()) {
        case 'wingo':
            if (typeof result.number !== 'number') {
                warnings.push('Invalid number in result');
            }
            if (!['big', 'small'].includes(result.size)) {
                warnings.push('Invalid size in result');
            }
            if (!['red', 'green'].includes(result.color)) {
                warnings.push('Invalid color in result');
            }
            break;
            
        case 'trx_wix':
            if (typeof result.number !== 'number') {
                warnings.push('Invalid number in result');
            }
            if (!['big', 'small'].includes(result.size)) {
                warnings.push('Invalid size in result');
            }
            if (!['red', 'green'].includes(result.color)) {
                warnings.push('Invalid color in result');
            }
            if (!result.verification?.hash) {
                warnings.push('Missing verification hash');
                }
                break;

        case 'fived':
        case '5d':
            if (!Array.isArray([result.A, result.B, result.C, result.D, result.E])) {
                warnings.push('Invalid dice results');
            }
            if (typeof result.sum !== 'number') {
                warnings.push('Invalid sum in result');
                }
                break;

            case 'k3':
            if (!Array.isArray([result.dice_1, result.dice_2, result.dice_3])) {
                warnings.push('Invalid dice results');
            }
            if (typeof result.sum !== 'number') {
                warnings.push('Invalid sum in result');
            }
            if (typeof result.has_pair !== 'boolean') {
                warnings.push('Invalid pair status');
            }
            if (typeof result.has_triple !== 'boolean') {
                warnings.push('Invalid triple status');
            }
            if (typeof result.is_straight !== 'boolean') {
                warnings.push('Invalid straight status');
                }
                break;
            
        default:
            warnings.push(`Unsupported game type: ${gameType}`);
    }

        return {
        isSafe: warnings.length === 0,
        warnings
        };
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
                        E: Math.floor((random2 + timestamp % 89) % 1 * 10),
                        sum: 0, // Will be calculated below
                        time: duration
                    };
                    // Calculate sum
                    randomResult.sum = randomResult.A + randomResult.B + randomResult.C + randomResult.D + randomResult.E;
                    break;
                    
                case 'k3':
                    const d1 = Math.floor(random1 * 6) + 1;
                    const d2 = Math.floor(random2 * 6) + 1;
                    const d3 = Math.floor(combinedRandom * 6) + 1;
                    const k3Sum = d1 + d2 + d3;
                    
                    // Check for pairs and triples
                    const k3DiceCounts = [d1, d2, d3].reduce((acc, val) => {
                        acc[val] = (acc[val] || 0) + 1;
                        return acc;
                    }, {});
                    
                    const k3HasPair = Object.values(k3DiceCounts).some(count => count === 2);
                    const k3HasTriple = Object.values(k3DiceCounts).some(count => count === 3);
                    
                    // Check for straight
                    const k3SortedDice = [d1, d2, d3].sort((a, b) => a - b);
                    const k3IsStraight = (
                        (k3SortedDice[0] === 1 && k3SortedDice[1] === 2 && k3SortedDice[2] === 3) ||
                        (k3SortedDice[0] === 2 && k3SortedDice[1] === 3 && k3SortedDice[2] === 4) ||
                        (k3SortedDice[0] === 3 && k3SortedDice[1] === 4 && k3SortedDice[2] === 5) ||
                        (k3SortedDice[0] === 4 && k3SortedDice[1] === 5 && k3SortedDice[2] === 6)
                    );
                    
                    randomResult = {
                        dice_1: d1,
                        dice_2: d2,
                        dice_3: d3,
                        sum: k3Sum,
                        has_pair: k3HasPair,
                        has_triple: k3HasTriple,
                        is_straight: k3IsStraight,
                        sum_size: k3Sum > 10.5 ? 'big' : 'small',
                        sum_parity: k3Sum % 2 === 0 ? 'even' : 'odd',
                        time: duration
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
 * @param {number} duration - Duration in seconds
 * @returns {Object} - Random result object
 */
const generateRandomResult = (gameType, duration) => {
  switch (gameType.toLowerCase()) {
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
      
    case 'fived':
    case '5d':
      const A = Math.floor(Math.random() * 10);
      const B = Math.floor(Math.random() * 10);
      const C = Math.floor(Math.random() * 10);
      const D = Math.floor(Math.random() * 10);
      const E = Math.floor(Math.random() * 10);
      const sum = A + B + C + D + E;
      
      return {
        A, B, C, D, E,
        sum,
        time: duration
      };
      
    case 'k3':
      const dice_1 = Math.floor(Math.random() * 6) + 1;
      const dice_2 = Math.floor(Math.random() * 6) + 1;
      const dice_3 = Math.floor(Math.random() * 6) + 1;
      const diceSum = dice_1 + dice_2 + dice_3;
      
      // Check for pairs and triples
      const diceCounts = [dice_1, dice_2, dice_3].reduce((acc, val) => {
        acc[val] = (acc[val] || 0) + 1;
        return acc;
      }, {});
      
      const has_pair = Object.values(diceCounts).some(count => count === 2);
      const has_triple = Object.values(diceCounts).some(count => count === 3);
      
      // Check for straight (1-2-3, 2-3-4, 3-4-5, 4-5-6)
      const sortedDice = [dice_1, dice_2, dice_3].sort((a, b) => a - b);
      const is_straight = (
        (sortedDice[0] === 1 && sortedDice[1] === 2 && sortedDice[2] === 3) ||
        (sortedDice[0] === 2 && sortedDice[1] === 3 && sortedDice[2] === 4) ||
        (sortedDice[0] === 3 && sortedDice[1] === 4 && sortedDice[2] === 5) ||
        (sortedDice[0] === 4 && sortedDice[1] === 5 && sortedDice[2] === 6)
      );
      
      return {
        dice_1,
        dice_2,
        dice_3,
        sum: diceSum,
        has_pair,
        has_triple,
        is_straight,
        sum_size: diceSum > 10.5 ? 'big' : 'small',
        sum_parity: diceSum % 2 === 0 ? 'even' : 'odd',
        time: duration
      };
      
    case 'trx_wix':
      const trxNumber = Math.floor(Math.random() * 10); // 0-9
      let trxColor = '';
      let trxSize = trxNumber >= 5 ? 'Big' : 'Small';
      
      // Determine color based on number
      if (trxNumber === 0) {
        trxColor = 'violet';
      } else if (trxNumber === 5) {
        trxColor = 'green_violet';
      } else if ([1, 3, 7, 9].includes(trxNumber)) {
        trxColor = 'green';
      } else {
        trxColor = 'red';
      }
      
      // Generate a random hash
      const hash = Math.random().toString(36).substring(2, 15);
      
      return {
        number: trxNumber,
        color: trxColor,
        size: trxSize,
        hash
      };
      
    default:
      throw new Error(`Invalid game type: ${gameType}`);
  }
};

/**
 * Generate all possible results for a game type
 * @param {string} gameType - Game type (wingo, fiveD, k3)
 * @returns {Array} - Array of all possible results
 */
const generateAllPossibleResults = async (gameType) => {
    switch (gameType.toLowerCase()) {
        case 'wingo':
      // For Wingo, there are 10 possible results (0-9)
            const wingoResults = [];
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
        
                wingoResults.push({ number: i, color, size });
            }
            return wingoResults;
            
        case 'trx_wix':
            // For Trx_wix, there are 10 possible results (0-9)
            const trxWixResults = [];
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
                
                // Generate a unique hash for each result
                const hash = Math.random().toString(36).substring(2, 15);
                
                trxWixResults.push({ number: i, color, size, hash });
            }
            return trxWixResults;
    
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
  
    switch (gameType.toLowerCase()) {
        case 'wingo':
            // Calculate number bets
            const wingoNumberBetAmount = parseFloat(
                await redisClient.get(`wingo:${durationKey}:${periodId}:number:${result.number}`) || 0
            );
            totalPayout += wingoNumberBetAmount * 9; // 9x multiplier for number bets
            
            // Calculate color bets
            const wingoColorBetAmount = parseFloat(
                await redisClient.get(`wingo:${durationKey}:${periodId}:color:${result.color}`) || 0
            );
            
            // Different multipliers based on color
            let wingoColorMultiplier = 2; // Default for red/green
            if (result.color === 'violet') {
                wingoColorMultiplier = 4.5;
            } else if (result.color === 'green_violet' || result.color === 'red_violet') {
                wingoColorMultiplier = 2;
            }
            
            totalPayout += wingoColorBetAmount * wingoColorMultiplier;
            
            // Calculate size bets
            const wingoSizeBetAmount = parseFloat(
                await redisClient.get(`wingo:${durationKey}:${periodId}:size:${result.size.toLowerCase()}`) || 0
            );
            totalPayout += wingoSizeBetAmount * 2; // 2x for big/small
            
            // Calculate odd/even bets
            const wingoParity = result.number % 2 === 0 ? 'even' : 'odd';
            const wingoParityBetAmount = parseFloat(
                await redisClient.get(`wingo:${durationKey}:${periodId}:parity:${wingoParity}`) || 0
            );
            totalPayout += wingoParityBetAmount * 2; // 2x for odd/even
            break;
            
    case 'trx_wix':
      // Calculate number bets
            const trxWixNumberBetAmount = parseFloat(
        await redisClient.get(`trx_wix:${durationKey}:${periodId}:number:${result.number}`) || 0
      );
            totalPayout += trxWixNumberBetAmount * 9; // 9x multiplier for number bets
      
      // Calculate color bets
            const trxWixColorBetAmount = parseFloat(
        await redisClient.get(`trx_wix:${durationKey}:${periodId}:color:${result.color}`) || 0
      );
      
      // Different multipliers based on color
            let trxWixColorMultiplier = 2; // Default for red/green
      if (result.color === 'violet') {
                trxWixColorMultiplier = 4.5;
      } else if (result.color === 'green_violet' || result.color === 'red_violet') {
                trxWixColorMultiplier = 2;
      }
      
            totalPayout += trxWixColorBetAmount * trxWixColorMultiplier;
      
      // Calculate size bets
            const trxWixSizeBetAmount = parseFloat(
        await redisClient.get(`trx_wix:${durationKey}:${periodId}:size:${result.size.toLowerCase()}`) || 0
      );
            totalPayout += trxWixSizeBetAmount * 2; // 2x for big/small
      
      // Calculate odd/even bets
            const trxWixParity = result.number % 2 === 0 ? 'even' : 'odd';
            const trxWixParityBetAmount = parseFloat(
                await redisClient.get(`trx_wix:${durationKey}:${periodId}:parity:${trxWixParity}`) || 0
            );
            totalPayout += trxWixParityBetAmount * 2; // 2x for odd/even
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
                betCount = await BetRecordTrxWix.count({
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
                lastBet = await BetRecordTrxWix.findOne({
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
            logger.warn('Error calculating optimized result, using fallback', {
                error: calcError.message,
                gameType,
                duration,
                periodId
            });
            
            // Fall back to generating a result directly based on game type
            result = generateRandomResult(gameType);
        }
        
        // Extract the actual result from the optimization result
        let gameResult;
        if (result && result.optimalResult && result.optimalResult.result) {
            gameResult = result.optimalResult.result;
        } else if (result && result.result) {
            gameResult = result.result;
        } else {
            // Create a default game result if everything else fails
            gameResult = generateRandomResult(gameType);
        }
        
        // Ensure result has required fields based on game type
        switch (gameType.toLowerCase()) {
                case 'wingo':
                case 'trx_wix':
                if (!gameResult.number || !gameResult.color || !gameResult.size) {
                    gameResult = {
                        number: gameResult.number || Math.floor(Math.random() * 10),
                        color: gameResult.color || ['red', 'green', 'violet', 'green_violet'][Math.floor(Math.random() * 4)],
                        size: gameResult.size || (gameResult.number >= 5 ? 'Big' : 'Small')
                    };
                }
                    break;
            case 'fived':
            case '5d':
                if (!gameResult.A || !gameResult.B || !gameResult.C || !gameResult.D || !gameResult.E) {
                    const numbers = Array(5).fill(0).map(() => Math.floor(Math.random() * 10));
                    gameResult = {
                        A: numbers[0],
                        B: numbers[1],
                        C: numbers[2],
                        D: numbers[3],
                        E: numbers[4],
                        sum: numbers.reduce((a, b) => a + b, 0),
                        time: duration
                    };
                }
                    break;
                case 'k3':
                if (!gameResult.dice_1 || !gameResult.dice_2 || !gameResult.dice_3) {
                    const dice = Array(3).fill(0).map(() => Math.floor(Math.random() * 6) + 1);
                    const sum = dice.reduce((a, b) => a + b, 0);
                    gameResult = { 
                        dice_1: dice[0],
                        dice_2: dice[1],
                        dice_3: dice[2],
                        sum: sum,
                        has_pair: new Set(dice).size === 2,
                        has_triple: new Set(dice).size === 1,
                        is_straight: new Set(dice).size === 3 && Math.max(...dice) - Math.min(...dice) === 2,
                        sum_size: sum >= 11 ? 'Big' : 'Small',
                        sum_parity: sum % 2 === 0 ? 'Even' : 'Odd',
                        time: duration
                    };
                }
                    break;
        }
        
        // Get verification hash for the result
        let numberForVerification;
        switch (gameType.toLowerCase()) {
            case 'wingo':
            case 'trx_wix':
            numberForVerification = gameResult.number;
                break;
            case 'fived':
            case '5d':
            numberForVerification = gameResult.sum % 10; // Use last digit of sum
                break;
            case 'k3':
            numberForVerification = gameResult.sum % 10; // Use last digit of sum
                break;
            default:
                throw new Error(`Invalid game type: ${gameType}`);
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
        logger.error('Error calculating result with verification', {
            error: error.message,
            stack: error.stack,
            gameType,
            duration,
            periodId
        });
        
        // As a last resort, return a simple valid result based on game type
        const defaultResult = generateRandomResult(gameType);
        
        return {
            success: false,
            message: error.message,
            result: defaultResult
        };
    }
};

/**
 * End a game round and process results
 * @param {string} gameType - Game type (wingo, fiveD, k3, trx_wix)
 * @param {number} duration - Duration in seconds
 * @param {string} periodId - Period ID
 * @returns {Object} - Result with verification and winners
 */
const endRound = async (gameType, duration, periodId) => {
    try {
        // Input validation
        if (!gameType || !['wingo', 'fiveD', 'k3', 'trx_wix'].includes(gameType.toLowerCase())) {
            throw new Error('Invalid game type');
        }
        if (!duration || ![30, 60, 180, 300, 600].includes(parseInt(duration))) {
            throw new Error('Invalid duration');
        }
        if (!periodId) {
            throw new Error('Period ID is required');
        }

        // Log the start of round ending
        logger.info('Ending round', {
            gameType,
            duration,
            periodId,
            timestamp: new Date().toISOString()
        });

        // Get the result with verification
        const resultWithVerification = await calculateResultWithVerification(gameType, duration, periodId);
        if (!resultWithVerification.success) {
            throw new Error('Failed to calculate result with verification');
        }

        // Process game results (save to database and update Redis)
        const processResult = await processGameResults(gameType, duration, periodId);
        if (!processResult.success) {
            throw new Error('Failed to process game results');
        }

        // Store the result with verification in Redis
        await storeTemporaryResult(gameType, duration, periodId, resultWithVerification);
        
        // Process winning bets
        const winners = await processWinningBets(gameType, duration, periodId, resultWithVerification.result);
        if (!winners) {
            throw new Error('Failed to process winning bets');
        }

        // Update game history
        await updateGameHistory(gameType, duration, periodId, resultWithVerification.result);
        
        // Start a new round
        await startRound(gameType, duration);

        // Log successful round ending
        logger.info('Round ended successfully', {
            gameType,
            duration,
            periodId,
            result: resultWithVerification.result,
            winnersCount: winners.length,
            timestamp: new Date().toISOString()
        });
        
        return {
            success: true,
            result: resultWithVerification.result,
            verification: {
                hash: resultWithVerification.hash,
                link: resultWithVerification.link
            },
            winners
        };
    } catch (error) {
        logger.error('Error ending round', {
            error: error.message,
            stack: error.stack,
            gameType,
            duration,
            periodId
        });
        return {
            success: false,
            message: error.message
        };
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

        // Get duration key for Redis
        const durationKey = duration === 30 ? '30s' : 
                          duration === 60 ? '1m' : 
                          duration === 180 ? '3m' : 
                          duration === 300 ? '5m' : '10m';
        
        // Create Redis keys
        const historyKey = `${gameType}:${durationKey}:history`;
        const recentResultsKey = `${gameType}:${durationKey}:recent_results`;
        
        // Try to get from Redis first
        let results = [];
        let totalCount = 0;
        
        try {
            // Get from sorted set (most recent first)
            const redisResults = await redisClient.zrevrange(recentResultsKey, offset, offset + limit - 1);
            results = redisResults.map(item => JSON.parse(item));
            
            // Get total count
            totalCount = await redisClient.zcard(recentResultsKey);
            
            logger.info('Retrieved results from Redis', {
                count: results.length,
                totalCount
            });
        } catch (redisError) {
            logger.warn('Error getting results from Redis, falling back to database', {
                error: redisError.message
            });
            
            // Fall back to database if Redis fails
        const durationValue = parseInt(duration);
        const whereCondition = { time: durationValue };
        
            // Special case for trx_wix which stores duration differently
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
        
            // Query for results
            results = await Model.findAll({
            where: finalWhereCondition,
                order: [['created_at', 'DESC']],
            limit: limit,
            offset: offset
        });
        
            // Get total count
            totalCount = await Model.count({
                where: finalWhereCondition
            });
            
            logger.info('Retrieved results from database', {
                count: results.length,
                totalCount
            });
        }
        
        // Format results
        const formattedResults = results.map(result => {
            if (result instanceof Model) {
                // Database result
                        return {
                            periodId: result.bet_number,
                            result: {
                        ...result.toJSON(),
                        created_at: result.created_at
                    },
                    timestamp: result.created_at
                };
            } else {
                // Redis result
                return result;
            }
        });

        return {
            success: true,
            data: {
            results: formattedResults,
            pagination: {
                total: totalCount,
                limit,
                offset,
                    hasMore: offset + limit < totalCount
                }
            }
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
            message: 'Failed to get game history',
            error: error.message
        };
    }
};

/**
 * Process game results for a period
 * @param {string} gameType - Game type (wingo, fiveD, k3, trx_wix)
 * @param {number} duration - Duration in seconds
 * @param {string} periodId - Period ID
 * @returns {Object} - Processing result
 */
const processGameResults = async (gameType, duration, periodId) => {
    logger.info('=== STARTING GAME RESULT PROCESSING ===', {
                gameType, 
                duration, 
                periodId,
        timestamp: new Date().toISOString()
    });
    
    const t = await sequelize.transaction();
    
    try {
        logger.info(`Processing game results for period ${periodId}`, {
                gameType, 
            duration
        });

        // Generate result based on game type
        const result = await calculateOptimizedResult(gameType, duration, periodId);
        logger.info(`Generated result for period ${periodId}`, { result });

        // Save result to appropriate table based on game type
        let savedResult;
        switch (gameType) {
            case 'wingo':
                savedResult = await BetResultWingo.create({
                    bet_number: periodId,
                    result_of_number: result.number,
                    result_of_size: result.size,
                    result_of_color: result.color,
                    duration: duration,
                    timeline: new Date().toISOString()
                }, { transaction: t });
                break;
            case 'fiveD':
                savedResult = await BetResult5D.create({
                    bet_number: periodId,
                    result_a: result.A,
                    result_b: result.B,
                    result_c: result.C,
                    result_d: result.D,
                    result_e: result.E,
                    total_sum: result.sum,
                    duration: duration,
                    timeline: new Date().toISOString()
                }, { transaction: t });
                break;
            case 'k3':
                savedResult = await BetResultK3.create({
                    bet_number: periodId,
                    dice_1: result.dice_1,
                    dice_2: result.dice_2,
                    dice_3: result.dice_3,
                    sum: result.sum,
                    has_pair: result.has_pair,
                    has_triple: result.has_triple,
                    is_straight: result.is_straight,
                    sum_size: result.sum_size,
                    sum_parity: result.sum_parity,
                    duration: duration,
                    timeline: new Date().toISOString()
                }, { transaction: t });
                break;
            case 'trx_wix':
                savedResult = await BetResultTrxWix.create({
                    period: periodId,
                    result: result.result,
                    verification_hash: result.verification?.hash || '',
                    verification_link: result.verification?.link || '',
                    duration: duration,
                    timeline: new Date().toISOString()
                }, { transaction: t });
                break;
            default:
                throw new Error(`Unsupported game type: ${gameType}`);
        }

        logger.info(`Saved result for period ${periodId}`, {
            resultId: savedResult.id,
            gameType
        });

        await t.commit();
        return savedResult;
    } catch (error) {
        logger.error(`Error processing game results for period ${periodId}`, {
            error: error.message,
            stack: error.stack,
            gameType
        });
        await t.rollback();
        throw error;
    }
};

/**
 * Process winning bets for a game period
 * @param {string} gameType - Game type (wingo, fiveD, k3, trx_wix)
 * @param {number} duration - Duration in seconds
 * @param {string} periodId - Period ID
 * @param {Object} result - Game result
 * @param {Object} t - Transaction object
 * @returns {Array} - Array of winning bets
 */
const processWinningBets = async (gameType, duration, periodId, result, t) => {
    try {
        let bets = [];
        const winningBets = [];

        // Get bets for the period based on game type
        switch (gameType.toLowerCase()) {
            case 'wingo':
                    bets = await BetRecordWingo.findAll({
                        where: { period: periodId },
                        transaction: t
                    });
                    break;
            case 'trx_wix':
                bets = await BetRecordTrxWix.findAll({
                    where: { period: periodId },
                    transaction: t
                });
                break;
            case 'fived':
            case '5d':
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
            default:
                throw new Error(`Unsupported game type: ${gameType}`);
            }

            // Process each bet
            for (const bet of bets) {
            try {
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
                        payout: winnings,
                        result: JSON.stringify(result)
                    }, { transaction: t });

                    winningBets.push({
                        userId: bet.user_id,
                        betId: bet.bet_id,
                        winnings,
                        betAmount: bet.bet_amount,
                        betType: bet.bet_type,
                        result: result
                    });

                    logger.info('Processed winning bet', {
                        userId: bet.user_id,
                        betId: bet.bet_id,
                        winnings,
                        betType: bet.bet_type,
                        gameType
                    });
                } else {
                    // Mark bet as lost
                    await bet.update({
                        status: 'lost',
                        payout: 0,
                        result: JSON.stringify(result)
                    }, { transaction: t });

                    logger.info('Processed losing bet', {
                        userId: bet.user_id,
                        betId: bet.bet_id,
                        betType: bet.bet_type,
                        gameType
                    });
                }
            } catch (betError) {
                logger.error('Error processing individual bet', {
                    error: betError.message,
                    betId: bet.bet_id,
                    userId: bet.user_id,
                    gameType
                });
                // Continue processing other bets
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
        throw error; // Re-throw to handle in transaction
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
    try {
    const [betType, betValue] = bet.bet_type.split(':');
    
        switch (gameType.toLowerCase()) {
            case 'wingo':
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
            
            case 'fived':
            case '5d':
            if (betType === 'POSITION') {
                const [pos, value] = betValue.split('_');
                return result[pos] === parseInt(value);
            } else if (betType === 'SUM') {
                const sum = result.A + result.B + result.C + result.D + result.E;
                return sum === parseInt(betValue);
                } else if (betType === 'DRAGON_TIGER') {
                    const sumA = result.A + result.B + result.C;
                    const sumB = result.D + result.E;
                    return (betValue === 'dragon' && sumA > sumB) || 
                           (betValue === 'tiger' && sumA < sumB) ||
                           (betValue === 'tie' && sumA === sumB);
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
                } else if (betType === 'STRAIGHT') {
                    const dice = [result.dice_1, result.dice_2, result.dice_3].sort();
                    return (dice[0] + 1 === dice[1] && dice[1] + 1 === dice[2]);
                } else if (betType === 'SIZE') {
                    const sum = result.dice_1 + result.dice_2 + result.dice_3;
                    return (betValue === 'big' && sum > 10) || (betValue === 'small' && sum <= 10);
                } else if (betType === 'PARITY') {
                    const sum = result.dice_1 + result.dice_2 + result.dice_3;
                    return (betValue === 'even' && sum % 2 === 0) || (betValue === 'odd' && sum % 2 === 1);
            }
            break;
    }
    
    return false;
    } catch (error) {
        logger.error('Error checking bet win', {
            error: error.message,
            betType: bet.bet_type,
            gameType
        });
        return false;
    }
};

/**
 * Calculate winnings for a winning bet
 * @param {Object} bet - Bet record
 * @param {string} gameType - Game type
 * @returns {number} - Winnings amount
 */
const calculateWinnings = (bet, gameType) => {
    try {
    const odds = bet.odds || calculateOdds(gameType, bet.bet_type.split(':')[0], bet.bet_type.split(':')[1]);
        const winnings = bet.bet_amount * odds;
        
        logger.info('Calculated winnings', {
            betId: bet.bet_id,
            betAmount: bet.bet_amount,
            odds,
            winnings,
            gameType
        });
        
        return winnings;
    } catch (error) {
        logger.error('Error calculating winnings', {
            error: error.message,
            betId: bet.bet_id,
            gameType
        });
        return 0;
    }
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

/**
 * Calculate the end time for a period
 * @param {string} periodId - Period ID
 * @param {number} duration - Duration in seconds
 * @returns {Date} - End time of the period
 */
const calculatePeriodEndTime = (periodId, duration) => {
    try {
        // Parse period ID to get start time
        // Format: YYYYMMDDHHMM-G-DURATION-NUMBER
        const [dateTime, gameType, durationStr, number] = periodId.split('-');
        
        // Parse date and time components
        const year = dateTime.substring(0, 4);
        const month = dateTime.substring(4, 6);
        const day = dateTime.substring(6, 8);
        const hour = dateTime.substring(8, 10);
        const minute = dateTime.substring(10, 12);
        
        // Create start time
        const startTime = new Date(`${year}-${month}-${day}T${hour}:${minute}:00Z`);
        
        // Add duration to get end time
        const endTime = new Date(startTime.getTime() + (duration * 1000));
        
        return endTime;
    } catch (error) {
        logger.error('Error calculating period end time', {
            error: error.message,
            stack: error.stack,
            periodId,
            duration
        });
        
        // Return current time + duration as fallback
        return new Date(Date.now() + (duration * 1000));
    }
};

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
        
        // Create Redis keys
        const historyKey = `${gameType}:${durationKey}:history`;
        const recentResultsKey = `${gameType}:${durationKey}:recent_results`;
        
        // Create history item
        const historyItem = {
            periodId,
            result,
            timestamp: new Date().toISOString()
        };
        
        // Add to sorted set with timestamp as score
        const score = Date.now();
        await redisClient.zadd(recentResultsKey, score, JSON.stringify(historyItem));
        
        // Keep only last 100 results
        await redisClient.zremrangebyrank(recentResultsKey, 0, -101);
        
        // Set expiry for 24 hours
        await redisClient.expire(recentResultsKey, 86400);
        
        // Also store in history list
        await redisClient.lpush(historyKey, JSON.stringify(historyItem));
        
        // Trim history list to 100 items
        await redisClient.ltrim(historyKey, 0, 99);
        
        // Set expiry for 24 hours
        await redisClient.expire(historyKey, 86400);
        
        logger.info('Game history updated', {
            gameType,
            duration,
            periodId,
            result
        });
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

function validateResultStructure(result, gameType) {
    const errors = [];

    // Common validations for all game types
    if (!result || typeof result !== 'object') {
        errors.push('Result must be an object');
        return errors;
    }

    // Game-specific validations
    switch (gameType) {
        case 'trx_wix':
            if (!result.size || !['Small', 'Big'].includes(result.size)) {
                errors.push('Invalid size in result');
            }
            if (!result.color || !['Red', 'Green'].includes(result.color)) {
                errors.push('Invalid color in result');
            }
            if (!result.verificationHash) {
                errors.push('Missing verification hash');
            }
            break;

        case 'wingo':
            if (!result.numbers || !Array.isArray(result.numbers) || result.numbers.length !== 5) {
                errors.push('Invalid numbers array in result');
            }
            if (!result.verificationHash) {
                errors.push('Missing verification hash');
            }
            break;

        case 'k3':
            if (!result.dice || !Array.isArray(result.dice) || result.dice.length !== 3) {
                errors.push('Invalid dice array in result');
            }
            if (!result.verificationHash) {
                errors.push('Missing verification hash');
            }
            break;

        case '5d':
            if (!result.numbers || !Array.isArray(result.numbers) || result.numbers.length !== 5) {
                errors.push('Invalid numbers array in result');
            }
            if (!result.verificationHash) {
                errors.push('Missing verification hash');
            }
            break;

        default:
            errors.push(`Unsupported game type: ${gameType}`);
    }

    return errors;
}

module.exports = {
    models,
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
    updateGameHistory,
    validateResultStructure
};