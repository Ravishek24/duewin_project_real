// Backend/services/gameLogicService.js
const { sequelize, DataTypes } = require('../config/db');
const redisClient = require('../config/redis');
const periodService = require('./periodService');
const tronHashService = require('./tronHashService');
const winston = require('winston');
const path = require('path');
const logger = require('../utils/logger');
const crypto = require('crypto');

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
            'User'
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
 * Start real-time optimization for a period
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 * @param {string} periodId - Period ID
 */
const startRealTimeOptimization = async (gameType, duration, periodId) => {
    try {
        const durationKey = duration === 30 ? '30s' :
            duration === 60 ? '1m' :
                duration === 180 ? '3m' :
                    duration === 300 ? '5m' : '10m';

        logger.info('Starting real-time optimization', {
            gameType,
            duration,
            periodId
        });

        // Initialize all possible combinations tracking
        await initializeCombinationTracking(gameType, duration, periodId);

        // Start high-frequency optimization loop (every 5 seconds)
        const optimizationInterval = setInterval(async () => {
            try {
                await performRealTimeOptimization(gameType, duration, periodId);
            } catch (error) {
                logger.error('Error in optimization loop', {
                    error: error.message,
                    gameType,
                    periodId
                });
            }
        }, 5000); // 5-second intervals for high frequency

        // Store interval ID for cleanup
        await redisClient.set(
            `${gameType}:${durationKey}:${periodId}:optimization_interval`,
            optimizationInterval.toString(),
            'EX', duration + 10 // Expire slightly after period ends
        );

        logger.info('Real-time optimization started', {
            gameType,
            periodId,
            interval: '5 seconds'
        });

    } catch (error) {
        logger.error('Error starting real-time optimization', {
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
 * Preload frequently used combinations for popular games
 * @param {Array} gameTypes - Array of game types to preload
 */
const preloadCommonCombinations = async (gameTypes = ['wingo', 'trx_wix', 'k3', 'fiveD']) => {
    try {
        logger.info('Preloading common combinations', { gameTypes });

        for (const gameType of gameTypes) {
            try {
                await getPreCalculatedCombinations(gameType);
                logger.info('Preloaded combinations', { gameType });
            } catch (gameError) {
                logger.warn('Failed to preload combinations', {
                    gameType,
                    error: gameError.message
                });
            }
        }

        logger.info('Common combinations preloading completed');

    } catch (error) {
        logger.error('Error preloading combinations', {
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

/**
 * Process all combinations with exact calculation (Low Volume: ≤50 bets)
 * @param {Object} tracking - Tracking data
 * @param {string} gameType - Game type
 * @param {string} durationKey - Duration key
 * @param {string} periodId - Period ID
 * @param {number} currentTotalBets - Current total bet amount
 */
const processAllCombinationsExact = async (tracking, gameType, durationKey, periodId, currentTotalBets) => {
    try {
        logger.info('Processing with exact calculation (low volume)', {
            gameType,
            periodId,
            combinationCount: tracking.combinations.length
        });

        for (const combination of tracking.combinations) {
            try {
                // Use original exact calculation
                const expectedPayout = await calculateExpectedPayout(gameType, durationKey, periodId, combination.result);

                // Update combination data
                combination.currentPayout = expectedPayout;
                combination.payoutRatio = currentTotalBets > 0 ? expectedPayout / currentTotalBets : 0;
                combination.isValid = combination.payoutRatio <= 0.60;
                combination.lastUpdated = Date.now();

            } catch (combError) {
                logger.warn('Error updating combination (exact)', {
                    error: combError.message
                });
                combination.isValid = false;
            }
        }

    } catch (error) {
        logger.error('Error in exact processing', {
            error: error.message,
            gameType,
            periodId
        });
    }
};

/**
 * Process combinations with sampling (Medium Volume: 51-200 bets)
 * @param {Object} tracking - Tracking data
 * @param {string} gameType - Game type
 * @param {string} durationKey - Duration key
 * @param {string} periodId - Period ID
 * @param {number} currentTotalBets - Current total bet amount
 */
const processCombinationsWithSampling = async (tracking, gameType, durationKey, periodId, currentTotalBets) => {
    try {
        logger.info('Processing with sampling (medium volume)', {
            gameType,
            periodId,
            combinationCount: tracking.combinations.length
        });

        // Process top priority combinations with exact calculation
        const priorityCombinations = tracking.combinations
            .sort((a, b) => a.currentPayout - b.currentPayout)
            .slice(0, 20); // Top 20 lowest payout combinations

        // Process priority combinations exactly
        for (const combination of priorityCombinations) {
            try {
                const expectedPayout = await calculateExpectedPayout(gameType, durationKey, periodId, combination.result);
                combination.currentPayout = expectedPayout;
                combination.payoutRatio = currentTotalBets > 0 ? expectedPayout / currentTotalBets : 0;
                combination.isValid = combination.payoutRatio <= 0.60;
                combination.lastUpdated = Date.now();
                combination.calculationMethod = 'exact';

            } catch (combError) {
                combination.isValid = false;
                combination.calculationMethod = 'error';
            }
        }

        // Process remaining combinations with sampling
        const remainingCombinations = tracking.combinations.filter(c =>
            !priorityCombinations.includes(c)
        );

        for (const combination of remainingCombinations) {
            try {
                // Use optimized (sampled) calculation
                const expectedPayout = await getOptimizedPayout(gameType, durationKey, periodId, combination.result);
                combination.currentPayout = expectedPayout;
                combination.payoutRatio = currentTotalBets > 0 ? expectedPayout / currentTotalBets : 0;
                combination.isValid = combination.payoutRatio <= 0.60;
                combination.lastUpdated = Date.now();
                combination.calculationMethod = 'sampled';

            } catch (combError) {
                combination.isValid = false;
                combination.calculationMethod = 'error';
            }
        }

    } catch (error) {
        logger.error('Error in sampled processing', {
            error: error.message,
            gameType,
            periodId
        });
    }
};



/**
 * Adaptive optimization frequency based on betting activity
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 * @param {string} periodId - Period ID
 */
const startAdaptiveOptimization = async (gameType, duration, periodId) => {
    try {
        const durationKey = duration === 30 ? '30s' :
            duration === 60 ? '1m' :
                duration === 180 ? '3m' :
                    duration === 300 ? '5m' : '10m';

        logger.info('Starting adaptive optimization', {
            gameType,
            duration,
            periodId
        });

        let currentInterval = 5000; // Start with 5 seconds
        let lastBetCount = 0;
        let optimizationsSinceLastChange = 0;

        const adaptiveOptimization = async () => {
            try {
                // Get current bet count
                const betKeys = await redisClient.keys(`${gameType}:${durationKey}:${periodId}:*`);
                const currentBetCount = betKeys.length;
                const betIncrease = currentBetCount - lastBetCount;

                // Calculate time remaining
                const periodEndTime = calculatePeriodEndTime(periodId, duration);
                const timeRemaining = (periodEndTime - new Date()) / 1000;

                // Stop if period is ending
                if (timeRemaining <= 0) {
                    clearInterval(intervalId);
                    return;
                }

                // Adaptive frequency logic
                let newInterval = currentInterval;

                if (timeRemaining < 30) {
                    // Last 30 seconds: Every 2 seconds
                    newInterval = 2000;
                } else if (betIncrease > 20) {
                    // High activity: Increase frequency
                    newInterval = Math.max(2000, currentInterval * 0.7);
                } else if (betIncrease < 2 && optimizationsSinceLastChange > 3) {
                    // Low activity: Decrease frequency
                    newInterval = Math.min(15000, currentInterval * 1.5);
                } else if (currentBetCount > 500) {
                    // Very high volume: Reduce frequency to save resources
                    newInterval = Math.max(10000, currentInterval);
                }

                // Perform optimization
                await performRealTimeOptimization(gameType, duration, periodId);

                // Update interval if needed
                if (newInterval !== currentInterval) {
                    clearInterval(intervalId);
                    currentInterval = newInterval;
                    optimizationsSinceLastChange = 0;

                    logger.info('Optimization frequency adapted', {
                        gameType,
                        periodId,
                        oldInterval: currentInterval,
                        newInterval,
                        betCount: currentBetCount,
                        betIncrease,
                        timeRemaining
                    });

                    // Restart with new interval
                    intervalId = setInterval(adaptiveOptimization, newInterval);
                } else {
                    optimizationsSinceLastChange++;
                }

                lastBetCount = currentBetCount;

            } catch (error) {
                logger.error('Error in adaptive optimization', {
                    error: error.message,
                    gameType,
                    periodId
                });
            }
        };

        // Start the adaptive interval
        let intervalId = setInterval(adaptiveOptimization, currentInterval);

        // Store interval ID for cleanup
        await redisClient.set(
            `${gameType}:${durationKey}:${periodId}:adaptive_interval`,
            intervalId.toString(),
            'EX', duration + 10
        );

        logger.info('Adaptive optimization started', {
            gameType,
            periodId,
            initialInterval: currentInterval
        });

    } catch (error) {
        logger.error('Error starting adaptive optimization', {
            error: error.message,
            stack: error.stack,
            gameType,
            periodId
        });
    }
};

/**
 * Performance monitoring for optimization system
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 * @param {string} periodId - Period ID
 * @returns {Object} - Performance metrics
 */
const getOptimizationPerformanceMetrics = async (gameType, duration, periodId) => {
    try {
        const durationKey = duration === 30 ? '30s' :
            duration === 60 ? '1m' :
                duration === 180 ? '3m' :
                    duration === 300 ? '5m' : '10m';

        // Get tracking data
        const trackingKey = `${gameType}:${durationKey}:${periodId}:tracking`;
        const fallbackKey = `${gameType}:${durationKey}:${periodId}:fallbacks`;

        const trackingData = await redisClient.get(trackingKey);
        const fallbackData = await redisClient.get(fallbackKey);

        if (!trackingData || !fallbackData) {
            return {
                available: false,
                message: 'Insufficient data for performance metrics'
            };
        }

        const tracking = JSON.parse(trackingData);
        const fallbacks = JSON.parse(fallbackData);

        // Calculate metrics
        const now = Date.now();
        const timeSinceLastOptimization = now - tracking.lastOptimization;
        const calculationMethods = {};

        // Count calculation methods used
        tracking.combinations.forEach(combo => {
            const method = combo.calculationMethod || 'unknown';
            calculationMethods[method] = (calculationMethods[method] || 0) + 1;
        });

        const metrics = {
            available: true,
            periodId,
            gameType,
            duration,
            betCount: fallbacks.betCount || 0,
            totalBetAmount: fallbacks.totalBets || 0,
            totalCombinations: tracking.combinations.length,
            validCombinations: tracking.combinations.filter(c => c.isValid).length,
            invalidCombinations: tracking.combinations.filter(c => !c.isValid).length,
            optimizationMethod: fallbacks.optimizationMethod || 'unknown',
            timeSinceLastOptimization,
            calculationMethods,
            performanceLevel: getPerformanceLevel(fallbacks.betCount),
            payoutRatio: fallbacks.lowestPayout?.payoutRatio || null,
            is60_40Compliant: (fallbacks.lowestPayout?.payoutRatio || 0) <= 0.60,
            lastOptimization: new Date(tracking.lastOptimization).toISOString(),
            cacheHitRate: getCacheHitRate(),
            memoryUsage: getMemoryUsage()
        };

        return metrics;

    } catch (error) {
        logger.error('Error getting performance metrics', {
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
 * Get cache hit rate from performance cache
 * @returns {number} - Cache hit rate percentage
 */
const getCacheHitRate = () => {
    try {
        const totalRequests = PerformanceCache.payoutCache.size + PerformanceCache.combinationCache.size;
        if (totalRequests === 0) return 0;

        // Estimate hit rate based on cache usage
        const cacheUtilization = Math.min(100, (totalRequests / 150) * 100); // Assume max 150 requests
        return Math.round(cacheUtilization);
    } catch (error) {
        return 0;
    }
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
 * Process combinations with approximation (High Volume: >200 bets)
 * @param {Object} tracking - Tracking data
 * @param {string} gameType - Game type
 * @param {string} durationKey - Duration key
 * @param {string} periodId - Period ID
 * @param {number} currentTotalBets - Current total bet amount
 */
const processCombinationsWithApproximation = async (tracking, gameType, durationKey, periodId, currentTotalBets) => {
    try {
        logger.info('Processing with approximation (high volume)', {
            gameType,
            periodId,
            combinationCount: tracking.combinations.length
        });

        // Get betting pattern for approximation
        const betPattern = await getBetPattern(gameType, durationKey, periodId);

        if (!betPattern) {
            // Fallback to sampling if pattern analysis fails
            return await processCombinationsWithSampling(tracking, gameType, durationKey, periodId, currentTotalBets);
        }

        // Process top 10 combinations with exact calculation
        const topCombinations = tracking.combinations
            .sort((a, b) => a.currentPayout - b.currentPayout)
            .slice(0, 10);

        for (const combination of topCombinations) {
            try {
                const expectedPayout = await calculateExpectedPayout(gameType, durationKey, periodId, combination.result);
                combination.currentPayout = expectedPayout;
                combination.payoutRatio = currentTotalBets > 0 ? expectedPayout / currentTotalBets : 0;
                combination.isValid = combination.payoutRatio <= 0.60;
                combination.lastUpdated = Date.now();
                combination.calculationMethod = 'exact';

            } catch (combError) {
                combination.isValid = false;
                combination.calculationMethod = 'error';
            }
        }

        // Process next 30 combinations with sampling
        const sampledCombinations = tracking.combinations.slice(10, 40);

        for (const combination of sampledCombinations) {
            try {
                const expectedPayout = await getOptimizedPayout(gameType, durationKey, periodId, combination.result);
                combination.currentPayout = expectedPayout;
                combination.payoutRatio = currentTotalBets > 0 ? expectedPayout / currentTotalBets : 0;
                combination.isValid = combination.payoutRatio <= 0.60;
                combination.lastUpdated = Date.now();
                combination.calculationMethod = 'sampled';

            } catch (combError) {
                combination.isValid = false;
                combination.calculationMethod = 'error';
            }
        }

        // Process remaining combinations with approximation
        const approximatedCombinations = tracking.combinations.slice(40);

        for (const combination of approximatedCombinations) {
            try {
                let approximatedPayout = 0;

                // Use game-specific approximation
                switch (gameType.toLowerCase()) {
                    case 'wingo':
                    case 'trx_wix':
                        approximatedPayout = approximateWingoPayout(combination.result, betPattern);
                        break;
                    case 'k3':
                        approximatedPayout = approximateK3Payout(combination.result, betPattern);
                        break;
                    case 'fived':
                    case '5d':
                        approximatedPayout = approximate5DPayout(combination.result, betPattern);
                        break;
                }

                combination.currentPayout = approximatedPayout;
                combination.payoutRatio = currentTotalBets > 0 ? approximatedPayout / currentTotalBets : 0;
                combination.isValid = combination.payoutRatio <= 0.60;
                combination.lastUpdated = Date.now();
                combination.calculationMethod = 'approximated';

            } catch (combError) {
                combination.isValid = false;
                combination.calculationMethod = 'error';
            }
        }

        logger.info('High-volume approximation completed', {
            gameType,
            periodId,
            exactCalculations: 10,
            sampledCalculations: Math.min(30, sampledCombinations.length),
            approximatedCalculations: approximatedCombinations.length
        });

    } catch (error) {
        logger.error('Error in approximated processing', {
            error: error.message,
            gameType,
            periodId
        });
        // Ultimate fallback to sampling
        await processCombinationsWithSampling(tracking, gameType, durationKey, periodId, currentTotalBets);
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
 * Optimized payout calculation with intelligent sampling
 * @param {string} gameType - Game type
 * @param {string} durationKey - Duration key
 * @param {string} periodId - Period ID
 * @param {Object} result - Result to calculate payout for
 * @returns {Promise<number>} - Expected payout
 */
const getOptimizedPayout = async (gameType, durationKey, periodId, result) => {
    try {
        const cacheKey = `payout_${gameType}_${periodId}_${JSON.stringify(result)}`;
        const cached = PerformanceCache.payoutCache.get(cacheKey);

        // Check cache validity
        if (cached && (Date.now() - cached.timestamp) < PerformanceCache.cacheExpiry.payouts) {
            return cached.payout;
        }

        // Get bet count for this period
        const betKeys = await redisClient.keys(`${gameType}:${durationKey}:${periodId}:*`);
        const betCount = betKeys.length;

        let payout;

        if (betCount === 0) {
            payout = 0;
        } else if (betCount <= 50) {
            // Low volume: Calculate exactly
            payout = await calculateExpectedPayout(gameType, durationKey, periodId, result);
        } else if (betCount <= 200) {
            // Medium volume: Use sampling
            payout = await calculateSampledPayout(gameType, durationKey, periodId, result, 0.7); // 70% sample
        } else {
            // High volume: Use aggressive sampling + approximation
            payout = await calculateApproximatedPayout(gameType, durationKey, periodId, result);
        }

        // Cache the result
        PerformanceCache.payoutCache.set(cacheKey, {
            payout,
            timestamp: Date.now(),
            betCount
        });

        // Limit cache size
        if (PerformanceCache.payoutCache.size > 100) {
            const oldestKey = PerformanceCache.payoutCache.keys().next().value;
            PerformanceCache.payoutCache.delete(oldestKey);
        }

        return payout;

    } catch (error) {
        logger.error('Error getting optimized payout', {
            error: error.message,
            gameType,
            periodId
        });
        return 0;
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
 * Calculate approximate payout for high volume using pattern analysis
 * @param {string} gameType - Game type
 * @param {string} durationKey - Duration key
 * @param {string} periodId - Period ID
 * @param {Object} result - Result to calculate for
 * @returns {Promise<number>} - Approximated payout
 */
const calculateApproximatedPayout = async (gameType, durationKey, periodId, result) => {
    try {
        // Get bet pattern from cache or calculate
        const pattern = await getBetPattern(gameType, durationKey, periodId);

        if (!pattern) {
            // Fallback to sampled calculation
            return await calculateSampledPayout(gameType, durationKey, periodId, result, 0.3);
        }

        // Use pattern-based approximation
        let approximatedPayout = 0;

        switch (gameType.toLowerCase()) {
            case 'wingo':
            case 'trx_wix':
                approximatedPayout = approximateWingoPayout(result, pattern);
                break;
            case 'k3':
                approximatedPayout = approximateK3Payout(result, pattern);
                break;
            case 'fived':
            case '5d':
                approximatedPayout = approximate5DPayout(result, pattern);
                break;
        }

        logger.info('Approximated payout calculation', {
            gameType,
            periodId,
            approximatedPayout,
            patternBased: true
        });

        return approximatedPayout;

    } catch (error) {
        logger.error('Error in approximated payout calculation', {
            error: error.message,
            gameType,
            periodId
        });
        // Ultimate fallback
        return await calculateSampledPayout(gameType, durationKey, periodId, result, 0.2);
    }
};

/**
 * Analyze betting patterns for approximation algorithms
 * @param {string} gameType - Game type
 * @param {string} durationKey - Duration key
 * @param {string} periodId - Period ID
 * @returns {Promise<Object>} - Betting pattern analysis
 */
const getBetPattern = async (gameType, durationKey, periodId) => {
    try {
        const cacheKey = `pattern_${gameType}_${periodId}`;
        const cached = PerformanceCache.patternCache.get(cacheKey);

        if (cached && (Date.now() - cached.timestamp) < PerformanceCache.cacheExpiry.patterns) {
            return cached.pattern;
        }

        // Analyze current betting patterns
        const betKeys = await redisClient.keys(`${gameType}:${durationKey}:${periodId}:*`);

        // Sample for pattern analysis (max 100 bets)
        const sampleSize = Math.min(100, betKeys.length);
        const sampledKeys = betKeys
            .sort(() => Math.random() - 0.5)
            .slice(0, sampleSize);

        const pattern = {
            betTypes: {},
            betAmounts: [],
            totalAmount: 0,
            averageAmount: 0,
            betCount: betKeys.length,
            timestamp: Date.now()
        };

        for (const key of sampledKeys) {
            try {
                const betData = await redisClient.get(key);
                if (!betData) continue;

                const bet = JSON.parse(betData);
                const betType = bet.betType.split(':')[0];
                const amount = parseFloat(bet.betAmount || 0);

                // Track bet type frequency
                pattern.betTypes[betType] = (pattern.betTypes[betType] || 0) + 1;

                // Track amounts
                pattern.betAmounts.push(amount);
                pattern.totalAmount += amount;

            } catch (betError) {
                continue;
            }
        }

        // Calculate statistics
        pattern.averageAmount = pattern.betAmounts.length > 0
            ? pattern.totalAmount / pattern.betAmounts.length
            : 0;

        // Extrapolate to full period
        pattern.estimatedTotalAmount = pattern.averageAmount * betKeys.length;

        // Cache the pattern
        PerformanceCache.patternCache.set(cacheKey, {
            pattern,
            timestamp: Date.now()
        });

        logger.info('Bet pattern analyzed', {
            gameType,
            periodId,
            betCount: pattern.betCount,
            betTypes: Object.keys(pattern.betTypes).length,
            averageAmount: pattern.averageAmount
        });

        return pattern;

    } catch (error) {
        logger.error('Error analyzing bet pattern', {
            error: error.message,
            gameType,
            periodId
        });
        return null;
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
 * Approximate Wingo/TRX_WIX payout based on betting patterns (UPDATED)
 * @param {Object} result - Game result
 * @param {Object} pattern - Betting pattern analysis
 * @returns {number} - Approximated payout
 */
const approximateWingoPayout = (result, pattern) => {
    try {
        let estimatedPayout = 0;
        const totalBets = pattern.betCount;
        const avgAmount = pattern.averageAmount;

        // Estimate based on common bet distributions
        const commonDistribution = {
            NUMBER: 0.15,    // 15% of bets typically on numbers
            COLOR: 0.35,     // 35% on colors  
            SIZE: 0.30,      // 30% on size
            PARITY: 0.20     // 20% on parity
        };

        // Calculate estimated payouts for each bet type
        Object.entries(commonDistribution).forEach(([betType, percentage]) => {
            const estimatedBetsOfType = totalBets * percentage;
            const estimatedAmountOfType = estimatedBetsOfType * avgAmount;

            switch (betType) {
                case 'NUMBER':
                    // Assume even distribution across numbers (10% win rate)
                    estimatedPayout += (estimatedAmountOfType * 0.1) * 9.0;
                    break;

                case 'COLOR':
                    // UPDATED: With deterministic colors, calculate based on actual result
                    let colorWinRate = 0;
                    let colorMultiplier = 0;
                    
                    // Calculate win rates for each color based on deterministic mapping
                    const numberColorMap = {
                        'red': [2, 4, 6, 8],           // 4 numbers = 40% chance
                        'green': [1, 3, 7, 9],         // 4 numbers = 40% chance  
                        'red_violet': [0],             // 1 number = 10% chance
                        'green_violet': [5]            // 1 number = 10% chance
                    };
                    
                    if (result.color === 'red') {
                        colorWinRate = 0.4;  // 40% of numbers are red
                        colorMultiplier = 2.0;
                    } else if (result.color === 'green') {
                        colorWinRate = 0.4;  // 40% of numbers are green
                        colorMultiplier = 2.0;
                    } else if (result.color === 'red_violet') {
                        // Both red bets and violet bets win
                        colorWinRate = 0.4 + 0.1; // Red bets (1.5x) + Violet bets (4.5x)
                        colorMultiplier = (0.4 * 1.5 + 0.1 * 4.5) / 0.5; // Weighted average
                    } else if (result.color === 'green_violet') {
                        // Both green bets and violet bets win
                        colorWinRate = 0.4 + 0.1; // Green bets (1.5x) + Violet bets (4.5x)
                        colorMultiplier = (0.4 * 1.5 + 0.1 * 4.5) / 0.5; // Weighted average
                    }
                    
                    estimatedPayout += (estimatedAmountOfType * colorWinRate) * colorMultiplier;
                    break;

                case 'SIZE':
                    // 50% win rate for size (unchanged)
                    estimatedPayout += (estimatedAmountOfType * 0.5) * 2.0;
                    break;

                case 'PARITY':
                    // 50% win rate for parity (unchanged)
                    estimatedPayout += (estimatedAmountOfType * 0.5) * 2.0;
                    break;
            }
        });

        return estimatedPayout;

    } catch (error) {
        logger.error('Error approximating Wingo payout', {
            error: error.message,
            result
        });
        return 0;
    }
};

/**
 * Approximate K3 payout based on betting patterns
 * @param {Object} result - Game result
 * @param {Object} pattern - Betting pattern analysis
 * @returns {number} - Approximated payout
 */
const approximateK3Payout = (result, pattern) => {
    try {
        let estimatedPayout = 0;
        const totalBets = pattern.betCount;
        const avgAmount = pattern.averageAmount;

        // K3 bet distribution estimates
        const k3Distribution = {
            SUM: 0.25,              // 25% on specific sums
            SUM_CATEGORY: 0.35,     // 35% on big/small/odd/even
            MATCHING_DICE: 0.25,    // 25% on pairs/triples
            PATTERN: 0.15           // 15% on patterns
        };

        Object.entries(k3Distribution).forEach(([betType, percentage]) => {
            const estimatedBetsOfType = totalBets * percentage;
            const estimatedAmountOfType = estimatedBetsOfType * avgAmount;

            switch (betType) {
                case 'SUM':
                    // Specific sum - low win rate, high multiplier
                    const sumMultiplier = getSumMultiplier(result.sum);
                    estimatedPayout += (estimatedAmountOfType * 0.056) * sumMultiplier; // ~1/18 win rate
                    break;

                case 'SUM_CATEGORY':
                    // Big/small/odd/even - 50% win rate
                    estimatedPayout += (estimatedAmountOfType * 0.5) * 2.0;
                    break;

                case 'MATCHING_DICE':
                    // Pairs/triples - varying rates
                    let matchingMultiplier = 13.83; // Pair default
                    let matchingWinRate = 0.17; // ~1/6 for pairs

                    if (result.has_triple) {
                        matchingMultiplier = 150; // Average of specific/any triple
                        matchingWinRate = 0.028; // ~1/36 for triples
                    }

                    estimatedPayout += (estimatedAmountOfType * matchingWinRate) * matchingMultiplier;
                    break;

                case 'PATTERN':
                    // Patterns - varying rates
                    let patternMultiplier = 20; // Average of pattern multipliers
                    let patternWinRate = 0.1; // ~10% average

                    estimatedPayout += (estimatedAmountOfType * patternWinRate) * patternMultiplier;
                    break;
            }
        });

        return estimatedPayout;

    } catch (error) {
        logger.error('Error approximating K3 payout', {
            error: error.message,
            result
        });
        return 0;
    }
};

/**
 * Approximate 5D payout based on betting patterns
 * @param {Object} result - Game result
 * @param {Object} pattern - Betting pattern analysis
 * @returns {number} - Approximated payout
 */
const approximate5DPayout = (result, pattern) => {
    try {
        let estimatedPayout = 0;
        const totalBets = pattern.betCount;
        const avgAmount = pattern.averageAmount;

        // 5D bet distribution estimates
        const fiveDDistribution = {
            POSITION: 0.40,         // 40% on position bets
            POSITION_SIZE: 0.25,    // 25% on position size
            POSITION_PARITY: 0.20,  // 20% on position parity
            SUM: 0.15              // 15% on sum
        };

        Object.entries(fiveDDistribution).forEach(([betType, percentage]) => {
            const estimatedBetsOfType = totalBets * percentage;
            const estimatedAmountOfType = estimatedBetsOfType * avgAmount;

            switch (betType) {
                case 'POSITION':
                    // 10% win rate for specific position numbers
                    estimatedPayout += (estimatedAmountOfType * 0.1) * 2.0;
                    break;

                case 'POSITION_SIZE':
                    // 50% win rate for position size
                    estimatedPayout += (estimatedAmountOfType * 0.5) * 2.0;
                    break;

                case 'POSITION_PARITY':
                    // 50% win rate for position parity
                    estimatedPayout += (estimatedAmountOfType * 0.5) * 2.0;
                    break;

                case 'SUM':
                    // 50% win rate for sum categories
                    estimatedPayout += (estimatedAmountOfType * 0.5) * 1.98;
                    break;
            }
        });

        return estimatedPayout;

    } catch (error) {
        logger.error('Error approximating 5D payout', {
            error: error.message,
            result
        });
        return 0;
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
 * Perform real-time optimization (called every 5 seconds)
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 * @param {string} periodId - Period ID
 */
const performRealTimeOptimization = async (gameType, duration, periodId) => {
    try {
        const durationKey = duration === 30 ? '30s' :
            duration === 60 ? '1m' :
                duration === 180 ? '3m' :
                    duration === 300 ? '5m' : '10m';

        // Get current tracking data
        const trackingKey = `${gameType}:${durationKey}:${periodId}:tracking`;
        const trackingData = await redisClient.get(trackingKey);

        if (!trackingData) {
            logger.warn('No tracking data found, reinitializing', { gameType, periodId });
            await initializeCombinationTracking(gameType, duration, periodId);
            return;
        }

        const tracking = JSON.parse(trackingData);

        // Get current total bet amount
        const totalBetKey = `${gameType}:${durationKey}:${periodId}:total`;
        const currentTotalBets = parseFloat(await redisClient.get(totalBetKey) || 0);

        // Update each combination's payout and 60/40 status
        for (const combination of tracking.combinations) {
            try {
                // Calculate current expected payout for this combination
                const expectedPayout = await calculateExpectedPayout(gameType, durationKey, periodId, combination.result);

                // Update combination data
                combination.currentPayout = expectedPayout;
                combination.payoutRatio = currentTotalBets > 0 ? expectedPayout / currentTotalBets : 0;

                // Check 60/40 rule - payout should not exceed 60% of total bets
                combination.isValid = combination.payoutRatio <= 0.60;
                combination.lastUpdated = Date.now();

            } catch (combError) {
                logger.warn('Error updating combination', {
                    combination: combination.result,
                    error: combError.message
                });
                combination.isValid = false; // Mark as invalid if calculation fails
            }
        }

        // Update total bet amount
        tracking.totalBetAmount = currentTotalBets;
        tracking.lastOptimization = Date.now();

        // Sort combinations by payout (ascending - lowest first)
        tracking.combinations.sort((a, b) => a.currentPayout - b.currentPayout);

        // Filter valid combinations (respecting 60/40 rule)
        const validCombinations = tracking.combinations.filter(c => c.isValid);
        const invalidCombinations = tracking.combinations.filter(c => !c.isValid);

        // Store updated tracking data
        await redisClient.set(trackingKey, JSON.stringify(tracking));

        // Store quick access data for fallbacks
        const fallbackData = {
            validCombinations: validCombinations.slice(0, 10), // Top 10 valid options
            invalidCombinations: invalidCombinations.slice(0, 5), // Top 5 invalid (as emergency backup)
            lowestPayout: validCombinations.length > 0 ? validCombinations[0] : null,
            secondLowest: validCombinations.length > 1 ? validCombinations[1] : null,
            thirdLowest: validCombinations.length > 2 ? validCombinations[2] : null,
            totalBets: currentTotalBets,
            optimizationTime: Date.now()
        };

        const fallbackKey = `${gameType}:${durationKey}:${periodId}:fallbacks`;
        await redisClient.set(fallbackKey, JSON.stringify(fallbackData));
        await redisClient.expire(fallbackKey, duration + 60);

        logger.info('Real-time optimization completed', {
            gameType,
            periodId,
            totalCombinations: tracking.combinations.length,
            validCombinations: validCombinations.length,
            invalidCombinations: invalidCombinations.length,
            totalBets: currentTotalBets,
            lowestPayoutRatio: validCombinations.length > 0 ? validCombinations[0].payoutRatio : null
        });

    } catch (error) {
        logger.error('Error performing real-time optimization', {
            error: error.message,
            stack: error.stack,
            gameType,
            periodId
        });
    }
};

/**
 * Get optimized result using real-time data
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 * @param {string} periodId - Period ID
 * @returns {Object} - Optimized result
 */
const getRealTimeOptimizedResult = async (gameType, duration, periodId) => {
    try {
        const durationKey = duration === 30 ? '30s' :
            duration === 60 ? '1m' :
                duration === 180 ? '3m' :
                    duration === 300 ? '5m' : '10m';

        // Get fallback data (pre-calculated)
        const fallbackKey = `${gameType}:${durationKey}:${periodId}:fallbacks`;
        const fallbackData = await redisClient.get(fallbackKey);

        if (!fallbackData) {
            logger.warn('No real-time data available, using standard calculation', {
                gameType,
                periodId
            });
            return await calculateOptimizedResult(gameType, duration, periodId);
        }

        const fallbacks = JSON.parse(fallbackData);

        // Priority selection based on your rules:
        // 1. Use valid 60/40 result (lowest payout)
        if (fallbacks.lowestPayout && fallbacks.lowestPayout.isValid) {
            logger.info('Using real-time optimized result (60/40 compliant)', {
                gameType,
                periodId,
                result: fallbacks.lowestPayout.result
            });
            return fallbacks.lowestPayout.result;
        }

        // 2. Use second lowest if available
        if (fallbacks.secondLowest && fallbacks.secondLowest.isValid) {
            logger.info('Using second lowest payout result', {
                gameType,
                periodId,
                result: fallbacks.secondLowest.result
            });
            return fallbacks.secondLowest.result;
        }

        // 3. Use third lowest if available
        if (fallbacks.thirdLowest && fallbacks.thirdLowest.isValid) {
            logger.info('Using third lowest payout result', {
                gameType,
                periodId,
                result: fallbacks.thirdLowest.result
            });
            return fallbacks.thirdLowest.result;
        }

        // 4. Fallback to standard calculation
        logger.warn('No valid real-time results available, using standard calculation', {
            gameType,
            periodId
        });
        return await calculateOptimizedResult(gameType, duration, periodId);

    } catch (error) {
        logger.error('Error getting real-time optimized result', {
            error: error.message,
            stack: error.stack,
            gameType,
            periodId
        });
        // Fallback to standard calculation
        return await calculateOptimizedResult(gameType, duration, periodId);
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
 * Check if minimum user requirement is met
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 * @param {string} periodId - Period ID
 * @returns {Promise<boolean>} - Whether minimum requirement is met
 */
const checkMinimumUserRequirement = async (gameType, duration, periodId) => {
    try {
        const durationKey = duration === 30 ? '30s' :
            duration === 60 ? '1m' :
                duration === 180 ? '3m' :
                    duration === 300 ? '5m' : '10m';

        // Get unique users who placed bets in this period
        const uniqueUsers = new Set();
        const betKeys = await redisClient.keys(`${gameType}:${durationKey}:${periodId}:*`);

        for (const key of betKeys) {
            const betData = await redisClient.get(key);
            if (betData) {
                const bet = JSON.parse(betData);
                uniqueUsers.add(bet.userId);
            }
        }

        return uniqueUsers.size >= 10;
    } catch (error) {
        logger.error('Error checking minimum user requirement', {
            error: error.message,
            gameType,
            periodId
        });
        return false;
    }
};

/**
 * Calculate result with verification
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 * @param {string} periodId - Period ID
 * @returns {Promise<Object>} - Result with verification
 */
const calculateResultWithVerification = async (gameType, duration, periodId) => {
    try {
        // Check minimum user requirement
        const hasMinimumUsers = await checkMinimumUserRequirement(gameType, duration, periodId);

        if (!hasMinimumUsers) {
            // Get all bet combinations for this period
            const durationKey = duration === 30 ? '30s' :
                duration === 60 ? '1m' :
                    duration === 180 ? '3m' :
                        duration === 300 ? '5m' : '10m';

            // Get all possible results
            const possibleResults = await generateAllPossibleResults(gameType);

            // Get all bet combinations from Redis
            const betKeys = await redisClient.keys(`${gameType}:${durationKey}:${periodId}:*`);
            const betCombinations = new Set();

            for (const key of betKeys) {
                const betData = await redisClient.get(key);
                if (betData) {
                    const bet = JSON.parse(betData);
                    betCombinations.add(JSON.stringify(bet.betType + ':' + bet.betValue));
                }
            }

            // Filter out results that would match any bet combinations
            const safeResults = possibleResults.filter(result => {
                // For each result, check if it would match any bet combination
                for (const betCombo of betCombinations) {
                    const [betType, betValue] = betCombo.split(':');
                    if (checkBetWin({ bet_type: betType + ':' + betValue }, result, gameType)) {
                        return false; // This result would match a bet, so exclude it
                    }
                }
                return true; // This result doesn't match any bets
            });

            // If we have safe results, randomly select one
            if (safeResults.length > 0) {
                const randomIndex = Math.floor(Math.random() * safeResults.length);
                const safeResult = safeResults[randomIndex];

                logger.info('Selected safe result for insufficient users', {
                    gameType,
                    periodId,
                    safeResult,
                    betCombinations: Array.from(betCombinations)
                });

                return {
                    success: true,
                    result: safeResult,
                    allUsersLose: true,
                    verification: {
                        hash: Math.random().toString(36).substring(2, 15), // Generate random hash
                        link: 'https://tronscan.org/' // Default verification link
                    }
                };
            } else {
                // If somehow no safe results (shouldn't happen), use fallback
                const fallbackResult = generateRandomResult(gameType);
                logger.warn('No safe results found, using fallback', {
                    gameType,
                    periodId,
                    fallbackResult
                });

                return {
                    success: true,
                    result: fallbackResult,
                    allUsersLose: true,
                    verification: {
                        hash: Math.random().toString(36).substring(2, 15),
                        link: 'https://tronscan.org/'
                    }
                };
            }
        }

        // Normal result calculation if minimum users requirement is met
        const result = await calculateOptimizedResult(gameType, duration, periodId);
        const verification = await tronHashService.getResultWithVerification(result.optimalResult);

        return {
            success: true,
            result: result.optimalResult.result,
            verification: {
                hash: verification.hash,
                link: verification.link
            },
            allUsersLose: false
        };
    } catch (error) {
        logger.error('Error calculating result with verification', {
            error: error.message,
            gameType,
            periodId
        });
        throw error;
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
        let BetRecord;
        switch (gameType.toLowerCase()) {
            case 'wingo':
                BetRecord = BetRecordWingo;
                break;
            case 'trx_wix':
                BetRecord = BetRecordTrxWix;
                break;
            case 'fiveD':
                BetRecord = BetRecord5D;
                break;
            case 'k3':
                BetRecord = BetRecordK3;
                break;
            default:
                throw new Error('Invalid game type');
        }

        await BetRecord.update(
            { status: 'lost' },
            { where: { period: periodId, status: 'pending' } }
        );
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
const getUniqueUserCount = async (gameType, duration, periodId) => {
    try {
        const durationKey = duration === 30 ? '30s' :
            duration === 60 ? '1m' :
                duration === 180 ? '3m' :
                    duration === 300 ? '5m' : '10m';

        // Get all bet keys for this period
        const betKeys = await redisClient.keys(`${gameType}:${durationKey}:${periodId}:*`);
        const uniqueUsers = new Set();

        for (const key of betKeys) {
            try {
                const betData = await redisClient.get(key);
                if (betData) {
                    const bet = JSON.parse(betData);
                    if (bet.userId) {
                        uniqueUsers.add(bet.userId);
                    }
                }
            } catch (parseError) {
                logger.warn('Error parsing bet data', { key, parseError: parseError.message });
                continue;
            }
        }

        logger.info('Unique user count calculated', {
            gameType,
            periodId,
            uniqueUserCount: uniqueUsers.size,
            totalBetKeys: betKeys.length
        });

        return uniqueUsers.size;
    } catch (error) {
        logger.error('Error getting unique user count', {
            error: error.message,
            stack: error.stack,
            gameType,
            periodId
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
 * Generate result where all users lose (UPDATED - for < 10 users rule)
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 * @param {string} periodId - Period ID
 * @returns {Promise<Object>} - Result that makes all users lose
 */
const generateAllLoseResult = async (gameType, duration, periodId) => {
    try {
        const durationKey = duration === 30 ? '30s' :
            duration === 60 ? '1m' :
                duration === 180 ? '3m' :
                    duration === 300 ? '5m' : '10m';

        // Get all bets for this period
        const betKeys = await redisClient.keys(`${gameType}:${durationKey}:${periodId}:*`);
        const placedBets = new Set();

        // Collect all bet combinations
        for (const key of betKeys) {
            try {
                const betData = await redisClient.get(key);
                if (betData) {
                    const bet = JSON.parse(betData);
                    placedBets.add(`${bet.betType}:${bet.betValue}`);
                }
            } catch (parseError) {
                continue;
            }
        }

        // Generate all possible results (now with deterministic colors)
        const allPossibleResults = await generateAllPossibleResults(gameType);

        // Find results that don't match any placed bets
        const losingResults = allPossibleResults.filter(result => {
            // Check if this result would make all bets lose
            for (const betCombo of placedBets) {
                const mockBet = { bet_type: betCombo };
                if (checkBetWin(mockBet, result, gameType)) {
                    return false; // This result would make someone win
                }
            }
            return true; // This result makes everyone lose
        });

        if (losingResults.length > 0) {
            // Select random losing result
            const selectedResult = losingResults[Math.floor(Math.random() * losingResults.length)];

            logger.info('Generated all-lose result', {
                gameType,
                periodId,
                placedBetsCount: placedBets.size,
                losingResultsCount: losingResults.length,
                selectedResult
            });

            return selectedResult;
        } else {
            // Fallback: use minimum bet result if no pure losing result found
            logger.warn('No pure losing result found, using minimum bet fallback', {
                gameType,
                periodId
            });

            return await getMinimumBetResult(gameType, duration, periodId);
        }
    } catch (error) {
        logger.error('Error generating all-lose result', {
            error: error.message,
            stack: error.stack,
            gameType,
            periodId
        });

        // Ultimate fallback: random result (with deterministic colors)
        return await generateRandomResult(gameType);
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
 * Process game results for a period
 * @param {string} gameType - Game type (wingo, fiveD, k3, trx_wix)
 * @param {number} duration - Duration in seconds
 * @param {string} periodId - Period ID
 * @returns {Object} - Processing result
 */
const processGameResults = async (gameType, duration, periodId) => {
    // CRITICAL: Ensure models are initialized before any database operations
    const models = await ensureModelsInitialized();

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

        // PHASE 1: Check user count threshold (>= 10 users rule)
        const uniqueUserCount = await getUniqueUserCount(gameType, duration, periodId);
        logger.info(`Unique users in period ${periodId}: ${uniqueUserCount}`);

        let finalResult;

        if (uniqueUserCount === 0) {
            // No bets = random result
            logger.info('No bets placed, generating random result');
            finalResult = await generateRandomResult(gameType);
        } else if (uniqueUserCount < 10) {
            // Less than 10 users = all lose
            logger.info('Less than 10 users, generating all-lose result');
            finalResult = await generateAllLoseResult(gameType, duration, periodId);
        } else if (await isMinimumBetPeriod(periodId)) {
            // Every 20 periods = minimum bet result
            logger.info('Minimum bet period detected, using minimum combination');
            finalResult = await getMinimumBetResult(gameType, duration, periodId);
        } else {
            // Normal optimization flow with real-time data
            logger.info('Normal optimization flow with real-time data');

            // Try to use real-time optimized result first
            let optimizedResult = await getRealTimeOptimizedResult(gameType, duration, periodId);

            if (!optimizedResult) {
                // Fallback to standard optimization
                logger.info('Real-time optimization unavailable, using standard');
                optimizedResult = await calculateOptimizedResult(gameType, duration, periodId);
            }

            // FIX: Correct access pattern for optimized result
            if (optimizedResult && optimizedResult.optimalResult && optimizedResult.optimalResult.result) {
                finalResult = optimizedResult.optimalResult.result;
                logger.info('Using optimized result', {
                    finalResult,
                    payoutRatio: optimizedResult.validation?.payoutRatio,
                    expectedPayout: optimizedResult.optimalResult.expectedPayout
                });
            } else {
                // Fallback if optimization fails
                logger.warn('Optimization failed, using fallback');
                finalResult = await getMinimumBetResult(gameType, duration, periodId);
            }
        }

        // Validate final result before saving
        if (!finalResult) {
            logger.error('Final result is null, generating random fallback');
            finalResult = await generateRandomResult(gameType);
        }

        logger.info(`Final result for period ${periodId}`, { finalResult });

        // Save result to appropriate table based on game type
        let savedResult;
        switch (gameType) {
            case 'wingo':
                savedResult = await models.BetResultWingo.create({
                    bet_number: periodId,
                    result_of_number: finalResult.number,
                    result_of_size: finalResult.size,
                    result_of_color: finalResult.color,
                    duration: duration,
                    timeline: new Date().toISOString()
                }, { transaction: t });
                break;
            case 'fiveD':
                savedResult = await models.BetResult5D.create({
                    bet_number: periodId,
                    result_a: finalResult.A,
                    result_b: finalResult.B,
                    result_c: finalResult.C,
                    result_d: finalResult.D,
                    result_e: finalResult.E,
                    total_sum: finalResult.sum,
                    duration: duration,
                    timeline: new Date().toISOString()
                }, { transaction: t });
                break;
            case 'k3':
                savedResult = await models.BetResultK3.create({
                    bet_number: periodId,
                    dice_1: finalResult.dice_1,
                    dice_2: finalResult.dice_2,
                    dice_3: finalResult.dice_3,
                    sum: finalResult.sum,
                    has_pair: finalResult.has_pair,
                    has_triple: finalResult.has_triple,
                    is_straight: finalResult.is_straight,
                    sum_size: finalResult.sum_size,
                    sum_parity: finalResult.sum_parity,
                    duration: duration,
                    timeline: new Date().toISOString()
                }, { transaction: t });
                break;
            case 'trx_wix':
                // Ensure result is properly formatted for trx_wix
                const trxResult = {
                    number: finalResult.number,
                    size: finalResult.size,
                    color: finalResult.color
                };

                savedResult = await models.BetResultTrxWix.create({
                    period: periodId,
                    result: trxResult, // Store as object, not stringified
                    verification_hash: finalResult.verification?.hash || crypto.randomBytes(16).toString('hex'),
                    verification_link: finalResult.verification?.link || 'https://tronscan.org/',
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
        // CRITICAL: Ensure models are initialized
        const models = await ensureModelsInitialized();

        let bets = [];
        const winningBets = [];

        // Get bets for the period based on game type
        switch (gameType.toLowerCase()) {
            case 'wingo':
                bets = await models.BetRecordWingo.findAll({
                    where: { period: periodId },
                    transaction: t
                });
                break;
            case 'trx_wix':
                bets = await models.BetRecordTrxWix.findAll({
                    where: { period: periodId },
                    transaction: t
                });
                break;
            case 'fived':
            case '5d':
                bets = await models.BetRecord5D.findAll({
                    where: { period: periodId },
                    transaction: t
                });
                break;
            case 'k3':
                bets = await models.BetRecordK3.findAll({
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
                    await models.User.increment('wallet_balance', {
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
                    // Handle mixed color cases
                    if (betValue === 'green' && result.color === 'green_violet') {
                        bet.odds = 1.5; // Set odds to 1.5x for mixed color win
                        return true;
                    } else if (betValue === 'red' && result.color === 'red_violet') {
                        bet.odds = 1.5; // Set odds to 1.5x for mixed color win
                        return true;
                    }
                    // Normal color match
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
                            gameType
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
                            gameType
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

/**
 * Get minimum bet result for a period
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 * @param {string} periodId - Period ID
 * @returns {Object} - Minimum bet result
 */
const getMinimumBetResult = async (gameType, duration, periodId) => {
    try {
        // Get duration key
        const durationKey = duration === 30 ? '30s' :
            duration === 60 ? '1m' :
                duration === 180 ? '3m' :
                    duration === 300 ? '5m' : '10m';

        // Get pre-calculated results
        const preCalculated = await getPreCalculatedResults(gameType, duration, periodId);

        if (!preCalculated || !preCalculated.lowestCombinations || preCalculated.lowestCombinations.length === 0) {
            // If no pre-calculated results, generate a random result
            return generateRandomResult(gameType);
        }

        // Get the first (lowest) combination
        const lowestCombination = preCalculated.lowestCombinations[0];

        logger.info('Retrieved minimum bet result', {
            gameType,
            duration,
            periodId,
            result: lowestCombination.result
        });

        return lowestCombination.result;
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
 * Calculate optimized result for a game period
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 * @param {string} periodId - Period ID
 * @returns {Object} - Optimized result with verification
 */
const calculateOptimizedResult = async (gameType, duration, periodId) => {
    try {
        logger.info('Starting optimized result calculation', {
            gameType,
            duration,
            periodId
        });

        // Get duration key
        const durationKey = duration === 30 ? '30s' :
            duration === 60 ? '1m' :
                duration === 180 ? '3m' :
                    duration === 300 ? '5m' : '10m';

        // Get all possible results
        const possibleResults = await generateAllPossibleResults(gameType);

        if (!possibleResults || possibleResults.length === 0) {
            logger.error('No possible results generated');
            throw new Error('Failed to generate possible results');
        }

        // Calculate expected payout for each result
        const resultsWithPayouts = await Promise.all(possibleResults.map(async (result) => {
            try {
                const expectedPayout = await calculateExpectedPayout(gameType, durationKey, periodId, result);
                return {
                    result,
                    expectedPayout: expectedPayout || 0
                };
            } catch (payoutError) {
                logger.warn('Error calculating payout for result', {
                    result,
                    error: payoutError.message
                });
                return {
                    result,
                    expectedPayout: 0
                };
            }
        }));

        // Filter out invalid results
        const validResults = resultsWithPayouts.filter(item =>
            item && item.result && typeof item.expectedPayout === 'number'
        );

        if (validResults.length === 0) {
            logger.error('No valid results after payout calculation');
            throw new Error('No valid results available');
        }

        // Sort by expected payout (ascending - lowest payout first)
        validResults.sort((a, b) => a.expectedPayout - b.expectedPayout);

        // Get the result with the lowest expected payout
        const optimalResult = validResults[0];

        // Validate the result against 60/40 criteria
        let validation;
        try {
            validation = await validate60_40Result(optimalResult, gameType);
        } catch (validationError) {
            logger.warn('Validation error, marking as safe', {
                error: validationError.message
            });
            validation = {
                isSafe: true,
                warnings: ['Validation skipped due to error']
            };
        }

        if (!validation.isSafe) {
            logger.warn('Optimal result failed 60/40 validation', {
                gameType,
                duration,
                periodId,
                validation
            });

            // Try to find a safe result within 10% payout range
            const safeResult = validResults.find(r =>
                r.expectedPayout <= optimalResult.expectedPayout * 1.1
            );

            if (safeResult) {
                logger.info('Found safe alternative result', {
                    originalPayout: optimalResult.expectedPayout,
                    safePayout: safeResult.expectedPayout
                });

                return {
                    optimalResult: safeResult,
                    validation: await validate60_40Result(safeResult, gameType)
                };
            }
        }

        logger.info('Calculated optimized result successfully', {
            gameType,
            duration,
            periodId,
            expectedPayout: optimalResult.expectedPayout,
            validation
        });

        return {
            optimalResult,
            validation
        };

    } catch (error) {
        logger.error('Error calculating optimized result', {
            error: error.message,
            stack: error.stack,
            gameType,
            duration,
            periodId
        });

        // Fallback to random result if calculation fails
        try {
            const fallbackResult = await generateRandomResult(gameType);
            logger.info('Using fallback random result', {
                gameType,
                fallbackResult
            });

            return {
                optimalResult: {
                    result: fallbackResult,
                    expectedPayout: 0
                },
                validation: {
                    isSafe: true,
                    warnings: ['Using fallback result due to calculation error']
                }
            };
        } catch (fallbackError) {
            logger.error('Even fallback failed', {
                fallbackError: fallbackError.message
            });
            throw new Error('Complete result generation failure');
        }
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
 * Generate a random result for a game type (UPDATED)
 * @param {string} gameType - Game type
 * @returns {Object} - Generated random result
 */
const generateRandomResult = async (gameType) => {
    try {
        logger.info('Generating random result', { gameType });

        let result;
        switch (gameType.toLowerCase()) {
            case 'wingo':
            case 'trx_wix':
                const number = Math.floor(Math.random() * 10); // 0-9
                result = {
                    number: number,
                    size: number >= 5 ? 'big' : 'small',
                    color: getColorForNumber(number) // Use deterministic color
                };
                break;

            case 'fived':
            case '5d':
                const dice = Array(5).fill(0).map(() => Math.floor(Math.random() * 6) + 1); // 1-6
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
                const k3Dice = Array(3).fill(0).map(() => Math.floor(Math.random() * 6) + 1); // 1-6
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
                    has_pair: Object.values(counts).includes(2),
                    has_triple: Object.values(counts).includes(3),
                    is_straight: k3Dice.sort().every((val, idx, arr) =>
                        idx === 0 || val === arr[idx - 1] + 1
                    ),
                    sum_size: sum > 10 ? 'big' : 'small',
                    sum_parity: sum % 2 === 0 ? 'even' : 'odd'
                };
                break;

            default:
                throw new Error(`Unsupported game type: ${gameType}`);
        }

        // Validate the generated result
        const validation = await validateFallbackResult(result, gameType);
        if (!validation.isSafe) {
            logger.warn('Generated random result failed validation, regenerating', {
                gameType,
                validation
            });
            return generateRandomResult(gameType); // Recursively try again
        }

        logger.info('Successfully generated random result', {
            gameType,
            result
        });

        return result;
    } catch (error) {
        logger.error('Error generating random result', {
            error: error.message,
            stack: error.stack,
            gameType
        });
        throw error;
    }
};

/**
 * Generate all possible results for a game type (UPDATED)
 * @param {string} gameType - Game type
 * @returns {Array} - Array of all possible results
 */
const generateAllPossibleResults = async (gameType) => {
    try {
        logger.info('Generating all possible results', { gameType });

        let results = [];
        switch (gameType.toLowerCase()) {
            case 'wingo':
            case 'trx_wix':
                // Generate combinations with deterministic colors
                for (let number = 0; number <= 9; number++) {
                    const color = getColorForNumber(number); // Use deterministic color
                    for (const size of ['big', 'small']) {
                        results.push({
                            number,
                            size,
                            color
                        });
                    }
                }
                break;

            case 'fived':
            case '5d':
                // Generate all possible combinations of 5 dice (unchanged)
                for (let a = 1; a <= 6; a++) {
                    for (let b = 1; b <= 6; b++) {
                        for (let c = 1; c <= 6; c++) {
                            for (let d = 1; d <= 6; d++) {
                                for (let e = 1; e <= 6; e++) {
                                    results.push({
                                        A: a,
                                        B: b,
                                        C: c,
                                        D: d,
                                        E: e,
                                        sum: a + b + c + d + e
                                    });
                                }
                            }
                        }
                    }
                }
                break;

            case 'k3':
                // Generate all possible combinations of 3 dice (unchanged)
                for (let d1 = 1; d1 <= 6; d1++) {
                    for (let d2 = 1; d2 <= 6; d2++) {
                        for (let d3 = 1; d3 <= 6; d3++) {
                            const sum = d1 + d2 + d3;
                            const counts = [d1, d2, d3].reduce((acc, val) => {
                                acc[val] = (acc[val] || 0) + 1;
                                return acc;
                            }, {});

                            results.push({
                                dice_1: d1,
                                dice_2: d2,
                                dice_3: d3,
                                sum: sum,
                                has_pair: Object.values(counts).includes(2),
                                has_triple: Object.values(counts).includes(3),
                                is_straight: [d1, d2, d3].sort().every((val, idx, arr) =>
                                    idx === 0 || val === arr[idx - 1] + 1
                                ),
                                sum_size: sum > 10 ? 'big' : 'small',
                                sum_parity: sum % 2 === 0 ? 'even' : 'odd'
                            });
                        }
                    }
                }
                break;

            default:
                throw new Error(`Unsupported game type: ${gameType}`);
        }

        logger.info('Generated all possible results', {
            gameType,
            resultCount: results.length
        });

        return results;
    } catch (error) {
        logger.error('Error generating all possible results', {
            error: error.message,
            stack: error.stack,
            gameType
        });
        throw error;
    }
};

/**
 * Calculate expected payout for a potential result (Performance Enhanced)
 * @param {string} gameType - Game type
 * @param {string} durationKey - Duration key (30s, 1m, 3m, 5m, 10m)
 * @param {string} periodId - Period ID
 * @param {Object} result - Potential result to calculate payout for
 * @returns {number} - Expected payout amount
 */
const calculateExpectedPayout = async (gameType, durationKey, periodId, result) => {
    try {
        // First try to get optimized (cached) payout
        const optimizedPayout = await getOptimizedPayout(gameType, durationKey, periodId, result);

        // If optimized calculation is available and seems reasonable, use it
        if (optimizedPayout !== undefined && optimizedPayout >= 0) {
            return optimizedPayout;
        }

        // Fallback to original exact calculation
        logger.info('Using fallback exact calculation', {
            gameType,
            durationKey,
            periodId,
            result
        });

        // Get all bets for this period
        const betKeys = await redisClient.keys(`${gameType}:${durationKey}:${periodId}:*`);
        let totalPayout = 0;
        let totalBets = 0;

        for (const key of betKeys) {
            try {
                const betData = await redisClient.get(key);
                if (!betData) continue;

                const bet = JSON.parse(betData);
                totalBets++;

                // Calculate winnings for this specific bet if this result occurs
                const winAmount = calculateComplexWinAmount(bet, result, gameType);
                totalPayout += winAmount;

            } catch (betError) {
                logger.warn('Error processing bet in payout calculation', {
                    key,
                    error: betError.message
                });
                continue;
            }
        }

        logger.info('Exact payout calculation completed', {
            gameType,
            periodId,
            totalBets,
            totalPayout,
            averagePayoutPerBet: totalBets > 0 ? totalPayout / totalBets : 0
        });

        return totalPayout;
    } catch (error) {
        logger.error('Error calculating expected payout', {
            error: error.message,
            stack: error.stack,
            gameType,
            durationKey,
            periodId
        });
        return 0;
    }
};

/**
 * Store a bet in Redis and trigger real-time optimization update
 * @param {Object} betData - Bet data to store
 * @returns {Promise<boolean>} - Whether storage was successful
 */
const storeBetInRedis = async (betData) => {
    try {
        const {
            userId,
            gameType,
            duration,
            periodId,
            betType,
            betValue,
            betAmount,
            odds
        } = betData;

        const durationKey = duration === 30 ? '30s' :
            duration === 60 ? '1m' :
                duration === 180 ? '3m' :
                    duration === 300 ? '5m' : '10m';

        // Create Redis key for this bet
        const betKey = `${gameType}:${durationKey}:${periodId}:${userId}:${betType}:${betValue}`;

        // Store bet data
        await redisClient.set(betKey, JSON.stringify({
            userId,
            betType,
            betValue,
            betAmount,
            odds,
            timestamp: Date.now()
        }));

        // Update total bet amount for this period
        const totalKey = `${gameType}:${durationKey}:${periodId}:total`;
        await redisClient.incrbyfloat(totalKey, betAmount);

        // Set expiry for bet data (24 hours)
        await redisClient.expire(betKey, 86400);
        await redisClient.expire(totalKey, 86400);

        // PHASE 2 ENHANCEMENT: Trigger immediate optimization update for high-frequency tracking
        try {
            await performRealTimeOptimization(gameType, duration, periodId);
            logger.info('Real-time optimization triggered by new bet', {
                gameType,
                periodId,
                userId,
                betType,
                betValue,
                betAmount
            });
        } catch (optimizationError) {
            // Don't fail bet storage if optimization fails
            logger.warn('Real-time optimization failed after bet storage', {
                error: optimizationError.message,
                gameType,
                periodId
            });
        }

        logger.info('Bet stored in Redis with real-time update', {
            gameType,
            duration,
            periodId,
            userId,
            betType,
            betValue,
            betAmount
        });

        return true;
    } catch (error) {
        logger.error('Error storing bet in Redis', {
            error: error.message,
            stack: error.stack,
            betData
        });
        return false;
    }
};

/**
 * Process a bet
 * @param {Object} betData - Bet data to process
 * @returns {Promise<Object>} - Processing result
 */
const processBet = async (betData) => {
    try {
        // Validate bet
        const validation = await validateBet(betData);
        if (!validation.valid) {
            return {
                success: false,
                message: validation.message
            };
        }

        // Store bet in Redis
        const stored = await storeBetInRedis(betData);
        if (!stored) {
            return {
                success: false,
                message: 'Failed to store bet'
            };
        }

        // Update user's bet count
        const betCount = await getUserBetCount(betData.userId, betData.gameType, betData.periodId);

        // Deduct bet amount from user's balance
        await User.decrement('wallet_balance', {
            by: betData.betAmount,
            where: { user_id: betData.userId }
        });

        logger.info('Bet processed successfully', {
            userId: betData.userId,
            gameType: betData.gameType,
            periodId: betData.periodId,
            betAmount: betData.betAmount
        });

        return {
            success: true,
            message: 'Bet processed successfully',
            betCount: betCount + 1
        };
    } catch (error) {
        logger.error('Error processing bet', {
            error: error.message,
            stack: error.stack,
            betData
        });
        return {
            success: false,
            message: 'Error processing bet'
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
 * Store hourly minimum combinations in Redis
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 * @param {string} periodId - Period ID
 * @param {Array} resultWithBets - Array of results with their bet amounts
 * @returns {Promise<boolean>} - Whether storage was successful
 */
const storeHourlyMinimumCombinations = async (gameType, duration, periodId, resultWithBets) => {
    try {
        const durationKey = duration === 30 ? '30s' :
            duration === 60 ? '1m' :
                duration === 180 ? '3m' :
                    duration === 300 ? '5m' : '10m';

        // Get current hour timestamp
        const now = new Date();
        const hourKey = now.toISOString().slice(0, 13); // YYYY-MM-DDTHH

        // Create Redis key for hourly combinations
        const hourlyKey = `${gameType}:${durationKey}:hourly:${hourKey}`;

        // Sort results by bet amount (ascending)
        const sortedResults = [...resultWithBets].sort((a, b) => a.betAmount - b.betAmount);

        // Get top 3 minimum combinations
        const minimumCombinations = sortedResults.slice(0, 3);

        // Store in Redis
        await redisClient.set(hourlyKey, JSON.stringify({
            combinations: minimumCombinations,
            timestamp: now.toISOString(),
            periodId
        }));

        // Set expiry for 1 hour
        await redisClient.expire(hourlyKey, 3600);

        logger.info('Stored hourly minimum combinations', {
            gameType,
            duration,
            periodId,
            hourKey,
            combinationCount: minimumCombinations.length
        });

        return true;
    } catch (error) {
        logger.error('Error storing hourly minimum combinations', {
            error: error.message,
            stack: error.stack,
            gameType,
            duration,
            periodId
        });
        return false;
    }
};


module.exports = {
    // Core validation and optimization
    validate60_40Result,
    shouldUseMinimumBetResult,
    getMinimumBetResult,
    calculateOptimizedResult,
    validateFallbackResult,
    generateFallbackResult,
    generateRandomResult,
    generateAllPossibleResults,
    calculateExpectedPayout,
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
    generateAllLoseResult,
    initializePeriod,
    getActivePeriods,
    getPeriodStatus,

    // Real-time optimization
    startRealTimeOptimization,
    initializeCombinationTracking,
    performRealTimeOptimization,
    getRealTimeOptimizedResult,
    startAdaptiveOptimization,

    // Performance optimization
    getPreCalculatedCombinations,
    getOptimizedPayout,
    calculateSampledPayout,
    calculateApproximatedPayout,
    getBetPattern,
    approximateWingoPayout,
    approximateK3Payout,
    approximate5DPayout,
    getSumMultiplier,
    processAllCombinationsExact,
    processCombinationsWithSampling,
    processCombinationsWithApproximation,

    // Cache management
    clearPerformanceCaches,
    getSystemHealthCheck,
    getOptimizationPerformanceMetrics,

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
    trackBetCombinations,
    startPeriodTracking,
    getPreCalculatedResults,
    logSuspiciousActivity,
    getAllMinimumCombinations,
    checkMinimumUserRequirement,

    // Cleanup and maintenance
    cleanupRedisData,
    isBettingFrozen,
    hasBets,
    updateGameHistory,
    validateResultStructure,
    calculatePeriodEndTime,

    // Storage functions
    storeTemporaryResult,
    storeHourlyMinimumCombinations,
    getHourlyMinimumCombinations,

    // Period optimization
    startPeriodWithOptimization,
    schedulePeriodCleanup,
    cleanupPeriodData,
    getPeriodOptimizationStats,
    getColorForNumber,

    // Model management
    ensureModelsInitialized,
    get models() {
        if (!serviceModels) {
            throw new Error('Models not initialized. Call ensureModelsInitialized() first.');
        }
        return serviceModels;
    }
};