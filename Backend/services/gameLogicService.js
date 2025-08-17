const unifiedRedis = require('../config/unifiedRedisManager');
async function getRedisHelper() {
    return await unifiedRedis.getHelper();
}

// Backend/services/gameLogicService.js
const { sequelize, DataTypes, Op, connectDB, getSequelizeInstance } = require('../config/db');

// Ensure database is initialized
let localSequelize = null;
const ensureDatabaseInitialized = async () => {
    console.log('🔍 [GAME_LOGIC] ensureDatabaseInitialized called, localSequelize:', localSequelize ? 'exists' : 'null');
    
    if (!localSequelize) {
        try {
            console.log('🔄 [GAME_LOGIC] Database not initialized, using getSequelizeInstance...');
            localSequelize = await getSequelizeInstance(); // Use the existing function that handles initialization
            console.log('🔍 [GAME_LOGIC] getSequelizeInstance returned:', typeof localSequelize, localSequelize ? 'exists' : 'null');
            
            if (!localSequelize) {
                throw new Error('Sequelize instance is still null after getSequelizeInstance');
            }
        } catch (error) {
            console.error('❌ [GAME_LOGIC] Failed to initialize database:', error.message);
            console.error('❌ [GAME_LOGIC] Error stack:', error.stack);
            throw error;
        }
    } else {
        console.log('✅ [GAME_LOGIC] Database already initialized');
    }
    
    return localSequelize;
};


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

/**
 * Get user threshold based on game type
 * @param {string} gameType - The game type (wingo, k3, 5d, etc.)
 * @returns {number} - The threshold value for protection system
 */
const getUserThreshold = (gameType) => {
    // 5D games have higher threshold (50000)
    if (gameType && (gameType.toLowerCase() === '5d' || gameType.toLowerCase() === 'fived')) {
        return 50000;
    }
    // All other games use default threshold (2)
    return 2;
};

// Keep the old constant for backward compatibility (default for other games)
const ENHANCED_USER_THRESHOLD = 2; // Default threshold for protection system

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
 * Generate all possible 3-number combinations from given numbers
 * @param {Array} numbers - Array of numbers to generate combinations from
 * @returns {Array} Array of combination strings
 */
function generateAllDifferentCombinations(numbers) {
    const combinations = [];
    for (let i = 0; i < numbers.length - 2; i++) {
        for (let j = i + 1; j < numbers.length - 1; j++) {
            for (let k = j + 1; k < numbers.length; k++) {
                combinations.push(`${numbers[i]},${numbers[j]},${numbers[k]}`);
            }
        }
    }
    return combinations;
}

/**
 * Generate all combinations containing a specific number
 * @param {number} number - The number that must be included in combinations
 * @returns {Array} Array of combination strings
 */
function generateAllDifferentCombinationsWithNumber(number) {
    const combinations = [];
    for (let i = 1; i <= 6; i++) {
        for (let j = i + 1; j <= 6; j++) {
            if (i !== number && j !== number) {
                // Sort to ensure consistent order
                const combo = [number, i, j].sort((a, b) => a - b);
                combinations.push(combo.join(','));
            }
        }
    }
    return [...new Set(combinations)]; // Remove duplicates
}

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
        const redis = await getRedisHelper();
        if (!redis) {
            logger.error('Redis helper not available for minimum bet periods');
            return false;
        }
        
        let minBetPeriods = await redis.get(minBetPeriodsKey);

        if (!minBetPeriods) {
            // Generate 3 random periods for this hour if not exists
            const totalPeriodsInHour = 3600 / duration; // Total periods in an hour
            const periods = new Set();

            while (periods.size < 3) {
                const randomPeriod = Math.floor(Math.random() * totalPeriodsInHour);
                periods.add(randomPeriod);
            }

            minBetPeriods = JSON.stringify(Array.from(periods));
            await redis.set(minBetPeriodsKey, minBetPeriods);
            await redis.expire(minBetPeriodsKey, 3600); // Expire after 1 hour
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

        const redis = await getRedisHelper();
        if (!redis) {
            logger.error('Redis helper not available for pre-calculated results');
            return {
                lowestCombinations: [],
                optimizedResult: null
            };
        }
        
        // Get lowest combinations
        const lowestCombinationsStr = await redis.get(
            `${gameType}:${durationKey}:${periodId}:lowest_combinations`
        );
        const lowestCombinations = lowestCombinationsStr ? JSON.parse(lowestCombinationsStr) : [];

        // Get optimized result
        const optimizedResultStr = await redis.get(
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
 * @param {Object} validations - Validation results
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

        const redis = await getRedisHelper();
        if (!redis) {
            logger.error('Redis helper not available for suspicious activity logging');
            return;
        }
        
        // Store suspicious activity in Redis
        const suspiciousKey = `${gameType}:${durationKey}:${periodId}:suspicious`;
        await redis.set(suspiciousKey, JSON.stringify({
            timestamp: new Date().toISOString(),
            validations,
            action: 'result_override'
        }));

        // Set expiry for suspicious activity log (7 days)
        const EXPIRY_SECONDS = 7 * 24 * 60 * 60;
        await redis.expire(suspiciousKey, EXPIRY_SECONDS);

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
            const redis = await getRedisHelper();
            if (redis) {
                await redis.ping();
                health.redis.status = 'healthy';
                health.redis.connected = true;
            } else {
                health.redis.status = 'unhealthy';
                health.redis.error = 'Redis helper not available';
                health.status = 'degraded';
            }
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
        const redis = await getRedisHelper();
        if (!redis) {
            logger.error('Redis helper not available for 5D combination loading');
            throw new Error('Redis helper not available');
        }
        
        // Check Redis cache first
        const cacheKey = `5d:combo:${diceValue}`;
        const cached = await redis.get(cacheKey);

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
        await redis.setex(cacheKey, 3600, JSON.stringify(result));

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

        const redis = await getRedisHelper();
        if (!redis) {
            logger.error('Redis helper not available for 5D combinations batch loading');
            throw new Error('Redis helper not available');
        }
        
        // Check cache for each value
        for (const diceValue of diceValues) {
            const cached = await redis.get(`5d:combo:${diceValue}`);
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

                await redis.setex(`5d:combo:${combo.dice_value}`, 3600, JSON.stringify(result));
                results.push(result);
            }
        }

        return results;
    } catch (error) {
        logger.error('Error loading 5D combinations batch', { error: error.message });
        throw error;
    }
}

/**
 * Pre-load all 5D combinations into Redis for fast exposure calculation
 * This loads all 100,000 combinations once and stores them permanently in Redis
 * Uses existing unified Redis manager - no separate initialization needed
 */
async function preload5DCombinationsToRedis() {
    try {
        console.log('🔄 [5D_REDIS_PRELOAD] Starting 5D combinations pre-load to Redis...');
        
        // Use existing unified Redis manager
        const redis = await getRedisHelper();
        if (!redis) {
            console.error('❌ [5D_REDIS_PRELOAD] Redis helper not available');
            throw new Error('Redis helper not available');
        }
        
        const cacheKey = '5d_combinations_cache';
        
        // Check if already loaded
        const cacheExists = await redis.exists(cacheKey);
        if (cacheExists) {
            console.log(`✅ [5D_REDIS_PRELOAD] Already loaded combinations in Redis`);
            return 1; // Return 1 to indicate cache exists
        }
        
        console.log('🔄 [5D_REDIS_PRELOAD] Loading combinations from database...');
        
        const models = await ensureModelsInitialized();
        const { getSequelizeInstance } = require('../config/db');
        const sequelize = await getSequelizeInstance();
        
        // Get all combinations from database
        const combinations = await sequelize.query(`
            SELECT dice_value, dice_a, dice_b, dice_c, dice_d, dice_e,
                   sum_value, sum_size, sum_parity, winning_conditions
            FROM game_combinations_5d
            ORDER BY dice_value
        `, { type: sequelize.QueryTypes.SELECT });
        
        console.log(`🔄 [5D_REDIS_PRELOAD] Found ${combinations.length} combinations in database`);
        
        // Process combinations in batches for Redis
        const batchSize = 1000;
        let loadedCount = 0;
        
        for (let i = 0; i < combinations.length; i += batchSize) {
            const batch = combinations.slice(i, i + batchSize);
            
            // Use individual hset calls instead of pipeline
            for (const combo of batch) {
                const comboKey = `combo:${combo.dice_value}`;
                const comboData = {
                    dice_value: combo.dice_value,
                    dice_a: combo.dice_a,
                    dice_b: combo.dice_b,
                    dice_c: combo.dice_c,
                    dice_d: combo.dice_d,
                    dice_e: combo.dice_e,
                    sum_value: combo.sum_value,
                    sum_size: combo.sum_size,
                    sum_parity: combo.sum_parity,
                    winning_conditions: combo.winning_conditions
                };
                
                await redis.hset(cacheKey, comboKey, JSON.stringify(comboData));
            }
            
            loadedCount += batch.length;
            
            if (i % 10000 === 0) {
                console.log(`🔄 [5D_REDIS_PRELOAD] Loaded ${loadedCount}/${combinations.length} combinations...`);
            }
        }
        
        // Set expiration to never expire (permanent cache)
        // Note: Don't call expire at all - Redis keys are permanent by default
        // await redis.expire(cacheKey, 0); // 0 = never expire - REMOVED: This was deleting the key!
        
        console.log(`✅ [5D_REDIS_PRELOAD] Successfully loaded ${loadedCount} combinations to Redis permanently`);
        console.log('🎯 [5D_REDIS_PRELOAD] Fast protection mode is now enabled!');
        console.log('🎯 [5D_REDIS_PRELOAD] All 5D result calculations will use Redis-cached combinations');
        console.log('🎯 [5D_REDIS_PRELOAD] Expected performance: ~1 second for exposure calculation');
        
        return loadedCount;
        
    } catch (error) {
        console.error('❌ [5D_REDIS_PRELOAD] Error pre-loading combinations:', error);
        throw error;
    }
}

/**
 * Get 5D combination from Redis cache
 */
async function get5DCombinationFromRedis(diceValue) {
    try {
        const redis = await getRedisHelper();
        if (!redis) {
            console.error('❌ Redis helper not available for 5D combination');
            return null;
        }
        const cacheKey = '5d_combinations_cache';
        const comboKey = `combo:${diceValue}`;
        
        const comboData = await redis.hget(cacheKey, comboKey);
        if (comboData) {
            // Handle both string and object data (Redis client may auto-deserialize)
            if (typeof comboData === 'string') {
                return JSON.parse(comboData);
            } else if (typeof comboData === 'object') {
                return comboData;
            }
        }
        return null;
    } catch (error) {
        console.error('❌ [5D_REDIS_GET] Error getting combination from Redis:', error);
        return null;
    }
}

/**
 * Get all 5D combinations from Redis cache
 */
async function getAll5DCombinationsFromRedis() {
    try {
        const redis = await getRedisHelper();
        if (!redis) {
            console.error('❌ Redis helper not available for 5D combinations');
            return [];
        }
        const cacheKey = '5d_combinations_cache';
        
        const allCombinations = await redis.hgetall(cacheKey);
        const combinations = [];
        
        for (const [key, value] of Object.entries(allCombinations)) {
            if (key.startsWith('combo:')) {
                // Handle both string and object data (Redis client may auto-deserialize)
                if (typeof value === 'string') {
                    combinations.push(JSON.parse(value));
                } else if (typeof value === 'object') {
                    combinations.push(value);
                }
            }
        }
        
        return combinations;
    } catch (error) {
        console.error('❌ [5D_REDIS_GET_ALL] Error getting all combinations from Redis:', error);
        return [];
    }
}

/**
 * Fast exposure calculation using Redis-cached combinations
 * FIXED: Direct win checking instead of relying on winning_conditions
 */
function calculate5DExposureFast(combination, betExposures) {
    try {
        let totalExposure = 0;
        
        // Check each bet type for exposure
        for (const [betKey, exposure] of Object.entries(betExposures)) {
            if (!betKey.startsWith('bet:')) continue;
            
            const actualBetKey = betKey.replace('bet:', '');
            const [betType, betValue] = actualBetKey.split(':');
            
            if (!betType || !betValue) continue;
            
            let wins = false;
            
            // Direct win checking based on combination properties
            switch (betType) {
                case 'SUM_SIZE':
                    if (betValue === 'SUM_small' && combination.sum_value < 22) {
                        wins = true;
                    } else if (betValue === 'SUM_big' && combination.sum_value >= 22) {
                        wins = true;
                    }
                    break;
                    
                case 'SUM_PARITY':
                    if (betValue === 'SUM_even' && combination.sum_value % 2 === 0) {
                        wins = true;
                    } else if (betValue === 'SUM_odd' && combination.sum_value % 2 === 1) {
                        wins = true;
                    }
                    break;
                    
                case 'SUM':
                    if (combination.sum_value === parseInt(betValue)) {
                        wins = true;
                    }
                    break;
                    
                case 'POSITION':
                    // Handle position bets (A_0, A_1, etc.)
                    const [position, value] = betValue.split('_');
                    if (position && value !== undefined) {
                        const diceValue = combination[`dice_${position.toLowerCase()}`];
                        if (diceValue === parseInt(value)) {
                            wins = true;
                        }
                    }
                    break;
                    
                case 'POSITION_SIZE':
                    // Handle position size bets (A_big, A_small, etc.)
                    const [pos, size] = betValue.split('_');
                    if (pos && size) {
                        const diceValue = combination[`dice_${pos.toLowerCase()}`];
                        if (size === 'big' && diceValue >= 5) {
                            wins = true;
                        } else if (size === 'small' && diceValue < 5) {
                            wins = true;
                        }
                    }
                    break;
                    
                case 'POSITION_PARITY':
                    // Handle position parity bets (A_even, A_odd, etc.)
                    const [pos2, parity] = betValue.split('_');
                    if (pos2 && parity) {
                        const diceValue = combination[`dice_${pos2.toLowerCase()}`];
                        if (parity === 'even' && diceValue % 2 === 0) {
                            wins = true;
                        } else if (parity === 'odd' && diceValue % 2 === 1) {
                            wins = true;
                        }
                    }
                    break;
            }
            
            if (wins) {
                totalExposure += parseFloat(exposure);
            }
        }
        
        return totalExposure;
    } catch (error) {
        console.error('❌ [5D_EXPOSURE_FAST] Error calculating exposure:', error);
        return Infinity;
    }
}

/**
 * Ultra-optimized exposure calculation for scanning all 100,000 combinations
 * Uses pre-calculated bet patterns for maximum speed
 */
function calculate5DExposureFastOptimized(combination, betPatterns) {
    try {
        let totalExposure = 0;
        
        // Check each bet pattern for exposure (pre-calculated for speed)
        for (const [pattern, exposure] of Object.entries(betPatterns)) {
            const [betType, betValue] = pattern.split(':');
            
            let wins = false;
            
            // Ultra-fast win checking with minimal operations
            switch (betType) {
                case 'SUM_SIZE':
                    if ((betValue === 'SUM_small' && combination.sum_value < 22) ||
                        (betValue === 'SUM_big' && combination.sum_value >= 22)) {
                        wins = true;
                    }
                    break;
                    
                case 'SUM_PARITY':
                    if ((betValue === 'SUM_even' && (combination.sum_value & 1) === 0) ||
                        (betValue === 'SUM_odd' && (combination.sum_value & 1) === 1)) {
                        wins = true;
                    }
                    break;
                    
                case 'SUM':
                    if (combination.sum_value === parseInt(betValue)) {
                        wins = true;
                    }
                    break;
                    
                case 'POSITION':
                    const [position, value] = betValue.split('_');
                    if (position && value !== undefined) {
                        const diceValue = combination[`dice_${position.toLowerCase()}`];
                        if (diceValue === parseInt(value)) {
                            wins = true;
                        }
                    }
                    break;
                    
                case 'POSITION_SIZE':
                    const [pos, size] = betValue.split('_');
                    if (pos && size) {
                        const diceValue = combination[`dice_${pos.toLowerCase()}`];
                        if ((size === 'big' && diceValue >= 5) ||
                            (size === 'small' && diceValue < 5)) {
                            wins = true;
                        }
                    }
                    break;
                    
                case 'POSITION_PARITY':
                    const [pos2, parity] = betValue.split('_');
                    if (pos2 && parity) {
                        const diceValue = combination[`dice_${pos2.toLowerCase()}`];
                        if ((parity === 'even' && (diceValue & 1) === 0) ||
                            (parity === 'odd' && (diceValue & 1) === 1)) {
                            wins = true;
                        }
                    }
                    break;
            }
            
            if (wins) {
                totalExposure += exposure;
            }
        }
        
        return totalExposure;
    } catch (error) {
        console.error('❌ [5D_EXPOSURE_FAST_OPTIMIZED] Error calculating exposure:', error);
        return Infinity;
    }
}

/**
 * Get optimal 5D result using Redis-cached combinations for fast exposure calculation
 */
async function getOptimal5DResultByExposureFast(duration, periodId, timeline = 'default') {
    try {
        // 🚀 CRITICAL FIX: Add timeout to prevent blocking WebSocket
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('5D calculation timeout')), 500); // 500ms timeout
        });
        
        const calculationPromise = async () => {
            const redis = await getRedisHelper();
            if (!redis) {
                console.error('❌ [5D_FAST_STRATEGY] Redis helper not available');
                throw new Error('Redis helper not available');
            }
            
            const exposureKey = `exposure:5d:${duration}:${timeline}:${periodId}`;
            const betExposures = await redis.hgetall(exposureKey);
            
            // Get total bets amount
            const totalBets = Object.values(betExposures).reduce((sum, val) => sum + parseFloat(val), 0);
            
            console.log('🎯 [5D_FAST_STRATEGY] Using Redis-cached combinations for fast exposure calculation:', {
                totalBets,
                periodId,
                timeline
            });
            
            // Get all combinations from Redis cache
            const allCombinations = await getAll5DCombinationsFromRedis();
            
            if (allCombinations.length === 0) {
                console.log('⚠️ [5D_FAST_STRATEGY] No combinations in Redis cache, falling back to database');
                return await getOptimal5DResultByExposure(duration, periodId, timeline);
            }
            
            // 🚀 ULTRA-FAST: Process only first 1000 combinations to prevent blocking
            console.log(`🚀 [5D_FAST_STRATEGY] Processing first 1000 combinations for ultra-fast result...`);
            
            // Optimize by pre-calculating bet patterns for faster exposure calculation
            const betPatterns = {};
            for (const [betKey, exposure] of Object.entries(betExposures)) {
                if (!betKey.startsWith('bet:')) continue;
                const actualBetKey = betKey.replace('bet:', '');
                const [betType, betValue] = actualBetKey.split(':');
                if (betType && betValue) {
                    betPatterns[`${betType}:${betValue}`] = parseFloat(exposure);
                }
            }
            
            // Process only first 1000 combinations for ultra-fast result
            const MAX_COMBINATIONS = 1000; // Limit to prevent blocking
            let bestResult = null;
            let bestExposure = Infinity;
            let zeroExposureCount = 0;
            let processedCount = 0;
            
            for (let i = 0; i < Math.min(allCombinations.length, MAX_COMBINATIONS); i++) {
                const combo = allCombinations[i];
                const exposure = calculate5DExposureFastOptimized(combo, betPatterns);
                
                if (exposure === 0) {
                    zeroExposureCount++;
                    // Randomly select from zero exposure combinations (1 in 5 chance)
                    if (Math.random() < 0.2) {
                        bestResult = combo;
                        bestExposure = 0;
                        break; // Found a good zero-exposure result, stop scanning
                    }
                } else if (exposure < bestExposure) {
                    bestResult = combo;
                    bestExposure = exposure;
                }
                
                processedCount++;
                
                // If we found a zero-exposure result, we can stop early
                if (bestExposure === 0) {
                    console.log(`🛡️ [5D_FAST_PROTECTION] Found zero-exposure result early at ${processedCount}/${Math.min(allCombinations.length, MAX_COMBINATIONS)} combinations`);
                    break;
                }
                
                // Yield control back to event loop every 100 combinations
                if (i % 100 === 0 && i > 0) {
                    await new Promise(resolve => setImmediate(resolve));
                }
            }
            
            if (bestResult) {
                console.log(`🛡️ [5D_FAST_PROTECTION] Selected result from ${processedCount} combinations:`, {
                    dice_value: bestResult.dice_value,
                    exposure: bestExposure,
                    zeroExposureCount: zeroExposureCount,
                    totalCombinations: allCombinations.length,
                    processedCount: processedCount
                });
                
                return format5DResult(bestResult);
            } else {
                // Fallback to first combination if something went wrong
                console.log(`⚠️ [5D_FAST_PROTECTION] Fallback to first combination`);
                return format5DResult(allCombinations[0]);
            }
        };
        
        // Execute with timeout
        return await Promise.race([calculationPromise(), timeoutPromise]);
        
    } catch (error) {
        if (error.message === '5D calculation timeout') {
            console.error('⚠️ [5D_FAST_STRATEGY] Calculation timed out, using default result');
            return generateDefault5DResult();
        } else {
            console.error('❌ [5D_FAST_STRATEGY] Error in fast exposure calculation:', error);
            return generateDefault5DResult();
        }
    }
}

// Helper function to generate default 5D result
function generateDefault5DResult() {
    const result = {
        A: 1, B: 2, C: 3, D: 4, E: 5,
        sum_value: 15,
        sum_size: 'small',
        sum_parity: 'odd'
    };
    console.log('🔄 [5D_FAST_STRATEGY] Using default result:', result);
    return result;
}

/**
 * Auto-initialize 5D cache if not already loaded
 */
async function autoInitialize5DCache() {
    try {
        const redis = await getRedisHelper();
        if (!redis) {
            console.error('❌ [5D_AUTO_INIT] Redis helper not available');
            throw new Error('Redis helper not available');
        }
        
        const cacheKey = '5d_combinations_cache';
        
        // Check if already loaded
        const cacheExists = await redis.exists(cacheKey);
        if (cacheExists) {
            console.log(`✅ [5D_AUTO_INIT] Already loaded combinations in Redis`);
            return 1; // Return 1 to indicate cache exists
        }
        
        console.log('🔄 [5D_AUTO_INIT] Auto-initializing 5D combinations cache...');
        return await preload5DCombinationsToRedis();
    } catch (error) {
        console.error('❌ [5D_AUTO_INIT] Error auto-initializing 5D cache:', error);
        throw error;
    }
}

/**
 * Add user to number tracking for enhanced exposure
 * @param {string} exposureKey - Redis exposure key
 * @param {number} number - Number (0-9)
 * @param {Object} userData - User bet data
 */
async function addUserToNumberTracking(exposureKey, number, userData) {
    try {
        const userKey = `users:number:${number}`;
        const statsKey = `stats:number:${number}`;
        
        const redis = await getRedisHelper();
        if (!redis) {
            console.error('❌ [USER_TRACKING] Redis helper not available');
            return;
        }
        
        // Get existing users for this number
        let existingUsers = [];
        const existingUsersJson = await redis.hget(exposureKey, userKey);
        
        if (existingUsersJson) {
            try {
                // Handle case where data might already be an object
                if (typeof existingUsersJson === 'string') {
                    existingUsers = JSON.parse(existingUsersJson);
                } else if (Array.isArray(existingUsersJson)) {
                    existingUsers = existingUsersJson;
                } else {
                    console.warn('⚠️ [USER_TRACKING] Unexpected data type for existing users:', typeof existingUsersJson);
                    existingUsers = [];
                }
            } catch (parseError) {
                console.warn('⚠️ [USER_TRACKING] Error parsing existing users, starting fresh:', parseError.message);
                existingUsers = [];
            }
        }
        
        // Add new user
        existingUsers.push(userData);
        
        // Limit to max 100 users per number (performance optimization)
        if (existingUsers.length > 100) {
            existingUsers.splice(0, existingUsers.length - 100);
        }
        
        // Update users list
        await redis.hset(exposureKey, userKey, JSON.stringify(existingUsers));
        
        // Update statistics (with error handling)
        try {
            await updateNumberStatistics(exposureKey, number, existingUsers);
        } catch (statsError) {
            console.error('❌ [STATS_UPDATE] Error updating number statistics:', statsError);
        }
        
        // Update global period statistics (with error handling)
        try {
            await updatePeriodStatistics(exposureKey);
        } catch (periodStatsError) {
            console.error('❌ [PERIOD_STATS] Error updating period statistics:', periodStatsError);
        }
        
        console.log(`✅ [USER_TRACKING] Added user ${userData.userId} to number ${number}`);
        
    } catch (error) {
        console.error('❌ Error adding user to number tracking:', error);
    }
}

/**
 * Update number statistics for enhanced exposure
 * @param {string} exposureKey - Redis exposure key
 * @param {number} number - Number (0-9)
 * @param {Array} users - Array of user data
 */
async function updateNumberStatistics(exposureKey, number, users) {
    try {
        const statsKey = `stats:number:${number}`;
        
        const stats = {
            totalUsers: users.length,
            totalBetAmount: users.reduce((sum, user) => sum + user.betAmount, 0),
            uniqueUsers: new Set(users.map(u => u.userId)).size,
            betTypes: {}
        };
        
        // Count bet types
        users.forEach(user => {
            stats.betTypes[user.betType] = (stats.betTypes[user.betType] || 0) + 1;
        });
        
        const redis = await getRedisHelper();
        if (!redis) {
            console.error('❌ [STATS_UPDATE] Redis helper not available');
            return;
        }
        
        await redis.hset(exposureKey, statsKey, JSON.stringify(stats));
        
        console.log(`📊 [STATS_UPDATE] Updated stats for number ${number}: ${stats.totalUsers} users, ₹${stats.totalBetAmount}`);
        
    } catch (error) {
        console.error('❌ Error updating number statistics:', error);
    }
}

/**
 * Update global period statistics for enhanced exposure
 * @param {string} exposureKey - Redis exposure key
 */
async function updatePeriodStatistics(exposureKey) {
    try {
        const statsKey = 'period:stats';
        
        const redis = await getRedisHelper();
        if (!redis) {
            console.error('❌ [PERIOD_STATS] Redis helper not available');
            return;
        }
        
        // Get all number statistics
        const allStats = {};
        for (let num = 0; num <= 9; num++) {
            const numberStatsJson = await redis.hget(exposureKey, `stats:number:${num}`);
            if (numberStatsJson) {
                try {
                    // Validate that the data is actually JSON before parsing
                    if (typeof numberStatsJson === 'string' && numberStatsJson.trim().startsWith('{')) {
                        allStats[num] = JSON.parse(numberStatsJson);
                    } else if (typeof numberStatsJson === 'object') {
                        // Data is already an object, use it directly
                        allStats[num] = numberStatsJson;
                    } else {
                        console.warn(`⚠️ Invalid stats data for number ${num}:`, numberStatsJson);
                        allStats[num] = { totalUsers: 0, totalBetAmount: 0 };
                    }
                } catch (parseError) {
                    console.error(`❌ JSON parse error for number ${num} stats:`, parseError.message);
                    console.error(`❌ Raw data:`, numberStatsJson);
                    allStats[num] = { totalUsers: 0, totalBetAmount: 0 };
                }
            }
        }
        
        // Calculate global statistics
        const globalStats = {
            totalUsers: 0,
            totalBetAmount: 0,
            uniqueUsers: new Set(),
            numberDistribution: {}
        };
        
        Object.entries(allStats).forEach(([number, stats]) => {
            globalStats.totalUsers += stats.totalUsers || 0;
            globalStats.totalBetAmount += stats.totalBetAmount || 0;
            globalStats.numberDistribution[number] = stats.totalUsers || 0;
            globalStats.numberDistribution[`totalBetAmount:${number}`] = stats.totalBetAmount || 0;
        });
        
        // Count unique users from all user arrays
        const allUserIds = new Set();
        for (let num = 0; num <= 9; num++) {
            const usersJson = await redis.hget(exposureKey, `users:number:${num}`);
            if (usersJson) {
                try {
                    let users;
                    // Handle case where data might already be an object
                    if (typeof usersJson === 'string') {
                        users = JSON.parse(usersJson);
                    } else if (Array.isArray(usersJson)) {
                        // Data is already an array, use it directly
                        users = usersJson;
                    } else {
                        console.warn(`⚠️ Invalid users data for number ${num}:`, usersJson);
                        users = [];
                    }
                    
                    if (Array.isArray(users)) {
                        users.forEach(user => {
                            if (user && user.userId) {
                                allUserIds.add(user.userId);
                            }
                        });
                    }
                } catch (parseError) {
                    console.error(`❌ JSON parse error for number ${num} users:`, parseError.message);
                    console.error(`❌ Raw data:`, usersJson);
                }
            }
        }
        globalStats.uniqueUsers = allUserIds.size;
        
        await redis.hset(exposureKey, statsKey, JSON.stringify(globalStats));
        
        console.log(`🌐 [PERIOD_STATS] Updated global stats: ${globalStats.totalUsers} total users, ${globalStats.uniqueUsers} unique users`);
        
    } catch (error) {
        console.error('❌ Error updating period statistics:', error);
    }
}

async function updateBetExposure(gameType, duration, periodId, bet, timeline = 'default') {
    try {
        console.log('🔍 [EXPOSURE_DEBUG] updateBetExposure called with:', {
            gameType, duration, periodId, timeline, bet
        });

        const exposureKey = `exposure:${gameType}:${duration}:${timeline}:${periodId}`;
        console.log('🔍 [EXPOSURE_DEBUG] Exposure key:', exposureKey);

        // Get Redis helper once at the beginning
        const redis = await getRedisHelper();
        if (!redis) {
            console.error('❌ Redis helper not available for exposure update');
            throw new Error('Redis helper not available');
        }

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
                    await redis.hincrby(exposureKey, `number:${betValue}`, exposure);
                    
                    // NEW: Add user tracking for NUMBER bet
                    if (bet.userId) {
                        try {
                            await addUserToNumberTracking(exposureKey, betValue, {
                                userId: bet.userId,
                                betAmount: actualBetAmount,
                                betType: betType,
                                betValue: betValue,
                                timestamp: Date.now()
                            });
                        } catch (userTrackingError) {
                            console.error('❌ [USER_TRACKING] Error in NUMBER bet user tracking:', userTrackingError);
                            // Don't fail the entire bet processing for user tracking errors
                        }
                    }
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

                            await redis.hincrby(exposureKey, `number:${num}`, exposure);
                            
                            // NEW: Add user tracking for this number
                            if (bet.userId) {
                                try {
                                    await addUserToNumberTracking(exposureKey, num, {
                                        userId: bet.userId,
                                        betAmount: actualBetAmount,
                                        betType: betType,
                                        betValue: betValue,
                                        timestamp: Date.now()
                                    });
                                } catch (userTrackingError) {
                                    console.error(`❌ [USER_TRACKING] Error in COLOR/SIZE/PARITY bet user tracking for number ${num}:`, userTrackingError);
                                    // Don't fail the entire bet processing for user tracking errors
                                }
                            }
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
                        await redis.hincrby(exposureKey, `dice:${key}`, k3Exposure);
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
                await redis.hincrby(exposureKey, `bet:${betKey}`, fiveDExposure);

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
        await redis.expire(exposureKey, duration + 300);

        // Debug: Check final exposures
        const finalExposures = await redis.hgetall(exposureKey);
        console.log('🔍 [EXPOSURE_DEBUG] Final exposures after update:', finalExposures);

    } catch (error) {
        console.error('🔍 [EXPOSURE_DEBUG] Error in updateBetExposure:', error);
        // Don't let user tracking errors break the entire system
        console.log('⚠️ [EXPOSURE_DEBUG] Continuing with bet processing despite user tracking error');
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
                const wingoExposures = await redis.hgetall(exposureKey);
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
                const k3Exposures = await redis.hgetall(exposureKey);
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
        // First, try to use the fast Redis-based approach
        const redis = await getRedisHelper();
        if (!redis) {
            console.error('❌ Redis helper not available for 5D optimal result');
            throw new Error('Redis helper not available');
        }
        const cacheKey = '5d_combinations_cache';
        
        // Check if cache exists using exists method
        const cacheExists = await redis.exists(cacheKey);
        
        if (cacheExists) {
            console.log(`🚀 [5D_FAST_MODE] Using Redis-cached combinations`);
            return await getOptimal5DResultByExposureFast(duration, periodId, timeline);
        } else {
            console.log('⚠️ [5D_SLOW_MODE] Redis cache not available, using database queries');
            // Try to populate cache in background
            autoInitialize5DCache().catch(err => 
                console.log('⚠️ [5D_CACHE] Background cache population failed:', err.message)
            );
        }
        
        const exposureKey = `exposure:5d:${duration}:${timeline}:${periodId}`;
        const betExposures = await redis.hgetall(exposureKey);

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

        // ENHANCED PROTECTION LOGIC: Check for ALL types of conflicting bets
        let shouldApplyProtection = false;
        let protectionReason = '';
        let protectionConditions = [];

        // 1. Check position betting conflicts (A_0 vs A_1-9)
        const aBets = Object.keys(betExposures).filter(key =>
            key.startsWith('bet:POSITION:A_') && key !== 'bet:POSITION:A_0'
        );
        const hasA0Bet = Object.keys(betExposures).some(key => key === 'bet:POSITION:A_0');
        const hasA1to9Bets = aBets.some(bet => bet.match(/A_[1-9]/));
        if (hasA1to9Bets && !hasA0Bet) {
            shouldApplyProtection = true;
            protectionConditions.push('POSITION_A_CONFLICT');
        }

        // 2. Check SUM_SIZE conflicts (SUM_big vs SUM_small)
        const hasSumBigBet = Object.keys(betExposures).some(key => 
            key === 'bet:SUM_SIZE:SUM_big' || key === 'bet:SUM_SIZE:big'
        );
        const hasSumSmallBet = Object.keys(betExposures).some(key => 
            key === 'bet:SUM_SIZE:SUM_small' || key === 'bet:SUM_SIZE:small'
        );
        if (hasSumBigBet && hasSumSmallBet) {
            shouldApplyProtection = true;
            protectionConditions.push('SUM_SIZE_CONFLICT');
        } else if (hasSumBigBet && !hasSumSmallBet) {
            shouldApplyProtection = true;
            protectionConditions.push('SUM_SIZE_BIG_ONLY');
        } else if (hasSumSmallBet && !hasSumBigBet) {
            shouldApplyProtection = true;
            protectionConditions.push('SUM_SIZE_SMALL_ONLY');
        }

        // 3. Check SUM_PARITY conflicts (SUM_even vs SUM_odd)
        const hasSumEvenBet = Object.keys(betExposures).some(key => 
            key === 'bet:SUM_PARITY:SUM_even' || key === 'bet:SUM_PARITY:even'
        );
        const hasSumOddBet = Object.keys(betExposures).some(key => 
            key === 'bet:SUM_PARITY:SUM_odd' || key === 'bet:SUM_PARITY:odd'
        );
        if (hasSumEvenBet && hasSumOddBet) {
            shouldApplyProtection = true;
            protectionConditions.push('SUM_PARITY_CONFLICT');
        } else if (hasSumEvenBet && !hasSumOddBet) {
            shouldApplyProtection = true;
            protectionConditions.push('SUM_PARITY_EVEN_ONLY');
        } else if (hasSumOddBet && !hasSumEvenBet) {
            shouldApplyProtection = true;
            protectionConditions.push('SUM_PARITY_ODD_ONLY');
        }

        // 4. Check SUM conflicts (exact sum values)
        const sumBets = Object.keys(betExposures).filter(key => key.startsWith('bet:SUM:'));
        if (sumBets.length > 0) {
            shouldApplyProtection = true;
            protectionConditions.push('SUM_EXACT_CONFLICT');
        }

        // Enhanced protection for low user count scenarios
        const userCountResult = await getUniqueUserCount('5d', duration, periodId, timeline);
        const threshold = getUserThreshold('5d');
        const isLowUserCount = userCountResult.uniqueUserCount < threshold;

        if (isLowUserCount) {
            console.log('🛡️ [5D_LOW_USER_PROTECTION] Low user count detected:', {
                userCount: userCountResult.uniqueUserCount,
                threshold: threshold,
                shouldApplyProtection: true
            });
            shouldApplyProtection = true;
            protectionConditions.push('LOW_USER_COUNT');
        }

        // Set the primary protection reason (for backward compatibility)
        protectionReason = protectionConditions.join('+');

        console.log('🔍 [5D_PROTECTION_DEBUG] Enhanced exposure analysis:', {
            totalBets,
            strategy,
            shouldApplyProtection,
            protectionReason,
            protectionConditions,
            aBets: aBets.length,
            hasA0Bet,
            hasA1to9Bets,
            hasSumBigBet,
            hasSumSmallBet,
            hasSumEvenBet,
            hasSumOddBet,
            sumBets: sumBets.length,
            exposureKeys: Object.keys(betExposures).filter(k => k.startsWith('bet:')),
            allExposureKeys: Object.keys(betExposures)
        });

        if (shouldApplyProtection) {
            console.log(`🛡️ [5D_PROTECTION] Protection condition detected: ${protectionReason}`);
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

                // Apply enhanced protection logic if needed
                if (shouldApplyProtection) {
                    console.log(`🛡️ [5D_PROTECTION] Applying protection in FULL_SCAN: ${protectionReason}`);
                    
                    // Build comprehensive WHERE clause for multiple protection conditions
                    let whereConditions = [];
                    
                    // Handle position conflicts
                    if (protectionConditions.includes('POSITION_A_CONFLICT')) {
                        whereConditions.push('dice_a = 0');
                    }
                    
                    // Handle SUM_SIZE conflicts
                    if (protectionConditions.includes('SUM_SIZE_CONFLICT')) {
                        const sumBigExposure = parseFloat(betExposures['bet:SUM_SIZE:SUM_big'] || betExposures['bet:SUM_SIZE:big'] || 0);
                        const sumSmallExposure = parseFloat(betExposures['bet:SUM_SIZE:SUM_small'] || betExposures['bet:SUM_SIZE:small'] || 0);
                        
                        if (sumBigExposure > sumSmallExposure) {
                            whereConditions.push('sum_value < 22'); // Force small
                        } else {
                            whereConditions.push('sum_value >= 22'); // Force big
                        }
                    } else if (protectionConditions.includes('SUM_SIZE_BIG_ONLY')) {
                        whereConditions.push('sum_value < 22'); // Force small to avoid big bet
                    } else if (protectionConditions.includes('SUM_SIZE_SMALL_ONLY')) {
                        whereConditions.push('sum_value >= 22'); // Force big to avoid small bet
                    }
                    
                    // Handle SUM_PARITY conflicts
                    if (protectionConditions.includes('SUM_PARITY_CONFLICT')) {
                        const sumEvenExposure = parseFloat(betExposures['bet:SUM_PARITY:SUM_even'] || betExposures['bet:SUM_PARITY:even'] || 0);
                        const sumOddExposure = parseFloat(betExposures['bet:SUM_PARITY:SUM_odd'] || betExposures['bet:SUM_PARITY:odd'] || 0);
                        
                        if (sumEvenExposure > sumOddExposure) {
                            whereConditions.push('sum_value % 2 = 1'); // Force odd
                        } else {
                            whereConditions.push('sum_value % 2 = 0'); // Force even
                        }
                    } else if (protectionConditions.includes('SUM_PARITY_EVEN_ONLY')) {
                        whereConditions.push('sum_value % 2 = 1'); // Force odd to avoid even bet
                    } else if (protectionConditions.includes('SUM_PARITY_ODD_ONLY')) {
                        whereConditions.push('sum_value % 2 = 0'); // Force even to avoid odd bet
                    }
                    
                    // Handle exact SUM conflicts
                    if (protectionConditions.includes('SUM_EXACT_CONFLICT')) {
                        const excludeSums = sumBets.map(key => key.replace('bet:SUM:', '')).join(',');
                        whereConditions.push(`sum_value NOT IN (${excludeSums})`);
                    }
                    
                    // Apply all conditions
                    if (whereConditions.length > 0) {
                        fullScanQuery += ` WHERE ${whereConditions.join(' AND ')}`;
                        console.log(`🛡️ [5D_PROTECTION] Applied conditions: ${whereConditions.join(' AND ')}`);
                    } else {
                        // For low user count or other conflicts, use general protection
                        fullScanQuery += ` WHERE sum_value IN (0, 1, 2, 3, 4, 41, 42, 43, 44, 45)`;
                    }
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

                console.log(`🛡️ [5D_PROTECTION] Selected result with exposure ${minExposure}:`, optimalResult);
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

                // Apply enhanced protection logic if needed
                if (shouldApplyProtection) {
                    console.log(`🛡️ [5D_PROTECTION] Applying protection in SMART_SAMPLING: ${protectionReason}`);
                    
                    // Build comprehensive WHERE clause for multiple protection conditions
                    let whereConditions = [];
                    
                    // Handle position conflicts
                    if (protectionConditions.includes('POSITION_A_CONFLICT')) {
                        whereConditions.push('dice_a = 0');
                    }
                    
                    // Handle SUM_SIZE conflicts
                    if (protectionConditions.includes('SUM_SIZE_CONFLICT')) {
                        const sumBigExposure = parseFloat(betExposures['bet:SUM_SIZE:SUM_big'] || betExposures['bet:SUM_SIZE:big'] || 0);
                        const sumSmallExposure = parseFloat(betExposures['bet:SUM_SIZE:SUM_small'] || betExposures['bet:SUM_SIZE:small'] || 0);
                        
                        if (sumBigExposure > sumSmallExposure) {
                            whereConditions.push('sum_value < 22');
                        } else {
                            whereConditions.push('sum_value >= 22');
                        }
                    } else if (protectionConditions.includes('SUM_SIZE_BIG_ONLY')) {
                        whereConditions.push('sum_value < 22');
                    } else if (protectionConditions.includes('SUM_SIZE_SMALL_ONLY')) {
                        whereConditions.push('sum_value >= 22');
                    }
                    
                    // Handle SUM_PARITY conflicts
                    if (protectionConditions.includes('SUM_PARITY_CONFLICT')) {
                        const sumEvenExposure = parseFloat(betExposures['bet:SUM_PARITY:SUM_even'] || betExposures['bet:SUM_PARITY:even'] || 0);
                        const sumOddExposure = parseFloat(betExposures['bet:SUM_PARITY:SUM_odd'] || betExposures['bet:SUM_PARITY:odd'] || 0);
                        
                        if (sumEvenExposure > sumOddExposure) {
                            whereConditions.push('sum_value % 2 = 1');
                        } else {
                            whereConditions.push('sum_value % 2 = 0');
                        }
                    } else if (protectionConditions.includes('SUM_PARITY_EVEN_ONLY')) {
                        whereConditions.push('sum_value % 2 = 1');
                    } else if (protectionConditions.includes('SUM_PARITY_ODD_ONLY')) {
                        whereConditions.push('sum_value % 2 = 0');
                    }
                    
                    // Apply all conditions
                    if (whereConditions.length > 0) {
                        smartSamplingQuery += ` AND ${whereConditions.join(' AND ')}`;
                        console.log(`🛡️ [5D_PROTECTION] Applied conditions: ${whereConditions.join(' AND ')}`);
                    }
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

                console.log(`🛡️ [5D_PROTECTION] Selected result with exposure ${minSampleExposure}:`, optimalSampleResult);
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

                // Apply enhanced protection logic if needed
                if (shouldApplyProtection) {
                    console.log(`🛡️ [5D_PROTECTION] Applying protection in STATISTICAL_SAMPLING: ${protectionReason}`);
                    
                    // Build comprehensive WHERE clause for multiple protection conditions
                    let whereConditions = [];
                    
                    // Handle position conflicts
                    if (protectionConditions.includes('POSITION_A_CONFLICT') && unbetPositions.A.includes(0)) {
                        whereConditions.push('dice_a = 0');
                    }
                    
                    // Handle SUM_SIZE conflicts
                    if (protectionConditions.includes('SUM_SIZE_CONFLICT')) {
                        const sumBigExposure = parseFloat(betExposures['bet:SUM_SIZE:SUM_big'] || betExposures['bet:SUM_SIZE:big'] || 0);
                        const sumSmallExposure = parseFloat(betExposures['bet:SUM_SIZE:SUM_small'] || betExposures['bet:SUM_SIZE:small'] || 0);
                        
                        if (sumBigExposure > sumSmallExposure) {
                            whereConditions.push('sum_value < 22');
                } else {
                            whereConditions.push('sum_value >= 22');
                        }
                    } else if (protectionConditions.includes('SUM_SIZE_BIG_ONLY')) {
                        whereConditions.push('sum_value < 22');
                    } else if (protectionConditions.includes('SUM_SIZE_SMALL_ONLY')) {
                        whereConditions.push('sum_value >= 22');
                    }
                    
                    // Handle SUM_PARITY conflicts
                    if (protectionConditions.includes('SUM_PARITY_CONFLICT')) {
                        const sumEvenExposure = parseFloat(betExposures['bet:SUM_PARITY:SUM_even'] || betExposures['bet:SUM_PARITY:even'] || 0);
                        const sumOddExposure = parseFloat(betExposures['bet:SUM_PARITY:SUM_odd'] || betExposures['bet:SUM_PARITY:odd'] || 0);
                        
                        if (sumEvenExposure > sumOddExposure) {
                            whereConditions.push('sum_value % 2 = 1');
                        } else {
                            whereConditions.push('sum_value % 2 = 0');
                        }
                    } else if (protectionConditions.includes('SUM_PARITY_EVEN_ONLY')) {
                        whereConditions.push('sum_value % 2 = 1');
                    } else if (protectionConditions.includes('SUM_PARITY_ODD_ONLY')) {
                        whereConditions.push('sum_value % 2 = 0');
                    }
                    
                    // Apply all conditions
                    if (whereConditions.length > 0) {
                        query += ` AND ${whereConditions.join(' AND ')}`;
                        console.log(`🛡️ [5D_PROTECTION] Applied conditions: ${whereConditions.join(' AND ')}`);
                    } else {
                        // Add conditions for unbet positions when no protection needed
                        if (unbetPositions.A.length > 0) {
                            query += ` AND dice_a IN (${unbetPositions.A.join(',')})`;
                        }
                        if (unbetPositions.B.length > 0) {
                            query += ` AND dice_b IN (${unbetPositions.B.join(',')})`;
                        }
                    }
                } else {
                    // Add conditions for unbet positions when no protection needed
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
                    const exposure = await calculate5DExposure(statResult[0], betExposures);
                    console.log(`🛡️ [5D_PROTECTION] Selected statistical result with exposure ${exposure}:`, statResult[0]);
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

                console.log(`🛡️ [5D_PROTECTION] Using fallback result:`, fallbackResult[0]);
                const fallbackExposure = await calculate5DExposure(fallbackResult[0], betExposures);
                console.log(`🛡️ [5D_PROTECTION] Fallback result exposure: ${fallbackExposure}`);
                return format5DResult(fallbackResult[0]);
        }

    } catch (error) {
        logger.error('Error getting optimal 5D result', { error: error.message });
        throw error;
    }
}
async function calculate5DExposure(combination, betExposures) {
    let totalExposure = 0;

    // Check each bet type
    for (const [betKey, exposure] of Object.entries(betExposures)) {
        if (!betKey.startsWith('bet:')) continue;

        const actualBetKey = betKey.replace('bet:', '');
        const [betType, betValue] = actualBetKey.split(':');

        if (!betType || !betValue) continue;
        
        let wins = false;

        // Direct win checking based on combination properties
        switch (betType) {
            case 'SUM_SIZE':
                if (betValue === 'SUM_small' && combination.sum_value < 22) {
                    wins = true;
                } else if (betValue === 'SUM_big' && combination.sum_value >= 22) {
            wins = true;
        }
                break;
                
            case 'SUM_PARITY':
                if (betValue === 'SUM_even' && combination.sum_value % 2 === 0) {
                    wins = true;
                } else if (betValue === 'SUM_odd' && combination.sum_value % 2 === 1) {
            wins = true;
        }
                break;
                
            case 'SUM':
                if (combination.sum_value === parseInt(betValue)) {
            wins = true;
        }
                break;
                
            case 'POSITION':
                // Handle position bets (A_0, A_1, etc.)
                const [position, value] = betValue.split('_');
                if (position && value !== undefined) {
                    const diceValue = combination[`dice_${position.toLowerCase()}`];
                    if (diceValue === parseInt(value)) {
            wins = true;
                    }
                }
                break;
                
            case 'POSITION_SIZE':
                // Handle position size bets (A_big, A_small, etc.)
                const [pos, size] = betValue.split('_');
                if (pos && size) {
                    const diceValue = combination[`dice_${pos.toLowerCase()}`];
                    if (size === 'big' && diceValue >= 5) {
                        wins = true;
                    } else if (size === 'small' && diceValue < 5) {
                        wins = true;
                    }
                }
                break;
                
            case 'POSITION_PARITY':
                // Handle position parity bets (A_even, A_odd, etc.)
                const [pos2, parity] = betValue.split('_');
                if (pos2 && parity) {
                    const diceValue = combination[`dice_${pos2.toLowerCase()}`];
                    if (parity === 'even' && diceValue % 2 === 0) {
                        wins = true;
                    } else if (parity === 'odd' && diceValue % 2 === 1) {
                        wins = true;
                    }
                }
                break;
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
        const redis = await getRedisHelper();
        if (!redis) {
            console.error('❌ Redis helper not available');
            throw new Error('Redis helper not available');
        }
        await redis.del(exposureKey);
        logger.info('Period exposure reset', { gameType, duration, periodId, timeline });
    } catch (error) {
        logger.error('Error resetting period exposure', { error: error.message, gameType, periodId });
    }
}

async function indexBetInHash(gameType, duration, periodId, timeline, bet) {
    try {
        const betHashKey = `bets:${gameType}:${duration}:${timeline}:${periodId}`;
        const betId = `${bet.userId}:${bet.betType}:${bet.betValue}:${Date.now()}`;

        const redis = await getRedisHelper();
        if (!redis) {
            console.error('❌ Redis helper not available');
            throw new Error('Redis helper not available');
        }
        await redis.hset(betHashKey, betId, JSON.stringify({
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
        await redis.expire(betHashKey, 86400);

        return betId;
    } catch (error) {
        logger.error('Error indexing bet in hash', { error: error.message });
        throw error;
    }
}

async function getBetsFromHash(gameType, duration, periodId, timeline = 'default') {
    try {
        const betHashKey = `bets:${gameType}:${duration}:${timeline}:${periodId}`;
        const betsData = await redis.hgetall(betHashKey);

        const bets = [];
        for (const [betId, betJson] of Object.entries(betsData)) {
            try {
                let bet;
                // Handle case where data might already be an object
                if (typeof betJson === 'string') {
                    bet = JSON.parse(betJson);
                } else if (typeof betJson === 'object') {
                    bet = betJson;
                } else {
                    console.warn('⚠️ Invalid bet data type:', typeof betJson);
                    continue;
                }
                bets.push(bet);
            } catch (parseError) {
                console.warn('⚠️ Error parsing bet data, skipping:', parseError.message);
                continue;
            }
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
        const redis = await getRedisHelper();
        if (!redis) {
            console.error('❌ Redis helper not available');
            throw new Error('Redis helper not available');
        }
        await redis.set(trackingKey, JSON.stringify(trackingData));
        await redis.expire(trackingKey, duration + 300); // 5 min buffer

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
        const betKeys = await redis.keys(`${gameType}:${durationKey}:${periodId}:*`);

        // Sample bets randomly
        const sampleSize = Math.ceil(betKeys.length * sampleRate);
        const sampledKeys = betKeys
            .sort(() => Math.random() - 0.5) // Shuffle
            .slice(0, sampleSize);

        let samplePayout = 0;
        let validSamples = 0;

        for (const key of sampledKeys) {
            try {
                const betData = await redis.get(key);
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
        const intervalId = await redis.get(intervalKey);

        if (intervalId) {
            clearInterval(parseInt(intervalId));
            const redis = await getRedisHelper();
        if (!redis) {
            console.error('❌ Redis helper not available');
            throw new Error('Redis helper not available');
        }
        await redis.del(intervalKey);
        }

        // Clean up tracking data (keep for analysis but remove from active keys)
        const trackingKey = `${gameType}:${durationKey}:${periodId}:tracking`;
        const fallbackKey = `${gameType}:${durationKey}:${periodId}:fallbacks`;

        // Move to archive instead of deleting (for analysis)
        const archiveKey = `archive:${gameType}:${durationKey}:${periodId}:tracking`;
        const trackingData = await redis.get(trackingKey);

        if (trackingData) {
            const redis = await getRedisHelper();
        if (!redis) {
            console.error('❌ Redis helper not available');
            throw new Error('Redis helper not available');
        }
        await redis.set(archiveKey, trackingData, 'EX', 7 * 24 * 60 * 60); // Keep for 7 days
        }

        // Delete active keys
        const redis = await getRedisHelper();
        if (!redis) {
            console.error('❌ Redis helper not available');
            throw new Error('Redis helper not available');
        }
        await redis.del(trackingKey);
        await redis.del(fallbackKey);

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

        const trackingData = await redis.get(trackingKey);
        const fallbackData = await redis.get(fallbackKey);

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
        const fallbackData = await redis.get(fallbackKey);

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
        const betsData = await redis.hgetall(betHashKey);

        let totalAmount = 0;
        for (const [betId, betJson] of Object.entries(betsData)) {
            try {
                let bet;
                // Handle case where data might already be an object
                if (typeof betJson === 'string') {
                    bet = JSON.parse(betJson);
                } else if (typeof betJson === 'object') {
                    bet = betJson;
                } else {
                    console.warn('⚠️ Invalid bet data type:', typeof betJson);
                    continue;
                }
                
                if (bet.betType === betType && bet.betValue === betValue) {
                    totalAmount += parseFloat(bet.netBetAmount || 0);
                }
            } catch (parseError) {
                console.warn('⚠️ Error parsing bet data, skipping:', parseError.message);
                continue;
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
/**
 * Auto-initialize 5D Redis cache during server startup
 * This function should be called after Redis is initialized
 */
async function autoInitialize5DCache() {
    try {
        console.log('🔄 [5D_AUTO_INIT] Auto-initializing 5D Redis cache...');
        
        // Check if cache already exists
        const redis = await getRedisHelper();
        if (!redis) {
            console.error('❌ [5D_AUTO_INIT] Redis helper not available');
            return 0;
        }
        
        const cacheKey = '5d_combinations_cache';
        const cacheExists = await redis.exists(cacheKey);
        
        if (cacheExists) {
            console.log(`✅ [5D_AUTO_INIT] 5D cache already initialized`);
            return 1; // Return 1 to indicate cache exists
        }
        
        // Initialize cache in background (non-blocking)
        console.log('🔄 [5D_AUTO_INIT] Starting background 5D cache initialization...');
        
        // Use setImmediate to run in background
        setImmediate(async () => {
            try {
                const loadedCount = await preload5DCombinationsToRedis();
                console.log(`✅ [5D_AUTO_INIT] Background initialization completed: ${loadedCount} combinations loaded`);
            } catch (error) {
                console.error('❌ [5D_AUTO_INIT] Background initialization failed:', error.message);
                console.log('⚠️ [5D_AUTO_INIT] 5D protection will fall back to database queries');
            }
        });
        
        return 0; // Return 0 to indicate background initialization started
        
    } catch (error) {
        console.error('❌ [5D_AUTO_INIT] Error in auto-initialization:', error);
        console.log('⚠️ [5D_AUTO_INIT] 5D protection will fall back to database queries');
        return 0;
    }
}
async function selectProtectedResultWithExposure(gameType, duration, periodId, timeline) {
    try {
        const exposureKey = `exposure:${gameType}:${duration}:${timeline}:${periodId}`;

        switch (gameType.toLowerCase()) {
            case 'wingo':
            case 'trx_wix':
                // Find zero exposure numbers
                console.log('🔍 Checking exposures for key:', exposureKey);
                const redis = await getRedisHelper();
                if (!redis) {
                    console.error('❌ [5D_AUTO_INIT] Redis helper not available for wingo exposures');
                    return null;
                }
                const wingoExposures = await redis.hgetall(exposureKey);
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
                const k3Exposures = await redis.hgetall(exposureKey);
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
                const betExposures = await redis.hgetall(exposureKey);
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

        const threshold = getUserThreshold(gameType);
        const shouldUseProtectedResult = userCountResult.uniqueUserCount < threshold;
        console.log('🔍 [RESULT_USERS] User count check result:', {
            gameType, periodId, timeline,
            uniqueUserCount: userCountResult.uniqueUserCount,
            shouldUseProtectedResult,
            threshold: threshold
        });

        let result;

        // 🚀 ENHANCED: Check for pre-calculated result first (for 5D games)
        if (['5d', 'fived'].includes(gameType.toLowerCase())) {
            console.log('🔍 [5D_PRE_CALC_CHECK] Checking for pre-calculated result...');
            const preCalculatedResult = await getPreCalculated5DResult(gameType, duration, periodId, timeline);
            
            if (preCalculatedResult) {
                console.log('⚡ [5D_PRE_CALC_SUCCESS] Using pre-calculated result for instant display:', preCalculatedResult);
                result = preCalculatedResult;
                
                // 🗄️ NOTE: Database save is handled by the scheduler, not here
                console.log('💾 [5D_PRE_CALC] Using pre-calculated result (database save handled by scheduler)');
                
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
                    protectionMode: false,
                    protectionReason: 'PRE_CALCULATED',
                    timeline: timeline,
                    source: 'pre_calculated'
                };

                console.log('🎲 [RESULT_END] ==========================================');
                console.log('🎲 [RESULT_END] Final pre-calculated result:', {
                    result: finalResult.result,
                    source: finalResult.source
                });

                return finalResult;
            } else {
                console.log('⚠️ [5D_PRE_CALC_MISS] No pre-calculated result found, proceeding with normal calculation');
            }
        }

        if (shouldUseProtectedResult) {
            console.log('🛡️ [RESULT_PROTECTION] Using PROTECTED result selection');
            console.log('🛡️ [RESULT_PROTECTION] Reason: INSUFFICIENT_USERS');
            console.log('🛡️ [RESULT_PROTECTION] User count:', userCountResult.uniqueUserCount, 'Threshold:', threshold);

            // 🚀 CRITICAL FIX: For 5D games, ALWAYS use parallel processing to find zero exposure from ALL 100,000 combinations
            if (['5d', 'fived'].includes(gameType.toLowerCase())) {
                console.log('🚀 [5D_PROTECTION] Using PARALLEL PROCESSING to find zero exposure from ALL 100,000 combinations');
                
                try {
                    // Use parallel processing to scan ALL combinations for zero exposure
                    const { FiveDParallelProcessor } = require('./5dParallelProcessor');
                    const processor = new FiveDParallelProcessor();
                    result = await processor.getOptimal5DResultParallel(duration, periodId, timeline);
                    
                    console.log('✅ [5D_PROTECTION] Parallel processing completed successfully');
                    console.log('📊 [5D_PROTECTION] Zero exposure combinations found:', result.zeroExposureCount);
                    console.log('🎯 [5D_PROTECTION] Selected result exposure:', result.exposure);
                    
                    // Verify we got a zero exposure result
                    if (result.exposure > 0) {
                        console.warn('⚠️ [5D_PROTECTION] Warning: Parallel processing did not find zero exposure combination');
                        console.warn('⚠️ [5D_PROTECTION] This may indicate an issue with the exposure calculation');
                    }
                    
                } catch (parallelError) {
                    console.error('❌ [5D_PROTECTION] Parallel processing failed, falling back to protection logic:', parallelError.message);
                    
                    // Fallback to old protection logic
                    result = await selectProtectedResultWithExposure(gameType, duration, periodId, timeline);
                    
                    if (!result) {
                        console.log('🛡️ [5D_PROTECTION_FALLBACK] Protection failed, using fallback result');
                        result = await generateRandomResult(gameType);
                    }
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
        } else if (['5d', 'fived'].includes(gameType.toLowerCase())) {
            // 🚀 CRITICAL FIX: For 5D games, ALWAYS use parallel processing regardless of user count
            console.log('🚀 [5D_NORMAL] Using PARALLEL PROCESSING for 5D games regardless of user count');
            
            try {
                // Use parallel processing to scan ALL combinations for zero exposure
                const { FiveDParallelProcessor } = require('./5dParallelProcessor');
                const processor = new FiveDParallelProcessor();
                result = await processor.getOptimal5DResultParallel(duration, periodId, timeline);
                
                console.log('✅ [5D_NORMAL] Parallel processing completed successfully');
                console.log('📊 [5D_NORMAL] Zero exposure combinations found:', result.zeroExposureCount);
                console.log('🎯 [5D_NORMAL] Selected result exposure:', result.exposure);
                
            } catch (parallelError) {
                console.error('❌ [5D_NORMAL] Parallel processing failed, using fallback:', parallelError.message);
                result = await generateRandomResult(gameType);
            }
        } else if (['wingo', 'trx_wix'].includes(gameType.toLowerCase())) {
            // STRICT 60/40 ENFORCEMENT FOR WINGO/TRX_WIX (REDIS EXPOSURE BASED)
            const exposureKey = `exposure:${gameType}:${duration}:${timeline}:${periodId}`;
            const wingoExposures = await redis.hgetall(exposureKey);
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
            const betsData = await redis.hgetall(betHashKey);
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
            // Normal result generation for other games
            console.log('📊 [RESULT_NORMAL] Using NORMAL result generation for other games');
            result = await generateRandomResult(gameType); 
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

        const redis = await getRedisHelper();
        if (!redis) {
            console.error('❌ Redis helper not available');
            throw new Error('Redis helper not available');
        }
        await redis.lpush('5d_performance_log', JSON.stringify(performanceData));
        await redis.ltrim('5d_performance_log', 0, 999); // Keep last 1000 entries

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
            // 🚀 FIX: Use the correct key pattern that matches the scheduler
            const preCalcKey = `precalc_5d_result:${gameType}:${duration}:${timeline}:${periodId}`;
            const preCalcData = {
                result,
                calculationTime,
                useEnhanced,
                calculatedAt: new Date().toISOString(),
                periodId,
                gameType,
                duration,
                timeline,
                methodUsed: useEnhanced ? 'enhanced_system' : 'current_system'
            };

            // Get Redis helper
            const redis = await getRedisHelper();
            if (!redis) {
                console.error('❌ [5D_PRE_CALC] Redis helper not available');
                throw new Error('Redis helper not available');
            }

            await redis.set(preCalcKey, JSON.stringify(preCalcData));
            await redis.expire(preCalcKey, 300); // 5 minutes TTL

            console.log('✅ [5D_PRE_CALC] Pre-calculated result stored:', {
                periodId,
                calculationTime,
                useEnhanced,
                methodUsed: preCalcData.methodUsed,
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
        // 🚀 CRITICAL FIX: For 5D games, ALWAYS check database first since scheduler stores results there
        if (['5d', 'fived'].includes(gameType.toLowerCase())) {
            console.log(`🔍 [5D_PRE_CALC] Checking database for 5D result first...`);
            
            try {
                // Import models using the proper initialization function
                const models = await ensureModelsInitialized();
                
                // Check database for existing result
                const dbResult = await models.BetResult5D.findOne({
                    where: {
                        bet_number: periodId,
                        duration: duration,
                        timeline: timeline
                    }
                });
                
                if (dbResult) {
                    console.log(`✅ [5D_PRE_CALC] Found 5D result in database for period ${periodId}`);
                    
                    // Convert database result to expected format
                    const result = {
                        A: dbResult.result_a,
                        B: dbResult.result_b,
                        C: dbResult.result_c,
                        D: dbResult.result_d,
                        E: dbResult.result_e,
                        sum: dbResult.total_sum,
                        sum_size: dbResult.total_sum < 22 ? 'small' : 'big',
                        sum_parity: dbResult.total_sum % 2 === 0 ? 'even' : 'odd',
                        exposure: 0, // Database doesn't store exposure
                        method: 'database_stored',
                        source: 'database'
                    };
                    
                    console.log('✅ [5D_PRE_CALC] Retrieved 5D result from database:', result);
                    return result;
                } else {
                    console.log(`⚠️ [5D_PRE_CALC] No 5D result found in database for period ${periodId}`);
                }
            } catch (dbError) {
                console.error(`❌ [5D_PRE_CALC] Error checking database:`, dbError.message);
            }
        }
        
        // Fallback to Redis check (for backward compatibility)
        const preCalcKey = `precalc_5d_result:${gameType}:${duration}:${timeline}:${periodId}`;
        console.log(`🔍 [5D_PRE_CALC] Checking Redis for pre-calculated result with key: ${preCalcKey}`);
        
        // Get Redis helper first
        const redis = await getRedisHelper();
        if (!redis) {
            console.error('❌ [5D_PRE_CALC] Redis helper not available');
            return null;
        }

        const preCalcData = await redis.get(preCalcKey);

        if (preCalcData) {
            console.log(`🔍 [5D_PRE_CALC] Raw data from Redis:`, typeof preCalcData, preCalcData);
            
            let parsed;
            try {
                // Handle case where data might already be an object
                if (typeof preCalcData === 'object') {
                    parsed = preCalcData;
                } else if (typeof preCalcData === 'string') {
                    parsed = JSON.parse(preCalcData);
                } else {
                    console.error(`❌ [5D_PRE_CALC] Unexpected data type:`, typeof preCalcData);
                    return null;
                }
            } catch (parseError) {
                console.error(`❌ [5D_PRE_CALC] JSON parse error:`, parseError.message);
                console.error(`❌ [5D_PRE_CALC] Raw data:`, preCalcData);
                return null;
            }
            console.log('✅ [5D_PRE_CALC] Retrieved pre-calculated result from Redis:', {
                periodId,
                methodUsed: parsed.methodUsed,
                calculatedAt: parsed.calculatedAt,
                result: parsed.result
            });

            // Clean up the pre-calculated data
            await redis.del(preCalcKey);
            console.log('🧹 [5D_PRE_CALC] Cleaned up pre-calculated data from Redis');

            return parsed.result;
        } else {
            console.log('⚠️ [5D_PRE_CALC] No pre-calculated result found in Redis, will calculate now');
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
        const betsData = await redis.hgetall(betHashKey);
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

        const threshold = getUserThreshold(gameType);
        const result = {
            gameType,
            periodId,
            timeline,
            uniqueUserCount: uniqueUsers.size,
            totalBets: Object.keys(betsData).length,
            threshold: threshold,
            uniqueUsers: Array.from(uniqueUsers),
            betHashKey: betHashKey,
            meetsThreshold: uniqueUsers.size >= threshold
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
        const threshold = getUserThreshold(gameType);
        return {
            gameType,
            periodId,
            timeline,
            uniqueUserCount: 0,
            totalBets: 0,
            threshold: threshold,
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
        const betsData = await redis.hgetall(betHashKey);

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

        // logger.info('Getting enhanced game history', {
        //     gameType,
        //     duration,
        //     limit,
        //     offset,
        //     timestamp: new Date().toISOString()
        // });

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

            case 'SUM_SIZE':
                // Sum size betting - 2.0x payout (same as SUM_CATEGORY for K3)
                console.log(`🎲 [K3_SUM_SIZE_CHECK] Checking SUM_SIZE bet: ${betValue} vs sum: ${sum}`);

                if (betValue === 'big' && sum >= 11) {
                    const payout = betAmount * 2.0;
                    console.log(`🎲 [K3_SUM_SIZE_WIN] BIG bet WON! (sum ${sum} >= 11)`, {
                        betValue: betValue,
                        sum: sum,
                        multiplier: 2.0,
                        betAmount: betAmount,
                        payout: payout
                    });
                    return payout;
                } else if (betValue === 'small' && sum < 11) {
                    const payout = betAmount * 2.0;
                    console.log(`🎲 [K3_SUM_SIZE_WIN] SMALL bet WON! (sum ${sum} < 11)`, {
                        betValue: betValue,
                        sum: sum,
                        multiplier: 2.0,
                        betAmount: betAmount,
                        payout: payout
                    });
                    return payout;
                } else {
                    console.log(`🎲 [K3_SUM_SIZE_LOSS] SUM_SIZE bet LOST:`, {
                        betValue: betValue,
                        sum: sum,
                        isBig: sum >= 11
                    });
                }
                break;

            case 'SUM_PARITY':
                // Sum parity betting - 2.0x payout (same as SUM_CATEGORY for K3)
                console.log(`🎲 [K3_SUM_PARITY_CHECK] Checking SUM_PARITY bet: ${betValue} vs sum: ${sum}`);

                if (betValue === 'odd' && sum % 2 === 1) {
                    const payout = betAmount * 2.0;
                    console.log(`🎲 [K3_SUM_PARITY_WIN] ODD bet WON! (sum ${sum} is odd)`, {
                        betValue: betValue,
                        sum: sum,
                        multiplier: 2.0,
                        betAmount: betAmount,
                        payout: payout
                    });
                    return payout;
                } else if (betValue === 'even' && sum % 2 === 0) {
                    const payout = betAmount * 2.0;
                    console.log(`🎲 [K3_SUM_PARITY_WIN] EVEN bet WON! (sum ${sum} is even)`, {
                        betValue: betValue,
                        sum: sum,
                        multiplier: 2.0,
                        betAmount: betAmount,
                        payout: payout
                    });
                    return payout;
                } else {
                    console.log(`🎲 [K3_SUM_PARITY_LOSS] SUM_PARITY bet LOST:`, {
                        betValue: betValue,
                        sum: sum,
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

            case 'TWO_DIFFERENT':
                console.log(`🎲 [K3_TWO_DIFFERENT_PAYOUT_CHECK] Checking TWO_DIFFERENT bet: ${betValue}`, {
                    dice: [result.dice_1, result.dice_2, result.dice_3],
                    hasPair: result.has_pair,
                    hasTriple: result.has_triple
                });

                if (betValue && betValue !== 'null') {
                    // Specific 2-number combination bet (e.g., "1,2") - ORDER MATTERS!
                    const targetCombo = betValue.split(',').map(n => parseInt(n.trim()));
                    const resultCombo = [result.dice_1, result.dice_2, result.dice_3];
                    
                    // Check if the first two dice match the target combination
                    const isSpecificComboWin = targetCombo.length === 2 && 
                        targetCombo[0] === resultCombo[0] && 
                        targetCombo[1] === resultCombo[1];
                    
                    console.log(`🎲 [K3_SPECIFIC_TWO_DIFFERENT_PAYOUT_CHECK] ${targetCombo.join(',')} vs first two dice:[${resultCombo[0]},${resultCombo[1]}] = ${isSpecificComboWin} (ORDER MATTERS!)`);

                    if (isSpecificComboWin) {
                        const payout = betAmount * 6.91;
                        console.log(`🎲 [K3_TWO_DIFFERENT_WIN] Specific TWO_DIFFERENT bet WON!`, {
                            betValue: betValue,
                            targetCombo: targetCombo,
                            resultCombo: resultCombo,
                            multiplier: 6.91,
                            betAmount: betAmount,
                            payout: payout
                        });
                        return payout;
                    } else {
                        console.log(`🎲 [K3_TWO_DIFFERENT_LOSS] Specific TWO_DIFFERENT bet LOST: ${targetCombo.join(',')} !== first two dice:[${resultCombo[0]},${resultCombo[1]}] (positions don't match)`);
                    }
                } else {
                    // Generic two_different bet (any pair, not triple)
                    const isTwoDifferentWin = result.has_pair && !result.has_triple;
                    
                    console.log(`🎲 [K3_GENERIC_TWO_DIFFERENT_PAYOUT_CHECK] two_different vs has_pair:${result.has_pair}, has_triple:${result.has_triple} = ${isTwoDifferentWin}`);

                    if (isTwoDifferentWin) {
                        const payout = betAmount * 6.91;
                        console.log(`🎲 [K3_TWO_DIFFERENT_WIN] Generic TWO_DIFFERENT bet WON!`, {
                            betValue: betValue,
                            dice: [result.dice_1, result.dice_2, result.dice_3],
                            hasPair: result.has_pair,
                            hasTriple: result.has_triple,
                            multiplier: 6.91,
                            betAmount: betAmount,
                            payout: payout
                        });
                        return payout;
                    } else {
                        console.log(`🎲 [K3_TWO_DIFFERENT_LOSS] Generic TWO_DIFFERENT bet LOST: has_pair:${result.has_pair}, has_triple:${result.has_triple}`);
                    }
                }
                break;
            case 'ALL_DIFFERENT':
                console.log(`🎲 [K3_ALL_DIFFERENT_PAYOUT_CHECK] Checking ALL_DIFFERENT bet: ${betValue}`, {
                    dice: [result.dice_1, result.dice_2, result.dice_3],
                    hasPair: result.has_pair,
                    hasTriple: result.has_triple
                });

                if (betValue && betValue !== 'null') {
                    // Specific combination bet (e.g., "1,2,3") - ORDER MATTERS!
                    const targetCombo = betValue.split(',').map(n => parseInt(n.trim()));
                    const resultCombo = [result.dice_1, result.dice_2, result.dice_3];
                    const isSpecificComboWin = targetCombo.every((val, idx) => val === resultCombo[idx]);
                    
                    console.log(`🎲 [K3_SPECIFIC_ALL_DIFFERENT_PAYOUT_CHECK] ${targetCombo.join(',')} vs ${resultCombo.join(',')} = ${isSpecificComboWin} (ORDER MATTERS!)`);

                    if (isSpecificComboWin) {
                        const payout = betAmount * 34.56;
                        console.log(`🎲 [K3_ALL_DIFFERENT_WIN] Specific ALL_DIFFERENT bet WON!`, {
                            betValue: betValue,
                            targetCombo: targetCombo,
                            resultCombo: resultCombo,
                            multiplier: 34.56,
                            betAmount: betAmount,
                            payout: payout
                        });
                        return payout;
                    } else {
                        console.log(`🎲 [K3_ALL_DIFFERENT_LOSS] Specific ALL_DIFFERENT bet LOST: ${targetCombo.join(',')} !== ${resultCombo.join(',')} (positions don't match)`);
                    }
                } else {
                    // Generic all_different bet (any 3 different numbers)
                    const unique = new Set([result.dice_1, result.dice_2, result.dice_3]);
                    const isAllDifferentWin = unique.size === 3;
                    
                    console.log(`🎲 [K3_GENERIC_ALL_DIFFERENT_PAYOUT_CHECK] all_different vs dice:[${result.dice_1},${result.dice_2},${result.dice_3}] unique:${unique.size} = ${isAllDifferentWin}`);

                    if (isAllDifferentWin) {
                        const payout = betAmount * 34.56;
                        console.log(`🎲 [K3_ALL_DIFFERENT_WIN] Generic ALL_DIFFERENT bet WON!`, {
                            betValue: betValue,
                            dice: [result.dice_1, result.dice_2, result.dice_3],
                            uniqueCount: unique.size,
                            multiplier: 34.56,
                            betAmount: betAmount,
                            payout: payout
                        });
                        return payout;
                    } else {
                        console.log(`🎲 [K3_ALL_DIFFERENT_LOSS] Generic ALL_DIFFERENT bet LOST: unique count ${unique.size} !== 3`);
                    }
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

        case 'TWO_DIFFERENT':
            if (betValue && betValue !== 'null') {
                // Specific 2-number combination bet (e.g., "1,2") - ORDER MATTERS!
                const targetCombo = betValue.split(',').map(n => parseInt(n.trim()));
                const resultCombo = [result.dice_1, result.dice_2, result.dice_3];
                
                // Check if the first two dice match the target combination
                const isSpecificComboWin = targetCombo.length === 2 && 
                    targetCombo[0] === resultCombo[0] && 
                    targetCombo[1] === resultCombo[1];
                
                console.log(`🎲 [K3_SPECIFIC_TWO_DIFFERENT_CHECK] ${targetCombo.join(',')} vs first two dice:[${resultCombo[0]},${resultCombo[1]}] = ${isSpecificComboWin} (ORDER MATTERS!)`);
                return isSpecificComboWin;
            } else {
                // Generic two_different bet (any pair, not triple)
                const isTwoDifferentWin = result.has_pair && !result.has_triple;
                
                console.log(`🎲 [K3_GENERIC_TWO_DIFFERENT_CHECK] two_different vs has_pair:${result.has_pair}, has_triple:${result.has_triple} = ${isTwoDifferentWin}`);
                return isTwoDifferentWin;
            }

        case 'ALL_DIFFERENT':
            if (betValue && betValue !== 'null') {
                // Specific combination bet (e.g., "1,2,3") - ORDER MATTERS!
                const targetCombo = betValue.split(',').map(n => parseInt(n.trim()));
                const resultCombo = [result.dice_1, result.dice_2, result.dice_3];
                const isSpecificComboWin = targetCombo.every((val, idx) => val === resultCombo[idx]);
                console.log(`🎲 [K3_SPECIFIC_ALL_DIFFERENT_CHECK] ${targetCombo.join(',')} vs ${resultCombo.join(',')} = ${isSpecificComboWin} (ORDER MATTERS!)`);
                return isSpecificComboWin;
            } else {
                // Generic all_different bet (any 3 different numbers)
                const unique = new Set([result.dice_1, result.dice_2, result.dice_3]);
                const isAllDifferentWin = unique.size === 3;
                console.log(`🎲 [K3_ALL_DIFFERENT_CHECK] all_different vs dice:[${result.dice_1},${result.dice_2},${result.dice_3}] unique:${unique.size} = ${isAllDifferentWin}`);
                return isAllDifferentWin;
            }

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
        const redis = await getRedisHelper();
        if (!redis) {
            console.error('❌ Redis helper not available');
            throw new Error('Redis helper not available');
        }

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
                    const resultKeys = await redis.keys(`${gameType}:${duration}:*:result`);

                    for (const key of resultKeys) {
                        // Extract periodId from key
                        const keyParts = key.split(':');
                        const periodId = keyParts[keyParts.length - 2];

                        // If period date is older than our threshold, delete it
                        if (periodId && periodId.startsWith('20') && periodId.slice(0, 8) < compareDate) {
                            await redis.del(key);
                            summary.cleaned++;
                        }
                    }

                    // 2. Clean up bet tracking data (always aggressive)
                    const betKeys = await redis.keys(`${gameType}:${duration}:*:total`);
                    for (const key of betKeys) {
                        const keyParts = key.split(':');
                        const periodId = keyParts[2];

                        // If period is older than yesterday, remove it
                        if (periodId && periodId.startsWith('20') && periodId.slice(0, 8) < yesterdayStr) {
                            await redis.del(key);

                            // Also remove related keys
                            const relatedPrefix = `${gameType}:${duration}:${periodId}`;
                            const relatedKeys = await redis.keys(`${relatedPrefix}:*`);

                            for (const relatedKey of relatedKeys) {
                                await redis.del(relatedKey);
                                summary.cleaned++;
                            }
                        }
                    }

                    // 3. Only keep last 10 periods in recent_results list
                    const recentResultsKey = `${gameType}:${duration}:recent_results`;
                    await redis.zremrangebyrank(recentResultsKey, 0, -11);

                    // 4. Only keep last 20 tracked periods
                    const trackedPeriodsKey = `${gameType}:${duration}:tracked_periods`;
                    await redis.zremrangebyrank(trackedPeriodsKey, 0, -21);
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
        const betsData = await redis.hgetall(betHashKey);

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

        const redis = await getRedisHelper();
        if (!redis) {
            console.error('❌ Redis helper not available');
            throw new Error('Redis helper not available');
        }

        // Add to sorted set with timestamp as score
        const score = Date.now();
        await redis.zadd(recentResultsKey, score, JSON.stringify(historyItem));

        // Keep only last 100 results
        await redis.zremrangebyrank(recentResultsKey, 0, -101);

        // Set expiry for 24 hours
        await redis.expire(recentResultsKey, 86400);

        // Also store in history list
        await redis.lpush(historyKey, JSON.stringify(historyItem));

        // Trim history list to 100 items
        await redis.ltrim(historyKey, 0, 99);

        // Set expiry for 24 hours
        await redis.expire(historyKey, 86400);

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
        const redis = await getRedisHelper();
        await redis.getClient().incrbyfloat(totalKey, betAmount);

        // Update exposure tracking - FIXED: Pass production format that actually works
        await updateBetExposure(gameType, duration, periodId, {
            userId: userId,                         // Add userId for user tracking
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

        // 🚀 OPTIMIZATION: Use Redis pipeline for batch operations
        const redis = await getRedisHelper();
        const pipeline = redis.getClient().pipeline();

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

        // 🚀 OPTIMIZATION: Batch all Redis operations in pipeline
        const totalKey = `${gameType}:${durationKey}:${timeline}:${periodId}:total`;
        const feeKey = `${gameType}:${durationKey}:${timeline}:${periodId}:fees`;
        const grossKey = `${gameType}:${durationKey}:${timeline}:${periodId}:gross`;

        // Get current values in parallel
        const [currentTotal, currentFees, currentGross] = await Promise.all([
            redis.get(totalKey).catch(() => '0'),
            redis.get(feeKey).catch(() => '0'),
            redis.get(grossKey).catch(() => '0')
        ]);

        // Add operations to pipeline
        pipeline.set(totalKey, (parseFloat(currentTotal) + parseFloat(netBetAmount)).toString());
        pipeline.set(feeKey, (parseFloat(currentFees) + parseFloat(platformFee)).toString());
        pipeline.set(grossKey, (parseFloat(currentGross) + parseFloat(grossBetAmount)).toString());

        // Set expiry for all keys
        pipeline.expire(totalKey, 86400);
        pipeline.expire(feeKey, 86400);
        pipeline.expire(grossKey, 86400);

        // 🚀 OPTIMIZATION: Execute all Redis operations in single pipeline
        await pipeline.exec();

        // Update exposure tracking (separate operation due to complexity)
        await updateBetExposure(gameType, duration, periodId, {
            userId: userId,                         // Add userId for user tracking
            bet_type: `${betType}:${betValue}`,    // Use production format: "COLOR:red"
            amount_after_tax: netBetAmount,         // Use production field name
            netBetAmount,                           // Keep legacy fallback
            odds
        }, timeline);

        console.log(`✅ Bet stored in Redis with optimized pipeline for ${gameType} ${duration}s ${timeline}`);
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
        const fallbackData = await redis.get(fallbackKey);

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
        
        // Ensure we have a valid transaction
        let useTransaction;
        let shouldCommit = false;
        
        if (transaction) {
            useTransaction = transaction;
            shouldCommit = false;
        } else {
            try {
                // Ensure database is initialized before creating transaction
                console.log('🔄 [PROCESS_RESULT] Ensuring database is initialized...');
                const db = await ensureDatabaseInitialized();
                console.log('✅ [PROCESS_RESULT] Database initialized, creating transaction...');
                console.log('🔍 [PROCESS_RESULT] Database instance:', typeof db, db ? 'exists' : 'null');
                useTransaction = await db.transaction();
                shouldCommit = true;
                console.log('✅ [PROCESS_RESULT] Transaction created successfully');
            } catch (error) {
                console.error('❌ [PROCESS_RESULT] Failed to create transaction:', error.message);
                console.error('❌ [PROCESS_RESULT] Error stack:', error.stack);
                throw new Error(`Database transaction creation failed: ${error.message}`);
            }
        }

        // 🗄️ CRITICAL: Declare resultWithVerification outside try block for catch block access
        let resultWithVerification = null;
        let transactionCommitted = false; // Track if transaction was committed
        let savedResult = null; // Track saved result for return statement
        let betProcessingTransaction = null; // Separate transaction for bet processing
        let shouldCommitBetProcessing = false; // Whether to commit bet processing transaction

        try {
            // Check existing result
            let existingResult = await checkExistingResult(gameType, duration, periodId, timeline, useTransaction);
            if (existingResult) {
                console.log(`⚠️ Result exists, returning existing`);
                if (shouldCommit) {
                    try {
                        await useTransaction.commit();
                        transactionCommitted = true;
                        console.log('💾 [PROCESS_RESULT] Transaction committed (existing result found)');
                    } catch (commitError) {
                        console.error('❌ [PROCESS_RESULT] Error committing transaction for existing result:', commitError);
                    }
                }
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
            const redis = await getRedisHelper();
            if (!redis) {
                console.error('❌ Redis helper not available');
                throw new Error('Redis helper not available');
            }
            const redisLockAcquired = await redis.set(redisLockKey, redisLockValue, 'EX', 30, 'NX');

            if (!redisLockAcquired) {
                console.log(`🔒 Redis lock failed, waiting...`);
                if (shouldCommit) {
                    try {
                        await useTransaction.rollback();
                        console.log('💾 [PROCESS_RESULT] Transaction rolled back (Redis lock failed)');
                    } catch (rollbackError) {
                        console.error('❌ [PROCESS_RESULT] Error rolling back transaction for Redis lock failure:', rollbackError);
                    }
                }
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
                    if (shouldCommit) {
                        try {
                            await useTransaction.commit();
                            transactionCommitted = true;
                            console.log('💾 [PROCESS_RESULT] Transaction committed (final check found existing result)');
                        } catch (commitError) {
                            console.error('❌ [PROCESS_RESULT] Error committing transaction for final check result:', commitError);
                        }
                    }
                    return {
                        success: true,
                        result: existingResult.dbResult,
                        gameResult: existingResult.gameResult,
                        winners: existingResult.winners || [],
                        timeline: timeline,
                        source: 'final_check'
                    };
                }

                // 🔐 CRITICAL: Check for admin override FIRST before generating result
                console.log('🔐 [ADMIN_CHECK] Checking for admin-set result in Redis...');
                const durationKey = duration === 30 ? '30s' : 
                                  duration === 60 ? '1m' : 
                                  duration === 180 ? '3m' : 
                                  duration === 300 ? '5m' : '10m';
                
                // Primary result key (where admin stores the result)
                const primaryResultKey = `wingo:${durationKey}:${periodId}:result`;
                
                // Additional override keys for backwards compatibility and redundancy
                const additionalOverrideKeys = [
                    `wingo:${durationKey}:${periodId}:result:override`,
                    `wingo:${periodId}:admin:override`,
                    `wingo:result:${periodId}:forced`,
                    `game:wingo:${durationKey}:${periodId}:admin_result`
                ];
                
                let adminSetResult = null;
                let resultSource = null;
                
                // 🔧 SPECIAL: Check for admin-set results with proper Redis initialization
                // This is a separate async function that initializes Redis properly for admin detection
                async function checkAdminResults() {
                    try {
                        // Ensure Redis is initialized for admin checks
                        await unifiedRedis.initialize();
                        const adminHelper = await unifiedRedis.getHelper();
                        
                        // Check primary result key first
                        try {
                            const primaryResult = await adminHelper.get(primaryResultKey);
                            if (primaryResult) {
                                const parsed = typeof primaryResult === 'string' ? JSON.parse(primaryResult) : primaryResult;
                                console.log('🔐 [ADMIN_CHECK] ✅ ADMIN-SET RESULT FOUND in primary key!');
                                console.log('🔐 [ADMIN_CHECK] Result key:', primaryResultKey);
                                console.log('🔐 [ADMIN_CHECK] Admin result:', parsed);
                                return { result: parsed, source: primaryResultKey };
                            }
                        } catch (parseError) {
                            console.log('🔐 [ADMIN_CHECK] Error parsing primary result:', parseError.message);
                        }
                        
                        // If not found in primary, check additional override keys
                        for (const overrideKey of additionalOverrideKeys) {
                            try {
                                const overrideData = await adminHelper.get(overrideKey);
                                if (overrideData) {
                                    const parsed = typeof overrideData === 'string' ? JSON.parse(overrideData) : overrideData;
                                    console.log('🔐 [ADMIN_CHECK] ✅ ADMIN OVERRIDE FOUND in fallback key!');
                                    console.log('🔐 [ADMIN_CHECK] Override key:', overrideKey);
                                    console.log('🔐 [ADMIN_CHECK] Override result:', parsed);
                                    return { result: parsed, source: overrideKey };
                                }
                            } catch (parseError) {
                                console.log('🔐 [ADMIN_CHECK] Error parsing override data from', overrideKey, ':', parseError.message);
                            }
                        }
                        return null;
                    } catch (adminError) {
                        console.log('🔐 [ADMIN_CHECK] Admin check failed, continuing with normal flow:', adminError.message);
                        return null;
                    }
                }
                
                // Check for admin results
                const adminCheck = await checkAdminResults();
                if (adminCheck) {
                    adminSetResult = adminCheck.result;
                    resultSource = adminCheck.source;
                }

                if (adminSetResult) {
                    console.log('🔐 [ADMIN_OVERRIDE] ===== USING ADMIN-SET RESULT =====');
                    console.log('🔐 [ADMIN_OVERRIDE] Found admin result from:', resultSource);
                    console.log('🔐 [ADMIN_OVERRIDE] Skipping automatic result generation');
                    console.log('🔐 [ADMIN_OVERRIDE] Admin-set result takes precedence over all other logic');
                    
                    // Check if it's marked as admin override
                    const isAdminOverride = adminSetResult.isAdminOverride || false;
                    console.log('🔐 [ADMIN_OVERRIDE] Is admin override:', isAdminOverride);
                    console.log('🔐 [ADMIN_OVERRIDE] Admin user ID:', adminSetResult.adminUserId);
                    console.log('🔐 [ADMIN_OVERRIDE] Override timestamp:', adminSetResult.overrideTimestamp);
                    console.log('🔐 [ADMIN_OVERRIDE] Request ID:', adminSetResult.requestId);
                    
                    // Use admin-set result
                    resultWithVerification = {
                        result: {
                            number: adminSetResult.number,
                            color: adminSetResult.color,
                            size: adminSetResult.size
                        },
                        isOverride: isAdminOverride,
                        isAdminSet: true,
                        overrideSource: 'admin',
                        adminUserId: adminSetResult.adminUserId,
                        requestId: adminSetResult.requestId,
                        overrideTimestamp: adminSetResult.overrideTimestamp,
                        resultSource: resultSource
                    };
                    
                    console.log('🔐 [ADMIN_OVERRIDE] Admin-set result prepared for processing:', resultWithVerification.result);
                } else {
                    console.log('🔐 [ADMIN_CHECK] No admin-set result found, proceeding with automatic generation');
                    
                    // Generate result using exposure-based selection
                    console.log('🎯 [PROCESS_RESULT] Generating NEW result with exposure-based optimization');
                    console.log('🎯 [PROCESS_RESULT] Calling calculateResultWithVerification...');

                    console.log('🎯 [PROCESS_RESULT] About to call calculateResultWithVerification with params:', {
                        gameType, duration, periodId, timeline
                    });

                    resultWithVerification = await calculateResultWithVerification(gameType, duration, periodId, timeline);
                }
                const result = resultWithVerification.result;

                console.log('🎯 [PROCESS_RESULT] Result generated successfully:', {
                    result: result,
                    protectionMode: resultWithVerification.protectionMode,
                    protectionReason: resultWithVerification.protectionReason,
                    verification: resultWithVerification.verification,
                    source: resultWithVerification.source
                });
                console.log('🔍 [PROCESS_RESULT] Source check for bet processing:', {
                    source: resultWithVerification.source,
                    isPreCalculated: resultWithVerification.source === 'pre_calculated',
                    gameType: gameType
                });

                // 🗄️ CRITICAL: Only save to database if NOT using pre-calculated result
                // Pre-calculated results are already saved by the scheduler
                if (resultWithVerification.source === 'pre_calculated') {
                    console.log('💾 [PROCESS_RESULT] Skipping database save - using pre-calculated result (already saved by scheduler)');
                } else {
                    console.log('💾 [PROCESS_RESULT] Saving result to database (not pre-calculated)');

                // Save to database
                let savedResult;
                    console.log('🔍 [PROCESS_RESULT] About to save to database, transaction state:', {
                        transactionState: useTransaction?.finished ? 'finished' : 'active',
                        transactionCommitted
                    });
                    
                if (gameType === 'wingo') {
                    savedResult = await models.BetResultWingo.create({
                        bet_number: periodId,
                        result_of_number: result.number,
                        result_of_size: result.size,
                        result_of_color: result.color,
                        duration: duration,
                        timeline: timeline
                    }, { transaction: useTransaction });
                        console.log('🔍 [PROCESS_RESULT] After Wingo save, transaction state:', {
                            transactionState: useTransaction?.finished ? 'finished' : 'active',
                            transactionCommitted
                        });

                } else if (gameType === 'fiveD' || gameType === '5d') {
                    // 🚀 CRITICAL FIX: Check for existing result before creating new one
                    const existingResult = await models.BetResult5D.findOne({
                        where: {
                            bet_number: periodId,
                            duration: duration,
                            timeline: timeline
                        },
                        transaction: useTransaction
                    });
                    
                    if (existingResult) {
                        console.log(`⚠️ [DUPLICATE_RESULT_PREVENTION] Result already exists for period ${periodId}, skipping creation`);
                        savedResult = existingResult;
                    } else {
                        console.log(`💾 [RESULT_CREATION] Creating new BetResult5D for period ${periodId}`);
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
                    }
                        console.log('🔍 [PROCESS_RESULT] After 5D save, transaction state:', {
                            transactionState: useTransaction?.finished ? 'finished' : 'active',
                            transactionCommitted
                        });

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
                }

                console.log('🏆 [PROCESS_WINNERS] Processing winning bets...');
                
                // 🗄️ CRITICAL FIX: For pre-calculated results, we need a separate transaction for bet processing
                let betProcessingTransaction = useTransaction;
                let shouldCommitBetProcessing = shouldCommit;
                
                if (resultWithVerification.source === 'pre_calculated') {
                    // Create a separate transaction for bet processing since the main transaction won't be committed
                    const db = await ensureDatabaseInitialized();
                    betProcessingTransaction = await db.transaction();
                    shouldCommitBetProcessing = true;
                    console.log('💾 [PROCESS_RESULT] Created separate transaction for bet processing (pre-calculated result)');
                    console.log('🔍 [BET_PROCESSING_DEBUG] Bet processing transaction created:', {
                        hasTransaction: !!betProcessingTransaction,
                        shouldCommit: shouldCommitBetProcessing,
                        gameType: gameType,
                        periodId: periodId
                    });
                } else {
                    console.log('🔍 [BET_PROCESSING_DEBUG] Using main transaction for bet processing:', {
                        source: resultWithVerification.source,
                        gameType: gameType,
                        periodId: periodId
                    });
                }
                
                // 🚨 CRITICAL FIX: For 5D games, ensure we use the database result to prevent duplicates
                let finalResult = result;
                if (['5d', 'fived'].includes(gameType.toLowerCase())) {
                    console.log('🚨 [5D_DUPLICATE_PREVENTION] Checking for existing result in database...');
                    
                    try {
                        const models = await ensureModelsInitialized();
                        const existingResult = await models.BetResult5D.findOne({
                            where: { bet_number: periodId }
                        });
                        
                        if (existingResult) {
                            console.log('✅ [5D_DUPLICATE_PREVENTION] Found existing result, using database result for consistency:', {
                                existingResult: {
                                    A: existingResult.result_a,
                                    B: existingResult.result_b,
                                    C: existingResult.result_c,
                                    D: existingResult.result_d,
                                    E: existingResult.result_e,
                                    sum: existingResult.total_sum
                                },
                                currentResult: result
                            });
                            
                            // Override with database result to ensure consistency
                            finalResult = {
                                A: existingResult.result_a,
                                B: existingResult.result_b,
                                C: existingResult.result_c,
                                D: existingResult.result_d,
                                E: existingResult.result_e,
                                sum: existingResult.total_sum,
                                sum_size: existingResult.total_sum < 22 ? 'small' : 'big',
                                sum_parity: existingResult.total_sum % 2 === 0 ? 'even' : 'odd'
                            };
                            
                            console.log('🔄 [5D_DUPLICATE_PREVENTION] Result overridden with database result for consistency');
                        } else {
                            console.log('⚠️ [5D_DUPLICATE_PREVENTION] No existing result found, using current result');
                        }
                    } catch (error) {
                        console.error('❌ [5D_DUPLICATE_PREVENTION] Error checking database result:', error.message);
                        console.log('⚠️ [5D_DUPLICATE_PREVENTION] Using current result as fallback');
                    }
                }
                
                // Process winners
                console.log('🔥 [BET_PROCESSING_START] About to call processWinningBetsWithTimeline:', {
                    gameType: gameType,
                    duration: duration,
                    periodId: periodId,
                    timeline: timeline,
                    hasResult: !!finalResult,
                    resultKeys: finalResult ? Object.keys(finalResult) : [],
                    hasTransaction: !!betProcessingTransaction,
                    transactionState: betProcessingTransaction?.finished ? 'finished' : 'active'
                });
                
                const winners = await processWinningBetsWithTimeline(gameType, duration, periodId, timeline, finalResult, betProcessingTransaction);

                console.log('🏆 [PROCESS_WINNERS] Winners processed:', {
                    winnerCount: winners.length,
                    winners: winners.map(w => ({ userId: w.userId, winnings: w.winnings }))
                });

                console.log('🔄 [PROCESS_CLEANUP] Resetting period exposure...');
                // Reset exposure for next period
                try {
                await resetPeriodExposure(gameType, duration, periodId);
                    console.log('✅ [PROCESS_CLEANUP] Period exposure reset successfully');
                } catch (cleanupError) {
                    console.error('❌ [PROCESS_CLEANUP] Error resetting period exposure:', cleanupError);
                    // Don't throw here - this is cleanup and shouldn't fail the entire process
                }

                // 🗄️ CRITICAL: Commit bet processing transaction if needed
                if (shouldCommitBetProcessing) {
                    try {
                        await betProcessingTransaction.commit();
                        console.log('💾 [PROCESS_RESULT] Bet processing transaction committed');
                    } catch (commitError) {
                        console.error('❌ [PROCESS_RESULT] Error committing bet processing transaction:', commitError);
                        // Try to rollback the bet processing transaction
                        try {
                            await betProcessingTransaction.rollback();
                            console.log('💾 [PROCESS_RESULT] Bet processing transaction rolled back after commit error');
                        } catch (rollbackError) {
                            console.error('❌ [PROCESS_RESULT] Error rolling back bet processing transaction after commit error:', rollbackError);
                        }
                        throw commitError; // Re-throw to be handled by outer catch
                    }
                }

                // 🗄️ CRITICAL: Only commit main transaction if we actually used it (not pre-calculated) AND not already committed
                console.log('🔍 [PROCESS_RESULT] Transaction state check:', {
                    shouldCommit,
                    source: resultWithVerification?.source,
                    transactionCommitted,
                    transactionState: useTransaction?.finished ? 'finished' : 'active'
                });
                
                // Check if transaction is already finished before trying to commit
                if (useTransaction?.finished) {
                    console.log('💾 [PROCESS_RESULT] Skipping main transaction commit (transaction already finished)');
                } else if (shouldCommit && resultWithVerification.source !== 'pre_calculated' && !transactionCommitted) {
                    try {
                        console.log('🔍 [PROCESS_RESULT] About to commit main transaction...');
                        await useTransaction.commit();
                        transactionCommitted = true; // Mark transaction as committed
                        console.log('💾 [PROCESS_RESULT] Main transaction committed (database save performed)');
                    } catch (commitError) {
                        console.error('❌ [PROCESS_RESULT] Error committing main transaction:', commitError);
                        // Try to rollback the main transaction
                        try {
                            await useTransaction.rollback();
                            console.log('💾 [PROCESS_RESULT] Main transaction rolled back after commit error');
                        } catch (rollbackError) {
                            console.error('❌ [PROCESS_RESULT] Error rolling back main transaction after commit error:', rollbackError);
                        }
                        throw commitError; // Re-throw to be handled by outer catch
                    }
                } else if (resultWithVerification.source === 'pre_calculated') {
                    console.log('💾 [PROCESS_RESULT] Skipping main transaction commit (using pre-calculated result)');
                } else if (transactionCommitted) {
                    console.log('💾 [PROCESS_RESULT] Skipping main transaction commit (transaction already committed)');
                } else {
                    console.log('💾 [PROCESS_RESULT] Skipping main transaction commit (other reason)');
                }

                console.log('✅ [PROCESS_COMPLETE] Complete result processing done');
                console.log('🎲 [PROCESS_END] ==========================================');

                return {
                    success: true,
                    result: savedResult, // Use savedResult directly (will be null for pre-calculated)
                    gameResult: result,
                    winners: winners,
                    timeline: timeline,
                    source: resultWithVerification.source || 'new_result',
                    protectionMode: resultWithVerification.protectionMode,
                    protectionReason: resultWithVerification.protectionReason
                };

            } finally {
                // Release Redis lock
                try {
                    const currentLock = await redis.get(redisLockKey);
                    if (currentLock === redisLockValue) {
                        await redis.del(redisLockKey);
                    }
                } catch (lockError) {
                    console.error('❌ Error releasing Redis lock:', lockError);
                }
            }

        } catch (error) {
            console.error(`❌ [PROCESS_RESULT] Error in main try block:`, error);
            
            // 🗄️ CRITICAL: Handle bet processing transaction rollback
            if (shouldCommitBetProcessing && betProcessingTransaction && betProcessingTransaction !== useTransaction) {
                try {
                    await betProcessingTransaction.rollback();
                    console.log('💾 [PROCESS_RESULT] Bet processing transaction rolled back');
                } catch (rollbackError) {
                    console.error('❌ [PROCESS_RESULT] Error rolling back bet processing transaction:', rollbackError);
                }
            }
            
            // 🗄️ CRITICAL: Only rollback main transaction if we actually used it AND it hasn't been committed yet
            if (useTransaction?.finished) {
                console.log('💾 [PROCESS_RESULT] Skipping main transaction rollback (transaction already finished)');
            } else if (shouldCommit && resultWithVerification?.source !== 'pre_calculated' && !transactionCommitted) {
                try {
                    await useTransaction.rollback();
                    console.log('💾 [PROCESS_RESULT] Main transaction rolled back (database save failed)');
                } catch (rollbackError) {
                    console.error('❌ [PROCESS_RESULT] Error rolling back main transaction:', rollbackError);
                }
            } else if (resultWithVerification?.source === 'pre_calculated') {
                console.log('💾 [PROCESS_RESULT] Skipping main transaction rollback (using pre-calculated result)');
            } else if (transactionCommitted) {
                console.log('💾 [PROCESS_RESULT] Skipping main transaction rollback (transaction already committed)');
            }
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
        console.log(`🔍 [PROCESS_WINNING_BETS_DEBUG] Function called with:`, {
            gameType: gameType,
            duration: duration,
            periodId: periodId,
            timeline: timeline,
            hasResult: !!result,
            resultKeys: result ? Object.keys(result) : [],
            hasTransaction: !!transaction,
            transactionState: transaction?.finished ? 'finished' : 'active'
        });
        
        // ADDITIONAL 5D SPECIFIC LOGGING
        if (['5d', 'fived'].includes(gameType.toLowerCase())) {
            console.log(`🎯 [5D_BET_PROCESSING] 5D bet processing started for period ${periodId}`);
            console.log(`🎯 [5D_BET_PROCESSING] Result data:`, result);
        }

        const models = await ensureModelsInitialized();
        
        // Ensure we have a valid transaction
        let useTransaction;
        let shouldCommit = false;
        
        if (transaction) {
            useTransaction = transaction;
            shouldCommit = false;
        } else {
            try {
                // Ensure database is initialized before creating transaction
                const db = await ensureDatabaseInitialized();
                useTransaction = await db.transaction();
                shouldCommit = true;
            } catch (error) {
                console.error('❌ [PROCESS_WINNING_BETS] Failed to create transaction:', error.message);
                throw new Error(`Database transaction creation failed: ${error.message}`);
            }
        }

        try {
            let bets = [];
            const winningBets = [];

            // Get bets for this specific timeline
            let whereCondition = {
                bet_number: periodId,
                timeline: timeline
            };
            
            console.log(`🔍 [BET_RETRIEVAL] Looking for bets with condition:`, whereCondition);
            
            // CRITICAL FIX: If no bets found with specific timeline, try without timeline filter
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
                    console.log(`🎯 [5D_BET_RETRIEVAL] Querying BetRecord5D with condition:`, whereCondition);
                    bets = await models.BetRecord5D.findAll({
                        where: whereCondition,
                        transaction: useTransaction
                    });
                    console.log(`🎯 [5D_BET_RETRIEVAL] Found ${bets.length} 5D bets with timeline filter`);
                    break;
                case 'k3':
                    bets = await models.BetRecordK3.findAll({
                        where: whereCondition,
                        transaction: useTransaction
                    });
                    break;
            }
            
            // If no bets found with timeline filter, try without timeline
            if (bets.length === 0) {
                console.log(`⚠️ [BET_PROCESSING_WARNING] No bets found with timeline ${timeline}, trying without timeline filter...`);
                whereCondition = {
                    bet_number: periodId
                };
                
                console.log(`🔍 [BET_RETRIEVAL_FALLBACK] Looking for bets with fallback condition:`, whereCondition);
                
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
                        console.log(`🎯 [5D_BET_RETRIEVAL_FALLBACK] Querying BetRecord5D with fallback condition:`, whereCondition);
                        bets = await models.BetRecord5D.findAll({
                            where: whereCondition,
                            transaction: useTransaction
                        });
                        console.log(`🎯 [5D_BET_RETRIEVAL_FALLBACK] Found ${bets.length} 5D bets without timeline filter`);
                        break;
                    case 'k3':
                        bets = await models.BetRecordK3.findAll({
                            where: whereCondition,
                            transaction: useTransaction
                        });
                        break;
                }
                
                if (bets.length > 0) {
                    console.log(`✅ [BET_PROCESSING_SUCCESS] Found ${bets.length} bets without timeline filter`);
                }
            }

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
            console.log(`🔍 [BET_STATUS_DEBUG] Bet details:`, bets.map(bet => ({
                betId: bet.bet_id || bet.id,
                userId: bet.user_id,
                status: bet.status,
                betType: bet.bet_type,
                betAmount: bet.bet_amount,
                timeline: bet.timeline
            })));
            
            if (bets.length === 0) {
                console.log(`⚠️ [BET_PROCESSING_WARNING] No bets found for ${gameType} ${periodId} ${timeline}`);
                console.log(`🔍 [BET_PROCESSING_DEBUG] Checking if bets exist in database...`);
                
                // Let's check if there are any bets at all for this period
                let allBets = [];
                switch (gameType.toLowerCase()) {
                    case 'wingo':
                        allBets = await models.BetRecordWingo.findAll({
                            where: { bet_number: periodId }
                        });
                        break;
                    case 'trx_wix':
                        allBets = await models.BetRecordTrxWix.findAll({
                            where: { bet_number: periodId }
                        });
                        break;
                    case 'fived':
                    case '5d':
                        allBets = await models.BetRecord5D.findAll({
                            where: { bet_number: periodId }
                        });
                        break;
                    case 'k3':
                        allBets = await models.BetRecordK3.findAll({
                            where: { bet_number: periodId }
                        });
                        break;
                }
                
                console.log(`🔍 [BET_PROCESSING_DEBUG] Total bets for period ${periodId}: ${allBets.length}`);
                console.log(`🔍 [BET_PROCESSING_DEBUG] All bet timelines:`, allBets.map(bet => ({
                    betId: bet.bet_id || bet.id,
                    timeline: bet.timeline,
                    status: bet.status
                })));
            }

            // Process each bet
            console.log(`🔄 [BET_PROCESSING_LOOP] Starting to process ${bets.length} bets...`);
            
            for (const bet of bets) {
                try {
                    console.log(`🔍 [BET_PROCESSING] Processing bet:`, {
                        betId: bet.bet_id || bet.id,
                        userId: bet.user_id,
                        currentStatus: bet.status,
                        betType: bet.bet_type,
                        betAmount: bet.bet_amount
                    });
                    
                    const isWinner = await checkBetWin(bet, result, gameType);
                    console.log(`🎯 [BET_WIN_CHECK] Bet ${bet.bet_id || bet.id} isWinner: ${isWinner}`);
                    
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
                        console.log(`🔍 [BET_STATUS_UPDATE] Updating bet ${bet.bet_id || bet.id} to 'won' with winnings ₹${winnings}`);
                        
                        // ADDITIONAL 5D LOGGING
                        if (['5d', 'fived'].includes(gameType.toLowerCase())) {
                            console.log(`🎯 [5D_BET_STATUS_UPDATE] About to update 5D bet ${bet.bet_id || bet.id} to 'won'`);
                            console.log(`🎯 [5D_BET_STATUS_UPDATE] Update data:`, {
                                status: 'won',
                                payout: winnings,
                                win_amount: winnings,
                                wallet_balance_after: parseFloat(bet.wallet_balance_before) + winnings,
                                hasTransaction: !!useTransaction
                            });
                        }
                        
                        await bet.update({
                            status: 'won',
                            payout: winnings,
                            win_amount: winnings,
                            wallet_balance_after: parseFloat(bet.wallet_balance_before) + winnings,
                            result: JSON.stringify(result)
                        }, { transaction: useTransaction });
                        
                        // Create transaction record for game win
                        const Transaction = require('../models/Transaction');
                        await Transaction.create({
                            user_id: bet.user_id,
                            type: 'game_win',
                            amount: winnings,
                            status: 'completed',
                            description: `${gameType.toUpperCase()} game win - ${bet.bet_type}`,
                            reference_id: `game_win_${bet.bet_id || bet.id}_${Date.now()}`,
                            game_id: bet.bet_id || bet.id,
                            game_type: gameType,
                            previous_balance: parseFloat(bet.wallet_balance_before),
                            new_balance: parseFloat(bet.wallet_balance_before) + winnings,
                            metadata: {
                                game_type: gameType,
                                bet_type: bet.bet_type,
                                bet_amount: bet.bet_amount,
                                period_id: periodId,
                                duration: duration,
                                timeline: timeline,
                                result: result,
                                processed_at: new Date().toISOString()
                            }
                        }, { transaction: useTransaction });
                        
                        console.log(`✅ [BET_STATUS_UPDATE] Bet ${bet.bet_id || bet.id} updated to 'won' successfully`);
                        
                        // ADDITIONAL 5D LOGGING
                        if (['5d', 'fived'].includes(gameType.toLowerCase())) {
                            console.log(`🎯 [5D_BET_STATUS_UPDATE] Successfully updated 5D bet ${bet.bet_id || bet.id} to 'won'`);
                        }

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
                        console.log(`🔍 [BET_STATUS_UPDATE] Updating bet ${bet.bet_id || bet.id} to 'lost'`);
                        
                        // ADDITIONAL 5D LOGGING
                        if (['5d', 'fived'].includes(gameType.toLowerCase())) {
                            console.log(`🎯 [5D_BET_STATUS_UPDATE] About to update 5D bet ${bet.bet_id || bet.id} to 'lost'`);
                            console.log(`🎯 [5D_BET_STATUS_UPDATE] Update data:`, {
                                status: 'lost',
                                payout: 0,
                                win_amount: 0,
                                wallet_balance_after: bet.wallet_balance_before,
                                hasTransaction: !!useTransaction
                            });
                        }
                        
                        await bet.update({
                            status: 'lost',
                            payout: 0,
                            win_amount: 0,
                            wallet_balance_after: bet.wallet_balance_before,
                            result: JSON.stringify(result)
                        }, { transaction: useTransaction });
                        
                        // Create transaction record for game loss
                        const Transaction = require('../models/Transaction');
                        await Transaction.create({
                            user_id: bet.user_id,
                            type: 'game_loss',
                            amount: parseFloat(bet.bet_amount),
                            status: 'completed',
                            description: `${gameType.toUpperCase()} game loss - ${bet.bet_type}`,
                            reference_id: `game_loss_${bet.bet_id || bet.id}_${Date.now()}`,
                            game_id: bet.bet_id || bet.id,
                            game_type: gameType,
                            previous_balance: parseFloat(bet.wallet_balance_before),
                            new_balance: parseFloat(bet.wallet_balance_before),
                            metadata: {
                                game_type: gameType,
                                bet_type: bet.bet_type,
                                bet_amount: bet.bet_amount,
                                period_id: periodId,
                                duration: duration,
                                timeline: timeline,
                                result: result,
                                processed_at: new Date().toISOString()
                            }
                        }, { transaction: useTransaction });
                        
                        // ADDITIONAL 5D LOGGING
                        if (['5d', 'fived'].includes(gameType.toLowerCase())) {
                            console.log(`🎯 [5D_BET_STATUS_UPDATE] Successfully updated 5D bet ${bet.bet_id || bet.id} to 'lost'`);
                        }
                        console.log(`✅ [BET_STATUS_UPDATE] Bet ${bet.bet_id || bet.id} updated to 'lost' successfully`);
                    }
                } catch (betError) {
                    console.error(`❌ Error processing bet ${bet.bet_id}:`, betError);
                    continue;
                }
            }

            if (shouldCommit && useTransaction) {
                console.log(`🔍 [BET_PROCESSING_COMMIT] Committing bet processing transaction...`);
                console.log(`🔍 [BET_PROCESSING_COMMIT_DEBUG] Transaction state before commit:`, {
                    hasTransaction: !!useTransaction,
                    transactionState: useTransaction?.finished ? 'finished' : 'active',
                    shouldCommit: shouldCommit
                });
                await useTransaction.commit();
                console.log(`✅ [BET_PROCESSING_COMMIT] Bet processing transaction committed successfully`);
            } else {
                console.log(`🔍 [BET_PROCESSING_COMMIT] Skipping commit (shouldCommit: ${shouldCommit}, hasTransaction: ${!!useTransaction})`);
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
            
            // ADDITIONAL 5D LOGGING
            if (['5d', 'fived'].includes(gameType.toLowerCase())) {
                console.log(`🎯 [5D_BET_PROCESSING_COMPLETE] 5D bet processing completed for period ${periodId}`);
                console.log(`🎯 [5D_BET_PROCESSING_SUMMARY] Summary:`, {
                    periodId: periodId,
                    totalBets: bets.length,
                    winningBets: winningBets.length,
                    losingBets: bets.length - winningBets.length,
                    timeline: timeline,
                    hasTransaction: !!useTransaction,
                    transactionCommitted: shouldCommit
                });
            }
            
            return winningBets;

        } catch (error) {
            if (shouldCommit && useTransaction) {
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
    const startTime = Date.now();
    const performanceMonitor = require('../scripts/monitor_performance');
    
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
            
            // FIXED: Calculate amount per value BEFORE tax deduction
            const grossAmountPerValue = grossBetAmount / sumValues.length;
            const platformFeePerValue = grossAmountPerValue * 0.02; // 2% platform fee
            const netAmountPerValue = grossAmountPerValue - platformFeePerValue;

            console.log(`🎲 [K3_MULTIPLE_SUM_DISTRIBUTION] Total gross amount: ₹${grossBetAmount}, Values: ${sumValues.length}`);
            console.log(`🎲 [K3_MULTIPLE_SUM_DISTRIBUTION] Per value: Gross ₹${grossAmountPerValue}, Net ₹${netAmountPerValue}`);

            // Validate minimum bet requirement for each value
            if (netAmountPerValue < 0.95) {
                console.log(`❌ [K3_MULTIPLE_SUM_MINIMUM_FAIL] Amount per value (₹${netAmountPerValue}) is below minimum (₹0.95)`);
                return {
                    success: false,
                    message: `Amount per value (₹${netAmountPerValue.toFixed(2)}) is below minimum requirement (₹0.95). Please increase total bet amount to at least ₹${(0.95 * sumValues.length / 0.98).toFixed(2)}`,
                    code: 'MINIMUM_BET_PER_VALUE',
                    breakdown: {
                        totalValues: sumValues.length,
                        grossAmountPerValue: grossAmountPerValue,
                        netAmountPerValue: netAmountPerValue,
                        minimumRequired: 0.95,
                        suggestedTotalAmount: (0.95 * sumValues.length / 0.98).toFixed(2)
                    }
                };
            }

            // Create individual bet records for each sum value
            const individualBets = [];
            for (const sumValue of sumValues) {
                const individualOdds = calculateOdds(gameType, 'SUM', sumValue);
                individualBets.push({
                    ...betData,
                    betType: 'SUM',
                    betValue: sumValue,
                    betAmount: grossAmountPerValue, // Use gross amount for individual bets
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

        // Handle TWO_DIFFERENT_MULTIPLE bets by creating individual bet records
        if (betType === 'TWO_DIFFERENT_MULTIPLE') {
            console.log(`🎲 [K3_MULTIPLE_TWO_DIFFERENT_PROCESSING] Processing TWO_DIFFERENT_MULTIPLE bet: ${betValue}`);

            // Parse pipe-separated combinations (e.g., "1,2|1,3|1,4|...")
            const combinations = betValue.split('|').map(combo => combo.trim());
            
            // FIXED: Calculate amount per combination BEFORE tax deduction
            const grossAmountPerCombination = grossBetAmount / combinations.length;
            const platformFeePerCombination = grossAmountPerCombination * 0.02; // 2% platform fee
            const netAmountPerCombination = grossAmountPerCombination - platformFeePerCombination;

            console.log(`🎲 [K3_MULTIPLE_TWO_DIFFERENT_DISTRIBUTION] Total gross amount: ₹${grossBetAmount}, Combinations: ${combinations.length}`);
            console.log(`🎲 [K3_MULTIPLE_TWO_DIFFERENT_DISTRIBUTION] Per combination: Gross ₹${grossAmountPerCombination}, Net ₹${netAmountPerCombination}`);
            console.log(`🎲 [K3_MULTIPLE_TWO_DIFFERENT_COMBINATIONS] Generated combinations: ${combinations.join(' | ')}`);

            // Validate minimum bet requirement for each combination
            if (netAmountPerCombination < 0.95) {
                console.log(`❌ [K3_MULTIPLE_TWO_DIFFERENT_MINIMUM_FAIL] Amount per combination (₹${netAmountPerCombination}) is below minimum (₹0.95)`);
                return {
                    success: false,
                    message: `Amount per combination (₹${netAmountPerCombination.toFixed(2)}) is below minimum requirement (₹0.95). Please increase total bet amount to at least ₹${(0.95 * combinations.length / 0.98).toFixed(2)}`,
                    code: 'MINIMUM_BET_PER_COMBINATION',
                    breakdown: {
                        totalCombinations: combinations.length,
                        grossAmountPerCombination: grossAmountPerCombination,
                        netAmountPerCombination: netAmountPerCombination,
                        minimumRequired: 0.95,
                        suggestedTotalAmount: (0.95 * combinations.length / 0.98).toFixed(2)
                    }
                };
            }

            // Create individual bet records for each combination
            const individualBets = [];
            for (const combination of combinations) {
                individualBets.push({
                    ...betData,
                    betType: 'TWO_DIFFERENT',
                    betValue: combination,
                    betAmount: grossAmountPerCombination, // Use gross amount for individual bets
                    odds: 6.91  // Correct odds for TWO_DIFFERENT (one pair)
                });
            }

            console.log(`🎲 [K3_MULTIPLE_TWO_DIFFERENT_CREATED] Created ${individualBets.length} individual bets:`, individualBets.map(bet => `${bet.betType}:${bet.betValue} (₹${bet.betAmount})`));

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
                message: allSuccessful ? 'Multiple two_different bets placed successfully' : 'Some bets failed',
                data: {
                    ...betData,
                    betType: 'TWO_DIFFERENT_MULTIPLE',
                    betValue: betValue,
                    expectedWin: totalExpectedWin,
                    individualBets: results.length,
                    originalSelection: betValue, // Keep original for frontend display
                    combinationsGenerated: combinations.length,
                    breakdown: results.map(r => r.data)
                }
            };
        }

        // Handle ALL_DIFFERENT_MULTIPLE bets by creating individual bet records
        if (betType === 'ALL_DIFFERENT_MULTIPLE') {
            console.log(`🎲 [K3_MULTIPLE_ALL_DIFFERENT_PROCESSING] Processing ALL_DIFFERENT_MULTIPLE bet: ${betValue}`);

            let combinations = [];
            
            // Generate combinations based on betValue
            if (betValue.includes(',')) {
                // Multiple numbers selected (e.g., "1,2,3,4,5,6")
                const numbers = betValue.split(',').map(n => parseInt(n.trim()));
                
                // Validate that all numbers are within K3 range (1-6)
                const invalidNumbers = numbers.filter(n => n < 1 || n > 6);
                if (invalidNumbers.length > 0) {
                    console.log(`❌ [K3_INVALID_NUMBERS] Invalid numbers detected: ${invalidNumbers.join(',')}. K3 only supports numbers 1-6.`);
                    return {
                        success: false,
                        message: `Invalid numbers detected: ${invalidNumbers.join(',')}. K3 only supports numbers 1-6.`,
                        code: 'INVALID_K3_NUMBERS',
                        breakdown: {
                            invalidNumbers: invalidNumbers,
                            validRange: '1-6',
                            receivedNumbers: numbers
                        }
                    };
                }
                
                combinations = generateAllDifferentCombinations(numbers);
            } else {
                // Single number selected (e.g., "1")
                const number = parseInt(betValue);
                
                // Validate that the number is within K3 range (1-6)
                if (number < 1 || number > 6) {
                    console.log(`❌ [K3_INVALID_NUMBER] Invalid number detected: ${number}. K3 only supports numbers 1-6.`);
                    return {
                        success: false,
                        message: `Invalid number detected: ${number}. K3 only supports numbers 1-6.`,
                        code: 'INVALID_K3_NUMBER',
                        breakdown: {
                            invalidNumber: number,
                            validRange: '1-6'
                        }
                    };
                }
                
                combinations = generateAllDifferentCombinationsWithNumber(number);
            }

            // FIXED: Calculate amount per combination BEFORE tax deduction
            // This ensures each individual bet meets minimum requirements
            const grossAmountPerCombination = grossBetAmount / combinations.length;
            const platformFeePerCombination = grossAmountPerCombination * 0.02; // 2% platform fee
            const netAmountPerCombination = grossAmountPerCombination - platformFeePerCombination;

            console.log(`🎲 [K3_MULTIPLE_ALL_DIFFERENT_DISTRIBUTION] Total gross amount: ₹${grossBetAmount}, Combinations: ${combinations.length}`);
            console.log(`🎲 [K3_MULTIPLE_ALL_DIFFERENT_DISTRIBUTION] Per combination: Gross ₹${grossAmountPerCombination}, Net ₹${netAmountPerCombination}`);
            console.log(`🎲 [K3_MULTIPLE_ALL_DIFFERENT_COMBINATIONS] Generated combinations: ${combinations.join(' | ')}`);

            // Validate minimum bet requirement for each combination
            if (netAmountPerCombination < 0.95) {
                console.log(`❌ [K3_MULTIPLE_ALL_DIFFERENT_MINIMUM_FAIL] Amount per combination (₹${netAmountPerCombination}) is below minimum (₹0.95)`);
                return {
                    success: false,
                    message: `Amount per combination (₹${netAmountPerCombination.toFixed(2)}) is below minimum requirement (₹0.95). Please increase total bet amount to at least ₹${(0.95 * combinations.length / 0.98).toFixed(2)}`,
                    code: 'MINIMUM_BET_PER_COMBINATION',
                    breakdown: {
                        totalCombinations: combinations.length,
                        grossAmountPerCombination: grossAmountPerCombination,
                        netAmountPerCombination: netAmountPerCombination,
                        minimumRequired: 0.95,
                        suggestedTotalAmount: (0.95 * combinations.length / 0.98).toFixed(2)
                    }
                };
            }

            // Create individual bet records for each combination
            const individualBets = [];
            for (const combination of combinations) {
                individualBets.push({
                    ...betData,
                    betType: 'ALL_DIFFERENT',
                    betValue: combination,
                    betAmount: grossAmountPerCombination, // Use gross amount for individual bets
                    odds: 34.56  // Correct odds for ALL_DIFFERENT
                });
            }

            console.log(`🎲 [K3_MULTIPLE_ALL_DIFFERENT_CREATED] Created ${individualBets.length} individual bets:`, individualBets.map(bet => `${bet.betType}:${bet.betValue} (₹${bet.betAmount})`));

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
                message: allSuccessful ? 'Multiple all_different bets placed successfully' : 'Some bets failed',
                data: {
                    ...betData,
                    betType: 'ALL_DIFFERENT_MULTIPLE',
                    betValue: betValue,
                    expectedWin: totalExpectedWin,
                    individualBets: results.length,
                    originalSelection: betValue, // Keep original for frontend display
                    combinationsGenerated: combinations.length,
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
                case '5d':
                case 'fived':
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

            // 🚀 OPTIMIZATION: Batch Redis operations for better performance
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

            // 🚀 OPTIMIZATION: Batch all post-bet operations for better performance
            const postBetOperations = async () => {
                try {
                    // Update total_bet_amount (critical - keep in main thread)
                    await models.User.increment('total_bet_amount', {
                        by: grossBetAmount,
                        where: { user_id: userId }
                    });
                    console.log(`💰 [BET_TOTAL_UPDATE] Updated total_bet_amount for user ${userId}: +₹${grossBetAmount}`);
                } catch (totalBetError) {
                    console.error('⚠️ Error updating total_bet_amount:', totalBetError);
                }

                // 🚀 OPTIMIZATION: Process non-critical operations asynchronously
                setImmediate(async () => {
                    try {
                        // Record VIP experience (non-critical)
                        await recordVipExperience(userId, grossBetAmount, gameType, betRecord.bet_id);
                    } catch (vipError) {
                        console.error('⚠️ Error recording VIP experience:', vipError);
                    }

                    try {
                        // Process self rebate (non-critical)
                        await processSelfRebate(userId, grossBetAmount, gameType, betRecord.bet_id);
                    } catch (rebateError) {
                        console.error('⚠️ Error processing self rebate:', rebateError);
                    }

                    try {
                        // Process activity reward (non-critical)
                        await processBetForActivityReward(userId, grossBetAmount, gameType);
                    } catch (activityError) {
                        console.error('⚠️ Error processing activity reward:', activityError);
                    }
                });
            };

            // Execute post-bet operations
            await postBetOperations();

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

            // 🚀 Record performance metrics
            performanceMonitor.recordBetProcessing(startTime, true);

            return response;

        } catch (error) {
            await t.rollback();
            throw error;
        }
    } catch (error) {
        console.error('❌ [BET_PROCESS] Error in processBet:', error);
        
        // 🚀 Record performance metrics for failed bet
        performanceMonitor.recordBetProcessing(startTime, false);
        
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
                                return 6.91;
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

                                case 'TWO_DIFFERENT':
                // TWO_DIFFERENT bets - always 6.91x
                return 6.91;

            case 'ALL_DIFFERENT':
                // ALL_DIFFERENT bets - always 34.56x
                return 34.56;

                    case 'PATTERN':
                        // Pattern bets with specific payouts
                        switch (betValue) {
                            case 'all_different':
                                return 34.56;
                            case 'straight':
                                return 8.64;
                            case 'two_different':
                                return 6.91;
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

        const redis = await getRedisHelper();
        if (!redis) {
            console.error('❌ Redis helper not available');
            throw new Error('Redis helper not available');
        }

        // Store result
        await redis.set(tempResultKey, JSON.stringify({
            result,
            timestamp: Date.now()
        }));

        // Set expiry for 1 hour
        await redis.expire(tempResultKey, 3600);

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
        const redis = await getRedisHelper();
        if (!redis) {
            console.error('❌ Redis helper not available');
            throw new Error('Redis helper not available');
        }
        const totalBetAmount = parseFloat(await redis.get(totalBetKey) || 0);

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
        const exposures = await redis.hgetall(exposureKey);

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
 * Pre-calculate 5D result at bet freeze (t = -5s) and store in Redis
 * This prevents the 1.5s delay at t=0 by calculating during the bet freeze period
 */
async function preCalculate5DResultAtFreeze(gameType, duration, periodId, timeline = 'default') {
    const lockKey = `precalc_lock_${gameType}_${duration}_${periodId}_${timeline}`;
    const resultKey = `precalc_result_${gameType}_${duration}_${periodId}_${timeline}`;
    
    try {
        console.log('🔄 [5D_PRECALC_FREEZE] Starting pre-calculation at bet freeze:', {
            gameType, duration, periodId, timeline
        });

        // Get Redis helper first
        const redis = await getRedisHelper();
        if (!redis) {
            console.error('❌ [5D_PRECALC_FREEZE] Redis helper not available');
            throw new Error('Redis helper not available');
        }

        // Check if already pre-calculated
        const existingResult = await redis.get(resultKey);
        if (existingResult) {
            console.log('✅ [5D_PRECALC_FREEZE] Result already pre-calculated');
            return JSON.parse(existingResult);
        }

        // Try to acquire lock to prevent double calculation
        const lockValue = `${Date.now()}_${process.pid}`;
        const lockAcquired = await redis.set(lockKey, lockValue, 'EX', 30, 'NX');
        
        if (!lockAcquired) {
            console.log('🔒 [5D_PRECALC_FREEZE] Another process is pre-calculating, skipping this instance');
            // NON-BLOCKING: Don't wait for lock, just skip this pre-calculation
            // The other process will handle the calculation
            return null;
        }

        console.log('🎯 [5D_PRECALC_FREEZE] Acquired lock, calculating result...');

        // Calculate result using FAST Redis-based protection logic with timeout
        const startTime = Date.now();
        
        // Add timeout to prevent hanging
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Pre-calculation timeout')), 5000); // 5 second timeout for full scan
        });
        
        const calculationPromise = getOptimal5DResultByExposureFast(duration, periodId, timeline);
        
        const result = await Promise.race([calculationPromise, timeoutPromise]);
        const calculationTime = Date.now() - startTime;
        
        console.log(`⚡ [5D_PRECALC_FREEZE] Fast calculation completed in ${calculationTime}ms`);
        
        if (!result) {
            throw new Error('Fast calculation returned null result');
        }

        console.log('✅ [5D_PRECALC_FREEZE] Result calculated successfully:', {
            result: result,
            protectionMode: 'fast_redis',
            protectionReason: 'Pre-calculated using Redis-cached combinations'
        });

        // Store result in Redis with 2-minute expiry (pure Redis solution)
        await redis.set(resultKey, JSON.stringify({
            result: result,
            protectionMode: 'fast_redis',
            protectionReason: 'Pre-calculated using Redis-cached combinations',
            calculatedAt: new Date().toISOString(),
            periodId: periodId
        }), 'EX', 120);

        console.log('💾 [5D_PRECALC_FREEZE] Result stored in Redis, ready for instant t=0 delivery');

        return {
            result: result,
            protectionMode: 'fast_redis',
            protectionReason: 'Pre-calculated using Redis-cached combinations'
        };

    } catch (error) {
        console.error('❌ [5D_PRECALC_FREEZE] Error pre-calculating result:', error.message);
        
        // Clean up lock on error
        try {
            await redis.del(lockKey);
        } catch (cleanupError) {
            console.error('❌ [5D_PRECALC_FREEZE] Error cleaning up lock:', cleanupError.message);
        }
        
        throw error;
    }
}

/**
 * Retrieve pre-calculated 5D result at t=0
 * This provides instant result delivery without calculation delay
 */
async function getPreCalculated5DResultAtZero(gameType, duration, periodId, timeline = 'default') {
    try {
        console.log('🎯 [5D_PRECALC_ZERO] Retrieving pre-calculated result at t=0:', {
            gameType, duration, periodId, timeline
        });

        // 🚀 CRITICAL FIX: For 5D games, ALWAYS check database first since scheduler stores results there
        if (['5d', 'fived'].includes(gameType.toLowerCase())) {
            console.log(`🔍 [5D_PRECALC_ZERO] Checking database for 5D result first...`);
            
            try {
                // Import models using the proper initialization function
                const models = await ensureModelsInitialized();
                
                // Check database for existing result
                const dbResult = await models.BetResult5D.findOne({
                    where: {
                        bet_number: periodId,
                        duration: duration,
                        timeline: timeline
                    }
                });
                
                if (dbResult) {
                    console.log(`✅ [5D_PRECALC_ZERO] Found 5D result in database for period ${periodId}`);
                    
                    // Convert database result to expected format
                    const result = {
                        A: dbResult.result_a,
                        B: dbResult.result_b,
                        C: dbResult.result_c,
                        D: dbResult.result_d,
                        E: dbResult.result_e,
                        sum: dbResult.total_sum,
                        sum_size: dbResult.total_sum < 22 ? 'small' : 'big',
                        sum_parity: dbResult.total_sum % 2 === 0 ? 'even' : 'odd',
                        exposure: 0, // Database doesn't store exposure
                        method: 'database_stored',
                        source: 'database'
                    };
                    
                    console.log('✅ [5D_PRECALC_ZERO] Retrieved 5D result from database:', result);
                    
                    return {
                        result: result,
                        protectionMode: false,
                        protectionReason: 'DATABASE_STORED',
                        source: 'pre_calculated'
                    };
                } else {
                    console.log(`⚠️ [5D_PRECALC_ZERO] No 5D result found in database for period ${periodId}`);
                }
            } catch (dbError) {
                console.error(`❌ [5D_PRECALC_ZERO] Error checking database:`, dbError.message);
            }
        }
        
        // Fallback to Redis check (for backward compatibility)
        const resultKey = `precalc_result_${gameType}_${duration}_${periodId}_${timeline}`;
        console.log(`🔍 [5D_PRECALC_ZERO] Checking Redis for pre-calculated result with key: ${resultKey}`);

        // Get Redis helper first
        const redis = await getRedisHelper();
        if (!redis) {
            console.error('❌ [5D_PRECALC_ZERO] Redis helper not available');
            return null;
        }

        const storedData = await redis.get(resultKey);
        
        if (!storedData) {
            console.log('⚠️ [5D_PRECALC_ZERO] No pre-calculated result found in Redis, falling back to real-time calculation');
            return null; // Will trigger fallback to real-time calculation
        }

        const parsedData = JSON.parse(storedData);
        console.log('✅ [5D_PRECALC_ZERO] Retrieved pre-calculated result from Redis:', {
            result: parsedData.result,
            protectionMode: parsedData.protectionMode,
            calculatedAt: parsedData.calculatedAt
        });

        // Clean up the stored result
        await redis.del(resultKey);
        console.log('🧹 [5D_PRECALC_ZERO] Cleaned up stored result from Redis');

        return {
            result: parsedData.result,
            protectionMode: parsedData.protectionMode,
            protectionReason: parsedData.protectionReason,
            source: 'pre_calculated'
        };

    } catch (error) {
        console.error('❌ [5D_PRECALC_ZERO] Error retrieving pre-calculated result:', error.message);
        return null; // Will trigger fallback
    }
}

/**
 * Pure Redis-based instant result delivery for 5D
 * This uses pre-calculated results from Redis for instant delivery
 */
async function processGameResultsWithPreCalc(gameType, duration, periodId, timeline = 'default', transaction = null) {
    console.log('🎯 [PROCESS_GAME_RESULTS_WITH_PRE_CALC] Function called with:', {
        gameType: gameType,
        duration: duration,
        periodId: periodId,
        timeline: timeline,
        hasTransaction: !!transaction
    });
    
    // For 5D games, try to use pre-calculated result first
    if (['5d', 'fived'].includes(gameType.toLowerCase())) {
        console.log('🎯 [5D_PROCESS] Attempting to use pre-calculated result for 5D');
        
        console.log('🔍 [5D_PROCESS] Calling getPreCalculated5DResultAtZero...');
        const preCalcResult = await getPreCalculated5DResultAtZero(gameType, duration, periodId, timeline);
        console.log('🔍 [5D_PROCESS] getPreCalculated5DResultAtZero returned:', {
            hasResult: !!preCalcResult,
            resultKeys: preCalcResult ? Object.keys(preCalcResult) : [],
            result: preCalcResult?.result
        });
        
        if (preCalcResult) {
            console.log('⚡ [5D_PROCESS] Using pre-calculated result for instant delivery!');
            
            const result = preCalcResult.result;
            
            // Process database operations synchronously to ensure bet processing happens
            console.log('🔄 [5D_PROCESS] Processing database operations synchronously...');
            
            try {
                // Save result to database
                const models = await ensureModelsInitialized();
                const db = await ensureDatabaseInitialized();
                const bgTransaction = await db.transaction();
                
                // Check if result already exists
                console.log('🔍 [5D_PROCESS] Checking for existing result in database...');
                const existingResult = await models.BetResult5D.findOne({
                    where: { bet_number: periodId }
                });
                
                if (!existingResult) {
                    console.log('💾 [5D_PROCESS] Saving result to database...');
                    await models.BetResult5D.create({
                        bet_number: periodId,
                        result_a: result.A,
                        result_b: result.B,
                        result_c: result.C,
                        result_d: result.D,
                        result_e: result.E,
                        total_sum: result.sum,
                        created_at: new Date(),
                        updated_at: new Date()
                    }, { transaction: bgTransaction });
                    console.log('✅ [5D_PROCESS] Result saved to database');
                } else {
                    console.log('✅ [5D_PROCESS] Result already exists in database');
                    // 🚀 CRITICAL FIX: Use existing result instead of creating new one
                    console.log('🔄 [5D_PROCESS] Using existing result for consistency:', {
                        existingResult: {
                            A: existingResult.result_a,
                            B: existingResult.result_b,
                            C: existingResult.result_c,
                            D: existingResult.result_d,
                            E: existingResult.result_e,
                            sum: existingResult.total_sum
                        },
                        newResult: result
                    });
                    
                    // 🚨 IMPORTANT: Override the result with existing one to ensure consistency
                    result = {
                        A: existingResult.result_a,
                        B: existingResult.result_b,
                        C: existingResult.result_c,
                        D: existingResult.result_d,
                        E: existingResult.result_e,
                        sum: existingResult.total_sum,
                        sum_size: existingResult.total_sum < 22 ? 'small' : 'big',
                        sum_parity: existingResult.total_sum % 2 === 0 ? 'even' : 'odd'
                    };
                    
                    console.log('🔄 [5D_PROCESS] Result overridden with existing database result for consistency');
                }
                
                // Process winning bets synchronously using proper transaction flow
                console.log('🔥 [5D_PROCESS] About to process winning bets synchronously...');
                
                // Create separate bet processing transaction like other games
                const betProcessingTransaction = await db.transaction();
                console.log('🔍 [5D_PROCESS] Created separate bet processing transaction');
                
                let winners = []; // Declare winners outside try block
                
                try {
                    winners = await processWinningBetsWithTimeline(gameType, duration, periodId, timeline, result, betProcessingTransaction);
                    
                    // Log winners like K3 does
                    console.log('🏆 [5D_PROCESS_WINNERS] Winners processed:', {
                        winnerCount: winners.length,
                        winners: winners.map(w => ({ userId: w.userId, winnings: w.winnings }))
                    });
                    
                    // Cleanup like K3 does
                    console.log('🔄 [5D_PROCESS_CLEANUP] Resetting period exposure...');
                    try {
                        await resetPeriodExposure(gameType, duration, periodId);
                        console.log('✅ [5D_PROCESS_CLEANUP] Period exposure reset successfully');
                    } catch (cleanupError) {
                        console.error('❌ [5D_PROCESS_CLEANUP] Error resetting period exposure:', cleanupError);
                        // Don't throw here - this is cleanup and shouldn't fail the entire process
                    }
                    
                    // Commit bet processing transaction
                    await betProcessingTransaction.commit();
                    console.log('✅ [5D_PROCESS] Bet processing transaction committed successfully');
                    
                    // CRITICAL FIX: Ensure bet processing actually happened
                    console.log('🔍 [5D_PROCESS] Verifying bet processing...');
                    const processedBets = await models.BetRecord5D.findAll({
                        where: {
                            bet_number: periodId,
                            status: ['won', 'lost']
                        }
                    });
                    console.log(`🔍 [5D_PROCESS] Found ${processedBets.length} processed bets for period ${periodId}`);
                    
                } catch (betProcessingError) {
                    console.error('❌ [5D_PROCESS] Bet processing failed:', betProcessingError.message);
                    await betProcessingTransaction.rollback();
                    throw betProcessingError;
                }
                
                await bgTransaction.commit();
                
                console.log('✅ [5D_PROCESS] Database operations completed with winners:', winners.length);

                // REMOVED: Duplicate broadcasting - scheduler handles this via Redis Pub/Sub
                // await broadcastGameResult(gameType, duration, periodId, result, timeline);

                return {
                    success: true,
                    result: result,
                    gameResult: result,
                    winners: winners, // Now populated with actual winners
                    timeline: timeline,
                    source: 'pre_calculated_instant'
                };
            } catch (bgError) {
                console.error('❌ [5D_PROCESS] Database operations failed:', bgError.message);
                throw bgError; // Re-throw to be handled by scheduler
            }
            
        } else {
            console.log('⚠️ [5D_PROCESS] No pre-calculated result available, falling back to real-time calculation');
        }
    }

    // CRITICAL FIX: Always ensure bet processing happens for 5D games
    if (['5d', 'fived'].includes(gameType.toLowerCase())) {
        console.log('🔄 [5D_PROCESS] Ensuring bet processing for 5D game...');
        
        // Try to get existing result first
        const models = await ensureModelsInitialized();
        const existingResult = await models.BetResult5D.findOne({
            where: { bet_number: periodId }
        });
        
        if (existingResult) {
            console.log('🔄 [5D_PROCESS] Found existing result, checking if bets already processed...');
            
            // CRITICAL FIX: Check if bets have already been processed by parallel system
            const processedBets = await models.BetRecord5D.findAll({
                where: {
                    bet_number: periodId,
                    status: ['won', 'lost'] // Already processed bets
                },
                limit: 1 // Just check if any exist
            });
            
            if (processedBets.length > 0) {
                console.log('🚫 [5D_PROCESS] Bets already processed by parallel system, skipping reprocessing');
                console.log('🚫 [5D_PROCESS] Preventing double processing and override issue');
                
                return {
                    success: true,
                    result: {
                        A: existingResult.result_a,
                        B: existingResult.result_b,
                        C: existingResult.result_c,
                        D: existingResult.result_d,
                        E: existingResult.result_e,
                        sum: existingResult.total_sum
                    },
                    gameResult: {
                        A: existingResult.result_a,
                        B: existingResult.result_b,
                        C: existingResult.result_c,
                        D: existingResult.result_d,
                        E: existingResult.result_e,
                        sum: existingResult.total_sum
                    },
                    winners: [], // Don't reprocess - already done by parallel system
                    timeline: timeline,
                    source: 'existing_result_skipped_reprocessing'
                };
            } else {
                console.log('🔄 [5D_PROCESS] No processed bets found, proceeding with bet processing...');
                const result = {
                    A: existingResult.result_a,
                    B: existingResult.result_b,
                    C: existingResult.result_c,
                    D: existingResult.result_d,
                    E: existingResult.result_e,
                    sum: existingResult.total_sum,
                    sum_size: existingResult.total_sum >= 22 ? 'big' : 'small',
                    sum_parity: existingResult.total_sum % 2 === 0 ? 'even' : 'odd'
                };
                
                const winners = await processWinningBetsWithTimeline(gameType, duration, periodId, timeline, result, transaction);
                
                // REMOVED: Duplicate broadcasting - scheduler handles this via Redis Pub/Sub
                // await broadcastGameResult(gameType, duration, periodId, result, timeline);
                
                return {
                    success: true,
                    result: result,
                    gameResult: result,
                    winners: winners,
                    timeline: timeline,
                    source: 'existing_result_processed'
                };
            }
        }
    }

    // Fallback to original processGameResults for non-5D games or when pre-calc fails
    console.log('🔄 [5D_PROCESS] Falling back to real-time result calculation');
    return await processGameResults(gameType, duration, periodId, timeline, transaction);
}




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


    generateVerificationHash,
    generateVerificationLink,
    enhanceResultFormat,

    //User threshold
    selectProtectedResultWithExposure,
    selectFallbackResult,

    //constants
    PLATFORM_FEE_RATE,
    ENHANCED_USER_THRESHOLD,
    getUserThreshold,

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

    // 5D Redis-based fast protection system
    preload5DCombinationsToRedis,
    get5DCombinationFromRedis,
    getAll5DCombinationsFromRedis,
    calculate5DExposureFast,
    getOptimal5DResultByExposureFast,
    autoInitialize5DCache,
    preCalculate5DResultAtFreeze,
    getPreCalculated5DResultAtZero,
    processGameResultsWithPreCalc,

    // Model management
    ensureModelsInitialized,
    get models() {
        if (!serviceModels) {
            throw new Error('Models not initialized. Call ensureModelsInitialized() first.');
        }
        return serviceModels;
    }
};