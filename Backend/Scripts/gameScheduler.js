// Backend/scripts/gameScheduler.js - FIXED: Duration-based period management only

const { redis } = require('../config/redisConfig');
const { connectDB } = require('../config/db');
const cron = require('node-cron');
const logger = require('../utils/logger');
const moment = require('moment-timezone');

// Import services after DB connection is established
let periodService = null;
let gameLogicService = null;
let tronHashService = null;

// Models and sequelize
let models = null;
let sequelize = null;

// FIXED: Game tick intervals for scheduler process ONLY - duration-based
const schedulerGameIntervals = new Map();
let schedulerGameTicksStarted = false;

// FIXED: Period cache for scheduler process ONLY - duration-based
const schedulerCurrentPeriods = new Map(); // Key: gameType_duration (NO timeline suffix)
const schedulerProcessingLocks = new Set();

// FIXED: Duration-based game configs only
const GAME_CONFIGS = {
    'wingo': [30, 60, 180, 300],     // 4 rooms: wingo_30, wingo_60, wingo_180, wingo_300
    'trx_wix': [30, 60, 180, 300],   // 4 rooms: trx_wix_30, trx_wix_60, trx_wix_180, trx_wix_300
    'k3': [60, 180, 300, 600],       // 4 rooms: k3_60, k3_180, k3_300, k3_600
    'fiveD': [60, 180, 300, 600]     // 4 rooms: fiveD_60, fiveD_180, fiveD_300, fiveD_600
};

// Total: 16 rooms (4 games × 4 durations each)

/**
 * FIXED: Initialize scheduler with duration-based period management only
 */
async function initialize() {
    try {
        console.log('🔄 Starting GAME SCHEDULER initialization - DURATION-BASED ONLY...');
        
        // Step 1: Connect to database
        console.log('🔄 Connecting to database...');
        await connectDB();
        
        const { sequelize: seq } = require('../config/db');
        sequelize = seq;
        
        await sequelize.authenticate();
        console.log('✅ Database connected for game scheduler');
        
        // Step 2: Initialize models
        console.log('🔄 Initializing models...');
        const modelsModule = require('../models');
        
        try {
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            models = await modelsModule.initializeModels();
            if (!models) {
                throw new Error('Models initialization failed - no models returned');
            }
            
            console.log('✅ Models initialized for game scheduler');
            console.log('📊 Available models:', Object.keys(models));
        } catch (error) {
            console.error('❌ Error initializing models:', error);
            throw error;
        }
        
        // Step 3: Load services
        console.log('🔄 Loading services...');
        
        periodService = require('../services/periodService');
        gameLogicService = require('../services/gameLogicService');
        
        try {
            await periodService.ensureModelsLoaded();
            console.log('✅ Period service models verified');
        } catch (error) {
            console.error('❌ Period service models failed:', error);
            throw error;
        }
        
        try {
            tronHashService = require('../services/tronHashService');
            await tronHashService.startHashCollection();
            console.log('✅ TRON hash collection initialized');
        } catch (error) {
            console.error('❌ Error initializing TRON hash collection:', error);
            console.log('⚠️ Game results will use fallback hash generation');
        }
        
        console.log('✅ Services loaded for game scheduler');
        
        // Step 4: Initialize Redis
        if (!redis.status === 'ready') {
            console.log('🔄 Waiting for Redis to be ready...');
            await new Promise((resolve) => {
                redis.on('ready', resolve);
            });
        }
        console.log('✅ Redis connection verified for game scheduler');
        
        console.log('✅ GAME SCHEDULER initialization completed - DURATION-BASED ONLY');
    } catch (error) {
        console.error('❌ Failed to initialize game scheduler:', error);
        process.exit(1);
    }
}

/**
 * FIXED: Start duration-based game tick system for scheduler
 */
const startSchedulerGameTicks = async () => {
    try {
        console.log('🕐 Starting SCHEDULER DURATION-BASED game tick system...');
        
        // FIXED: Initialize periods for duration-based combinations only
        for (const [gameType, durations] of Object.entries(GAME_CONFIGS)) {
            for (const duration of durations) {
                try {
                    const key = `${gameType}_${duration}`;
                    
                    // FIXED: Get current period using duration-based calculation (no timeline)
                    const currentPeriod = await periodService.getCurrentPeriod(gameType, duration);
                    
                    if (currentPeriod) {
                        schedulerCurrentPeriods.set(key, currentPeriod);
                        
                        // Store period info in Redis for WebSocket service
                        await storePeriodInRedisForWebSocket(gameType, duration, currentPeriod);
                        
                        console.log(`📅 SCHEDULER loaded [${gameType}|${duration}s]: Period ${currentPeriod.periodId}`);
                    } else {
                        console.warn(`⚠️ No active period for [${gameType}|${duration}s]`);
                    }
                    
                    // Start scheduler ticks for this game/duration combination
                    startSchedulerTicksForGame(gameType, duration);
                    
                } catch (error) {
                    console.error(`❌ Error initializing scheduler for [${gameType}|${duration}s]:`, error.message);
                }
            }
        }
        
        schedulerGameTicksStarted = true;
        console.log('✅ SCHEDULER DURATION-BASED game tick system started');
        
        // Log active combinations
        console.log('\n📋 SCHEDULER ACTIVE COMBINATIONS:');
        Object.entries(GAME_CONFIGS).forEach(([gameType, durations]) => {
            durations.forEach(duration => {
                console.log(`   - ${gameType}_${duration}`);
            });
        });
        console.log(`📊 Total combinations: ${Object.values(GAME_CONFIGS).reduce((sum, durations) => sum + durations.length, 0)}\n`);
        
    } catch (error) {
        console.error('❌ Error starting scheduler game ticks:', error);
        setTimeout(startSchedulerGameTicks, 5000);
    }
};

/**
 * FIXED: Start scheduler ticks for specific game/duration combination
 */
const startSchedulerTicksForGame = (gameType, duration) => {
    const key = `${gameType}_${duration}`;
    
    // Clear existing interval
    if (schedulerGameIntervals.has(key)) {
        clearInterval(schedulerGameIntervals.get(key));
    }
    
    // Start scheduler tick - every 1 second
    const intervalId = setInterval(async () => {
        await schedulerGameTick(gameType, duration);
    }, 1000);
    
    schedulerGameIntervals.set(key, intervalId);
    console.log(`⏰ SCHEDULER started ticks for ${gameType} ${duration}s`);
};

/**
 * FIXED: Scheduler game tick - duration-based period management only
 */
const schedulerGameTick = async (gameType, duration) => {
    try {
        const now = new Date();
        const key = `${gameType}_${duration}`;
        
        // FIXED: Get current period using duration-based calculation (no timeline)
        const currentPeriodInfo = await periodService.getCurrentPeriod(gameType, duration);
        
        if (!currentPeriodInfo || !currentPeriodInfo.active) {
            return;
        }
        
        // Get cached period
        const cachedCurrent = schedulerCurrentPeriods.get(key);
        
        // Check if period has changed (period transition)
        if (!cachedCurrent || cachedCurrent.periodId !== currentPeriodInfo.periodId) {
            console.log(`⚡ SCHEDULER PERIOD TRANSITION [${gameType}|${duration}s]: ${cachedCurrent?.periodId} → ${currentPeriodInfo.periodId}`);
            
            // Process previous period results (EXCLUSIVE to scheduler)
            if (cachedCurrent && cachedCurrent.periodId !== currentPeriodInfo.periodId) {
                setImmediate(() => {
                    processSchedulerPeriodEnd(gameType, duration, cachedCurrent.periodId);
                });
            }
            
            // Update cached period
            schedulerCurrentPeriods.set(key, currentPeriodInfo);
            
            // Store new period in Redis for WebSocket service
            await storePeriodInRedisForWebSocket(gameType, duration, currentPeriodInfo);
            
            // Publish period start event for WebSocket service
            await publishPeriodStart(gameType, duration, currentPeriodInfo);
            
            console.log(`📢 SCHEDULER broadcasted period start: ${currentPeriodInfo.periodId}`);
        }
        
        // Update cached period with latest time info
        const currentPeriod = schedulerCurrentPeriods.get(key);
        if (currentPeriod) {
            currentPeriod.timeRemaining = currentPeriodInfo.timeRemaining;
            currentPeriod.bettingOpen = currentPeriodInfo.bettingOpen;
            
            // Update Redis for WebSocket service
            await storePeriodInRedisForWebSocket(gameType, duration, currentPeriod);
        }
        
        // Handle betting closure notification
        if (currentPeriodInfo.timeRemaining <= 5 && currentPeriodInfo.timeRemaining > 0 && currentPeriodInfo.bettingOpen) {
            await publishBettingClosed(gameType, duration, currentPeriodInfo);
        }

    } catch (error) {
        const errorKey = `scheduler_tick_error_${gameType}_${duration}`;
        const lastLogTime = global[errorKey] || 0;
        const now = Date.now();
        
        if (now - lastLogTime > 60000) {
            console.error(`❌ SCHEDULER tick error [${gameType}|${duration}s]:`, error.message);
            global[errorKey] = now;
        }
    }
};

/**
 * FIXED: Store period info in Redis for WebSocket service to read
 */
const storePeriodInRedisForWebSocket = async (gameType, duration, periodInfo) => {
    try {
        // FIXED: Simple Redis key without timeline complexity
        const redisKey = `game_scheduler:${gameType}:${duration}:current`;
        
        const periodData = {
            periodId: periodInfo.periodId,
            gameType,
            duration,
            startTime: periodInfo.startTime.toISOString(),
            endTime: periodInfo.endTime.toISOString(),
            timeRemaining: periodInfo.timeRemaining,
            bettingOpen: periodInfo.bettingOpen,
            updatedAt: new Date().toISOString(),
            source: 'game_scheduler'
        };
        
        await redis.set(redisKey, JSON.stringify(periodData));
        await redis.expire(redisKey, 3600); // Expire in 1 hour
        
    } catch (error) {
        console.error('❌ Error storing period in Redis for WebSocket:', error);
    }
};

/**
 * FIXED: Publish period start event for WebSocket service
 */
const publishPeriodStart = async (gameType, duration, periodInfo) => {
    try {
        const roomId = `${gameType}_${duration}`;
        
        const eventData = {
            gameType,
            duration,
            periodId: periodInfo.periodId,
            timeRemaining: Math.floor(periodInfo.timeRemaining),
            endTime: periodInfo.endTime.toISOString(),
            message: `New period started: ${periodInfo.periodId}`,
            roomId,
            timestamp: new Date().toISOString()
        };
        
        await redis.publish('game_scheduler:period_start', JSON.stringify(eventData));
        
    } catch (error) {
        console.error('❌ Error publishing period start:', error);
    }
};

/**
 * FIXED: Publish betting closed event for WebSocket service
 */
const publishBettingClosed = async (gameType, duration, periodInfo) => {
    try {
        const roomId = `${gameType}_${duration}`;
        
        const eventData = {
            gameType,
            duration,
            periodId: periodInfo.periodId,
            message: `Betting closed for ${periodInfo.periodId}`,
            roomId,
            timestamp: new Date().toISOString()
        };
        
        await redis.publish('game_scheduler:betting_closed', JSON.stringify(eventData));
        
    } catch (error) {
        console.error('❌ Error publishing betting closed:', error);
    }
};

/**
 * FIXED: Process period end - duration-based only
 */
const processSchedulerPeriodEnd = async (gameType, duration, periodId) => {
    const processKey = `scheduler_${gameType}_${duration}_${periodId}`;
    
    try {
        // Prevent duplicate processing
        if (schedulerProcessingLocks.has(processKey)) {
            console.log(`🔒 SCHEDULER: Period ${periodId} already processing`);
            return;
        }
        
        schedulerProcessingLocks.add(processKey);
        
        console.log(`🏁 SCHEDULER: Processing period end [${gameType}|${duration}s]: ${periodId}`);
        
        // Enhanced Redis lock for cross-process safety
        const globalLockKey = `scheduler_result_lock_${gameType}_${duration}_${periodId}`;
        const lockValue = `scheduler_${Date.now()}_${process.pid}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Try to acquire Redis lock with extended timeout
        const lockAcquired = await redis.set(globalLockKey, lockValue, 'EX', 180, 'NX');
        
        if (!lockAcquired) {
            console.log(`⚠️ SCHEDULER: Period ${periodId} already locked by another process`);
            return;
        }
        
        console.log(`🔒 SCHEDULER: Acquired lock for ${periodId}`);
        
        try {
            // Check for existing result
            const existingResult = await checkExistingSchedulerResult(gameType, duration, periodId);
            if (existingResult) {
                console.log(`✅ SCHEDULER: Using existing result for ${periodId}`);
                await publishPeriodResult(gameType, duration, periodId, existingResult, 'existing');
                return;
            }
            
            // Validate period timing
            const periodEndTime = periodService.calculatePeriodEndTime(periodId, duration);
            const now = new Date();
            const timeSinceEnd = (now - periodEndTime) / 1000;
            
            if (timeSinceEnd < -10) {
                console.warn(`⚠️ SCHEDULER: Period ${periodId} hasn't ended yet (${Math.abs(timeSinceEnd)}s early)`);
                return;
            }
            
            if (timeSinceEnd > 600) { // 10 minutes late
                console.warn(`⚠️ SCHEDULER: Period ${periodId} ended too long ago (${timeSinceEnd}s late) - skipping`);
                return;
            }
            
            // Process NEW results using gameLogicService
            console.log(`🎲 SCHEDULER: Generating NEW result for ${periodId}`);
            
            const gameResult = await gameLogicService.processGameResults(
                gameType, 
                duration, 
                periodId
            );
            
            if (gameResult.success) {
                await publishPeriodResult(
                    gameType, 
                    duration, 
                    periodId, 
                    {
                        result: gameResult.gameResult,
                        winners: gameResult.winners || [],
                        verification: gameResult.verification
                    }, 
                    'new'
                );
                
                console.log(`✅ SCHEDULER: NEW result processed for ${periodId}: ${JSON.stringify(gameResult.gameResult)}`);
                
            } else {
                throw new Error(gameResult.message || 'Failed to process results');
            }
            
        } catch (processError) {
            console.error(`❌ SCHEDULER: Result processing error for ${periodId}:`, processError.message);
            
            // Generate fallback result
            try {
                console.log(`🎲 SCHEDULER: Generating fallback result for ${periodId}`);
                
                const fallbackResult = await generateSchedulerFallbackResult(gameType);
                
                await publishPeriodResult(
                    gameType, 
                    duration, 
                    periodId, 
                    {
                        result: fallbackResult,
                        winners: [],
                        verification: null
                    }, 
                    'fallback'
                );
                
                console.log(`✅ SCHEDULER: Fallback result generated for ${periodId}`);
                
            } catch (fallbackError) {
                console.error(`❌ SCHEDULER: Fallback result generation failed for ${periodId}:`, fallbackError.message);
                
                // Publish error event
                await publishPeriodError(gameType, duration, periodId, 'Failed to generate result');
            }
        } finally {
            // Always release lock
            try {
                const currentLock = await redis.get(globalLockKey);
                if (currentLock === lockValue) {
                    await redis.del(globalLockKey);
                    console.log(`🔓 SCHEDULER: Released lock for ${periodId}`);
                }
            } catch (lockError) {
                console.error('❌ SCHEDULER: Error releasing lock:', lockError);
            }
        }

    } catch (error) {
        console.error(`❌ SCHEDULER: Period end error for ${periodId}:`, error);
    } finally {
        schedulerProcessingLocks.delete(processKey);
    }
};

/**
 * FIXED: Check existing result for scheduler - duration-based only
 */
const checkExistingSchedulerResult = async (gameType, duration, periodId) => {
    try {
        const whereClause = { 
            duration: duration
            // REMOVED: timeline filter - not needed anymore
        };
        
        let existingResult = null;
        
        switch (gameType.toLowerCase()) {
            case 'wingo':
                whereClause.bet_number = periodId;
                existingResult = await models.BetResultWingo.findOne({
                    where: whereClause,
                    order: [['created_at', 'DESC']]
                });
                
                if (existingResult) {
                    return {
                        result: {
                            number: existingResult.result_of_number,
                            color: existingResult.result_of_color,
                            size: existingResult.result_of_size
                        },
                        winners: []
                    };
                }
                break;
                
            case 'trx_wix':
                whereClause.period = periodId;
                existingResult = await models.BetResultTrxWix.findOne({
                    where: whereClause,
                    order: [['created_at', 'DESC']]
                });
                
                if (existingResult) {
                    let resultData;
                    try {
                        resultData = typeof existingResult.result === 'string' ? 
                            JSON.parse(existingResult.result) : existingResult.result;
                    } catch (parseError) {
                        console.warn('SCHEDULER: Error parsing result:', parseError);
                        return null;
                    }
                    
                    return {
                        result: resultData,
                        verification: {
                            hash: existingResult.verification_hash,
                            link: existingResult.verification_link
                        },
                        winners: []
                    };
                }
                break;
                
            case 'fived':
            case '5d':
                whereClause.bet_number = periodId;
                existingResult = await models.BetResult5D.findOne({
                    where: whereClause,
                    order: [['created_at', 'DESC']]
                });
                
                if (existingResult) {
                    return {
                        result: {
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
                whereClause.bet_number = periodId;
                existingResult = await models.BetResultK3.findOne({
                    where: whereClause,
                    order: [['created_at', 'DESC']]
                });
                
                if (existingResult) {
                    return {
                        result: {
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
        console.error(`❌ SCHEDULER: Error checking existing result:`, error);
        return null;
    }
};

/**
 * FIXED: Generate fallback result for scheduler
 */
const generateSchedulerFallbackResult = async (gameType) => {
    try {
        const randomBase = Date.now() % 10000;
        
        switch (gameType.toLowerCase()) {
            case 'wingo':
            case 'trx_wix':
                const number = randomBase % 10;
                const color = getColorForNumber(number);
                return {
                    number: number,
                    size: number >= 5 ? 'Big' : 'Small',
                    color: color,
                    verification: gameType === 'trx_wix' ? {
                        hash: generateVerificationHash(),
                        link: generateVerificationLink()
                    } : undefined
                };

            case 'fived':
            case '5d':
                const dice = [];
                for (let i = 0; i < 5; i++) {
                    dice.push(((randomBase + i) % 6) + 1);
                }
                return {
                    A: dice[0], B: dice[1], C: dice[2], D: dice[3], E: dice[4],
                    sum: dice.reduce((a, b) => a + b, 0)
                };

            case 'k3':
                const k3Dice = [];
                for (let i = 0; i < 3; i++) {
                    k3Dice.push(((randomBase + i) % 6) + 1);
                }
                const sum = k3Dice.reduce((a, b) => a + b, 0);
                const counts = k3Dice.reduce((acc, val) => {
                    acc[val] = (acc[val] || 0) + 1;
                    return acc;
                }, {});

                return {
                    dice_1: k3Dice[0], dice_2: k3Dice[1], dice_3: k3Dice[2],
                    sum: sum,
                    has_pair: Object.values(counts).includes(2) && !Object.values(counts).includes(3),
                    has_triple: Object.values(counts).includes(3),
                    is_straight: k3Dice.sort((a, b) => a - b).every((val, idx, arr) =>
                        idx === 0 || val === arr[idx - 1] + 1
                    ),
                    sum_size: sum > 10 ? 'Big' : 'Small',
                    sum_parity: sum % 2 === 0 ? 'Even' : 'Odd'
                };

            default:
                throw new Error(`Unsupported game type: ${gameType}`);
        }
    } catch (error) {
        console.error('❌ SCHEDULER: Error generating fallback result:', error);
        throw error;
    }
};

/**
 * FIXED: Publish period result for WebSocket service
 */
const publishPeriodResult = async (gameType, duration, periodId, resultData, source) => {
    try {
        const roomId = `${gameType}_${duration}`;
        
        const eventData = {
            gameType,
            duration,
            periodId,
            result: resultData.result,
            winners: resultData.winners || [],
            winnerCount: Array.isArray(resultData.winners) ? resultData.winners.length : 0,
            totalPayout: Array.isArray(resultData.winners) ? 
                resultData.winners.reduce((sum, winner) => sum + (winner.winnings || 0), 0) : 0,
            verification: resultData.verification,
            timestamp: new Date().toISOString(),
            source: `scheduler_${source}`,
            roomId
        };

        await redis.publish('game_scheduler:period_result', JSON.stringify(eventData));
        
        console.log(`📢 SCHEDULER: Published result for ${periodId} (${source}) to ${roomId}`);

    } catch (error) {
        console.error('❌ SCHEDULER: Error publishing period result:', error);
    }
};

/**
 * FIXED: Publish period error for WebSocket service
 */
const publishPeriodError = async (gameType, duration, periodId, message) => {
    try {
        const roomId = `${gameType}_${duration}`;
        
        const eventData = {
            gameType,
            duration,
            periodId,
            message,
            timestamp: new Date().toISOString(),
            source: 'scheduler_error',
            roomId
        };

        await redis.publish('game_scheduler:period_error', JSON.stringify(eventData));

    } catch (error) {
        console.error('❌ SCHEDULER: Error publishing period error:', error);
    }
};

/**
 * Utility functions
 */
const getColorForNumber = (number) => {
    const colorMap = {
        0: 'red_violet', 1: 'green', 2: 'red', 3: 'green', 4: 'red',
        5: 'green_violet', 6: 'red', 7: 'green', 8: 'red', 9: 'green'
    };
    return colorMap[number];
};

const generateVerificationHash = () => {
    const crypto = require('crypto');
    return crypto.randomBytes(32).toString('hex');
};

const generateVerificationLink = () => {
    const hash = generateVerificationHash();
    return `https://tronscan.org/#/transaction/${hash}`;
};

/**
 * FIXED: Reset all sequence counters at 2 AM IST - duration-based only
 */
const resetDailySequences = async () => {
    const lockKey = 'daily_sequence_reset_lock';
    const lockValue = `${Date.now()}_${process.pid}`;
    
    try {
        console.log('🔄 SCHEDULER: Starting daily sequence reset at 2 AM IST...');
        
        const acquired = await redis.set(lockKey, lockValue, 'EX', 600, 'NX');
        
        if (!acquired) {
            console.log('⚠️ SCHEDULER: Daily reset already running on another instance, skipping...');
            return;
        }

        console.log('🔒 SCHEDULER: Acquired reset lock, proceeding with daily sequence reset');
        
        const today = moment.tz('Asia/Kolkata').format('YYYYMMDD');
        
        console.log(`🔄 SCHEDULER: Resetting daily sequences for ${today}`);

        let resetCount = 0;
        for (const [gameType, durations] of Object.entries(GAME_CONFIGS)) {
            for (const duration of durations) {
                try {
                    // FIXED: Simple sequence key without timeline complexity
                    const sequenceKey = `${gameType}:${duration}:daily_sequence:${today}`;
                    await redis.set(sequenceKey, '0');
                    
                    const tomorrow2AM = moment.tz('Asia/Kolkata')
                        .add(1, 'day')
                        .hour(2)
                        .minute(0)
                        .second(0);
                    const expirySeconds = Math.max(3600, tomorrow2AM.diff(moment.tz('Asia/Kolkata'), 'seconds'));
                    await redis.expire(sequenceKey, expirySeconds);
                    
                    resetCount++;
                    console.log(`✅ SCHEDULER: Reset sequence for ${gameType}:${duration}`);
                } catch (sequenceError) {
                    console.error(`❌ SCHEDULER: Failed to reset sequence for ${gameType}:${duration}:`, sequenceError);
                }
            }
        }

        console.log(`✅ SCHEDULER: Daily sequence reset completed! Reset ${resetCount} sequences`);
        logger.info('SCHEDULER: Daily sequence reset completed', {
            date: today,
            resetCount,
            timestamp: moment.tz('Asia/Kolkata').toISOString()
        });

    } catch (error) {
        console.error('❌ SCHEDULER: Error in daily sequence reset:', error);
        logger.error('SCHEDULER: Error in daily sequence reset:', {
            error: error.message,
            stack: error.stack,
            timestamp: moment.tz('Asia/Kolkata').toISOString()
        });
    } finally {
        try {
            const currentValue = await redis.get(lockKey);
            if (currentValue === lockValue) {
                await redis.del(lockKey);
                console.log('🔓 SCHEDULER: Released reset lock');
            }
        } catch (lockError) {
            console.error('❌ SCHEDULER: Error releasing reset lock:', lockError);
        }
    }
};

// Schedule daily period sequence reset at 2 AM IST
cron.schedule('0 2 * * *', async () => {
    console.log('🕐 SCHEDULER: 2 AM IST - Starting daily period sequence reset...');
    try {
        await resetDailySequences();
    } catch (error) {
        console.error('❌ SCHEDULER: Failed to run daily sequence reset:', error);
        logger.error('SCHEDULER: Failed to run daily sequence reset:', {
            error: error.message,
            stack: error.stack
        });
    }
}, {
    timezone: "Asia/Kolkata"
});

// Schedule hourly TRON hash collection refresh
cron.schedule('0 * * * *', async () => {
    console.log('🔄 SCHEDULER: Refreshing TRON hash collection...');
    try {
        if (tronHashService) {
            await tronHashService.startHashCollection();
            console.log('✅ SCHEDULER: TRON hash collection refreshed');
        }
    } catch (error) {
        console.error('❌ SCHEDULER: Failed to refresh TRON hash collection:', error);
    }
});

// FIXED: Start the game scheduler with duration-based period management
const startGameScheduler = async () => {
    try {
        await initialize();
        
        // Start duration-based game tick system
        await startSchedulerGameTicks();
        
        logger.info('✅ SCHEDULER: Game scheduler started successfully with DURATION-BASED period management');
        
        // Log all scheduled cron jobs
        console.log('\n📅 SCHEDULER CRON JOBS:');
        console.log('⏰ 2:00 AM IST - Daily period sequence reset');
        console.log('⏰ Every hour - TRON hash collection refresh');
        console.log('🎮 SCHEDULER handles ALL period management and result processing');
        console.log('📡 WebSocket service handles ONLY broadcasting');
        console.log('🎯 FIXED: Duration-based rooms only (no timeline multiplication)\n');
        
        return true;
        
    } catch (error) {
        logger.error('❌ SCHEDULER: Error starting game scheduler:', error);
        return false;
    }
};

// Handle process termination
process.on('SIGINT', () => {
    logger.info('SCHEDULER: Game scheduler stopped');
    
    // Clean up intervals
    schedulerGameIntervals.forEach((intervalId, key) => {
        clearInterval(intervalId);
        console.log(`⏹️ SCHEDULER: Stopped ticks for ${key}`);
    });
    
    process.exit(0);
});

// Export for use in other files
module.exports = {
    startGameScheduler,
    resetDailySequences,
    
    // Status functions
    getSchedulerStats: () => ({
        schedulerGameTicksStarted,
        activeSchedulerIntervals: schedulerGameIntervals.size,
        cachedSchedulerPeriods: schedulerCurrentPeriods.size,
        processingLocks: schedulerProcessingLocks.size,
        supportedGames: Object.keys(GAME_CONFIGS),
        gameConfigs: GAME_CONFIGS,
        mode: 'DURATION_BASED_PERIOD_MANAGEMENT',
        totalRooms: Object.values(GAME_CONFIGS).reduce((sum, durations) => sum + durations.length, 0)
    }),
    
    // Debug function
    verifySchedulerTicks: () => {
        console.log('🔍 Verifying SCHEDULER DURATION-BASED tick system...');
        
        const expectedIntervals = Object.values(GAME_CONFIGS).reduce((sum, durations) => sum + durations.length, 0);
        const activeIntervals = schedulerGameIntervals.size;
        
        console.log(`📊 Scheduler tick system status:`);
        console.log(`   - Active intervals: ${activeIntervals}`);
        console.log(`   - Expected intervals: ${expectedIntervals}`);
        console.log(`   - System started: ${schedulerGameTicksStarted}`);
        console.log(`   - Cached periods: ${schedulerCurrentPeriods.size}`);
        console.log(`   - Processing locks: ${schedulerProcessingLocks.size}`);
        
        // Show detailed status
        Object.keys(GAME_CONFIGS).forEach(gameType => {
            console.log(`\n📋 ${gameType.toUpperCase()} rooms:`);
            GAME_CONFIGS[gameType].forEach(duration => {
                const key = `${gameType}_${duration}`;
                const hasInterval = schedulerGameIntervals.has(key);
                const hasCachedPeriod = schedulerCurrentPeriods.has(key);
                console.log(`   - ${key}: ${hasInterval ? '✅' : '❌'} Interval | ${hasCachedPeriod ? '✅' : '❌'} Period`);
            });
        });
        
        return {
            active: activeIntervals,
            expected: expectedIntervals,
            started: schedulerGameTicksStarted,
            working: activeIntervals === expectedIntervals && schedulerGameTicksStarted
        };
    }
};

// Don't auto-start if this file is run directly
if (require.main === module) {
    console.log('🚫 SCHEDULER: Auto-start disabled - use start-scheduler.js instead');
}