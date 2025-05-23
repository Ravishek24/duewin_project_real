const redisClient = require('../config/redisConfig').redis;
const { sequelize } = require('../config/db');
const moment = require('moment-timezone');
const winston = require('winston');
const path = require('path');

// Configure Winston logger
const logger = winston.createLogger({
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ 
            filename: path.join('logs', 'period-service.log') 
        }),
        new winston.transports.File({ 
            filename: path.join('logs', 'period-service-errors.log'),
            level: 'error'
        })
    ]
});

/**
 * Generate period ID based on game type, duration, and current time
 * @param {string} gameType - Game type (wingo, fiveD, k3, trx_wix)
 * @param {number} duration - Period duration in seconds
 * @param {Date} now - Current date/time
 * @returns {string} - Period ID
 */
const generatePeriodId = async (gameType, duration, now = new Date()) => {
    try {
        // Format date as YYYYMMDD
        const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');
        
        // Get redis key for this game type and duration
        const durationKey = duration === 30 ? '30s' : 
                          duration === 60 ? '1m' : 
                          duration === 180 ? '3m' : 
                          duration === 300 ? '5m' : '10m';
        
        const lastPeriodKey = `${gameType}:${durationKey}:lastPeriod`;
        
        // Get the last period ID for this game type and duration
        let lastPeriodId = await redisClient.get(lastPeriodKey);
        
        // If no last period exists, create the first one with 9 zeros
        if (!lastPeriodId) {
            lastPeriodId = `${dateStr}000000000`;
            logger.info('No last period found, creating first period', {
                gameType,
                duration: durationKey,
                periodId: lastPeriodId
            });
        }
        
        // Check if we're on a new day
        const lastPeriodDate = lastPeriodId.substring(0, 8);
        if (lastPeriodDate !== dateStr) {
            // Reset for new day
            lastPeriodId = `${dateStr}000000000`;
            logger.info('New day detected, resetting period counter', {
                lastPeriodDate,
                currentDate: dateStr,
                newPeriodId: lastPeriodId
            });
        }
        
        // Extract the sequence number from the last 9 digits
        const sequenceNumber = parseInt(lastPeriodId.substring(8), 10);
        
        // Calculate time elapsed since the start of the last period
        const lastPeriodTime = calculatePeriodStartTime(lastPeriodId, duration);
        const elapsedSeconds = Math.floor((now - lastPeriodTime) / 1000);
        
        // Check if enough time has passed for a new period based on duration
        if (elapsedSeconds >= duration) {
            // Calculate how many periods have passed
            const periodsElapsed = Math.floor(elapsedSeconds / duration);
            
            // Generate new period ID by incrementing the sequence number
            const newSequenceNumber = sequenceNumber + periodsElapsed;
            const periodId = `${dateStr}${newSequenceNumber.toString().padStart(9, '0')}`;
            
            // Store this as the last period ID
            await redisClient.set(lastPeriodKey, periodId);
            
            // Initialize the new period
            await initializePeriod(gameType, duration, periodId);
            
            logger.info('Generated new period ID', {
                gameType,
                duration: durationKey,
                periodId,
                lastPeriodId,
                periodsElapsed,
                elapsedSeconds
            });
            
            return periodId;
        }
        
        // If not enough time has passed, return the last period ID
        logger.info('Using existing period ID', {
            gameType,
            duration: durationKey,
            periodId: lastPeriodId,
            elapsedSeconds,
            timeRemaining: duration - elapsedSeconds
        });
        
        return lastPeriodId;
    } catch (error) {
        logger.error('Error generating period ID:', {
            error: error.message,
            stack: error.stack,
            gameType,
            duration
        });
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
        // Extract date from period ID (first 8 characters)
        const dateStr = periodId.substring(0, 8);
        const year = parseInt(dateStr.substring(0, 4), 10);
        const month = parseInt(dateStr.substring(4, 6), 10) - 1; // Months are 0-indexed
        const day = parseInt(dateStr.substring(6, 8), 10);
        
        // Get sequence number from the last 9 digits
        const sequenceNumber = parseInt(periodId.substring(8), 10);
        
        // Create midnight for this date
        const midnight = new Date(Date.UTC(year, month, day));
        
        // Calculate start time: midnight + (sequenceNumber * duration)
        return new Date(midnight.getTime() + sequenceNumber * duration * 1000);
    } catch (error) {
        logger.error('Error calculating period start time:', {
            error: error.message,
            stack: error.stack,
            periodId,
            duration
        });
        throw error;
    }
};

/**
 * Calculate end time for a period
 * @param {string} periodId - Period ID
 * @param {number} duration - Duration in seconds
 * @returns {Date} - End time
 */
const calculatePeriodEndTime = (periodId, duration) => {
    try {
        // Get start time and add duration
        const startTime = calculatePeriodStartTime(periodId, duration);
        return new Date(startTime.getTime() + duration * 1000);
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
        const durationKey = duration === 30 ? '30s' : 
                           duration === 60 ? '1m' : 
                           duration === 180 ? '3m' : 
                           duration === 300 ? '5m' : '10m';
        
        // Create Redis keys for this period
        const periodKey = `${gameType}:${durationKey}:${periodId}`;
        const betsKey = `${periodKey}:bets`;
        const resultKey = `${periodKey}:result`;
        
        // Initialize period data
        const periodData = {
            gameType,
            duration,
            periodId,
            startTime: new Date().toISOString(),
            endTime: calculatePeriodEndTime(periodId, duration).toISOString(),
            status: 'active',
            totalBets: 0,
            totalAmount: 0
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
        
        logger.info('Period initialized:', {
            gameType,
            duration,
            periodId
        });
    } catch (error) {
        logger.error('Error initializing period:', {
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
    addPeriods
}; 