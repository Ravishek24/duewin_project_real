const redisClient = require('../config/redisConfig').redis;
const { sequelize } = require('../config/db');
const { Op } = require('sequelize');
const moment = require('moment-timezone');
const winston = require('winston');
const path = require('path');
const crypto = require('crypto');

// Initialize logger variable
let logger;

// Configure Winston logger with better error handling
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

// Initialize models variable
let serviceModels = null;

// Helper function to ensure models are loaded
const ensureModelsLoaded = async () => {
    if (!serviceModels) {
        try {
            const { getModels } = require('../models');
            serviceModels = await getModels();
            console.log('✅ Models loaded successfully in periodService');
        } catch (error) {
            console.error('❌ Failed to load models in periodService:', error);
            throw new Error(`Failed to initialize GamePeriod model: ${error.message}`);
        }
    }
    return serviceModels;
};

// REMOVED: Don't initialize models immediately on require
// This was causing the circular dependency issue

/**
 * Generate period ID based on game type, duration, and current time
 * NEW FORMAT: YYYYMMDD000000000 (17 digits)
 * @param {string} gameType - Game type (wingo, fiveD, k3, trx_wix)
 * @param {number} duration - Period duration in seconds
 * @param {Date} timestamp - Current date/time
 * @returns {string} - Period ID
 */
const generatePeriodId = async (gameType, duration, timestamp) => {
    try {
        console.log('\n=== GENERATING NEW FORMAT PERIOD ID ===');
        console.log(`Game Type: ${gameType}`);
        console.log(`Duration: ${duration}s`);
        console.log(`Timestamp: ${timestamp.toISOString()}`);
        
        // Ensure models are loaded
        await ensureModelsLoaded();

        // Get current date in IST
        const istMoment = moment(timestamp).tz('Asia/Kolkata');
        const dateStr = istMoment.format('YYYYMMDD');
        
        // Create duration key
        const durationKey = duration === 30 ? '30s' :
                           duration === 60 ? '1m' :
                           duration === 180 ? '3m' :
                           duration === 300 ? '5m' : '10m';
        
        // Get sequence counter from Redis
        const sequenceKey = `${gameType}:${durationKey}:daily_sequence:${dateStr}`;
        
        // Get current sequence number (atomic increment)
        let sequenceNumber = await redisClient.incr(sequenceKey);
        
        // Set expiry for sequence key (expires at 2 AM next day)
        const tomorrow2AM = moment.tz('Asia/Kolkata')
            .add(1, 'day')
            .hour(2)
            .minute(0)
            .second(0)
            .millisecond(0);
        const expirySeconds = Math.max(3600, tomorrow2AM.diff(istMoment, 'seconds'));
        await redisClient.expire(sequenceKey, expirySeconds);
        
        // Convert sequence to 0-based (Redis INCR starts from 1)
        sequenceNumber = sequenceNumber - 1;
        
        // Format: YYYYMMDD + 9-digit sequence (zero-padded)
        const periodId = `${dateStr}${sequenceNumber.toString().padStart(9, '0')}`;
        
        console.log(`Generated period ID: ${periodId}`);
        console.log(`Sequence number: ${sequenceNumber}`);
        console.log(`Sequence key: ${sequenceKey}`);
        console.log(`Expires in: ${expirySeconds} seconds`);
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
 * Get current sequence number for a game-duration combination
 * @param {string} gameType - Game type
 * @param {string} duration - Duration key (30s, 1m, etc.)
 * @param {string} dateStr - Date string (YYYYMMDD)
 * @returns {number} - Current sequence number
 */
const getCurrentSequence = async (gameType, duration, dateStr) => {
    try {
        const sequenceKey = `${gameType}:${duration}:daily_sequence:${dateStr}`;
        const currentSequence = await redisClient.get(sequenceKey);
        return parseInt(currentSequence || '0', 10);
    } catch (error) {
        logger.error('Error getting current sequence:', {
            error: error.message,
            gameType,
            duration,
            dateStr
        });
        return 0;
    }
};

/**
 * Calculate start time for a period
 * NEW FORMAT: YYYYMMDD000000000
 * @param {string} periodId - Period ID
 * @param {number} duration - Duration in seconds
 * @returns {Date} - Start time
 */
const calculatePeriodStartTime = (periodId, duration) => {
    try {
        // Extract date from period ID (first 8 characters)
        const dateStr = periodId.substring(0, 8);
        const year = parseInt(dateStr.substring(0, 4), 10);
        const month = parseInt(dateStr.substring(4, 6), 10) - 1; // Months are 0-indexed
        const day = parseInt(dateStr.substring(6, 8), 10);
        
        // Extract sequence number (last 9 characters)
        const sequenceStr = periodId.substring(8);
        const sequenceNumber = parseInt(sequenceStr, 10);
        
        // Calculate start time based on sequence and duration
        // Start from 2 AM IST of the date + (sequence * duration)
        const baseTime = moment.tz([year, month, day, 2, 0, 0], 'Asia/Kolkata');
        const startTime = baseTime.add(sequenceNumber * duration, 'seconds');
        
        console.log('Calculated period start time:', {
            periodId,
            duration,
            dateStr,
            sequenceNumber,
            baseTime: baseTime.format(),
            startTime: startTime.format()
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
            startTime: moment(startTime).tz('Asia/Kolkata').format(),
            endTime: endTime.format()
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
            const existingPeriod = await LoadedGamePeriod.GamePeriod.findOne({
                where: {
                    period_id: periodId,
                    game_type: gameType,
                    duration: duration
                }
            });

            if (!existingPeriod) {
                await LoadedGamePeriod.GamePeriod.create({
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
 * Get current period ID without incrementing sequence
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds  
 * @param {Date} timestamp - Current date/time
 * @returns {string} - Current period ID
 */
const getCurrentPeriodId = async (gameType, duration, timestamp) => {
    try {
        const istMoment = moment(timestamp).tz('Asia/Kolkata');
        const dateStr = istMoment.format('YYYYMMDD');
        
        const durationKey = duration === 30 ? '30s' :
                           duration === 60 ? '1m' :
                           duration === 180 ? '3m' :
                           duration === 300 ? '5m' : '10m';
        
        const sequenceKey = `${gameType}:${durationKey}:daily_sequence:${dateStr}`;
        
        // Get current sequence without incrementing
        let currentSequence = await redisClient.get(sequenceKey);
        if (currentSequence === null) {
            // First period of the day
            currentSequence = 0;
        } else {
            currentSequence = parseInt(currentSequence, 10) - 1; // Convert to 0-based
        }
        
        const periodId = `${dateStr}${currentSequence.toString().padStart(9, '0')}`;
        
        console.log(`Current period ID: ${periodId} (sequence: ${currentSequence})`);
        return periodId;
    } catch (error) {
        console.error('Error getting current period ID:', error);
        throw error;
    }
};

/**
 * Generate next period ID by incrementing sequence
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 * @param {Date} timestamp - Current date/time  
 * @returns {string} - Next period ID
 */
const getNextPeriodId = async (gameType, duration, timestamp) => {
    try {
        const istMoment = moment(timestamp).tz('Asia/Kolkata');
        const dateStr = istMoment.format('YYYYMMDD');
        
        const durationKey = duration === 30 ? '30s' :
                           duration === 60 ? '1m' :
                           duration === 180 ? '3m' :
                           duration === 300 ? '5m' : '10m';
        
        const sequenceKey = `${gameType}:${durationKey}:daily_sequence:${dateStr}`;
        
        // Increment sequence atomically
        const nextSequence = await redisClient.incr(sequenceKey);
        const sequenceNumber = nextSequence - 1; // Convert to 0-based
        
        // Set expiry
        const tomorrow2AM = moment.tz('Asia/Kolkata')
            .add(1, 'day')
            .hour(2)
            .minute(0)
            .second(0);
        const expirySeconds = Math.max(3600, tomorrow2AM.diff(istMoment, 'seconds'));
        await redisClient.expire(sequenceKey, expirySeconds);
        
        const periodId = `${dateStr}${sequenceNumber.toString().padStart(9, '0')}`;
        
        console.log(`Next period ID: ${periodId} (sequence: ${sequenceNumber})`);
        return periodId;
    } catch (error) {
        console.error('Error getting next period ID:', error);
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
 * NEW FORMAT: Simply increment the sequence number
 * @param {string} currentPeriodId - Current period ID
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 * @returns {string} - Next period ID
 */
const generateNextPeriodId = async (currentPeriodId, gameType, duration) => {
    try {
        // Extract date and sequence from current period ID
        const dateStr = currentPeriodId.substring(0, 8);
        const currentSequence = parseInt(currentPeriodId.substring(8), 10);
        
        // Generate next sequence number
        const nextSequence = currentSequence + 1;
        
        // Create next period ID
        const nextPeriodId = `${dateStr}${nextSequence.toString().padStart(9, '0')}`;
        
        // Update Redis sequence counter
        const durationKey = duration === 30 ? '30s' :
                           duration === 60 ? '1m' :
                           duration === 180 ? '3m' :
                           duration === 300 ? '5m' : '10m';
        
        const sequenceKey = `${gameType}:${durationKey}:daily_sequence:${dateStr}`;
        await redisClient.set(sequenceKey, nextSequence + 1); // +1 because Redis INCR will be used next
        
        // Store this as the last period ID
        const lastPeriodKey = `${gameType}:${durationKey}:lastPeriod`;
        await redisClient.set(lastPeriodKey, nextPeriodId);
        
        // Initialize the new period
        await initializePeriod(gameType, duration, nextPeriodId);
        
        logger.info('Generated next period ID', {
            gameType,
            duration: durationKey,
            currentPeriodId,
            nextPeriodId,
            currentSequence,
            nextSequence
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

// Export the service with async model access
module.exports = {
    getCurrentPeriodId,         // NEW - Add this
    getNextPeriodId, 

    // OLD  
    generatePeriodId,
    calculatePeriodStartTime,
    calculatePeriodEndTime,
    getPeriodStatus,
    initializePeriod,
    getActivePeriods,
    generateNextPeriodId,
    addPeriods,
    ensureModelsLoaded,
    async getCurrentPeriod() {
        const models = await ensureModelsLoaded();
        const { GamePeriod } = models;
        // ... rest of the function
    }
};