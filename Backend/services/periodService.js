const redisClient = require('../config/redisConfig').redis;
const { sequelize } = require('../config/db');
const { Op } = require('sequelize');
const moment = require('moment-timezone');
const winston = require('winston');
const path = require('path');
const crypto = require('crypto');

// We'll get the models dynamically when needed instead of importing at module level
let GamePeriod = null;
let modelsInitialized = false;

// Function to ensure models are loaded
const ensureModelsLoaded = async () => {
    if (!modelsInitialized || !GamePeriod) {
        try {
            console.log('🔄 Loading models in periodService...');
            
            // Try to get models from the index file
            const models = require('../models');
            
            // If models has an initializeModels function, call it
            if (models.initializeModels && typeof models.initializeModels === 'function') {
                console.log('🔄 Calling initializeModels...');
                const initializedModels = await models.initializeModels();
                GamePeriod = initializedModels.GamePeriod;
                console.log('✅ Models initialized via initializeModels');
            } else if (models.GamePeriod) {
                // Try to get GamePeriod directly from models
                GamePeriod = models.GamePeriod;
                console.log('✅ GamePeriod loaded directly from models');
            } else if (models.sequelize) {
                // Try to get from sequelize models
                GamePeriod = models.sequelize.models.GamePeriod;
                console.log('✅ GamePeriod loaded from sequelize.models');
            }
            
            // If still not found, try importing directly
            if (!GamePeriod) {
                console.log('🔄 Trying to import GamePeriod directly...');
                const GamePeriodModel = require('../models/GamePeriod');
                if (GamePeriodModel.init && typeof GamePeriodModel.init === 'function') {
                    GamePeriod = GamePeriodModel.init(sequelize);
                    console.log('✅ GamePeriod initialized directly');
                } else {
                    GamePeriod = GamePeriodModel;
                    console.log('✅ GamePeriod loaded directly');
                }
            }
            
            if (!GamePeriod) {
                throw new Error('GamePeriod model not found after all attempts');
            }
            
            modelsInitialized = true;
            console.log('✅ GamePeriod model loaded successfully in periodService');
        } catch (error) {
            console.error('❌ Failed to load models in period service:', error);
            throw error;
        }
    }
    return GamePeriod;
};

// Configure Winston logger with better error handling
let logger;
try {
    logger = winston.createLogger({
        format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
        ),
        transports: [
            new winston.transports.Console({
                format: winston.format.combine(
                    winston.format.colorize(),
                    winston.format.simple()
                )
            })
        ]
    });
} catch (error) {
    // Fallback to console if winston fails
    logger = {
        error: console.error,
        warn: console.warn,
        info: console.log,
        debug: console.log
    };
}

/**
 * Generate period ID based on game type, duration, and current time
 * @param {string} gameType - Game type (wingo, fiveD, k3, trx_wix)
 * @param {number} duration - Period duration in seconds
 * @param {Date} timestamp - Current date/time
 * @returns {string} - Period ID
 */
const generatePeriodId = async (gameType, duration, timestamp) => {
    try {
        console.log('\n=== GENERATING PERIOD ID ===');
        console.log(`Game Type: ${gameType}`);
        console.log(`Duration: ${duration}s`);
        console.log(`Timestamp: ${timestamp.toISOString()}`);
        
        // Ensure models are loaded
        const LoadedGamePeriod = await ensureModelsLoaded();

        const now = moment();
        const startTime = now.clone().startOf('day');
        const endTime = now.clone().endOf('day');

        // Find the last period for today
        const lastPeriod = await LoadedGamePeriod.findOne({
            where: {
                game_type: gameType,
                duration: duration,
                start_time: {
                    [Op.between]: [startTime.toDate(), endTime.toDate()]
                }
            },
            order: [['period_id', 'DESC']]
        });
        
        let sequence = 1;
        if (lastPeriod) {
            const lastSequence = parseInt(lastPeriod.period_id.split('-')[3]) || 0;
            sequence = lastSequence + 1;
        }
        
        // Get game type prefix (first letter of each word)
        const gameTypePrefix = gameType.split('_')
            .map(word => word.charAt(0).toUpperCase())
            .join('');
            
        // Get duration prefix
        const durationPrefix = duration === 30 ? '30' :
                             duration === 60 ? '60' :
                             duration === 180 ? '180' :
                             duration === 300 ? '300' : '600';
        
        // Get base period ID (YYYYMMDDHHMM)
        const basePeriodId = timestamp.toISOString()
            .replace(/[-T:]/g, '')
            .slice(0, 12);
            
        // Format: YYYYMMDDHHMM-GAME-DURATION-SEQ
        const periodId = `${basePeriodId}-${gameTypePrefix}-${durationPrefix}-${sequence.toString().padStart(3, '0')}`;
        
        console.log(`Generated period ID: ${periodId}`);
        console.log('=== PERIOD ID GENERATION COMPLETE ===\n');
        
        return periodId;
    } catch (error) {
        console.error('\n=== PERIOD ID GENERATION ERROR ===');
        console.error('Error details:', error.message);
        console.error('Stack trace:', error.stack);
        throw error;
    }
};

/**
 * Calculate start time for a period
 * @param {string} periodId - Period ID
 * @param {number} duration - Duration in seconds
 * @returns {Date} - Start time
 */
const calculatePeriodStartTime = (periodId, duration) => {
    try {
        // Extract date and time from period ID (first 12 characters)
        const dateTimeStr = periodId.substring(0, 12);
        const year = parseInt(dateTimeStr.substring(0, 4), 10);
        const month = parseInt(dateTimeStr.substring(4, 6), 10) - 1; // Months are 0-indexed
        const day = parseInt(dateTimeStr.substring(6, 8), 10);
        const hour = parseInt(dateTimeStr.substring(8, 10), 10);
        const minute = parseInt(dateTimeStr.substring(10, 12), 10);
        
        // Create date in IST
        const startTime = moment.tz([year, month, day, hour, minute], 'Asia/Kolkata');
        
        console.log('Calculated period start time:', {
            periodId,
            duration,
            startTime: startTime.toISOString()
        });
        
        return startTime.toDate();
    } catch (error) {
        console.error('Error calculating period start time:', {
            error: error.message,
            stack: error.stack,
            periodId,
            duration
        });
        throw error;
    }
};

/**
 * Calculate period end time
 * @param {string} periodId - Period ID
 * @param {number} duration - Duration in seconds
 * @returns {Date} End time
 */
const calculatePeriodEndTime = (periodId, duration) => {
    try {
        // Get start time from period ID
        const startTime = calculatePeriodStartTime(periodId, duration);
        
        // Add duration in seconds
        const endTime = moment(startTime).tz('Asia/Kolkata').add(duration, 'seconds');
        
        logger.debug('Calculated period end time:', {
            periodId,
            duration,
            startTime: moment(startTime).tz('Asia/Kolkata').toISOString(),
            endTime: endTime.toISOString()
        });
        
        return endTime.toDate();
    } catch (error) {
        logger.error('Error calculating period end time:', {
            error: error.message,
            stack: error.stack,
            periodId,
            duration
        });
        throw error;
    }
};

/**
 * Get status of a period
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 * @param {string} periodId - Period ID
 * @returns {Object} - Period status
 */
const getPeriodStatus = async (gameType, duration, periodId) => {
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
        const resultString = await redisClient.get(resultKey);
        const result = resultString ? JSON.parse(resultString) : null;
        
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
        logger.error('Error getting period status:', {
            error: error.message,
            stack: error.stack,
            gameType,
            duration,
            periodId
        });
        return {
            active: false,
            hasResult: false
        };
    }
};

/**
 * Initialize a new period
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 * @param {string} periodId - Period ID
 */
const initializePeriod = async (gameType, duration, periodId) => {
    try {
        // Ensure models are loaded
        const LoadedGamePeriod = await ensureModelsLoaded();
        
        const durationKey = duration === 30 ? '30s' : 
                           duration === 60 ? '1m' : 
                           duration === 180 ? '3m' : 
                           duration === 300 ? '5m' : '10m';
        
        // Create Redis keys for this period
        const periodKey = `${gameType}:${durationKey}:${periodId}`;
        const betsKey = `${periodKey}:bets`;
        const resultKey = `${periodKey}:result`;
        
        // Use current time as start time
        const now = moment().tz('Asia/Kolkata');
        const startTime = now.toDate();
        const endTime = now.add(duration, 'seconds').toDate();
        
        console.log('Initializing period with times:', {
            periodId,
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            duration,
            currentTime: now.toISOString()
        });
        
        // Initialize period data
        const periodData = {
            gameType,
            duration,
            periodId,
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            status: 'active',
            totalBets: 0,
            totalAmount: 0,
            initializedAt: now.toISOString()
        };
        
        // Store period data in Redis
        await redisClient.set(periodKey, JSON.stringify(periodData));
        
        // Initialize empty bets array
        await redisClient.set(betsKey, JSON.stringify([]));
        
        // Set expiry for period keys (24 hours)
        const EXPIRY_SECONDS = 24 * 60 * 60;
        await redisClient.expire(periodKey, EXPIRY_SECONDS);
        await redisClient.expire(betsKey, EXPIRY_SECONDS);
        await redisClient.expire(resultKey, EXPIRY_SECONDS);
        
        console.log('Period initialized:', {
            gameType,
            duration,
            periodId,
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            durationKey,
            periodKey,
            betsKey,
            resultKey,
            expirySeconds: EXPIRY_SECONDS,
            initializedAt: periodData.initializedAt
        });
        
        // Also store in database for persistence
        try {
            // Check if period already exists
            const existingPeriod = await LoadedGamePeriod.findOne({
                where: {
                    period_id: periodId,
                    game_type: gameType,
                    duration: duration
                }
            });

            if (!existingPeriod) {
                await LoadedGamePeriod.create({
                    period_id: periodId,
                    game_type: gameType,
                    duration: duration,
                    start_time: startTime,
                    end_time: endTime,
                    is_completed: false,
                    total_bet_amount: 0,
                    total_payout_amount: 0,
                    unique_bettors: 0,
                    created_at: now.toDate(),
                    updated_at: now.toDate()
                });
                console.log('Period stored in database:', {
                    gameType,
                    duration,
                    periodId
                });
            } else {
                console.log('Period already exists in database:', {
                    gameType,
                    duration,
                    periodId
                });
            }
        } catch (dbError) {
            console.error('Failed to store period in database:', {
                error: dbError.message,
                stack: dbError.stack,
                gameType,
                duration,
                periodId
            });
            // Don't throw here - we still want the Redis initialization to succeed
        }
    } catch (error) {
        console.error('Error initializing period:', {
            error: error.message,
            stack: error.stack,
            gameType,
            duration,
            periodId
        });
        throw error;
    }
};

/**
 * Get active periods for a game type
 * @param {string} gameType - Game type
 * @returns {Array} - Array of active periods
 */
const getActivePeriods = async (gameType) => {
    try {
        const now = moment().tz('Asia/Kolkata');
        const activePeriods = [];
        
        // Check all possible durations
        const durations = [30, 60, 180, 300, 600];
        
        for (const duration of durations) {
            const durationKey = duration === 30 ? '30s' : 
                              duration === 60 ? '1m' : 
                              duration === 180 ? '3m' : 
                              duration === 300 ? '5m' : '10m';
            
            // Get the last period ID
            const lastPeriodKey = `${gameType}:${durationKey}:lastPeriod`;
            const lastPeriodId = await redisClient.get(lastPeriodKey);
            
            if (lastPeriodId) {
                const status = await getPeriodStatus(gameType, duration, lastPeriodId);
                if (status.active) {
                    activePeriods.push(status);
                }
            }
        }
        
        return activePeriods;
    } catch (error) {
        logger.error('Error getting active periods:', {
            error: error.message,
            stack: error.stack,
            gameType
        });
        throw error;
    }
};

/**
 * Generate next period ID
 * @param {string} currentPeriodId - Current period ID
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 * @returns {string} - Next period ID
 */
const generateNextPeriodId = async (currentPeriodId, gameType, duration) => {
    try {
        // Format date as YYYYMMDD
        const dateStr = currentPeriodId.substring(0, 8);
        
        // Get sequence number from the last 9 digits
        const sequenceNumber = parseInt(currentPeriodId.substring(8), 10);
        
        // Generate next period ID by incrementing the sequence number
        const nextSequenceNumber = sequenceNumber + 1;
        const nextPeriodId = `${dateStr}${nextSequenceNumber.toString().padStart(9, '0')}`;
        
        // Store this as the last period ID
        const durationKey = duration === 30 ? '30s' : 
                          duration === 60 ? '1m' : 
                          duration === 180 ? '3m' : 
                          duration === 300 ? '5m' : '10m';
        const lastPeriodKey = `${gameType}:${durationKey}:lastPeriod`;
        await redisClient.set(lastPeriodKey, nextPeriodId);
        
        // Initialize the new period
        await initializePeriod(gameType, duration, nextPeriodId);
        
        logger.info('Generated next period ID', {
            gameType,
            duration: durationKey,
            currentPeriodId,
            nextPeriodId
        });
        
        return nextPeriodId;
    } catch (error) {
        logger.error('Error generating next period ID:', {
            error: error.message,
            stack: error.stack,
            currentPeriodId,
            gameType,
            duration
        });
        throw error;
    }
};

/**
 * Add periods to active periods list
 * @param {Array} activePeriods - Current active periods
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 * @param {Date} now - Current date/time
 * @returns {Array} - Updated active periods
 */
const addPeriods = (activePeriods, gameType, duration, now) => {
    try {
        const durationKey = duration === 30 ? '30s' : 
                          duration === 60 ? '1m' : 
                          duration === 180 ? '3m' : 
                          duration === 300 ? '5m' : '10m';
        
        // Get current period
        const currentPeriod = activePeriods.find(p => p.duration === durationKey);
        if (!currentPeriod) {
            logger.error('Current period not found', {
                gameType,
                duration: durationKey,
                activePeriods
            });
            return activePeriods;
        }
        
        // Calculate time until next period
        const endTime = calculatePeriodEndTime(currentPeriod.periodId, duration);
        const timeUntilNext = Math.max(0, (endTime - now) / 1000);
        
        // If less than 5 seconds until next period, add it
        if (timeUntilNext < 5) {
            const nextPeriodId = generateNextPeriodId(currentPeriod.periodId, gameType, duration);
            activePeriods.push({
                periodId: nextPeriodId,
                duration: durationKey,
                startTime: endTime,
                endTime: new Date(endTime.getTime() + duration * 1000)
            });
        }
        
        return activePeriods;
    } catch (error) {
        logger.error('Error adding periods:', {
            error: error.message,
            stack: error.stack,
            gameType,
            duration
        });
        return activePeriods;
    }
};

module.exports = {
    generatePeriodId,
    calculatePeriodStartTime,
    calculatePeriodEndTime,
    getPeriodStatus,
    initializePeriod,
    getActivePeriods,
    generateNextPeriodId,
    addPeriods,
    ensureModelsLoaded
};