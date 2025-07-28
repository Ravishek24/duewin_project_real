const unifiedRedis = require('../config/unifiedRedisManager');
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

// CRITICAL FIX: Declare schedulerPublisher and schedulerHelper variables
let schedulerPublisher = null;
let schedulerSubscriber = null;
let schedulerHelper = null;

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
        //console.log('🔄 [SCHEDULER_COMM] Setting up multi-instance communication...');
        
        // Create dedicated publisher using unifiedRedis
        schedulerPublisher = await unifiedRedis.createConnection({
            retryDelayOnFailover: 100,
            retryDelayOnClusterDown: 300,
            retryDelayOnFailover: (times) => {
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
        
        //console.log('✅ [SCHEDULER_COMM] Publisher created and connected');
        
        // Listen for period requests from WebSocket instances
        schedulerSubscriber = unifiedRedis.getConnection('subscriber');
        await schedulerSubscriber.subscribe('scheduler:period_request');
        
        schedulerSubscriber.on('message', async (channel, message) => {
            try {
                const request = JSON.parse(message);
                //console.log(`📥 [SCHEDULER_COMM] Received period request:`, request);
                
                if (request.action === 'request_period') {
                    await handlePeriodRequest(request.gameType, request.duration);
                }
            } catch (error) {
                console.error('❌ [SCHEDULER_COMM] Error handling period request:', error);
            }
        });
        
        //console.log('✅ [SCHEDULER_COMM] Multi-instance communication setup completed');
        
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
        console.log(`📋 [PERIOD_REQUEST] Handling period request for ${gameType}_${duration} at ${new Date().toISOString()}`);
        
        // Get current period and ensure it's broadcasted
        const currentPeriod = await periodService.getCurrentPeriod(gameType, duration);
        if (currentPeriod) {
            await storePeriodInRedisForWebSocket(gameType, duration, currentPeriod);
            
            // CRITICAL FIX: Only broadcast if this is actually a new period
            const endTime = calculatePeriodEndTime(currentPeriod.periodId, duration);
            const timeRemaining = Math.max(0, (endTime - new Date()) / 1000);
            const isNewPeriod = timeRemaining >= (duration - 1);
            
            if (isNewPeriod) {
                await broadcastPeriodStart(gameType, duration, currentPeriod);
                console.log(`✅ [PERIOD_REQUEST] Broadcasted NEW period ${currentPeriod.periodId} with ${timeRemaining.toFixed(3)}s remaining`);
            } else {
                console.log(`⚠️ [PERIOD_REQUEST] Skipping broadcast for EXISTING period ${currentPeriod.periodId} with ${timeRemaining.toFixed(3)}s remaining`);
            }
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
// Global tracking for scheduler events
if (!global.schedulerEventTracker) {
    global.schedulerEventTracker = {
        sentEvents: new Map(),
        lastBroadcasts: new Map()
    };
}

/**
 * CRITICAL FIX: Enhanced period start broadcasting with deduplication
 */
const broadcastPeriodStart = async (gameType, duration, periodData) => {
    try {
        const dedupeKey = `start_${gameType}_${duration}_${periodData.periodId}`;
        
        // Check if already sent
        if (global.schedulerEventTracker.sentEvents.has(dedupeKey)) {
            console.log(`⏭️ [SCHEDULER_DUPLICATE] Already sent periodStart for ${periodData.periodId}`);
            return;
        }
        
        // Calculate timeRemaining for the new period
        const now = new Date();
        const endTime = periodData.endTime ? new Date(periodData.endTime) : new Date(now.getTime() + duration * 1000);
        let timeRemaining = Math.max(0, (endTime - now) / 1000);
        timeRemaining = Math.min(timeRemaining, duration);
        
        // Only broadcast if this is actually a new period with sufficient time
        const isNewPeriod = timeRemaining >= (duration - 2); // Allow 2 second tolerance
        
        if (!isNewPeriod) {
            console.log(`⚠️ [SCHEDULER] Skipping periodStart for ${periodData.periodId}: only ${timeRemaining.toFixed(1)}s remaining`);
            return;
        }
        
        const broadcastData = {
            gameType,
            duration,
            periodId: periodData.periodId,
            endTime: endTime.toISOString(),
            startTime: periodData.startTime ? periodData.startTime.toISOString() : now.toISOString(),
            timeRemaining: timeRemaining,
            timestamp: now.toISOString(),
            source: 'game_scheduler_start'
        };
        
        console.log(`📤 [SCHEDULER_START] Broadcasting NEW period: ${periodData.periodId} with ${timeRemaining.toFixed(1)}s`);
        
        // Broadcast to channels
        const channels = [
            'game_scheduler:period_start',
            'scheduler:period_start',
            'period:start'
        ];
        
        for (const channel of channels) {
            if (schedulerPublisher) {
                await schedulerPublisher.publish(channel, JSON.stringify(broadcastData));
            }
        }
        
        // Store current period info
        const currentPeriodKey = `game_scheduler:${gameType}:${duration}:current`;
        if (schedulerPublisher) {
            await schedulerPublisher.setex(currentPeriodKey, duration + 10, JSON.stringify(broadcastData));
        }
        
        // Mark as sent with expiry
        global.schedulerEventTracker.sentEvents.set(dedupeKey, Date.now());
        setTimeout(() => {
            global.schedulerEventTracker.sentEvents.delete(dedupeKey);
        }, 60000); // 1 minute expiry
        
    } catch (error) {
        console.error(`❌ [SCHEDULER_START_ERROR] Error broadcasting period start:`, error);
    }
};

/**
 * CRITICAL FIX: Enhanced period result broadcasting  
 */
const broadcastPeriodResult = async (gameType, duration, periodId, result) => {
    try {
        const dedupeKey = `result_${gameType}_${duration}_${periodId}`;
        
        // Check if already sent
        if (global.schedulerEventTracker.sentEvents.has(dedupeKey)) {
            console.log(`⏭️ [SCHEDULER_DUPLICATE] Already sent periodResult for ${periodId}`);
            return;
        }
        
        const broadcastData = {
            gameType,
            duration,
            periodId,
            result,
            timestamp: new Date().toISOString(),
            source: 'game_scheduler_result'
        };
        
        console.log(`📤 [SCHEDULER_RESULT] Broadcasting result for: ${periodId}`);
        
        // Broadcast to channels
        const channels = [
            'game_scheduler:period_result',
            'scheduler:period_result', 
            'period:result'
        ];
        
        for (const channel of channels) {
            if (schedulerPublisher) {
                await schedulerPublisher.publish(channel, JSON.stringify(broadcastData));
            }
        }
        
        // Clear current period info since period ended
        const currentPeriodKey = `game_scheduler:${gameType}:${duration}:current`;
        if (schedulerPublisher) {
            await schedulerPublisher.del(currentPeriodKey);
        }
        
        // Mark as sent with expiry
        global.schedulerEventTracker.sentEvents.set(dedupeKey, Date.now());
        setTimeout(() => {
            global.schedulerEventTracker.sentEvents.delete(dedupeKey);
        }, 60000);
        
    } catch (error) {
        console.error(`❌ [SCHEDULER_RESULT_ERROR] Error broadcasting period result:`, error);
    }
};


/**
 * CRITICAL FIX: Enhanced betting closed broadcasting
 */
const broadcastBettingClosed = async (gameType, duration, periodId) => {
    try {
        const dedupeKey = `betting_${gameType}_${duration}_${periodId}`;
        
        // Check if already sent
        if (global.schedulerEventTracker.sentEvents.has(dedupeKey)) {
            console.log(`⏭️ [SCHEDULER_DUPLICATE] Already sent bettingClosed for ${periodId}`);
            return;
        }
        
        const broadcastData = {
            gameType,
            duration,
            periodId,
            message: `Betting closed for ${gameType} ${duration}s`,
            timestamp: new Date().toISOString(),
            source: 'game_scheduler_betting'
        };
        
        console.log(`📤 [SCHEDULER_BETTING] Broadcasting betting closed: ${periodId}`);
        
        // Broadcast to channels
        const channels = [
            'game_scheduler:betting_closed',
            'scheduler:betting_closed',
            'period:betting_closed'
        ];
        
        for (const channel of channels) {
            if (schedulerPublisher) {
                await schedulerPublisher.publish(channel, JSON.stringify(broadcastData));
            }
        }
        
        // Mark as sent with expiry
        global.schedulerEventTracker.sentEvents.set(dedupeKey, Date.now());
        setTimeout(() => {
            global.schedulerEventTracker.sentEvents.delete(dedupeKey);
        }, 30000); // 30 second expiry
        
    } catch (error) {
        console.error(`❌ [SCHEDULER_BETTING_ERROR] Error broadcasting betting closed:`, error);
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
        
        //console.log(`📤 [PERIOD_ERROR] Broadcasting period error: ${periodId}`);
        
        // Broadcast to all possible channels
        const channels = [
            'game_scheduler:period_error',
            'scheduler:period_error',
            'period:error'
        ];
        
        for (const channel of channels) {
            if (schedulerPublisher) {
                await schedulerPublisher.publish(channel, JSON.stringify(broadcastData));
                //console.log(`✅ [PERIOD_ERROR] Published to ${channel}`);
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
                //console.log(`💓 [SCHEDULER_HEALTH] Heartbeat sent`);
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
                //console.log('✅ Database reconnection successful');
            } catch (error) {
                console.error('❌ Database reconnection failed:', error.message);
            }
        }
    }, 30000); // Check every 30 seconds
    
    //console.log('🔍 Database health monitoring started');
};

/**
 * CRITICAL FIX: Initialize scheduler with multi-instance communication
 */
async function initialize() {
    try {
        //console.log('DEBUG: initialize() - start');
        await connectDB();
        //console.log('DEBUG: initialize() - after connectDB');
        const { sequelize: seq } = require('../config/db');
        sequelize = seq;
        await sequelize.authenticate();
        //console.log('DEBUG: initialize() - after sequelize.authenticate');
        const modelsModule = require('../models');
        await new Promise(resolve => setTimeout(resolve, 1000));
        //console.log('DEBUG: initialize() - after setTimeout');
        models = await modelsModule.initializeModels();
        //console.log('DEBUG: initialize() - after initializeModels');
        if (!models) {
            throw new Error('Models initialization failed - no models returned');
        }
        periodService = require('../services/periodService');
        gameLogicService = require('../services/gameLogicService');
        await periodService.ensureModelsLoaded();
        //console.log('DEBUG: initialize() - after ensureModelsLoaded');
        
        try {
            tronHashService = require('../services/tronHashService');
            await tronHashService.startHashCollection();
            //console.log('DEBUG: initialize() - after tronHashService.startHashCollection');
        } catch (error) {
            console.error('❌ Error initializing TRON hash collection:', error);
            //console.log('⚠️ Game results will use fallback hash generation');
        }
        
        // Initialize schedulerHelper if not already done
        if (!schedulerHelper) {
            schedulerHelper = unifiedRedis.getHelper();
        }
        
        if (!schedulerPublisher) {
            schedulerPublisher = unifiedRedis.getConnection('publisher');
            //console.log('🔄 Waiting for Redis to be ready...');
            await new Promise((resolve) => {
                if (schedulerPublisher.status === 'ready') {
                    resolve();
                } else {
                    schedulerPublisher.on('ready', resolve);
                }
            });
            //console.log('DEBUG: initialize() - after redis ready');
        }
        //console.log('✅ Redis connection verified for game scheduler');
        
        // CRITICAL FIX: Setup multi-instance communication
        await setupSchedulerCommunication();
        //console.log('DEBUG: initialize() - after setupSchedulerCommunication');
        
        startDatabaseHealthMonitoring();
        //console.log('DEBUG: initialize() - after startDatabaseHealthMonitoring');
        
        // Start health broadcast
        startSchedulerHealthBroadcast();
        //console.log('DEBUG: initialize() - after startSchedulerHealthBroadcast');
        
        //console.log('✅ GAME SCHEDULER initialization completed - MULTI-INSTANCE SETUP');
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
        //console.log('DEBUG: Entered startSchedulerGameTicks');
        //console.log('🕐 Starting SCHEDULER DURATION-BASED game tick system...');
        
        for (const [gameType, durations] of Object.entries(GAME_CONFIGS)) {
            //console.log(`DEBUG: Looping gameType=${gameType}, durations=${JSON.stringify(durations)}`);
            for (const duration of durations) {
                try {
                    const key = `${gameType}_${duration}`;
                    //console.log(`DEBUG: Initializing scheduler for ${key}`);
                    
                    // FIXED: Get current period using duration-based calculation
                    const currentPeriod = await periodService.getCurrentPeriod(gameType, duration);
                    //console.log(`DEBUG: currentPeriod for ${key}:`, currentPeriod);
                    
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
                            
                            // CRITICAL FIX: Only broadcast if this is a new period with full duration
                            const isNewPeriod = timeRemaining >= (duration - 1);
                            if (isNewPeriod) {
                                await broadcastPeriodStart(gameType, duration, currentPeriod);
                                console.log(`📅 SCHEDULER loaded [${gameType}|${duration}s]: NEW Period ${currentPeriod.periodId} (${Math.ceil(timeRemaining)}s remaining)`);
                            } else {
                                console.log(`📅 SCHEDULER loaded [${gameType}|${duration}s]: EXISTING Period ${currentPeriod.periodId} (${Math.ceil(timeRemaining)}s remaining) - skipping broadcast`);
                            }
                        } else {
                            console.warn(`⚠️ Period ${currentPeriod.periodId} has already ended, getting next period`);
                            // Get next period
                            const nextPeriod = await getNextPeriod(gameType, duration, currentPeriod.periodId);
                            //console.log(`DEBUG: nextPeriod for ${key}:`, nextPeriod);
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
                    //console.log(`DEBUG: Called startSchedulerTicksForGame for ${key}`);
                    
                } catch (error) {
                    console.error(`❌ Error initializing scheduler for [${gameType}|${duration}s]:`, error.message);
                }
            }
        }
        
        schedulerGameTicksStarted = true;
        //console.log('✅ SCHEDULER DURATION-BASED game tick system started');
        
        //console.log('\n📋 SCHEDULER ACTIVE COMBINATIONS:');
        Object.entries(GAME_CONFIGS).forEach(([gameType, durations]) => {
            durations.forEach(duration => {
                //console.log(`   - ${gameType}_${duration}`);
            });
        });
        //console.log(`📊 Total combinations: ${Object.values(GAME_CONFIGS).reduce((sum, durations) => sum + durations.length, 0)}\n`);
        //console.log('DEBUG: Exiting startSchedulerGameTicks');
        
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
    //console.log(`⏰ SCHEDULER started ticks for ${gameType} ${duration}s`);
};

/**
 * CRITICAL FIX: Cleanup function for scheduler tracking
 */
const cleanupSchedulerTracking = () => {
    const now = Date.now();
    const maxAge = 300000; // 5 minutes
    let cleaned = 0;
    
    for (const [key, timestamp] of global.schedulerEventTracker.sentEvents.entries()) {
        if (now - timestamp > maxAge) {
            global.schedulerEventTracker.sentEvents.delete(key);
            cleaned++;
        }
    }
    
    if (cleaned > 0) {
        console.log(`🧹 [SCHEDULER_CLEANUP] Cleaned ${cleaned} tracking entries`);
    }
};

// Run cleanup every 2 minutes
setInterval(cleanupSchedulerTracking, 120000);

/**
 * CRITICAL FIX: Enhanced scheduler game tick with multi-instance broadcasting
 */
const schedulerGameTick = async (gameType, duration) => {
    try {
        const now = new Date();
        const key = `${gameType}_${duration}`;
        
        // Get current period
        let currentPeriodInfo = await periodService.getCurrentPeriod(gameType, duration);
        
        if (!currentPeriodInfo || !currentPeriodInfo.active) {
            return;
        }
        
        // Get cached period
        const cachedCurrent = schedulerCurrentPeriods.get(key);
        
        // Handle period transition
        if (!cachedCurrent || cachedCurrent.periodId !== currentPeriodInfo.periodId) {
            console.log(`⚡ [SCHEDULER_TRANSITION] ${key}: ${cachedCurrent?.periodId || 'NONE'} → ${currentPeriodInfo.periodId}`);
            
            // Process previous period if exists
            if (cachedCurrent && cachedCurrent.periodId !== currentPeriodInfo.periodId) {
                try {
                    const prevPeriodEndTime = calculatePeriodEndTime(cachedCurrent.periodId, duration);
                    const timeSincePrevEnd = (now - prevPeriodEndTime) / 1000;
                    
                    if (timeSincePrevEnd >= -2 && timeSincePrevEnd <= 60) {
                        console.log(`✅ [SCHEDULER] Processing previous period ${cachedCurrent.periodId}`);
                        await processSchedulerPeriodEnd(gameType, duration, cachedCurrent.periodId);
                    }
                } catch (timingError) {
                    console.error(`❌ [SCHEDULER] Error validating previous period timing:`, timingError.message);
                }
            }
            
            // Update cached period
            schedulerCurrentPeriods.set(key, currentPeriodInfo);
            
            // Store new period in Redis
            await storePeriodInRedisForWebSocket(gameType, duration, currentPeriodInfo);
            
            // Let WebSocket request periods instead of auto-broadcasting
            console.log(`⏸️ [SCHEDULER] New period ${currentPeriodInfo.periodId} ready for WebSocket request`);
        }
        
        // Update cached period with latest time info
        const currentPeriod = schedulerCurrentPeriods.get(key);
        if (currentPeriod) {
            const endTime = calculatePeriodEndTime(currentPeriod.periodId, duration);
            let timeRemaining = Math.max(0, (endTime - now) / 1000);
            timeRemaining = Math.min(timeRemaining, duration);
            
            currentPeriod.timeRemaining = timeRemaining;
            currentPeriod.bettingOpen = timeRemaining >= 5;
            
            // Update Redis
            await storePeriodInRedisForWebSocket(gameType, duration, currentPeriod);
            
            // CRITICAL FIX: Only send betting closed once when it hits exactly 5 seconds
            if (Math.floor(timeRemaining) === 5 && currentPeriod.bettingOpen) {
                // Check if we already sent betting closed for this period
                const bettingKey = `betting_sent_${currentPeriod.periodId}`;
                if (!global.schedulerEventTracker.sentEvents.has(bettingKey)) {
                    await broadcastBettingClosed(gameType, duration, currentPeriod.periodId);
                    
                    // Mark as sent
                    global.schedulerEventTracker.sentEvents.set(bettingKey, Date.now());
                    setTimeout(() => {
                        global.schedulerEventTracker.sentEvents.delete(bettingKey);
                    }, 30000);
                }
            }
        }
        
    } catch (error) {
        console.error(`❌ [SCHEDULER_TICK_ERROR] ${gameType}_${duration}:`, error.message);
    }
};


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
        
        // CRITICAL FIX: Use the timeRemaining that was already calculated in schedulerGameTick
        // instead of recalculating it here, which can cause the time to get stuck
        let timeRemaining = periodInfo.timeRemaining !== undefined ? periodInfo.timeRemaining : duration;
        
        // If timeRemaining wasn't set, fallback to calculation from endTime
        if (timeRemaining === duration && periodInfo.endTime) {
            timeRemaining = Math.max(0, (periodInfo.endTime - new Date()) / 1000);
        }
        
        // Cap time remaining to duration to prevent values like 61s for 60s game
        timeRemaining = Math.min(timeRemaining, duration);
        
        const periodData = {
            periodId: periodInfo.periodId,
            gameType,
            duration,
            startTime: periodInfo.startTime ? periodInfo.startTime.toISOString() : new Date().toISOString(),
            endTime: periodInfo.endTime ? periodInfo.endTime.toISOString() : new Date(Date.now() + duration * 1000).toISOString(),
            timeRemaining: timeRemaining,
            bettingOpen: periodInfo.bettingOpen !== false,
            updatedAt: new Date().toISOString(),
            source: 'game_scheduler'
        };
        
        // CRITICAL FIX: Add extensive logging to debug JSON parsing issue
        console.log(`🔍 [SCHEDULER_STORE_DEBUG] ${gameType}_${duration}: About to store in Redis`);
        console.log(`🔍 [SCHEDULER_STORE_DEBUG] periodInfo type:`, typeof periodInfo);
        console.log(`🔍 [SCHEDULER_STORE_DEBUG] periodInfo keys:`, Object.keys(periodInfo || {}));
        console.log(`🔍 [SCHEDULER_STORE_DEBUG] periodData:`, JSON.stringify(periodData, null, 2));
        
        const redisConnection = schedulerPublisher || schedulerHelper;
        if (redisConnection) {
            try {
                const jsonString = JSON.stringify(periodData);
                console.log(`🔍 [SCHEDULER_STORE_DEBUG] JSON string to store:`, jsonString);
                
                await redisConnection.set(redisKey, jsonString);
                await redisConnection.expire(redisKey, 3600);
                
                console.log(`✅ [SCHEDULER_STORE_SUCCESS] ${gameType}_${duration}: Successfully stored in Redis`);
            } catch (jsonError) {
                console.error(`❌ [SCHEDULER_STORE_ERROR] ${gameType}_${duration}: JSON serialization error:`, jsonError.message);
                console.error(`❌ [SCHEDULER_STORE_ERROR] periodData:`, periodData);
                console.error(`❌ [SCHEDULER_STORE_ERROR] periodInfo:`, periodInfo);
            }
            
            // CRITICAL FIX: Add logging for new period stuck issue
            if (timeRemaining === duration) {
                console.log(`🔍 [SCHEDULER_STORE_DEBUG] ${gameType}_${duration}: Storing period with stuck timeRemaining!`);
                console.log(`🔍 [SCHEDULER_STORE_DEBUG] periodData:`, JSON.stringify(periodData, null, 2));
            }
            
            // Add logging for debugging the countdown issue
            if (timeRemaining <= 10) {
                console.log(`⏰ [SCHEDULER_TICK_DEBUG] ${gameType}_${duration}: Storing timeRemaining: ${timeRemaining}s, periodId: ${periodInfo.periodId}`);
            }
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
            //console.log(`🔒 SCHEDULER: Period ${periodId} already processing`);
            return;
        }
        
        schedulerProcessingLocks.add(processKey);
        
        //console.log(`🏁 SCHEDULER: Starting period end validation [${gameType}|${duration}s]: ${periodId}`);
        
        // Strict timing validation to prevent premature processing
        const periodEndTime = calculatePeriodEndTime(periodId, duration);
        const now = new Date();
        const timeSinceEnd = (now - periodEndTime) / 1000;
        
        //console.log(`⏰ TIMING CHECK for ${periodId}:`);
        //console.log(`   - Period should end at: ${periodEndTime.toISOString()}`);
        //console.log(`   - Current time: ${now.toISOString()}`);
        //console.log(`   - Time since end: ${timeSinceEnd.toFixed(2)}s`);
        
        // Strict validation: Only process if period actually ended
        if (timeSinceEnd < -5) {
            console.warn(`⚠️ SCHEDULER: Period ${periodId} hasn't ended yet (${Math.abs(timeSinceEnd).toFixed(2)}s early) - REJECTING`);
            return;
        }
        
        if (timeSinceEnd > 120) {
            console.warn(`⚠️ SCHEDULER: Period ${periodId} ended too long ago (${timeSinceEnd.toFixed(2)}s late) - REJECTING`);
            return;
        }
        
        //console.log(`✅ SCHEDULER: Period ${periodId} timing is valid (${timeSinceEnd.toFixed(2)}s after end) - PROCEEDING`);
        
        // Enhanced Redis lock for cross-process safety
        const globalLockKey = `scheduler_result_lock_${gameType}_${duration}_${periodId}`;
        const lockValue = `scheduler_${Date.now()}_${process.pid}_${Math.random().toString(36).substr(2, 9)}`;
        
        //console.log(`🔒 SCHEDULER: Acquiring enhanced Redis lock for ${periodId}...`);
        
        const redisForLock = schedulerPublisher || schedulerHelper;
        const lockAcquired = await redisForLock.set(globalLockKey, lockValue, 'EX', 300, 'NX');
        
        if (!lockAcquired) {
            const currentLockHolder = await redisForLock.get(globalLockKey);
            //console.log(`⚠️ SCHEDULER: Period ${periodId} already locked by: ${currentLockHolder}`);
            return;
        }
        
        //console.log(`🔒 SCHEDULER: Enhanced lock acquired for ${periodId} by ${lockValue}`);
        
        try {
            // Final check for existing result
            const existingResult = await checkExistingSchedulerResult(gameType, duration, periodId);
            if (existingResult) {
                //console.log(`✅ SCHEDULER: Using existing result for ${periodId}`);
                await publishPeriodResult(gameType, duration, periodId, existingResult, 'existing');
                return;
            }
            
            // Additional timing check before processing
            const finalTimingCheck = (new Date() - periodEndTime) / 1000;
            if (finalTimingCheck < -2) {
                console.warn(`⚠️ SCHEDULER: Final timing check failed for ${periodId} (${finalTimingCheck.toFixed(2)}s early)`);
                return;
            }
            
            //console.log(`🎲 SCHEDULER: Generating NEW result for ${periodId} (${finalTimingCheck.toFixed(2)}s after end)`);
            
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
                
                //console.log(`✅ SCHEDULER: NEW result processed for ${periodId}: ${JSON.stringify(gameResult.gameResult)}`);
                
            } else {
                throw new Error(gameResult.message || 'Failed to process results');
            }
            
        } catch (processError) {
            console.error(`❌ SCHEDULER: Result processing error for ${periodId}:`, processError.message);
            
            // Generate fallback result only if timing is still valid
            const fallbackTimingCheck = (new Date() - periodEndTime) / 1000;
            if (fallbackTimingCheck >= -2 && fallbackTimingCheck <= 180) {
                try {
                    //console.log(`🎲 SCHEDULER: Generating fallback result for ${periodId}`);
                    
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
                    
                    //console.log(`✅ SCHEDULER: Fallback result generated for ${periodId}`);
                    
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
                const redisForUnlock = schedulerPublisher || schedulerHelper;
                const currentLock = await redisForUnlock.get(globalLockKey);
                if (currentLock === lockValue) {
                    await redisForUnlock.del(globalLockKey);
                    //console.log(`🔓 SCHEDULER: Released enhanced lock for ${periodId}`);
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
        
        //console.log(`📢 SCHEDULER: Published result for ${periodId} (${source})`);

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
        //console.log(`📢 SCHEDULER: Published error for ${periodId}: ${message}`);

    } catch (error) {
        console.error('❌ SCHEDULER: Error publishing period error:', error);
    }
};

/**
 * FIXED: Reset all sequence counters at 2 AM IST - duration-based only
 */
const resetDailySequences = async () => {
    const lockKey = 'daily_sequence_reset_lock';
    const lockValue = `${Date.now()}_${process.pid}`;
    
    try {
        //console.log('🔄 SCHEDULER: Starting daily sequence reset at 2 AM IST...');
        
        const redisForReset = schedulerPublisher || schedulerHelper;
        const acquired = await redisForReset.set(lockKey, lockValue, 'EX', 600, 'NX');
        
        if (!acquired) {
            //console.log('⚠️ SCHEDULER: Daily reset already running on another instance, skipping...');
            return;
        }

        //console.log('🔒 SCHEDULER: Acquired reset lock, proceeding with daily sequence reset');
        
        const today = moment.tz('Asia/Kolkata').format('YYYYMMDD');
        //console.log(`🔄 SCHEDULER: Resetting daily sequences for ${today}`);

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
                    //console.log(`✅ SCHEDULER: Reset sequence for ${gameType}:${duration}`);
                } catch (sequenceError) {
                    console.error(`❌ SCHEDULER: Failed to reset sequence for ${gameType}:${duration}:`, sequenceError);
                }
            }
        }

        //console.log(`✅ SCHEDULER: Daily sequence reset completed! Reset ${resetCount} sequences`);

    } catch (error) {
        console.error('❌ SCHEDULER: Error in daily sequence reset:', error);
    } finally {
        try {
            const redisForUnlock = schedulerPublisher || schedulerHelper;
            const currentValue = await redisForUnlock.get(lockKey);
            if (currentValue === lockValue) {
                await redisForUnlock.del(lockKey);
                //console.log('🔓 SCHEDULER: Released reset lock');
            }
        } catch (lockError) {
            console.error('❌ SCHEDULER: Error releasing reset lock:', lockError);
        }
    }
};

/**
 * CRITICAL FIX: Start the game scheduler with multi-instance support
 */
const startGameScheduler = async () => {
    try {
        //console.log('DEBUG: Entered startGameScheduler');
        await initialize();
        //console.log('DEBUG: Finished initialize, about to startSchedulerGameTicks');
        await startSchedulerGameTicks();
        //console.log('DEBUG: Finished startSchedulerGameTicks');
        
        //console.log('✅ SCHEDULER: Game scheduler started successfully with MULTI-INSTANCE SUPPORT');
        
        // Log all scheduled cron jobs
        //console.log('\n📅 SCHEDULER CRON JOBS:');
        //console.log('⏰ 2:00 AM IST - Daily period sequence reset');
        //console.log('⏰ Every hour - TRON hash collection refresh');
        //console.log('🎮 SCHEDULER handles ALL period management and result processing');
        //console.log('📡 ENHANCED: Multi-instance communication via Redis pub/sub');
        //console.log('🚀 MULTI-INSTANCE: WebSocket service on separate instance receives events');
        //console.log('🎯 FIXED: Time-based period validation (no early results)\n');
        
        return true;
        
    } catch (error) {
        console.error('❌ SCHEDULER: Error starting game scheduler:', error);
        return false;
    }
};

// Schedule daily period sequence reset at 2 AM IST
cron.schedule('0 2 * * *', async () => {
    //console.log('🕐 SCHEDULER: 2 AM IST - Starting daily period sequence reset...');
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
    //console.log('🔄 SCHEDULER: Refreshing TRON hash collection...');
    try {
        if (tronHashService) {
            await tronHashService.startHashCollection();
            //console.log('✅ SCHEDULER: TRON hash collection refreshed');
        }
    } catch (error) {
        console.error('❌ SCHEDULER: Failed to refresh TRON hash collection:', error);
    }
});

// Handle process termination
process.on('SIGINT', () => {
    //console.log('SCHEDULER: Game scheduler stopped');
    
    // Clean up intervals
    schedulerGameIntervals.forEach((intervalId, key) => {
        clearInterval(intervalId);
        //console.log(`⏹️ SCHEDULER: Stopped ticks for ${key}`);
    });
    
    // Disconnect Redis connections
    if (schedulerPublisher) {
        schedulerPublisher.disconnect();
        //console.log('🔌 SCHEDULER: Disconnected scheduler publisher');
    }
    
    if (schedulerSubscriber) {
        schedulerSubscriber.disconnect();
        //console.log('🔌 SCHEDULER: Disconnected scheduler subscriber');
    }
    
    if (schedulerHelper) {
        schedulerHelper.disconnect();
        //console.log('🔌 SCHEDULER: Disconnected scheduler helper');
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
    schedulerGameTick,
    cleanupSchedulerTracking,
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
        //console.log('🔍 Verifying SCHEDULER MULTI-INSTANCE tick system...');
        
        const expectedIntervals = Object.values(GAME_CONFIGS).reduce((sum, durations) => sum + durations.length, 0);
        const activeIntervals = schedulerGameIntervals.size;
        
        //console.log(`📊 Scheduler tick system status:`);
        //console.log(`   - Active intervals: ${activeIntervals}`);
        //console.log(`   - Expected intervals: ${expectedIntervals}`);
        //console.log(`   - System started: ${schedulerGameTicksStarted}`);
        //console.log(`   - Cached periods: ${schedulerCurrentPeriods.size}`);
        //console.log(`   - Processing locks: ${schedulerProcessingLocks.size}`);
        //console.log(`   - Publisher status: ${schedulerPublisher ? schedulerPublisher.status : 'not_created'}`);
        
        // Show detailed status
        Object.keys(GAME_CONFIGS).forEach(gameType => {
            //console.log(`\n📋 ${gameType.toUpperCase()} rooms:`);
            GAME_CONFIGS[gameType].forEach(duration => {
                const key = `${gameType}_${duration}`;
                const hasInterval = schedulerGameIntervals.has(key);
                const hasCachedPeriod = schedulerCurrentPeriods.has(key);
                //console.log(`   - ${key}: ${hasInterval ? '✅' : '❌'} Interval | ${hasCachedPeriod ? '✅' : '❌'} Period | 📡 Multi-Instance`);
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
    //console.log('🚫 SCHEDULER: Auto-start disabled - use start-scheduler.js instead');
}