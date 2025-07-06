// Backend/services/gameLogicService.js
const { sequelize, DataTypes, Op } = require('../config/db');
const redisHelper = require('../config/redis');
const redisClient = redisHelper.getClient();
const periodService = require('./periodService');
const tronHashService = require('./tronHashService');
const winston = require('winston');
const path = require('path');
const logger = require('../utils/logger');
const crypto = require('crypto');
const { recordVipExperience } = require('../services/autoVipService');
const { processSelfRebate } = require('../services/selfRebateService');
const { processBetForActivityReward } = require('../services/activityRewardsService');
// CONSTANTS - Add to top of file
const PLATFORM_FEE_RATE = 0.02; // 2% platform fee
const ENHANCED_USER_THRESHOLD = 100; // New minimum user threshold

const globalProcessingLocks = new Map();

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

// Initialize models variable - will be populated after initialization
let serviceModels = null;

// Initialize models for the service
const initializeServiceModels = async () => {
    try {
        console.log('🔄 Initializing game logic service models...');

        // Import models module
        const { getModels } = require('../models');

        // Get initialized models
        const models = await getModels();

        // Verify required models
        const requiredModels = [
            'BetResultWingo',
            'BetResult5D',
            'BetResultK3',
            'BetResultTrxWix',
            'BetRecordWingo',
            'BetRecord5D',
            'BetRecordK3',
            'BetRecordTrxWix',
            'GamePeriod',
            'User',
            'GameCombinations5D', // Added
            'Game5DSummaryStats'  // Added
        ];

        // Check each required model
        for (const modelName of requiredModels) {
            if (!models[modelName]) {
                throw new Error(`Required model ${modelName} not found`);
            }
        }

        console.log('✅ Game logic service models initialized successfully');
        return models;
    } catch (error) {
        console.error('❌ Error initializing game logic service models:', error);
        throw error;
    }
};

// REMOVED: Don't initialize models immediately
// This was causing the circular dependency issue

// Helper function to ensure models are initialized
const ensureModelsInitialized = async () => {
    if (!serviceModels) {
        console.log('🔄 Models not initialized, initializing now...');
        serviceModels = await initializeServiceModels();
    }
    return serviceModels;
};

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


// Add this new function to the module
/**
 * Get deterministic color based on number
 * @param {number} number - Number (0-9)
 * @returns {string} - Corresponding color
 */
const getColorForNumber = (number) => {
    const colorMap = {
        0: 'red_violet',
        1: 'green',
        2: 'red',
        3: 'green',
        4: 'red',
        5: 'green_violet',
        6: 'red',
        7: 'green',
        8: 'red',
        9: 'green'
    };
    return colorMap[number];
};

/**
 * Validate result against 60/40 criteria
 * @param {Object} result - Result object with payout information
 * @param {string} gameType - Game type
 * @returns {Object} - Validation result
 */
const validate60_40Result = async (result, gameType) => {
    try {
        const warnings = [];

        if (!result) {
            return { isSafe: false, warnings: ['Result is null or undefined'] };
        }

        // Validate payout percentage and house edge
        if (result.payoutPercentage > 60) {
            warnings.push(`Payout percentage (${result.payoutPercentage}%) exceeds 60% limit`);
        }
        if (result.houseEdge < 40) {
            warnings.push(`House edge (${result.houseEdge}%) is below 40% minimum`);
        }

        // Validate result structure based on game type
        switch (gameType.toLowerCase()) {
            case 'wingo':
            case 'trx_wix':
                if (typeof result.result.number !== 'number') {
                    warnings.push('Invalid number in result');
                }
                if (!['big', 'small'].includes(result.result.size.toLowerCase())) {
                    warnings.push('Invalid size in result');
                }
                if (!['red', 'green', 'red_violet', 'green_violet'].includes(result.result.color.toLowerCase())) {
                    warnings.push('Invalid color in result');
                }
                break;

            case 'fived':
            case '5d':
                if (!Array.isArray([result.result.A, result.result.B, result.result.C, result.result.D, result.result.E])) {
                    warnings.push('Invalid dice results');
                }
                if (typeof result.result.sum !== 'number') {
                    warnings.push('Invalid sum in result');
                }
                break;

            case 'k3':
                if (!Array.isArray([result.result.dice_1, result.result.dice_2, result.result.dice_3])) {
                    warnings.push('Invalid dice results');
                }
                if (typeof result.result.sum !== 'number') {
                    warnings.push('Invalid sum in result');
                }
                if (typeof result.result.has_pair !== 'boolean') {
                    warnings.push('Invalid pair status');
                }
                if (typeof result.result.has_triple !== 'boolean') {
                    warnings.push('Invalid triple status');
                }
                if (typeof result.result.is_straight !== 'boolean') {
                    warnings.push('Invalid straight status');
                }
                break;
        }

        return {
            isSafe: warnings.length === 0,
            warnings
        };
    } catch (error) {
        logger.error('Error validating 60/40 result', {
            error: error.message,
            stack: error.stack,
            gameType
        });
        return {
            isSafe: false,
            warnings: ['Error during validation: ' + error.message]
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
* Initialize automatic cache management
*/
const initializeCacheManagement = () => {
    try {
        // Clear expired caches every 2 minutes
        setInterval(() => {
            clearPerformanceCaches(false);
        }, 120000);

        // Force clear all caches every hour to prevent memory leaks
        setInterval(() => {
            clearPerformanceCaches(true);
            logger.info('Hourly cache clear completed');
        }, 3600000);

        // Monitor cache performance every 10 minutes
        setInterval(() => {
            const memoryUsage = getMemoryUsage();
            const hitRate = getCacheHitRate();

            logger.info('Cache performance metrics', {
                memoryUsage,
                hitRate,
                timestamp: new Date().toISOString()
            });

            // If cache is getting too large, force clear
            if (memoryUsage.totalCacheItems > 200) {
                logger.warn('Cache size exceeded threshold, forcing clear', {
                    totalItems: memoryUsage.totalCacheItems
                });
                clearPerformanceCaches(true);
            }
        }, 600000);

        logger.info('Automatic cache management initialized');

    } catch (error) {
        logger.error('Error initializing cache management', {
            error: error.message
        });
    }
};

/**
 * Health check for the performance optimization system
 * @returns {Object} - Health status
 */
const getSystemHealthCheck = async () => {
    try {
        const health = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            cache: {
                status: 'healthy',
                memoryUsage: getMemoryUsage(),
                hitRate: getCacheHitRate()
            },
            redis: {
                status: 'unknown',
                connected: false
            },
            performance: {
                status: 'healthy',
                averageOptimizationTime: null
            }
        };

        // Check Redis connection
        try {
            await redisClient.ping();
            health.redis.status = 'healthy';
            health.redis.connected = true;
        } catch (redisError) {
            health.redis.status = 'unhealthy';
            health.redis.error = redisError.message;
            health.status = 'degraded';
        }

        // Check cache health
        const memoryUsage = health.cache.memoryUsage;
        if (memoryUsage.totalCacheItems > 300) {
            health.cache.status = 'warning';
            health.cache.message = 'High cache usage detected';
            if (health.status === 'healthy') {
                health.status = 'warning';
            }
        }

        // Overall health determination
        if (health.redis.status === 'unhealthy') {
            health.status = 'unhealthy';
        }

        return health;

    } catch (error) {
        logger.error('Error getting system health check', {
            error: error.message
        });
        return {
            status: 'error',
            message: 'Failed to get system health check'
        };
    }
};


async function initializeGameCombinations() {
    try {
        console.log('🎲 Initializing game combinations...');

        // Initialize Wingo in memory (10 combinations)
        global.wingoCombinations = {};
        for (let number = 0; number <= 9; number++) {
            global.wingoCombinations[number] = {
                number,
                color: getColorForNumber(number),
                size: number >= 5 ? 'Big' : 'Small',
                parity: number % 2 === 0 ? 'even' : 'odd',
                winning_conditions: {
                    exact: [`NUMBER:${number}`],
                    color: [`COLOR:${getColorForNumber(number)}`],
                    size: [`SIZE:${number >= 5 ? 'big' : 'small'}`],
                    parity: [`PARITY:${number % 2 === 0 ? 'even' : 'odd'}`]
                }
            };
        }

        // Initialize K3 in memory (216 combinations)
        global.k3Combinations = {};
        for (let d1 = 1; d1 <= 6; d1++) {
            for (let d2 = 1; d2 <= 6; d2++) {
                for (let d3 = 1; d3 <= 6; d3++) {
                    const key = `${d1},${d2},${d3}`;
                    const sum = d1 + d2 + d3;
                    const dice = [d1, d2, d3];
                    const counts = dice.reduce((acc, val) => {
                        acc[val] = (acc[val] || 0) + 1;
                        return acc;
                    }, {});

                    global.k3Combinations[key] = {
                        dice_1: d1,
                        dice_2: d2,
                        dice_3: d3,
                        sum,
                        sum_size: sum > 10 ? 'Big' : 'Small',
                        sum_parity: sum % 2 === 0 ? 'Even' : 'Odd',
                        patterns: {
                            triple: Object.values(counts).includes(3),
                            pair: Object.values(counts).includes(2) && !Object.values(counts).includes(3),
                            straight: isK3Straight([...dice].sort()),
                            all_different: Object.keys(counts).length === 3
                        },
                        winning_conditions: buildK3WinningConditions(d1, d2, d3, sum, counts)
                    };
                }
            }
        }

        // For TRX_WIX, use same as Wingo
        global.trxWixCombinations = global.wingoCombinations;

        console.log('✅ Game combinations initialized');
        console.log(`   - Wingo: 10 combinations`);
        console.log(`   - K3: 216 combinations`);
        console.log(`   - 5D: Lazy loading enabled`);

    } catch (error) {
        logger.error('Error initializing game combinations', { error: error.message });
        throw error;
    }
}


function buildK3WinningConditions(d1, d2, d3, sum, counts) {
    const conditions = {
        sum: [`SUM:${sum}`],
        sum_category: [],
        dice_matching: [],
        patterns: []
    };

    // Sum categories
    conditions.sum_category.push(`SUM_CATEGORY:${sum > 10 ? 'big' : 'small'}`);
    conditions.sum_category.push(`SUM_PARITY:${sum % 2 === 0 ? 'even' : 'odd'}`);

    // Dice matching
    if (Object.values(counts).includes(3)) {
        conditions.dice_matching.push('MATCHING_DICE:triple_any');
        conditions.dice_matching.push(`MATCHING_DICE:triple_${d1}`);
    } else if (Object.values(counts).includes(2)) {
        conditions.dice_matching.push('MATCHING_DICE:pair_any');
        // Add specific pair patterns if needed
    }

    // Patterns
    const sortedDice = [d1, d2, d3].sort();
    if (sortedDice[0] + 1 === sortedDice[1] && sortedDice[1] + 1 === sortedDice[2]) {
        conditions.patterns.push('PATTERN:straight');
    }
    if (Object.keys(counts).length === 3) {
        conditions.patterns.push('PATTERN:all_different');
    }

    return conditions;
}

function isK3Straight(sortedDice) {
    return sortedDice[0] + 1 === sortedDice[1] && sortedDice[1] + 1 === sortedDice[2];
}


async function lazy5DLoader(diceValue) {
    try {
        // Check Redis cache first
        const cacheKey = `5d:combo:${diceValue}`;
        const cached = await redisClient.get(cacheKey);

        if (cached) {
            return JSON.parse(cached);
        }

        // Load from database
        const models = await ensureModelsInitialized();
        const combination = await models.GameCombinations5D.findOne({
            where: { dice_value: diceValue }
        });

        if (!combination) {
            throw new Error(`5D combination ${diceValue} not found`);
        }

        // Parse and prepare data
        const result = {
            dice_value: combination.dice_value,
            dice: {
                A: combination.dice_a,
                B: combination.dice_b,
                C: combination.dice_c,
                D: combination.dice_d,
                E: combination.dice_e
            },
            sum: combination.sum_value,
            sum_size: combination.sum_size,
            sum_parity: combination.sum_parity,
            position_flags: combination.position_flags,
            winning_conditions: JSON.parse(combination.winning_conditions)
        };

        // Cache for 1 hour
        await redisClient.setex(cacheKey, 3600, JSON.stringify(result));

        return result;
    } catch (error) {
        logger.error('Error lazy loading 5D combination', { error: error.message, diceValue });
        throw error;
    }
}

async function get5DCombinationsBatch(diceValues) {
    try {
        const results = [];
        const uncachedValues = [];

        // Check cache for each value
        for (const diceValue of diceValues) {
            const cached = await redisClient.get(`5d:combo:${diceValue}`);
            if (cached) {
                results.push(JSON.parse(cached));
            } else {
                uncachedValues.push(diceValue);
            }
        }

        // Load uncached from DB
        if (uncachedValues.length > 0) {
            const models = await ensureModelsInitialized();
            const combinations = await models.GameCombinations5D.findAll({
                where: { dice_value: uncachedValues }
            });

            // Cache and add to results
            for (const combo of combinations) {
                const result = {
                    dice_value: combo.dice_value,
                    dice: {
                        A: combo.dice_a,
                        B: combo.dice_b,
                        C: combo.dice_c,
                        D: combo.dice_d,
                        E: combo.dice_e
                    },
                    sum: combo.sum_value,
                    sum_size: combo.sum_size,
                    sum_parity: combo.sum_parity,
                    position_flags: combo.position_flags,
                    winning_conditions: JSON.parse(combo.winning_conditions)
                };

                await redisClient.setex(`5d:combo:${combo.dice_value}`, 3600, JSON.stringify(result));
                results.push(result);
            }
        }

        return results;
    } catch (error) {
        logger.error('Error loading 5D combinations batch', { error: error.message });
        throw error;
    }
}

async function updateBetExposure(gameType, duration, periodId, bet) {
    try {
        console.log('📊 [EXPOSURE_START] ==========================================');
        console.log('📊 [EXPOSURE_START] Updating bet exposure:', {
            gameType,
            duration,
            periodId,
            betType: bet.betType,
            betValue: bet.betValue,
            netBetAmount: bet.netBetAmount,
            odds: bet.odds
        });
        console.log('📊 [EXPOSURE_START] Full bet object received:', JSON.stringify(bet, null, 2));

        const exposureKey = `exposure:${gameType}:${duration}:${periodId}`;
        console.log('🔍 [EXPOSURE_DEBUG] Writing to key:', exposureKey);

        const { betType, betValue, netBetAmount, odds } = bet;
        
        // CRITICAL FIX: Handle field name variations
        const actualBetAmount = bet.netBetAmount || bet.betAmount || netBetAmount || 0;
        console.log('🔍 [EXPOSURE_DEBUG] Bet amount resolved:', {
            netBetAmount: bet.netBetAmount,
            betAmount: bet.betAmount,
            actualBetAmount: actualBetAmount
        });

        // Calculate exposure (potential payout) - convert to integer for Redis
        const exposure = Math.round(actualBetAmount * odds * 100); // Convert to cents
        console.log('🔍 [EXPOSURE_DEBUG] Exposure calculation:', {
            actualBetAmount,
            odds,
            exposure,
            exposureInRupees: exposure / 100
        });

        // Ensure exposure is a valid integer
        if (isNaN(exposure) || exposure < 0) {
            console.error('❌ [EXPOSURE_ERROR] Invalid exposure calculation:', { actualBetAmount, odds, exposure });
            throw new Error('Invalid exposure calculation');
        }

        console.log('💰 [EXPOSURE_CALC] Exposure calculation:', {
            actualBetAmount, odds, exposure, exposureInRupees: exposure / 100,
            exposureKey: exposureKey
        });

        // Update exposure based on game type
        switch (gameType.toLowerCase()) {
            case 'wingo':
            case 'trx_wix':
                // For number bets, update specific number
                if (betType === 'NUMBER') {
                    await redisClient.hincrby(exposureKey, `number:${betValue}`, exposure);
                    console.log(`📊 Updated number exposure: number:${betValue} += ${exposure}`);
                }
                // For other bets, update all matching numbers
                else {
                    const updatedNumbers = [];
                    
                    // Ensure combinations are initialized
                    if (!global.wingoCombinations) {
                        console.log('⚠️ Wingo combinations not initialized, initializing now...');
                        await initializeGameCombinations();
                    }
                    
                    for (let num = 0; num <= 9; num++) {
                        const combo = global.wingoCombinations[num];
                        if (combo && checkWinCondition(combo, betType, betValue)) {
                            console.log(`📊 Updating exposure for number ${num}: ${exposure} cents (type: ${typeof exposure})`);
                            try {
                                const result = await redisClient.hincrby(exposureKey, `number:${num}`, exposure);
                                console.log(`📊 Redis HINCRBY result for number ${num}:`, result);
                                updatedNumbers.push(num);
                            } catch (redisError) {
                                console.error(`❌ Redis HINCRBY failed for number ${num}:`, redisError);
                                throw redisError;
                            }
                        }
                    }
                    console.log(`📊 Updated color/size/parity exposure for numbers [${updatedNumbers.join(',')}] += ${exposure}`);
                }
                break;

            case 'k3':
                // Update all combinations that would win
                const updatedK3Combos = [];
                
                // Ensure combinations are initialized
                if (!global.k3Combinations) {
                    console.log('⚠️ K3 combinations not initialized, initializing now...');
                    await initializeGameCombinations();
                }
                
                for (const [key, combo] of Object.entries(global.k3Combinations)) {
                    if (combo && checkK3WinCondition(combo, betType, betValue)) {
                        await redisClient.hincrby(exposureKey, `dice:${key}`, exposure);
                        updatedK3Combos.push(key);
                    }
                }
                console.log(`📊 Updated K3 exposure for combinations [${updatedK3Combos.join(',')}] += ${exposure}`);
                break;

            case 'fived':
            case '5d':
                // For 5D, we'll update exposure without loading all combinations
                // Store bet-level exposure for later calculation
                const betKey = `${betType}:${betValue}`;
                await redisClient.hincrby(exposureKey, `bet:${betKey}`, exposure);
                console.log(`📊 Updated 5D bet exposure: bet:${betKey} += ${exposure}`);
                break;
        }

        // Set expiry
        await redisClient.expire(exposureKey, duration + 300);

        // Verify exposure was updated
        const currentExposures = await redisClient.hgetall(exposureKey);
        
        // Convert cents to rupees for display
        const exposuresInRupees = {};
        for (const [key, value] of Object.entries(currentExposures)) {
            exposuresInRupees[key] = `${(parseInt(value) / 100).toFixed(2)}₹`;
        }
        
        console.log('✅ [EXPOSURE_VERIFY] Current exposures after update (in rupees):', exposuresInRupees);
        console.log('📊 [EXPOSURE_END] ==========================================');

    } catch (error) {
        logger.error('Error updating bet exposure', { error: error.message, gameType, periodId });
        console.error('❌ Exposure update failed:', error);
    }
}

function checkWinCondition(combination, betType, betValue) {
    switch (betType) {
        case 'NUMBER':
            return combination.number === parseInt(betValue);
        case 'COLOR':
            if (betValue === 'red' && combination.color === 'red_violet') return true;
            if (betValue === 'green' && combination.color === 'green_violet') return true;
            return combination.color === betValue;
        case 'SIZE':
            return combination.size.toLowerCase() === betValue.toLowerCase();
        case 'PARITY':
            return combination.parity === betValue;
        default:
            return false;
    }
}

function checkK3WinCondition(combination, betType, betValue) {
    const conditions = combination.winning_conditions;
    const checkValue = `${betType}:${betValue}`;

    // Check in all condition arrays
    for (const conditionGroup of Object.values(conditions)) {
        if (Array.isArray(conditionGroup) && conditionGroup.includes(checkValue)) {
            return true;
        }
    }
    return false;
}
async function getOptimalResultByExposure(gameType, duration, periodId) {
    try {
        console.log('📊 [OPTIMAL_START] ==========================================');
        console.log('📊 [OPTIMAL_START] Getting optimal result by exposure:', {
            gameType, duration, periodId
        });

        const exposureKey = `exposure:${gameType}:${duration}:${periodId}`;

        switch (gameType.toLowerCase()) {
            case 'wingo':
            case 'trx_wix':
                console.log('🎲 [OPTIMAL_WINGO] Analyzing Wingo exposures...');
                // Get all exposures
                const wingoExposures = await redisClient.hgetall(exposureKey);
                let minExposure = Infinity;
                let optimalNumber = 0;

                console.log('📊 [OPTIMAL_WINGO] Raw exposures from Redis:', wingoExposures);

                // Check each number
                for (let num = 0; num <= 9; num++) {
                    const exposure = parseInt(wingoExposures[`number:${num}`] || 0) / 100; // Convert from cents to rupees
                    console.log(`📊 [OPTIMAL_WINGO] Number ${num}: ${exposure}₹ exposure`);
                    if (exposure < minExposure) {
                        minExposure = exposure;
                        optimalNumber = num;
                        console.log(`📊 [OPTIMAL_WINGO] New minimum: Number ${num} with ${exposure}₹ exposure`);
                    }
                }

                console.log('🎯 [OPTIMAL_WINGO] Selected optimal number:', {
                    number: optimalNumber,
                    exposure: minExposure,
                    reason: 'MINIMUM_EXPOSURE'
                });

                // Ensure combinations are initialized
                if (!global.wingoCombinations) {
                    console.log('⚠️ [OPTIMAL_WINGO] Wingo combinations not initialized, initializing now...');
                    await initializeGameCombinations();
                }
                
                const result = global.wingoCombinations[optimalNumber];
                console.log('📊 [OPTIMAL_END] ==========================================');
                console.log('📊 [OPTIMAL_END] Final optimal result:', result);
                
                return result;

            case 'k3':
                // Get all exposures
                const k3Exposures = await redisClient.hgetall(exposureKey);
                let minK3Exposure = Infinity;
                let optimalKey = '1,1,1';

                // Check each combination
                for (const [key, combo] of Object.entries(global.k3Combinations)) {
                    const exposure = parseInt(k3Exposures[`dice:${key}`] || 0);
                    if (exposure < minK3Exposure) {
                        minK3Exposure = exposure;
                        optimalKey = key;
                    }
                }

                // Ensure combinations are initialized
                if (!global.k3Combinations) {
                    console.log('⚠️ K3 combinations not initialized, initializing now...');
                    await initializeGameCombinations();
                }
                
                return global.k3Combinations[optimalKey];

            case 'fived':
            case '5d':
                // For 5D, we need a different approach
                return await getOptimal5DResultByExposure(duration, periodId);

            default:
                throw new Error(`Unknown game type: ${gameType}`);
        }

    } catch (error) {
        logger.error('Error getting optimal result by exposure', { error: error.message, gameType, periodId });
        throw error;
    }
}

async function getOptimal5DResultByExposure(duration, periodId) {
    try {
        const exposureKey = `exposure:5d:${duration}:${periodId}`;
        const betExposures = await redisClient.hgetall(exposureKey);

        // Get total bets amount
        const totalBets = Object.values(betExposures).reduce((sum, val) => sum + parseFloat(val), 0);

        // Strategy based on bet volume
        let strategy = 'FULL_SCAN';
        if (totalBets > 100000) {
            strategy = 'STATISTICAL_SAMPLING';
        } else if (totalBets > 50000) {
            strategy = 'SMART_SAMPLING';
        }

        const models = await ensureModelsInitialized();

        switch (strategy) {
            case 'FULL_SCAN':
                // For low volume, check all combinations
                const result = await models.sequelize.query(`
                    SELECT dice_value, dice_a, dice_b, dice_c, dice_d, dice_e, 
                           sum_value, sum_size, sum_parity, winning_conditions
                    FROM game_combinations_5d
                    ORDER BY RAND()
                    LIMIT 10000
                `, { type: models.sequelize.QueryTypes.SELECT });

                let minExposure = Infinity;
                let optimalResult = null;

                for (const combo of result) {
                    const exposure = await calculate5DExposure(combo, betExposures);
                    if (exposure < minExposure) {
                        minExposure = exposure;
                        optimalResult = combo;
                    }
                }

                return format5DResult(optimalResult);

            case 'SMART_SAMPLING':
                // Sample based on sum distribution
                const sumResult = await models.sequelize.query(`
                    SELECT dice_value, dice_a, dice_b, dice_c, dice_d, dice_e,
                           sum_value, sum_size, sum_parity, winning_conditions
                    FROM game_combinations_5d
                    WHERE sum_value IN (
                        SELECT sum_value 
                        FROM game_5d_summary_stats 
                        ORDER BY probability ASC 
                        LIMIT 10
                    )
                    ORDER BY RAND()
                    LIMIT 1000
                `, { type: models.sequelize.QueryTypes.SELECT });

                let minSampleExposure = Infinity;
                let optimalSampleResult = null;

                for (const combo of sumResult) {
                    const exposure = await calculate5DExposure(combo, betExposures);
                    if (exposure < minSampleExposure) {
                        minSampleExposure = exposure;
                        optimalSampleResult = combo;
                    }
                }

                return format5DResult(optimalSampleResult);

            case 'STATISTICAL_SAMPLING':
                // Use position-based optimization
                const unbetPositions = findUnbetPositions(betExposures);

                let query = `
                    SELECT dice_value, dice_a, dice_b, dice_c, dice_d, dice_e,
                           sum_value, sum_size, sum_parity, winning_conditions
                    FROM game_combinations_5d
                    WHERE 1=1
                `;

                // Add conditions for unbet positions
                if (unbetPositions.A.length > 0) {
                    query += ` AND dice_a IN (${unbetPositions.A.join(',')})`;
                }
                if (unbetPositions.B.length > 0) {
                    query += ` AND dice_b IN (${unbetPositions.B.join(',')})`;
                }

                query += ` ORDER BY RAND() LIMIT 100`;

                const statResult = await models.sequelize.query(query, {
                    type: models.sequelize.QueryTypes.SELECT
                });

                if (statResult.length > 0) {
                    return format5DResult(statResult[0]);
                }

                // Fallback to random low probability
                const fallbackResult = await models.sequelize.query(`
                    SELECT dice_value, dice_a, dice_b, dice_c, dice_d, dice_e,
                           sum_value, sum_size, sum_parity, winning_conditions
                    FROM game_combinations_5d
                    WHERE sum_value IN (0, 1, 2, 3, 4, 41, 42, 43, 44, 45)
                    ORDER BY RAND()
                    LIMIT 1
                `, { type: models.sequelize.QueryTypes.SELECT });

                return format5DResult(fallbackResult[0]);
        }

    } catch (error) {
        logger.error('Error getting optimal 5D result', { error: error.message });
        throw error;
    }
}

async function calculate5DExposure(combination, betExposures) {
    let totalExposure = 0;
    const winningConditions = JSON.parse(combination.winning_conditions);

    // Check each bet type
    for (const [betKey, exposure] of Object.entries(betExposures)) {
        if (!betKey.startsWith('bet:')) continue;

        const actualBetKey = betKey.replace('bet:', '');

        // Check if this combination wins for this bet
        let wins = false;

        // Check exact positions
        if (winningConditions.positions?.exact?.includes(actualBetKey)) {
            wins = true;
        }
        // Check size positions
        else if (winningConditions.positions?.size?.includes(actualBetKey)) {
            wins = true;
        }
        // Check parity positions
        else if (winningConditions.positions?.parity?.includes(actualBetKey)) {
            wins = true;
        }
        // Check sum conditions
        else if (winningConditions.sum?.value === actualBetKey ||
            winningConditions.sum?.size === actualBetKey ||
            winningConditions.sum?.parity === actualBetKey) {
            wins = true;
        }

        if (wins) {
            totalExposure += parseFloat(exposure);
        }
    }

    return totalExposure;
}

function format5DResult(dbResult) {
    if (!dbResult) return null;

    return {
        A: dbResult.dice_a,
        B: dbResult.dice_b,
        C: dbResult.dice_c,
        D: dbResult.dice_d,
        E: dbResult.dice_e,
        sum: dbResult.sum_value,
        dice_value: dbResult.dice_value,
        sum_size: dbResult.sum_size,
        sum_parity: dbResult.sum_parity
    };
}

function findUnbetPositions(betExposures) {
    const unbetPositions = {
        A: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
        B: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
        C: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
        D: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
        E: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
    };

    // Remove bet positions
    for (const betKey of Object.keys(betExposures)) {
        if (betKey.startsWith('bet:POSITION:')) {
            const match = betKey.match(/POSITION:([A-E])_(\d)/);
            if (match) {
                const [_, position, value] = match;
                const index = unbetPositions[position].indexOf(parseInt(value));
                if (index > -1) {
                    unbetPositions[position].splice(index, 1);
                }
            }
        }
    }

    return unbetPositions;
}

async function resetPeriodExposure(gameType, duration, periodId) {
    try {
        const exposureKey = `exposure:${gameType}:${duration}:${periodId}`;
        await redisClient.del(exposureKey);
        logger.info('Period exposure reset', { gameType, duration, periodId });
    } catch (error) {
        logger.error('Error resetting period exposure', { error: error.message, gameType, periodId });
    }
}

async function indexBetInHash(gameType, duration, periodId, timeline, bet) {
    try {
        const betHashKey = `bets:${gameType}:${duration}:${timeline}:${periodId}`;
        const betId = `${bet.userId}:${bet.betType}:${bet.betValue}:${Date.now()}`;

        await redisClient.hset(betHashKey, betId, JSON.stringify({
            userId: bet.userId,
            betType: bet.betType,
            betValue: bet.betValue,
            netBetAmount: bet.netBetAmount,
            platformFee: bet.platformFee,
            grossBetAmount: bet.grossBetAmount,
            odds: bet.odds,
            timestamp: Date.now()
        }));

        // Set expiry
        await redisClient.expire(betHashKey, 86400);

        return betId;
    } catch (error) {
        logger.error('Error indexing bet in hash', { error: error.message });
        throw error;
    }
}

async function getBetsFromHash(gameType, duration, periodId, timeline = 'default') {
    try {
        const betHashKey = `bets:${gameType}:${duration}:${timeline}:${periodId}`;
        const betsData = await redisClient.hgetall(betHashKey);

        const bets = [];
        for (const [betId, betJson] of Object.entries(betsData)) {
            bets.push(JSON.parse(betJson));
        }

        return bets;
    } catch (error) {
        logger.error('Error getting bets from hash', { error: error.message });
        return [];
    }
}

/**
 * Get performance level based on bet count
 * @param {number} betCount - Number of bets
 * @returns {string} - Performance level
 */
const getPerformanceLevel = (betCount) => {
    if (betCount <= 50) return 'exact';
    if (betCount <= 200) return 'sampled';
    return 'approximated';
};


/**
 * Get memory usage estimation
 * @returns {Object} - Memory usage info
 */
const getMemoryUsage = () => {
    try {
        return {
            combinationCacheSize: PerformanceCache.combinationCache.size,
            payoutCacheSize: PerformanceCache.payoutCache.size,
            patternCacheSize: PerformanceCache.patternCache.size,
            totalCacheItems: PerformanceCache.combinationCache.size +
                PerformanceCache.payoutCache.size +
                PerformanceCache.patternCache.size
        };
    } catch (error) {
        return {
            combinationCacheSize: 0,
            payoutCacheSize: 0,
            patternCacheSize: 0,
            totalCacheItems: 0
        };
    }
};

/**
 * Clear performance caches to free memory
 * @param {boolean} force - Force clear even if cache is recent
 */
const clearPerformanceCaches = (force = false) => {
    try {
        const now = Date.now();

        // Clear expired cache entries or force clear all
        if (force) {
            PerformanceCache.combinationCache.clear();
            PerformanceCache.payoutCache.clear();
            PerformanceCache.patternCache.clear();
            logger.info('Performance caches force cleared');
        } else {
            // Clear expired entries
            let clearedCount = 0;

            // Clear expired combination cache
            for (const [key, value] of PerformanceCache.combinationCache.entries()) {
                if (now - value.timestamp > PerformanceCache.cacheExpiry.combinations) {
                    PerformanceCache.combinationCache.delete(key);
                    clearedCount++;
                }
            }

            // Clear expired payout cache
            for (const [key, value] of PerformanceCache.payoutCache.entries()) {
                if (now - value.timestamp > PerformanceCache.cacheExpiry.payouts) {
                    PerformanceCache.payoutCache.delete(key);
                    clearedCount++;
                }
            }

            // Clear expired pattern cache
            for (const [key, value] of PerformanceCache.patternCache.entries()) {
                if (now - value.timestamp > PerformanceCache.cacheExpiry.patterns) {
                    PerformanceCache.patternCache.delete(key);
                    clearedCount++;
                }
            }

            if (clearedCount > 0) {
                logger.info('Expired cache entries cleared', { clearedCount });
            }
        }
    } catch (error) {
        logger.error('Error clearing performance caches', {
            error: error.message
        });
    }
};



/**
 * Initialize combination tracking for all possible results
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 * @param {string} periodId - Period ID
 */
const initializeCombinationTracking = async (gameType, duration, periodId) => {
    try {
        const durationKey = duration === 30 ? '30s' :
            duration === 60 ? '1m' :
                duration === 180 ? '3m' :
                    duration === 300 ? '5m' : '10m';

        // Generate all possible results
        const allCombinations = await generateAllPossibleResults(gameType);

        // Initialize tracking for each combination
        const trackingData = {
            combinations: allCombinations.map(combination => ({
                result: combination,
                currentPayout: 0,
                payoutRatio: 0,
                isValid: true, // Starts as valid for 60/40 rule
                lastUpdated: Date.now()
            })),
            totalBetAmount: 0,
            lastOptimization: Date.now()
        };

        // Store in Redis
        const trackingKey = `${gameType}:${durationKey}:${periodId}:tracking`;
        await redisClient.set(trackingKey, JSON.stringify(trackingData));
        await redisClient.expire(trackingKey, duration + 300); // 5 min buffer

        logger.info('Combination tracking initialized', {
            gameType,
            periodId,
            combinationCount: allCombinations.length
        });

    } catch (error) {
        logger.error('Error initializing combination tracking', {
            error: error.message,
            stack: error.stack,
            gameType,
            periodId
        });
    }
};


/**
 * Start a new period with real-time optimization
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 * @param {string} periodId - Period ID
 */
const startPeriodWithOptimization = async (gameType, duration, periodId) => {
    try {
        logger.info('Starting new period with real-time optimization', {
            gameType,
            duration,
            periodId
        });

        // Initialize the period tracking
        await initializeCombinationTracking(gameType, duration, periodId);

        // Start real-time optimization
        await startRealTimeOptimization(gameType, duration, periodId);

        // Set up period cleanup
        await schedulePeriodCleanup(gameType, duration, periodId);

        logger.info('Period started successfully with optimization', {
            gameType,
            periodId
        });

    } catch (error) {
        logger.error('Error starting period with optimization', {
            error: error.message,
            stack: error.stack,
            gameType,
            periodId
        });
    }
};

/**
 * Schedule cleanup of period data after period ends
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 * @param {string} periodId - Period ID
 */
const schedulePeriodCleanup = async (gameType, duration, periodId) => {
    try {
        const durationKey = duration === 30 ? '30s' :
            duration === 60 ? '1m' :
                duration === 180 ? '3m' :
                    duration === 300 ? '5m' : '10m';

        // Schedule cleanup after period ends + 5 minutes buffer
        setTimeout(async () => {
            try {
                await cleanupPeriodData(gameType, durationKey, periodId);
            } catch (cleanupError) {
                logger.error('Error in scheduled cleanup', {
                    error: cleanupError.message,
                    gameType,
                    periodId
                });
            }
        }, (duration + 300) * 1000); // 5 minute buffer

        logger.info('Period cleanup scheduled', {
            gameType,
            periodId,
            cleanupTime: duration + 300
        });

    } catch (error) {
        logger.error('Error scheduling period cleanup', {
            error: error.message,
            gameType,
            periodId
        });
    }
};

/**
 * Performance-optimized combination cache system
 */
const PerformanceCache = {
    // Cache for pre-calculated combinations
    combinationCache: new Map(),

    // Cache for payout calculations
    payoutCache: new Map(),

    // Cache for bet pattern analysis
    patternCache: new Map(),

    // Cache expiry times
    cacheExpiry: {
        combinations: 60000, // 1 minute
        payouts: 30000,      // 30 seconds
        patterns: 45000      // 45 seconds
    }
};

/**
 * Pre-calculate and cache all possible combinations for a game type
 * @param {string} gameType - Game type
 * @returns {Promise<Array>} - Cached combinations
 */
const getPreCalculatedCombinations = async (gameType) => {
    try {
        const cacheKey = `combinations_${gameType}`;
        const cached = PerformanceCache.combinationCache.get(cacheKey);

        // Check if cache is still valid
        if (cached && (Date.now() - cached.timestamp) < PerformanceCache.cacheExpiry.combinations) {
            logger.info('Using cached combinations', {
                gameType,
                count: cached.data.length
            });
            return cached.data;
        }

        // Generate fresh combinations
        logger.info('Generating fresh combinations', { gameType });
        const combinations = await generateAllPossibleResults(gameType);

        // Cache with metadata
        PerformanceCache.combinationCache.set(cacheKey, {
            data: combinations,
            timestamp: Date.now(),
            gameType
        });

        // Limit cache size to prevent memory issues
        if (PerformanceCache.combinationCache.size > 10) {
            const oldestKey = PerformanceCache.combinationCache.keys().next().value;
            PerformanceCache.combinationCache.delete(oldestKey);
        }

        logger.info('Combinations cached', {
            gameType,
            count: combinations.length
        });

        return combinations;

    } catch (error) {
        logger.error('Error getting pre-calculated combinations', {
            error: error.message,
            gameType
        });
        // Fallback to direct generation
        return await generateAllPossibleResults(gameType);
    }
};



/**
 * Calculate payout using statistical sampling for medium volume
 * @param {string} gameType - Game type
 * @param {string} durationKey - Duration key
 * @param {string} periodId - Period ID
 * @param {Object} result - Result to calculate for
 * @param {number} sampleRate - Sampling rate (0.0 to 1.0)
 * @returns {Promise<number>} - Estimated payout
 */
const calculateSampledPayout = async (gameType, durationKey, periodId, result, sampleRate) => {
    try {
        const betKeys = await redisClient.keys(`${gameType}:${durationKey}:${periodId}:*`);

        // Sample bets randomly
        const sampleSize = Math.ceil(betKeys.length * sampleRate);
        const sampledKeys = betKeys
            .sort(() => Math.random() - 0.5) // Shuffle
            .slice(0, sampleSize);

        let samplePayout = 0;
        let validSamples = 0;

        for (const key of sampledKeys) {
            try {
                const betData = await redisClient.get(key);
                if (!betData) continue;

                const bet = JSON.parse(betData);
                const winAmount = calculateComplexWinAmount(bet, result, gameType);
                samplePayout += winAmount;
                validSamples++;

            } catch (betError) {
                continue;
            }
        }

        // Extrapolate to full population
        const extrapolatedPayout = validSamples > 0
            ? (samplePayout / validSamples) * betKeys.length
            : 0;

        logger.info('Sampled payout calculation', {
            gameType,
            periodId,
            totalBets: betKeys.length,
            sampledBets: validSamples,
            sampleRate,
            extrapolatedPayout
        });

        return extrapolatedPayout;

    } catch (error) {
        logger.error('Error in sampled payout calculation', {
            error: error.message,
            gameType,
            periodId
        });
        return 0;
    }
};



/**
 * Get period status
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 * @param {string} periodId - Period ID
 * @returns {Object} - Period status
 */
const getPeriodStatus = async (gameType, duration, periodId) => {
    try {
        const endTime = calculatePeriodEndTime(periodId, duration);
        const now = new Date();
        const timeRemaining = Math.max(0, (endTime - now) / 1000);

        return {
            active: timeRemaining > 0,
            timeRemaining,
            endTime,
            periodId
        };
    } catch (error) {
        logger.error('Error getting period status', {
            error: error.message,
            gameType,
            periodId
        });
        return {
            active: false,
            timeRemaining: 0
        };
    }
};

/**
 * Get last results for pattern checking
 * @param {string} gameType - Game type
 * @param {number} count - Number of results to get
 * @returns {Array} - Last results
 */
const getLastResults = async (gameType, count = 5) => {
    try {
        // This is a simplified implementation
        // You may want to implement this based on your database structure
        return [];
    } catch (error) {
        logger.error('Error getting last results', {
            error: error.message,
            gameType
        });
        return [];
    }
};

/**
 * Start a new round
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 */
const startRound = async (gameType, duration) => {
    try {
        // Implementation depends on your period service
        logger.info('Starting new round', { gameType, duration });
        // You may need to call periodService.startNewPeriod or similar
    } catch (error) {
        logger.error('Error starting new round', {
            error: error.message,
            gameType,
            duration
        });
    }
};





/**
 * Get K3 sum multiplier for approximation
 * @param {number} sum - Dice sum
 * @returns {number} - Multiplier for that sum
 */
const getSumMultiplier = (sum) => {
    const multipliers = {
        3: 207.36, 4: 69.12, 5: 34.56, 6: 20.74, 7: 13.83, 8: 9.88,
        9: 8.3, 10: 7.68, 11: 7.68, 12: 8.3, 13: 9.88, 14: 13.83,
        15: 20.74, 16: 34.56, 17: 69.12, 18: 207.36
    };
    return multipliers[sum] || 10; // Default multiplier
};


/**
 * Clean up period data after completion
 * @param {string} gameType - Game type
 * @param {string} durationKey - Duration key
 * @param {string} periodId - Period ID
 */
const cleanupPeriodData = async (gameType, durationKey, periodId) => {
    try {
        // Stop optimization interval
        const intervalKey = `${gameType}:${durationKey}:${periodId}:optimization_interval`;
        const intervalId = await redisClient.get(intervalKey);

        if (intervalId) {
            clearInterval(parseInt(intervalId));
            await redisClient.del(intervalKey);
        }

        // Clean up tracking data (keep for analysis but remove from active keys)
        const trackingKey = `${gameType}:${durationKey}:${periodId}:tracking`;
        const fallbackKey = `${gameType}:${durationKey}:${periodId}:fallbacks`;

        // Move to archive instead of deleting (for analysis)
        const archiveKey = `archive:${gameType}:${durationKey}:${periodId}:tracking`;
        const trackingData = await redisClient.get(trackingKey);

        if (trackingData) {
            await redisClient.set(archiveKey, trackingData, 'EX', 7 * 24 * 60 * 60); // Keep for 7 days
        }

        // Delete active keys
        await redisClient.del(trackingKey);
        await redisClient.del(fallbackKey);

        logger.info('Period data cleaned up', {
            gameType,
            periodId,
            archivedTo: archiveKey
        });

    } catch (error) {
        logger.error('Error cleaning up period data', {
            error: error.message,
            gameType,
            periodId
        });
    }
};

/**
 * Get period optimization statistics
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 * @param {string} periodId - Period ID
 * @returns {Object} - Optimization statistics
 */
const getPeriodOptimizationStats = async (gameType, duration, periodId) => {
    try {
        const durationKey = duration === 30 ? '30s' :
            duration === 60 ? '1m' :
                duration === 180 ? '3m' :
                    duration === 300 ? '5m' : '10m';

        // Get current tracking data
        const trackingKey = `${gameType}:${durationKey}:${periodId}:tracking`;
        const fallbackKey = `${gameType}:${durationKey}:${periodId}:fallbacks`;

        const trackingData = await redisClient.get(trackingKey);
        const fallbackData = await redisClient.get(fallbackKey);

        if (!trackingData) {
            return {
                available: false,
                message: 'No optimization data available'
            };
        }

        const tracking = JSON.parse(trackingData);
        const fallbacks = fallbackData ? JSON.parse(fallbackData) : null;

        const stats = {
            available: true,
            totalCombinations: tracking.combinations.length,
            validCombinations: tracking.combinations.filter(c => c.isValid).length,
            invalidCombinations: tracking.combinations.filter(c => !c.isValid).length,
            totalBetAmount: tracking.totalBetAmount,
            lastOptimization: new Date(tracking.lastOptimization).toISOString(),
            optimalResult: fallbacks?.lowestPayout || null,
            payoutRatio: fallbacks?.lowestPayout?.payoutRatio || null,
            expectedPayout: fallbacks?.lowestPayout?.currentPayout || null,
            periodId,
            gameType,
            duration
        };

        return stats;

    } catch (error) {
        logger.error('Error getting optimization stats', {
            error: error.message,
            gameType,
            periodId
        });

        return {
            available: false,
            error: error.message
        };
    }
};


/**
 * Get optimized result using real-time data
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 * @param {string} periodId - Period ID
 * @returns {Object} - Optimized result
 */
/**
 * UPDATED: Get real-time optimized result with timeline support
 */
const getRealTimeOptimizedResult = async (gameType, duration, periodId, timeline = 'default') => {
    try {
        const durationKey = duration === 30 ? '30s' :
            duration === 60 ? '1m' :
                duration === 180 ? '3m' :
                    duration === 300 ? '5m' : '10m';

        // Get fallback data (pre-calculated)
        const fallbackKey = `${gameType}:${durationKey}:${timeline}:${periodId}:fallbacks`;
        const fallbackData = await redisClient.get(fallbackKey);

        if (!fallbackData) {
            console.log(`⚠️ REALTIME: No real-time data for ${gameType} ${periodId}`);
            return null;
        }

        const fallbacks = JSON.parse(fallbackData);

        // Priority selection:
        // 1. Use valid 60/40 result (lowest payout)
        if (fallbacks.lowestPayout && fallbacks.lowestPayout.isValid) {
            console.log(`✅ REALTIME: Using lowest payout result (60/40 compliant)`);
            return fallbacks.lowestPayout.result;
        }

        // 2. Use second lowest if available
        if (fallbacks.secondLowest && fallbacks.secondLowest.isValid) {
            console.log(`✅ REALTIME: Using second lowest result`);
            return fallbacks.secondLowest.result;
        }

        // 3. Use third lowest if available  
        if (fallbacks.thirdLowest && fallbacks.thirdLowest.isValid) {
            console.log(`✅ REALTIME: Using third lowest result`);
            return fallbacks.thirdLowest.result;
        }

        console.log(`⚠️ REALTIME: No valid real-time results available`);
        return null;

    } catch (error) {
        console.error('Error getting real-time optimized result:', error);
        return null;
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
const getUserBetCount = async (userId, gameType, periodId, timeline = 'default') => {
    try {
        // CRITICAL: Ensure models are initialized
        const models = await ensureModelsInitialized();

        let betCount = 0;
        switch (gameType) {
            case 'wingo':
                betCount = await models.BetRecordWingo.count({
                    where: {
                        user_id: userId,
                        bet_number: periodId,
                        timeline: timeline
                    }
                });
                break;
            case 'trx_wix':
                betCount = await models.BetRecordTrxWix.count({
                    where: {
                        user_id: userId,
                        bet_number: periodId,
                        timeline: timeline
                    }
                });
                break;
            case 'fiveD':
                betCount = await models.BetRecord5D.count({
                    where: {
                        user_id: userId,
                        bet_number: periodId,
                        timeline: timeline
                    }
                });
                break;
            case 'k3':
                betCount = await models.BetRecordK3.count({
                    where: {
                        user_id: userId,
                        bet_number: periodId,
                        timeline: timeline
                    }
                });
                break;
            default:
                logger.warn('Unknown game type in getUserBetCount', { gameType });
                break;
        }
        return betCount;
    } catch (error) {
        logger.error('Error getting user bet count', {
            error: error.message,
            stack: error.stack,
            userId,
            gameType,
            periodId,
            timeline
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
const getTotalBetsOnOutcome = async (gameType, duration, periodId, betType, betValue, timeline = 'default') => {
    try {
        const durationKey = duration === 30 ? '30s' :
            duration === 60 ? '1m' :
                duration === 180 ? '3m' :
                    duration === 300 ? '5m' : '10m';

        // Use timeline-aware hash structure
        const betHashKey = `bets:${gameType}:${duration}:${timeline}:${periodId}`;
        const betsData = await redisClient.hgetall(betHashKey);
        
        let totalAmount = 0;
        for (const [betId, betJson] of Object.entries(betsData)) {
            const bet = JSON.parse(betJson);
            if (bet.betType === betType && bet.betValue === betValue) {
                totalAmount += parseFloat(bet.netBetAmount || 0);
            }
        }
        
        return totalAmount;
    } catch (error) {
        logger.error('Error getting total bets on outcome', {
            error: error.message,
            stack: error.stack,
            gameType,
            periodId,
            betType,
            betValue,
            timeline
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
 * NEW: Enhanced user threshold validation with outcome coverage analysis
 */








async function selectProtectedResultWithExposure(gameType, duration, periodId, timeline) {
    try {
        const exposureKey = `exposure:${gameType}:${duration}:${periodId}`;

        switch (gameType.toLowerCase()) {
            case 'wingo':
            case 'trx_wix':
                // Find zero exposure numbers
                console.log('🔍 Checking exposures for key:', exposureKey);
                const wingoExposures = await redisClient.hgetall(exposureKey);
                console.log('🔍 Raw exposures from Redis:', wingoExposures);
                const zeroExposureNumbers = [];
                
                for (let num = 0; num <= 9; num++) {
                    const exposure = parseInt(wingoExposures[`number:${num}`] || 0);
                    if (exposure === 0) {
                        zeroExposureNumbers.push(num);
                    }
                }
                
                // Log exposure analysis for debugging
                const exposureAnalysis = {};
                for (let num = 0; num <= 9; num++) {
                    const exposure = parseInt(wingoExposures[`number:${num}`] || 0);
                    exposureAnalysis[`number:${num}`] = `${(exposure / 100).toFixed(2)}₹`;
                }
                console.log('🔍 Exposure analysis for protection mode:', exposureAnalysis);
                
                // Randomly select from zero-exposure numbers
                if (zeroExposureNumbers.length > 0) {
                    const randomIndex = Math.floor(Math.random() * zeroExposureNumbers.length);
                    const selectedNumber = zeroExposureNumbers[randomIndex];
                    console.log(`🛡️ Protected: Using random zero-exposure number ${selectedNumber} from [${zeroExposureNumbers.join(',')}]`);
                    
                                    // Ensure combinations are initialized
                if (!global.wingoCombinations) {
                    console.log('⚠️ Wingo combinations not initialized, initializing now...');
                    await initializeGameCombinations();
                }
                
                return global.wingoCombinations[selectedNumber];
                }
                
                // CRITICAL FIX: Never fall back to exposure-based selection in protection mode
                // Instead, force a result that makes the user lose
                console.log(`🛡️ CRITICAL: No zero-exposure numbers found, forcing user loss`);
                
                // Get all user bets to ensure we select a losing result
                const betHashKey = `bets:${gameType}:${duration}:${timeline}:${periodId}`;
                const betsData = await redisClient.hgetall(betHashKey);
                const userBetOutcomes = new Set();
                
                // Collect all outcomes the user bet on
                for (const [betId, betJson] of Object.entries(betsData)) {
                    try {
                        const bet = JSON.parse(betJson);
                        if (bet.betType === 'COLOR' && bet.betValue === 'red') {
                            // User bet on red - add red numbers
                            userBetOutcomes.add(0); userBetOutcomes.add(2); 
                            userBetOutcomes.add(4); userBetOutcomes.add(6); 
                            userBetOutcomes.add(8);
                        } else if (bet.betType === 'COLOR' && bet.betValue === 'green') {
                            // User bet on green - add green numbers
                            userBetOutcomes.add(1); userBetOutcomes.add(3); 
                            userBetOutcomes.add(5); userBetOutcomes.add(7); 
                            userBetOutcomes.add(9);
                        } else if (bet.betType === 'NUMBER') {
                            // User bet on specific number
                            userBetOutcomes.add(parseInt(bet.betValue));
                        }
                    } catch (parseError) {
                        continue;
                    }
                }
                
                // Find a number that the user did NOT bet on
                const losingNumbers = [];
                for (let num = 0; num <= 9; num++) {
                    if (!userBetOutcomes.has(num)) {
                        losingNumbers.push(num);
                    }
                }
                
                // If user bet on everything, use the number with lowest exposure
                if (losingNumbers.length === 0) {
                    console.log(`🛡️ User bet on all numbers, using lowest exposure number`);
                    let minExposure = Infinity;
                    let lowestExposureNumber = 0;
                    
                    for (let num = 0; num <= 9; num++) {
                        const exposure = parseInt(wingoExposures[`number:${num}`] || 0);
                        if (exposure < minExposure) {
                            minExposure = exposure;
                            lowestExposureNumber = num;
                        }
                    }
                    
                    console.log(`🛡️ Selected lowest exposure number: ${lowestExposureNumber}`);
                    
                    if (!global.wingoCombinations) {
                        await initializeGameCombinations();
                    }
                    return global.wingoCombinations[lowestExposureNumber];
                }
                
                // Select a random losing number
                const randomLosingNumber = losingNumbers[Math.floor(Math.random() * losingNumbers.length)];
                console.log(`🛡️ Selected losing number: ${randomLosingNumber} from [${losingNumbers.join(',')}]`);
                
                if (!global.wingoCombinations) {
                    await initializeGameCombinations();
                }
                return global.wingoCombinations[randomLosingNumber];

            case 'k3':
                // Find zero exposure combination
                const k3Exposures = await redisClient.hgetall(exposureKey);
                const zeroExposureK3 = [];
                
                for (const [key, combo] of Object.entries(global.k3Combinations)) {
                    const exposure = parseInt(k3Exposures[`dice:${key}`] || 0);
                    if (exposure === 0) {
                        zeroExposureK3.push({ key, combo });
                    }
                }
                
                // Randomly select from zero-exposure combinations
                if (zeroExposureK3.length > 0) {
                    const randomIndex = Math.floor(Math.random() * zeroExposureK3.length);
                    const selected = zeroExposureK3[randomIndex];
                    console.log(`🛡️ Protected: Using random zero-exposure K3 ${selected.key}`);
                    
                    // Ensure combinations are initialized
                    if (!global.k3Combinations) {
                        console.log('⚠️ K3 combinations not initialized, initializing now...');
                        await initializeGameCombinations();
                    }
                    
                    return selected.combo;
                }
                
                // CRITICAL FIX: Never fall back to exposure-based selection in protection mode
                console.log(`🛡️ CRITICAL: No zero-exposure K3 combinations found, forcing user loss`);
                
                // Get all user bets to ensure we select a losing result
                const k3BetHashKey = `bets:${gameType}:${duration}:${timeline}:${periodId}`;
                const k3BetsData = await redisClient.hgetall(k3BetHashKey);
                const k3UserBetOutcomes = new Set();
                
                // Collect all outcomes the user bet on
                for (const [betId, betJson] of Object.entries(k3BetsData)) {
                    try {
                        const bet = JSON.parse(betJson);
                        if (bet.betType === 'SUM') {
                            k3UserBetOutcomes.add(parseInt(bet.betValue));
                        } else if (bet.betType === 'TRIPLE') {
                            k3UserBetOutcomes.add(bet.betValue);
                        }
                    } catch (parseError) {
                        continue;
                    }
                }
                
                // Find combinations that the user did NOT bet on
                const k3LosingCombinations = [];
                for (const [key, combo] of Object.entries(global.k3Combinations)) {
                    const sum = combo.dice_a + combo.dice_b + combo.dice_c;
                    const triple = combo.dice_a === combo.dice_b && combo.dice_b === combo.dice_c ? 
                        `${combo.dice_a}${combo.dice_b}${combo.dice_c}` : null;
                    
                    const isLosing = !k3UserBetOutcomes.has(sum) && 
                                   (!triple || !k3UserBetOutcomes.has(triple));
                    
                    if (isLosing) {
                        k3LosingCombinations.push({ key, combo });
                    }
                }
                
                // If user bet on everything, use the combination with lowest exposure
                if (k3LosingCombinations.length === 0) {
                    console.log(`🛡️ User bet on all K3 outcomes, using lowest exposure combination`);
                    let minExposure = Infinity;
                    let lowestExposureKey = '1,1,1';
                    
                    for (const [key, combo] of Object.entries(global.k3Combinations)) {
                        const exposure = parseInt(k3Exposures[`dice:${key}`] || 0);
                        if (exposure < minExposure) {
                            minExposure = exposure;
                            lowestExposureKey = key;
                        }
                    }
                    
                    console.log(`🛡️ Selected lowest exposure K3 combination: ${lowestExposureKey}`);
                    return global.k3Combinations[lowestExposureKey];
                }
                
                // Select a random losing combination
                const randomLosingCombo = k3LosingCombinations[Math.floor(Math.random() * k3LosingCombinations.length)];
                console.log(`🛡️ Selected losing K3 combination: ${randomLosingCombo.key}`);
                
                return randomLosingCombo.combo;

            case 'fived':
            case '5d':
                // Query for zero-bet positions
                const models = await ensureModelsInitialized();
                const betExposures = await redisClient.hgetall(exposureKey);
                const unbetPositions = findUnbetPositions(betExposures);

                // Build query for combinations with unbet positions
                let conditions = [];
                for (const [pos, values] of Object.entries(unbetPositions)) {
                    if (values.length > 0 && values.length < 10) {
                        conditions.push(`dice_${pos.toLowerCase()} IN (${values.join(',')})`);
                    }
                }

                if (conditions.length > 0) {
                    const query = `
                        SELECT dice_value, dice_a, dice_b, dice_c, dice_d, dice_e,
                               sum_value, sum_size, sum_parity, winning_conditions
                        FROM game_combinations_5d
                        WHERE ${conditions.join(' OR ')}
                        ORDER BY RAND()
                        LIMIT 1
                    `;

                    const result = await models.sequelize.query(query, {
                        type: models.sequelize.QueryTypes.SELECT
                    });

                    if (result.length > 0) {
                        console.log(`🛡️ Protected: Using zero-exposure 5D combination`);
                        return format5DResult(result[0]);
                    }
                }

                // CRITICAL FIX: Never fall back to exposure-based selection in protection mode
                console.log(`🛡️ CRITICAL: No zero-exposure 5D combinations found, forcing user loss`);
                
                // Get all user bets to ensure we select a losing result
                const fivedBetHashKey = `bets:${gameType}:${duration}:${timeline}:${periodId}`;
                const fivedBetsData = await redisClient.hgetall(fivedBetHashKey);
                const fivedUserBetOutcomes = new Set();
                
                // Collect all outcomes the user bet on
                for (const [betId, betJson] of Object.entries(fivedBetsData)) {
                    try {
                        const bet = JSON.parse(betJson);
                        if (bet.betType === 'SUM') {
                            fivedUserBetOutcomes.add(parseInt(bet.betValue));
                        } else if (bet.betType === 'POSITION') {
                            fivedUserBetOutcomes.add(`${bet.betValue}_${bet.position}`);
                        }
                    } catch (parseError) {
                        continue;
                    }
                }
                
                // Find a combination that the user did NOT bet on
                const fivedLosingCombinations = [];
                
                // Query for combinations with unbet positions or sums
                let losingQuery = `
                    SELECT dice_value, dice_a, dice_b, dice_c, dice_d, dice_e,
                           sum_value, sum_size, sum_parity, winning_conditions
                    FROM game_combinations_5d
                    WHERE 1=1
                `;
                
                // Add conditions for unbet sums
                const unbetSums = [];
                for (let sum = 0; sum <= 45; sum++) {
                    if (!fivedUserBetOutcomes.has(sum)) {
                        unbetSums.push(sum);
                    }
                }
                
                if (unbetSums.length > 0) {
                    losingQuery += ` AND sum_value IN (${unbetSums.join(',')})`;
                }
                
                losingQuery += ` ORDER BY RAND() LIMIT 100`;
                
                const losingResults = await models.sequelize.query(losingQuery, {
                    type: models.sequelize.QueryTypes.SELECT
                });
                
                if (losingResults.length > 0) {
                    console.log(`🛡️ Selected losing 5D combination with unbet sum`);
                    return format5DResult(losingResults[0]);
                }
                
                // Ultimate fallback: use lowest probability combination
                console.log(`🛡️ User bet on all 5D outcomes, using lowest probability combination`);
                const fallbackResult = await models.sequelize.query(`
                    SELECT dice_value, dice_a, dice_b, dice_c, dice_d, dice_e,
                           sum_value, sum_size, sum_parity, winning_conditions
                    FROM game_combinations_5d
                    WHERE sum_value IN (0, 1, 2, 3, 4, 41, 42, 43, 44, 45)
                    ORDER BY RAND()
                    LIMIT 1
                `, { type: models.sequelize.QueryTypes.SELECT });
                
                return format5DResult(fallbackResult[0]);

            default:
                throw new Error(`Unknown game type: ${gameType}`);
        }

    } catch (error) {
        logger.error('Error selecting protected result with exposure', {
            error: error.message, gameType, periodId
        });
        // Ultimate fallback
        return await generateRandomResult(gameType);
    }
}

/**
 * Calculate result with verification
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 * @param {string} periodId - Period ID
 * @returns {Promise<Object>} - Result with verification
 */
/**
 * UPDATED: Enhanced result calculation with protection
 * REPLACE existing calculateResultWithVerification function
 */
async function calculateResultWithVerification(gameType, duration, periodId, timeline = 'default') {
    try {
        console.log('🎲 [RESULT_START] ==========================================');
        console.log('🎲 [RESULT_START] Calculating result for period:', {
            gameType, duration, periodId, timeline
        });

        // Check user count for protection
        console.log('👥 [RESULT_USERS] Checking user count for protection...');
        const uniqueUserCount = await getUniqueUserCount(gameType, duration, periodId, timeline);
        const shouldUseProtectedResult = uniqueUserCount < ENHANCED_USER_THRESHOLD;

        console.log('🔍 [RESULT_USERS] User count check result:', {
            gameType, periodId, timeline,
            uniqueUserCount,
            shouldUseProtectedResult,
            threshold: ENHANCED_USER_THRESHOLD
        });

        let result;

        if (shouldUseProtectedResult) {
            console.log('🛡️ [RESULT_PROTECTION] Using PROTECTED result selection');
            console.log('🛡️ [RESULT_PROTECTION] Reason: INSUFFICIENT_USERS');
            
            // Use simplified protection logic with pre-generated combinations
            result = await selectProtectedResultWithExposure(
                gameType, duration, periodId, timeline
            );
        } else {
            console.log('📊 [RESULT_NORMAL] Using NORMAL exposure-based result selection');
            // Normal operation - use exposure-based result
            result = await getOptimalResultByExposure(gameType, duration, periodId);
        }

        console.log('🎯 [RESULT_FINAL] Selected result:', result);

        // Get verification only for TrxWix
        let verification = null;
        if (gameType.toLowerCase() === 'trx_wix') {
            verification = await tronHashService.getResultWithVerification(result);
        }

        const finalResult = {
            success: true,
            result: result,
            verification: verification ? {
                hash: verification.hash,
                link: verification.link
            } : null,
            protectionMode: shouldUseProtectedResult,
            protectionReason: shouldUseProtectedResult ? 'INSUFFICIENT_USERS' : 'NORMAL_OPERATION',
            timeline: timeline
        };

        console.log('🎲 [RESULT_END] ==========================================');
        console.log('🎲 [RESULT_END] Final result with verification:', {
            result: finalResult.result,
            protectionMode: finalResult.protectionMode,
            protectionReason: finalResult.protectionReason
        });

        return finalResult;

    } catch (error) {
        logger.error('Error calculating result with verification', {
            error: error.message, gameType, periodId, timeline
        });
        throw error;
    }
}

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
            periodId
        });

        // Calculate result with verification
        const resultWithVerification = await calculateResultWithVerification(gameType, duration, periodId);

        // Process winners
        let winners = [];
        if (!resultWithVerification.allUsersLose) {
            winners = await processWinningBets(gameType, duration, periodId, resultWithVerification.result);
        } else {
            // Mark all bets as lost
            await markAllBetsAsLost(gameType, periodId);
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
            allUsersLose: resultWithVerification.allUsersLose,
            timestamp: new Date().toISOString()
        });

        return {
            success: true,
            result: resultWithVerification.result,
            verification: resultWithVerification.verification,
            winners,
            allUsersLose: resultWithVerification.allUsersLose
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
 * Mark all bets as lost for a period
 * @param {string} gameType - Game type
 * @param {string} periodId - Period ID
 */
const markAllBetsAsLost = async (gameType, periodId) => {
    try {
        // CRITICAL: Ensure models are initialized
        const models = await ensureModelsInitialized();

        let BetRecord;
        switch (gameType.toLowerCase()) {
            case 'wingo':
                BetRecord = models.BetRecordWingo;
                break;
            case 'trx_wix':
                BetRecord = models.BetRecordTrxWix;
                break;
            case 'fiveD':
                BetRecord = models.BetRecord5D;
                break;
            case 'k3':
                BetRecord = models.BetRecordK3;
                break;
            default:
                throw new Error('Invalid game type');
        }

        await BetRecord.update(
            {
                status: 'lost',
                payout: 0,
                win_amount: 0
            },
            {
                where: {
                    bet_number: periodId, // FIXED: using bet_number
                    status: 'pending'
                }
            }
        );

        logger.info('All bets marked as lost', {
            gameType,
            periodId
        });

    } catch (error) {
        logger.error('Error marking all bets as lost', {
            error: error.message,
            gameType,
            periodId
        });
        throw error;
    }
};

/**
 * Get unique user count for a period (for >= 10 users rule)
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 * @param {string} periodId - Period ID
 * @returns {Promise<number>} - Number of unique users
 */
/**
 * UPDATED: Enhanced unique user count with timeline support
 * REPLACE existing getUniqueUserCount function
 */
const getUniqueUserCount = async (gameType, duration, periodId, timeline = 'default') => {
    try {
        // FIXED: Use correct Redis hash key pattern that matches bet storage
        const betHashKey = `bets:${gameType}:${duration}:${timeline}:${periodId}`;
        const betsData = await redisClient.hgetall(betHashKey);
        const uniqueUsers = new Set();

        // Process all bets from the hash
        for (const [betId, betJson] of Object.entries(betsData)) {
            try {
                const bet = JSON.parse(betJson);
                if (bet.userId) {
                    uniqueUsers.add(bet.userId);
                }
            } catch (parseError) {
                console.warn('👥 [USER_COUNT] Failed to parse bet data:', parseError.message);
                continue;
            }
        }

        console.log('👥 [USER_COUNT] Enhanced unique user count:', {
            gameType,
            periodId,
            timeline,
            uniqueUserCount: uniqueUsers.size,
            totalBets: Object.keys(betsData).length,
            threshold: ENHANCED_USER_THRESHOLD,
            uniqueUsers: Array.from(uniqueUsers),
            betHashKey: betHashKey,
            meetsThreshold: uniqueUsers.size >= ENHANCED_USER_THRESHOLD
        });

        return uniqueUsers.size;
    } catch (error) {
        logger.error('Error getting enhanced unique user count', {
            error: error.message,
            gameType,
            periodId,
            timeline
        });
        return 0;
    }
};

/**
 * Check if current period should use minimum bet result (every 20 periods)
 * NEW FORMAT: Extract sequence from last 9 digits
 * @param {string} periodId - Period ID (YYYYMMDD000000000)
 * @returns {Promise<boolean>} - Whether this is a minimum bet period
 */
const isMinimumBetPeriod = async (periodId) => {
    try {
        // Extract the sequential number from period ID (last 9 digits)
        const sequenceStr = periodId.substring(8);
        const sequentialNumber = parseInt(sequenceStr, 10);

        // Every 20th period (20, 40, 60, 80, etc.)
        const isMinimumPeriod = sequentialNumber % 20 === 0;

        logger.info('Minimum bet period check', {
            periodId,
            sequentialNumber,
            isMinimumPeriod
        });

        return isMinimumPeriod;
    } catch (error) {
        logger.error('Error checking minimum bet period', {
            error: error.message,
            periodId
        });
        return false;
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
const getBetDistribution = async (gameType, duration, periodId, timeline = 'default') => {
    try {
        const durationKey = duration === 30 ? '30s' :
            duration === 60 ? '1m' :
                duration === 180 ? '3m' :
                    duration === 300 ? '5m' : '10m';

        // Get all possible results for the game type
        const possibleResults = await generateAllPossibleResults(gameType);

        // Get bet amounts for each possible result using timeline-aware function
        const distribution = await Promise.all(possibleResults.map(async (result) => {
            const expectedPayout = await calculateExpectedPayout(gameType, durationKey, periodId, result);
            return {
                result,
                betAmount: expectedPayout
            };
        }));

        // Get total bet amount using timeline-aware hash structure
        const betHashKey = `bets:${gameType}:${duration}:${timeline}:${periodId}`;
        const betsData = await redisClient.hgetall(betHashKey);
        
        let totalBetAmount = 0;
        for (const [betId, betJson] of Object.entries(betsData)) {
            const bet = JSON.parse(betJson);
            totalBetAmount += parseFloat(bet.netBetAmount || 0);
        }

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
            duration,
            timeline
        };

    } catch (error) {
        logger.error('Error getting bet distribution', {
            error: error.message,
            stack: error.stack,
            gameType,
            periodId,
            timeline
        });
        return {
            totalBetAmount: 0,
            distribution: [],
            periodId,
            gameType,
            duration,
            timeline
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
        // CRITICAL: Ensure models are initialized
        const models = await ensureModelsInitialized();

        logger.info('Getting enhanced game history', {
            gameType,
            duration,
            limit,
            offset,
            timestamp: new Date().toISOString()
        });

        // Validate inputs
        if (!gameType || !duration) {
            throw new Error('Game type and duration are required');
        }

        const validDurations = {
            'wingo': [30, 60, 180, 300],
            'trx_wix': [30, 60, 180, 300],
            'k3': [60, 180, 300, 600],
            'fiveD': [60, 180, 300, 600]
        };

        if (!validDurations[gameType]?.includes(duration)) {
            throw new Error(`Invalid duration ${duration} for game type ${gameType}`);
        }

        let results = [];
        let totalCount = 0;

        // Get data from appropriate model
        switch (gameType) {
            case 'wingo':
                const wingoResults = await models.BetResultWingo.findAll({
                    where: { duration: duration },
                    order: [['created_at', 'DESC']],
                    limit: limit,
                    offset: offset
                });

                totalCount = await models.BetResultWingo.count({
                    where: { duration: duration }
                });

                results = wingoResults.map(result => ({
                    periodId: result.bet_number,
                    result: {
                        number: result.result_of_number,
                        color: result.result_of_color,
                        size: result.result_of_size,
                        parity: result.result_of_number % 2 === 0 ? 'even' : 'odd' // ENHANCED: Add odd/even
                    },
                    createdAt: result.created_at,
                    duration: result.duration,
                    timeline: result.timeline,
                    gameType: 'wingo'
                }));
                break;

            case 'trx_wix':
                const trxResults = await models.BetResultTrxWix.findAll({
                    where: { duration: duration },
                    order: [['created_at', 'DESC']],
                    limit: limit,
                    offset: offset
                });

                totalCount = await models.BetResultTrxWix.count({
                    where: { duration: duration }
                });

                results = trxResults.map(result => {
                    let resultData;
                    try {
                        resultData = typeof result.result === 'string' ?
                            JSON.parse(result.result) : result.result;
                    } catch (err) {
                        resultData = { number: 0, color: 'red', size: 'Small' };
                    }

                    return {
                        periodId: result.period,
                        result: {
                            number: resultData.number,
                            color: resultData.color,
                            size: resultData.size,
                            parity: resultData.number % 2 === 0 ? 'even' : 'odd' // ENHANCED: Add odd/even
                        },
                        verification: { // ENHANCED: Add verification
                            hash: result.verification_hash,
                            link: result.verification_link
                        },
                        createdAt: result.created_at,
                        duration: result.duration,
                        timeline: result.timeline,
                        gameType: 'trx_wix'
                    };
                });
                break;

            case 'k3':
                const k3Results = await models.BetResultK3.findAll({
                    where: { duration: duration },
                    order: [['created_at', 'DESC']],
                    limit: limit,
                    offset: offset
                });

                totalCount = await models.BetResultK3.count({
                    where: { duration: duration }
                });

                results = k3Results.map(result => ({
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
                    duration: result.duration,
                    timeline: result.timeline,
                    gameType: 'k3'
                }));
                break;

            case 'fiveD':
                const fiveDResults = await models.BetResult5D.findAll({
                    where: { duration: duration },
                    order: [['created_at', 'DESC']],
                    limit: limit,
                    offset: offset
                });

                totalCount = await models.BetResult5D.count({
                    where: { duration: duration }
                });

                results = fiveDResults.map(result => ({
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
                    timeline: result.timeline,
                    gameType: 'fiveD'
                }));
                break;

            default:
                throw new Error(`Unsupported game type: ${gameType}`);
        }

        logger.info('Enhanced game history retrieved successfully', {
            gameType,
            duration,
            resultsCount: results.length,
            totalCount
        });

        return {
            success: true,
            data: {
                results: results,
                pagination: {
                    total: totalCount,
                    limit,
                    offset,
                    hasMore: offset + limit < totalCount
                }
            }
        };

    } catch (error) {
        logger.error('Error getting enhanced game history', {
            error: error.message,
            stack: error.stack,
            gameType,
            duration,
            limit,
            offset
        });

        return {
            success: false,
            message: 'Failed to get game history',
            error: error.message
        };
    }
};

/**
 * UPDATED: Enhanced getLastResult with proper format including odd/even and verification
 * REPLACE the existing getLastResult function with this enhanced version
 */



/**
 * Calculate Wingo/TRX_WIX win amount with complex payout structure
 * @param {Object} bet - Bet object
 * @param {Object} result - Game result {number, color, size}
 * @param {string} betType - Bet type (NUMBER, COLOR, SIZE, PARITY)
 * @param {string} betValue - Bet value
 * @returns {number} - Win amount (0 if loses)
 */
const calculateWingoWin = (bet, result, betType, betValue) => {
    try {
        const betAmount = parseFloat(bet.betAmount || bet.bet_amount || 0);

        switch (betType) {
            case 'NUMBER':
                // Bet on specific number (0-9) - 9.0x payout
                if (result.number === parseInt(betValue)) {
                    return betAmount * 9.0;
                }
                break;

            case 'COLOR':
                // Complex color betting with violet mechanics
                if (betValue === 'red') {
                    if (result.color === 'red') {
                        return betAmount * 2.0; // Pure red win
                    } else if (result.color === 'red_violet') {
                        return betAmount * 1.5; // Mixed color win
                    }
                } else if (betValue === 'green') {
                    if (result.color === 'green') {
                        return betAmount * 2.0; // Pure green win
                    } else if (result.color === 'green_violet') {
                        return betAmount * 1.5; // Mixed color win
                    }
                } else if (betValue === 'violet') {
                    if (result.color === 'red_violet' || result.color === 'green_violet') {
                        return betAmount * 4.5; // Violet win
                    }
                }
                break;

            case 'SIZE':
                // Big (5-9) or Small (0-4) - 2.0x payout
                const isBig = result.number >= 5;
                if ((betValue === 'big' && isBig) || (betValue === 'small' && !isBig)) {
                    return betAmount * 2.0;
                }
                break;

            case 'PARITY':
                // Odd/Even - 2.0x payout
                const isEven = result.number % 2 === 0;
                if ((betValue === 'even' && isEven) || (betValue === 'odd' && !isEven)) {
                    return betAmount * 2.0;
                }
                break;
        }

        return 0; // Bet loses
    } catch (error) {
        logger.error('Error calculating Wingo win', {
            error: error.message,
            betType,
            betValue
        });
        return 0;
    }
};

/**
 * Calculate K3 win amount with complex payout structure
 * @param {Object} bet - Bet object
 * @param {Object} result - Game result {dice_1, dice_2, dice_3, sum, has_pair, has_triple, is_straight}
 * @param {string} betType - Bet type
 * @param {string} betValue - Bet value
 * @returns {number} - Win amount (0 if loses)
 */
const calculateK3Win = (bet, result, betType, betValue) => {
    try {
        const betAmount = parseFloat(bet.betAmount || bet.bet_amount || 0);
        const sum = result.sum || (result.dice_1 + result.dice_2 + result.dice_3);

        switch (betType) {
            case 'SUM':
                // Specific sum bets with varying payouts
                const targetSum = parseInt(betValue);
                if (sum === targetSum) {
                    // Complex payout structure based on sum probability
                    const payoutMultipliers = {
                        3: 207.36, 18: 207.36,
                        4: 69.12, 17: 69.12,
                        5: 34.56, 16: 34.56,
                        6: 20.74, 15: 20.74,
                        7: 13.83, 14: 13.83,
                        8: 9.88, 13: 9.88,
                        9: 8.3, 12: 8.3,
                        10: 7.68, 11: 7.68
                    };
                    return betAmount * (payoutMultipliers[targetSum] || 1.0);
                }
                break;

            case 'SUM_CATEGORY':
                // Sum categories - 2.0x payout
                if (betValue === 'big' && sum >= 11) {
                    return betAmount * 2.0;
                } else if (betValue === 'small' && sum < 11) {
                    return betAmount * 2.0;
                } else if (betValue === 'odd' && sum % 2 === 1) {
                    return betAmount * 2.0;
                } else if (betValue === 'even' && sum % 2 === 0) {
                    return betAmount * 2.0;
                }
                break;

            case 'MATCHING_DICE':
                if (betValue === 'triple_any' && result.has_triple) {
                    return betAmount * 34.56; // Any triple
                } else if (betValue === 'pair_any' && result.has_pair && !result.has_triple) {
                    return betAmount * 13.83; // Any pair (not triple)
                } else if (betValue.startsWith('triple_') && result.has_triple) {
                    // Specific triple (e.g., triple_5 for three 5s)
                    const targetNumber = parseInt(betValue.split('_')[1]);
                    const dice = [result.dice_1, result.dice_2, result.dice_3];
                    if (dice.every(d => d === targetNumber)) {
                        return betAmount * 207.36; // Specific triple
                    }
                } else if (betValue.startsWith('pair_') && result.has_pair) {
                    // Specific pair with specific single
                    const [pairNum, singleNum] = betValue.split('_').slice(1).map(n => parseInt(n));
                    const dice = [result.dice_1, result.dice_2, result.dice_3];
                    const counts = dice.reduce((acc, val) => {
                        acc[val] = (acc[val] || 0) + 1;
                        return acc;
                    }, {});

                    if (counts[pairNum] === 2 && counts[singleNum] === 1) {
                        return betAmount * 6.91; // Specific pair with specific single
                    }
                }
                break;

            case 'PATTERN':
                if (betValue === 'all_different') {
                    // All three dice different
                    const dice = [result.dice_1, result.dice_2, result.dice_3];
                    const unique = new Set(dice);
                    if (unique.size === 3) {
                        return betAmount * 34.56;
                    }
                } else if (betValue === 'straight' && result.is_straight) {
                    return betAmount * 8.64; // Three consecutive numbers
                } else if (betValue === 'two_different' && result.has_pair && !result.has_triple) {
                    return betAmount * 6.91; // One pair
                }
                break;
        }

        return 0; // Bet loses
    } catch (error) {
        logger.error('Error calculating K3 win', {
            error: error.message,
            betType,
            betValue
        });
        return 0;
    }
};

/**
 * Calculate 5D win amount with complex payout structure
 * @param {Object} bet - Bet object
 * @param {Object} result - Game result {A, B, C, D, E, sum}
 * @param {string} betType - Bet type
 * @param {string} betValue - Bet value
 * @returns {number} - Win amount (0 if loses)
 */
const calculateFiveDWin = (bet, result, betType, betValue) => {
    try {
        const betAmount = parseFloat(bet.betAmount || bet.bet_amount || 0);

        switch (betType) {
            case 'POSITION':
                // Bet on specific number in specific position - 2.0x payout
                const [position, number] = betValue.split('_');
                if (result[position] === parseInt(number)) {
                    return betAmount * 2.0;
                }
                break;

            case 'POSITION_SIZE':
                // Position size betting - 2.0x payout
                const [pos, sizeType] = betValue.split('_');
                const posValue = result[pos];
                const isBig = posValue >= 5;
                if ((sizeType === 'big' && isBig) || (sizeType === 'small' && !isBig)) {
                    return betAmount * 2.0;
                }
                break;

            case 'POSITION_PARITY':
                // Position parity betting - 2.0x payout
                const [position2, parityType] = betValue.split('_');
                const posValue2 = result[position2];
                const isEven = posValue2 % 2 === 0;
                if ((parityType === 'even' && isEven) || (parityType === 'odd' && !isEven)) {
                    return betAmount * 2.0;
                }
                break;

            case 'SUM':
                // Sum betting - 1.98x payout
                const sum = result.sum || (result.A + result.B + result.C + result.D + result.E);
                if (betValue === 'big' && sum > 22) {
                    return betAmount * 1.98;
                } else if (betValue === 'small' && sum <= 22) {
                    return betAmount * 1.98;
                } else if (betValue === 'odd' && sum % 2 === 1) {
                    return betAmount * 1.98;
                } else if (betValue === 'even' && sum % 2 === 0) {
                    return betAmount * 1.98;
                }
                break;
        }

        return 0; // Bet loses
    } catch (error) {
        logger.error('Error calculating 5D win', {
            error: error.message,
            betType,
            betValue
        });
        return 0;
    }
};


/**
 * NEW FUNCTION: Enhance result format based on game type
 * ADD this function to gameLogicService.js
 */
const enhanceResultFormat = async (result, gameType) => {
    try {
        let enhancedResult = { ...result };

        switch (gameType.toLowerCase()) {
            case 'wingo':
                // Ensure parity is included
                if (!enhancedResult.parity) {
                    enhancedResult.parity = enhancedResult.number % 2 === 0 ? 'even' : 'odd';
                }
                break;

            case 'trx_wix':
                // Ensure parity is included
                if (!enhancedResult.parity) {
                    enhancedResult.parity = enhancedResult.number % 2 === 0 ? 'even' : 'odd';
                }
                // Ensure verification is included
                if (!enhancedResult.verification) {
                    enhancedResult.verification = {
                        hash: generateVerificationHash(),
                        link: generateVerificationLink()
                    };
                }
                break;

            case 'k3':
                // K3 results are already properly formatted
                break;

            case 'fived':
            case '5d':
                // 5D results are already properly formatted
                break;
        }

        return enhancedResult;
    } catch (error) {
        logger.error('Error enhancing result format', {
            error: error.message,
            gameType,
            result
        });
        return result; // Return original if enhancement fails
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
        console.log('🔄 Processing winning bets with bet_number field...', {
            gameType, duration, periodId
        });

        // CRITICAL: Ensure models are initialized
        const models = await ensureModelsInitialized();

        let bets = [];
        const winningBets = [];

        // Get bets for the period based on game type - USING bet_number ONLY
        switch (gameType.toLowerCase()) {
            case 'wingo':
                console.log('📊 Querying BetRecordWingo with bet_number:', periodId);
                bets = await models.BetRecordWingo.findAll({
                    where: { bet_number: periodId }, // ONLY bet_number, NO period
                    transaction: t
                });
                console.log(`✅ Found ${bets.length} wingo bets`);
                break;

            case 'trx_wix':
                console.log('📊 Querying BetRecordTrxWix with bet_number:', periodId);
                bets = await models.BetRecordTrxWix.findAll({
                    where: { bet_number: periodId }, // ONLY bet_number, NO period
                    transaction: t
                });
                console.log(`✅ Found ${bets.length} trx_wix bets`);
                break;

            case 'fived':
            case '5d':
                console.log('📊 Querying BetRecord5D with bet_number:', periodId);
                bets = await models.BetRecord5D.findAll({
                    where: { bet_number: periodId }, // ONLY bet_number, NO period
                    transaction: t
                });
                console.log(`✅ Found ${bets.length} 5D bets`);
                break;

            case 'k3':
                console.log('📊 Querying BetRecordK3 with bet_number:', periodId);
                bets = await models.BetRecordK3.findAll({
                    where: { bet_number: periodId }, // ONLY bet_number, NO period
                    transaction: t
                });
                console.log(`✅ Found ${bets.length} K3 bets`);
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
                    await models.User.increment('wallet_balance', {
                        by: winnings,
                        where: { user_id: bet.user_id },
                        transaction: t
                    });

                    // Update bet status
                    await bet.update({
                        status: 'won',
                        payout: winnings,
                        win_amount: winnings,
                        wallet_balance_after: parseFloat(bet.wallet_balance_before) + winnings,
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

                    console.log('✅ Processed winning bet:', {
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
                        win_amount: 0,
                        wallet_balance_after: bet.wallet_balance_before,
                        result: JSON.stringify(result)
                    }, { transaction: t });
                }
            } catch (betError) {
                console.error('❌ Error processing individual bet:', {
                    error: betError.message,
                    betId: bet.bet_id,
                    userId: bet.user_id,
                    gameType
                });
                continue;
            }
        }

        console.log(`🎯 Processed ${winningBets.length} winning bets out of ${bets.length} total bets`);
        return winningBets;

    } catch (error) {
        console.error('❌ Error processing winning bets:', {
            error: error.message,
            stack: error.stack,
            gameType,
            periodId
        });
        throw error;
    }
};

/**
 * Check if a bet is a winner
 * @param {Object} bet - Bet record
 * @param {Object} result - Game result
 * @param {string} gameType - Game type
 * @returns {boolean} - Whether bet is a winner
 */
const checkBetWin = async (bet, result, gameType) => {
    try {
        const [betType, betValue] = bet.bet_type.split(':');

        switch (gameType.toLowerCase()) {
            case 'wingo':
            case 'trx_wix':
                // Use in-memory combinations
                if (!global.wingoCombinatons) {
                    console.log('⚠️ Wingo combinations not initialized, initializing now...');
                    await initializeGameCombinations();
                }
                
                const wingoCombo = global.wingoCombinatons[result.number];
                if (!wingoCombo) return false;
                
                return checkWinCondition(wingoCombo, betType, betValue);

            case 'fived':
            case '5d':
                // For 5D, check directly from result
                if (betType === 'POSITION') {
                    const [pos, value] = betValue.split('_');
                    return result[pos] === parseInt(value);
                } else if (betType === 'POSITION_SIZE') {
                    const [pos, size] = betValue.split('_');
                    const posValue = result[pos];
                    return size === 'big' ? posValue >= 5 : posValue < 5;
                } else if (betType === 'POSITION_PARITY') {
                    const [pos, parity] = betValue.split('_');
                    const posValue = result[pos];
                    return parity === 'even' ? posValue % 2 === 0 : posValue % 2 === 1;
                } else if (betType === 'SUM') {
                    const sum = result.A + result.B + result.C + result.D + result.E;
                    return sum === parseInt(betValue);
                } else if (betType === 'SUM_SIZE') {
                    const sum = result.A + result.B + result.C + result.D + result.E;
                    return betValue === 'big' ? sum >= 22 : sum < 22;
                } else if (betType === 'SUM_PARITY') {
                    const sum = result.A + result.B + result.C + result.D + result.E;
                    return betValue === 'even' ? sum % 2 === 0 : sum % 2 === 1;
                }
                break;

            case 'k3':
                // Use in-memory combinations
                const k3Key = `${result.dice_1},${result.dice_2},${result.dice_3}`;
                const k3Combo = global.k3Combinations[k3Key];
                if (!k3Combo) return false;
                
                return checkK3WinCondition(k3Combo, betType, betValue);
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
        // Use amount_after_tax instead of bet_amount for winnings calculation
        const winnings = bet.amount_after_tax * odds;

        logger.info('Calculated winnings', {
            betId: bet.bet_id,
            betAmount: bet.bet_amount,
            amountAfterTax: bet.amount_after_tax,
            taxAmount: bet.tax_amount,
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
        // CRITICAL: Ensure models are initialized
        const models = await ensureModelsInitialized();

        let result;
        const whereClause = duration ? { duration: duration } : {};

        switch (gameType) {
            case 'wingo':
                result = await models.BetResultWingo.findOne({
                    where: whereClause,
                    order: [['created_at', 'DESC']]
                });
                if (result) {
                    return {
                        success: true,
                        result: {
                            periodId: result.bet_number,
                            result: {
                                number: result.result_of_number,
                                color: result.result_of_color,
                                size: result.result_of_size,
                                parity: result.result_of_number % 2 === 0 ? 'even' : 'odd' // ENHANCED: Add odd/even
                            },
                            createdAt: result.created_at,
                            duration: result.duration,
                            timeline: result.timeline,
                            gameType: 'wingo'
                        }
                    };
                }
                break;

            case 'fiveD':
                result = await models.BetResult5D.findOne({
                    where: whereClause,
                    order: [['created_at', 'DESC']]
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
                            gameType: 'fiveD'
                        }
                    };
                }
                break;

            case 'k3':
                result = await models.BetResultK3.findOne({
                    where: whereClause,
                    order: [['created_at', 'DESC']]
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
                            gameType: 'k3'
                        }
                    };
                }
                break;

            case 'trx_wix':
                result = await models.BetResultTrxWix.findOne({
                    order: [['created_at', 'DESC']]
                });
                if (result) {
                    let resultData;
                    try {
                        resultData = typeof result.result === 'string' ? JSON.parse(result.result) : result.result;
                    } catch (err) {
                        console.error('Error parsing result data:', err);
                        resultData = result.result || { number: 0, color: 'red', size: 'Small' };
                    }

                    return {
                        success: true,
                        result: {
                            periodId: result.period,
                            result: {
                                number: resultData.number,
                                color: resultData.color,
                                size: resultData.size,
                                parity: resultData.number % 2 === 0 ? 'even' : 'odd' // ENHANCED: Add odd/even
                            },
                            verification: { // ENHANCED: Add verification
                                hash: result.verification_hash,
                                link: result.verification_link
                            },
                            createdAt: result.created_at,
                            gameType: 'trx_wix'
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
        console.error('Error getting enhanced last result:', error);
        return {
            success: false,
            message: 'Error retrieving last result',
            error: error.message
        };
    }
};

/**
 * UPDATED: Enhanced generateRandomResult with proper format including verification for trx_wix
 * REPLACE the existing generateRandomResult function with this enhanced version
 */


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
 * NEW FORMAT: Parse YYYYMMDD000000000
 * @param {string} periodId - Period ID
 * @param {number} duration - Duration in seconds
 * @returns {Date} - End time of the period
 */
const calculatePeriodEndTime = (periodId, duration) => {
    try {
        // Parse period ID to get date and sequence
        const dateStr = periodId.substring(0, 8);
        const sequenceStr = periodId.substring(8);

        const year = parseInt(dateStr.substring(0, 4), 10);
        const month = parseInt(dateStr.substring(4, 6), 10) - 1; // 0-indexed
        const day = parseInt(dateStr.substring(6, 8), 10);
        const sequenceNumber = parseInt(sequenceStr, 10);

        // Create start time (base time = 2 AM IST + sequence * duration)
        const baseTime = moment.tz([year, month, day, 2, 0, 0], 'Asia/Kolkata');
        const startTime = baseTime.add(sequenceNumber * duration, 'seconds');

        // Add duration to get end time
        const endTime = startTime.clone().add(duration, 'seconds');

        return endTime.toDate();
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
const hasBets = async (gameType, duration, periodId, timeline = 'default') => {
    try {
        // Use timeline-aware hash structure
        const betHashKey = `bets:${gameType}:${duration}:${timeline}:${periodId}`;
        const betsData = await redisClient.hgetall(betHashKey);

        return Object.keys(betsData).length > 0;
    } catch (error) {
        logger.error('Error checking if period has bets', {
            error: error.message,
            stack: error.stack,
            gameType,
            duration,
            periodId,
            timeline
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

/**
 * Get minimum bet result for a period
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 * @param {string} periodId - Period ID
 * @returns {Object} - Minimum bet result
 */
const getMinimumBetResult = async (gameType, duration, periodId) => {
    try {
        // Get result with zero or minimum exposure
        const result = await getOptimalResultByExposure(gameType, duration, periodId);
        
        logger.info('Retrieved minimum exposure result', {
            gameType,
            duration,
            periodId,
            result
        });

        return result;
    } catch (error) {
        logger.error('Error getting minimum bet result', {
            error: error.message,
            stack: error.stack,
            gameType,
            duration,
            periodId
        });

        // Fallback to random result if there's an error
        return generateRandomResult(gameType);
    }
};

/**
 * Calculate complex win amount based on game-specific payout structures
 * @param {Object} bet - Bet object with bet_type and bet_amount
 * @param {Object} result - Game result
 * @param {string} gameType - Game type
 * @returns {number} - Win amount (0 if bet loses)
 */
const calculateComplexWinAmount = (bet, result, gameType) => {
    try {
        const [betType, betValue] = bet.bet_type.split(':');

        switch (gameType.toLowerCase()) {
            case 'wingo':
            case 'trx_wix':
                return calculateWingoWin(bet, result, betType, betValue);
            case 'k3':
                return calculateK3Win(bet, result, betType, betValue);
            case 'fived':
            case '5d':
                return calculateFiveDWin(bet, result, betType, betValue);
            default:
                logger.warn('Unknown game type in win calculation', { gameType });
                return 0;
        }
    } catch (error) {
        logger.error('Error calculating complex win amount', {
            error: error.message,
            bet: bet.bet_type,
            gameType
        });
        return 0;
    }
};



/**
 * Validate a fallback result for a game type (UPDATED)
 * @param {Object} result - Result to validate
 * @param {string} gameType - Game type
 * @returns {Object} - Validation result
 */
const validateFallbackResult = async (result, gameType) => {
    try {
        const warnings = [];

        if (!result) {
            return { isSafe: false, warnings: ['Result is null or undefined'] };
        }

        // Validate result structure based on game type
        switch (gameType.toLowerCase()) {
            case 'wingo':
            case 'trx_wix':
                if (typeof result.number !== 'number' || result.number < 0 || result.number > 9) {
                    warnings.push('Invalid number in result');
                }
                if (!['big', 'small'].includes(result.size?.toLowerCase())) {
                    warnings.push('Invalid size in result');
                }

                // UPDATED: Validate color matches the deterministic rule
                const expectedColor = getColorForNumber(result.number);
                if (result.color !== expectedColor) {
                    warnings.push(`Color mismatch: number ${result.number} should have color ${expectedColor}, got ${result.color}`);
                }

                // Validate color is one of the valid colors
                if (!['red', 'green', 'red_violet', 'green_violet'].includes(result.color?.toLowerCase())) {
                    warnings.push('Invalid color in result');
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
                // Validate each dice value
                ['A', 'B', 'C', 'D', 'E'].forEach(dice => {
                    if (typeof result[dice] !== 'number' || result[dice] < 1 || result[dice] > 6) {
                        warnings.push(`Invalid value for dice ${dice}`);
                    }
                });
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
                // Validate each dice value
                ['dice_1', 'dice_2', 'dice_3'].forEach(dice => {
                    if (typeof result[dice] !== 'number' || result[dice] < 1 || result[dice] > 6) {
                        warnings.push(`Invalid value for ${dice}`);
                    }
                });
                break;

            default:
                warnings.push(`Unsupported game type: ${gameType}`);
        }

        // Additional validation for all game types
        if (result.verificationHash && typeof result.verificationHash !== 'string') {
            warnings.push('Invalid verification hash format');
        }

        if (result.verificationLink && typeof result.verificationLink !== 'string') {
            warnings.push('Invalid verification link format');
        }

        // Check for any suspicious patterns
        if (await checkSuspiciousPatterns(result, gameType)) {
            warnings.push('Suspicious result pattern detected');
        }

        return {
            isSafe: warnings.length === 0,
            warnings
        };
    } catch (error) {
        logger.error('Error validating fallback result', {
            error: error.message,
            stack: error.stack,
            gameType
        });
        return {
            isSafe: false,
            warnings: ['Error during validation: ' + error.message]
        };
    }
};

/**
 * Check for suspicious patterns in a result
 * @param {Object} result - Result to check
 * @param {string} gameType - Game type
 * @returns {boolean} - Whether suspicious patterns were found
 */
const checkSuspiciousPatterns = async (result, gameType) => {
    try {
        switch (gameType.toLowerCase()) {
            case 'wingo':
            case 'trx_wix':
                // Check for repeated numbers
                const lastResults = await getLastResults(gameType, 5);
                if (lastResults.some(r => r.number === result.number)) {
                    return true;
                }
                break;

            case 'fived':
            case '5d':
                // Check for all same numbers
                if (result.A === result.B && result.B === result.C &&
                    result.C === result.D && result.D === result.E) {
                    return true;
                }
                break;

            case 'k3':
                // Check for all same numbers
                if (result.dice_1 === result.dice_2 &&
                    result.dice_2 === result.dice_3) {
                    return true;
                }
                break;
        }
        return false;
    } catch (error) {
        logger.error('Error checking suspicious patterns', {
            error: error.message,
            stack: error.stack,
            gameType
        });
        return false;
    }
};

/**
 * Generate a fallback result for a game type (UPDATED)
 * @param {string} gameType - Game type
 * @returns {Object} - Generated fallback result
 */
const generateFallbackResult = async (gameType) => {
    try {
        switch (gameType.toLowerCase()) {
            case 'wingo':
            case 'trx_wix':
                const number = Math.floor(Math.random() * 10); // 0-9
                return {
                    number: number,
                    size: number >= 5 ? 'big' : 'small',
                    color: getColorForNumber(number) // Use deterministic color
                };

            case 'fived':
            case '5d':
                const dice = Array(5).fill(0).map(() => Math.floor(Math.random() * 6) + 1); // 1-6
                return {
                    A: dice[0],
                    B: dice[1],
                    C: dice[2],
                    D: dice[3],
                    E: dice[4],
                    sum: dice.reduce((a, b) => a + b, 0)
                };

            case 'k3':
                const k3Dice = Array(3).fill(0).map(() => Math.floor(Math.random() * 6) + 1); // 1-6
                const sum = k3Dice.reduce((a, b) => a + b, 0);
                const counts = k3Dice.reduce((acc, val) => {
                    acc[val] = (acc[val] || 0) + 1;
                    return acc;
                }, {});

                return {
                    dice_1: k3Dice[0],
                    dice_2: k3Dice[1],
                    dice_3: k3Dice[2],
                    sum: sum,
                    has_pair: Object.values(counts).includes(2),
                    has_triple: Object.values(counts).includes(3),
                    is_straight: k3Dice.sort().every((val, idx, arr) =>
                        idx === 0 || val === arr[idx - 1] + 1
                    ),
                    sum_size: sum > 10 ? 'big' : 'small',
                    sum_parity: sum % 2 === 0 ? 'even' : 'odd'
                };

            default:
                throw new Error(`Unsupported game type: ${gameType}`);
        }
    } catch (error) {
        logger.error('Error generating fallback result', {
            error: error.message,
            stack: error.stack,
            gameType
        });
        throw error;
    }
};

/**
 * Generate a random result for a game type (FIXED)
 * @param {string} gameType - Game type
 * @returns {Object} - Generated random result
 */
const generateRandomResult = async (gameType) => {
    try {
        console.log('🎲 Generating random result for:', gameType);

        let result;
        switch (gameType.toLowerCase()) {
            case 'wingo':
                const number = Math.floor(Math.random() * 10); // 0-9
                result = {
                    number: number,
                    size: number >= 5 ? 'Big' : 'Small', // FIXED: Capital case to match DB enum
                    color: getColorForNumber(number),
                    parity: number % 2 === 0 ? 'even' : 'odd'
                };
                break;

            case 'trx_wix':
                const trxNumber = Math.floor(Math.random() * 10); // 0-9
                result = {
                    number: trxNumber,
                    size: trxNumber >= 5 ? 'Big' : 'Small', // FIXED: Capital case
                    color: getColorForNumber(trxNumber),
                    parity: trxNumber % 2 === 0 ? 'even' : 'odd',
                    verification: {
                        hash: generateVerificationHash(),
                        link: generateVerificationLink()
                    }
                };
                break;

            case 'fived':
            case '5d':
                // FIXED: Generate proper 5D result with all required fields
                const dice = [];
                for (let i = 0; i < 5; i++) {
                    dice.push(Math.floor(Math.random() * 6) + 1); // 1-6
                }

                result = {
                    A: dice[0],
                    B: dice[1],
                    C: dice[2],
                    D: dice[3],
                    E: dice[4],
                    sum: dice.reduce((a, b) => a + b, 0)
                };

                // Validate 5D result
                if (!result.A || !result.B || !result.C || !result.D || !result.E) {
                    throw new Error('Invalid 5D result generated');
                }
                break;

            case 'k3':
                // FIXED: Generate proper K3 result with all required fields
                const k3Dice = [];
                for (let i = 0; i < 3; i++) {
                    k3Dice.push(Math.floor(Math.random() * 6) + 1); // 1-6
                }

                const sum = k3Dice.reduce((a, b) => a + b, 0);
                const counts = k3Dice.reduce((acc, val) => {
                    acc[val] = (acc[val] || 0) + 1;
                    return acc;
                }, {});

                result = {
                    dice_1: k3Dice[0],
                    dice_2: k3Dice[1],
                    dice_3: k3Dice[2],
                    sum: sum,
                    has_pair: Object.values(counts).includes(2) && !Object.values(counts).includes(3),
                    has_triple: Object.values(counts).includes(3),
                    is_straight: k3Dice.sort((a, b) => a - b).every((val, idx, arr) =>
                        idx === 0 || val === arr[idx - 1] + 1
                    ),
                    sum_size: sum > 10 ? 'Big' : 'Small', // FIXED: Capital case
                    sum_parity: sum % 2 === 0 ? 'Even' : 'Odd' // FIXED: Capital case
                };

                // Validate K3 result
                if (!result.dice_1 || !result.dice_2 || !result.dice_3) {
                    throw new Error('Invalid K3 result generated');
                }
                break;

            default:
                throw new Error(`Unsupported game type: ${gameType}`);
        }

        console.log('✅ Generated result:', result);

        // Final validation
        if (!result) {
            throw new Error('Failed to generate result');
        }

        return result;

    } catch (error) {
        console.error('❌ Error generating random result:', {
            error: error.message,
            stack: error.stack,
            gameType
        });
        throw error;
    }
};

/**
 * Generate verification hash for TRX_WIX
 */
const generateVerificationHash = () => {
    const crypto = require('crypto');
    return crypto.randomBytes(32).toString('hex');
};

/**
 * Generate verification link for TRX_WIX
 */
const generateVerificationLink = () => {
    const hash = generateVerificationHash();
    return `https://tronscan.org/#/transaction/${hash}`;
};




/**
 * Store a bet in Redis and trigger real-time optimization update
 * @param {Object} betData - Bet data to store
 * @returns {Promise<boolean>} - Whether storage was successful
 */
async function storeBetInRedis(betData) {
    try {
        const {
            userId, gameType, duration, periodId,
            betType, betValue, betAmount, odds
        } = betData;

        const durationKey = duration === 30 ? '30s' :
            duration === 60 ? '1m' :
                duration === 180 ? '3m' :
                    duration === 300 ? '5m' : '10m';

        // Store in hash structure
        const betId = await indexBetInHash(gameType, duration, periodId, 'default', betData);

        // Update total bet amount
        const totalKey = `${gameType}:${durationKey}:${periodId}:total`;
        await redisClient.incrbyfloat(totalKey, betAmount);

        // Update exposure tracking
        await updateBetExposure(gameType, duration, periodId, {
            betType,
            betValue,
            netBetAmount: betAmount, // Use betAmount as netBetAmount for this function
            odds
        });

        logger.info('Bet stored in Redis with exposure tracking', {
            gameType, duration, periodId, userId, betType, betValue, betAmount
        });

        return true;
    } catch (error) {
        logger.error('Error storing bet in Redis', { error: error.message, betData });
        return false;
    }
}


/**
 * ENHANCED: Validate bet with timeline support
 * @param {Object} betData - Bet data
 * @returns {Object} - Validation result
 */
/**
 * UPDATED: Enhanced bet validation with platform fee
 * REPLACE existing validateBetWithTimeline function
 */
const validateBetWithTimeline = async (betData) => {
    const {
        userId,
        gameType,
        duration,
        timeline,
        periodId,
        betType,
        betValue,
        betAmount
    } = betData;

    try {
        // Basic validation
        if (!userId || !gameType || !duration || !periodId || !betType || !betValue || !betAmount) {
            return {
                valid: false,
                message: 'Missing required bet information',
                code: 'INVALID_DATA'
            };
        }

        const grossBetAmount = parseFloat(betAmount);

        // Calculate platform fee (2%)
        const platformFee = grossBetAmount * PLATFORM_FEE_RATE;
        const netBetAmount = grossBetAmount - platformFee;

        // Validate minimum bet on NET amount
        if (netBetAmount < 1) {
            return {
                valid: false,
                message: 'Net bet amount after platform fee must be at least ₹1',
                code: 'MINIMUM_NET_BET',
                breakdown: {
                    grossAmount: grossBetAmount,
                    platformFee: platformFee,
                    netAmount: netBetAmount
                }
            };
        }

        // Validate maximum bet on GROSS amount
        if (grossBetAmount > 100000) {
            return {
                valid: false,
                message: 'Maximum bet amount is ₹1,00,000',
                code: 'MAXIMUM_BET'
            };
        }

        // Validate game type and duration
        const validGameTypes = ['wingo', 'trx_wix', 'k3', 'fiveD'];
        if (!validGameTypes.includes(gameType)) {
            return {
                valid: false,
                message: 'Invalid game type',
                code: 'INVALID_GAME_TYPE'
            };
        }

        const validDurations = {
            'wingo': [30, 60, 180, 300],
            'trx_wix': [30, 60, 180, 300],
            'k3': [60, 180, 300, 600],
            'fiveD': [60, 180, 300, 600]
        };

        if (!validDurations[gameType]?.includes(duration)) {
            return {
                valid: false,
                message: `Invalid duration ${duration} for game type ${gameType}`,
                code: 'INVALID_DURATION'
            };
        }

        // Validate timeline
        const validTimelines = ['default', 'timeline2', 'timeline3', 'timeline4'];
        if (!validTimelines.includes(timeline)) {
            return {
                valid: false,
                message: 'Invalid timeline',
                code: 'INVALID_TIMELINE'
            };
        }

        // Check user balance against GROSS amount
        const models = await ensureModelsInitialized();
        const user = await models.User.findByPk(userId);

        if (!user) {
            return {
                valid: false,
                message: 'User not found',
                code: 'USER_NOT_FOUND'
            };
        }

        const userBalance = parseFloat(user.wallet_balance || 0);
        if (userBalance < grossBetAmount) {
            return {
                valid: false,
                message: `Insufficient balance. Required: ₹${grossBetAmount.toFixed(2)} (including ₹${platformFee.toFixed(2)} platform fee)`,
                code: 'INSUFFICIENT_BALANCE',
                breakdown: {
                    grossAmount: grossBetAmount,
                    platformFee: platformFee,
                    netAmount: netBetAmount,
                    userBalance: userBalance
                }
            };
        }

        // Check user's betting frequency
        const userBetCount = await getUserBetCount(userId, gameType, periodId);
        if (userBetCount >= 50) {
            return {
                valid: false,
                message: 'Maximum bets per period reached',
                code: 'MAX_BETS_REACHED'
            };
        }

        // Check if period is still active
        const periodStatus = await getPeriodStatusWithTimeline(gameType, duration, timeline, periodId);
        if (!periodStatus.active || periodStatus.timeRemaining <= 5) {
            return {
                valid: false,
                message: 'Betting period has ended',
                code: 'BETTING_CLOSED'
            };
        }

        return {
            valid: true,
            message: 'Bet validated successfully',
            amounts: {
                grossBetAmount,
                platformFee,
                netBetAmount
            }
        };

    } catch (error) {
        console.error('❌ Error validating bet:', error);
        return {
            valid: false,
            message: 'Error validating bet',
            code: 'VALIDATION_ERROR'
        };
    }
};


/**
 * Store bet in Redis with timeline support
 * @param {Object} betData - Bet data to store
 * @returns {Promise<boolean>} - Whether storage was successful
 */
/**
 * UPDATED: Enhanced Redis storage with platform fee tracking
 * REPLACE existing storeBetInRedisWithTimeline function
 */
const storeBetInRedisWithTimeline = async (betData) => {
    try {
        const {
            userId, gameType, duration, timeline, periodId,
            betType, betValue, odds,
            grossBetAmount, platformFee, netBetAmount
        } = betData;

        const durationKey = duration === 30 ? '30s' :
            duration === 60 ? '1m' :
                duration === 180 ? '3m' :
                    duration === 300 ? '5m' : '10m';

        // Store bet in hash structure
        const betId = await indexBetInHash(gameType, duration, periodId, timeline, {
            userId,
            betType,
            betValue,
            grossBetAmount,
            platformFee,
            netBetAmount,
            odds
        });

        // Update totals
        const totalKey = `${gameType}:${durationKey}:${timeline}:${periodId}:total`;
        const currentTotal = await redisClient.get(totalKey) || '0';
        const newTotal = parseFloat(currentTotal) + parseFloat(netBetAmount);
        await redisClient.set(totalKey, newTotal.toString());

        // Track platform fees
        const feeKey = `${gameType}:${durationKey}:${timeline}:${periodId}:fees`;
        const currentFees = await redisClient.get(feeKey) || '0';
        const newFees = parseFloat(currentFees) + parseFloat(platformFee);
        await redisClient.set(feeKey, newFees.toString());

        // Track gross amounts
        const grossKey = `${gameType}:${durationKey}:${timeline}:${periodId}:gross`;
        const currentGross = await redisClient.get(grossKey) || '0';
        const newGross = parseFloat(currentGross) + parseFloat(grossBetAmount);
        await redisClient.set(grossKey, newGross.toString());

        // Update exposure tracking
        await updateBetExposure(gameType, duration, periodId, {
            betType,
            betValue,
            netBetAmount,
            odds
        });

        // Set expiry for all keys
        await redisClient.expire(totalKey, 86400);
        await redisClient.expire(feeKey, 86400);
        await redisClient.expire(grossKey, 86400);

        console.log(`✅ Bet stored in Redis with exposure tracking for ${gameType} ${duration}s ${timeline}`);
        return true;
    } catch (error) {
        console.error('❌ Error storing bet in Redis:', error);
        return false;
    }
};



/**
 * Get period status with timeline support
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 * @param {string} timeline - Timeline
 * @param {string} periodId - Period ID
 * @returns {Object} - Period status
 */
const getPeriodStatusWithTimeline = async (gameType, duration, timeline, periodId) => {
    try {
        // Use the same timing validation as WebSocket service
        const now = new Date();
        const actualEndTime = calculatePeriodEndTime(periodId, duration);
        const timeRemaining = Math.max(0, Math.ceil((actualEndTime - now) / 1000));
        const bettingOpen = timeRemaining > 5;

        return {
            active: true, // Assume active if we can calculate time remaining
            timeRemaining: timeRemaining,
            bettingOpen: bettingOpen,
            periodId: periodId
        };
    } catch (error) {
        console.error('❌ Error getting period status:', error);
        return {
            active: false,
            timeRemaining: 0,
            bettingOpen: false
        };
    }
};

/**
 * NEW: Select fallback result when 60/40 rule fails
 * Uses lowest, 2nd lowest, 3rd lowest chain
 */
const selectFallbackResult = async (gameType, duration, periodId) => {
    try {
        const durationKey = duration === 30 ? '30s' :
            duration === 60 ? '1m' :
                duration === 180 ? '3m' :
                    duration === 300 ? '5m' : '10m';

        // Get fallback data from Redis
        const fallbackKey = `${gameType}:${durationKey}:${periodId}:fallbacks`;
        const fallbackData = await redisClient.get(fallbackKey);

        if (fallbackData) {
            const fallbacks = JSON.parse(fallbackData);

            // Create fallback options array
            const fallbackOptions = [
                fallbacks.lowestPayout,
                fallbacks.secondLowest,
                fallbacks.thirdLowest
            ].filter(option => option && option.result);

            if (fallbackOptions.length > 0) {
                // Randomly select from available fallback options
                const selectedFallback = fallbackOptions[Math.floor(Math.random() * fallbackOptions.length)];

                console.log(`🔄 FALLBACK: Selected ${fallbackOptions.indexOf(selectedFallback) + 1} of ${fallbackOptions.length} options`);

                return selectedFallback.result;
            }
        }

        // If no fallback data available, generate random
        console.log(`🆘 FALLBACK: No fallback data, using random`);
        return await generateRandomResult(gameType);

    } catch (error) {
        console.error('Error selecting fallback result:', error);
        return await generateRandomResult(gameType);
    }
};


/**
 * ENHANCED: Process game results with timeline support
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 * @param {string} periodId - Period ID
 * @param {string} timeline - Timeline
 * @returns {Promise<Object>} - Result data
 */
/**
 * FIXED: Enhanced result processing with complete optimization flow
 */
async function processGameResults(gameType, duration, periodId, timeline = 'default', transaction = null) {
    const lockKey = `process_${gameType}_${duration}_${periodId}_${timeline}`;
    
    try {
        console.log('🎲 [PROCESS_START] ==========================================');
        console.log('🎲 [PROCESS_START] Processing game results:', {
            gameType,
            duration,
            periodId,
            timeline,
            timestamp: new Date().toISOString()
        });
        console.log('🎲 [PROCESS_START] ==========================================');

        // Memory lock
        if (globalProcessingLocks.has(lockKey)) {
            console.log(`🔒 Already processing ${periodId}, waiting...`);
            let attempts = 0;
            while (globalProcessingLocks.has(lockKey) && attempts < 30) {
                await new Promise(resolve => setTimeout(resolve, 500));
                attempts++;
            }
            const existingResult = await checkExistingResult(gameType, duration, periodId, timeline);
            if (existingResult) {
                return {
                    success: true,
                    result: existingResult.dbResult,
                    gameResult: existingResult.gameResult,
                    winners: existingResult.winners || [],
                    timeline: timeline,
                    source: 'memory_wait'
                };
            }
        }
        
        globalProcessingLocks.set(lockKey, { timestamp: Date.now(), processId: process.pid });

        const models = await ensureModelsInitialized();
        const useTransaction = transaction || await sequelize.transaction();
        const shouldCommit = !transaction;
        
        try {
            // Check existing result
            let existingResult = await checkExistingResult(gameType, duration, periodId, timeline, useTransaction);
            if (existingResult) {
                console.log(`⚠️ Result exists, returning existing`);
                if (shouldCommit) await useTransaction.commit();
                return {
                    success: true,
                    result: existingResult.dbResult,
                    gameResult: existingResult.gameResult,
                    winners: existingResult.winners || [],
                    timeline: timeline,
                    source: 'existing_db'
                };
            }
            
            // Redis lock
            const redisLockKey = `processing_lock_${gameType}_${duration}_${periodId}_${timeline}`;
            const redisLockValue = `${Date.now()}_${process.pid}`;
            const redisLockAcquired = await redisClient.set(redisLockKey, redisLockValue, 'EX', 30, 'NX');
            
            if (!redisLockAcquired) {
                console.log(`🔒 Redis lock failed, waiting...`);
                if (shouldCommit) await useTransaction.rollback();
                let attempts = 0;
                while (attempts < 20) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    const waitResult = await checkExistingResult(gameType, duration, periodId, timeline);
                    if (waitResult) {
                        return {
                            success: true,
                            result: waitResult.dbResult,
                            gameResult: waitResult.gameResult,
                            winners: waitResult.winners || [],
                            timeline: timeline,
                            source: 'redis_wait'
                        };
                    }
                    attempts++;
                }
                throw new Error('Failed to get result after Redis lock wait');
            }
            
            try {
                // Final check after Redis lock
                existingResult = await checkExistingResult(gameType, duration, periodId, timeline, useTransaction);
                if (existingResult) {
                    if (shouldCommit) await useTransaction.commit();
                    return {
                        success: true,
                        result: existingResult.dbResult,
                        gameResult: existingResult.gameResult,
                        winners: existingResult.winners || [],
                        timeline: timeline,
                        source: 'final_check'
                    };
                }
                
                        // Generate result using exposure-based selection
        console.log('🎯 [PROCESS_RESULT] Generating NEW result with exposure-based optimization');
        console.log('🎯 [PROCESS_RESULT] Calling calculateResultWithVerification...');
        
        console.log('🎯 [PROCESS_RESULT] About to call calculateResultWithVerification with params:', {
            gameType, duration, periodId, timeline
        });
        
        const resultWithVerification = await calculateResultWithVerification(gameType, duration, periodId, timeline);
                const result = resultWithVerification.result;
                
                console.log('🎯 [PROCESS_RESULT] Result generated successfully:', {
                    result: result,
                    protectionMode: resultWithVerification.protectionMode,
                    protectionReason: resultWithVerification.protectionReason,
                    verification: resultWithVerification.verification
                });
                
                // Save to database
                let savedResult;
                if (gameType === 'wingo') {
                    savedResult = await models.BetResultWingo.create({
                        bet_number: periodId,
                        result_of_number: result.number,
                        result_of_size: result.size,
                        result_of_color: result.color,
                        duration: duration,
                        timeline: timeline
                    }, { transaction: useTransaction });
                    
                } else if (gameType === 'fiveD' || gameType === '5d') {
                    savedResult = await models.BetResult5D.create({
                        bet_number: periodId,
                        result_a: result.A,
                        result_b: result.B,
                        result_c: result.C,
                        result_d: result.D,
                        result_e: result.E,
                        total_sum: result.sum,
                        duration: duration,
                        timeline: timeline
                    }, { transaction: useTransaction });
                    
                } else if (gameType === 'k3') {
                    savedResult = await models.BetResultK3.create({
                        bet_number: periodId,
                        dice_1: result.dice_1,
                        dice_2: result.dice_2,
                        dice_3: result.dice_3,
                        sum: result.sum,
                        has_pair: result.patterns?.pair || false,
                        has_triple: result.patterns?.triple || false,
                        is_straight: result.patterns?.straight || false,
                        sum_size: result.sum_size,
                        sum_parity: result.sum_parity,
                        duration: duration,
                        timeline: timeline
                    }, { transaction: useTransaction });
                    
                } else if (gameType === 'trx_wix') {
                    savedResult = await models.BetResultTrxWix.create({
                        period: periodId,
                        result: JSON.stringify(result),
                        verification_hash: resultWithVerification.verification?.hash || generateVerificationHash(),
                        verification_link: resultWithVerification.verification?.link || generateVerificationLink(),
                        duration: duration,
                        timeline: timeline
                    }, { transaction: useTransaction });
                }
                
                console.log('🏆 [PROCESS_WINNERS] Processing winning bets...');
                // Process winners
                const winners = await processWinningBetsWithTimeline(gameType, duration, periodId, timeline, result, useTransaction);
                
                console.log('🏆 [PROCESS_WINNERS] Winners processed:', {
                    winnerCount: winners.length,
                    winners: winners.map(w => ({ userId: w.userId, winnings: w.winnings }))
                });
                
                console.log('🔄 [PROCESS_CLEANUP] Resetting period exposure...');
                // Reset exposure for next period
                await resetPeriodExposure(gameType, duration, periodId);
                
                if (shouldCommit) await useTransaction.commit();
                
                console.log('✅ [PROCESS_COMPLETE] Complete result processing done');
                console.log('🎲 [PROCESS_END] ==========================================');
                
                return {
                    success: true,
                    result: savedResult,
                    gameResult: result,
                    winners: winners,
                    timeline: timeline,
                    source: 'new_result',
                    protectionMode: resultWithVerification.protectionMode,
                    protectionReason: resultWithVerification.protectionReason
                };
                
            } finally {
                // Release Redis lock
                try {
                    const currentLock = await redisClient.get(redisLockKey);
                    if (currentLock === redisLockValue) {
                        await redisClient.del(redisLockKey);
                    }
                } catch (lockError) {
                    console.error('❌ Error releasing Redis lock:', lockError);
                }
            }
            
        } catch (error) {
            if (shouldCommit) await useTransaction.rollback();
            throw error;
        }
        
    } catch (error) {
        console.error(`❌ Error processing game results:`, error);
        throw error;
    } finally {
        globalProcessingLocks.delete(lockKey);
    }
}


const checkExistingResult = async (gameType, duration, periodId, timeline = 'default', transaction = null) => {
    try {
        const models = await ensureModelsInitialized();

        let existingResult = null;
        const queryOptions = {
            where: {
                duration: duration,
                timeline: timeline
            },
            order: [['created_at', 'DESC']]
        };

        if (transaction) {
            queryOptions.transaction = transaction;
            queryOptions.lock = true; // Add FOR UPDATE lock
        }

        switch (gameType.toLowerCase()) {
            case 'wingo':
                queryOptions.where.bet_number = periodId;
                existingResult = await models.BetResultWingo.findOne(queryOptions);

                if (existingResult) {
                    return {
                        dbResult: existingResult,
                        gameResult: {
                            number: existingResult.result_of_number,
                            color: existingResult.result_of_color,
                            size: existingResult.result_of_size
                        },
                        winners: []
                    };
                }
                break;

            case 'trx_wix':
                queryOptions.where.period = periodId;
                existingResult = await models.BetResultTrxWix.findOne(queryOptions);

                if (existingResult) {
                    let resultData;
                    try {
                        resultData = typeof existingResult.result === 'string' ?
                            JSON.parse(existingResult.result) : existingResult.result;
                    } catch (parseError) {
                        console.warn('Error parsing existing result:', parseError);
                        return null;
                    }

                    return {
                        dbResult: existingResult,
                        gameResult: resultData,
                        winners: []
                    };
                }
                break;

            case 'fived':
            case '5d':
                queryOptions.where.bet_number = periodId;
                existingResult = await models.BetResult5D.findOne(queryOptions);

                if (existingResult) {
                    return {
                        dbResult: existingResult,
                        gameResult: {
                            A: existingResult.result_a,
                            B: existingResult.result_b,
                            C: existingResult.result_c,
                            D: existingResult.result_d,
                            E: existingResult.result_e,
                            sum: existingResult.total_sum
                        },
                        winners: []
                    };
                }
                break;

            case 'k3':
                queryOptions.where.bet_number = periodId;
                existingResult = await models.BetResultK3.findOne(queryOptions);

                if (existingResult) {
                    return {
                        dbResult: existingResult,
                        gameResult: {
                            dice_1: existingResult.dice_1,
                            dice_2: existingResult.dice_2,
                            dice_3: existingResult.dice_3,
                            sum: existingResult.sum,
                            has_pair: existingResult.has_pair,
                            has_triple: existingResult.has_triple,
                            is_straight: existingResult.is_straight,
                            sum_size: existingResult.sum_size,
                            sum_parity: existingResult.sum_parity
                        },
                        winners: []
                    };
                }
                break;
        }

        return null;

    } catch (error) {
        console.error('Error checking existing result:', error);
        return null;
    }
};

/**
 * Generate result specific to timeline (can be different for each timeline)
 * @param {string} gameType - Game type
 * @param {string} timeline - Timeline
 * @returns {Object} - Generated result
 */
const generateResultForTimeline = async (gameType, timeline) => {
    try {
        // You can implement different logic for different timelines
        // For now, each timeline gets a different random result

        // Seed the random number based on timeline for variation
        const timelineSeed = timeline === 'default' ? 1 :
            timeline === 'timeline2' ? 2 :
                timeline === 'timeline3' ? 3 : 4;

        let result;
        switch (gameType.toLowerCase()) {
            case 'wingo':
                const number = (Math.floor(Math.random() * 10) + timelineSeed) % 10;
                result = {
                    number: number,
                    size: number >= 5 ? 'Big' : 'Small',
                    color: getColorForNumber(number)
                };
                break;

            case 'trx_wix':
                const trxNumber = (Math.floor(Math.random() * 10) + timelineSeed) % 10;
                result = {
                    number: trxNumber,
                    size: trxNumber >= 5 ? 'Big' : 'Small',
                    color: getColorForNumber(trxNumber),
                    verification: {
                        hash: generateVerificationHash(),
                        link: generateVerificationLink()
                    }
                };
                break;

            case 'fived':
            case '5d':
                const dice = [];
                for (let i = 0; i < 5; i++) {
                    dice.push(((Math.floor(Math.random() * 6) + 1) + timelineSeed) % 6 + 1);
                }

                result = {
                    A: dice[0],
                    B: dice[1],
                    C: dice[2],
                    D: dice[3],
                    E: dice[4],
                    sum: dice.reduce((a, b) => a + b, 0)
                };
                break;

            case 'k3':
                const k3Dice = [];
                for (let i = 0; i < 3; i++) {
                    k3Dice.push(((Math.floor(Math.random() * 6) + 1) + timelineSeed) % 6 + 1);
                }

                const sum = k3Dice.reduce((a, b) => a + b, 0);
                const counts = k3Dice.reduce((acc, val) => {
                    acc[val] = (acc[val] || 0) + 1;
                    return acc;
                }, {});

                result = {
                    dice_1: k3Dice[0],
                    dice_2: k3Dice[1],
                    dice_3: k3Dice[2],
                    sum: sum,
                    has_pair: Object.values(counts).includes(2) && !Object.values(counts).includes(3),
                    has_triple: Object.values(counts).includes(3),
                    is_straight: k3Dice.sort((a, b) => a - b).every((val, idx, arr) =>
                        idx === 0 || val === arr[idx - 1] + 1
                    ),
                    sum_size: sum > 10 ? 'Big' : 'Small',
                    sum_parity: sum % 2 === 0 ? 'Even' : 'Odd'
                };
                break;

            default:
                throw new Error(`Unsupported game type: ${gameType}`);
        }

        console.log(`🎯 Generated result for ${gameType} ${timeline}:`, result);
        return result;

    } catch (error) {
        console.error(`❌ Error generating result for ${timeline}:`, error);
        throw error;
    }
};


/**
 * Process winning bets with timeline support
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 * @param {string} periodId - Period ID
 * @param {string} timeline - Timeline
 * @param {Object} result - Game result
 * @returns {Array} - Array of winning bets
 */
const processWinningBetsWithTimeline = async (gameType, duration, periodId, timeline, result, transaction = null) => {
    try {
        console.log(`🔄 Processing winning bets for ${gameType} ${duration}s ${timeline} - ${periodId}`);

        const models = await ensureModelsInitialized();
        const useTransaction = transaction || await sequelize.transaction();
        const shouldCommit = !transaction;

        try {
            let bets = [];
            const winningBets = [];

            // Get bets for this specific timeline
            const whereCondition = {
                bet_number: periodId,
                timeline: timeline
            };

            switch (gameType.toLowerCase()) {
                case 'wingo':
                    bets = await models.BetRecordWingo.findAll({
                        where: whereCondition,
                        transaction: useTransaction
                    });
                    break;
                case 'trx_wix':
                    bets = await models.BetRecordTrxWix.findAll({
                        where: whereCondition,
                        transaction: useTransaction
                    });
                    break;
                case 'fived':
                case '5d':
                    bets = await models.BetRecord5D.findAll({
                        where: whereCondition,
                        transaction: useTransaction
                    });
                    break;
                case 'k3':
                    bets = await models.BetRecordK3.findAll({
                        where: whereCondition,
                        transaction: useTransaction
                    });
                    break;
            }

            console.log(`📊 Found ${bets.length} bets for ${timeline}`);

            // Process each bet
            for (const bet of bets) {
                try {
                    const isWinner = checkBetWin(bet, result, gameType);
                    if (isWinner) {
                        const winnings = calculateWinnings(bet, gameType);

                        // Update user balance
                        await models.User.increment('wallet_balance', {
                            by: winnings,
                            where: { user_id: bet.user_id },
                            transaction: useTransaction
                        });

                        // Update bet status
                        await bet.update({
                            status: 'won',
                            payout: winnings,
                            win_amount: winnings,
                            wallet_balance_after: parseFloat(bet.wallet_balance_before) + winnings,
                            result: JSON.stringify(result)
                        }, { transaction: useTransaction });

                        winningBets.push({
                            userId: bet.user_id,
                            betId: bet.bet_id,
                            winnings,
                            betAmount: bet.bet_amount,
                            betType: bet.bet_type,
                            timeline: timeline,
                            result: result
                        });

                        console.log(`✅ Processed winning bet for user ${bet.user_id} in ${timeline}: ₹${winnings}`);
                    } else {
                        // Mark bet as lost
                        await bet.update({
                            status: 'lost',
                            payout: 0,
                            win_amount: 0,
                            wallet_balance_after: bet.wallet_balance_before,
                            result: JSON.stringify(result)
                        }, { transaction: useTransaction });
                    }
                } catch (betError) {
                    console.error(`❌ Error processing bet ${bet.bet_id}:`, betError);
                    continue;
                }
            }

            if (shouldCommit) {
                await useTransaction.commit();
            }

            console.log(`🎯 Processed ${winningBets.length} winning bets out of ${bets.length} total bets for ${timeline}`);
            return winningBets;

        } catch (error) {
            if (shouldCommit) {
                await useTransaction.rollback();
            }
            throw error;
        }

    } catch (error) {
        console.error(`❌ Error processing winning bets for ${timeline}:`, error);
        throw error;
    }
};


/**
 * ENHANCED: Process bet with timeline support and proper validation
 * @param {Object} betData - Bet data to process
 * @returns {Promise<Object>} - Processing result
 */
/**
 * UPDATED: Enhanced bet processing with platform fee
 * REPLACE existing processBet function
 */
const processBet = async (betData) => {
    try {
        console.log('🎯 [BET_START] ==========================================');
        console.log('🎯 [BET_START] NEW BET RECEIVED:', betData);
        console.log('🎯 [BET_START] ==========================================');

        const validation = await validateBetWithTimeline(betData);
        if (!validation.valid) {
            console.log('❌ [BET_VALIDATION] Bet validation failed:', validation);
            return validation;
        }

        const { grossBetAmount, platformFee, netBetAmount } = validation.amounts;
        const {
            userId, gameType, duration, timeline = 'default',
            periodId, betType, betValue, odds
        } = betData;

        console.log('✅ [BET_VALIDATION] Bet validation passed:', {
            userId, gameType, duration, timeline, periodId,
            grossBetAmount, platformFee, netBetAmount, odds
        });

        const models = await ensureModelsInitialized();
        const { sequelize: sequelizeInstance } = require('../config/db');
        const t = await sequelizeInstance.transaction();

        try {
            // Get user with locking
            const user = await models.User.findByPk(userId, {
                lock: true,
                transaction: t
            });

            // Deduct GROSS amount from user balance
            await models.User.decrement('wallet_balance', {
                by: grossBetAmount,
                where: { user_id: userId },
                transaction: t
            });

            // Store bet in appropriate database table
            let betRecord;
            const betTypeFormatted = `${betType}:${betValue}`;
            const currentWalletBalance = parseFloat(user.wallet_balance);

            const betRecordData = {
                user_id: userId,
                bet_number: periodId,
                bet_type: betTypeFormatted,
                bet_amount: grossBetAmount,
                tax_amount: platformFee,
                amount_after_tax: netBetAmount,
                odds: odds,
                status: 'pending',
                wallet_balance_before: currentWalletBalance,
                wallet_balance_after: currentWalletBalance - grossBetAmount,
                timeline: timeline,
                duration: duration,
                created_at: new Date()
            };

            switch (gameType) {
                case 'wingo':
                    betRecord = await models.BetRecordWingo.create(betRecordData, { transaction: t });
                    break;
                case 'trx_wix':
                    betRecord = await models.BetRecordTrxWix.create(betRecordData, { transaction: t });
                    break;
                case 'k3':
                    betRecord = await models.BetRecordK3.create(betRecordData, { transaction: t });
                    break;
                case 'fiveD':
                    betRecord = await models.BetRecord5D.create(betRecordData, { transaction: t });
                    break;
                default:
                    throw new Error(`Unsupported game type: ${gameType}`);
            }

            console.log('✅ [BET_PROCESS] Bet record created with platform fee');

            console.log('💾 [BET_DATABASE] Bet stored in database successfully:', {
                betId: betRecord.bet_id || betRecord.id,
                userId,
                periodId,
                status: 'pending'
            });

            // Store bet in Redis with exposure tracking
            console.log('📊 [BET_EXPOSURE] Starting exposure tracking...');
            const redisStored = await storeBetInRedisWithTimeline({
                ...betData,
                grossBetAmount,
                platformFee,
                netBetAmount,
                betAmount: netBetAmount
            });
            
            if (!redisStored) {
                console.log('❌ [BET_EXPOSURE] Redis storage failed');
                await t.rollback();
                return {
                    success: false,
                    message: 'Failed to process bet',
                    code: 'REDIS_STORAGE_FAILED'
                };
            }
            console.log('✅ [BET_EXPOSURE] Bet stored in Redis with exposure tracking');

            await t.commit();

            // Record VIP experience
            try {
                await recordVipExperience(userId, grossBetAmount, gameType, betRecord.bet_id);
            } catch (vipError) {
                console.error('⚠️ Error recording VIP experience:', vipError);
            }

            // Process self rebate
            try {
                await processSelfRebate(userId, grossBetAmount, gameType, betRecord.bet_id);
            } catch (rebateError) {
                console.error('⚠️ Error processing self rebate:', rebateError);
            }

            // Process activity reward
            try {
                await processBetForActivityReward(userId, grossBetAmount, gameType);
            } catch (activityError) {
                console.error('⚠️ Error processing activity reward:', activityError);
            }

            const response = {
                success: true,
                message: 'Bet placed successfully',
                data: {
                    betId: betRecord.bet_id || betRecord.id,
                    gameType,
                    duration,
                    timeline,
                    periodId,
                    grossBetAmount,
                    platformFee,
                    netBetAmount,
                    betType,
                    betValue,
                    odds,
                    expectedWin: netBetAmount * odds,
                    walletBalanceAfter: currentWalletBalance - grossBetAmount,
                    breakdown: {
                        amountEntered: grossBetAmount,
                        platformFee: platformFee,
                        amountInGame: netBetAmount,
                        maxWin: netBetAmount * odds
                    }
                }
            };

            console.log('🎉 [BET_SUCCESS] Bet processed successfully:', {
                betId: response.data.betId,
                expectedWin: response.data.expectedWin,
                walletBalanceAfter: response.data.walletBalanceAfter
            });
            console.log('🎯 [BET_END] ==========================================');

            return response;

        } catch (error) {
            await t.rollback();
            throw error;
        }

    } catch (error) {
        console.error('❌ [BET_PROCESS] Error in processBet:', error);
        return {
            success: false,
            message: 'Failed to process bet',
            code: 'PROCESSING_ERROR'
        };
    }
};


/**
 * Calculate odds for a bet type
 * @param {string} gameType - Game type
 * @param {string} betType - Type of bet
 * @param {string} betValue - Value bet on
 * @returns {number} - Calculated odds
 */
const calculateOdds = (gameType, betType, betValue) => {
    try {
        switch (gameType.toLowerCase()) {
            case 'wingo':
            case 'trx_wix':
                switch (betType) {
                    case 'NUMBER':
                        return 9.0; // 1:9 odds for specific number
                    case 'COLOR':
                        return betValue === 'red_violet' || betValue === 'green_violet' ? 1.5 : 2.0;
                    case 'SIZE':
                        return 2.0;
                    case 'PARITY':
                        return 2.0;
                    default:
                        return 1.0;
                }

            case 'fived':
            case '5d':
                switch (betType) {
                    case 'POSITION':
                        return 6.0; // 1:6 odds for specific position
                    case 'SUM':
                        return 10.0; // 1:10 odds for specific sum
                    case 'DRAGON_TIGER':
                        return 2.0;
                    default:
                        return 1.0;
                }

            case 'k3':
                switch (betType) {
                    case 'SUM':
                        return 10.0;
                    case 'MATCHING_DICE':
                        return betValue === 'triplet' ? 30.0 : 3.0;
                    case 'STRAIGHT':
                        return 6.0;
                    case 'SIZE':
                        return 2.0;
                    case 'PARITY':
                        return 2.0;
                    default:
                        return 1.0;
                }

            default:
                return 1.0;
        }
    } catch (error) {
        logger.error('Error calculating odds', {
            error: error.message,
            gameType,
            betType,
            betValue
        });
        return 1.0;
    }
};

/**
 * Get active periods for a game type
 * @param {string} gameType - Game type
 * @returns {Promise<Array>} - Array of active periods
 */
const getActivePeriods = async (gameType) => {
    try {
        const activePeriods = [];
        const durations = [30, 60, 180, 300, 600];

        for (const duration of durations) {
            const durationKey = duration === 30 ? '30s' :
                duration === 60 ? '1m' :
                    duration === 180 ? '3m' :
                        duration === 300 ? '5m' : '10m';

            // Get current period
            const currentPeriod = await periodService.getCurrentPeriod(gameType, duration);
            if (currentPeriod) {
                activePeriods.push({
                    gameType,
                    duration,
                    periodId: currentPeriod.periodId,
                    startTime: currentPeriod.startTime,
                    endTime: currentPeriod.endTime,
                    timeRemaining: currentPeriod.timeRemaining
                });
            }
        }

        return activePeriods;
    } catch (error) {
        logger.error('Error getting active periods', {
            error: error.message,
            stack: error.stack,
            gameType
        });
        return [];
    }
};

/**
 * Store temporary result in Redis
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 * @param {string} periodId - Period ID
 * @param {Object} result - Result to store
 * @returns {Promise<boolean>} - Whether storage was successful
 */
const storeTemporaryResult = async (gameType, duration, periodId, result) => {
    try {
        const durationKey = duration === 30 ? '30s' :
            duration === 60 ? '1m' :
                duration === 180 ? '3m' :
                    duration === 300 ? '5m' : '10m';

        // Create Redis key for temporary result
        const tempResultKey = `${gameType}:${durationKey}:${periodId}:temp_result`;

        // Store result
        await redisClient.set(tempResultKey, JSON.stringify({
            result,
            timestamp: Date.now()
        }));

        // Set expiry for 1 hour
        await redisClient.expire(tempResultKey, 3600);

        logger.info('Temporary result stored', {
            gameType,
            duration,
            periodId,
            result
        });

        return true;
    } catch (error) {
        logger.error('Error storing temporary result', {
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
 * Get user's bet history with pagination
 * @param {string} userId - User ID
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 * @param {Object} options - Options object
 * @returns {Object} - Bet history with pagination
 */
const getUserBetHistory = async (userId, gameType, duration, options = {}) => {
    try {
        // CRITICAL: Ensure models are initialized
        const models = await ensureModelsInitialized();

        const {
            page = 1,
            limit = 10,
            periodId = null,
            status = null,
            startDate = null,
            endDate = null
        } = options;

        const offset = (page - 1) * limit;

        logger.info('Getting user bet history', {
            userId,
            gameType,
            duration,
            page,
            limit,
            periodId,
            status,
            startDate,
            endDate
        });

        // Build where clause
        const whereClause = {
            user_id: userId
        };

        if (periodId) {
            whereClause.bet_number = periodId; // FIXED: using bet_number
        }

        if (status) {
            whereClause.status = status;
        }

        // Add duration filter if the model supports it
        if (duration) {
            whereClause.duration = duration;
        }

        // Add date filtering if provided
        if (startDate && endDate) {
            whereClause.created_at = {
                [Op.between]: [startDate, endDate]
            };
        }

        let bets = [];
        let totalCount = 0;

        // Get bets from appropriate model
        switch (gameType) {
            case 'wingo':
                bets = await models.BetRecordWingo.findAll({
                    where: whereClause,
                    order: [['created_at', 'DESC']],
                    limit: limit,
                    offset: offset
                });
                totalCount = await models.BetRecordWingo.count({
                    where: whereClause
                });
                break;

            case 'trx_wix':
                bets = await models.BetRecordTrxWix.findAll({
                    where: whereClause,
                    order: [['created_at', 'DESC']],
                    limit: limit,
                    offset: offset
                });
                totalCount = await models.BetRecordTrxWix.count({
                    where: whereClause
                });
                break;

            case 'k3':
                bets = await models.BetRecordK3.findAll({
                    where: whereClause,
                    order: [['created_at', 'DESC']],
                    limit: limit,
                    offset: offset
                });
                totalCount = await models.BetRecordK3.count({
                    where: whereClause
                });
                break;

            case 'fiveD':
                bets = await models.BetRecord5D.findAll({
                    where: whereClause,
                    order: [['created_at', 'DESC']],
                    limit: limit,
                    offset: offset
                });
                totalCount = await models.BetRecord5D.count({
                    where: whereClause
                });
                break;

            default:
                throw new Error(`Unsupported game type: ${gameType}`);
        }

        // Format bets for response
        const formattedBets = bets.map(bet => {
            const [betType, betValue] = bet.bet_type.split(':');

            return {
                betId: bet.bet_id || bet.id,
                periodId: bet.bet_number, // FIXED: using bet_number
                betType: betType,
                betValue: betValue,
                betAmount: parseFloat(bet.bet_amount),
                taxAmount: parseFloat(bet.tax_amount || 0),
                amountAfterTax: parseFloat(bet.amount_after_tax || 0),
                odds: parseFloat(bet.odds || 0),
                status: bet.status,
                winAmount: bet.win_amount ? parseFloat(bet.win_amount) : 0,
                payout: bet.payout ? parseFloat(bet.payout) : 0,
                profitLoss: bet.win_amount ?
                    parseFloat(bet.win_amount) - parseFloat(bet.bet_amount) :
                    -parseFloat(bet.bet_amount),
                walletBalanceBefore: parseFloat(bet.wallet_balance_before || 0),
                walletBalanceAfter: parseFloat(bet.wallet_balance_after || 0),
                createdAt: bet.created_at,
                updatedAt: bet.updated_at,
                gameType,
                duration: bet.duration || duration,
                result: bet.result ? (typeof bet.result === 'string' ? JSON.parse(bet.result) : bet.result) : null
            };
        });

        return {
            success: true,
            data: {
                bets: formattedBets,
                pagination: {
                    total: totalCount,
                    page: page,
                    limit: limit,
                    offset: offset,
                    hasMore: offset + limit < totalCount,
                    totalPages: Math.ceil(totalCount / limit)
                },
                filters: {
                    gameType,
                    duration,
                    periodId,
                    status,
                    startDate,
                    endDate
                }
            }
        };

    } catch (error) {
        logger.error('Error getting user bet history', {
            error: error.message,
            stack: error.stack,
            userId,
            gameType,
            duration
        });

        return {
            success: false,
            message: 'Failed to get user bet history',
            error: error.message
        };
    }
};

/**
 * NEW FUNCTION: Enhanced period status with betting window info
 * ADD this function to gameLogicService.js
 */
const getEnhancedPeriodStatus = async (gameType, duration, periodId) => {
    try {
        const endTime = calculatePeriodEndTime(periodId, duration);
        const now = new Date();
        const timeRemaining = Math.max(0, (endTime - now) / 1000);

        // Betting closes 5 seconds before period ends
        const bettingTimeRemaining = Math.max(0, timeRemaining - 5);
        const isBettingOpen = bettingTimeRemaining > 0;

        // Get total bets and unique users for this period
        const durationKey = duration === 30 ? '30s' :
            duration === 60 ? '1m' :
                duration === 180 ? '3m' :
                    duration === 300 ? '5m' : '10m';

        const totalBetKey = `${gameType}:${durationKey}:${periodId}:total`;
        const totalBetAmount = parseFloat(await redisClient.get(totalBetKey) || 0);

        const uniqueUserCount = await getUniqueUserCount(gameType, duration, periodId);

        return {
            success: true,
            data: {
                periodId,
                gameType,
                duration,
                active: timeRemaining > 0,
                timeRemaining: Math.round(timeRemaining),
                bettingTimeRemaining: Math.round(bettingTimeRemaining),
                isBettingOpen,
                endTime: endTime.toISOString(),
                totalBetAmount,
                uniqueUserCount,
                bettingCloseTime: new Date(endTime.getTime() - 5000).toISOString()
            }
        };

    } catch (error) {
        logger.error('Error getting enhanced period status', {
            error: error.message,
            gameType,
            duration,
            periodId
        });

        return {
            success: false,
            message: 'Failed to get period status',
            error: error.message
        };
    }
};

/**
 * NEW FUNCTION: Get user's current balance across all wallets
 * ADD this function to gameLogicService.js
 */
const getUserGameBalance = async (userId) => {
    try {
        // CRITICAL: Ensure models are initialized
        const models = await ensureModelsInitialized();

        // Get user's main wallet balance
        const user = await models.User.findByPk(userId);
        if (!user) {
            return {
                success: false,
                message: 'User not found'
            };
        }

        const mainWalletBalance = parseFloat(user.wallet_balance || 0);

        // Get third-party wallet balance if exists
        let thirdPartyWalletBalance = 0;
        try {
            const thirdPartyWallet = await models.ThirdPartyWallet.findOne({
                where: { user_id: userId, is_active: true }
            });

            if (thirdPartyWallet) {
                thirdPartyWalletBalance = parseFloat(thirdPartyWallet.balance || 0);
            }
        } catch (thirdPartyError) {
            logger.warn('Error getting third-party wallet balance', {
                error: thirdPartyError.message,
                userId
            });
        }

        const totalAvailable = mainWalletBalance + thirdPartyWalletBalance;

        return {
            success: true,
            data: {
                mainWallet: mainWalletBalance,
                thirdPartyWallet: thirdPartyWalletBalance,
                totalAvailable: totalAvailable,
                currency: 'INR', // or get from user preferences
                canPlay: totalAvailable > 0
            }
        };

    } catch (error) {
        logger.error('Error getting user game balance', {
            error: error.message,
            stack: error.stack,
            userId
        });

        return {
            success: false,
            message: 'Failed to get user balance',
            error: error.message
        };
    }
};

/**
 * ENHANCED FUNCTION: WebSocket result broadcasting
 * ADD this function to gameLogicService.js
 */
const broadcastGameResult = async (gameType, duration, periodId, result, timeline = 'default') => {
    try {
        // Get socket.io instance
        const { getIo } = require('../config/socketConfig');
        const io = getIo();

        if (!io) {
            logger.warn('Socket.IO not available for broadcasting');
            return;
        }

        // Format result for broadcast based on game type
        let broadcastData = {
            gameType,
            duration,
            periodId,
            result,
            timeline,
            timestamp: new Date().toISOString()
        };

        // Add verification for trx_wix
        if (gameType === 'trx_wix' && result.verification) {
            broadcastData.verification = result.verification;
        }

        // Use timeline-aware room ID
        const roomName = timeline === 'default' ? `${gameType}_${duration}` : `${gameType}_${duration}_${timeline}`;
        io.to(roomName).emit('gameResult', broadcastData);

        // Also broadcast to general game room
        io.to('games').emit('gameResult', broadcastData);

        logger.info('Game result broadcasted', {
            gameType,
            duration,
            periodId,
            timeline,
            roomName
        });

    } catch (error) {
        logger.error('Error broadcasting game result', {
            error: error.message,
            gameType,
            duration,
            periodId,
            timeline
        });
    }
};




module.exports = {

    validateBetWithTimeline,
    storeBetInRedisWithTimeline,
    getPeriodStatusWithTimeline,
    generateResultForTimeline,
    processWinningBetsWithTimeline,


    // Core validation and optimization
    validate60_40Result,
    shouldUseMinimumBetResult,
    getMinimumBetResult,
    validateFallbackResult,
    generateFallbackResult,
    generateRandomResult,
    calculateComplexWinAmount,

    // Game-specific calculations
    calculateWingoWin,
    calculateK3Win,
    calculateFiveDWin,

    // Bet processing
    storeBetInRedis,
    processBet,
    validateBet,
    calculateOdds,

    // User and bet tracking
    getUserBetCount,
    getLastBetTime,
    getTotalBetsOnOutcome,
    getUniqueUserCount,

    // Period management
    isMinimumBetPeriod,
    initializePeriod,
    getActivePeriods,
    getPeriodStatus,

    // Real-time optimization
    initializeCombinationTracking,
    getRealTimeOptimizedResult,

    // Performance optimization
    getPreCalculatedCombinations,
    calculateSampledPayout,
    getSumMultiplier,

    // Cache management
    clearPerformanceCaches,
    getSystemHealthCheck,

    // Result processing
    processGameResults,
    processWinningBets,
    checkBetWin,
    calculateWinnings,
    calculateResultWithVerification,

    // Game management
    endRound,
    startRound,
    overrideResult,
    markAllBetsAsLost,

    // Data and history
    getBetDistribution,
    getGameHistory,
    getLastResult,
    getLastResults,

    // Utility functions
    getPreCalculatedResults,
    logSuspiciousActivity,
    getAllMinimumCombinations,

    // Cleanup and maintenance
    cleanupRedisData,
    isBettingFrozen,
    hasBets,
    updateGameHistory,
    validateResultStructure,
    calculatePeriodEndTime,

    // Storage functions
    storeTemporaryResult,

    // Period optimization
    startPeriodWithOptimization,
    schedulePeriodCleanup,
    cleanupPeriodData,
    getPeriodOptimizationStats,
    getColorForNumber,

    // New functions
    getUserBetHistory,
    getEnhancedPeriodStatus,
    getUserGameBalance,
    broadcastGameResult,


    generateVerificationHash,
    generateVerificationLink,
    enhanceResultFormat,

    //User threshold
    selectProtectedResultWithExposure,
    selectFallbackResult,

    //constants
    PLATFORM_FEE_RATE,
    ENHANCED_USER_THRESHOLD,

    // Initialization
    initializeGameCombinations,

    // Model management
    ensureModelsInitialized,
    get models() {
        if (!serviceModels) {
            throw new Error('Models not initialized. Call ensureModelsInitialized() first.');
        }
        return serviceModels;
    }
};