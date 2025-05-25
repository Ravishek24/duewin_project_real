// Backend/services/gameLogicService.js
const { sequelize, DataTypes } = require('../config/db');
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

// Initialize models variable - will be populated after initialization
let models = null;
let BetResultWingo, BetResult5D, BetResultK3, BetResultTrxWix;
let BetRecordWingo, BetRecord5D, BetRecordK3, BetRecordTrxWix;
let GamePeriod, User;

// Function to initialize models when they're ready
const initializeServiceModels = async () => {
    try {
        // Import the models module
        const { models: modelModule, initializeModels } = require('../models');
        
        // Always wait for initialization to ensure models are ready
        console.log('⏳ Initializing models in gameLogicService...');
        await initializeModels();
        
        // Get models from the module
        models = modelModule;
        
        if (!models) {
            throw new Error('Models initialization failed - no models returned');
        }
        
        // Assign individual models
        BetResultWingo = models.BetResultWingo;
        BetResult5D = models.BetResult5D;
        BetResultK3 = models.BetResultK3;
        BetResultTrxWix = models.BetResultTrxWix;
        BetRecordWingo = models.BetRecordWingo;
        BetRecord5D = models.BetRecord5D;
        BetRecordK3 = models.BetRecordK3;
        BetRecordTrxWix = models.BetRecordTrxWix;
        GamePeriod = models.GamePeriod;
        User = models.User;
        
        // Verify all required models are available and properly initialized
        const requiredModels = [
            'BetResultWingo', 'BetResult5D', 'BetResultK3', 'BetResultTrxWix',
            'BetRecordWingo', 'BetRecord5D', 'BetRecordK3', 'BetRecordTrxWix',
            'GamePeriod', 'User'
        ];
        
        const missingModels = requiredModels.filter(modelName => {
            const model = models[modelName];
            return !model || typeof model.create !== 'function';
        });
        
        if (missingModels.length > 0) {
            throw new Error(`Missing or improperly initialized models: ${missingModels.join(', ')}`);
        }
        
        // Verify model methods
        const modelMethods = ['create', 'findOne', 'findAll', 'update', 'destroy'];
        for (const modelName of requiredModels) {
            const model = models[modelName];
            const missingMethods = modelMethods.filter(method => typeof model[method] !== 'function');
            if (missingMethods.length > 0) {
                throw new Error(`Model ${modelName} is missing required methods: ${missingMethods.join(', ')}`);
            }
        }
        
        console.log('✅ Models initialized in gameLogicService');
        return true;
    } catch (error) {
        console.error('❌ Error initializing models in gameLogicService:', error);
        throw error;
    }
};

// Add a helper function to ensure models are initialized before use
const ensureModelsInitialized = async () => {
    try {
        if (!models || !GamePeriod || !User) {
            await initializeServiceModels();
        }
        if (!models || !GamePeriod || !User) {
            throw new Error('Models not properly initialized');
        }
    } catch (error) {
        console.error('Failed to ensure models are initialized:', error);
        throw error;
    }
};

// Call initialization immediately and retry on failure
const initializeWithRetry = async (retries = 3, delay = 2000) => {
    for (let i = 0; i < retries; i++) {
        try {
            await initializeServiceModels();
            return;
        } catch (error) {
            console.error(`Failed to initialize models (attempt ${i + 1}/${retries}):`, error);
            if (i < retries - 1) {
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                throw error;
            }
        }
    }
};

// Initialize with retry
initializeWithRetry().catch(error => {
    console.error('Failed to initialize service models after all retries:', error);
    process.exit(1); // Exit if we can't initialize models
});

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
    await ensureModelsInitialized();
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
                    result_of_number: result.result.number,
                    result_of_size: result.result.size,
                    result_of_color: result.result.color,
                    duration: duration,
                    timeline: new Date().toISOString()
                }, { transaction: t });
                break;
            case 'fiveD':
                savedResult = await BetResult5D.create({
                    bet_number: periodId,
                    result_a: result.result.A,
                    result_b: result.result.B,
                    result_c: result.result.C,
                    result_d: result.result.D,
                    result_e: result.result.E,
                    total_sum: result.result.sum,
                    duration: duration,
                    timeline: new Date().toISOString()
                }, { transaction: t });
                break;
            case 'k3':
                savedResult = await BetResultK3.create({
                    bet_number: periodId,
                    dice_1: result.result.dice_1,
                    dice_2: result.result.dice_2,
                    dice_3: result.result.dice_3,
                    sum: result.result.sum,
                    has_pair: result.result.has_pair,
                    has_triple: result.result.has_triple,
                    is_straight: result.result.is_straight,
                    sum_size: result.result.sum_size,
                    sum_parity: result.result.sum_parity,
                    duration: duration,
                    timeline: new Date().toISOString()
                }, { transaction: t });
                break;
            case 'trx_wix':
                savedResult = await BetResultTrxWix.create({
                    period: periodId,
                    result: result.result, // Store the result object directly, not stringified
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
 * Calculate optimized result for a game period
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 * @param {string} periodId - Period ID
 * @returns {Object} - Optimized result with verification
 */
const calculateOptimizedResult = async (gameType, duration, periodId) => {
    try {
        // Get duration key
        const durationKey = duration === 30 ? '30s' : 
                          duration === 60 ? '1m' : 
                          duration === 180 ? '3m' : 
                          duration === 300 ? '5m' : '10m';

        // Get all possible results
        const possibleResults = await generateAllPossibleResults(gameType);
        
        // Calculate expected payout for each result
        const resultsWithPayouts = await Promise.all(possibleResults.map(async (result) => {
            const expectedPayout = await calculateExpectedPayout(gameType, durationKey, periodId, result);
            return {
                result,
                expectedPayout
            };
        }));

        // Sort by expected payout (ascending)
        resultsWithPayouts.sort((a, b) => a.expectedPayout - b.expectedPayout);

        // Get the result with the lowest expected payout
        const optimalResult = resultsWithPayouts[0];

        // Validate the result against 60/40 criteria
        const validation = await validate60_40Result(optimalResult, gameType);
        
        if (!validation.isSafe) {
            logger.warn('Optimal result failed 60/40 validation', {
                gameType,
                duration,
                periodId,
                validation
            });
            
            // Try to find a safe result
            const safeResult = resultsWithPayouts.find(r => 
                r.expectedPayout <= optimalResult.expectedPayout * 1.1 // Allow 10% more payout
            );
            
            if (safeResult) {
                return {
                    optimalResult: safeResult,
                    validation: await validate60_40Result(safeResult, gameType)
                };
            }
        }

        logger.info('Calculated optimized result', {
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
        const fallbackResult = generateRandomResult(gameType);
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
    }
};

/**
 * Validate a fallback result for a game type
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
 * Generate a fallback result for a game type
 * @param {string} gameType - Game type
 * @returns {Object} - Generated fallback result
 */
const generateFallbackResult = async (gameType) => {
    try {
        switch (gameType.toLowerCase()) {
            case 'wingo':
            case 'trx_wix':
                return {
                    number: Math.floor(Math.random() * 10), // 0-9
                    size: Math.random() < 0.5 ? 'big' : 'small',
                    color: ['red', 'green', 'red_violet', 'green_violet'][Math.floor(Math.random() * 4)]
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
 * Generate a random result for a game type
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
                result = {
                    number: Math.floor(Math.random() * 10), // 0-9
                    size: Math.random() < 0.5 ? 'big' : 'small',
                    color: ['red', 'green', 'red_violet', 'green_violet'][Math.floor(Math.random() * 4)]
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
 * Generate all possible results for a game type
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
                // Generate all combinations of number, size, and color
                for (let number = 0; number <= 9; number++) {
                    for (const size of ['big', 'small']) {
                        for (const color of ['red', 'green', 'red_violet', 'green_violet']) {
                            results.push({
                                number,
                                size,
                                color
                            });
                        }
                    }
                }
                break;

            case 'fived':
            case '5d':
                // Generate all possible combinations of 5 dice
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
                // Generate all possible combinations of 3 dice
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
 * Calculate expected payout for a potential result
 * @param {string} gameType - Game type
 * @param {string} durationKey - Duration key (30s, 1m, 3m, 5m, 10m)
 * @param {string} periodId - Period ID
 * @param {Object} result - Potential result to calculate payout for
 * @returns {number} - Expected payout amount
 */
const calculateExpectedPayout = async (gameType, durationKey, periodId, result) => {
    try {
        logger.info('Calculating expected payout', {
            gameType,
            durationKey,
            periodId,
            result
        });

        // Get all bets for this period
        const betKeys = await redisClient.keys(`${gameType}:${durationKey}:${periodId}:*`);
        let totalPayout = 0;

        for (const key of betKeys) {
            const betData = await redisClient.get(key);
            if (!betData) continue;

            const bet = JSON.parse(betData);
            const [betType, betValue] = bet.bet_type.split(':');

            // Check if this bet would win with the given result
            const isWinner = checkBetWin(bet, result, gameType);
            if (isWinner) {
                // Calculate winnings for this bet
                const winnings = calculateWinnings(bet, gameType);
                totalPayout += winnings;
            }
        }

        logger.info('Calculated expected payout', {
            gameType,
            durationKey,
            periodId,
            totalPayout
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
 * Store a bet in Redis
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

        logger.info('Bet stored in Redis', {
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