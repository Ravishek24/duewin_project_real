const unifiedRedis = require('../config/unifiedRedisManager');
function getRedisHelper() {
    return unifiedRedis.getHelper();
}

// Backend/services/gameLogicService.js
const { sequelize, DataTypes, Op } = require('../config/db');


const periodService = require('./periodService');
const tronHashService = require('./tronHashService');
const winston = require('winston');
const path = require('path');
const logger = require('../utils/logger');
const crypto = require('crypto');
const { recordVipExperience } = require('../services/autoVipService');
const { processSelfRebate } = require('../services/selfRebateService');
const { processBetForActivityReward } = require('../services/activityRewardsService');
const fiveDProtectionService = require('./fiveDProtectionService');
const moment = require('moment');
// CONSTANTS - Add to top of file
const PLATFORM_FEE_RATE = 0.02; // 2% platform fee
const ENHANCED_USER_THRESHOLD = 2; // Threshold for protection system

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

// Add after other logger imports
const betDebugLogger = winston.createLogger({
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
            return `${timestamp} [${level.toUpperCase()}] ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
        })
    ),
    transports: [
        new winston.transports.File({ filename: path.join('logs', 'bet-debug.log') }),
        new winston.transports.Console()
    ]
});

const generateTraceId = () => crypto.randomBytes(8).toString('hex');

/**
 * Get K3 result type categorization for exposure logging
 * @param {number} d1 - First dice
 * @param {number} d2 - Second dice
 * @param {number} d3 - Third dice
 * @returns {string} - Result type description
 */
const getK3ResultType = (d1, d2, d3) => {
    const dice = [d1, d2, d3].sort((a, b) => a - b);
    const sum = d1 + d2 + d3;

    // Check for triple
    if (d1 === d2 && d2 === d3) {
        return `Triple_${d1} (Sum:${sum})`;
    }

    // Check for pair
    if (d1 === d2 || d2 === d3 || d1 === d3) {
        const pairValue = d1 === d2 ? d1 : d3;
        const singleValue = d1 === d2 ? d3 : d1;
        return `Pair_${pairValue}_${singleValue} (Sum:${sum})`;
    }

    // Check for straight (consecutive)
    if (dice[1] === dice[0] + 1 && dice[2] === dice[1] + 1) {
        return `Straight_${dice[0]}-${dice[1]}-${dice[2]} (Sum:${sum})`;
    }

    // All different
    return `AllDifferent_${dice[0]}-${dice[1]}-${dice[2]} (Sum:${sum})`;
};

/**
 * Get K3 exposure type description for logging
 * @param {string} betType - Bet type
 * @param {string} betValue - Bet value
 * @returns {string} - Exposure type description
 */
const getK3ExposureType = (betType, betValue) => {
    switch (betType) {
        case 'SUM':
            return `SUM bet on ${betValue} - affects combinations with sum ${betValue}`;
        case 'SUM_CATEGORY':
            if (betValue === 'big') {
                return 'SUM_CATEGORY big - affects combinations with sum 11-18';
            } else if (betValue === 'small') {
                return 'SUM_CATEGORY small - affects combinations with sum 3-10';
            } else if (betValue === 'odd') {
                return 'SUM_CATEGORY odd - affects combinations with odd sum';
            } else if (betValue === 'even') {
                return 'SUM_CATEGORY even - affects combinations with even sum';
            }
            return `SUM_CATEGORY ${betValue}`;
        case 'MATCHING_DICE':
            if (betValue === 'triple_any') {
                return 'MATCHING_DICE triple_any - affects all triple combinations (6 combinations)';
            } else if (betValue === 'pair_any') {
                return 'MATCHING_DICE pair_any - affects all pair combinations (90 combinations)';
            } else if (betValue.startsWith('triple_')) {
                const number = betValue.split('_')[1];
                return `MATCHING_DICE triple_${number} - affects specific triple ${number},${number},${number}`;
            } else if (betValue.startsWith('pair_')) {
                const [pairNum, singleNum] = betValue.split('_').slice(1);
                return `MATCHING_DICE pair_${pairNum}_${singleNum} - affects specific pair ${pairNum},${pairNum},${singleNum}`;
            }
            return `MATCHING_DICE ${betValue}`;
        case 'PATTERN':
            if (betValue === 'all_different') {
                return 'PATTERN all_different - affects combinations with all different dice (120 combinations)';
            } else if (betValue === 'straight') {
                return 'PATTERN straight - affects consecutive combinations (4 combinations)';
            } else if (betValue === 'two_different') {
                return 'PATTERN two_different - affects pair combinations (90 combinations)';
            }
            return `PATTERN ${betValue}`;
        default:
            return `Unknown bet type: ${betType}`;
    }
};

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
/**
 * FIXED: Get deterministic color based on number (corrected mapping)
 * @param {number} number - Number (0-9)
 * @returns {string} - Corresponding color
 */
const getColorForNumber = (number) => {
    const colorMap = {
        0: 'red_violet',    // 0 is red + violet
        1: 'green',         // 1 is green
        2: 'red',           // 2 is red
        3: 'green',         // 3 is green
        4: 'red',           // 4 is red
        5: 'green_violet',  // 5 is green + violet
        6: 'red',           // 6 is red
        7: 'green',         // 7 is green
        8: 'red',           // 8 is red
        9: 'green'          // 9 is green
    };

    const color = colorMap[number];
    console.log(`🎨 [COLOR_MAP] Number ${number} -> ${color}`);
    return color;
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
        let minBetPeriods = await getRedisHelper().get(minBetPeriodsKey);

        if (!minBetPeriods) {
            // Generate 3 random periods for this hour if not exists
            const totalPeriodsInHour = 3600 / duration; // Total periods in an hour
            const periods = new Set();

            while (periods.size < 3) {
                const randomPeriod = Math.floor(Math.random() * totalPeriodsInHour);
                periods.add(randomPeriod);
            }

            minBetPeriods = JSON.stringify(Array.from(periods));
            await getRedisHelper().set(minBetPeriodsKey, minBetPeriods);
            await getRedisHelper().expire(minBetPeriodsKey, 3600); // Expire after 1 hour
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
        const lowestCombinationsStr = await getRedisHelper().get(
            `${gameType}:${durationKey}:${periodId}:lowest_combinations`
        );
        const lowestCombinations = lowestCombinationsStr ? JSON.parse(lowestCombinationsStr) : [];

        // Get optimized result
        const optimizedResultStr = await getRedisHelper().get(
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
        await getRedisHelper().set(suspiciousKey, JSON.stringify({
            timestamp: new Date().toISOString(),
            validations,
            action: 'result_override'
        }));

        // Set expiry for suspicious activity log (7 days)
        const EXPIRY_SECONDS = 7 * 24 * 60 * 60;
        await getRedisHelper().expire(suspiciousKey, EXPIRY_SECONDS);

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
            await getRedisHelper().ping();
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
        const cached = await getRedisHelper().get(cacheKey);

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
            winning_conditions: typeof combination.winning_conditions === 'string' ? (() => {
                try {
                    return JSON.parse(combination.winning_conditions);
                } catch (parseError) {
                    console.error('Error parsing winning_conditions JSON in lazy5DLoader:', parseError);
                    return {};
                }
            })() : combination.winning_conditions
        };

        // Cache for 1 hour
        await getRedisHelper().setex(cacheKey, 3600, JSON.stringify(result));

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
            const cached = await getRedisHelper().get(`5d:combo:${diceValue}`);
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
                    winning_conditions: typeof combo.winning_conditions === 'string' ? (() => {
                        try {
                            return JSON.parse(combo.winning_conditions);
                        } catch (parseError) {
                            console.error('Error parsing winning_conditions JSON in get5DCombinationsBatch:', parseError);
                            return {};
                        }
                    })() : combo.winning_conditions
                };

                await getRedisHelper().setex(`5d:combo:${combo.dice_value}`, 3600, JSON.stringify(result));
                results.push(result);
            }
        }

        return results;
    } catch (error) {
        logger.error('Error loading 5D combinations batch', { error: error.message });
        throw error;
    }
}

async function updateBetExposure(gameType, duration, periodId, bet, timeline = 'default') {
    try {
        console.log('🔍 [EXPOSURE_DEBUG] updateBetExposure called with:', {
            gameType, duration, periodId, timeline, bet
        });

        const exposureKey = `exposure:${gameType}:${duration}:${timeline}:${periodId}`;
        console.log('🔍 [EXPOSURE_DEBUG] Exposure key:', exposureKey);

        // CRITICAL FIX: Parse bet_type and calculate missing fields
        let betType, betValue;

        if (bet.bet_type) {
            [betType, betValue] = bet.bet_type.split(':');
        } else {
            // Legacy format
            betType = bet.betType;
            betValue = bet.betValue;
        }

        // CRITICAL FIX: Handle field name variations
        const actualBetAmount = bet.netBetAmount || bet.amount_after_tax || bet.betAmount || 0;

        // Validate bet amount
        if (isNaN(actualBetAmount) || actualBetAmount < 0) {
            throw new Error('Invalid bet amount');
        }

        // Update exposure based on game type
        switch (gameType.toLowerCase()) {
            case 'wingo':
            case 'trx_wix':
                // For number bets, update specific number
                if (betType === 'NUMBER') {
                    const numberOdds = 9.0; // Number bets always pay 9.0x
                    const exposure = Math.round(actualBetAmount * numberOdds * 100); // Convert to cents
                    await getRedisHelper().hincrby(exposureKey, `number:${betValue}`, exposure);
                }
                // For other bets, update all matching numbers with correct odds
                else {
                    console.log('🔍 [EXPOSURE_DEBUG] Processing COLOR/SIZE/PARITY bet');

                    // Ensure combinations are initialized
                    if (!global.wingoCombinations) {
                        console.log('🔍 [EXPOSURE_DEBUG] Initializing wingo combinations...');
                        await initializeGameCombinations();
                    }

                    console.log('🔍 [EXPOSURE_DEBUG] Checking numbers 0-9 for bet:', { betType, betValue });

                    for (let num = 0; num <= 9; num++) {
                        const combo = global.wingoCombinations[num];
                        // Use the correct win checking logic for exposure tracking
                        if (combo && checkWingoWin(betType, betValue, combo)) {
                            console.log(`🔍 [EXPOSURE_DEBUG] Number ${num} (${combo.color}) wins for bet ${betType}:${betValue}`);

                            // Calculate correct odds for this specific number
                            let correctOdds;
                            if (betType === 'COLOR') {
                                if (betValue === 'red') {
                                    if (combo.color === 'red') {
                                        correctOdds = 2.0; // Pure red
                                    } else if (combo.color === 'red_violet') {
                                        correctOdds = 1.5; // Mixed color
                                    } else {
                                        correctOdds = 0; // No win
                                    }
                                } else if (betValue === 'green') {
                                    if (combo.color === 'green') {
                                        correctOdds = 2.0; // Pure green
                                    } else if (combo.color === 'green_violet') {
                                        correctOdds = 1.5; // Mixed color
                                    } else {
                                        correctOdds = 0; // No win
                                    }
                                } else if (betValue === 'violet') {
                                    if (combo.color === 'red_violet' || combo.color === 'green_violet') {
                                        correctOdds = 4.5; // Violet win
                                    } else {
                                        correctOdds = 0; // No win
                                    }
                                } else {
                                    correctOdds = 0; // Unknown color
                                }
                            } else {
                                // For other bet types, use standard odds
                                correctOdds = calculateOdds(gameType, betType, betValue);
                            }

                            console.log(`🔍 [EXPOSURE_DEBUG] Number ${num}: odds=${correctOdds}, betAmount=${actualBetAmount}`);

                            // Calculate exposure with correct odds
                            const exposure = Math.round(actualBetAmount * correctOdds * 100); // Convert to cents
                            console.log(`🔍 [EXPOSURE_DEBUG] Adding exposure ${exposure} to number ${num}`);

                            await getRedisHelper().hincrby(exposureKey, `number:${num}`, exposure);
                        } else {
                            console.log(`🔍 [EXPOSURE_DEBUG] Number ${num} (${combo?.color}) does NOT win for bet ${betType}:${betValue}`);
                        }
                    }
                }
                break;

            case 'k3':
                // Update all combinations that would win with detailed payout logging
                // Ensure combinations are initialized
                if (!global.k3Combinations) {
                    await initializeGameCombinations();
                }

                // Use the corrected bet type for odds calculation
                const k3Odds = calculateOdds(gameType, betType, betValue);
                console.log(`🎲 [K3_ODDS_CALCULATION] Calculating odds for ${betType}:${betValue} = ${k3Odds}x`);
                const k3Exposure = Math.round(actualBetAmount * k3Odds * 100);

                console.log(`🎲 [K3_EXPOSURE_DETAILS] K3 bet exposure calculation:`, {
                    betType: betType,
                    betValue: betValue,
                    betAmount: actualBetAmount,
                    odds: k3Odds,
                    exposure: k3Exposure,
                    exposureKey: exposureKey
                });

                let winningCombinations = 0;
                const exposureBreakdown = {};
                const realTimeExposure = {};

                console.log(`🎲 [K3_REAL_EXPOSURE_START] Starting real-time exposure calculation for ${betType}:${betValue}`);
                console.log(`🎲 [K3_REAL_EXPOSURE_INFO] Bet Amount: ₹${actualBetAmount}, Odds: ${k3Odds}x, Exposure per winning combination: ₹${k3Exposure / 100}`);

                for (const [key, combo] of Object.entries(global.k3Combinations)) {
                    if (combo && checkK3WinCondition(combo, betType, betValue)) {
                        await getRedisHelper().hincrby(exposureKey, `dice:${key}`, k3Exposure);
                        winningCombinations++;

                        // Track exposure breakdown by result type
                        const [d1, d2, d3] = key.split(',').map(n => parseInt(n));
                        const sum = d1 + d2 + d3;
                        const resultType = getK3ResultType(d1, d2, d3);

                        if (!exposureBreakdown[resultType]) {
                            exposureBreakdown[resultType] = {
                                combinations: [],
                                totalExposure: 0
                            };
                        }

                        exposureBreakdown[resultType].combinations.push(key);
                        exposureBreakdown[resultType].totalExposure += k3Exposure;

                        // Real-time exposure tracking
                        realTimeExposure[key] = {
                            dice: [d1, d2, d3],
                            sum: sum,
                            resultType: resultType,
                            exposure: k3Exposure / 100, // Convert from cents to rupees
                            payout: (k3Exposure / 100) * k3Odds
                        };

                        // Log each winning combination in real-time
                        console.log(`🎲 [K3_WINNING_COMBO] ${key} → [${d1},${d2},${d3}] (Sum:${sum}) → ${resultType} → Exposure: ₹${k3Exposure / 100} → Payout: ₹${(k3Exposure / 100) * k3Odds}`);
                    }
                }

                console.log(`🎲 [K3_REAL_EXPOSURE_END] Real-time exposure calculation completed!`);
                console.log(`🎲 [K3_EXPOSURE_SUMMARY] K3 exposure summary for ${betType}:${betValue}:`, {
                    totalCombinations: Object.keys(global.k3Combinations).length,
                    winningCombinations: winningCombinations,
                    winPercentage: ((winningCombinations / Object.keys(global.k3Combinations).length) * 100).toFixed(2) + '%',
                    totalExposure: k3Exposure * winningCombinations,
                    totalExposureRupees: (k3Exposure * winningCombinations) / 100,
                    totalPotentialPayout: (k3Exposure * winningCombinations * k3Odds) / 100,
                    exposureBreakdown: exposureBreakdown,
                    realTimeExposure: Object.keys(realTimeExposure).slice(0, 10).map(key => ({
                        combination: key,
                        ...realTimeExposure[key]
                    })),
                    sampleWinningResults: Object.keys(exposureBreakdown).slice(0, 5).map(type => ({
                        resultType: type,
                        combinations: exposureBreakdown[type].combinations.slice(0, 3),
                        exposure: exposureBreakdown[type].totalExposure,
                        exposureRupees: exposureBreakdown[type].totalExposure / 100
                    }))
                });

                // Show detailed breakdown by result type
                console.log(`🎲 [K3_EXPOSURE_BREAKDOWN] Detailed breakdown by result type:`);
                Object.entries(exposureBreakdown).forEach(([resultType, data]) => {
                    console.log(`  📊 ${resultType}:`);
                    console.log(`    - Combinations: ${data.combinations.length}`);
                    console.log(`    - Total Exposure: ₹${data.totalExposure / 100}`);
                    console.log(`    - Sample: ${data.combinations.slice(0, 3).join(', ')}`);
                });
                break;

            case 'fived':
            case '5d':
                // For 5D, we'll update exposure without loading all combinations
                // Store bet-level exposure for later calculation
                const fiveDOdds = calculateOdds(gameType, betType, betValue);
                const fiveDExposure = Math.round(actualBetAmount * fiveDOdds * 100);
                const betKey = `${betType}:${betValue}`;
                await getRedisHelper().hincrby(exposureKey, `bet:${betKey}`, fiveDExposure);

                // 🎯 ENHANCED 5D EXPOSURE LOGGING WITH UNIQUE EMOJIS
                console.log(`🎯 [5D_BET_PLACED] 🎲 5D Bet Exposure Updated:`, {
                    periodId, gameType, duration, timeline,
                    betType, betValue, betAmount: actualBetAmount,
                    odds: fiveDOdds, exposure: fiveDExposure,
                    exposureKey, betKey: `bet:${betKey}`,
                    exposureRupees: `${(fiveDExposure / 100).toFixed(2)}₹`
                });

                // 🚀 ENHANCED: Remove winning combinations from zero-exposure set
                try {
                    await fiveDProtectionService.removeCombinationFromZeroExposure(
                        gameType, duration, periodId, timeline,
                        betType, betValue
                    );
                    console.log(`⚡ [ENHANCED_5D_BET] Removed winning combinations for bet: ${betType}:${betValue}`);
                } catch (error) {
                    console.log(`⚠️ [ENHANCED_5D_BET] Error removing combinations: ${error.message}`);
                    // Continue with normal processing even if enhanced system fails
                }
                break;
        }

        // Set expiry
        await getRedisHelper().expire(exposureKey, duration + 300);

        // Debug: Check final exposures
        const finalExposures = await getRedisHelper().hgetall(exposureKey);
        console.log('🔍 [EXPOSURE_DEBUG] Final exposures after update:', finalExposures);

    } catch (error) {
        console.error('🔍 [EXPOSURE_DEBUG] Error in updateBetExposure:', error);
        logger.error('Error updating bet exposure', { error: error.message, gameType, periodId });
    }
}

/**
 * UPDATED: Check win condition - simplified to use direct result checking
 * @param {Object} combination - Combination object (DEPRECATED - now uses direct result)
 * @param {string} betType - Bet type
 * @param {string} betValue - Bet value
 * @param {Object} result - Game result (NEW PARAMETER)
 * @returns {boolean} - Whether bet wins
 */
function checkWinCondition(combination, betType, betValue, result = null) {
    // DEPRECATED: This function is now replaced by direct result checking
    // Use checkWingoWin, checkFiveDWin, or checkK3Win instead

    if (result) {
        // If result is provided, use direct checking
        switch (betType) {
            case 'NUMBER':
                return result.number === parseInt(betValue);
            case 'COLOR':
                return checkColorWin(betValue, result.number, result.color);
            case 'SIZE':
                const isBig = result.number >= 5;
                return (betValue.toLowerCase() === 'big' && isBig) ||
                    (betValue.toLowerCase() === 'small' && !isBig);
            case 'PARITY':
                const isEven = result.number % 2 === 0;
                return (betValue.toLowerCase() === 'even' && isEven) ||
                    (betValue.toLowerCase() === 'odd' && !isEven);
            default:
                return false;
        }
    }

    // Legacy fallback (for backward compatibility)
    if (!combination) return false;

    switch (betType) {
        case 'NUMBER':
            return combination.number === parseInt(betValue);
        case 'COLOR':
            // FIXED: Red bet wins on both 'red' and 'red_violet' numbers
            if (betValue === 'red') {
                return combination.color === 'red' || combination.color === 'red_violet';
            }
            // FIXED: Green bet wins on both 'green' and 'green_violet' numbers
            if (betValue === 'green') {
                return combination.color === 'green' || combination.color === 'green_violet';
            }
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

    // Special handling for SUM_MULTIPLE bets
    if (betType === 'SUM_MULTIPLE') {
        const sumValues = betValue.split(',').map(s => s.trim());
        console.log(`🎲 [K3_MULTIPLE_WIN_CHECK] Checking SUM_MULTIPLE: ${sumValues.join(',')} vs combination:`, combination);

        // Check if any of the bet sum values match the combination's sum
        for (const sumValue of sumValues) {
            const checkValue = `SUM:${sumValue}`;
            for (const conditionGroup of Object.values(conditions)) {
                if (Array.isArray(conditionGroup) && conditionGroup.includes(checkValue)) {
                    console.log(`🎲 [K3_MULTIPLE_WIN_FOUND] SUM_MULTIPLE bet wins with sum ${sumValue}`);
                    return true;
                }
            }
        }
        console.log(`🎲 [K3_MULTIPLE_WIN_NOT_FOUND] SUM_MULTIPLE bet loses - no matching sums`);
        return false;
    }

    // CRITICAL FIX: Handle bet type mapping mismatches
    let checkValue = `${betType}:${betValue}`;

    // Map SUM_SIZE to SUM_CATEGORY for winning conditions
    if (betType === 'SUM_SIZE') {
        checkValue = `SUM_CATEGORY:${betValue}`;
        console.log(`🎲 [K3_SIZE_MAPPING] Mapping SUM_SIZE:${betValue} to SUM_CATEGORY:${betValue}`);
    }

    console.log(`🎲 [K3_WIN_CHECK] Checking bet: ${checkValue} vs combination:`, combination);

    // Check in all condition arrays
    for (const conditionGroup of Object.values(conditions)) {
        if (Array.isArray(conditionGroup) && conditionGroup.includes(checkValue)) {
            console.log(`🎲 [K3_WIN_FOUND] Bet wins with ${checkValue}`);
            return true;
        }
    }
    console.log(`🎲 [K3_WIN_NOT_FOUND] Bet loses - no matching conditions for ${checkValue}`);
    return false;
}
async function getOptimalResultByExposure(gameType, duration, periodId, timeline = 'default') {
    try {
        const exposureKey = `exposure:${gameType}:${duration}:${timeline}:${periodId}`;

        switch (gameType.toLowerCase()) {
            case 'wingo':
            case 'trx_wix':
                // Get all exposures
                const wingoExposures = await getRedisHelper().hgetall(exposureKey);
                let minExposure = Infinity;
                let optimalNumber = 0;

                // Check each number
                for (let num = 0; num <= 9; num++) {
                    const exposure = parseInt(wingoExposures[`number:${num}`] || 0) / 100; // Convert from cents to rupees
                    if (exposure < minExposure) {
                        minExposure = exposure;
                        optimalNumber = num;
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
                const k3Exposures = await getRedisHelper().hgetall(exposureKey);
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
                return await getOptimal5DResultByExposure(duration, periodId, timeline);

            default:
                throw new Error(`Unknown game type: ${gameType}`);
        }

    } catch (error) {
        logger.error('Error getting optimal result by exposure', { error: error.message, gameType, periodId });
        throw error;
    }
}

async function getOptimal5DResultByExposure(duration, periodId, timeline = 'default') {
    try {
        const exposureKey = `exposure:5d:${duration}:${timeline}:${periodId}`;
        const betExposures = await getRedisHelper().hgetall(exposureKey);

        // Get total bets amount
        const totalBets = Object.values(betExposures).reduce((sum, val) => sum + parseFloat(val), 0);

        // Strategy based on bet volume
        let strategy = 'FULL_SCAN';
        if (totalBets > 100000) {
            strategy = 'STATISTICAL_SAMPLING';
        } else if (totalBets > 50000) {
            strategy = 'SMART_SAMPLING';
        }

        console.log('🎯 [5D_STRATEGY] Selected strategy:', {
            strategy,
            totalBets,
            periodId,
            timeline
        });

        // Check if protection should be applied (A_1-9 bet but A_0 not bet)
        const aBets = Object.keys(betExposures).filter(key =>
            key.startsWith('bet:POSITION:A_') && key !== 'bet:POSITION:A_0'
        );
        const hasA0Bet = Object.keys(betExposures).some(key => key === 'bet:POSITION:A_0');
        const hasA1to9Bets = aBets.some(bet => bet.match(/A_[1-9]/));
        const shouldApplyProtection = hasA1to9Bets && !hasA0Bet;

        // Enhanced protection for low user count scenarios
        const userCountResult = await getUniqueUserCount('5d', duration, periodId, timeline);
        const isLowUserCount = userCountResult.uniqueUserCount < ENHANCED_USER_THRESHOLD;

        if (isLowUserCount) {
            console.log('🛡️ [5D_LOW_USER_PROTECTION] Low user count detected:', {
                userCount: userCountResult.uniqueUserCount,
                threshold: ENHANCED_USER_THRESHOLD,
                shouldApplyProtection: true
            });
        }

        console.log('🔍 [5D_PROTECTION_DEBUG] Exposure analysis:', {
            totalBets,
            strategy,
            aBets: aBets.length,
            hasA0Bet,
            hasA1to9Bets,
            shouldApplyProtection,
            exposureKeys: Object.keys(betExposures).filter(k => k.startsWith('bet:POSITION:A_')),
            allExposureKeys: Object.keys(betExposures)
        });

        if (shouldApplyProtection) {
            console.log('🛡️ [5D_PROTECTION] Protection condition detected: A_1-9 bet, A_0 not bet');
        }

        const models = await ensureModelsInitialized();
        const { getSequelizeInstance } = require('../config/db');
        const sequelize = await getSequelizeInstance();

        switch (strategy) {
            case 'FULL_SCAN':
                // For low volume, check all combinations
                let fullScanQuery = `
                    SELECT dice_value, dice_a, dice_b, dice_c, dice_d, dice_e, 
                           sum_value, sum_size, sum_parity, winning_conditions
                    FROM game_combinations_5d
                `;

                // Apply protection logic if needed
                if (shouldApplyProtection) {
                    console.log('🛡️ [5D_PROTECTION] Applying protection in FULL_SCAN: forcing A=0');
                    fullScanQuery += ` WHERE dice_a = 0`;
                }

                fullScanQuery += ` ORDER BY RAND() LIMIT 10000`;

                const result = await sequelize.query(fullScanQuery, {
                    type: sequelize.QueryTypes.SELECT
                });

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
                let smartSamplingQuery = `
                    SELECT dice_value, dice_a, dice_b, dice_c, dice_d, dice_e,
                           sum_value, sum_size, sum_parity, winning_conditions
                    FROM game_combinations_5d
                    WHERE sum_value IN (
                        SELECT sum_value 
                        FROM game_5d_summary_stats 
                        ORDER BY probability ASC 
                        LIMIT 10
                    )
                `;

                // Apply protection logic if needed
                if (shouldApplyProtection) {
                    console.log('🛡️ [5D_PROTECTION] Applying protection in SMART_SAMPLING: forcing A=0');
                    smartSamplingQuery += ` AND dice_a = 0`;
                }

                smartSamplingQuery += ` ORDER BY RAND() LIMIT 1000`;

                const sumResult = await sequelize.query(smartSamplingQuery, {
                    type: sequelize.QueryTypes.SELECT
                });

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

                // Apply protection logic: if A_1-9 are bet but A_0 is not, prioritize A=0
                if (shouldApplyProtection && unbetPositions.A.includes(0)) {
                    console.log('🛡️ [5D_PROTECTION] Applying protection in STATISTICAL_SAMPLING: forcing A=0');
                    query += ` AND dice_a = 0`;
                } else {
                    // Add conditions for unbet positions
                    if (unbetPositions.A.length > 0) {
                        query += ` AND dice_a IN (${unbetPositions.A.join(',')})`;
                    }
                    if (unbetPositions.B.length > 0) {
                        query += ` AND dice_b IN (${unbetPositions.B.join(',')})`;
                    }
                }

                query += ` ORDER BY RAND() LIMIT 100`;

                const statResult = await sequelize.query(query, {
                    type: sequelize.QueryTypes.SELECT
                });

                if (statResult.length > 0) {
                    return format5DResult(statResult[0]);
                }

                // Fallback to random low probability
                const fallbackResult = await sequelize.query(`
                    SELECT dice_value, dice_a, dice_b, dice_c, dice_d, dice_e,
                           sum_value, sum_size, sum_parity, winning_conditions
                    FROM game_combinations_5d
                    WHERE sum_value IN (0, 1, 2, 3, 4, 41, 42, 43, 44, 45)
                    ORDER BY RAND()
                    LIMIT 1
                `, { type: sequelize.QueryTypes.SELECT });

                return format5DResult(fallbackResult[0]);
        }

    } catch (error) {
        logger.error('Error getting optimal 5D result', { error: error.message });
        throw error;
    }
}

async function calculate5DExposure(combination, betExposures) {
    let totalExposure = 0;

    // Debug logging to understand the issue
    //console.log('🔍 [5D_EXPOSURE_DEBUG] calculate5DExposure called with:', {
    //    combinationType: typeof combination,
    //    winningConditionsType: typeof combination.winning_conditions,
    //    winningConditionsValue: combination.winning_conditions,
    //    betExposuresKeys: Object.keys(betExposures)
    //});

    let winningConditions;
    if (typeof combination.winning_conditions === 'string') {
        try {
            winningConditions = JSON.parse(combination.winning_conditions);
        } catch (parseError) {
            console.error('Error parsing winning_conditions JSON:', parseError);
            console.error('Raw winning_conditions:', combination.winning_conditions);
            // Fallback to empty object
            winningConditions = {};
        }
    } else {
        winningConditions = combination.winning_conditions;
    }
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

async function resetPeriodExposure(gameType, duration, periodId, timeline = 'default') {
    try {
        const exposureKey = `exposure:${gameType}:${duration}:${timeline}:${periodId}`;
        await getRedisHelper().del(exposureKey);
        logger.info('Period exposure reset', { gameType, duration, periodId, timeline });
    } catch (error) {
        logger.error('Error resetting period exposure', { error: error.message, gameType, periodId });
    }
}

async function indexBetInHash(gameType, duration, periodId, timeline, bet) {
    try {
        const betHashKey = `bets:${gameType}:${duration}:${timeline}:${periodId}`;
        const betId = `${bet.userId}:${bet.betType}:${bet.betValue}:${Date.now()}`;

        await getRedisHelper().hset(betHashKey, betId, JSON.stringify({
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
        await getRedisHelper().expire(betHashKey, 86400);

        return betId;
    } catch (error) {
        logger.error('Error indexing bet in hash', { error: error.message });
        throw error;
    }
}

async function getBetsFromHash(gameType, duration, periodId, timeline = 'default') {
    try {
        const betHashKey = `bets:${gameType}:${duration}:${timeline}:${periodId}`;
        const betsData = await getRedisHelper().hgetall(betHashKey);

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
        await getRedisHelper().set(trackingKey, JSON.stringify(trackingData));
        await getRedisHelper().expire(trackingKey, duration + 300); // 5 min buffer

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
        const betKeys = await getRedisHelper().keys(`${gameType}:${durationKey}:${periodId}:*`);

        // Sample bets randomly
        const sampleSize = Math.ceil(betKeys.length * sampleRate);
        const sampledKeys = betKeys
            .sort(() => Math.random() - 0.5) // Shuffle
            .slice(0, sampleSize);

        let samplePayout = 0;
        let validSamples = 0;

        for (const key of sampledKeys) {
            try {
                const betData = await getRedisHelper().get(key);
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
        const intervalId = await getRedisHelper().get(intervalKey);

        if (intervalId) {
            clearInterval(parseInt(intervalId));
            await getRedisHelper().del(intervalKey);
        }

        // Clean up tracking data (keep for analysis but remove from active keys)
        const trackingKey = `${gameType}:${durationKey}:${periodId}:tracking`;
        const fallbackKey = `${gameType}:${durationKey}:${periodId}:fallbacks`;

        // Move to archive instead of deleting (for analysis)
        const archiveKey = `archive:${gameType}:${durationKey}:${periodId}:tracking`;
        const trackingData = await getRedisHelper().get(trackingKey);

        if (trackingData) {
            await getRedisHelper().set(archiveKey, trackingData, 'EX', 7 * 24 * 60 * 60); // Keep for 7 days
        }

        // Delete active keys
        await getRedisHelper().del(trackingKey);
        await getRedisHelper().del(fallbackKey);

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

        const trackingData = await getRedisHelper().get(trackingKey);
        const fallbackData = await getRedisHelper().get(fallbackKey);

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
        const fallbackData = await getRedisHelper().get(fallbackKey);

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
        const betsData = await getRedisHelper().hgetall(betHashKey);

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
        const exposureKey = `exposure:${gameType}:${duration}:${timeline}:${periodId}`;

        switch (gameType.toLowerCase()) {
            case 'wingo':
            case 'trx_wix':
                // Find zero exposure numbers
                console.log('🔍 Checking exposures for key:', exposureKey);
                const wingoExposures = await getRedisHelper().hgetall(exposureKey);
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

                // CRITICAL FIX: When no zero-exposure numbers exist, ALWAYS select lowest exposure
                console.log(`🛡️ CRITICAL: No zero-exposure numbers found, selecting lowest exposure number`);

                // Find the number with the lowest exposure
                let minWingoExposure = Infinity;
                let lowestExposureNumber = 0;
                let lowestExposureNumbers = [];

                for (let num = 0; num <= 9; num++) {
                    const exposure = parseInt(wingoExposures[`number:${num}`] || 0);
                    if (exposure < minWingoExposure) {
                        minWingoExposure = exposure;
                        lowestExposureNumber = num;
                        lowestExposureNumbers = [num];
                    } else if (exposure === minWingoExposure) {
                        lowestExposureNumbers.push(num);
                    }
                }

                // Select randomly from numbers with lowest exposure
                const selectedLowestNumber = lowestExposureNumbers[Math.floor(Math.random() * lowestExposureNumbers.length)];
                console.log(`🛡️ Selected lowest exposure number: ${selectedLowestNumber} (exposure: ${minWingoExposure}) from [${lowestExposureNumbers.join(',')}]`);

                if (!global.wingoCombinations) {
                    await initializeGameCombinations();
                }
                return global.wingoCombinations[selectedLowestNumber];

            case 'k3':
                // Find zero exposure combination
                const k3Exposures = await getRedisHelper().hgetall(exposureKey);
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

                // CRITICAL FIX: When no zero-exposure K3 combinations exist, ALWAYS select lowest exposure
                console.log(`🛡️ CRITICAL: No zero-exposure K3 combinations found, selecting lowest exposure combination`);

                // Find the combination with the lowest exposure
                let k3MinExposure = Infinity;
                let k3LowestExposureKey = '1,1,1';
                let k3LowestExposureKeys = [];

                for (const [key, combo] of Object.entries(global.k3Combinations)) {
                    const exposure = parseInt(k3Exposures[`dice:${key}`] || 0);
                    if (exposure < k3MinExposure) {
                        k3MinExposure = exposure;
                        k3LowestExposureKey = key;
                        k3LowestExposureKeys = [key];
                    } else if (exposure === k3MinExposure) {
                        k3LowestExposureKeys.push(key);
                    }
                }

                // Select randomly from combinations with lowest exposure
                const selectedLowestKey = k3LowestExposureKeys[Math.floor(Math.random() * k3LowestExposureKeys.length)];
                console.log(`🛡️ Selected lowest exposure K3 combination: ${selectedLowestKey} (exposure: ${k3MinExposure}) from [${k3LowestExposureKeys.join(',')}]`);

                return global.k3Combinations[selectedLowestKey];

            case 'fived':
            case '5d':
                // 🛡️ ENHANCED 5D PROTECTION: Use exposure-based selection like Wingo/TRX
                console.log('🛡️ [5D_PROTECTION_START] 🎲 5D Protection Mode Analysis:', {
                    periodId, gameType, duration, timeline,
                    exposureKey
                });

                // Get exposure data from Redis
                const betExposures = await getRedisHelper().hgetall(exposureKey);
                console.log('🛡️ [5D_PROTECTION_DEBUG] 🎲 5D Exposure Data Breakdown:', betExposures);

                // Find zero exposure combinations
                const models = await ensureModelsInitialized();
                const { getSequelizeInstance } = require('../config/db');
                const sequelize = await getSequelizeInstance();

                // Get all possible 5D combinations from database
                const allCombinations = await sequelize.query(`
                    SELECT dice_value, dice_a, dice_b, dice_c, dice_d, dice_e,
                           sum_value, sum_size, sum_parity, winning_conditions
                    FROM game_combinations_5d
                    ORDER BY RAND()
                    LIMIT 1000
                `, { type: sequelize.QueryTypes.SELECT });

                console.log('🛡️ [5D_PROTECTION_DEBUG] 🎲 5D Loaded', allCombinations.length, 'combinations for analysis');

                // Find combinations with zero exposure
                const zeroExposureCombinations = [];
                for (const combo of allCombinations) {
                    const exposure = await calculate5DExposure(combo, betExposures);
                    if (exposure === 0) {
                        zeroExposureCombinations.push(combo);
                    }
                }

                console.log('🛡️ [5D_PROTECTION_DEBUG] 🎲 5D Zero exposure combinations found:', zeroExposureCombinations.length);

                // Randomly select from zero-exposure combinations
                if (zeroExposureCombinations.length > 0) {
                    const randomIndex = Math.floor(Math.random() * zeroExposureCombinations.length);
                    const selectedCombo = zeroExposureCombinations[randomIndex];
                    const formattedResult = format5DResult(selectedCombo);

                    console.log(`🛡️ [5D_PROTECTION_SUCCESS] 🎲 5D Protected: Using random zero-exposure combination:`, {
                        periodId, gameType, duration, timeline,
                        selectedResult: formattedResult,
                        protectionMethod: 'zero_exposure_selection',
                        zeroExposureCount: zeroExposureCombinations.length
                    });

                    return formattedResult;
                }

                // CRITICAL FIX: When no zero-exposure combinations exist, select lowest exposure
                console.log(`🛡️ [5D_PROTECTION_FALLBACK] 🎲 5D No zero-exposure combinations found, selecting lowest exposure combination`);

                // Find combinations with lowest exposure
                let min5DExposure = Infinity;
                let lowest5DExposureCombinations = [];

                for (const combo of allCombinations) {
                    const exposure = await calculate5DExposure(combo, betExposures);
                    if (exposure < min5DExposure) {
                        min5DExposure = exposure;
                        lowest5DExposureCombinations = [combo];
                    } else if (exposure === min5DExposure) {
                        lowest5DExposureCombinations.push(combo);
                    }
                }

                // Select randomly from combinations with lowest exposure
                const selectedLowestCombo = lowest5DExposureCombinations[Math.floor(Math.random() * lowest5DExposureCombinations.length)];
                const formattedLowestResult = format5DResult(selectedLowestCombo);

                console.log(`🛡️ [5D_PROTECTION_SUCCESS] 🎲 5D Selected lowest exposure combination:`, {
                    periodId, gameType, duration, timeline,
                    selectedResult: formattedLowestResult,
                    protectionMethod: 'lowest_exposure_selection',
                    lowestExposure: min5DExposure,
                    lowestExposureCount: lowest5DExposureCombinations.length
                });

                return formattedLowestResult;

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
        // Import sequelize for database queries
        const { getSequelizeInstance } = require('../config/db');
        const sequelize = await getSequelizeInstance();

        console.log('🎲 [RESULT_START] ==========================================');
        console.log('🎲 [RESULT_START] Calculating result for period:', {
            gameType, duration, periodId, timeline
        });

        // Check user count for protection
        console.log('👥 [RESULT_USERS] Checking user count for protection...');
        const userCountResult = await getUniqueUserCount(gameType, duration, periodId, timeline);
        console.log('👥 [USER_COUNT] Enhanced unique user count:', userCountResult);

        const shouldUseProtectedResult = userCountResult.uniqueUserCount < ENHANCED_USER_THRESHOLD;
        console.log('🔍 [RESULT_USERS] User count check result:', {
            gameType, periodId, timeline,
            uniqueUserCount: userCountResult.uniqueUserCount,
            shouldUseProtectedResult,
            threshold: ENHANCED_USER_THRESHOLD
        });

        let result;

        if (shouldUseProtectedResult) {
            console.log('🛡️ [RESULT_PROTECTION] Using PROTECTED result selection');
            console.log('🛡️ [RESULT_PROTECTION] Reason: INSUFFICIENT_USERS');
            console.log('🛡️ [RESULT_PROTECTION] User count:', userCountResult.uniqueUserCount, 'Threshold:', ENHANCED_USER_THRESHOLD);

            // Use our fixed protection logic for 5D games
            if (['5d', 'fived'].includes(gameType.toLowerCase())) {
                console.log('🛡️ [5D_PROTECTION] Using fixed 5D protection logic');
                result = await selectProtectedResultWithExposure(gameType, duration, periodId, timeline);

                // If protection fails, use fallback
                if (!result) {
                    console.log('🛡️ [5D_PROTECTION_FALLBACK] Protection failed, using fallback result');
                    result = await generateRandomResult(gameType);
                }
            } else {
                // Use simplified protection logic with pre-generated combinations for other games
                result = await selectProtectedResultWithExposure(
                    gameType, duration, periodId, timeline
                );

                // If protection fails, use fallback
                if (!result) {
                    console.log('🛡️ [PROTECTION_FALLBACK] Protection failed, using fallback result');
                    result = await generateRandomResult(gameType);
                }
            }

            console.log('🛡️ [PROTECTION_RESULT] Selected protected result:', result);
        } else if (['wingo', 'trx_wix'].includes(gameType.toLowerCase())) {
            // STRICT 60/40 ENFORCEMENT FOR WINGO/TRX_WIX (REDIS EXPOSURE BASED)
            const exposureKey = `exposure:${gameType}:${duration}:${timeline}:${periodId}`;
            const wingoExposures = await getRedisHelper().hgetall(exposureKey);
            // Log all exposures for debugging
            console.log('[STRICT_60_40] Redis exposures for payout calculation:', wingoExposures);

            // Log exposure analysis for each number (like protection mode)
            const exposureAnalysis = {};
            for (let num = 0; num <= 9; num++) {
                const exposureCents = parseInt(wingoExposures[`number:${num}`] || 0);
                exposureAnalysis[`number:${num}`] = `${(exposureCents / 100).toFixed(2)}₹`;
            }
            console.log('[STRICT_60_40] Exposure analysis for all numbers:', exposureAnalysis);

            // Fetch all bets for the period to calculate the real bet pool
            const betHashKey = `bets:${gameType}:${duration}:${timeline}:${periodId}`;
            const betsData = await getRedisHelper().hgetall(betHashKey);
            const bets = Object.values(betsData).map(betJson => {
                try { return JSON.parse(betJson); } catch { return null; }
            }).filter(Boolean);
            const totalBetPool = bets.reduce((sum, bet) => {
                const net = parseFloat(bet.amount_after_tax || bet.netBetAmount || 0);
                const gross = parseFloat(bet.betAmount || bet.bet_amount || 0);
                return sum + (net > 0 ? net : gross);
            }, 0);
            console.log(`[STRICT_60_40] Calculated totalBetPool (sum of all user bets, rupees): ${totalBetPool}`);

            let bestResult = null;
            let bestPayoutPercent = -Infinity;
            let lowestExposureResult = null;
            let lowestExposure = Infinity;
            let lowestExposurePercent = Infinity;

            // Ensure combinations are initialized
            if (!global.wingoCombinations) {
                await initializeGameCombinations();
            }

            for (let num = 0; num <= 9; num++) {
                const exposureCents = parseInt(wingoExposures[`number:${num}`] || 0);
                const exposureRupees = exposureCents / 100;
                const payoutPercent = totalBetPool > 0 ? (exposureRupees / totalBetPool) * 100 : 0;
                // Log each candidate's exposure and payout percent
                console.log(`[STRICT_60_40] Candidate result: ${num}, exposure: ${exposureRupees}, payoutPercent: ${payoutPercent}`);
                if (payoutPercent <= 60 && payoutPercent > bestPayoutPercent) {
                    bestPayoutPercent = payoutPercent;
                    bestResult = global.wingoCombinations[num];
                }
                if (exposureRupees < lowestExposure) {
                    lowestExposure = exposureRupees;
                    lowestExposureResult = global.wingoCombinations[num];
                    lowestExposurePercent = payoutPercent;
                }
            }
            // Prefer <= 60% payout, else lowest exposure
            result = bestResult || lowestExposureResult;
            console.log('[STRICT_60_40] Selected result:', {
                bestPayoutPercent,
                lowestExposure,
                lowestExposurePercent,
                resultNumber: result?.number
            });
        } else if (['wingo', 'trx_wix'].includes(gameType.toLowerCase())) {
            // STRICT 60/40 ENFORCEMENT FOR WINGO/TRX_WIX (REDIS EXPOSURE BASED, CORRECT BET POOL)
            const exposureKey = `exposure:${gameType}:${duration}:${timeline}:${periodId}`;
            const wingoExposures = await getRedisHelper().hgetall(exposureKey);
            // Log all exposures for debugging
            console.log('[STRICT_60_40] Redis exposures for payout calculation:', wingoExposures);

            // Log exposure analysis for each number (like protection mode)
            const exposureAnalysis = {};
            for (let num = 0; num <= 9; num++) {
                const exposureCents = parseInt(wingoExposures[`number:${num}`] || 0);
                exposureAnalysis[`number:${num}`] = `${(exposureCents / 100).toFixed(2)}₹`;
            }
            console.log('[STRICT_60_40] Exposure analysis for all numbers:', exposureAnalysis);

            // Fetch all bets for the period to calculate the real bet pool
            const betHashKey = `bets:${gameType}:${duration}:${timeline}:${periodId}`;
            const betsData = await getRedisHelper().hgetall(betHashKey);
            const bets = Object.values(betsData).map(betJson => {
                try { return JSON.parse(betJson); } catch { return null; }
            }).filter(Boolean);
            const totalBetPool = bets.reduce((sum, bet) => {
                const net = parseFloat(bet.amount_after_tax || bet.netBetAmount || 0);
                const gross = parseFloat(bet.betAmount || bet.bet_amount || 0);
                return sum + (net > 0 ? net : gross);
            }, 0);
            console.log(`[STRICT_60_40] Calculated totalBetPool (sum of all user bets, rupees): ${totalBetPool}`);

            let bestResult = null;
            let bestPayoutPercent = -Infinity;
            let lowestExposureResult = null;
            let lowestExposure = Infinity;
            let lowestExposurePercent = Infinity;

            // Ensure combinations are initialized
            if (!global.wingoCombinations) {
                await initializeGameCombinations();
            }

            for (let num = 0; num <= 9; num++) {
                const exposureCents = parseInt(wingoExposures[`number:${num}`] || 0);
                const exposureRupees = exposureCents / 100;
                const payoutPercent = totalBetPool > 0 ? (exposureRupees / totalBetPool) * 100 : 0;
                // Log each candidate's exposure and payout percent
                console.log(`[STRICT_60_40] Candidate result: ${num}, exposure: ${exposureRupees}, payoutPercent: ${payoutPercent}`);
                if (payoutPercent <= 60 && payoutPercent > bestPayoutPercent) {
                    bestPayoutPercent = payoutPercent;
                    bestResult = global.wingoCombinations[num];
                }
                if (exposureRupees < lowestExposure) {
                    lowestExposure = exposureRupees;
                    lowestExposureResult = global.wingoCombinations[num];
                    lowestExposurePercent = payoutPercent;
                }
            }
            // Prefer <= 60% payout, else lowest exposure
            result = bestResult || lowestExposureResult;
            console.log('[STRICT_60_40] Selected result:', {
                bestPayoutPercent,
                lowestExposure,
                lowestExposurePercent,
                resultNumber: result?.number
            });
        } else {
            console.log('📊 [RESULT_NORMAL] Using NORMAL exposure-based result selection');
            // Normal operation - use exposure-based result
            result = await getOptimalResultByExposure(gameType, duration, periodId, timeline);
        }

        console.log('🎯 [RESULT_FINAL] Selected result:', result);

        // Get verification only for TrxWix
        let verification = null;
        if (gameType.toLowerCase() === 'trx_wix') {
            verification = await tronHashService.getResultWithVerification(result, duration);
        }

        const finalResult = {
            success: true,
            result: result,
            verification: verification ? {
                hash: verification.hash,
                link: verification.link,
                blockNumber: verification.blockNumber,
                resultTime: verification.resultTime
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
 * Enhanced 5D result selection with performance monitoring
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 * @param {string} periodId - Period ID
 * @param {string} timeline - Timeline
 * @returns {Object} - Enhanced result or null for fallback
 */
async function getEnhanced5DResult(gameType, duration, periodId, timeline) {
    try {
        console.log('⚡ [ENHANCED_5D] Attempting enhanced 5D result selection');

        // Check if enhanced system is available
        const isEnhancedAvailable = await fiveDProtectionService.isSystemReady();

        if (!isEnhancedAvailable) {
            console.log('⚠️ [ENHANCED_5D] Enhanced system not ready, will use fallback');
            return null;
        }

        // Use enhanced system
        const enhancedResult = await fiveDProtectionService.getProtectedResult(
            gameType, duration, periodId, timeline
        );

        if (enhancedResult) {
            console.log('✅ [ENHANCED_5D] Enhanced system result generated successfully');
            return enhancedResult;
        } else {
            console.log('⚠️ [ENHANCED_5D] Enhanced system returned null, will use fallback');
            return null;
        }
    } catch (error) {
        console.log('❌ [ENHANCED_5D] Enhanced system error, will use fallback:', error.message);
        return null;
    }
}

/**
 * Get current 5D result using existing logic
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 * @param {string} periodId - Period ID
 * @param {string} timeline - Timeline
 * @returns {Object} - Current system result
 */
async function getCurrent5DResult(gameType, duration, periodId, timeline) {
    try {
        console.log('🔄 [CURRENT_5D] Using current 5D result selection');

        // Use existing protected result selection
        const result = await selectProtectedResultWithExposure(
            gameType, duration, periodId, timeline
        );

        console.log('✅ [CURRENT_5D] Current system result generated successfully');
        return result;
    } catch (error) {
        console.log('❌ [CURRENT_5D] Current system error:', error.message);
        throw error;
    }
}

/**
 * Track 5D performance for monitoring
 * @param {number} enhancedTime - Enhanced system time
 * @param {number} currentTime - Current system time
 * @param {boolean} success - Whether enhanced system succeeded
 */
async function track5DPerformance(enhancedTime, currentTime, success) {
    try {
        const performanceData = {
            enhancedTime,
            currentTime,
            speedImprovement: currentTime / enhancedTime,
            success,
            timestamp: Date.now()
        };

        await getRedisHelper().lpush('5d_performance_log', JSON.stringify(performanceData));
        await getRedisHelper().ltrim('5d_performance_log', 0, 999); // Keep last 1000 entries

        console.log(`📊 [PERFORMANCE] Enhanced: ${enhancedTime}ms, Current: ${currentTime}ms, Improvement: ${(currentTime / enhancedTime).toFixed(1)}x, Success: ${success}`);
    } catch (error) {
        console.log('❌ [PERFORMANCE] Error tracking performance:', error.message);
    }
}

/**
 * Pre-calculate 5D result during bet freeze period
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 * @param {string} periodId - Period ID
 * @param {string} timeline - Timeline
 * @returns {Object} - Pre-calculated result
 */
async function preCalculate5DResult(gameType, duration, periodId, timeline) {
    try {
        console.log('⚡ [5D_PRE_CALC] Starting pre-calculation during bet freeze...');

        // Check if we should use enhanced system
        const useEnhanced = await shouldUseEnhancedSystem(gameType, duration, periodId);

        let result;
        let calculationTime;

        if (useEnhanced) {
            console.log('⚡ [5D_PRE_CALC] Using enhanced system for pre-calculation');

            const startTime = Date.now();
            result = await getEnhanced5DResult(gameType, duration, periodId, timeline);
            calculationTime = Date.now() - startTime;

            if (result) {
                console.log(`⚡ [5D_PRE_CALC] Enhanced pre-calculation completed in ${calculationTime}ms`);
            } else {
                console.log('🔄 [5D_PRE_CALC] Enhanced system failed, using current system');
                const currentStartTime = Date.now();
                result = await getCurrent5DResult(gameType, duration, periodId, timeline);
                calculationTime = Date.now() - currentStartTime;
            }
        } else {
            console.log('🔄 [5D_PRE_CALC] Using current system for pre-calculation');

            const startTime = Date.now();
            result = await getCurrent5DResult(gameType, duration, periodId, timeline);
            calculationTime = Date.now() - startTime;
        }

        if (result) {
            // Store pre-calculated result in Redis
            const preCalcKey = `precalc_5d:${gameType}:${duration}:${timeline}:${periodId}`;
            const preCalcData = {
                result,
                calculationTime,
                useEnhanced,
                calculatedAt: new Date().toISOString(),
                periodId,
                gameType,
                duration,
                timeline
            };

            await getRedisHelper().set(preCalcKey, JSON.stringify(preCalcData));
            await getRedisHelper().expire(preCalcKey, 300); // 5 minutes TTL

            console.log('✅ [5D_PRE_CALC] Pre-calculated result stored:', {
                periodId,
                calculationTime,
                useEnhanced,
                result: result
            });

            return preCalcData;
        } else {
            console.log('❌ [5D_PRE_CALC] Failed to pre-calculate result');
            return null;
        }
    } catch (error) {
        console.error('❌ [5D_PRE_CALC] Error in pre-calculation:', error);
        return null;
    }
}

/**
 * Get pre-calculated 5D result
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 * @param {string} periodId - Period ID
 * @param {string} timeline - Timeline
 * @returns {Object|null} - Pre-calculated result or null
 */
async function getPreCalculated5DResult(gameType, duration, periodId, timeline) {
    try {
        const preCalcKey = `precalc_5d:${gameType}:${duration}:${timeline}:${periodId}`;
        const preCalcData = await getRedisHelper().get(preCalcKey);

        if (preCalcData) {
            const parsed = JSON.parse(preCalcData);
            console.log('✅ [5D_PRE_CALC] Retrieved pre-calculated result:', {
                periodId,
                calculationTime: parsed.calculationTime,
                useEnhanced: parsed.useEnhanced
            });

            // Clean up the pre-calculated data
            await getRedisHelper().del(preCalcKey);

            return parsed.result;
        } else {
            console.log('⚠️ [5D_PRE_CALC] No pre-calculated result found, will calculate now');
            return null;
        }
    } catch (error) {
        console.error('❌ [5D_PRE_CALC] Error retrieving pre-calculated result:', error);
        return null;
    }
}

/**
 * Check if period is in bet freeze (last 5 seconds)
 * @param {string} periodId - Period ID
 * @param {number} duration - Duration in seconds
 * @returns {boolean} - Whether period is in bet freeze
 */
function isInBetFreeze(periodId, duration) {
    try {
        const endTime = calculatePeriodEndTime(periodId, duration);
        const now = new Date();
        const timeRemaining = Math.max(0, (endTime - now) / 1000);

        // Bet freeze is last 5 seconds
        return timeRemaining <= 5 && timeRemaining > 0;
    } catch (error) {
        console.error('❌ Error checking bet freeze status:', error);
        return false;
    }
}

/**
 * Check if period has ended
 * @param {string} periodId - Period ID
 * @param {number} duration - Duration in seconds
 * @returns {boolean} - Whether period has ended
 */
function hasPeriodEnded(periodId, duration) {
    try {
        const endTime = calculatePeriodEndTime(periodId, duration);
        const now = new Date();
        const timeSinceEnd = (now - endTime) / 1000;

        // Period has ended if more than 0 seconds have passed since end
        return timeSinceEnd >= 0;
    } catch (error) {
        console.error('❌ Error checking period end status:', error);
        return false;
    }
}

/**
 * Check if enhanced system should be used
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 * @param {string} periodId - Period ID
 * @returns {boolean} - Whether to use enhanced system
 */
async function shouldUseEnhancedSystem(gameType, duration, periodId) {
    // Only for 5D games
    if (gameType.toLowerCase() !== '5d' && gameType.toLowerCase() !== 'fived') {
        return false;
    }

    // Check if enhanced system is enabled (can be controlled via environment variable)
    const enhancedEnabled = process.env.FIVE_D_ENHANCED_ENABLED !== 'false'; // Default to true
    if (!enhancedEnabled) {
        console.log('⚙️ [ENHANCED_CONFIG] Enhanced system disabled via config');
        return false;
    }

    // Check system health
    try {
        const isHealthy = await fiveDProtectionService.isSystemReady();
        if (!isHealthy) {
            console.log('⚠️ [ENHANCED_HEALTH] Enhanced system not healthy');
            return false;
        }
    } catch (error) {
        console.log('❌ [ENHANCED_HEALTH] Error checking enhanced system health:', error.message);
        return false;
    }

    // Gradual rollout based on period ID (start with 10% of periods)
    const periodHash = crypto.createHash('md5').update(periodId).digest('hex');
    const periodNumber = parseInt(periodHash.substring(0, 8), 16);
    const rolloutPercentage = periodNumber % 100;
    const migrationPercentage = parseInt(process.env.FIVE_D_MIGRATION_PERCENTAGE) || 10; // Start with 10%

    const shouldUse = rolloutPercentage < migrationPercentage;

    if (shouldUse) {
        console.log(`🎯 [ENHANCED_ROLLOUT] Period ${periodId} selected for enhanced system (${rolloutPercentage}% < ${migrationPercentage}%)`);
    } else {
        console.log(`🔄 [ENHANCED_ROLLOUT] Period ${periodId} using current system (${rolloutPercentage}% >= ${migrationPercentage}%)`);
    }

    return shouldUse;
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
        const betsData = await getRedisHelper().hgetall(betHashKey);
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

        const result = {
            gameType,
            periodId,
            timeline,
            uniqueUserCount: uniqueUsers.size,
            totalBets: Object.keys(betsData).length,
            threshold: ENHANCED_USER_THRESHOLD,
            uniqueUsers: Array.from(uniqueUsers),
            betHashKey: betHashKey,
            meetsThreshold: uniqueUsers.size >= ENHANCED_USER_THRESHOLD
        };

        console.log('👥 [USER_COUNT] Enhanced unique user count:', result);

        return result;
    } catch (error) {
        logger.error('Error getting enhanced unique user count', {
            error: error.message,
            gameType,
            periodId,
            timeline
        });
        return {
            gameType,
            periodId,
            timeline,
            uniqueUserCount: 0,
            totalBets: 0,
            threshold: ENHANCED_USER_THRESHOLD,
            uniqueUsers: [],
            betHashKey: `bets:${gameType}:${duration}:${timeline}:${periodId}`,
            meetsThreshold: false
        };
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
        const betsData = await getRedisHelper().hgetall(betHashKey);

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
                            link: result.verification_link,
                            block: result.block_number || null,
                            time: result.result_time || result.created_at
                        },
                        createdAt: result.created_at,
                        duration: result.duration,
                        timeline: result.timeline,
                        gameType: 'trx_wix'
                    };
                });

                // 💰 CRYPTO HISTORY LOGGER - Track when TRX_WIX history is retrieved
                if (results.length > 0) {
                    const latestResult = results[0];
                    console.log('💰 [TRX_WIX_HISTORY] Retrieved game history:', {
                        gameType: 'trx_wix',
                        duration: duration,
                        resultsCount: results.length,
                        latestPeriodId: latestResult.periodId,
                        latestResult: latestResult.result,
                        latestVerification: {
                            hash: latestResult.verification.hash,
                            link: latestResult.verification.link,
                            block: latestResult.verification.block || 'NULL',
                            time: latestResult.verification.time || 'NULL'
                        },
                        timestamp: new Date().toISOString()
                    });
                }
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
        // Use net bet amount (after platform fee) for payout calculations
        const betAmount = parseFloat(bet.amount_after_tax || bet.netBetAmount || bet.betAmount || bet.bet_amount || 0);

        console.log(`💰 [CALC_WINGO_DEBUG] calculateWingoWin called with:`, {
            betType,
            betValue,
            resultColor: result.color,
            resultNumber: result.number,
            betAmount,
            betObject: bet // Log the entire bet object to see all fields
        });

        switch (betType) {
            case 'NUMBER':
                // Bet on specific number (0-9) - 9.0x payout
                if (result.number === parseInt(betValue)) {
                    return betAmount * 9.0;
                }
                break;

            case 'COLOR':
                // Complex color betting with violet mechanics
                console.log(`💰 [PAYOUT_DEBUG] COLOR bet calculation:`, {
                    betValue,
                    resultColor: result.color,
                    betAmount,
                    gameType: 'wingo',
                    resultColorType: typeof result.color,
                    resultColorLength: result.color?.length,
                    resultColorCharCodes: result.color ? Array.from(result.color).map(c => c.charCodeAt(0)) : null
                });

                if (betValue === 'red') {
                    console.log(`💰 [PAYOUT_DEBUG] Processing red bet against result color: "${result.color}"`);

                    // Check exact string match
                    if (result.color === 'red') {
                        const payout = betAmount * 2.0;
                        console.log(`💰 [PAYOUT_DEBUG] Red bet on pure red: ${betAmount} × 2.0 = ${payout}`);
                        return payout; // Pure red win
                    } else if (result.color === 'red_violet') {
                        const payout = betAmount * 1.5;
                        console.log(`💰 [PAYOUT_DEBUG] Red bet on red_violet: ${betAmount} × 1.5 = ${payout}`);
                        console.log(`💰 [PAYOUT_CORRECT] THIS SHOULD BE THE RESULT FOR RED ON RED_VIOLET`);
                        return payout; // Mixed color win - THIS SHOULD BE 1.5x
                    } else {
                        console.log(`💰 [PAYOUT_DEBUG] Red bet loses on "${result.color}"`);
                        console.log(`💰 [PAYOUT_DEBUG] Color does not match 'red' or 'red_violet'`);
                        return 0;
                    }
                } else if (betValue === 'green') {
                    console.log(`💰 [PAYOUT_DEBUG] Processing green bet against result color: "${result.color}"`);
                    if (result.color === 'green') {
                        const payout = betAmount * 2.0;
                        console.log(`💰 [PAYOUT_DEBUG] Green bet on pure green: ${betAmount} × 2.0 = ${payout}`);
                        return payout; // Pure green win
                    } else if (result.color === 'green_violet') {
                        const payout = betAmount * 1.5;
                        console.log(`💰 [PAYOUT_DEBUG] Green bet on green_violet: ${betAmount} × 1.5 = ${payout}`);
                        return payout; // Mixed color win
                    } else {
                        console.log(`💰 [PAYOUT_DEBUG] Green bet loses on "${result.color}"`);
                        return 0;
                    }
                } else if (betValue === 'violet') {
                    console.log(`💰 [PAYOUT_DEBUG] Processing violet bet against result color: "${result.color}"`);
                    if (result.color === 'red_violet' || result.color === 'green_violet') {
                        const payout = betAmount * 4.5;
                        console.log(`💰 [PAYOUT_DEBUG] Violet bet on mixed color: ${betAmount} × 4.5 = ${payout}`);
                        return payout; // Violet win
                    } else {
                        console.log(`💰 [PAYOUT_DEBUG] Violet bet loses on "${result.color}"`);
                        return 0;
                    }
                }
                console.log(`💰 [PAYOUT_DEBUG] Unknown bet value: "${betValue}" on "${result.color}"`);
                return 0;

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

        console.log(`💰 [CALC_WINGO_DEBUG] No win condition met, returning 0`);
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
        console.log(`🎲 [K3_PAYOUT_START] Starting K3 payout calculation:`, {
            betId: bet.bet_id,
            betType: bet.bet_type,
            betValue: betValue,
            betAmount: bet.bet_amount,
            amountAfterTax: bet.amount_after_tax,
            netBetAmount: bet.netBetAmount
        });

        // Use net bet amount (after platform fee) for payout calculations
        const betAmount = parseFloat(bet.amount_after_tax || bet.netBetAmount || bet.betAmount || bet.bet_amount || 0);
        const sum = result.sum || (result.dice_1 + result.dice_2 + result.dice_3);

        console.log(`🎲 [K3_PAYOUT_DEBUG] Bet and result data:`, {
            betAmount: betAmount,
            dice: [result.dice_1, result.dice_2, result.dice_3],
            sum: sum,
            hasPair: result.has_pair,
            hasTriple: result.has_triple,
            isStraight: result.is_straight
        });

        switch (betType) {
            case 'SUM':
                // Specific sum bets with varying payouts
                const targetSum = parseInt(betValue);
                console.log(`🎲 [K3_SUM_CHECK] Checking SUM bet: ${targetSum} vs actual sum: ${sum}`);

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
                    const multiplier = payoutMultipliers[targetSum] || 1.0;
                    const payout = betAmount * multiplier;

                    console.log(`🎲 [K3_SUM_WIN] SUM bet WON!`, {
                        targetSum: targetSum,
                        actualSum: sum,
                        multiplier: multiplier,
                        betAmount: betAmount,
                        payout: payout
                    });

                    return payout;
                } else {
                    console.log(`🎲 [K3_SUM_LOSS] SUM bet LOST: ${targetSum} !== ${sum}`);
                }
                break;

            case 'SUM_MULTIPLE':
                // Multiple sum bets - check if actual sum matches any of the bet values
                const sumValues = betValue.split(',').map(s => parseInt(s.trim()));
                console.log(`🎲 [K3_MULTIPLE_SUM_CHECK] Checking SUM_MULTIPLE bet: ${sumValues.join(',')} vs actual sum: ${sum}`);

                if (sumValues.includes(sum)) {
                    // Use the correct multiplier for the winning sum
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
                    const multiplier = payoutMultipliers[sum] || 1.0;
                    const payout = betAmount * multiplier;

                    console.log(`🎲 [K3_MULTIPLE_SUM_WIN] SUM_MULTIPLE bet WON!`, {
                        betValues: sumValues,
                        winningSum: sum,
                        actualSum: sum,
                        multiplier: multiplier,
                        betAmount: betAmount,
                        payout: payout
                    });

                    return payout;
                } else {
                    console.log(`🎲 [K3_MULTIPLE_SUM_LOSS] SUM_MULTIPLE bet LOST: ${sum} not in ${sumValues.join(',')}`);
                }
                break;

            case 'SUM_CATEGORY':
                // Sum categories - 2.0x payout
                console.log(`🎲 [K3_SUM_CATEGORY_CHECK] Checking SUM_CATEGORY bet: ${betValue} vs sum: ${sum}`);

                if (betValue === 'big' && sum >= 11) {
                    const payout = betAmount * 2.0;
                    console.log(`🎲 [K3_SUM_CATEGORY_WIN] BIG bet WON! (sum ${sum} >= 11)`, {
                        betValue: betValue,
                        sum: sum,
                        multiplier: 2.0,
                        betAmount: betAmount,
                        payout: payout
                    });
                    return payout;
                } else if (betValue === 'small' && sum < 11) {
                    const payout = betAmount * 2.0;
                    console.log(`🎲 [K3_SUM_CATEGORY_WIN] SMALL bet WON! (sum ${sum} < 11)`, {
                        betValue: betValue,
                        sum: sum,
                        multiplier: 2.0,
                        betAmount: betAmount,
                        payout: payout
                    });
                    return payout;
                } else if (betValue === 'odd' && sum % 2 === 1) {
                    const payout = betAmount * 2.0;
                    console.log(`🎲 [K3_SUM_CATEGORY_WIN] ODD bet WON! (sum ${sum} is odd)`, {
                        betValue: betValue,
                        sum: sum,
                        multiplier: 2.0,
                        betAmount: betAmount,
                        payout: payout
                    });
                    return payout;
                } else if (betValue === 'even' && sum % 2 === 0) {
                    const payout = betAmount * 2.0;
                    console.log(`🎲 [K3_SUM_CATEGORY_WIN] EVEN bet WON! (sum ${sum} is even)`, {
                        betValue: betValue,
                        sum: sum,
                        multiplier: 2.0,
                        betAmount: betAmount,
                        payout: payout
                    });
                    return payout;
                } else {
                    console.log(`🎲 [K3_SUM_CATEGORY_LOSS] SUM_CATEGORY bet LOST:`, {
                        betValue: betValue,
                        sum: sum,
                        isBig: sum >= 11,
                        isOdd: sum % 2 === 1
                    });
                }
                break;

            case 'MATCHING_DICE':
                console.log(`🎲 [K3_MATCHING_DICE_CHECK] Checking MATCHING_DICE bet: ${betValue}`, {
                    hasTriple: result.has_triple,
                    hasPair: result.has_pair,
                    dice: [result.dice_1, result.dice_2, result.dice_3]
                });

                if (betValue === 'triple_any' && result.has_triple) {
                    const payout = betAmount * 34.56; // Any triple
                    console.log(`🎲 [K3_MATCHING_DICE_WIN] TRIPLE_ANY bet WON!`, {
                        betValue: betValue,
                        dice: [result.dice_1, result.dice_2, result.dice_3],
                        multiplier: 34.56,
                        betAmount: betAmount,
                        payout: payout
                    });
                    return payout;
                } else if (betValue === 'pair_any' && result.has_pair && !result.has_triple) {
                    const payout = betAmount * 13.83; // Any pair (not triple)
                    console.log(`🎲 [K3_MATCHING_DICE_WIN] PAIR_ANY bet WON!`, {
                        betValue: betValue,
                        dice: [result.dice_1, result.dice_2, result.dice_3],
                        multiplier: 13.83,
                        betAmount: betAmount,
                        payout: payout
                    });
                    return payout;
                } else if (betValue.startsWith('triple_') && result.has_triple) {
                    // Specific triple (e.g., triple_5 for three 5s)
                    const targetNumber = parseInt(betValue.split('_')[1]);
                    const dice = [result.dice_1, result.dice_2, result.dice_3];
                    console.log(`🎲 [K3_SPECIFIC_TRIPLE_CHECK] Checking specific triple: ${targetNumber} vs dice: [${dice.join(',')}]`);

                    if (dice.every(d => d === targetNumber)) {
                        const payout = betAmount * 207.36; // Specific triple
                        console.log(`🎲 [K3_MATCHING_DICE_WIN] SPECIFIC_TRIPLE bet WON!`, {
                            betValue: betValue,
                            targetNumber: targetNumber,
                            dice: dice,
                            multiplier: 207.36,
                            betAmount: betAmount,
                            payout: payout
                        });
                        return payout;
                    } else {
                        console.log(`🎲 [K3_MATCHING_DICE_LOSS] SPECIFIC_TRIPLE bet LOST: ${targetNumber} !== all dice`);
                    }
                } else if (betValue.startsWith('pair_') && result.has_pair) {
                    // Specific pair with specific single
                    const [pairNum, singleNum] = betValue.split('_').slice(1).map(n => parseInt(n));
                    const dice = [result.dice_1, result.dice_2, result.dice_3];
                    const counts = dice.reduce((acc, val) => {
                        acc[val] = (acc[val] || 0) + 1;
                        return acc;
                    }, {});

                    console.log(`🎲 [K3_SPECIFIC_PAIR_CHECK] Checking specific pair: ${pairNum} with single: ${singleNum}`, {
                        dice: dice,
                        counts: counts
                    });

                    if (counts[pairNum] === 2 && counts[singleNum] === 1) {
                        const payout = betAmount * 69.12; // Specific pair with specific single
                        console.log(`🎲 [K3_MATCHING_DICE_WIN] SPECIFIC_PAIR bet WON!`, {
                            betValue: betValue,
                            pairNumber: pairNum,
                            singleNumber: singleNum,
                            dice: dice,
                            counts: counts,
                            multiplier: 69.12,
                            betAmount: betAmount,
                            payout: payout
                        });
                        return payout;
                    } else {
                        console.log(`🎲 [K3_MATCHING_DICE_LOSS] SPECIFIC_PAIR bet LOST:`, {
                            expectedPair: pairNum,
                            expectedSingle: singleNum,
                            actualCounts: counts
                        });
                    }
                } else {
                    console.log(`🎲 [K3_MATCHING_DICE_LOSS] MATCHING_DICE bet LOST:`, {
                        betValue: betValue,
                        hasTriple: result.has_triple,
                        hasPair: result.has_pair
                    });
                }
                break;

            case 'PATTERN':
                console.log(`🎲 [K3_PATTERN_CHECK] Checking PATTERN bet: ${betValue}`, {
                    dice: [result.dice_1, result.dice_2, result.dice_3],
                    isStraight: result.is_straight,
                    hasPair: result.has_pair,
                    hasTriple: result.has_triple
                });

                if (betValue === 'all_different') {
                    // All three dice different
                    const dice = [result.dice_1, result.dice_2, result.dice_3];
                    const unique = new Set(dice);
                    console.log(`🎲 [K3_ALL_DIFFERENT_CHECK] Checking all_different: unique count = ${unique.size}`);

                    if (unique.size === 3) {
                        const payout = betAmount * 34.56;
                        console.log(`🎲 [K3_PATTERN_WIN] ALL_DIFFERENT bet WON!`, {
                            betValue: betValue,
                            dice: dice,
                            uniqueCount: unique.size,
                            multiplier: 34.56,
                            betAmount: betAmount,
                            payout: payout
                        });
                        return payout;
                    } else {
                        console.log(`🎲 [K3_PATTERN_LOSS] ALL_DIFFERENT bet LOST: unique count ${unique.size} !== 3`);
                    }
                } else if (betValue === 'straight' && result.is_straight) {
                    const payout = betAmount * 8.64; // Three consecutive numbers
                    console.log(`🎲 [K3_PATTERN_WIN] STRAIGHT bet WON!`, {
                        betValue: betValue,
                        dice: [result.dice_1, result.dice_2, result.dice_3],
                        isStraight: result.is_straight,
                        multiplier: 8.64,
                        betAmount: betAmount,
                        payout: payout
                    });
                    return payout;
                } else if (betValue === 'two_different' && result.has_pair && !result.has_triple) {
                    const payout = betAmount * 69.12; // One pair
                    console.log(`🎲 [K3_PATTERN_WIN] TWO_DIFFERENT bet WON!`, {
                        betValue: betValue,
                        dice: [result.dice_1, result.dice_2, result.dice_3],
                        hasPair: result.has_pair,
                        hasTriple: result.has_triple,
                        multiplier: 69.12,
                        betAmount: betAmount,
                        payout: payout
                    });
                    return payout;
                } else {
                    console.log(`🎲 [K3_PATTERN_LOSS] PATTERN bet LOST:`, {
                        betValue: betValue,
                        isStraight: result.is_straight,
                        hasPair: result.has_pair,
                        hasTriple: result.has_triple
                    });
                }
                break;
        }

        console.log(`🎲 [K3_PAYOUT_END] Bet LOST - no matching conditions found for betType: ${betType}, betValue: ${betValue}`);
        return 0; // Bet loses
    } catch (error) {
        console.error(`🎲 [K3_PAYOUT_ERROR] Error calculating K3 win:`, {
            error: error.message,
            betType,
            betValue,
            betId: bet.bet_id
        });
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
        // Use net bet amount (after platform fee) for payout calculations
        const betAmount = parseFloat(bet.amount_after_tax || bet.netBetAmount || bet.betAmount || bet.bet_amount || 0);

        switch (betType) {
            case 'POSITION':
                // Bet on specific number in specific position - 9.0x payout
                const [position, number] = betValue.split('_');
                if (result[position] === parseInt(number)) {
                    return betAmount * 9.0;
                }
                break;

            case 'POSITION_SIZE':
                // Position size betting - 2.0x payout
                const [pos, sizeType] = betValue.split('_');
                const posValue = result[pos];
                const isBig = posValue >= 5; // For 0-9 dice, 5-9 is big, 0-4 is small
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
                if (betValue === 'big' && sum >= 22) { // FIXED: Use >= 22 for consistency with database
                    return betAmount * 1.98;
                } else if (betValue === 'small' && sum < 22) { // FIXED: Use < 22 for consistency
                    return betAmount * 1.98;
                } else if (betValue === 'odd' && sum % 2 === 1) {
                    return betAmount * 1.98;
                } else if (betValue === 'even' && sum % 2 === 0) {
                    return betAmount * 1.98;
                }
                break;

            case 'SUM_SIZE':
                // Sum size betting - 2.0x payout
                const sumForSize = result.sum || (result.A + result.B + result.C + result.D + result.E);
                const isSumBig = sumForSize >= 22; // FIXED: Use >= 22 for consistency with database
                // Handle both formats: "small"/"big" and "SUM_small"/"SUM_big"
                const sizeValue = betValue.startsWith('SUM_') ? betValue.split('_')[1] : betValue;
                if ((sizeValue === 'big' && isSumBig) || (sizeValue === 'small' && !isSumBig)) {
                    return betAmount * 2.0;
                }
                break;

            case 'SUM_PARITY':
                // Sum parity betting - 2.0x payout
                const sumForParity = result.sum || (result.A + result.B + result.C + result.D + result.E);
                const isSumEven = sumForParity % 2 === 0;
                // Handle both formats: "even"/"odd" and "SUM_even"/"SUM_odd"
                const parityValue = betValue.startsWith('SUM_') ? betValue.split('_')[1] : betValue;
                if ((parityValue === 'even' && isSumEven) || (parityValue === 'odd' && !isSumEven)) {
                    return betAmount * 2.0;
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
                    const winnings = calculateWinnings(bet, result, gameType);

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
/**
 * FIXED: Check if a bet is a winner - Direct result checking
 * @param {Object} bet - Bet record
 * @param {Object} result - Game result
 * @param {string} gameType - Game type
 * @returns {boolean} - Whether bet is a winner
 */
const checkBetWin = async (bet, result, gameType) => {
    try {
        const [betType, betValue] = bet.bet_type.split(':');

        console.log(`🔍 [WIN_CHECK] Checking bet win:`, {
            betType, betValue, result, gameType
        });

        switch (gameType.toLowerCase()) {
            case 'wingo':
            case 'trx_wix':
                return checkWingoWin(betType, betValue, result);

            case 'fived':
            case '5d':
                return checkFiveDWin(betType, betValue, result);

            case 'k3':
                return checkK3Win(betType, betValue, result);
        }

        return false;
    } catch (error) {
        console.error('❌ Error checking bet win:', {
            error: error.message,
            betType: bet.bet_type,
            gameType,
            result
        });
        return false;
    }
};

/**
 * FIXED: Check Wingo/TRX_WIX win conditions directly
 */
const checkWingoWin = (betType, betValue, result) => {
    console.log(`🎯 [WINGO_WIN] Checking: ${betType}:${betValue} vs result:`, result);

    switch (betType) {
        case 'NUMBER':
            const targetNumber = parseInt(betValue);
            const isNumberWin = result.number === targetNumber;
            console.log(`🔢 [NUMBER_CHECK] ${targetNumber} === ${result.number} = ${isNumberWin}`);
            return isNumberWin;

        case 'COLOR':
            const isColorWin = checkColorWin(betValue, result.number, result.color);
            console.log(`🎨 [COLOR_CHECK] ${betValue} vs ${result.color} (number: ${result.number}) = ${isColorWin}`);
            return isColorWin;

        case 'SIZE':
            const isBig = result.number >= 5;
            const isSizeWin = (betValue.toLowerCase() === 'big' && isBig) ||
                (betValue.toLowerCase() === 'small' && !isBig);
            console.log(`📏 [SIZE_CHECK] ${betValue} vs ${isBig ? 'big' : 'small'} (number: ${result.number}) = ${isSizeWin}`);
            return isSizeWin;

        case 'PARITY':
            const isEven = result.number % 2 === 0;
            const isParityWin = (betValue.toLowerCase() === 'even' && isEven) ||
                (betValue.toLowerCase() === 'odd' && !isEven);
            console.log(`⚖️ [PARITY_CHECK] ${betValue} vs ${isEven ? 'even' : 'odd'} (number: ${result.number}) = ${isParityWin}`);
            return isParityWin;

        default:
            console.log(`❓ [UNKNOWN_BET_TYPE] ${betType}`);
            return false;
    }
};

/**
 * FIXED: Check color win with proper violet logic
 */
const checkColorWin = (betValue, resultNumber, resultColor) => {
    const betColor = betValue.toLowerCase();

    // Get the actual color for the number (deterministic)
    const actualColor = getColorForNumber(resultNumber);

    console.log(`🎨 [COLOR_DETAIL] Bet: ${betColor}, Number: ${resultNumber}, Actual color: ${actualColor}, Result color: ${resultColor}`);

    switch (betColor) {
        case 'red':
            // Red bet wins on red numbers (2, 4, 6, 8) and red_violet (0)
            return actualColor === 'red' || actualColor === 'red_violet';

        case 'green':
            // Green bet wins on green numbers (1, 3, 7, 9) and green_violet (5)
            return actualColor === 'green' || actualColor === 'green_violet';

        case 'violet':
        case 'purple':
            // Violet bet wins ONLY on violet numbers (0, 5)
            return actualColor === 'red_violet' || actualColor === 'green_violet';

        default:
            return false;
    }
};

/**
 * FIXED: Check 5D win conditions directly
 */
const checkFiveDWin = (betType, betValue, result) => {
    console.log(`🎯 [5D_WIN] Checking: ${betType}:${betValue} vs result:`, result);

    switch (betType) {
        case 'POSITION':
            const [position, value] = betValue.split('_');
            const positionValue = result[position];
            const targetValue = parseInt(value);
            const isPositionWin = positionValue === targetValue;
            console.log(`📍 [POSITION_CHECK] ${position}:${targetValue} === ${positionValue} = ${isPositionWin}`);
            return isPositionWin;

        case 'POSITION_SIZE':
            const [pos, size] = betValue.split('_');
            const posValue = result[pos];
            const isBig = posValue >= 5; // For 0-9 dice, 5-9 is big, 0-4 is small
            const isPositionSizeWin = (size === 'big' && isBig) || (size === 'small' && !isBig);
            console.log(`📏 [POSITION_SIZE_CHECK] ${pos}:${size} vs ${posValue} (${isBig ? 'big' : 'small'}) = ${isPositionSizeWin}`);
            return isPositionSizeWin;

        case 'POSITION_PARITY':
            const [position2, parity] = betValue.split('_');
            const posValue2 = result[position2];
            const isEven = posValue2 % 2 === 0;
            const isPositionParityWin = (parity === 'even' && isEven) || (parity === 'odd' && !isEven);
            console.log(`⚖️ [POSITION_PARITY_CHECK] ${position2}:${parity} vs ${posValue2} (${isEven ? 'even' : 'odd'}) = ${isPositionParityWin}`);
            return isPositionParityWin;

        case 'SUM':
            const sum = result.A + result.B + result.C + result.D + result.E;
            const targetSum = parseInt(betValue);
            const isSumWin = sum === targetSum;
            console.log(`➕ [SUM_CHECK] ${targetSum} === ${sum} = ${isSumWin}`);
            return isSumWin;

        case 'SUM_SIZE':
            const totalSum = result.A + result.B + result.C + result.D + result.E;
            const isSumBig = totalSum >= 22; // FIXED: Use >= 22 for consistency with database
            // Handle both formats: "small"/"big" and "SUM_small"/"SUM_big"
            const sizeValue = betValue.startsWith('SUM_') ? betValue.split('_')[1] : betValue;
            const isSumSizeWin = (sizeValue === 'big' && isSumBig) || (sizeValue === 'small' && !isSumBig);
            console.log(`📏 [SUM_SIZE_CHECK] ${betValue} (extracted: ${sizeValue}) vs ${totalSum} (${isSumBig ? 'big' : 'small'}) = ${isSumSizeWin}`);
            return isSumSizeWin;

        case 'SUM_PARITY':
            const sum2 = result.A + result.B + result.C + result.D + result.E;
            const isSumEven = sum2 % 2 === 0;
            // Handle both formats: "even"/"odd" and "SUM_even"/"SUM_odd"
            const parityValue = betValue.startsWith('SUM_') ? betValue.split('_')[1] : betValue;
            const isSumParityWin = (parityValue === 'even' && isSumEven) || (parityValue === 'odd' && !isSumEven);
            console.log(`⚖️ [SUM_PARITY_CHECK] ${betValue} (extracted: ${parityValue}) vs ${sum2} (${isSumEven ? 'even' : 'odd'}) = ${isSumParityWin}`);
            return isSumParityWin;

        default:
            console.log(`❓ [UNKNOWN_5D_BET_TYPE] ${betType}`);
            return false;
    }
};

/**
 * FIXED: Check K3 win conditions directly
 */
const checkK3Win = (betType, betValue, result) => {
    console.log(`🎯 [K3_WIN_CHECK_START] Checking K3 win condition: ${betType}:${betValue} vs result:`, {
        dice: [result.dice_1, result.dice_2, result.dice_3],
        sum: result.sum,
        hasPair: result.has_pair,
        hasTriple: result.has_triple,
        isStraight: result.is_straight
    });

    const dice = [result.dice_1, result.dice_2, result.dice_3];
    const sum = result.sum || dice.reduce((a, b) => a + b, 0);

    switch (betType) {
        case 'SUM':
            const targetSum = parseInt(betValue);
            const isSumWin = sum === targetSum;
            console.log(`➕ [K3_SUM_CHECK] ${targetSum} === ${sum} = ${isSumWin}`);
            return isSumWin;

        case 'SUM_MULTIPLE':
            // Handle multiple sum values (comma-separated)
            const sumValues = betValue.split(',').map(s => parseInt(s.trim()));
            const isMultipleSumWin = sumValues.includes(sum);
            console.log(`➕ [K3_MULTIPLE_SUM_CHECK] ${sumValues.join(',')} includes ${sum} = ${isMultipleSumWin}`);
            return isMultipleSumWin;

        case 'SUM_CATEGORY':
            const normalizedBetValue = betValue.toLowerCase();
            if (normalizedBetValue === 'big') {
                const isSumCategoryWin = sum >= 11;
                console.log(`📏 [K3_SUM_CATEGORY_CHECK] big vs ${sum} (>= 11) = ${isSumCategoryWin}`);
                return isSumCategoryWin;
            } else if (normalizedBetValue === 'small') {
                const isSumCategoryWin = sum < 11;
                console.log(`📏 [K3_SUM_CATEGORY_CHECK] small vs ${sum} (< 11) = ${isSumCategoryWin}`);
                return isSumCategoryWin;
            } else if (normalizedBetValue === 'odd') {
                const isSumParityWin = sum % 2 === 1;
                console.log(`⚖️ [K3_SUM_PARITY_CHECK] odd vs ${sum} = ${isSumParityWin}`);
                return isSumParityWin;
            } else if (normalizedBetValue === 'even') {
                const isSumParityWin = sum % 2 === 0;
                console.log(`⚖️ [K3_SUM_PARITY_CHECK] even vs ${sum} = ${isSumParityWin}`);
                return isSumParityWin;
            }
            console.log(`❓ [K3_UNKNOWN_SUM_CATEGORY] Unknown sum category: ${betValue}`);
            return false;

        case 'SUM_SIZE':
            // SUM_SIZE is the same as SUM_CATEGORY for size bets
            const normalizedSizeValue = betValue.toLowerCase();
            if (normalizedSizeValue === 'big') {
                const isSumSizeWin = sum >= 11;
                console.log(`📏 [K3_SUM_SIZE_CHECK] big vs ${sum} (>= 11) = ${isSumSizeWin}`);
                return isSumSizeWin;
            } else if (normalizedSizeValue === 'small') {
                const isSumSizeWin = sum < 11;
                console.log(`📏 [K3_SUM_SIZE_CHECK] small vs ${sum} (< 11) = ${isSumSizeWin}`);
                return isSumSizeWin;
            }
            console.log(`❓ [K3_UNKNOWN_SUM_SIZE] Unknown sum size: ${betValue}`);
            return false;

        case 'SUM_PARITY':
            // SUM_PARITY is the same as SUM_CATEGORY for parity bets
            const normalizedParityValue = betValue.toLowerCase();
            if (normalizedParityValue === 'odd') {
                const isSumParityWin = sum % 2 === 1;
                console.log(`⚖️ [K3_SUM_PARITY_CHECK] odd vs ${sum} = ${isSumParityWin}`);
                return isSumParityWin;
            } else if (normalizedParityValue === 'even') {
                const isSumParityWin = sum % 2 === 0;
                console.log(`⚖️ [K3_SUM_PARITY_CHECK] even vs ${sum} = ${isSumParityWin}`);
                return isSumParityWin;
            }
            console.log(`❓ [K3_UNKNOWN_SUM_PARITY] Unknown sum parity: ${betValue}`);
            return false;

        case 'MATCHING_DICE':
            const normalizedMatchingValue = betValue.toLowerCase();
            if (normalizedMatchingValue === 'triple_any') {
                const isTripleWin = result.has_triple;
                console.log(`🎲 [K3_TRIPLE_CHECK] triple_any vs has_triple:${result.has_triple} = ${isTripleWin}`);
                return isTripleWin;
            } else if (normalizedMatchingValue === 'pair_any') {
                const isPairWin = result.has_pair && !result.has_triple;
                console.log(`🎲 [K3_PAIR_CHECK] pair_any vs has_pair:${result.has_pair}, has_triple:${result.has_triple} = ${isPairWin}`);
                return isPairWin;
            } else if (normalizedMatchingValue.startsWith('triple_')) {
                const targetNumber = parseInt(normalizedMatchingValue.split('_')[1]);
                const isSpecificTripleWin = result.has_triple && dice.every(d => d === targetNumber);
                console.log(`🎲 [K3_SPECIFIC_TRIPLE_CHECK] triple_${targetNumber} vs dice:[${dice.join(',')}] = ${isSpecificTripleWin}`);
                return isSpecificTripleWin;
            } else if (normalizedMatchingValue.startsWith('pair_')) {
                const [pairNum, singleNum] = normalizedMatchingValue.split('_').slice(1).map(n => parseInt(n));
                const counts = dice.reduce((acc, val) => {
                    acc[val] = (acc[val] || 0) + 1;
                    return acc;
                }, {});
                const isSpecificPairWin = counts[pairNum] === 2 && counts[singleNum] === 1;
                console.log(`🎲 [K3_SPECIFIC_PAIR_CHECK] pair_${pairNum}_${singleNum} vs counts:${JSON.stringify(counts)} = ${isSpecificPairWin}`);
                return isSpecificPairWin;
            }
            console.log(`❓ [K3_UNKNOWN_MATCHING_DICE] Unknown matching dice: ${betValue} (normalized: ${normalizedMatchingValue})`);
            return false;

        case 'PATTERN':
            const normalizedPatternValue = betValue.toLowerCase().replace('_', '');
            if (normalizedPatternValue === 'alldifferent') {
                const unique = new Set(dice);
                const isAllDifferentWin = unique.size === 3;
                console.log(`🎲 [K3_ALL_DIFFERENT_CHECK] all_different vs dice:[${dice.join(',')}] unique:${unique.size} = ${isAllDifferentWin}`);
                return isAllDifferentWin;
            } else if (normalizedPatternValue === 'straight') {
                const isStraightWin = result.is_straight;
                console.log(`🎲 [K3_STRAIGHT_CHECK] straight vs is_straight:${result.is_straight} = ${isStraightWin}`);
                return isStraightWin;
            } else if (normalizedPatternValue === 'twodifferent') {
                const isTwoDifferentWin = result.has_pair && !result.has_triple;
                console.log(`🎲 [K3_TWO_DIFFERENT_CHECK] two_different vs has_pair:${result.has_pair}, has_triple:${result.has_triple} = ${isTwoDifferentWin}`);
                return isTwoDifferentWin;
            }
            console.log(`❓ [K3_UNKNOWN_PATTERN] Unknown pattern: ${betValue} (normalized: ${normalizedPatternValue})`);
            return false;

        default:
            console.log(`❓ [K3_UNKNOWN_BET_TYPE] Unknown bet type: ${betType}`);
            return false;
    }
};

/**
 * Calculate winnings for a winning bet
 * @param {Object} bet - Bet record
 * @param {string} gameType - Game type
 * @returns {number} - Winnings amount
 */
const calculateWinnings = (bet, result, gameType) => {
    try {
        console.log(`💰 [WINNINGS_START] Starting calculation for:`, {
            betId: bet.bet_id,
            gameType,
            betType: bet.bet_type,
            resultColor: result.color,
            resultNumber: result.number
        });

        // First check if the bet actually won
        const [betType, betValue] = bet.bet_type.split(':');
        let isWinner = false;

        switch (gameType.toLowerCase()) {
            case 'wingo':
            case 'trx_wix':
                isWinner = checkWingoWin(betType, betValue, result);
                console.log(`💰 [WIN_CHECK] checkWingoWin returned: ${isWinner}`);
                break;
            case 'fived':
            case '5d':
                isWinner = checkFiveDWin(betType, betValue, result);
                break;
            case 'k3':
                isWinner = checkK3Win(betType, betValue, result);
                break;
        }

        // If bet didn't win, return 0
        if (!isWinner) {
            console.log(`💰 [NO_WIN] Bet did not win, returning 0`);
            return 0;
        }

        // FIXED: Use comprehensive payout functions for accurate calculations
        let winnings = 0;

        console.log(`💰 [WINNINGS_DEBUG] Bet data for payout calculation:`, {
            betId: bet.bet_id,
            betType: bet.bet_type,
            betAmount: bet.bet_amount,
            amountAfterTax: bet.amount_after_tax,
            netBetAmount: bet.netBetAmount,
            betAmountField: bet.betAmount
        });

        switch (gameType.toLowerCase()) {
            case 'wingo':
            case 'trx_wix':
                console.log(`💰 [CALLING_CALC] About to call calculateWingoWin`);
                winnings = calculateWingoWin(bet, result, betType, betValue);
                console.log(`💰 [CALC_RESULT] calculateWingoWin returned: ${winnings}`);
                break;
            case 'fived':
            case '5d':
                winnings = calculateFiveDWin(bet, result, betType, betValue);
                break;
            case 'k3':
                winnings = calculateK3Win(bet, result, betType, betValue);
                break;
            default:
                logger.warn('Unknown game type in win calculation', { gameType });
                winnings = 0;
        }

        // Payout functions now return the correct amount directly
        const grossBetAmount = parseFloat(bet.bet_amount || bet.betAmount || 0);
        const netBetAmount = parseFloat(bet.amount_after_tax || 0);

        console.log(`💰 [FINAL_WINNINGS] Final winnings calculated: ${winnings}`);

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
                                link: result.verification_link,
                                block: result.block_number || null,
                                time: result.result_time || result.created_at
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
                    const resultKeys = await getRedisHelper().keys(`${gameType}:${duration}:*:result`);

                    for (const key of resultKeys) {
                        // Extract periodId from key
                        const keyParts = key.split(':');
                        const periodId = keyParts[keyParts.length - 2];

                        // If period date is older than our threshold, delete it
                        if (periodId && periodId.startsWith('20') && periodId.slice(0, 8) < compareDate) {
                            await getRedisHelper().del(key);
                            summary.cleaned++;
                        }
                    }

                    // 2. Clean up bet tracking data (always aggressive)
                    const betKeys = await getRedisHelper().keys(`${gameType}:${duration}:*:total`);
                    for (const key of betKeys) {
                        const keyParts = key.split(':');
                        const periodId = keyParts[2];

                        // If period is older than yesterday, remove it
                        if (periodId && periodId.startsWith('20') && periodId.slice(0, 8) < yesterdayStr) {
                            await getRedisHelper().del(key);

                            // Also remove related keys
                            const relatedPrefix = `${gameType}:${duration}:${periodId}`;
                            const relatedKeys = await getRedisHelper().keys(`${relatedPrefix}:*`);

                            for (const relatedKey of relatedKeys) {
                                await getRedisHelper().del(relatedKey);
                                summary.cleaned++;
                            }
                        }
                    }

                    // 3. Only keep last 10 periods in recent_results list
                    const recentResultsKey = `${gameType}:${duration}:recent_results`;
                    await getRedisHelper().zremrangebyrank(recentResultsKey, 0, -11);

                    // 4. Only keep last 20 tracked periods
                    const trackedPeriodsKey = `${gameType}:${duration}:tracked_periods`;
                    await getRedisHelper().zremrangebyrank(trackedPeriodsKey, 0, -21);
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
        const betsData = await getRedisHelper().hgetall(betHashKey);

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
        await getRedisHelper().zadd(recentResultsKey, score, JSON.stringify(historyItem));

        // Keep only last 100 results
        await getRedisHelper().zremrangebyrank(recentResultsKey, 0, -101);

        // Set expiry for 24 hours
        await getRedisHelper().expire(recentResultsKey, 86400);

        // Also store in history list
        await getRedisHelper().lpush(historyKey, JSON.stringify(historyItem));

        // Trim history list to 100 items
        await getRedisHelper().ltrim(historyKey, 0, 99);

        // Set expiry for 24 hours
        await getRedisHelper().expire(historyKey, 86400);

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

        // Use comprehensive payout functions for accurate calculations
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
                    if (typeof result[dice] !== 'number' || result[dice] < 0 || result[dice] > 9) {
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
                const dice = Array(5).fill(0).map(() => Math.floor(Math.random() * 10)); // 0-9
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
                // FIXED: Generate proper 5D result with dice values 0-9
                const dice = [];
                for (let i = 0; i < 5; i++) {
                    dice.push(Math.floor(Math.random() * 10)); // 0-9 instead of 1-6
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
                if (result.A < 0 || result.A > 9 || result.B < 0 || result.B > 9 ||
                    result.C < 0 || result.C > 9 || result.D < 0 || result.D > 9 ||
                    result.E < 0 || result.E > 9) {
                    throw new Error('Invalid 5D result generated - dice values must be 0-9');
                }
                break;

            case 'k3':
                // FIXED: Generate proper K3 result with all required fields
                const k3Dice = [];
                for (let i = 0; i < 3; i++) {
                    k3Dice.push(Math.floor(Math.random() * 6) + 1); // 1-6 for K3
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
    return `https://tronscan.org/#/block/${hash}`;
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
        await getRedisHelper().incrbyfloat(totalKey, betAmount);

        // Update exposure tracking - FIXED: Pass production format that actually works
        await updateBetExposure(gameType, duration, periodId, {
            bet_type: `${betType}:${betValue}`,    // Use production format: "COLOR:red"
            amount_after_tax: betAmount,            // Use production field name
            netBetAmount: betAmount,                // Keep legacy fallback
            odds
        }, 'default');

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
        if (!userId || !gameType || !duration || !periodId || !betType || betValue === undefined || !betAmount) {
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
        if (netBetAmount < 0.95) {
            return {
                valid: false,
                message: 'Net bet amount after platform fee must be at least ₹0.95',
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
        const currentTotal = await getRedisHelper().get(totalKey) || '0';
        const newTotal = parseFloat(currentTotal) + parseFloat(netBetAmount);
        await getRedisHelper().set(totalKey, newTotal.toString());

        // Track platform fees
        const feeKey = `${gameType}:${durationKey}:${timeline}:${periodId}:fees`;
        const currentFees = await getRedisHelper().get(feeKey) || '0';
        const newFees = parseFloat(currentFees) + parseFloat(platformFee);
        await getRedisHelper().set(feeKey, newFees.toString());

        // Track gross amounts
        const grossKey = `${gameType}:${durationKey}:${timeline}:${periodId}:gross`;
        const currentGross = await getRedisHelper().get(grossKey) || '0';
        const newGross = parseFloat(currentGross) + parseFloat(grossBetAmount);
        await getRedisHelper().set(grossKey, newGross.toString());

        // Update exposure tracking - FIXED: Pass production format that actually works
        await updateBetExposure(gameType, duration, periodId, {
            bet_type: `${betType}:${betValue}`,    // Use production format: "COLOR:red"
            amount_after_tax: netBetAmount,         // Use production field name
            netBetAmount,                           // Keep legacy fallback
            odds
        }, timeline);

        // Set expiry for all keys
        await getRedisHelper().expire(totalKey, 86400);
        await getRedisHelper().expire(feeKey, 86400);
        await getRedisHelper().expire(grossKey, 86400);

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
        const fallbackData = await getRedisHelper().get(fallbackKey);

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
        console.log('✅ [GAMELOGIC_SERVICE] ===== CORRECT SYSTEM CALLED =====');
        console.log('✅ [GAMELOGIC_SERVICE] This is the GOOD system with all protections!');
        console.log('✅ [GAMELOGIC_SERVICE] Features: User threshold ✅ | Exposure tracking ✅ | Correct win logic ✅');
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
            const redisLockAcquired = await getRedisHelper().set(redisLockKey, redisLockValue, 'EX', 30, 'NX');

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
                        block_number: resultWithVerification.verification?.blockNumber || null,
                        result_time: resultWithVerification.verification?.resultTime || new Date(),
                        duration: duration,
                        timeline: timeline
                    }, { transaction: useTransaction });

                    // 💰 CRYPTO RESULT LOGGER - Easy to identify new TRX_WIX results from game logic
                    console.log('💰 [TRX_WIX_GAME_LOGIC] New result generated and stored:', {
                        periodId: periodId,
                        result: result,
                        hash: resultWithVerification.verification?.hash || 'GENERATED',
                        link: resultWithVerification.verification?.link || 'GENERATED',
                        blockNumber: resultWithVerification.verification?.blockNumber || 'NULL',
                        resultTime: resultWithVerification.verification?.resultTime || 'DEFAULT',
                        duration: duration,
                        timeline: timeline,
                        resultId: savedResult.result_id,
                        timestamp: new Date().toISOString()
                    });
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
                    const currentLock = await getRedisHelper().get(redisLockKey);
                    if (currentLock === redisLockValue) {
                        await getRedisHelper().del(redisLockKey);
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
                // FIXED: Use 0-9 dice values for 5D
                const dice = [];
                for (let i = 0; i < 5; i++) {
                    dice.push(((Math.floor(Math.random() * 10) + timelineSeed) % 10)); // 0-9
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
        console.log(`🔥🔥🔥 THIS IS THE REAL PAYOUT FUNCTION! 🔥🔥🔥`);
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
                    const isWinner = await checkBetWin(bet, result, gameType);
                    if (isWinner) {
                        console.log(`💰 [PAYOUT_START] About to calculate winnings for bet:`, {
                            betId: bet.bet_id,
                            betType: bet.bet_type,
                            betAmount: bet.bet_amount,
                            amountAfterTax: bet.amount_after_tax
                        });

                        // Add K3 exposure logging similar to Wingo
                        if (gameType.toLowerCase() === 'k3') {
                            const [betType, betValue] = bet.bet_type.split(':');
                            console.log(`🎲 [K3_EXPOSURE_PAYOUT] K3 bet WON - calculating exposure:`, {
                                betId: bet.bet_id,
                                betType: betType,
                                betValue: betValue,
                                betAmount: bet.amount_after_tax,
                                result: {
                                    dice: [result.dice_1, result.dice_2, result.dice_3],
                                    sum: result.sum,
                                    hasPair: result.has_pair,
                                    hasTriple: result.has_triple,
                                    isStraight: result.is_straight
                                }
                            });
                        }

                        const winnings = calculateWinnings(bet, result, gameType);
                        console.log(`💰 [PAYOUT_END] calculateWinnings returned: ${winnings}`);

                        // Add K3 exposure payout logging
                        if (gameType.toLowerCase() === 'k3') {
                            const [betType, betValue] = bet.bet_type.split(':');
                            console.log(`🎲 [K3_EXPOSURE_PAYOUT_COMPLETE] K3 payout calculated:`, {
                                betId: bet.bet_id,
                                betType: betType,
                                betValue: betValue,
                                betAmount: bet.amount_after_tax,
                                winnings: winnings,
                                multiplier: winnings / bet.amount_after_tax,
                                result: {
                                    dice: [result.dice_1, result.dice_2, result.dice_3],
                                    sum: result.sum
                                }
                            });
                        }

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
                        // Add K3 exposure logging for losing bets
                        if (gameType.toLowerCase() === 'k3') {
                            const [betType, betValue] = bet.bet_type.split(':');
                            console.log(`🎲 [K3_EXPOSURE_LOSS] K3 bet LOST - no exposure:`, {
                                betId: bet.bet_id,
                                betType: betType,
                                betValue: betValue,
                                betAmount: bet.amount_after_tax,
                                result: {
                                    dice: [result.dice_1, result.dice_2, result.dice_3],
                                    sum: result.sum,
                                    hasPair: result.has_pair,
                                    hasTriple: result.has_triple,
                                    isStraight: result.is_straight
                                }
                            });
                        }

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

            // Add K3 exposure summary logging
            if (gameType.toLowerCase() === 'k3') {
                const totalWinnings = winningBets.reduce((sum, bet) => sum + bet.winnings, 0);
                const totalBetAmount = winningBets.reduce((sum, bet) => sum + bet.betAmount, 0);
                console.log(`🎲 [K3_EXPOSURE_SUMMARY] K3 period payout summary for ${timeline}:`, {
                    periodId: periodId,
                    totalBets: bets.length,
                    winningBets: winningBets.length,
                    totalBetAmount: totalBetAmount,
                    totalWinnings: totalWinnings,
                    netExposure: totalWinnings - totalBetAmount,
                    result: {
                        dice: [result.dice_1, result.dice_2, result.dice_3],
                        sum: result.sum
                    }
                });
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

        // Add K3-specific logging at the very beginning
        if (betData.gameType && betData.gameType.toLowerCase() === 'k3') {
            console.log('🎲 [K3_BET_DETECTED] K3 bet detected at entry point!');
            console.log('🎲 [K3_BET_DETECTED] Bet details:', {
                gameType: betData.gameType,
                betType: betData.betType,
                betValue: betData.betValue,
                betAmount: betData.betAmount,
                userId: betData.userId,
                periodId: betData.periodId
            });
        }

        const validation = await validateBetWithTimeline(betData);
        if (!validation.valid) {
            console.log('❌ [BET_VALIDATION] Bet validation failed:', validation);

            // Add K3-specific validation failure logging
            if (betData.gameType && betData.gameType.toLowerCase() === 'k3') {
                console.log('🎲 [K3_VALIDATION_FAILED] K3 bet validation failed!');
                console.log('🎲 [K3_VALIDATION_FAILED] Validation errors:', validation);
            }

            return validation;
        }

        const { grossBetAmount, platformFee, netBetAmount } = validation.amounts;
        const {
            userId, gameType, duration, timeline = 'default',
            periodId, betType: originalBetType, betValue, odds
        } = betData;

        // FIX: Correct K3 bet type based on bet value
        let betType = originalBetType;
        if (gameType.toLowerCase() === 'k3') {
            console.log(`🎲 [K3_BET_TYPE_CHECK] Checking bet type correction for K3 bet: ${originalBetType}:${betValue}`);

            // Check if this is a SUM_CATEGORY bet that was incorrectly sent as SUM
            if (originalBetType === 'SUM' && ['Small', 'Big', 'Odd', 'Even'].includes(betValue)) {
                betType = 'SUM_CATEGORY';
                console.log(`🔧 [K3_BET_TYPE_FIX] Correcting bet type from ${originalBetType} to ${betType} for value: ${betValue}`);
            }
            // Check if this is a PATTERN bet that was incorrectly sent as SUM
            else if (originalBetType === 'SUM' && ['Straight', 'All_Different', 'Two_Different'].includes(betValue)) {
                betType = 'PATTERN';
                console.log(`🔧 [K3_BET_TYPE_FIX] Correcting bet type from ${originalBetType} to ${betType} for value: ${betValue}`);
            }
            // Check if this is a MATCHING_DICE bet that was incorrectly sent as SUM
            else if (originalBetType === 'SUM' && (betValue.startsWith('Triple') || betValue.startsWith('Pair'))) {
                betType = 'MATCHING_DICE';
                console.log(`🔧 [K3_BET_TYPE_FIX] Correcting bet type from ${originalBetType} to ${betType} for value: ${betValue}`);
            }
            else {
                console.log(`🎲 [K3_BET_TYPE_CHECK] No correction needed for ${originalBetType}:${betValue}`);
            }
        }

        // Handle SUM_MULTIPLE bets by creating individual bet records
        if (betType === 'SUM_MULTIPLE') {
            console.log(`🎲 [K3_MULTIPLE_SUM_PROCESSING] Processing SUM_MULTIPLE bet: ${betValue}`);

            const sumValues = betValue.split(',').map(s => s.trim());
            const amountPerValue = netBetAmount / sumValues.length;

            console.log(`🎲 [K3_MULTIPLE_SUM_DISTRIBUTION] Total amount: ₹${netBetAmount}, Values: ${sumValues.length}, Amount per value: ₹${amountPerValue}`);

            // Create individual bet records for each sum value
            const individualBets = [];
            for (const sumValue of sumValues) {
                const individualOdds = calculateOdds(gameType, 'SUM', sumValue);
                individualBets.push({
                    ...betData,
                    betType: 'SUM',
                    betValue: sumValue,
                    betAmount: amountPerValue,
                    odds: individualOdds
                });
            }

            console.log(`🎲 [K3_MULTIPLE_SUM_CREATED] Created ${individualBets.length} individual bets:`, individualBets.map(bet => `${bet.betType}:${bet.betValue} (₹${bet.betAmount})`));

            // Process each individual bet
            const results = [];
            for (const individualBet of individualBets) {
                const result = await processBet(individualBet);
                results.push(result);
            }

            // Return combined result
            const allSuccessful = results.every(r => r.success);
            const totalExpectedWin = results.reduce((sum, r) => sum + (r.data?.expectedWin || 0), 0);

            return {
                success: allSuccessful,
                message: allSuccessful ? 'Multiple sum bets placed successfully' : 'Some bets failed',
                data: {
                    ...betData,
                    betType: 'SUM_MULTIPLE',
                    betValue: betValue,
                    expectedWin: totalExpectedWin,
                    individualBets: results.length,
                    breakdown: results.map(r => r.data)
                }
            };
        }

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

            // Add K3-specific exposure tracking info
            if (gameType.toLowerCase() === 'k3') {
                console.log(`🎲 [K3_EXPOSURE_TRACKING] About to update K3 exposure in Redis for ${betType}:${betValue}`);
                console.log(`🎲 [K3_EXPOSURE_TRACKING] Bet data being sent to Redis:`, {
                    bet_type: betTypeFormatted,
                    amount_after_tax: netBetAmount,
                    gameType: gameType,
                    duration: duration,
                    periodId: periodId,
                    timeline: timeline
                });
            }

            // Add 5D-specific exposure tracking info
            if (gameType.toLowerCase() === '5d' || gameType.toLowerCase() === 'fived') {
                console.log(`🎯 [5D_BET_PROCESSING] 🎲 5D Bet Processing Started:`, {
                    userId, periodId, gameType, duration, timeline,
                    betType, betValue, betAmount: netBetAmount,
                    bet_type: betTypeFormatted,
                    amount_after_tax: netBetAmount
                });
            }

            const redisStored = await storeBetInRedisWithTimeline({
                ...betData,
                grossBetAmount,
                platformFee,
                netBetAmount,
                betAmount: netBetAmount,
                // CRITICAL FIX: Pass production format for exposure tracking
                bet_type: betTypeFormatted,  // "COLOR:red" format
                amount_after_tax: netBetAmount  // Production field name
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

            // Add K3-specific exposure confirmation
            if (gameType.toLowerCase() === 'k3') {
                console.log(`🎲 [K3_EXPOSURE_CONFIRMED] K3 exposure successfully updated in Redis for ${betType}:${betValue}`);
                console.log(`🎲 [K3_EXPOSURE_CONFIRMED] Exposure key: exposure:k3:${duration}:${timeline}:${periodId}`);
                console.log(`🎲 [K3_EXPOSURE_CONFIRMED] Bet amount: ₹${netBetAmount}, Odds: ${odds}x, Potential payout: ₹${netBetAmount * odds}`);
            }

            // Add 5D-specific exposure confirmation
            if (gameType.toLowerCase() === '5d' || gameType.toLowerCase() === 'fived') {
                console.log(`🎯 [5D_BET_SUCCESS] 🎲 5D Bet Successfully Processed:`, {
                    userId, periodId, gameType, duration, timeline,
                    betType, betValue, betAmount: netBetAmount,
                    odds: odds, potentialPayout: `${(netBetAmount * odds).toFixed(2)}₹`,
                    exposureKey: `exposure:${gameType}:${duration}:${timeline}:${periodId}`
                });
            }

            // Add K3-specific exposure logging
            if (gameType.toLowerCase() === 'k3') {
                console.log('🎲 [K3_BET_EXPOSURE] K3 bet exposure details:', {
                    betId: betRecord.bet_id || betRecord.id,
                    userId: userId,
                    periodId: periodId,
                    timeline: timeline,
                    betType: betType,
                    betValue: betValue,
                    betAmount: netBetAmount,
                    odds: odds,
                    expectedWin: netBetAmount * odds,
                    exposureKey: `exposure:k3:${duration}:${timeline}:${periodId}`,
                    exposureDetails: {
                        betType: betType,
                        betValue: betValue,
                        combinationsAffected: '216 total K3 combinations',
                        exposureCalculation: `${netBetAmount} × ${odds} = ${netBetAmount * odds}`,
                        exposureType: getK3ExposureType(betType, betValue)
                    }
                });

                // Add real-time exposure calculation for K3
                console.log(`🎲 [K3_REAL_EXPOSURE_START] Real bet exposure calculation for ${betType}:${betValue}`);
                console.log(`🎲 [K3_REAL_EXPOSURE_INFO] User ${userId} bet ₹${netBetAmount} on ${betType}:${betValue} with ${odds}x odds`);
                console.log(`🎲 [K3_REAL_EXPOSURE_INFO] This bet will create exposure on winning combinations if result matches`);
                console.log(`🎲 [K3_REAL_EXPOSURE_INFO] Potential payout: ₹${netBetAmount * odds} if bet wins`);
                console.log(`🎲 [K3_REAL_EXPOSURE_INFO] Exposure key: exposure:k3:${duration}:${timeline}:${periodId}`);
            }

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
/**
 * FIXED: Calculate odds based on RESULT, not bet type
 * This ensures correct payouts for VIOLET combinations
 */
const calculateResultBasedOdds = (gameType, betType, betValue, result) => {
    try {
        console.log(`🎯 [ODDS_CALC] Calculating odds for:`, {
            gameType,
            betType,
            betValue,
            resultColor: result.color,
            resultNumber: result.number
        });

        switch (gameType.toLowerCase()) {
            case 'wingo':
            case 'trx_wix':
                switch (betType) {
                    case 'NUMBER':
                        const numberOdds = 9.0;
                        console.log(`🎯 [ODDS_CALC] NUMBER bet: ${numberOdds}x`);
                        return numberOdds;
                    case 'COLOR':
                        // FIXED: Check if result is VIOLET
                        if (result.color === 'red_violet' || result.color === 'green_violet') {
                            // Result is VIOLET - check what was bet
                            if (betValue === 'violet' || betValue === 'purple') {
                                const violetOdds = 4.5;
                                console.log(`🎯 [ODDS_CALC] VIOLET bet on VIOLET result: ${violetOdds}x`);
                                return violetOdds; // VIOLET bet on VIOLET result = 4.5x
                            } else {
                                const colorOdds = 1.5;
                                console.log(`🎯 [ODDS_CALC] RED/GREEN bet on VIOLET result: ${colorOdds}x`);
                                return colorOdds; // RED/GREEN bet on VIOLET result = 1.5x
                            }
                        } else {
                            // Result is pure RED/GREEN
                            const pureOdds = 2.0;
                            console.log(`🎯 [ODDS_CALC] Pure color result: ${pureOdds}x`);
                            return pureOdds; // Standard odds for pure colors
                        }
                    case 'SIZE':
                        const sizeOdds = 2.0;
                        console.log(`🎯 [ODDS_CALC] SIZE bet: ${sizeOdds}x`);
                        return sizeOdds;
                    case 'PARITY':
                        const parityOdds = 2.0;
                        console.log(`🎯 [ODDS_CALC] PARITY bet: ${parityOdds}x`);
                        return parityOdds;
                    default:
                        const defaultOdds = 1.0;
                        console.log(`🎯 [ODDS_CALC] Default odds: ${defaultOdds}x`);
                        return defaultOdds;
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
                        // SUM bets with varying payouts based on value
                        const sumValue = parseInt(betValue);
                        const sumMultipliers = {
                            3: 207.36, 18: 207.36,
                            4: 69.12, 17: 69.12,
                            5: 34.56, 16: 34.56,
                            6: 20.74, 15: 20.74,
                            7: 13.83, 14: 13.83,
                            8: 9.88, 13: 9.88,
                            9: 8.3, 12: 8.3,
                            10: 7.68, 11: 7.68
                        };
                        return sumMultipliers[sumValue] || 1.0;

                    case 'SUM_CATEGORY':
                        // Small/Big/Odd/Even bets - 2.0x payout
                        return 2.0;

                    case 'PATTERN':
                        // Pattern bets with specific payouts
                        switch (betValue) {
                            case 'all_different':
                                return 34.56;
                            case 'straight':
                                return 8.64;
                            case 'two_different':
                                return 69.12;
                            default:
                                return 1.0;
                        }

                    case 'MATCHING_DICE':
                        // Matching dice bets with specific payouts
                        if (betValue === 'triple_any') {
                            return 34.56; // Any triple
                        } else if (betValue === 'pair_any') {
                            return 69.12; // Any pair (not triple)
                        } else if (betValue.startsWith('triple_')) {
                            return 207.36; // Specific triple (e.g., triple_5)
                        } else if (betValue.startsWith('pair_')) {
                            return 69.12; // Specific pair with specific single
                        } else {
                            return 1.0;
                        }

                    case 'STRAIGHT':
                        return 8.64; // For backward compatibility
                    case 'SIZE':
                        return 2.0; // For backward compatibility
                    case 'PARITY':
                        return 2.0; // For backward compatibility
                    default:
                        return 1.0;
                }

            default:
                return 1.0;
        }
    } catch (error) {

        logger.error('Error calculating result-based odds', {
            error: error.message,
            gameType,
            betType,
            betValue,
            result
        });
        return 1.0;
    }
};

const calculateOdds = (gameType, betType, betValue) => {
    try {
        switch (gameType.toLowerCase()) {
            case 'wingo':
            case 'trx_wix':
                switch (betType) {
                    case 'NUMBER':
                        return 9.0; // 1:9 odds for specific number
                    case 'COLOR':
                        // For exposure tracking, use the maximum possible odds
                        if (betValue === 'violet' || betValue === 'purple') {
                            return 4.5; // Violet bet on violet result = 4.5x
                        } else if (betValue === 'red' || betValue === 'green') {
                            return 2.0; // Red/Green bet on pure color = 2.0x (max exposure)
                        } else {
                            return 2.0; // Default
                        }
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
                        return 9.0; // 1:9 odds for specific position (matches WebSocket)
                    case 'POSITION_SIZE':
                        return 2.0; // 2.0x odds for position size (big/small)
                    case 'POSITION_PARITY':
                        return 2.0; // 2.0x odds for position parity (odd/even)
                    case 'SUM_SIZE':
                        return 2.0; // 2.0x odds for sum size (big/small)
                    case 'SUM_PARITY':
                        return 2.0; // 2.0x odds for sum parity (odd/even)
                    case 'SUM':
                        return 2.0; // 2.0x odds for sum (WebSocket does not use 10.0)
                    default:
                        return 1.0;
                }

            case 'k3':
                switch (betType) {
                    case 'SUM':
                        // SUM bets with varying payouts based on value
                        const sumValue = parseInt(betValue);
                        const sumMultipliers = {
                            3: 207.36, 18: 207.36,
                            4: 69.12, 17: 69.12,
                            5: 34.56, 16: 34.56,
                            6: 20.74, 15: 20.74,
                            7: 13.83, 14: 13.83,
                            8: 9.88, 13: 9.88,
                            9: 8.3, 12: 8.3,
                            10: 7.68, 11: 7.68
                        };
                        return sumMultipliers[sumValue] || 1.0;

                    case 'SUM_MULTIPLE':
                        // For multiple sum bets, calculate average odds
                        const sumValues = betValue.split(',').map(s => parseInt(s.trim()));
                        const totalOdds = sumValues.reduce((sum, val) => {
                            const multiplier = sumMultipliers[val] || 1.0;
                            return sum + multiplier;
                        }, 0);
                        const averageOdds = totalOdds / sumValues.length;
                        console.log(`🎲 [K3_MULTIPLE_ODDS] SUM_MULTIPLE odds calculation: ${sumValues.join(',')} = average ${averageOdds}x`);
                        return averageOdds;

                    case 'SUM_CATEGORY':
                        // Small/Big/Odd/Even bets - 2.0x payout
                        return 2.0;

                    case 'SUM_SIZE':
                        // SUM_SIZE is mapped to SUM_CATEGORY - same 2.0x payout
                        return 2.0;

                    case 'SUM_PARITY':
                        // SUM_PARITY bets - 2.0x payout
                        return 2.0;

                    case 'PATTERN':
                        // Pattern bets with specific payouts
                        switch (betValue) {
                            case 'all_different':
                                return 34.56;
                            case 'straight':
                                return 8.64;
                            case 'two_different':
                                return 69.12;
                            default:
                                return 1.0;
                        }

                    case 'MATCHING_DICE':
                        // Matching dice bets with specific payouts
                        if (betValue === 'triple_any') {
                            return 34.56; // Any triple
                        } else if (betValue === 'pair_any') {
                            return 69.12; // Any pair (not triple)
                        } else if (betValue.startsWith('triple_')) {
                            return 207.36; // Specific triple (e.g., triple_5)
                        } else if (betValue.startsWith('pair_')) {
                            return 69.12; // Specific pair with specific single
                        } else {
                            return 1.0;
                        }

                    case 'STRAIGHT':
                        return 8.64; // For backward compatibility
                    case 'SIZE':
                        return 2.0; // For backward compatibility
                    case 'PARITY':
                        return 2.0; // For backward compatibility
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
        await getRedisHelper().set(tempResultKey, JSON.stringify({
            result,
            timestamp: Date.now()
        }));

        // Set expiry for 1 hour
        await getRedisHelper().expire(tempResultKey, 3600);

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
        const totalBetAmount = parseFloat(await getRedisHelper().get(totalBetKey) || 0);

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
 * Get detailed K3 exposure analysis for a period
 * @param {string} gameType - Game type (should be 'k3')
 * @param {number} duration - Duration in seconds
 * @param {string} periodId - Period ID
 * @param {string} timeline - Timeline (default: 'default')
 * @returns {Promise<Object>} - Detailed exposure analysis
 */
const getK3ExposureAnalysis = async (gameType, duration, periodId, timeline = 'default') => {
    try {
        if (gameType.toLowerCase() !== 'k3') {
            throw new Error('This function is only for K3 game type');
        }

        const exposureKey = `exposure:${gameType}:${duration}:${timeline}:${periodId}`;
        const exposures = await getRedisHelper().hgetall(exposureKey);

        if (!exposures || Object.keys(exposures).length === 0) {
            return {
                periodId: periodId,
                timeline: timeline,
                totalExposure: 0,
                message: 'No exposure data found for this period'
            };
        }

        // Analyze exposures by result type
        const exposureAnalysis = {};
        let totalExposure = 0;
        let totalCombinations = 0;

        for (const [key, exposure] of Object.entries(exposures)) {
            if (key.startsWith('dice:')) {
                const diceKey = key.replace('dice:', '');
                const [d1, d2, d3] = diceKey.split(',').map(n => parseInt(n));
                const resultType = getK3ResultType(d1, d2, d3);
                const exposureValue = parseInt(exposure) / 100; // Convert from cents

                totalExposure += exposureValue;
                totalCombinations++;

                if (!exposureAnalysis[resultType]) {
                    exposureAnalysis[resultType] = {
                        combinations: [],
                        totalExposure: 0,
                        count: 0
                    };
                }

                exposureAnalysis[resultType].combinations.push({
                    dice: [d1, d2, d3],
                    sum: d1 + d2 + d3,
                    exposure: exposureValue
                });
                exposureAnalysis[resultType].totalExposure += exposureValue;
                exposureAnalysis[resultType].count++;
            }
        }

        // Sort by exposure (highest first)
        const sortedAnalysis = Object.entries(exposureAnalysis)
            .sort(([, a], [, b]) => b.totalExposure - a.totalExposure)
            .map(([type, data]) => ({
                resultType: type,
                ...data,
                averageExposure: data.totalExposure / data.count
            }));

        console.log(`🎲 [K3_EXPOSURE_ANALYSIS] Detailed K3 exposure analysis for ${periodId}:`, {
            periodId: periodId,
            timeline: timeline,
            totalCombinations: totalCombinations,
            totalExposure: totalExposure,
            averageExposurePerCombination: totalExposure / totalCombinations,
            topExposedResults: sortedAnalysis.slice(0, 10).map(item => ({
                resultType: item.resultType,
                totalExposure: item.totalExposure,
                count: item.count,
                averageExposure: item.averageExposure,
                sampleCombinations: item.combinations.slice(0, 3).map(c => ({
                    dice: c.dice,
                    sum: c.sum,
                    exposure: c.exposure
                }))
            }))
        });

        return {
            periodId: periodId,
            timeline: timeline,
            totalCombinations: totalCombinations,
            totalExposure: totalExposure,
            averageExposurePerCombination: totalExposure / totalCombinations,
            exposureBreakdown: sortedAnalysis,
            topExposedResults: sortedAnalysis.slice(0, 10)
        };

    } catch (error) {
        console.error('🎲 [K3_EXPOSURE_ANALYSIS_ERROR] Error analyzing K3 exposure:', error);
        throw error;
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
    checkWingoWin,
    checkK3Win,
    checkFiveDWin,

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

    // Exposure management
    updateBetExposure,
    resetPeriodExposure,
    getBetsFromHash,
    getK3ExposureAnalysis,
    format5DResult,
    findUnbetPositions,
    shouldUseEnhancedSystem,
    getEnhanced5DResult,
    getCurrent5DResult,
    track5DPerformance,

    // 5D Pre-calculation helpers
    preCalculate5DResult,
    getPreCalculated5DResult,
    isInBetFreeze,
    hasPeriodEnded,

    // Model management
    ensureModelsInitialized,
    get models() {
        if (!serviceModels) {
            throw new Error('Models not initialized. Call ensureModelsInitialized() first.');
        }
        return serviceModels;
    }
};