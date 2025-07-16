// Backend/services/periodService.js - FIXED VERSION
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
        
        // Calculate times based on period ID
        const startTime = calculatePeriodStartTime(periodId, duration);
        const endTime = calculatePeriodEndTime(periodId, duration);
        
        console.log('Initializing period with calculated times:', {
            periodId,
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            duration,
            currentTime: new Date().toISOString()
        });
        
        // Create Redis keys for this period
        const periodKey = `${gameType}:${durationKey}:${periodId}`;
        const betsKey = `${periodKey}:bets`;
        const resultKey = `${periodKey}:result`;
        
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
            initializedAt: new Date().toISOString()
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
        
        // Store this as the current period for this game/duration
        const currentPeriodKey = `${gameType}:${durationKey}:current_period`;
        await redisClient.set(currentPeriodKey, periodId);
        await redisClient.expire(currentPeriodKey, EXPIRY_SECONDS);
        
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
            currentPeriodKey,
            expirySeconds: EXPIRY_SECONDS
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
                    created_at: new Date(),
                    updated_at: new Date()
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
        
        // 🚀 ENHANCED: Initialize 5D zero-exposure candidates for new periods
        if (gameType.toLowerCase() === '5d' || gameType.toLowerCase() === 'fived') {
            try {
                const fiveDProtectionService = require('./fiveDProtectionService');
                await fiveDProtectionService.initializeZeroExposureCandidates(
                    gameType, duration, periodId, 'default'
                );
                console.log('✅ [ENHANCED_5D] Zero-exposure candidates initialized for period:', periodId);
            } catch (enhancedError) {
                console.log('⚠️ [ENHANCED_5D] Error initializing zero-exposure candidates:', enhancedError.message);
                // Don't throw here - period initialization should continue even if enhanced system fails
            }
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
 * FIXED: Get current period ID with real-time calculation
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds  
 * @param {Date} timestamp - Current date/time
 * @returns {string} - Current period ID
 */
const getCurrentPeriodId = async (gameType, duration, timestamp = new Date()) => {
    try {
        const istMoment = moment(timestamp).tz('Asia/Kolkata');
        
        // Calculate time since 2 AM today
        let startOfPeriods = istMoment.clone().hour(2).minute(0).second(0).millisecond(0);
        
        // If current time is before 2 AM, use 2 AM of previous day
        if (istMoment.hour() < 2) {
            startOfPeriods.subtract(1, 'day');
        }
        
        // Calculate total seconds since period start
        const totalSeconds = istMoment.diff(startOfPeriods, 'seconds');
        
        // Calculate current period number (0-based)
        const currentPeriodNumber = Math.floor(totalSeconds / duration);
        
        // Generate period ID
        const dateStr = startOfPeriods.format('YYYYMMDD');
        const periodId = `${dateStr}${currentPeriodNumber.toString().padStart(9, '0')}`;
        
        console.log(`Current period ID: ${periodId} (sequence: ${currentPeriodNumber})`);
        return periodId;
    } catch (error) {
        console.error('Error getting current period ID:', error);
        throw error;
    }
};

/**
 * FIXED: Get next period ID with real-time calculation
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 * @param {Date} timestamp - Current date/time  
 * @returns {string} - Next period ID
 */
const getNextPeriodId = async (gameType, duration, timestamp = new Date()) => {
    try {
        const istMoment = moment(timestamp).tz('Asia/Kolkata');
        
        // Calculate time since 2 AM today
        let startOfPeriods = istMoment.clone().hour(2).minute(0).second(0).millisecond(0);
        
        // If current time is before 2 AM, use 2 AM of previous day
        if (istMoment.hour() < 2) {
            startOfPeriods.subtract(1, 'day');
        }
        
        // Calculate total seconds since period start
        const totalSeconds = istMoment.diff(startOfPeriods, 'seconds');
        
        // Calculate NEXT period number
        const currentPeriodNumber = Math.floor(totalSeconds / duration);
        const nextPeriodNumber = currentPeriodNumber + 1;
        
        // Generate next period ID
        const dateStr = startOfPeriods.format('YYYYMMDD');
        const nextPeriodId = `${dateStr}${nextPeriodNumber.toString().padStart(9, '0')}`;
        
        console.log(`Next period ID: ${nextPeriodId} (sequence: ${nextPeriodNumber})`);
        return nextPeriodId;
    } catch (error) {
        console.error('Error getting next period ID:', error);
        throw error;
    }
};


/**
 * FIXED: Get current period using real-time calculation
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 * @returns {Object|null} - Current period info or null
 */
const getCurrentPeriod = async (gameType, duration) => {
    try {
        const now = new Date();
        const istMoment = moment(now).tz('Asia/Kolkata');
        
        // Calculate time since 2 AM today
        let startOfPeriods = istMoment.clone().hour(2).minute(0).second(0).millisecond(0);
        
        // If current time is before 2 AM, use 2 AM of previous day
        if (istMoment.hour() < 2) {
            startOfPeriods.subtract(1, 'day');
        }
        
        // Calculate total seconds since period start
        const totalSeconds = istMoment.diff(startOfPeriods, 'seconds');
        
        // Calculate current period number (0-based)
        const currentPeriodNumber = Math.floor(totalSeconds / duration);
        
        // Calculate when current period started
        const currentPeriodStart = startOfPeriods.clone().add(currentPeriodNumber * duration, 'seconds');
        
        // Calculate when current period ends
        const currentPeriodEnd = currentPeriodStart.clone().add(duration, 'seconds');
        
        // Calculate time remaining in current period
        const timeRemaining = Math.max(0, currentPeriodEnd.diff(istMoment, 'seconds'));
        
        // Generate period ID
        const dateStr = startOfPeriods.format('YYYYMMDD');
        const periodId = `${dateStr}${currentPeriodNumber.toString().padStart(9, '0')}`;
        
        // Check if we need to move to the next period
        if (timeRemaining <= 0) {
            console.log(`Period ${periodId} has expired, getting next period`);
            const nextPeriodNumber = currentPeriodNumber + 1;
            const nextPeriodId = `${dateStr}${nextPeriodNumber.toString().padStart(9, '0')}`;
            
            // Calculate next period times
            const nextPeriodStart = startOfPeriods.clone().add(nextPeriodNumber * duration, 'seconds');
            const nextPeriodEnd = nextPeriodStart.clone().add(duration, 'seconds');
            const nextTimeRemaining = Math.max(0, nextPeriodEnd.diff(istMoment, 'seconds'));
            
            // Only return next period if it's valid
            if (nextTimeRemaining > 0) {
                const nextPeriodInfo = {
                    periodId: nextPeriodId,
                    gameType,
                    duration,
                    startTime: nextPeriodStart.toDate(),
                    endTime: nextPeriodEnd.toDate(),
                    timeRemaining: nextTimeRemaining,
                    active: true,
                    bettingOpen: nextTimeRemaining > 5
                };
                
                console.log(`Next period for ${gameType} ${duration}s:`, {
                    periodId: nextPeriodId,
                    timeRemaining: Math.floor(nextTimeRemaining),
                    bettingOpen: nextPeriodInfo.bettingOpen,
                    currentTime: istMoment.format(),
                    endTime: nextPeriodEnd.format()
                });
                
                return nextPeriodInfo;
            }
            return null;
        }
        
        const periodInfo = {
            periodId,
            gameType,
            duration,
            startTime: currentPeriodStart.toDate(),
            endTime: currentPeriodEnd.toDate(),
            timeRemaining,
            active: true,
            bettingOpen: timeRemaining > 5
        };
        
        // FIXED: Remove excessive logging - only log period transitions, not every tick
        // console.log(`Current period for ${gameType} ${duration}s:`, {
        //     periodId,
        //     timeRemaining: Math.floor(timeRemaining),
        //     bettingOpen: periodInfo.bettingOpen,
        //     currentTime: istMoment.format(),
        //     endTime: currentPeriodEnd.format()
        // });
        
        return periodInfo;
    } catch (error) {
        console.error('Error getting current period:', {
            error: error.message,
            stack: error.stack,
            gameType,
            duration
        });
        return null;
    }
};

/**
 * Get active periods for a game type
 * @param {string} gameType - Game type
 * @returns {Array} - Array of active periods
 */
const getActivePeriods = async (gameType) => {
    try {
        const now = new Date();
        const activePeriods = [];
        
        // Check all possible durations for this game type
        const gameConfigs = {
            'wingo': [30, 60, 180, 300],
            'trx_wix': [30, 60, 180, 300],
            'fiveD': [60, 180, 300, 600],
            'k3': [60, 180, 300, 600]
        };
        
        const durations = gameConfigs[gameType] || [];
        
        for (const duration of durations) {
            try {
                const currentPeriod = await getCurrentPeriod(gameType, duration);
                if (currentPeriod && currentPeriod.active) {
                    activePeriods.push(currentPeriod);
                }
            } catch (durationError) {
                console.error(`Error getting period for ${gameType} ${duration}s:`, durationError.message);
                continue;
            }
        }
        
        console.log(`Active periods for ${gameType}:`, activePeriods.length);
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
        
        // Update current period cache
        const currentPeriodKey = `${gameType}:${durationKey}:current_period`;
        await redisClient.set(currentPeriodKey, nextPeriodId);
        await redisClient.expire(currentPeriodKey, 3600);
        
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

/**
 * Calculate exact time remaining for a period
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 * @param {Date} timestamp - Current time
 * @returns {number} - Time remaining in seconds
 */
const calculateTimeRemaining = (gameType, duration, timestamp = new Date()) => {
    try {
        const istMoment = moment(timestamp).tz('Asia/Kolkata');
        
        // Calculate time since 2 AM today
        let startOfPeriods = istMoment.clone().hour(2).minute(0).second(0).millisecond(0);
        
        // If current time is before 2 AM, use 2 AM of previous day
        if (istMoment.hour() < 2) {
            startOfPeriods.subtract(1, 'day');
        }
        
        // Calculate total seconds since period start
        const totalSeconds = istMoment.diff(startOfPeriods, 'seconds');
        
        // Calculate current period number
        const currentPeriodNumber = Math.floor(totalSeconds / duration);
        
        // Calculate when current period ends
        const currentPeriodEnd = startOfPeriods.clone().add((currentPeriodNumber + 1) * duration, 'seconds');
        
        // Calculate time remaining
        const timeRemaining = Math.max(0, currentPeriodEnd.diff(istMoment, 'seconds'));
        
        return timeRemaining;
    } catch (error) {
        console.error('Error calculating time remaining:', error);
        return 0;
    }
};

// Export the service with proper WebSocket integration
module.exports = {
    calculateTimeRemaining,
    // Essential functions for WebSocket
    getCurrentPeriod,            // FIXED - This is what WebSocket needs
    getCurrentPeriodId,          
    getNextPeriodId,
    getActivePeriods,           // FIXED - Updated to work properly
    
    // Core period management
    generatePeriodId,
    calculatePeriodStartTime,
    calculatePeriodEndTime,
    getPeriodStatus,
    initializePeriod,
    generateNextPeriodId,
    addPeriods,
    
    // Utility functions
    getCurrentSequence,
    ensureModelsLoaded
};