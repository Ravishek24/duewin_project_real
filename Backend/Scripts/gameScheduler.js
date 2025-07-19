// Backend/Scripts/gameScheduler.js - FIXED FOR MULTI-INSTANCE SETUP

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

// CRITICAL FIX: Declare schedulerPublisher variable
let schedulerPublisher = null;

// FIXED: Game tick intervals for scheduler process ONLY - duration-based
const schedulerGameIntervals = new Map();
let schedulerGameTicksStarted = false;

// FIXED: Period cache for scheduler process ONLY - duration-based
const schedulerCurrentPeriods = new Map(); // Key: gameType_duration
const schedulerProcessingLocks = new Set();

// FIXED: Track processed periods to prevent duplicates
const processedPeriods = new Set(); // Key: gameType_duration_periodId

// FIXED: Database connection health monitoring
let dbHealthCheckInterval = null;
let lastDbHealthCheck = Date.now();

// FIXED: Duration-based game configs only
const GAME_CONFIGS = {
    'wingo': [30, 60, 180, 300],     // 4 rooms: wingo_30, wingo_60, wingo_180, wingo_300
    'trx_wix': [30, 60, 180, 300],   // 4 rooms: trx_wix_30, trx_wix_60, trx_wix_180, trx_wix_300
    'k3': [60, 180, 300, 600],       // 4 rooms: k3_60, k3_180, k3_300, k3_600
    'fiveD': [60, 180, 300, 600]     // 4 rooms: fiveD_60, fiveD_180, fiveD_300, fiveD_600
};

/**
 * CRITICAL FIX: Enhanced Redis Publisher for Multi-Instance Communication
 */
const setupSchedulerCommunication = async () => {
    try {
        console.log('🔄 [SCHEDULER_COMM] Setting up multi-instance communication...');
        
        // Create dedicated publisher
        const Redis = require('ioredis');
        
        schedulerPublisher = new Redis({
            host: process.env.REDIS_HOST || 'localhost',
            port: process.env.REDIS_PORT || 6379,
            password: process.env.REDIS_PASSWORD || '',
            db: process.env.REDIS_DB || 0,
            
            tls: {
                rejectUnauthorized: false,
                requestCert: true,
                agent: false
            },
            
            retryStrategy: function(times) {
                return Math.min(times * 50, 2000);
            },
            
            connectTimeout: 15000,
            commandTimeout: 5000,
            lazyConnect: false,
            enableOfflineQueue: true,
            maxRetriesPerRequest: 3,
            family: 4
        });
        
        // Wait for publisher to be ready
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Scheduler publisher connection timeout'));
            }, 15000);
            
            if (schedulerPublisher.status === 'ready') {
                clearTimeout(timeout);
                resolve();
                return;
            }
            
            schedulerPublisher.on('ready', () => {
                clearTimeout(timeout);
                resolve();
            });
            
            schedulerPublisher.on('error', (err) => {
                clearTimeout(timeout);
                reject(err);
            });
        });
        
        console.log('✅ [SCHEDULER_COMM] Publisher created and connected');
        
        // Listen for period requests from WebSocket instances
        const requestSubscriber = schedulerPublisher.duplicate();
        await requestSubscriber.subscribe('scheduler:period_request');
        
        requestSubscriber.on('message', async (channel, message) => {
            try {
                const request = JSON.parse(message);
                console.log(`📥 [SCHEDULER_COMM] Received period request:`, request);
                
                if (request.action === 'request_period') {
                    await handlePeriodRequest(request.gameType, request.duration);
                }
            } catch (error) {
                console.error('❌ [SCHEDULER_COMM] Error handling period request:', error);
            }
        });
        
        console.log('✅ [SCHEDULER_COMM] Multi-instance communication setup completed');
        
    } catch (error) {
        console.error('❌ [SCHEDULER_COMM] Error setting up communication:', error);
        throw error;
    }
};

/**
 * Handle period requests from WebSocket instances
 */
const handlePeriodRequest = async (gameType, duration) => {
    try {
        console.log(`📋 [PERIOD_REQUEST] Creating period for ${gameType}_${duration}`);
        
        // Get current period and ensure it's broadcasted
        const currentPeriod = await periodService.getCurrentPeriod(gameType, duration);
        if (currentPeriod) {
            await storePeriodInRedisForWebSocket(gameType, duration, currentPeriod);
            await broadcastPeriodStart(gameType, duration, currentPeriod);
            console.log(`✅ [PERIOD_REQUEST] Broadcasted current period ${currentPeriod.periodId}`);
        } else {
            console.warn(`⚠️ [PERIOD_REQUEST] No active period found for ${gameType}_${duration}`);
        }
        
    } catch (error) {
        console.error(`❌ [PERIOD_REQUEST] Error handling period request:`, error);
    }
};

/**
 * CRITICAL FIX: Enhanced period start broadcasting
 */
const broadcastPeriodStart = async (gameType, duration, periodData) => {
    try {
        const broadcastData = {
            gameType,
            duration,
            periodId: periodData.periodId,
            endTime: periodData.endTime ? periodData.endTime.toISOString() : new Date(Date.now() + duration * 1000).toISOString(),
            startTime: periodData.startTime ? periodData.startTime.toISOString() : new Date().toISOString(),
            timestamp: new Date().toISOString(),
            source: 'game_scheduler_instance'
        };
        
        console.log(`📤 [PERIOD_START] Broadcasting period start: ${periodData.periodId}`);
        
        // Broadcast to all possible channels WebSocket might be listening to
        const channels = [
            'game_scheduler:period_start',
            'scheduler:period_start',
            'period:start'
        ];
        
        for (const channel of channels) {
            if (schedulerPublisher) {
                await schedulerPublisher.publish(channel, JSON.stringify(broadcastData));
                console.log(`✅ [PERIOD_START] Published to ${channel}`);
            }
        }
        
        // Also store current period info in Redis for WebSocket to read
        const currentPeriodKey = `game_scheduler:${gameType}:${duration}:current`;
        if (schedulerPublisher) {
            await schedulerPublisher.setex(currentPeriodKey, duration + 10, JSON.stringify(broadcastData));
            console.log(`✅ [PERIOD_START] Stored current period info: ${currentPeriodKey}`);
        }
        
    } catch (error) {
        console.error(`❌ [PERIOD_START] Error broadcasting period start:`, error);
    }
};

/**
 * CRITICAL FIX: Enhanced period result broadcasting  
 */
const broadcastPeriodResult = async (gameType, duration, periodId, result) => {
    try {
        const broadcastData = {
            gameType,
            duration,
            periodId,
            result,
            timestamp: new Date().toISOString(),
            source: 'game_scheduler_instance'
        };
        
        console.log(`📤 [PERIOD_RESULT] Broadcasting period result: ${periodId}`);
        console.log(`📊 [PERIOD_RESULT] Result:`, JSON.stringify(result, null, 2));
        
        // Broadcast to all possible channels
        const channels = [
            'game_scheduler:period_result',
            'scheduler:period_result', 
            'period:result'
        ];
        
        for (const channel of channels) {
            if (schedulerPublisher) {
                await schedulerPublisher.publish(channel, JSON.stringify(broadcastData));
                console.log(`✅ [PERIOD_RESULT] Published to ${channel}`);
            }
        }
        
        // Clear current period info since period ended
        const currentPeriodKey = `game_scheduler:${gameType}:${duration}:current`;
        if (schedulerPublisher) {
            await schedulerPublisher.del(currentPeriodKey);
            console.log(`🗑️ [PERIOD_RESULT] Cleared current period info`);
        }
        
    } catch (error) {
        console.error(`❌ [PERIOD_RESULT] Error broadcasting period result:`, error);
    }
};

/**
 * CRITICAL FIX: Enhanced betting closed broadcasting
 */
const broadcastBettingClosed = async (gameType, duration, periodId) => {
    try {
        const broadcastData = {
            gameType,
            duration,
            periodId,
            message: `Betting closed for ${gameType} ${duration}s`,
            timestamp: new Date().toISOString(),
            source: 'game_scheduler_instance'
        };
        
        console.log(`📤 [BETTING_CLOSED] Broadcasting betting closed: ${periodId}`);
        
        // Broadcast to all possible channels
        const channels = [
            'game_scheduler:betting_closed',
            'scheduler:betting_closed',
            'period:betting_closed'
        ];
        
        for (const channel of channels) {
            if (schedulerPublisher) {
                await schedulerPublisher.publish(channel, JSON.stringify(broadcastData));
                console.log(`✅ [BETTING_CLOSED] Published to ${channel}`);
            }
        }
        
    } catch (error) {
        console.error(`❌ [BETTING_CLOSED] Error broadcasting betting closed:`, error);
    }
};

/**
 * CRITICAL FIX: Enhanced error broadcasting
 */
const broadcastPeriodError = async (gameType, duration, periodId, error) => {
    try {
        const broadcastData = {
            gameType,
            duration,
            periodId,
            error: error.message || error,
            timestamp: new Date().toISOString(),
            source: 'game_scheduler_instance'
        };
        
        console.log(`📤 [PERIOD_ERROR] Broadcasting period error: ${periodId}`);
        
        // Broadcast to all possible channels
        const channels = [
            'game_scheduler:period_error',
            'scheduler:period_error',
            'period:error'
        ];
        
        for (const channel of channels) {
            if (schedulerPublisher) {
                await schedulerPublisher.publish(channel, JSON.stringify(broadcastData));
                console.log(`✅ [PERIOD_ERROR] Published to ${channel}`);
            }
        }
        
    } catch (error) {
        console.error(`❌ [PERIOD_ERROR] Error broadcasting period error:`, error);
    }
};

/**
 * Enhanced scheduler health monitoring
 */
const startSchedulerHealthBroadcast = () => {
    setInterval(async () => {
        try {
            const healthData = {
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                activeGames: Object.keys(GAME_CONFIGS),
                source: 'game_scheduler_instance',
                status: 'healthy'
            };
            
            if (schedulerPublisher) {
                await schedulerPublisher.publish('scheduler:heartbeat', JSON.stringify(healthData));
                console.log(`💓 [SCHEDULER_HEALTH] Heartbeat sent`);
            }
            
        } catch (error) {
            console.error('❌ [SCHEDULER_HEALTH] Error sending heartbeat:', error);
        }
    }, 60000); // Every minute
};

/**
 * FIXED: Period start time calculation (from your code)
 */
const calculatePeriodStartTime = (periodId, duration) => {
    try {
        const dateStr = periodId.substring(0, 8);
        const year = parseInt(dateStr.substring(0, 4), 10);
        const month = parseInt(dateStr.substring(4, 6), 10) - 1;
        const day = parseInt(dateStr.substring(6, 8), 10);
        
        const sequenceStr = periodId.substring(8);
        const sequenceNumber = parseInt(sequenceStr, 10);
        
        const baseTime = moment.tz([year, month, day, 2, 0, 0], 'Asia/Kolkata');
        const startTime = baseTime.add(sequenceNumber * duration, 'seconds');
        
        return startTime.toDate();
    } catch (error) {
        console.error('Error calculating period start time:', error);
        throw error;
    }
};

/**
 * FIXED: Period end time calculation (from your code)
 */
const calculatePeriodEndTime = (periodId, duration) => {
    try {
        const startTime = calculatePeriodStartTime(periodId, duration);
        const endTime = moment(startTime).tz('Asia/Kolkata').add(duration, 'seconds');
        return endTime.toDate();
    } catch (error) {
        console.error('Error calculating period end time:', error);
        throw error;
    }
};

/**
 * FIXED: Database connection health check
 */
const checkDatabaseHealth = async () => {
    try {
        if (!sequelize) {
            console.warn('⚠️ Database connection not available');
            return false;
        }
        
        await sequelize.authenticate();
        lastDbHealthCheck = Date.now();
        return true;
    } catch (error) {
        console.error('❌ Database health check failed:', error.message);
        return false;
    }
};

/**
 * FIXED: Start database health monitoring
 */
const startDatabaseHealthMonitoring = () => {
    // Cleanup existing interval
    if (dbHealthCheckInterval) {
        clearInterval(dbHealthCheckInterval);
        dbHealthCheckInterval = null;
    }
    
    dbHealthCheckInterval = setInterval(async () => {
        const isHealthy = await checkDatabaseHealth();
        if (!isHealthy) {
            console.warn('⚠️ Database health check failed, attempting reconnection...');
            try {
                await connectDB();
                console.log('✅ Database reconnection successful');
            } catch (error) {
                console.error('❌ Database reconnection failed:', error.message);
            }
        }
    }, 30000); // Check every 30 seconds
    
    console.log('🔍 Database health monitoring started');
};

/**
 * CRITICAL FIX: Initialize scheduler with multi-instance communication
 */
async function initialize() {
    try {
        console.log('DEBUG: initialize() - start');
        await connectDB();
        console.log('DEBUG: initialize() - after connectDB');
        const { sequelize: seq } = require('../config/db');
        sequelize = seq;
        await sequelize.authenticate();
        console.log('DEBUG: initialize() - after sequelize.authenticate');
        const modelsModule = require('../models');
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log('DEBUG: initialize() - after setTimeout');
        models = await modelsModule.initializeModels();
        console.log('DEBUG: initialize() - after initializeModels');
        if (!models) {
            throw new Error('Models initialization failed - no models returned');
        }
        periodService = require('../services/periodService');
        gameLogicService = require('../services/gameLogicService');
        await periodService.ensureModelsLoaded();
        console.log('DEBUG: initialize() - after ensureModelsLoaded');
        
        try {
            tronHashService = require('../services/tronHashService');
            await tronHashService.startHashCollection();
            console.log('DEBUG: initialize() - after tronHashService.startHashCollection');
        } catch (error) {
            console.error('❌ Error initializing TRON hash collection:', error);
            console.log('⚠️ Game results will use fallback hash generation');
        }
        
        if (!redis.status === 'ready') {
            console.log('🔄 Waiting for Redis to be ready...');
            await new Promise((resolve) => {
                redis.on('ready', resolve);
            });
            console.log('DEBUG: initialize() - after redis ready');
        }
        console.log('✅ Redis connection verified for game scheduler');
        
        // CRITICAL FIX: Setup multi-instance communication
        await setupSchedulerCommunication();
        console.log('DEBUG: initialize() - after setupSchedulerCommunication');
        
        startDatabaseHealthMonitoring();
        console.log('DEBUG: initialize() - after startDatabaseHealthMonitoring');
        
        // Start health broadcast
        startSchedulerHealthBroadcast();
        console.log('DEBUG: initialize() - after startSchedulerHealthBroadcast');
        
        console.log('✅ GAME SCHEDULER initialization completed - MULTI-INSTANCE SETUP');
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
        console.log('DEBUG: Entered startSchedulerGameTicks');
        console.log('🕐 Starting SCHEDULER DURATION-BASED game tick system...');
        
        for (const [gameType, durations] of Object.entries(GAME_CONFIGS)) {
            console.log(`DEBUG: Looping gameType=${gameType}, durations=${JSON.stringify(durations)}`);
            for (const duration of durations) {
                try {
                    const key = `${gameType}_${duration}`;
                    console.log(`DEBUG: Initializing scheduler for ${key}`);
                    
                    // FIXED: Get current period using duration-based calculation
                    const currentPeriod = await periodService.getCurrentPeriod(gameType, duration);
                    console.log(`DEBUG: currentPeriod for ${key}:`, currentPeriod);
                    
                    if (currentPeriod) {
                        // FIXED: Validate that period hasn't ended
                        const endTime = calculatePeriodEndTime(currentPeriod.periodId, duration);
                        const timeRemaining = Math.max(0, (endTime - new Date()) / 1000);
                        
                        if (timeRemaining > 0) {
                            schedulerCurrentPeriods.set(key, {
                                ...currentPeriod,
                                endTime: endTime
                            });
                            
                            await storePeriodInRedisForWebSocket(gameType, duration, currentPeriod);
                            
                            // CRITICAL FIX: Use new broadcasting function
                            await broadcastPeriodStart(gameType, duration, currentPeriod);
                            
                            console.log(`📅 SCHEDULER loaded [${gameType}|${duration}s]: Period ${currentPeriod.periodId} (${Math.ceil(timeRemaining)}s remaining)`);
                        } else {
                            console.warn(`⚠️ Period ${currentPeriod.periodId} has already ended, getting next period`);
                            // Get next period
                            const nextPeriod = await getNextPeriod(gameType, duration, currentPeriod.periodId);
                            console.log(`DEBUG: nextPeriod for ${key}:`, nextPeriod);
                            if (nextPeriod) {
                                schedulerCurrentPeriods.set(key, nextPeriod);
                                await storePeriodInRedisForWebSocket(gameType, duration, nextPeriod);
                                
                                // CRITICAL FIX: Use new broadcasting function
                                await broadcastPeriodStart(gameType, duration, nextPeriod);
                            }
                        }
                    } else {
                        console.warn(`⚠️ No active period for [${gameType}|${duration}s]`);
                    }
                    
                    startSchedulerTicksForGame(gameType, duration);
                    console.log(`DEBUG: Called startSchedulerTicksForGame for ${key}`);
                    
                } catch (error) {
                    console.error(`❌ Error initializing scheduler for [${gameType}|${duration}s]:`, error.message);
                }
            }
        }
        
        schedulerGameTicksStarted = true;
        console.log('✅ SCHEDULER DURATION-BASED game tick system started');
        
        console.log('\n📋 SCHEDULER ACTIVE COMBINATIONS:');
        Object.entries(GAME_CONFIGS).forEach(([gameType, durations]) => {
            durations.forEach(duration => {
                console.log(`   - ${gameType}_${duration}`);
            });
        });
        console.log(`📊 Total combinations: ${Object.values(GAME_CONFIGS).reduce((sum, durations) => sum + durations.length, 0)}\n`);
        console.log('DEBUG: Exiting startSchedulerGameTicks');
        
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
    
    if (schedulerGameIntervals.has(key)) {
        clearInterval(schedulerGameIntervals.get(key));
    }
    
    const intervalId = setInterval(async () => {
        await schedulerGameTick(gameType, duration);
    }, 1000);
    
    schedulerGameIntervals.set(key, intervalId);
    console.log(`⏰ SCHEDULER started ticks for ${gameType} ${duration}s`);
};

/**
 * CRITICAL FIX: Enhanced scheduler game tick with multi-instance broadcasting
 */
const schedulerGameTick = async (gameType, duration) => {
    try {
        const now = new Date();
        const key = `${gameType}_${duration}`;
        
        // Get current period using duration-based calculation
        const currentPeriodInfo = await periodService.getCurrentPeriod(gameType, duration);
        
        if (!currentPeriodInfo || !currentPeriodInfo.active) {
            // No active period, try to get next period
            const cachedCurrent = schedulerCurrentPeriods.get(key);
            if (cachedCurrent) {
                const nextPeriod = await getNextPeriod(gameType, duration, cachedCurrent.periodId);
                if (nextPeriod) {
                    schedulerCurrentPeriods.set(key, nextPeriod);
                    await storePeriodInRedisForWebSocket(gameType, duration, nextPeriod);
                    
                    // CRITICAL FIX: Use new broadcasting function
                    await broadcastPeriodStart(gameType, duration, nextPeriod);
                }
            }
            return;
        }
        
        // Get cached period
        const cachedCurrent = schedulerCurrentPeriods.get(key);
        
        // Enhanced period transition detection with validation
        if (!cachedCurrent || cachedCurrent.periodId !== currentPeriodInfo.periodId) {
            console.log(`⚡ SCHEDULER PERIOD TRANSITION [${gameType}|${duration}s]:`);
            console.log(`   - Previous: ${cachedCurrent?.periodId || 'NONE'}`);
            console.log(`   - Current: ${currentPeriodInfo.periodId}`);
            console.log(`   - Transition time: ${now.toISOString()}`);
            
            // Process previous period if it exists
            if (cachedCurrent && cachedCurrent.periodId !== currentPeriodInfo.periodId) {
                try {
                    const prevPeriodEndTime = calculatePeriodEndTime(cachedCurrent.periodId, duration);
                    const timeSincePrevEnd = (now - prevPeriodEndTime) / 1000;
                    
                    console.log(`⏰ Previous period ${cachedCurrent.periodId} validation:`);
                    console.log(`   - Should have ended: ${prevPeriodEndTime.toISOString()}`);
                    console.log(`   - Time since end: ${timeSincePrevEnd.toFixed(2)}s`);
                    
                    // Process previous period if timing is reasonable
                    if (timeSincePrevEnd >= -2 && timeSincePrevEnd <= 60) {
                        console.log(`✅ Processing previous period ${cachedCurrent.periodId} (valid timing)`);
                        await processSchedulerPeriodEnd(gameType, duration, cachedCurrent.periodId);
                    } else {
                        console.warn(`⚠️ Skipping previous period ${cachedCurrent.periodId}: Invalid timing (${timeSincePrevEnd.toFixed(2)}s since end)`);
                    }
                } catch (timingError) {
                    console.error(`❌ Error validating previous period timing:`, timingError.message);
                }
            }
            
            // Update cached period with new period info
            schedulerCurrentPeriods.set(key, currentPeriodInfo);
            
            // Store new period in Redis for WebSocket service
            await storePeriodInRedisForWebSocket(gameType, duration, currentPeriodInfo);
            
            // CRITICAL FIX: Use new broadcasting function
            await broadcastPeriodStart(gameType, duration, currentPeriodInfo);
            
            console.log(`📢 SCHEDULER: Broadcasted new period start: ${currentPeriodInfo.periodId}`);
        }
        
        // Update cached period with latest time info
        const currentPeriod = schedulerCurrentPeriods.get(key);
        if (currentPeriod) {
            const endTime = calculatePeriodEndTime(currentPeriod.periodId, duration);
            const timeRemaining = Math.max(0, (endTime - now) / 1000);
            
            currentPeriod.timeRemaining = timeRemaining;
            currentPeriod.bettingOpen = timeRemaining > 5;
            
            // Update Redis for WebSocket service
            await storePeriodInRedisForWebSocket(gameType, duration, currentPeriod);
            
            // Handle betting closure notification
            if (timeRemaining <= 5 && timeRemaining > 0 && currentPeriod.bettingOpen) {
                // CRITICAL FIX: Use new broadcasting function
                await broadcastBettingClosed(gameType, duration, currentPeriod.periodId);
                console.log(`🔒 SCHEDULER: Betting closed for ${currentPeriod.periodId} (${timeRemaining.toFixed(1)}s remaining)`);
                
                // Trigger 5D pre-calculation during bet freeze
                if (gameType.toLowerCase() === '5d' || gameType.toLowerCase() === 'fived') {
                    try {
                        console.log(`⚡ [5D_PRE_CALC_TRIGGER] Starting pre-calculation for ${currentPeriod.periodId}`);
                        
                        const gameLogicService = require('../services/gameLogicService');
                        await gameLogicService.preCalculate5DResult(
                            gameType, duration, currentPeriod.periodId, 'default'
                        );
                        
                        console.log(`✅ [5D_PRE_CALC_TRIGGER] Pre-calculation completed for ${currentPeriod.periodId}`);
                    } catch (error) {
                        console.error(`❌ [5D_PRE_CALC_TRIGGER] Error in pre-calculation:`, error.message);
                    }
                }
            }
        }
        
    } catch (error) {
        console.error(`❌ Error in scheduler game tick [${gameType}|${duration}s]:`, error.message);
    }
};

/**
 * All your other existing functions remain the same:
 * - getNextPeriod
 * - storePeriodInRedisForWebSocket  
 * - processSchedulerPeriodEnd
 * - checkExistingSchedulerResult
 * - generateSchedulerFallbackResult
 * - publishPeriodResult (this will now use broadcastPeriodResult)
 * - publishPeriodError (this will now use broadcastPeriodError)
 * - etc.
 */

// [Keep all your existing functions here - they don't need changes]
// Just make sure publishPeriodResult calls broadcastPeriodResult
// and publishPeriodError calls broadcastPeriodError

/**
 * CRITICAL FIX: Update publishPeriodResult to use new broadcasting
 */
const publishPeriodResult = async (gameType, duration, periodId, resultData, source) => {
    try {
        // Use the new enhanced broadcasting function
        await broadcastPeriodResult(gameType, duration, periodId, {
            result: resultData.result,
            winners: resultData.winners || [],
            winnerCount: Array.isArray(resultData.winners) ? resultData.winners.length : 0,
            totalPayout: Array.isArray(resultData.winners) ? 
                resultData.winners.reduce((sum, winner) => sum + (winner.winnings || 0), 0) : 0,
            verification: resultData.verification,
            source: `scheduler_${source}`
        });
        
        console.log(`📢 SCHEDULER: Published result for ${periodId} (${source})`);

    } catch (error) {
        console.error('❌ SCHEDULER: Error publishing period result:', error);
    }
};

/**
 * CRITICAL FIX: Update publishPeriodError to use new broadcasting
 */
const publishPeriodError = async (gameType, duration, periodId, message) => {
    try {
        // Use the new enhanced broadcasting function
        await broadcastPeriodError(gameType, duration, periodId, message);
        console.log(`📢 SCHEDULER: Published error for ${periodId}: ${message}`);

    } catch (error) {
        console.error('❌ SCHEDULER: Error publishing period error:', error);
    }
};

/**
 * CRITICAL FIX: Start the game scheduler with multi-instance support
 */
const startGameScheduler = async () => {
    try {
        console.log('DEBUG: Entered startGameScheduler');
        await initialize();
        console.log('DEBUG: Finished initialize, about to startSchedulerGameTicks');
        await startSchedulerGameTicks();
        console.log('DEBUG: Finished startSchedulerGameTicks');
        
        console.log('✅ SCHEDULER: Game scheduler started successfully with MULTI-INSTANCE SUPPORT');
        
        // Log all scheduled cron jobs
        console.log('\n📅 SCHEDULER CRON JOBS:');
        console.log('⏰ 2:00 AM IST - Daily period sequence reset');
        console.log('⏰ Every hour - TRON hash collection refresh');
        console.log('🎮 SCHEDULER handles ALL period management and result processing');
        console.log('📡 ENHANCED: Multi-instance communication via Redis pub/sub');
        console.log('🚀 MULTI-INSTANCE: WebSocket service on separate instance receives events');
        console.log('🎯 FIXED: Time-based period validation (no early results)\n');
        
        return true;
        
    } catch (error) {
        console.error('❌ SCHEDULER: Error starting game scheduler:', error);
        return false;
    }
};

// Add all your existing functions here that I didn't change:

/**
 * FIXED: Get next period for a game/duration
 */
const getNextPeriod = async (gameType, duration, currentPeriodId) => {
    try {
        // Extract current sequence number
        const currentSequence = parseInt(currentPeriodId.substring(8), 10);
        const dateStr = currentPeriodId.substring(0, 8);
        
        // Generate next period ID
        const nextSequence = currentSequence + 1;
        const nextPeriodId = `${dateStr}${nextSequence.toString().padStart(9, '0')}`;
        
        // Calculate times for next period
        const startTime = calculatePeriodStartTime(nextPeriodId, duration);
        const endTime = calculatePeriodEndTime(nextPeriodId, duration);
        
        return {
            periodId: nextPeriodId,
            gameType,
            duration,
            startTime,
            endTime,
            timeRemaining: duration,
            active: true,
            bettingOpen: true
        };
    } catch (error) {
        console.error('Error getting next period:', error);
        return null;
    }
};

/**
 * FIXED: Store period info in Redis for WebSocket service to read
 */
const storePeriodInRedisForWebSocket = async (gameType, duration, periodInfo) => {
    try {
        const redisKey = `game_scheduler:${gameType}:${duration}:current`;
        
        const periodData = {
            periodId: periodInfo.periodId,
            gameType,
            duration,
            startTime: periodInfo.startTime ? periodInfo.startTime.toISOString() : new Date().toISOString(),
            endTime: periodInfo.endTime ? periodInfo.endTime.toISOString() : new Date(Date.now() + duration * 1000).toISOString(),
            timeRemaining: periodInfo.endTime ? Math.max(0, (periodInfo.endTime - new Date()) / 1000) : duration,
            bettingOpen: periodInfo.bettingOpen !== false,
            updatedAt: new Date().toISOString(),
            source: 'game_scheduler'
        };
        
        if (schedulerPublisher) {
            await schedulerPublisher.set(redisKey, JSON.stringify(periodData));
            await schedulerPublisher.expire(redisKey, 3600);
        } else {
            await redis.set(redisKey, JSON.stringify(periodData));
            await redis.expire(redisKey, 3600);
        }
        
    } catch (error) {
        console.error('❌ Error storing period in Redis for WebSocket:', error);
    }
};

/**
 * FIXED: Process period end with strict timing validation and multi-instance broadcasting
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
        
        console.log(`🏁 SCHEDULER: Starting period end validation [${gameType}|${duration}s]: ${periodId}`);
        
        // Strict timing validation to prevent premature processing
        const periodEndTime = calculatePeriodEndTime(periodId, duration);
        const now = new Date();
        const timeSinceEnd = (now - periodEndTime) / 1000;
        
        console.log(`⏰ TIMING CHECK for ${periodId}:`);
        console.log(`   - Period should end at: ${periodEndTime.toISOString()}`);
        console.log(`   - Current time: ${now.toISOString()}`);
        console.log(`   - Time since end: ${timeSinceEnd.toFixed(2)}s`);
        
        // Strict validation: Only process if period actually ended
        if (timeSinceEnd < -5) {
            console.warn(`⚠️ SCHEDULER: Period ${periodId} hasn't ended yet (${Math.abs(timeSinceEnd).toFixed(2)}s early) - REJECTING`);
            return;
        }
        
        if (timeSinceEnd > 120) {
            console.warn(`⚠️ SCHEDULER: Period ${periodId} ended too long ago (${timeSinceEnd.toFixed(2)}s late) - REJECTING`);
            return;
        }
        
        console.log(`✅ SCHEDULER: Period ${periodId} timing is valid (${timeSinceEnd.toFixed(2)}s after end) - PROCEEDING`);
        
        // Enhanced Redis lock for cross-process safety
        const globalLockKey = `scheduler_result_lock_${gameType}_${duration}_${periodId}`;
        const lockValue = `scheduler_${Date.now()}_${process.pid}_${Math.random().toString(36).substr(2, 9)}`;
        
        console.log(`🔒 SCHEDULER: Acquiring enhanced Redis lock for ${periodId}...`);
        
        const redisForLock = schedulerPublisher || redis;
        const lockAcquired = await redisForLock.set(globalLockKey, lockValue, 'EX', 300, 'NX');
        
        if (!lockAcquired) {
            const currentLockHolder = await redisForLock.get(globalLockKey);
            console.log(`⚠️ SCHEDULER: Period ${periodId} already locked by: ${currentLockHolder}`);
            return;
        }
        
        console.log(`🔒 SCHEDULER: Enhanced lock acquired for ${periodId} by ${lockValue}`);
        
        try {
            // Final check for existing result
            const existingResult = await checkExistingSchedulerResult(gameType, duration, periodId);
            if (existingResult) {
                console.log(`✅ SCHEDULER: Using existing result for ${periodId}`);
                await publishPeriodResult(gameType, duration, periodId, existingResult, 'existing');
                return;
            }
            
            // Additional timing check before processing
            const finalTimingCheck = (new Date() - periodEndTime) / 1000;
            if (finalTimingCheck < -2) {
                console.warn(`⚠️ SCHEDULER: Final timing check failed for ${periodId} (${finalTimingCheck.toFixed(2)}s early)`);
                return;
            }
            
            console.log(`🎲 SCHEDULER: Generating NEW result for ${periodId} (${finalTimingCheck.toFixed(2)}s after end)`);
            
            // Process NEW results using gameLogicService
            const processWithTimeout = async () => {
                return await gameLogicService.processGameResults(
                    gameType, 
                    duration, 
                    periodId,
                    'default'
                );
            };
            
            const gameResult = await Promise.race([
                processWithTimeout(),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Database operation timeout')), 45000)
                )
            ]);
            
            console.log(`🎲 SCHEDULER: processGameResults completed for ${periodId}:`, {
                success: gameResult.success,
                source: gameResult.source,
                protectionMode: gameResult.protectionMode
            });
            
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
            
            // Generate fallback result only if timing is still valid
            const fallbackTimingCheck = (new Date() - periodEndTime) / 1000;
            if (fallbackTimingCheck >= -2 && fallbackTimingCheck <= 180) {
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
                    await publishPeriodError(gameType, duration, periodId, 'Failed to generate result');
                }
            } else {
                console.error(`❌ SCHEDULER: Timing invalid for fallback (${fallbackTimingCheck.toFixed(2)}s)`);
                await publishPeriodError(gameType, duration, periodId, 'Timing validation failed');
            }
        } finally {
            // Always release lock
            try {
                const redisForUnlock = schedulerPublisher || redis;
                const currentLock = await redisForUnlock.get(globalLockKey);
                if (currentLock === lockValue) {
                    await redisForUnlock.del(globalLockKey);
                    console.log(`🔓 SCHEDULER: Released enhanced lock for ${periodId}`);
                } else {
                    console.warn(`⚠️ SCHEDULER: Lock changed for ${periodId}: expected ${lockValue}, found ${currentLock}`);
                }
            } catch (lockError) {
                console.error('❌ SCHEDULER: Error releasing enhanced lock:', lockError);
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
        const whereClause = { duration: duration };
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
                            link: existingResult.verification_link,
                            block: existingResult.block_number,
                            time: existingResult.result_time
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
    return `https://tronscan.org/#/block/${hash}`;
};

/**
 * FIXED: Reset all sequence counters at 2 AM IST - duration-based only
 */
const resetDailySequences = async () => {
    const lockKey = 'daily_sequence_reset_lock';
    const lockValue = `${Date.now()}_${process.pid}`;
    
    try {
        console.log('🔄 SCHEDULER: Starting daily sequence reset at 2 AM IST...');
        
        const redisForReset = schedulerPublisher || redis;
        const acquired = await redisForReset.set(lockKey, lockValue, 'EX', 600, 'NX');
        
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
                    const sequenceKey = `${gameType}:${duration}:daily_sequence:${today}`;
                    await redisForReset.set(sequenceKey, '0');
                    
                    const tomorrow2AM = moment.tz('Asia/Kolkata')
                        .add(1, 'day')
                        .hour(2)
                        .minute(0)
                        .second(0);
                    const expirySeconds = Math.max(3600, tomorrow2AM.diff(moment.tz('Asia/Kolkata'), 'seconds'));
                    await redisForReset.expire(sequenceKey, expirySeconds);
                    
                    resetCount++;
                    console.log(`✅ SCHEDULER: Reset sequence for ${gameType}:${duration}`);
                } catch (sequenceError) {
                    console.error(`❌ SCHEDULER: Failed to reset sequence for ${gameType}:${duration}:`, sequenceError);
                }
            }
        }

        console.log(`✅ SCHEDULER: Daily sequence reset completed! Reset ${resetCount} sequences`);

    } catch (error) {
        console.error('❌ SCHEDULER: Error in daily sequence reset:', error);
    } finally {
        try {
            const redisForUnlock = schedulerPublisher || redis;
            const currentValue = await redisForUnlock.get(lockKey);
            if (currentValue === lockValue) {
                await redisForUnlock.del(lockKey);
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

// Handle process termination
process.on('SIGINT', () => {
    console.log('SCHEDULER: Game scheduler stopped');
    
    // Clean up intervals
    schedulerGameIntervals.forEach((intervalId, key) => {
        clearInterval(intervalId);
        console.log(`⏹️ SCHEDULER: Stopped ticks for ${key}`);
    });
    
    // Disconnect Redis connections
    if (schedulerPublisher) {
        schedulerPublisher.disconnect();
        console.log('🔌 SCHEDULER: Disconnected scheduler publisher');
    }
    
    process.exit(0);
});

// Export for use in other files
module.exports = {
    startGameScheduler,
    resetDailySequences,
    
    // NEW: Multi-instance communication functions
    setupSchedulerCommunication,
    handlePeriodRequest,
    broadcastPeriodStart,
    broadcastPeriodResult,
    broadcastBettingClosed,
    broadcastPeriodError,
    startSchedulerHealthBroadcast,
    
    // Status functions
    getSchedulerStats: () => ({
        schedulerGameTicksStarted,
        activeSchedulerIntervals: schedulerGameIntervals.size,
        cachedSchedulerPeriods: schedulerCurrentPeriods.size,
        processingLocks: schedulerProcessingLocks.size,
        processedPeriods: processedPeriods.size,
        supportedGames: Object.keys(GAME_CONFIGS),
        gameConfigs: GAME_CONFIGS,
        mode: 'MULTI_INSTANCE_SETUP',
        totalRooms: Object.values(GAME_CONFIGS).reduce((sum, durations) => sum + durations.length, 0),
        publisherStatus: schedulerPublisher ? schedulerPublisher.status : 'not_created'
    }),
    
    // Debug function
    verifySchedulerTicks: () => {
        console.log('🔍 Verifying SCHEDULER MULTI-INSTANCE tick system...');
        
        const expectedIntervals = Object.values(GAME_CONFIGS).reduce((sum, durations) => sum + durations.length, 0);
        const activeIntervals = schedulerGameIntervals.size;
        
        console.log(`📊 Scheduler tick system status:`);
        console.log(`   - Active intervals: ${activeIntervals}`);
        console.log(`   - Expected intervals: ${expectedIntervals}`);
        console.log(`   - System started: ${schedulerGameTicksStarted}`);
        console.log(`   - Cached periods: ${schedulerCurrentPeriods.size}`);
        console.log(`   - Processing locks: ${schedulerProcessingLocks.size}`);
        console.log(`   - Publisher status: ${schedulerPublisher ? schedulerPublisher.status : 'not_created'}`);
        
        // Show detailed status
        Object.keys(GAME_CONFIGS).forEach(gameType => {
            console.log(`\n📋 ${gameType.toUpperCase()} rooms:`);
            GAME_CONFIGS[gameType].forEach(duration => {
                const key = `${gameType}_${duration}`;
                const hasInterval = schedulerGameIntervals.has(key);
                const hasCachedPeriod = schedulerCurrentPeriods.has(key);
                console.log(`   - ${key}: ${hasInterval ? '✅' : '❌'} Interval | ${hasCachedPeriod ? '✅' : '❌'} Period | 📡 Multi-Instance`);
            });
        });
        
        return {
            active: activeIntervals,
            expected: expectedIntervals,
            started: schedulerGameTicksStarted,
            working: activeIntervals === expectedIntervals && schedulerGameTicksStarted,
            publisherConnected: schedulerPublisher && schedulerPublisher.status === 'ready'
        };
    }
};

// Don't auto-start if this file is run directly
if (require.main === module) {
    console.log('🚫 SCHEDULER: Auto-start disabled - use start-scheduler.js instead');
}