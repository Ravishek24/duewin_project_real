const unifiedRedis = require('../config/unifiedRedisManager');
const { connectDB } = require('../config/db');
const cron = require('node-cron');
const logger = require('../utils/logger');
const moment = require('moment-timezone');

// Import services after DB connection is established
let periodService = null;
let gameLogicService = null;

// Models and sequelize
let models = null;
let sequelize = null;

// 5D Pre-Calculation Scheduler specific variables
let schedulerPublisher = null;
let schedulerSubscriber = null;
let schedulerHelper = null;

// 5D Pre-Calculation tracking
const fiveDPreCalcTracking = new Map(); // Key: gameType_duration_periodId
const fiveDPreCalcLocks = new Set(); // Prevent duplicate pre-calculations

// 5D Game configurations
const FIVE_D_CONFIGS = {
    'fiveD': [60, 180, 300, 600]  // 4 rooms: fiveD_60, fiveD_180, fiveD_300, fiveD_600
};

/**
 * Setup Redis communication for 5D pre-calculation scheduler
 */
const setup5DPreCalcCommunication = async () => {
    try {
        console.log('🔄 [5D_PRECALC_COMM] Setting up 5D pre-calculation communication...');
        
        // Initialize UnifiedRedisManager first
        console.log('🔄 [5D_PRECALC_COMM] Initializing Unified Redis Manager...');
        await unifiedRedis.initialize();
        console.log('✅ [5D_PRECALC_COMM] Unified Redis Manager initialized');
        
        // Get Redis helper for operations
        schedulerHelper = unifiedRedis.getHelper();
        console.log('✅ [5D_PRECALC_COMM] Redis helper obtained');
        
        // Create dedicated publisher using unifiedRedis
        schedulerPublisher = await unifiedRedis.createConnection({
            retryDelayOnFailover: 100,
            retryDelayOnClusterDown: 300,
            retryDelayOnFailover: (times) => {
                return Math.min(times * 50, 2000);
            },
            connectTimeout: 15000,
            commandTimeout: 30000, // INCREASED: 30 seconds for large operations
            lazyConnect: false,
            enableOfflineQueue: true,
            maxRetriesPerRequest: 3,
            family: 4
        });
        
        // Wait for publisher to be ready
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('5D pre-calculation publisher connection timeout'));
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
        
        console.log('✅ [5D_PRECALC_COMM] Publisher created and connected');
        
        // Listen for 5D pre-calculation requests from WebSocket instances
        schedulerSubscriber = unifiedRedis.getConnection('subscriber');
        await schedulerSubscriber.subscribe('5d_precalc:trigger');
        
        schedulerSubscriber.on('message', async (channel, message) => {
            try {
                const request = JSON.parse(message);
                console.log(`📥 [5D_PRECALC_COMM] Received pre-calculation request:`, request);
                
                if (request.action === 'trigger_precalc') {
                    await handle5DPreCalcRequest(request.gameType, request.duration, request.periodId);
                }
            } catch (error) {
                console.error('❌ [5D_PRECALC_COMM] Error handling pre-calculation request:', error);
            }
        });
        
        console.log('✅ [5D_PRECALC_COMM] 5D pre-calculation communication setup complete');
        
    } catch (error) {
        console.error('❌ [5D_PRECALC_COMM] Error setting up communication:', error);
        throw error;
    }
};

/**
 * Handle 5D pre-calculation request from WebSocket service
 */
const handle5DPreCalcRequest = async (gameType, duration, periodId) => {
    try {
        const trackingKey = `${gameType}_${duration}_${periodId}`;
        
        // Check if already processing
        if (fiveDPreCalcLocks.has(trackingKey)) {
            console.log(`🔒 [5D_PRECALC] Already processing pre-calculation for ${trackingKey}`);
            return;
        }
        
        // Add to processing locks
        fiveDPreCalcLocks.add(trackingKey);
        
        console.log(`🔄 [5D_PRECALC] Starting pre-calculation for ${trackingKey}`);
        
        // Execute pre-calculation
        await execute5DPreCalculation(gameType, duration, periodId);
        
        // Remove from processing locks
        fiveDPreCalcLocks.delete(trackingKey);
        
    } catch (error) {
        console.error(`❌ [5D_PRECALC] Error handling pre-calculation request:`, error);
        // Remove from processing locks on error
        const trackingKey = `${gameType}_${duration}_${periodId}`;
        fiveDPreCalcLocks.delete(trackingKey);
    }
};

/**
 * Execute 5D pre-calculation at bet freeze with final bet patterns
 * ENHANCED: Load balancer safety mechanisms + Sorted Set optimization
 */
const execute5DPreCalculation = async (gameType, duration, periodId) => {
    const startTime = Date.now();
    const timeline = 'default';
    
    try {
        console.log(`🎯 [5D_PRECALC_EXEC] Starting pre-calculation for period ${periodId}`);
        
        // 1. Verify bet freeze is active (betting should be closed)
        const bettingStatus = await verifyBetFreezeStatus(gameType, duration, periodId);
        if (!bettingStatus.isFrozen) {
            console.log(`⚠️ [5D_PRECALC_EXEC] Betting not frozen yet for period ${periodId}, skipping`);
            return;
        }
        
        console.log(`✅ [5D_PRECALC_EXEC] Bet freeze confirmed for period ${periodId}`);
        
        // 2. Get current bet patterns from Redis
        const betPatterns = await getCurrentBetPatterns(gameType, duration, periodId, timeline);
        console.log(`📊 [5D_PRECALC_EXEC] Retrieved bet patterns for period ${periodId}:`, {
            totalBets: Object.keys(betPatterns).length,
            totalExposure: Object.values(betPatterns).reduce((sum, val) => sum + parseFloat(val), 0)
        });
        
        // 3. 🚀 ENHANCED: Try Sorted Set method first for ultra-fast results
        console.log(`🚀 [5D_PRECALC_EXEC] Attempting Sorted Set method for period ${periodId}`);
        
        let result = null;
        let methodUsed = 'hash';
        
        try {
            // Import Sorted Set service
            const { getOptimal5DResultByExposureSortedSet } = require('../services/5dSortedSetService');
            
            // Try Sorted Set method
            result = await getOptimal5DResultByExposureSortedSet(duration, periodId, timeline);
            methodUsed = 'sorted_set';
            
            console.log(`✅ [5D_PRECALC_EXEC] Sorted Set method successful for period ${periodId}`);
            
        } catch (sortedSetError) {
            console.log(`⚠️ [5D_PRECALC_EXEC] Sorted Set method failed, falling back to Hash method:`, sortedSetError.message);
            
            // Fallback to original Hash method
            result = await gameLogicService.getOptimal5DResultByExposureFast(duration, periodId, timeline);
            methodUsed = 'hash_fallback';
        }
        
        if (!result) {
            console.log(`❌ [5D_PRECALC_EXEC] No result generated for period ${periodId}`);
            return;
        }
        
        // 4. Store result in Redis (with load balancer safety)
        const resultKey = `precalc_5d_result:${gameType}:${duration}:${timeline}:${periodId}`;
        const preCalcData = {
            result: result,
            betPatterns: betPatterns,
            calculatedAt: new Date().toISOString(),
            periodId: periodId,
            gameType: gameType,
            duration: duration,
            timeline: timeline,
            methodUsed: methodUsed, // Track which method was used
            // ENHANCED: Add load balancer safety data
            schedulerInstance: process.env.PM2_INSTANCE_ID || 'unknown',
            schedulerHost: require('os').hostname(),
            schedulerPid: process.pid,
            calculatedBy: '5d_precalc_scheduler'
        };
        
        // ENHANCED: Use Redis SET with NX to prevent race conditions
        const stored = await schedulerHelper.set(resultKey, JSON.stringify(preCalcData), 'EX', 300, 'NX');
        
        if (!stored) {
            console.log(`⚠️ [5D_PRECALC_EXEC] Result already stored by another instance for period ${periodId}`);
            return;
        }
        
        console.log(`💾 [5D_PRECALC_EXEC] Result stored in Redis for period ${periodId} (method: ${methodUsed})`);
        
        // 5. Publish completion notification (load balancer safe)
        const completionMessage = {
            action: 'precalc_completed',
            gameType: gameType,
            duration: duration,
            periodId: periodId,
            timeline: timeline,
            result: result,
            methodUsed: methodUsed, // Include method used
            completedAt: new Date().toISOString(),
            // ENHANCED: Add load balancer safety data
            schedulerInstance: process.env.PM2_INSTANCE_ID || 'unknown',
            schedulerHost: require('os').hostname(),
            schedulerPid: process.pid,
            resultKey: resultKey, // Include Redis key for verification
            betPatternCount: Object.keys(betPatterns).length,
            totalExposure: Object.values(betPatterns).reduce((sum, val) => sum + parseFloat(val), 0)
        };
        
        await schedulerPublisher.publish('5d_precalc:completed', JSON.stringify(completionMessage));
        
        const executionTime = Date.now() - startTime;
        console.log(`✅ [5D_PRECALC_EXEC] Pre-calculation completed for period ${periodId} in ${executionTime}ms (method: ${methodUsed})`);
        
        // 6. Update tracking
        fiveDPreCalcTracking.set(`${gameType}_${duration}_${periodId}`, {
            status: 'completed',
            result: result,
            methodUsed: methodUsed,
            completedAt: new Date().toISOString(),
            executionTime: executionTime,
            schedulerInstance: process.env.PM2_INSTANCE_ID || 'unknown',
            schedulerHost: require('os').hostname()
        });
        
    } catch (error) {
        console.error(`❌ [5D_PRECALC_EXEC] Error executing pre-calculation for period ${periodId}:`, error);
        
        // Publish error notification
        const errorMessage = {
            action: 'precalc_error',
            gameType: gameType,
            duration: duration,
            periodId: periodId,
            timeline: timeline,
            error: error.message,
            occurredAt: new Date().toISOString(),
            // ENHANCED: Add load balancer safety data
            schedulerInstance: process.env.PM2_INSTANCE_ID || 'unknown',
            schedulerHost: require('os').hostname(),
            schedulerPid: process.pid
        };
        
        try {
            await schedulerPublisher.publish('5d_precalc:error', JSON.stringify(errorMessage));
        } catch (pubError) {
            console.error(`❌ [5D_PRECALC_EXEC] Error publishing error notification:`, pubError);
        }
        
        throw error;
    }
};

/**
 * Verify that betting is frozen (bet freeze is active)
 */
const verifyBetFreezeStatus = async (gameType, duration, periodId) => {
    try {
        // Get current period info from Redis
        const periodKey = `game_scheduler:${gameType}:${duration}:current`;
        const periodInfo = await schedulerHelper.get(periodKey);
        
        if (!periodInfo) {
            return { isFrozen: false, reason: 'No period info found' };
        }
        
        // Handle both string and object formats
        let period;
        try {
            period = typeof periodInfo === 'string' ? JSON.parse(periodInfo) : periodInfo;
        } catch (parseError) {
            console.error(`❌ [5D_PRECALC_VERIFY] Error parsing period info:`, parseError.message);
            return { isFrozen: false, reason: 'Error parsing period info' };
        }
        const now = new Date();
        const endTime = new Date(period.endTime);
        const timeRemaining = Math.max(0, (endTime - now) / 1000);
        
        // Betting is frozen when timeRemaining < 5 seconds
        const isFrozen = timeRemaining < 5;
        
        return {
            isFrozen: isFrozen,
            timeRemaining: timeRemaining,
            bettingOpen: period.bettingOpen,
            reason: isFrozen ? 'Bet freeze active' : 'Betting still open'
        };
        
    } catch (error) {
        console.error(`❌ [5D_PRECALC_VERIFY] Error verifying bet freeze status:`, error);
        return { isFrozen: false, reason: 'Error checking status' };
    }
};

/**
 * Get current bet patterns from Redis
 */
const getCurrentBetPatterns = async (gameType, duration, periodId, timeline) => {
    try {
        const exposureKey = `exposure:5d:${duration}:${timeline}:${periodId}`;
        const betExposures = await schedulerHelper.hgetall(exposureKey);
        
        // Convert to bet patterns format
        const betPatterns = {};
        for (const [betKey, exposure] of Object.entries(betExposures)) {
            if (!betKey.startsWith('bet:')) continue;
            const actualBetKey = betKey.replace('bet:', '');
            const [betType, betValue] = actualBetKey.split(':');
            if (betType && betValue) {
                betPatterns[`${betType}:${betValue}`] = parseFloat(exposure);
            }
        }
        
        return betPatterns;
        
    } catch (error) {
        console.error(`❌ [5D_PRECALC_PATTERNS] Error getting bet patterns:`, error);
        return {};
    }
};

/**
 * Start 5D pre-calculation monitoring
 */
const start5DPreCalcMonitoring = async () => {
    try {
        console.log('🔄 [5D_PRECALC_MONITOR] Starting 5D pre-calculation monitoring...');
        
        // Start monitoring for each 5D duration
        for (const [gameType, durations] of Object.entries(FIVE_D_CONFIGS)) {
            for (const duration of durations) {
                start5DPreCalcTicksForGame(gameType, duration);
            }
        }
        
        console.log('✅ [5D_PRECALC_MONITOR] 5D pre-calculation monitoring started');
        
    } catch (error) {
        console.error('❌ [5D_PRECALC_MONITOR] Error starting monitoring:', error);
        throw error;
    }
};

/**
 * Start monitoring ticks for a specific 5D game
 */
const start5DPreCalcTicksForGame = (gameType, duration) => {
    const key = `${gameType}_${duration}`;
    console.log(`🔄 [5D_PRECALC_TICKS] Starting ticks for ${key}`);
    
    // Run tick every second
    const tickInterval = setInterval(async () => {
        try {
            await fiveDPreCalcTick(gameType, duration);
        } catch (error) {
            console.error(`❌ [5D_PRECALC_TICK_ERROR] ${key}:`, error.message);
        }
    }, 1000);
    
    // Store interval for cleanup
    if (!global.fiveDPreCalcIntervals) {
        global.fiveDPreCalcIntervals = new Map();
    }
    global.fiveDPreCalcIntervals.set(key, tickInterval);
};

/**
 * 5D pre-calculation tick function
 */
const fiveDPreCalcTick = async (gameType, duration) => {
    try {
        const key = `${gameType}_${duration}`;
        
        // Get current period info
        const periodKey = `game_scheduler:${gameType}:${duration}:current`;
        const periodInfo = await schedulerHelper.get(periodKey);
        
        if (!periodInfo) {
            return;
        }
        
        // Handle both string and object formats
        let period;
        try {
            period = typeof periodInfo === 'string' ? JSON.parse(periodInfo) : periodInfo;
        } catch (parseError) {
            console.error(`❌ [5D_PRECALC_TICK_ERROR] ${gameType}_${duration}: Error parsing period info:`, parseError.message);
            return;
        }
        const now = new Date();
        const endTime = new Date(period.endTime);
        const timeRemaining = Math.max(0, (endTime - now) / 1000);
        
        // Check if we're at bet freeze (t=5s) and haven't triggered pre-calculation yet
        if (timeRemaining <= 5 && timeRemaining > 0) {
            const trackingKey = `${gameType}_${duration}_${period.periodId}`;
            
            // Check if pre-calculation already triggered for this period
            if (!fiveDPreCalcTracking.has(trackingKey)) {
                console.log(`🎯 [5D_PRECALC_TRIGGER] Bet freeze detected for ${key}, period ${period.periodId} (t=${timeRemaining.toFixed(1)}s)`);
                
                // 🚀 CRITICAL FIX: DISABLE pre-calculation during critical countdown to prevent WebSocket freezing
                // The heavy computation was blocking the event loop and causing WebSocket delays
                console.log(`⚠️ [5D_PRECALC_DISABLED] Pre-calculation DISABLED for ${key} to prevent WebSocket freezing`);
                
                // Mark as triggered but skip actual calculation
                fiveDPreCalcTracking.set(trackingKey, {
                    status: 'disabled_for_websocket',
                    triggeredAt: new Date().toISOString(),
                    timeRemaining: timeRemaining,
                    reason: 'WebSocket performance optimization'
                });
                
                // 🚀 ALTERNATIVE: Use lightweight result calculation instead of heavy pre-calculation
                // This will be much faster and won't block the WebSocket
                setImmediate(async () => {
                    try {
                        console.log(`🚀 [5D_LIGHTWEIGHT] Starting lightweight result calculation for ${key}`);
                        
                        // Use a simple, fast result calculation instead of heavy pre-calculation
                        const { getOptimal5DResultByExposureFast } = require('../services/gameLogicService');
                        const result = await getOptimal5DResultByExposureFast(duration, period.periodId, 'default');
                        
                        if (result) {
                            // Store lightweight result
                            const resultKey = `lightweight_5d_result:${gameType}:${duration}:default:${period.periodId}`;
                            await schedulerHelper.set(resultKey, JSON.stringify({
                                result: result,
                                calculatedAt: new Date().toISOString(),
                                method: 'lightweight',
                                periodId: period.periodId
                            }), 'EX', 300);
                            
                            console.log(`✅ [5D_LIGHTWEIGHT] Lightweight result calculated and stored for ${key}`);
                        }
                    } catch (error) {
                        console.error(`❌ [5D_LIGHTWEIGHT] Error in lightweight calculation:`, error.message);
                    }
                });
            }
        }
        
    } catch (error) {
        console.error(`❌ [5D_PRECALC_TICK_ERROR] ${gameType}_${duration}:`, error.message);
    }
};

/**
 * Cleanup function
 */
const cleanup5DPreCalc = () => {
    try {
        console.log('🧹 [5D_PRECALC_CLEANUP] Cleaning up 5D pre-calculation scheduler...');
        
        // Clear intervals
        if (global.fiveDPreCalcIntervals) {
            for (const [key, interval] of global.fiveDPreCalcIntervals) {
                clearInterval(interval);
                console.log(`🧹 [5D_PRECALC_CLEANUP] Cleared interval for ${key}`);
            }
            global.fiveDPreCalcIntervals.clear();
        }
        
        // Clear tracking
        fiveDPreCalcTracking.clear();
        fiveDPreCalcLocks.clear();
        
        console.log('✅ [5D_PRECALC_CLEANUP] Cleanup completed');
        
    } catch (error) {
        console.error('❌ [5D_PRECALC_CLEANUP] Error during cleanup:', error);
    }
};

/**
 * Initialize 5D pre-calculation scheduler
 */
async function initialize() {
    try {
        console.log('🚀 [5D_PRECALC_INIT] Initializing 5D pre-calculation scheduler...');
        
        // Connect to database
        await connectDB();
        console.log('✅ [5D_PRECALC_INIT] Database connected');
        
        // Initialize models and sequelize
        models = require('../models');
        const { getSequelizeInstance } = require('../config/db');
        sequelize = await getSequelizeInstance();
        console.log('✅ [5D_PRECALC_INIT] Models initialized');
        
        // Initialize services
        periodService = require('../services/periodService');
        gameLogicService = require('../services/gameLogicService');
        console.log('✅ [5D_PRECALC_INIT] Services initialized');
        
        // Setup Redis communication
        await setup5DPreCalcCommunication();
        console.log('✅ [5D_PRECALC_INIT] Redis communication setup complete');
        
        // Start 5D pre-calculation monitoring
        await start5DPreCalcMonitoring();
        console.log('✅ [5D_PRECALC_INIT] 5D pre-calculation monitoring started');
        
        console.log('🎉 [5D_PRECALC_INIT] 5D pre-calculation scheduler initialized successfully');
        
    } catch (error) {
        console.error('❌ [5D_PRECALC_INIT] Error initializing 5D pre-calculation scheduler:', error);
        throw error;
    }
}

/**
 * Start 5D pre-calculation scheduler
 */
const start5DPreCalcScheduler = async () => {
    try {
        console.log('🚀 [5D_PRECALC_SCHEDULER] Starting 5D pre-calculation scheduler...');
        
        // Initialize
        await initialize();
        
        // Setup graceful shutdown
        process.on('SIGINT', async () => {
            console.log('🛑 [5D_PRECALC_SCHEDULER] Received SIGINT, shutting down gracefully...');
            cleanup5DPreCalc();
            process.exit(0);
        });
        
        process.on('SIGTERM', async () => {
            console.log('🛑 [5D_PRECALC_SCHEDULER] Received SIGTERM, shutting down gracefully...');
            cleanup5DPreCalc();
            process.exit(0);
        });
        
        console.log('✅ [5D_PRECALC_SCHEDULER] 5D pre-calculation scheduler started successfully');
        
    } catch (error) {
        console.error('❌ [5D_PRECALC_SCHEDULER] Error starting 5D pre-calculation scheduler:', error);
        process.exit(1);
    }
};

// Export functions
module.exports = {
    start5DPreCalcScheduler,
    execute5DPreCalculation,
    handle5DPreCalcRequest,
    cleanup5DPreCalc
};

// Start scheduler if this file is run directly
if (require.main === module) {
    start5DPreCalcScheduler();
} 