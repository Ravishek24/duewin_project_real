require('dotenv').config();
const unifiedRedis = require('../config/unifiedRedisManager');
function getRedisHelper() { return unifiedRedis.getHelper(); }


// Backend/services/websocketService.js - ENHANCED: Added bet placement with validation

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/constants');




const { logger } = require('../utils/logger');
const moment = require('moment-timezone');
const { getSequelizeInstance } = require('../config/db');
const { initializeModels } = require('../models');
const { recordVipExperience } = require('./autoVipService');


function getPublisherRedis() {
  return unifiedRedis.getConnection('publisher');
}

const gameIntervals = new Map();
let gameTicksStarted = false;

const GAME_CONFIGS = {
    wingo: [30, 60, 180, 300],
    trx_wix: [30, 60, 180, 300],
    fiveD: [60, 180, 300, 600],
    k3: [60, 180, 300, 600]
};

// Import game logic functions for bet processing
const {
    validateBetWithTimeline,
    processBet,
    getUserGameBalance,
    getUserBetHistory,
    getEnhancedPeriodStatus,
    ensureModelsInitialized,
    storeBetInRedisWithTimeline
} = require('./gameLogicService');


// CRITICAL FIX: Create proper Redis subscriber for ElastiCache
let redisSubscriber = null;

const Redis = require('ioredis');
const createRedisSubscriber = async () => {
    try {
        ////console.log('🔄 [REDIS_SUBSCRIBER] Creating dedicated Redis subscriber for ElastiCache...');

        // Use the same config as your main Redis connection but create a separate instance
        const subscriberConfig = {
            host: process.env.REDIS_HOST ,
            port: process.env.REDIS_PORT || 6379,
            password: process.env.REDIS_PASSWORD || '',
            db: process.env.REDIS_DB || 0,
            // CRITICAL: Same TLS configuration as your working redis.js
            tls: {
                rejectUnauthorized: false,
                requestCert: true,
                agent: false
            },
            retryStrategy: function (times) {
                const delay = Math.min(times * 50, 2000);
                return delay;
            },
            connectTimeout: 15000,
            commandTimeout: 5000,
            lazyConnect: false,
            enableOfflineQueue: true,
            maxRetriesPerRequest: 3,
            family: 4
        };

        // Add debug log to print the actual config being used
        ////console.log('[DEBUG] About to create Redis subscriber with config:', subscriberConfig);

        redisSubscriber = new Redis(subscriberConfig);

        // Enhanced event handlers
        redisSubscriber.on('connect', () => {
            ////console.log('✅ [REDIS_SUBSCRIBER] Connected to ElastiCache');
        });

        redisSubscriber.on('ready', () => {
            ////console.log('✅ [REDIS_SUBSCRIBER] Ready for subscriptions');
            redisSubscriber.options.enableOfflineQueue = false;
        });

        redisSubscriber.on('error', (err) => {
            console.error('❌ [REDIS_SUBSCRIBER] Error:', err.message);
        });

        redisSubscriber.on('reconnecting', (ms) => {
            ////console.log(`🔄 [REDIS_SUBSCRIBER] Reconnecting in ${ms}ms...`);
        });

        // Wait for connection
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Redis subscriber connection timeout'));
            }, 20000);

            if (redisSubscriber.status === 'ready') {
                clearTimeout(timeout);
                resolve();
                return;
            }

            redisSubscriber.on('ready', () => {
                clearTimeout(timeout);
                resolve();
            });

            redisSubscriber.on('error', (err) => {
                clearTimeout(timeout);
                reject(err);
            });
        });

        ////console.log('✅ [REDIS_SUBSCRIBER] Subscriber created successfully');
        return redisSubscriber;

    } catch (error) {
        console.error('❌ [REDIS_SUBSCRIBER] Failed to create subscriber:', error);
        throw error;
    }
};



/**
 * Bet limit functions for WebSocket validation
 */
const getMinBetAmount = (gameType) => {
    // Minimum bet amount is ₹0.95 (net amount after platform fee)
    return 0.97;
};

const getMaxBetAmount = (gameType) => {
    // Maximum bet amount is ₹1,00,000 (gross amount)
    return 1000000000;
};

const getMaxBetsPerUser = (gameType) => {
    // Maximum 50 bets per user per period
    return 100;
};

const getMaxTotalBetPerPeriod = (gameType) => {
    // Maximum total bet amount per period (same as max bet amount)
    return 1000000000;
};

// Import period service
const periodService = require('./periodService');

// Import game logic service for direct access
const gameLogicService = require('./gameLogicService');

// Socket.io server instance
let io = null;
let models = null;

/**
 * NEW: Get room ID based on game type, duration, and timeline
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 * @param {string} timeline - Timeline (default: 'default')
 * @returns {string} - Room ID
 */
const getRoomId = (gameType, duration, timeline = 'default') => {
    if (timeline === 'default') {
        return `${gameType}_${duration}`;
    }
    return `${gameType}_${duration}_${timeline}`;
};





/**
 * FIXED: Period time calculation functions (matching gameScheduler.js)
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



// Initialize models before starting WebSocket server
const initializeWebSocketModels = async () => {
    try {
        ////console.log('🔄 Initializing WebSocket models...');
        const sequelize = await getSequelizeInstance();
        models = await initializeModels();
        models.sequelize = sequelize;
        if (!models.GameCombinations5D || !models.Game5DSummaryStats) {
            throw new Error('GameCombinations5D or Game5DSummaryStats model not initialized');
        }
        ////console.log('✅ WebSocket models initialized successfully');
        return models;
    } catch (error) {
        console.error('❌ Failed to initialize WebSocket models:', error);
        throw error;
    }
};


/**
 * FIXED: Get period info from Redis - Enhanced for multi-instance setup
 */
const getPeriodInfoFromRedis = async (gameType, duration) => {
    try {
        // Only use the correct key written by the scheduler
        const key = `game_scheduler:${gameType}:${duration}:current`;
        
        // CRITICAL DEBUG: Add logging to track Redis reads
        ////console.log(`🔍 [REDIS_READ_ATTEMPT] ${gameType}_${duration}: Attempting to read from Redis key: ${key}`);
        
        try {
            const periodData = await getRedisHelper().get(key);
            
            // CRITICAL DEBUG: Log what we got from Redis
            if (periodData) {
                ////console.log(`✅ [REDIS_READ_SUCCESS] ${gameType}_${duration}: Got data from Redis`);
                ////console.log(`🔍 [REDIS_READ_DEBUG] ${gameType}_${duration}: Data from Redis:`, periodData);
                ////console.log(`🔍 [REDIS_READ_DEBUG] ${gameType}_${duration}: Data type:`, typeof periodData);
                
                // CRITICAL FIX: unifiedRedis.get() already parses JSON, so periodData is already an object
                // No need to call JSON.parse() again
                let parsed;
                try {
                    parsed = typeof periodData === 'string' ? JSON.parse(periodData) : periodData;
                } catch (parseError) {
                    console.error(`❌ [REDIS_PARSE_ERROR] ${gameType}_${duration}: JSON parse error:`, parseError.message);
                    console.error(`❌ [REDIS_PARSE_ERROR] Raw data:`, periodData);
                    return null;
                }
                
                if (parsed && parsed.periodId && parsed.endTime) {
                    // CRITICAL FIX: Add logging for Redis period data
                    ////console.log(`📥 [REDIS_PERIOD_LOGGING] ${gameType}_${duration}: periodId: ${parsed.periodId}, endTime: ${parsed.endTime}, timeRemaining: ${parsed.timeRemaining || 'N/A'}, bettingOpen: ${parsed.bettingOpen || 'N/A'}`);
                    
                    // CRITICAL FIX: Add detailed logging for new period stuck issue
                    if (parsed.timeRemaining === duration) {
                        ////console.log(`🔍 [REDIS_DEBUG] ${gameType}_${duration}: Period data shows stuck at start time!`);
                        ////console.log(`🔍 [REDIS_DEBUG] Full parsed data:`, JSON.stringify(parsed, null, 2));
                    }
                    
                    // Add debugging for countdown stopping issue
                    if (parsed.timeRemaining <= 10) {
                        ////console.log(`🔍 [REDIS_COUNTDOWN_DEBUG] ${gameType}_${duration}: Reading from Redis - timeRemaining: ${parsed.timeRemaining}s, periodId: ${parsed.periodId}`);
                    }
                    
                    return parsed;
                } else {
                    console.warn(`⚠️ [REDIS_PARSE_ERROR] ${gameType}_${duration}: Period data missing periodId or endTime:`, parsed);
                    console.warn(`⚠️ [REDIS_PARSE_ERROR] ${gameType}_${duration}: periodId: ${parsed?.periodId}, endTime: ${parsed?.endTime}`);
                }
            } else {
                console.warn(`❌ [REDIS_NO_DATA] ${gameType}_${duration}: No data found in Redis for key: ${key}`);
            }
        } catch (keyError) {
            console.error(`❌ [REDIS_READ_ERROR] ${gameType}_${duration}: Error reading from Redis:`, keyError.message);
            console.error(`❌ [REDIS_READ_ERROR] ${gameType}_${duration}: Stack trace:`, keyError.stack);
        }
        
        console.warn(`⚠️ [PERIOD_INFO] No valid period data found for ${gameType}_${duration}`);
        return null;
    } catch (error) {
        console.error(`❌ [PERIOD_INFO] Error getting period info from Redis for ${gameType}_${duration}:`, error.message);
        console.error(`❌ [PERIOD_INFO] Stack trace:`, error.stack);
        return null;
    }
};


/**
 * Start broadcast ticks
 */
const startBroadcastTicks = () => {
    try {
        ////console.log('🕐 Starting broadcast tick system for multi-instance setup...');
        ////console.log(`📋 [START_BROADCAST_TICKS] GAME_CONFIGS:`, JSON.stringify(GAME_CONFIGS, null, 2));

        Object.entries(GAME_CONFIGS).forEach(([gameType, durations]) => {
            ////console.log(`🎮 [START_BROADCAST_TICKS] Processing game: ${gameType} with durations: [${durations.join(', ')}]`);
            durations.forEach(duration => {
                ////console.log(`⏰ [START_BROADCAST_TICKS] Starting ${gameType}_${duration}`);
                startBroadcastTicksForGame(gameType, duration);
            });
        });

        gameTicksStarted = true;
        ////console.log('✅ Broadcast tick system started');
        ////console.log(`📊 [START_BROADCAST_TICKS] Total intervals started: ${gameIntervals.size}`);

    } catch (error) {
        console.error('❌ Error starting broadcast ticks:', error);
    }
};



/**
 * MISSING: Start broadcast ticks for specific game/duration combination
 */
const startBroadcastTicksForGame = (gameType, duration) => {
    const key = `${gameType}_${duration}`;

    ////console.log(`🔧 [START_BROADCAST_TICKS] Starting broadcast ticks for ${gameType}_${duration}`);

    if (gameIntervals.has(key)) {
        ////console.log(`🔄 [START_BROADCAST_TICKS] Clearing existing interval for ${gameType}_${duration}`);
        clearInterval(gameIntervals.get(key));
    }

    const intervalId = setInterval(async () => {
        try {
            await broadcastTick(gameType, duration);
        } catch (error) {
            console.error(`❌ [BROADCAST_TICK_INTERVAL_ERROR] ${gameType}_${duration}:`, error.message);
        }
    }, 1000);

    gameIntervals.set(key, intervalId);
    ////console.log(`⏰ [BROADCAST_TICK_STARTED] Started broadcast ticks for ${gameType} ${duration}s (intervalId: ${intervalId})`);
};

/**
 * NEW: Request period from scheduler instance via Redis
 */
const requestPeriodFromScheduler = async (gameType, duration) => {
    try {
        const requestData = {
            action: 'request_period',
            gameType,
            duration,
            timestamp: new Date().toISOString(),
            source: 'websocket_instance'
        };

        // Publish request to scheduler
        await getPublisherRedis().publish('scheduler:period_request', JSON.stringify(requestData));
        ////console.log(`📤 [PERIOD_REQUEST] Requested period for ${gameType}_${duration}`);

    } catch (error) {
        console.error('❌ [PERIOD_REQUEST] Error requesting period:', error);
    }
};

/**
 * CRITICAL FIX: Enhanced room monitoring for debugging
 */
const logRoomStatus = () => {
    if (!io) return;

    ////console.log(`\n👥 [ROOM_STATUS] ==========================================`);
    ////console.log(`👥 [ROOM_STATUS] Connected clients: ${io.sockets.sockets.size}`);

    Object.entries(GAME_CONFIGS).forEach(([gameType, durations]) => {
        durations.forEach(duration => {
            const roomId = `${gameType}_${duration}`;
            const room = io.sockets.adapter.rooms.get(roomId);
            const clientCount = room ? room.size : 0;

            if (clientCount > 0) {
                ////console.log(`👥 [ROOM_STATUS] ${roomId}: ${clientCount} clients`);

                // List socket IDs in room (for debugging)
                if (room) {
                    const socketIds = Array.from(room).slice(0, 3); // Show first 3
                    ////console.log(`   - Sockets: ${socketIds.join(', ')}${room.size > 3 ? ` +${room.size - 3} more` : ''}`);
                }
            }
        });
    });

    ////console.log(`👥 [ROOM_STATUS] ==========================================\n`);
};

// Add room status logging every 30 seconds
setInterval(logRoomStatus, 30000);


/**
 * CRITICAL FIX: Test client broadcasting functionality
 */
const testClientBroadcasting = () => {
    if (!io) {
        console.error('❌ [BROADCAST_TEST] Socket.io not available');
        return;
    }

    ////console.log('🧪 [BROADCAST_TEST] Testing client broadcasting...');

    // Test broadcast to all rooms
    Object.entries(GAME_CONFIGS).forEach(([gameType, durations]) => {
        durations.forEach(duration => {
            const roomId = `${gameType}_${duration}`;
            const room = io.sockets.adapter.rooms.get(roomId);
            const clientCount = room ? room.size : 0;

            if (clientCount > 0) {
                const testData = {
                    test: true,
                    gameType,
                    duration,
                    roomId,
                    clientCount,
                    timestamp: new Date().toISOString(),
                    message: 'WebSocket broadcasting test'
                };

                io.to(roomId).emit('broadcastTest', testData);
                ////console.log(`🧪 [BROADCAST_TEST] Sent test to ${roomId} (${clientCount} clients)`);
            }
        });
    });
};


/**
 * CRITICAL FIX: Enhanced broadcast tick with proper period transition handling
 */
/**
 * COMPLETE FIX: Enhanced WebSocket service with proper event deduplication and sequencing
 */

// Global event tracking to prevent duplicates
if (!global.eventTracker) {
    global.eventTracker = {
        processedEvents: new Map(),
        lastPeriodUpdates: new Map(),
        periodTransitions: new Map()
    };
}

/**
 * CRITICAL FIX: Enhanced broadcast tick with proper timing and no skipping
 */
const broadcastTick = async (gameType, duration) => {
    try {
        if (!io) return;
        
        // CRITICAL FIX: Ensure eventSequencer is initialized
        if (!global.eventSequencer) {
            ////console.log(`🔧 [BROADCAST_TICK_DEBUG] Initializing eventSequencer for ${gameType}_${duration}`);
            global.eventSequencer = {
                processedEvents: new Map(),
                periodStates: new Map(),
                sequenceLocks: new Map()
            };
        }
        
        const key = `${gameType}_${duration}`;
        const roomId = `${gameType}_${duration}`;

        // CRITICAL DEBUG: Add logging to see which games are being processed
        ////console.log(`🔍 [BROADCAST_TICK_DEBUG] Processing ${gameType}_${duration}`);

        // Get period info from Redis
        const periodInfo = await getPeriodInfoFromRedis(gameType, duration);

        if (!periodInfo) {
            ////console.log(`❌ [BROADCAST_TICK_DEBUG] No period info for ${gameType}_${duration}, requesting from scheduler`);
            await requestPeriodFromSchedulerDebounced(gameType, duration);
            return;
        }

        const now = new Date();
        let actualTimeRemaining;

        // Calculate time remaining
        try {
            const actualEndTime = calculatePeriodEndTime(periodInfo.periodId, duration);
            actualTimeRemaining = Math.max(0, Math.floor((actualEndTime - now) / 1000));
        } catch (timeError) {
            const redisEndTime = new Date(periodInfo.endTime);
            actualTimeRemaining = Math.max(0, Math.floor((redisEndTime - now) / 1000));
        }

        // CRITICAL DEBUG: Log time calculation
        ////console.log(`⏰ [BROADCAST_TICK_DEBUG] ${gameType}_${duration}: calculated timeRemaining: ${actualTimeRemaining}s`);

        // Validate time remaining
        if (actualTimeRemaining > duration + 1) {
            ////console.log(`⚠️ [BROADCAST_TICK_DEBUG] ${gameType}_${duration}: timeRemaining too high (${actualTimeRemaining}s), requesting new period`);
            await requestPeriodFromSchedulerDebounced(gameType, duration);
            return;
        }

        actualTimeRemaining = Math.min(actualTimeRemaining, duration);

        // CRITICAL FIX: Check for sequence locks (prevents sending timeUpdate immediately after periodStart)
        const sequenceLock = `sequence_${gameType}_${duration}_${periodInfo.periodId}`;
        if (global.eventSequencer.sequenceLocks.has(sequenceLock)) {
            ////console.log(`⏸️ [SEQUENCE_LOCK] Waiting for periodStart sequence to complete for ${periodInfo.periodId}`);
            return;
        }

        // Enhanced period transition detection
        const trackingKey = `last_period_${key}`;
        const currentState = global.eventSequencer.periodStates.get(trackingKey);
        const lastSentPeriodId = currentState?.periodId;
        
        // Detect period transition
        if (lastSentPeriodId && lastSentPeriodId !== periodInfo.periodId) {
            ////console.log(`🔄 [PERIOD_TRANSITION] ${roomId}: Transitioning from ${lastSentPeriodId} to ${periodInfo.periodId}`);
            
            // Send final 0 update for old period (only once)
            const zeroKey = `zero_sent_${lastSentPeriodId}`;
            if (!global.eventSequencer.processedEvents.has(zeroKey)) {
                const zeroTimeUpdate = {
                    gameType,
                    duration,
                    periodId: lastSentPeriodId,
                    timeRemaining: 0,
                    endTime: calculatePeriodEndTime(lastSentPeriodId, duration).toISOString(),
                    bettingOpen: false,
                    bettingCloseTime: true,
                    timestamp: now.toISOString(),
                    roomId,
                    source: 'websocket_final_zero'
                };

                io.to(roomId).emit('timeUpdate', zeroTimeUpdate);
                ////console.log(`📤 [FINAL_ZERO] ${roomId}: Sent final 0 for period ${lastSentPeriodId}`);
                
                global.eventSequencer.processedEvents.set(zeroKey, Date.now());
                setTimeout(() => global.eventSequencer.processedEvents.delete(zeroKey), 30000);
                
                // Wait for periodStart before continuing
                await new Promise(resolve => setTimeout(resolve, 200));
            }
            
            // Update tracking to new period
            global.eventSequencer.periodStates.set(trackingKey, {
                periodId: periodInfo.periodId,
                startedAt: Date.now(),
                source: 'websocket'
            });
        } else if (!currentState) {
            // First time tracking this period
            global.eventSequencer.periodStates.set(trackingKey, {
                periodId: periodInfo.periodId,
                startedAt: Date.now(),
                source: 'websocket'
            });
        }

        // Calculate betting status
        const bettingOpen = actualTimeRemaining >= 5;
        const bettingCloseTime = actualTimeRemaining < 5;

        // Prepare time update data
        const timeUpdateData = {
            gameType,
            duration,
            periodId: periodInfo.periodId,
            timeRemaining: actualTimeRemaining,
            endTime: periodInfo.endTime,
            bettingOpen,
            bettingCloseTime,
            timestamp: now.toISOString(),
            roomId,
            source: 'websocket_tick',
            clientCount: io.sockets.adapter.rooms.get(roomId)?.size || 0
        };

        // CRITICAL DEBUG: Log before emitting
        ////console.log(`📤 [BROADCAST_TICK_DEBUG] ${gameType}_${duration}: Emitting timeUpdate with timeRemaining: ${actualTimeRemaining}s, clientCount: ${timeUpdateData.clientCount}`);

        // Emit timeUpdate
        io.to(roomId).emit('timeUpdate', timeUpdateData);
        
        // Mark as sent with shorter expiry to allow more frequent updates
        // global.eventSequencer.processedEvents.set(updateKey, Date.now());
        // setTimeout(() => global.eventSequencer.processedEvents.delete(updateKey), 1000);

        // Log significant events
        if (actualTimeRemaining <= 5 || actualTimeRemaining % 10 === 0) {
            ////console.log(`⏰ [TIME_UPDATE] ${roomId}: ${actualTimeRemaining}s (period: ${periodInfo.periodId})`);
        }
        
        // Enhanced logging for 5D pre-calculation debugging
        if (['5d', 'fived'].includes(gameType.toLowerCase()) && actualTimeRemaining <= 10) {
            console.log(`⏰ [5D_TIMING_DEBUG] ${roomId}: t=${actualTimeRemaining}s, period=${periodInfo.periodId}`);
        }

        // Handle bet freeze (t = -3s) - Trigger pre-calculation for 5D (safer approach)
        // IMPROVED: Trigger at t=3s to ensure pre-calculation completes before bet freeze
        if (actualTimeRemaining === 3 && ['5d', 'fived'].includes(gameType.toLowerCase())) {
            const preCalcKey = `precalc_triggered_${periodInfo.periodId}`;
            if (!global.eventSequencer.processedEvents.has(preCalcKey)) {
                console.log(`🔄 [5D_PRECALC_TRIGGER] ${roomId}: Triggering pre-calculation for period ${periodInfo.periodId} (t=${actualTimeRemaining}s)`);
                
                global.eventSequencer.processedEvents.set(preCalcKey, Date.now());
                setTimeout(() => global.eventSequencer.processedEvents.delete(preCalcKey), 30000);
                
                // Import and trigger pre-calculation
                try {
                    const { preCalculate5DResultAtFreeze } = require('./gameLogicService');
                    await preCalculate5DResultAtFreeze(gameType, duration, periodInfo.periodId, 'default');
                    console.log(`✅ [5D_PRECALC_TRIGGER] ${roomId}: Pre-calculation completed for period ${periodInfo.periodId}`);
                } catch (error) {
                    console.error(`❌ [5D_PRECALC_TRIGGER] ${roomId}: Pre-calculation failed for period ${periodInfo.periodId}:`, error.message);
                }
            }
        }

        // Handle period end
        if (actualTimeRemaining === 0) {
            const periodEndKey = `end_handled_${periodInfo.periodId}`;
            if (!global.eventSequencer.processedEvents.has(periodEndKey)) {
                ////console.log(`🏁 [PERIOD_END] ${roomId}: Period ${periodInfo.periodId} ended`);
                
                global.eventSequencer.processedEvents.set(periodEndKey, Date.now());
                setTimeout(() => global.eventSequencer.processedEvents.delete(periodEndKey), 30000);
                
                // For 5D, use pre-calculated result if available
                if (['5d', 'fived'].includes(gameType.toLowerCase())) {
                    try {
                        const { processGameResultsWithPreCalc } = require('./gameLogicService');
                        console.log(`🎯 [5D_PERIOD_END] ${roomId}: Using pre-calculated result for period ${periodInfo.periodId}`);
                        await processGameResultsWithPreCalc(gameType, duration, periodInfo.periodId, 'default');
                    } catch (error) {
                        console.error(`❌ [5D_PERIOD_END] ${roomId}: Error processing pre-calculated result for period ${periodInfo.periodId}:`, error.message);
                        // Fallback to normal processing
                        try {
                            const { processGameResults } = require('./gameLogicService');
                            await processGameResults(gameType, duration, periodInfo.periodId, 'default');
                        } catch (fallbackError) {
                            console.error(`❌ [5D_PERIOD_END_FALLBACK] ${roomId}: Fallback processing also failed:`, fallbackError.message);
                        }
                    }
                } else {
                    // For non-5D games, use normal processing
                    try {
                        const { processGameResults } = require('./gameLogicService');
                        await processGameResults(gameType, duration, periodInfo.periodId, 'default');
                    } catch (error) {
                        console.error(`❌ [PERIOD_END] ${roomId}: Error processing result for period ${periodInfo.periodId}:`, error.message);
                    }
                }
                
                // Request next period with delay
                setTimeout(async () => {
                    await requestPeriodFromSchedulerDebounced(gameType, duration);
                }, 2000); // 2 second delay for better sequencing
            }
        }

    } catch (error) {
        console.error(`❌ [BROADCAST_TICK_ERROR] ${gameType}_${duration}:`, error.message);
    }
};


/**
 * Enhanced cleanup with better tracking
 */
const cleanupEventSequencer = () => {
    const now = Date.now();
    const maxAge = 300000; // 5 minutes
    let cleaned = 0;
    
    // Clean processed events
    for (const [key, timestamp] of global.eventSequencer.processedEvents.entries()) {
        if (now - timestamp > maxAge) {
            global.eventSequencer.processedEvents.delete(key);
            cleaned++;
        }
    }
    
    // Clean period states
    for (const [key, state] of global.eventSequencer.periodStates.entries()) {
        if (state.startedAt && now - state.startedAt > maxAge) {
            global.eventSequencer.periodStates.delete(key);
            cleaned++;
        }
    }
    
    // Clean sequence locks (should auto-expire but just in case)
    for (const [key, timestamp] of global.eventSequencer.sequenceLocks.entries()) {
        if (now - timestamp > 10000) { // 10 second max lock
            global.eventSequencer.sequenceLocks.delete(key);
            cleaned++;
        }
    }
    
    if (cleaned > 0) {
        ////console.log(`🧹 [SEQUENCER_CLEANUP] Cleaned ${cleaned} entries`);
    }
    
    // Log stats
    const stats = {
        processedEvents: global.eventSequencer.processedEvents.size,
        periodStates: global.eventSequencer.periodStates.size,
        sequenceLocks: global.eventSequencer.sequenceLocks.size
    };
    
    ////console.log(`📊 [SEQUENCER_STATS]`, stats);
};

// Run cleanup every minute
setInterval(cleanupEventSequencer, 60000);
/**
 * CRITICAL: Add this function to your initializeWebSocket function
 * Add this line RIGHT BEFORE returning io:
 */


/**
 * MISSING: Enhanced sendCurrentPeriodFromRedis with more data
 */
const sendCurrentPeriodFromRedisEnhanced = async (socket, gameType, duration) => {
    try {
        const periodInfo = await getPeriodInfoFromRedis(gameType, duration);

        if (!periodInfo) {
            socket.emit('error', {
                message: 'No active period found - game scheduler may not be running',
                gameType,
                duration,
                code: 'NO_ACTIVE_PERIOD'
            });
            return;
        }

        const now = new Date();

        // FIXED: Use actual time calculation for accuracy
        let timeRemaining;
        try {
            const actualEndTime = calculatePeriodEndTime(periodInfo.periodId, duration);
            timeRemaining = Math.max(0, Math.ceil((actualEndTime - now) / 1000));
        } catch (timeError) {
            // Fallback to Redis time
            const redisEndTime = new Date(periodInfo.endTime);
            timeRemaining = Math.max(0, Math.ceil((redisEndTime - now) / 1000));
        }

        const bettingOpen = timeRemaining > 5;

        // FIXED: Validate that time remaining is realistic before sending
        if (timeRemaining > duration) {
            console.warn(`⚠️ WebSocket: Unrealistic time remaining ${timeRemaining}s for period ${periodInfo.periodId}, capping to duration`);
            timeRemaining = duration; // Cap to duration
        }

        // CRITICAL FIX: Add logging for period info sent to clients
        ////console.log(`📤 [PERIOD_INFO_LOGGING] ${gameType}_${duration}: periodId: ${periodInfo.periodId}, timeRemaining: ${timeRemaining}s, duration: ${duration}s, bettingOpen: ${bettingOpen}, bettingCloseTime: ${timeRemaining <= 5}, timestamp: ${now.toISOString()}`);

        // Send complete period info like the old version
        socket.emit('periodInfo', {
            gameType,
            duration,
            periodId: periodInfo.periodId,
            timeRemaining,
            endTime: periodInfo.endTime,
            bettingOpen,
            bettingCloseTime: timeRemaining <= 5,
            timestamp: now.toISOString(),
            source: 'websocket_validated'
        });

        // ALSO send currentPeriod for backward compatibility
        socket.emit('currentPeriod', {
            gameType,
            duration,
            periodId: periodInfo.periodId,
            timeRemaining,
            endTime: periodInfo.endTime,
            bettingOpen,
            bettingCloseTime: timeRemaining <= 5,
            status: bettingOpen ? 'betting' : 'closed',
            timestamp: now.toISOString()
        });

        ////console.log(`📤 WebSocket: Sent enhanced period info [${gameType}|${duration}s]: ${periodInfo.periodId} (${timeRemaining}s, betting: ${bettingOpen})`);

    } catch (error) {
        console.error('❌ WebSocket: Error sending period info:', error);
        socket.emit('error', {
            message: 'Failed to get current period info',
            gameType,
            duration,
            code: 'PERIOD_INFO_ERROR'
        });
    }
};

/**
 * NEW: WebSocket-specific bet processing that handles timing validation properly
 */
const processWebSocketBet = async (socket, data) => {
    try {
        const { gameType, duration, betType, betValue, betAmount, timeline = 'default' } = data;
        const userId = socket.user.userId || socket.user.id;
        const timestamp = new Date().toISOString();

        console.log(`\n🎲 [WS_BET_PROCESS_START] ==========================================`);
        console.log(`🎲 [WS_BET_PROCESS_START] Processing WebSocket bet for user ${userId} at ${timestamp}`);
        console.log(`🎲 [WS_BET_PROCESS_START] Socket ID: ${socket.id}`);
        console.log(`🎲 [WS_BET_PROCESS_START] Raw bet received:`, JSON.stringify(data, null, 2));

        // Validate input
        console.log(`🔍 [WS_BET_VALIDATION] ==========================================`);
        console.log(`🔍 [WS_BET_VALIDATION] Validating input parameters...`);

        if (!gameType || !duration || !betType || betValue === undefined || !betAmount) {
            console.log(`❌ [WS_BET_VALIDATION] Missing required fields:`, { gameType, duration, betType, betValue, betAmount });
            socket.emit('betError', {
                success: false,
                message: 'Missing required fields'
            });
            return { success: false, message: 'Missing required fields' };
        }

        // Validate bet amount
        if (isNaN(betAmount) || parseFloat(betAmount) <= 0) {
            console.log(`❌ [WS_BET_VALIDATION] Invalid bet amount: ${betAmount}`);
            socket.emit('betError', {
                success: false,
                message: 'Invalid bet amount'
            });
            return { success: false, message: 'Invalid bet amount' };
        }

        console.log(`✅ [WS_BET_VALIDATION] Input validation passed`);

        // Get current period
        console.log(`⏰ [WS_BET_PERIOD] ==========================================`);
        console.log(`⏰ [WS_BET_PERIOD] Getting current period for ${gameType} ${duration}s...`);

        const currentPeriod = await periodService.getCurrentPeriod(gameType, duration, timeline);
        if (!currentPeriod || !currentPeriod.periodId) {
            console.log(`❌ [WS_BET_PERIOD] No active betting period found`);
            socket.emit('betError', {
                success: false,
                message: 'No active betting period'
            });
            return { success: false, message: 'No active betting period' };
        }

        console.log(`✅ [WS_BET_PERIOD] Current period:`, JSON.stringify(currentPeriod, null, 2));

        // Check if betting is allowed (not in last 5 seconds)
        const now = Date.now();
        const periodEnd = currentPeriod.endTime;
        const timeRemaining = periodEnd - now;

        console.log(`⏰ [WS_BET_TIMING] ==========================================`);
        console.log(`⏰ [WS_BET_TIMING] Current time: ${new Date(now).toISOString()}`);
        console.log(`⏰ [WS_BET_TIMING] Period end: ${new Date(periodEnd).toISOString()}`);
        console.log(`⏰ [WS_BET_TIMING] Time remaining: ${timeRemaining}ms (${timeRemaining / 1000}s)`);

        if (timeRemaining <= 5000) {
            console.log(`❌ [WS_BET_TIMING] Betting closed - only ${timeRemaining}ms remaining`);
            socket.emit('betError', {
                success: false,
                message: 'Betting closed for this period'
            });
            return { success: false, message: 'Betting closed for this period' };
        }

        console.log(`✅ [WS_BET_TIMING] Betting is allowed - ${timeRemaining}ms remaining`);

        // Validate bet placement
        console.log(`🔍 [WS_BET_PLACEMENT_VALIDATION] ==========================================`);
        console.log(`🔍 [WS_BET_PLACEMENT_VALIDATION] Validating bet placement...`);

        const validation = await validateBetPlacement(userId, gameType, duration, currentPeriod.periodId, betAmount, timeline);
        if (!validation.valid) {
            console.log(`❌ [WEBSOCKET_BET_VALIDATION_FAILED] Validation failed for user ${userId}:`, validation.error);
            socket.emit('betError', {
                message: validation.error,
                timestamp: timestamp
            });
            return { success: false, message: validation.error };
        }

        console.log(`✅ [WEBSOCKET_BET_VALIDATION_SUCCESS] Validation passed for user ${userId}`);

        // Calculate odds using game logic service
        console.log(`💰 [WS_BET_ODDS] ==========================================`);
        console.log(`💰 [WS_BET_ODDS] Calculating odds for bet type: ${betType}, value: ${betValue}`);

        const gameLogicService = require('./gameLogicService');
        const odds = gameLogicService.calculateOdds(gameType, betType, betValue);
        if (!odds) {
            console.log(`❌ [WS_BET_ODDS] Invalid bet type or value: ${betType}:${betValue}`);
            socket.emit('betError', {
                success: false,
                message: 'Invalid bet type or value'
            });
            return { success: false, message: 'Invalid bet type or value' };
        }

        console.log(`✅ [WS_BET_ODDS] Calculated odds: ${odds}x`);

        // Process the bet with game logic service
        console.log(`🎯 [WS_BET_GAME_LOGIC] ==========================================`);
        console.log(`🎯 [WS_BET_GAME_LOGIC] Calling gameLogicService.processBet...`);

        const betDataForProcessing = {
            userId,
            gameType,
            duration,
            timeline,
            periodId: currentPeriod.periodId,
            betType,
            betValue,
            betAmount,
            odds
        };

        console.log(`🎯 [WS_BET_GAME_LOGIC] Bet data for processing:`, JSON.stringify(betDataForProcessing, null, 2));

        const betResult = await gameLogicService.processBet(betDataForProcessing);

        console.log(`📊 [WS_BET_GAME_LOGIC_RESULT] ==========================================`);
        console.log(`📊 [WS_BET_GAME_LOGIC_RESULT] Game logic processing result:`, JSON.stringify(betResult, null, 2));

        if (betResult.success) {
            console.log(`✅ [WS_BET_SUCCESS] ==========================================`);
            console.log(`✅ [WS_BET_SUCCESS] Bet processed successfully by game logic`);
            console.log(`✅ [WS_BET_SUCCESS] Bet ID: ${betResult.data.betId}`);
            console.log(`✅ [WS_BET_SUCCESS] Gross amount: ₹${betResult.data.grossBetAmount}`);
            console.log(`✅ [WS_BET_SUCCESS] Net amount: ₹${betResult.data.netBetAmount}`);
            console.log(`✅ [WS_BET_SUCCESS] Platform fee: ₹${betResult.data.platformFee}`);
            console.log(`✅ [WS_BET_SUCCESS] Expected win: ₹${betResult.data.expectedWin}`);
            console.log(`✅ [WS_BET_SUCCESS] Wallet balance after: ₹${betResult.data.walletBalanceAfter}`);

            socket.emit('betSuccess', {
                success: true,
                betId: betResult.data.betId,
                periodId: currentPeriod.periodId,
                betAmount: betResult.data.grossBetAmount,
                netAmount: betResult.data.netBetAmount,
                platformFee: betResult.data.platformFee,
                odds: betResult.data.odds,
                expectedWin: betResult.data.expectedWin,
                walletBalance: betResult.data.walletBalanceAfter,
                betType,
                betValue,
                gameType,
                duration,
                timeline,
                message: 'Bet placed successfully'
            });

            // Update room with total bets using new hash structure
            console.log(`📡 [WS_BET_BROADCAST] ==========================================`);
            console.log(`📡 [WS_BET_BROADCAST] Updating room with total bets...`);

            const roomId = getRoomId(gameType, duration, timeline);
            const totalBets = await getTotalBetsForPeriod(gameType, duration, currentPeriod.periodId, timeline);

            console.log(`📡 [WS_BET_BROADCAST] Room ID: ${roomId}`);
            console.log(`📡 [WS_BET_BROADCAST] Total bets:`, JSON.stringify(totalBets, null, 2));

            socket.to(roomId).emit('totalBetsUpdate', {
                gameType,
                duration,
                periodId: currentPeriod.periodId,
                totalBets: totalBets.totalAmount,
                betCount: totalBets.betCount,
                timeline
            });

            console.log(`✅ [WS_BET_COMPLETE] ==========================================`);
            console.log(`✅ [WS_BET_COMPLETE] Bet placed successfully for user ${userId}`);
            console.log(`✅ [WS_BET_COMPLETE] Room updated with total bets`);

            return { success: true, data: betResult.data };

        } else {
            console.log(`❌ [WS_BET_GAME_LOGIC_FAILED] ==========================================`);
            console.log(`❌ [WS_BET_GAME_LOGIC_FAILED] Game logic processing failed:`, betResult.message);
            console.log(`❌ [WS_BET_GAME_LOGIC_FAILED] Error code:`, betResult.code);

            socket.emit('betError', {
                success: false,
                message: betResult.message || 'Failed to place bet',
                code: betResult.code
            });
            return { success: false, message: betResult.message || 'Failed to place bet', code: betResult.code };
        }

    } catch (error) {
        console.log(`💥 [WS_BET_ERROR] ==========================================`);
        console.log(`💥 [WS_BET_ERROR] Unexpected error processing WebSocket bet for user ${socket.user?.userId || socket.user?.id}:`);
        console.log(`💥 [WS_BET_ERROR] Error:`, error.message);
        console.log(`💥 [WS_BET_ERROR] Stack:`, error.stack);
        console.log(`💥 [WS_BET_ERROR] Bet data:`, JSON.stringify(data, null, 2));

        socket.emit('betError', {
            success: false,
            message: 'Server error while processing bet'
        });
        return { success: false, message: 'Server error while processing bet' };
    }
};

/**
 * 5D ROOM: Dedicated mapping function for 5D game
 */
const mapFiveDBet = (betData) => {
    const { type, selection, position } = betData;
    const clientType = String(type || '').toLowerCase();
    const clientSelection = String(selection || '').toLowerCase();

    // Check if this is a sum bet (position is 'SUM' or 'sum')
    if (position === 'SUM' || position === 'sum') {
        // Sum-based bets
        if (clientSelection === 'odd' || clientSelection === 'even') {
            return {
                betType: 'SUM_PARITY',
                betValue: `SUM_${clientSelection}`,
                odds: 2.0
            };
        } else {
            return {
                betType: 'SUM_SIZE',
                betValue: `SUM_${clientSelection}`,
                odds: 2.0
            };
        }
    }

    // Position-based bets (A, B, C, D, E)
    if (clientSelection === 'odd' || clientSelection === 'even') {
        return {
            betType: 'POSITION_PARITY',
            betValue: `${position.toUpperCase()}_${clientSelection}`,
            odds: 2.0
        };
    }

    switch (clientType) {
        case 'size':
            return {
                betType: 'POSITION_SIZE',
                betValue: `${position.toUpperCase()}_${clientSelection}`,
                odds: 2.0
            };
        case 'number':
            return {
                betType: 'POSITION',
                betValue: `${position.toUpperCase()}_${selection}`,
                odds: 9.0
            };
        case 'parity':
        case 'odd':
        case 'even':
            return {
                betType: 'POSITION_PARITY',
                betValue: `${position.toUpperCase()}_${clientSelection}`,
                odds: 2.0
            };
        default:
            return {
                betType: 'POSITION',
                betValue: `${position.toUpperCase()}_${selection}`,
                odds: 9.0
            };
    }
};

/**
 * WINGO/TRX_WIX ROOM: Dedicated mapping function for WINGO and TRX_WIX games
 */
const mapWingoBet = (betData) => {
    const { type, selection } = betData;
    const clientType = String(type || '').toLowerCase();
    const clientSelection = String(selection || '').toLowerCase();

    switch (clientType) {
        case 'number':
            return {
                betType: 'NUMBER',
                betValue: clientSelection,
                odds: 9.0
            };
        case 'color':
            return {
                betType: 'COLOR',
                betValue: clientSelection,
                odds: 2.0
            };
        case 'size':
            return {
                betType: 'SIZE',
                betValue: clientSelection,
                odds: 2.0
            };
        case 'parity':
            return {
                betType: 'PARITY',
                betValue: clientSelection,
                odds: 2.0
            };
        default:
            // Default to number bet if type is not recognized
            return {
                betType: 'NUMBER',
                betValue: clientSelection,
                odds: 9.0
            };
    }
};

/**
 * LEGACY: Keep for backward compatibility
 */
const mapClientBetType = (clientType, betData = {}) => {
    const type = String(clientType || '').toLowerCase();
    const selection = String(betData.selection || '').toLowerCase();

    // Check if this is a position-based bet (has position field)
    if (betData.position && betData.position !== 'sum' && betData.position !== 'SUM') {
        // Position-based bets (A, B, C, D, E)
        // Check selection first to determine actual bet type
        if (selection === 'odd' || selection === 'even') {
            return 'POSITION_PARITY';
        }

        switch (type) {
            case 'size':
                return 'POSITION_SIZE';
            case 'parity':
            case 'odd':
            case 'even':
                return 'POSITION_PARITY';
            case 'number':
                return 'POSITION';
            default:
                return 'POSITION';
        }
    } else {
        // Sum-based bets (no position, position is 'sum', or position is 'SUM')
        // Check selection first to determine actual bet type
        if (selection === 'odd' || selection === 'even') {
            return 'SUM_PARITY';
        }

        switch (type) {
            case 'size':
                return 'SUM_SIZE';
            case 'parity':
            case 'odd':
            case 'even':
                return 'SUM_PARITY';
            case 'sum':
                return 'SUM';
            default:
                return 'SUM_SIZE';
        }
    }
};

/**
 * NEW: Transform client bet value to server format
 */
const mapClientBetValue = (clientSelection, clientType, betData = {}) => {
    // Handle different client formats - convert to string first
    const selection = String(clientSelection || '').toLowerCase();
    const type = String(clientType || '').toLowerCase();

    // Color mapping
    if (type === 'color') {
        const colorMapping = {
            'green': 'green',
            'red': 'red',
            'violet': 'violet',
            'purple': 'violet'
        };
        return colorMapping[selection] || 'green';
    }

    // Parity mapping - Handle both position-based and sum-based
    // Check for parity first, even if type is "size" but selection is "odd"/"even"
    if (type === 'parity' || type === 'odd' || type === 'even' ||
        (type === 'size' && (selection === 'odd' || selection === 'even'))) {
        const parityMapping = {
            'odd': 'odd',
            'even': 'even'
        };

        // Check if this is a position-based bet
        if (betData.position && betData.position !== 'sum' && betData.position !== 'SUM') {
            // Position-based: A_odd, B_even, etc.
            return `${betData.position.toUpperCase()}_${parityMapping[selection] || 'odd'}`;
        } else {
            // Sum-based: SUM_odd, SUM_even
            return `SUM_${parityMapping[selection] || 'odd'}`;
        }
    }

    // Size mapping - Handle both position-based and sum-based
    if (type === 'size') {
        const sizeMapping = {
            'big': 'big',
            'small': 'small'
        };

        // Check if this is a position-based bet
        if (betData.position && betData.position !== 'sum' && betData.position !== 'SUM') {
            // Position-based: A_small, B_big, etc.
            return `${betData.position.toUpperCase()}_${sizeMapping[selection] || 'small'}`;
        } else {
            // Sum-based: SUM_small, SUM_big
            return `SUM_${sizeMapping[selection] || 'small'}`;
        }
    }



    // Number mapping - Handle both position-based and sum-based
    if (type === 'number') {
        // Check if this is a position-based bet
        if (betData.position && betData.position !== 'sum') {
            // Position-based: A_5, B_3, etc.
            return `${betData.position.toUpperCase()}_${clientSelection}`;
        } else {
            // Sum-based: just the number
            return String(clientSelection);
        }
    }

    // Sum mapping (for k3 game)
    if (type === 'sum') {
        return String(clientSelection);
    }

    // Default fallback
    return String(clientSelection);
};

/**
 * NEW: Calculate odds based on bet type
 */
const calculateOddsForBet = (clientType, clientSelection, betData = {}) => {
    const type = String(clientType || '').toLowerCase();
    const selection = String(clientSelection || '').toLowerCase();

    switch (type) {
        case 'number':
            return 9.0; // 1:9 odds for specific number

        case 'color':
            if (selection === 'violet' || selection === 'purple') {
                return 4.5; // Violet odds
            }
            return 2.0; // Red/Green odds

        case 'size':
            // Check if this is a position-based bet
            if (betData.position && betData.position !== 'sum') {
                return 2.0; // Position-based size odds
            } else {
                return 1.98; // Sum-based size odds
            }

        case 'parity':
        case 'odd':
        case 'even':
            // Check if this is a position-based bet
            if (betData.position && betData.position !== 'sum') {
                return 2.0; // Position-based parity odds
            } else {
                return 1.98; // Sum-based parity odds
            }

        case 'sum':
            return 9.0; // 1:9 odds for sum bets (k3 game)

        default:
            // Check if selection indicates parity bet
            if (selection === 'odd' || selection === 'even') {
                if (betData.position && betData.position !== 'sum') {
                    return 2.0; // Position-based parity odds
                } else {
                    return 1.98; // Sum-based parity odds
                }
            }
            return 2.0; // Default odds
    }
};

/**
 * NEW: Transform client bet type to server format
 */
const getTotalBetsForPeriod = async (gameType, duration, periodId, timeline = 'default') => {
    try {
        const betHashKey = `bets:${gameType}:${duration}:${timeline}:${periodId}`;
        const betsData = await getRedisHelper().hgetall(betHashKey);

        let totalAmount = 0;
        let totalGross = 0;
        let totalFees = 0;
        let betCount = 0;
        const userBets = new Map();

        for (const [betId, betJson] of Object.entries(betsData)) {
            const bet = JSON.parse(betJson);
            totalAmount += parseFloat(bet.netBetAmount || 0);
            totalGross += parseFloat(bet.grossBetAmount || bet.netBetAmount || 0);
            totalFees += parseFloat(bet.platformFee || 0);
            betCount++;

            // Track unique users
            if (!userBets.has(bet.userId)) {
                userBets.set(bet.userId, 0);
            }
            userBets.set(bet.userId, userBets.get(bet.userId) + 1);
        }

        return {
            totalAmount: totalAmount.toFixed(2),
            totalGross: totalGross.toFixed(2),
            totalFees: totalFees.toFixed(2),
            betCount,
            uniqueUsers: userBets.size,
            timeline
        };
    } catch (error) {
        console.error('Error getting total bets:', error);
        return {
            totalAmount: '0',
            totalGross: '0',
            totalFees: '0',
            betCount: 0,
            uniqueUsers: 0,
            timeline
        };
    }
};

/**
 * NEW: Validate bet timing and balance
 */
const validateBetPlacement = async (userId, gameType, duration, periodId, betAmount, timeline = 'default') => {
    try {
        // Check if user exists
        const models = await ensureModelsInitialized();
        const user = await models.User.findByPk(userId);

        if (!user) {
            return { valid: false, error: 'User not found' };
        }

        // Check wallet balance
        const walletBalance = parseFloat(user.wallet_balance);
        const betAmountFloat = parseFloat(betAmount);

        if (walletBalance < betAmountFloat) {
            return { valid: false, error: 'Insufficient balance' };
        }

        // Check minimum and maximum bet amounts
        const minBet = getMinBetAmount(gameType);
        const maxBet = getMaxBetAmount(gameType);

        if (betAmountFloat < minBet) {
            return { valid: false, error: `Minimum bet amount is ${minBet}` };
        }

        if (betAmountFloat > maxBet) {
            return { valid: false, error: `Maximum bet amount is ${maxBet}` };
        }

        // Check if user has already placed maximum bets using new hash structure
        const betHashKey = `bets:${gameType}:${duration}:${timeline}:${periodId}`;
        const allBets = await getRedisHelper().hgetall(betHashKey);

        let userBetCount = 0;
        let userTotalAmount = 0;

        for (const [betId, betJson] of Object.entries(allBets)) {
            const bet = JSON.parse(betJson);
            if (bet.userId === userId) {
                userBetCount++;
                userTotalAmount += parseFloat(bet.grossBetAmount || bet.netBetAmount);
            }
        }

        const maxBetsPerUser = getMaxBetsPerUser(gameType);
        if (userBetCount >= maxBetsPerUser) {
            return {
                valid: false,
                error: `Maximum ${maxBetsPerUser} bets allowed per period`
            };
        }

        // Check maximum total bet amount per user per period
        const maxTotalPerPeriod = getMaxTotalBetPerPeriod(gameType);
        if (userTotalAmount + betAmountFloat > maxTotalPerPeriod) {
            return {
                valid: false,
                error: `Maximum total bet amount per period is ${maxTotalPerPeriod}`
            };
        }

        return { valid: true };

    } catch (error) {
        console.error('Error validating bet placement:', error);
        return { valid: false, error: 'Validation error' };
    }
};

/**
 * FIXED: Initialize WebSocket server with duration-based rooms only + BET FUNCTIONALITY
 */
const initializeWebSocket = async (server) => {
    try {
        console.log('🔄 Initializing WebSocket server for MULTI-INSTANCE setup...');

        // Initialize models
        await ensureModelsInitialized();
        models = await initializeWebSocketModels();

        io = new Server(server, {
            cors: {
                origin: [
                    process.env.FRONTEND_URL || "*",
                    "http://localhost:3000",
                    "http://localhost:3001"
                ],
                methods: ["GET", "POST"],
                credentials: true,
                allowedHeaders: ['Content-Type', 'Authorization', "X-Auth-Token"]
            },
            pingTimeout: 60000,
            pingInterval: 25000,
            transports: ['websocket', 'polling']
        });

        // Admin exposure monitoring
        try {
            const adminExposureService = require('./adminExposureService');
            adminExposureService.startExposureMonitoring(io);
            console.log('✅ [WEBSOCKET] Admin exposure monitoring initialized');
        } catch (adminError) {
            console.warn('⚠️ [WEBSOCKET] Admin exposure monitoring setup failed:', adminError.message);
        }

        // Authentication middleware
        io.use(async (socket, next) => {
            try {
                const { authenticateWebSocket } = require('../middleware/websocketAuth');
                await authenticateWebSocket(socket, next);
            } catch (authError) {
                console.error('❌ Auth middleware error:', authError);
                next(new Error(`AUTH_ERROR: ${authError.message}`));
            }
        });

        // Add this to your initializeWebSocket function, AFTER the connection handling:

        // Connection handling
        io.on('connection', (socket) => {
            console.log('🔗 New WebSocket connection:', socket.id, 'User:', socket.user?.userId || socket.user?.id || 'unknown');

            // Add connection health monitoring
            socket.on('ping', (data) => {
                socket.emit('pong', {
                    timestamp: new Date().toISOString(),
                    serverTime: Date.now(),
                    connectionId: socket.id
                });
            });

            // Add error handling for connection issues
            socket.on('error', (error) => {
                console.error('❌ [SOCKET_ERROR] Socket error:', socket.id, error);
            });

            socket.on('disconnect', (reason) => {
                ////console.log('🔌 [SOCKET_DISCONNECT] Socket disconnected:', socket.id, 'Reason:', reason);
            });

            socket.emit('connected', {
                message: 'Connected to DueWin game server (Multi-Instance)',
                timestamp: new Date().toISOString(),
                mode: 'MULTI_INSTANCE_SETUP',
                supportedGames: Object.keys(GAME_CONFIGS),
                bettingEnabled: true,
                connectionId: socket.id
            });

            // 🔥 CRITICAL: ADD ALL YOUR MISSING SOCKET HANDLERS HERE

            // EXISTING: Handle join game with duration-based validation only
            socket.on('joinGame', async (data) => {
                try {
                    const { gameType, duration } = data;

                    ////console.log(`🎮 [JOIN_GAME] Join game request: ${gameType} ${duration}s from user ${socket.user.userId}`);

                    // FIXED: Validation - no timeline, only duration
                    if (!GAME_CONFIGS[gameType] || !GAME_CONFIGS[gameType].includes(duration)) {
                        ////console.log(`❌ [JOIN_GAME] Invalid game: ${gameType} ${duration}s`);
                        socket.emit('error', {
                            message: `Invalid game: ${gameType} ${duration}s`,
                            code: 'INVALID_GAME_DURATION',
                            availableOptions: GAME_CONFIGS[gameType] || []
                        });
                        return;
                    }

                    // FIXED: Create room ID with duration only
                    const roomId = `${gameType}_${duration}`;

                    // Leave previous rooms
                    if (socket.currentGame) {
                        const oldRoomId = `${socket.currentGame.gameType}_${socket.currentGame.duration}`;
                        socket.leave(oldRoomId);
                        ////console.log(`👋 [JOIN_GAME] User left previous room: ${oldRoomId}`);
                    }

                    // Join new duration-based room
                    socket.join(roomId);
                    socket.currentGame = { gameType, duration, roomId };

                    // CRITICAL: Log room join for debugging
                    const room = io.sockets.adapter.rooms.get(roomId);
                    const clientCount = room ? room.size : 0;
                    ////console.log(`🎮 [JOIN_GAME] Client ${socket.id} joined ${roomId}`);
                    ////console.log(`👥 [JOIN_GAME] Room ${roomId} now has ${clientCount} clients`);

                    // Record game move in transaction
                    try {
                        const user = await models.User.findByPk(socket.user.userId);
                        if (user) {
                            await models.Transaction.create({
                                user_id: socket.user.userId,
                                reference_id: `GAME_MOVE_IN_${Date.now()}_${socket.user.userId}`,
                                type: 'transfer_in',
                                amount: 0,
                                status: 'completed',
                                description: `User entered ${gameType} ${duration}s room`,
                                metadata: {
                                    game_type: gameType,
                                    room_duration: duration,
                                    room_id: roomId,
                                    wallet_balance: user.wallet_balance,
                                    action: 'enter'
                                }
                            });
                        }
                    } catch (txError) {
                        console.error('Failed to record game move in transaction:', txError);
                    }

                    // Emit join confirmation
                    socket.emit('joinedGame', {
                        gameType,
                        duration,
                        roomId,
                        message: `Joined ${gameType} ${duration}s room`,
                        timestamp: new Date().toISOString(),
                        bettingEnabled: true,
                        clientCount // Add for debugging
                    });

                    // CRITICAL: Send current period info immediately after joining
                    ////console.log(`📤 [JOIN_GAME] Sending current period info for ${gameType} ${duration}s`);
                    await sendCurrentPeriodFromRedisEnhanced(socket, gameType, duration);

                    ////console.log(`✅ [JOIN_GAME] User ${socket.user.userId} successfully joined ${roomId} (${clientCount} total clients)`);

                } catch (error) {
                    console.error('❌ [JOIN_GAME] Error joining game:', error);
                    socket.emit('error', { message: 'Failed to join game' });
                }
            });

            // EXISTING: Handle leave game with duration-based rooms
            socket.on('leaveGame', async (data) => {
                try {
                    const { gameType, duration } = data;
                    const roomId = `${gameType}_${duration}`;

                    socket.leave(roomId);

                    // Record game move out transaction
                    try {
                        const user = await models.User.findByPk(socket.user.userId);
                        if (user) {
                            await models.Transaction.create({
                                user_id: socket.user.userId,
                                reference_id: `GAME_MOVE_OUT_${Date.now()}_${socket.user.userId}`,
                                type: 'transfer_out',
                                amount: 0,
                                status: 'completed',
                                description: `User left ${gameType} ${duration}s room`,
                                metadata: {
                                    game_type: gameType,
                                    room_duration: duration,
                                    room_id: roomId,
                                    wallet_balance: user.wallet_balance,
                                    action: 'exit'
                                }
                            });
                        }
                    } catch (txError) {
                        console.error('Failed to record game move out transaction:', txError);
                    }

                    socket.currentGame = null;
                    socket.emit('leftGame', { gameType, duration, roomId });

                    ////console.log(`👋 [LEAVE_GAME] User left room: ${roomId}`);
                } catch (error) {
                    console.error('❌ [LEAVE_GAME] Error leaving game:', error);
                }
            });

            // NEW: Handle bet placement with comprehensive validation + DEBUG MODE
            socket.on('placeBet', async (betData) => {
                let transformedBetData; // Ensure this is always defined
                try {
                    const userId = socket.user.userId || socket.user.id;
                    const timestamp = new Date().toISOString();

                    ////console.log(`\n🎯 [WEBSOCKET_BET_START] ==========================================`);
                    ////console.log(`🎯 [WEBSOCKET_BET_START] User ${userId} placing bet at ${timestamp}`);
                    ////console.log(`🎯 [WEBSOCKET_BET_START] Socket ID: ${socket.id}`);
                    ////console.log(`🎯 [WEBSOCKET_BET_START] Raw bet received:`, JSON.stringify(betData, null, 2));

                    // Transform client data format to expected format
                    if (betData.gameType === 'fiveD' || betData.gameType === '5d') {
                        // 5D Room mapping
                        const fiveDMapping = mapFiveDBet(betData);
                        transformedBetData = {
                            gameType: betData.gameType,
                            duration: betData.duration,
                            periodId: betData.periodId,
                            timeline: betData.timeline || 'default',
                            userId,
                            betAmount: betData.amount || betData.betAmount,
                            betType: fiveDMapping.betType,
                            betValue: fiveDMapping.betValue,
                            odds: fiveDMapping.odds
                        };
                    } else if (betData.gameType === 'wingo' || betData.gameType === 'trx_wix') {
                        // WINGO/TRX_WIX Room mapping
                        const wingoMapping = mapWingoBet(betData);
                        transformedBetData = {
                            gameType: betData.gameType,
                            duration: betData.duration,
                            periodId: betData.periodId,
                            timeline: betData.timeline || 'default',
                            userId,
                            betAmount: betData.amount || betData.betAmount,
                            betType: wingoMapping.betType,
                            betValue: wingoMapping.betValue,
                            odds: wingoMapping.odds
                        };
                    } else if (betData.gameType === 'k3') {
                        // K3 Room mapping
                        const k3Mapping = mapK3Bet(betData);
                        transformedBetData = {
                            gameType: betData.gameType,
                            duration: betData.duration,
                            periodId: betData.periodId,
                            timeline: betData.timeline || 'default',
                            userId,
                            betAmount: betData.amount || betData.betAmount,
                            betType: k3Mapping.betType,
                            betValue: k3Mapping.betValue,
                            odds: k3Mapping.odds
                        };
                    } else {
                        // Use legacy mapping for other games
                        transformedBetData = {
                            gameType: betData.gameType,
                            duration: betData.duration,
                            periodId: betData.periodId,
                            timeline: betData.timeline || 'default',
                            userId,
                            betAmount: betData.amount || betData.betAmount,
                            betType: mapClientBetType(betData.type, betData),
                            betValue: mapClientBetValue(betData.selection, betData.type, betData),
                            odds: calculateOddsForBet(betData.type, betData.selection, betData)
                        };
                    }

                    ////console.log(`🔄 [WEBSOCKET_BET_TRANSFORM] Transformed bet data:`, JSON.stringify(transformedBetData, null, 2));

                    // Validate bet placement first
                    const validation = await validateBetPlacement(userId, transformedBetData.gameType, transformedBetData.duration, transformedBetData.periodId, transformedBetData.betAmount, transformedBetData.timeline);

                    if (!validation.valid) {
                        ////console.log(`❌ [WEBSOCKET_BET_VALIDATION_FAILED] Validation failed for user ${userId}:`, validation.error);
                        socket.emit('betError', {
                            message: validation.error,
                            timestamp: timestamp
                        });
                        return;
                    }

                    ////console.log(`✅ [WEBSOCKET_BET_VALIDATION_SUCCESS] Validation passed for user ${userId}`);

                    // Process bet using WebSocket-specific processing
                    ////console.log('[DEBUG] About to call processWebSocketBet with:', transformedBetData, 'Type:', typeof transformedBetData);
                    const result = await processWebSocketBet(socket, transformedBetData);
                    ////console.log('[DEBUG] processWebSocketBet result:', result, 'Type:', typeof result);
                    if (result && result.success) {
                        ////console.log(`✅ [WEBSOCKET_BET_SUCCESS] Bet processed successfully for user ${userId}`);

                        // Store user as having placed bet in this period for result notifications
                        const periodKey = `${betData.gameType}_${betData.duration}_${betData.periodId}`;
                        if (!socket.activeBets) {
                            socket.activeBets = new Set();
                        }
                        socket.activeBets.add(periodKey);

                        // Broadcast general bet activity to room
                        const roomId = `${betData.gameType}_${betData.duration}`;
                        const totalBets = await getTotalBetsForPeriod(
                            betData.gameType,
                            betData.duration,
                            betData.periodId,
                            betData.timeline || 'default'
                        );

                        socket.to(roomId).emit('betActivity', {
                            periodId: betData.periodId,
                            totalBets: totalBets,
                            gameType: betData.gameType,
                            duration: betData.duration,
                            timestamp: timestamp
                        });

                        ////console.log(`✅ [WEBSOCKET_BET_COMPLETE] Bet flow completed successfully for user ${userId}`);

                    } else {
                        ////console.log('[DEBUG] processWebSocketBet result was not successful or undefined:', result);
                        const errorMessage = result && result.message ? result.message : 'Failed to process bet';
                        ////console.log(`❌ [WEBSOCKET_BET_PROCESSING_FAILED] Bet processing failed for user ${userId}:`, errorMessage);
                        socket.emit('betError', {
                            message: errorMessage,
                            timestamp: timestamp
                        });
                    }

                } catch (error) {
                    ////console.log('[DEBUG] Error in placeBet handler:', error.message);
                    ////console.log('[DEBUG] Error stack:', error.stack);
                    socket.emit('betError', {
                        message: 'Failed to process bet due to server error',
                        code: 'PROCESSING_ERROR',
                        timestamp: new Date().toISOString()
                    });
                }
            });

            // NEW: Get user's current balance
            socket.on('getBalance', async () => {
                try {
                    const userId = socket.user.userId || socket.user.id;
                    const balance = await getUserGameBalance(userId);
                    socket.emit('balanceUpdate', {
                        ...balance,
                        timestamp: new Date().toISOString()
                    });
                } catch (error) {
                    console.error('❌ Error getting user balance:', error);
                    socket.emit('error', {
                        message: 'Failed to get balance',
                        code: 'BALANCE_ERROR'
                    });
                }
            });

            // NEW: Get user's bets for current period
            socket.on('getMyBets', async (data) => {
                try {
                    const userId = socket.user.userId || socket.user.id;
                    const { gameType, duration, periodId } = data;

                    const history = await getUserBetHistory(userId, gameType, duration, {
                        periodId,
                        limit: 50
                    });

                    socket.emit('myBets', {
                        ...history,
                        gameType,
                        duration,
                        periodId,
                        timestamp: new Date().toISOString()
                    });
                } catch (error) {
                    console.error('❌ Error getting user bet history:', error);
                    socket.emit('error', {
                        message: 'Failed to get bet history',
                        code: 'BET_HISTORY_ERROR'
                    });
                }
            });

            // NEW: Get period statistics
            socket.on('getPeriodStats', async (data) => {
                try {
                    const { gameType, duration, periodId } = data;
                    const stats = await getEnhancedPeriodStatus(gameType, duration, periodId);
                    socket.emit('periodStats', {
                        ...stats,
                        timestamp: new Date().toISOString()
                    });
                } catch (error) {
                    console.error('❌ Error getting period statistics:', error);
                    socket.emit('error', {
                        message: 'Failed to get period stats',
                        code: 'PERIOD_STATS_ERROR'
                    });
                }
            });

            // NEW: Get current period info and timing
            socket.on('getPeriodInfo', async (data) => {
                try {
                    const { gameType, duration } = data;

                    if (!GAME_CONFIGS[gameType] || !GAME_CONFIGS[gameType].includes(duration)) {
                        socket.emit('error', {
                            message: `Invalid game: ${gameType} ${duration}s`,
                            code: 'INVALID_GAME_DURATION'
                        });
                        return;
                    }

                    const periodInfo = await getPeriodInfoFromRedis(gameType, duration);

                    if (!periodInfo) {
                        socket.emit('periodInfoResponse', {
                            success: false,
                            message: 'No active period found',
                            gameType,
                            duration
                        });
                        return;
                    }

                    // Calculate time remaining
                    let timeRemaining;
                    try {
                        const actualEndTime = calculatePeriodEndTime(periodInfo.periodId, duration);
                        timeRemaining = Math.max(0, Math.ceil((actualEndTime - new Date()) / 1000));
                    } catch (timeError) {
                        const redisEndTime = new Date(periodInfo.endTime);
                        timeRemaining = Math.max(0, Math.ceil((redisEndTime - new Date()) / 1000));
                    }

                    const bettingOpen = timeRemaining > 5;

                    socket.emit('periodInfoResponse', {
                        success: true,
                        data: {
                            gameType,
                            duration,
                            periodId: periodInfo.periodId,
                            timeRemaining,
                            bettingOpen,
                            bettingCloseTime: timeRemaining <= 5,
                            endTime: periodInfo.endTime,
                            currentTime: new Date().toISOString(),
                            canBet: bettingOpen && socket.currentGame?.roomId === `${gameType}_${duration}`
                        },
                        timestamp: new Date().toISOString()
                    });

                } catch (error) {
                    console.error('❌ Error getting period info:', error);
                    socket.emit('error', {
                        message: 'Failed to get period info',
                        code: 'PERIOD_INFO_ERROR'
                    });
                }
            });

            // EXISTING: Ping handler
            socket.on('ping', () => {
                socket.emit('pong', {
                    timestamp: new Date().toISOString(),
                    gameTicksActive: gameTicksStarted,
                    currentGame: socket.currentGame,
                    bettingEnabled: true
                });
            });

            // EXISTING: Disconnect handler
            socket.on('disconnect', () => {
                ////console.log('🔌 WebSocket disconnected:', socket.id);

                // Clean up user's active bets tracking
                if (socket.activeBets) {
                    socket.activeBets.clear();
                }
            });
        });

        // Setup Redis subscriptions FIRST
        await setupRedisSubscriptions();

        // Then start broadcast ticks
        setTimeout(() => {
            startBroadcastTicks();
        }, 2000);

        ////console.log('✅ WebSocket server initialized for multi-instance setup');
        return io;

    } catch (error) {
        console.error('❌ Failed to initialize WebSocket server:', error);
        throw error;
    }
};

/**
 * EXISTING: Setup Redis subscriptions for game scheduler events
 */

/**
 * FIXED: Setup Redis subscriptions without creating new connections
 */
const setupRedisSubscriptions = async () => {
    try {
        ////console.log('🔄 [REDIS_PUBSUB] Setting up Redis subscriptions using unified Redis...');

        // Don't create a new Redis subscriber - just use the existing one
        if (redisSubscriber) {
            ////console.log('⚠️ [REDIS_PUBSUB] Redis subscriber already exists, skipping setup');
            return;
        }

        // Get the existing subscriber connection from unified Redis
        redisSubscriber = unifiedRedis.getConnection('subscriber');
        
        if (!redisSubscriber) {
            ////console.log('❌ [REDIS_PUBSUB] No unified Redis subscriber available, skipping Redis pub/sub setup');
            ////console.log('⚠️ [REDIS_PUBSUB] WebSocket will work without Redis subscriptions (using polling mode)');
            return;
        }

        ////console.log('✅ [REDIS_PUBSUB] Using existing unified Redis subscriber connection');

        // Check if the connection is already ready
        if (redisSubscriber.status !== 'ready') {
            ////console.log('⚠️ [REDIS_PUBSUB] Subscriber not ready, waiting...');
            
            // Wait for ready state with timeout
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Redis subscriber ready timeout'));
                }, 5000);

                if (redisSubscriber.status === 'ready') {
                    clearTimeout(timeout);
                    resolve();
                } else {
                    redisSubscriber.once('ready', () => {
                        clearTimeout(timeout);
                        resolve();
                    });
                }
            });
        }

        // Define channels to subscribe to
        const channels = [
            'game_scheduler:period_start',
            'game_scheduler:period_result',
            'game_scheduler:betting_closed',
            'game_scheduler:period_error',
            'scheduler:period_start',
            'scheduler:period_result',
            'scheduler:betting_closed',
            'period:start',
            'period:result',
            'period:betting_closed'
        ];

        ////console.log('🔔 [REDIS_PUBSUB] Subscribing to scheduler channels...');

        // Subscribe to channels sequentially to avoid overwhelming the connection
        let successfulSubscriptions = 0;
        
        for (const channel of channels) {
            try {
                // Check if already subscribed to avoid duplicate subscriptions
                const subscribedChannels = redisSubscriber.getBuiltinCommands ? [] : (redisSubscriber.subscribedChannels || []);
                
                if (!subscribedChannels.includes(channel)) {
                    await redisSubscriber.subscribe(channel);
                    successfulSubscriptions++;
                    ////console.log(`✅ [REDIS_PUBSUB] Subscribed to: ${channel}`);
                } else {
                    ////console.log(`⏭️ [REDIS_PUBSUB] Already subscribed to: ${channel}`);
                    successfulSubscriptions++;
                }
                
                // Small delay between subscriptions
                await new Promise(resolve => setTimeout(resolve, 50));
                
            } catch (subError) {
                console.error(`❌ [REDIS_PUBSUB] Failed to subscribe to ${channel}:`, subError.message);
                // Continue with other channels even if one fails
            }
        }

        // Only set up event handlers if we have successful subscriptions
        if (successfulSubscriptions > 0) {
            // Set up message handler only once
            if (!redisSubscriber.listenerCount('message')) {
                redisSubscriber.on('message', (channel, message) => {
                    try {
                        const data = JSON.parse(message);
                        
                        if (!data.gameType || !data.duration) {
                            console.error(`❌ [SCHEDULER_EVENT] Missing required fields in message from ${channel}`);
                            return;
                        }
                        
                        // Handle the game scheduler event
                        handleGameSchedulerEvent(channel, data);
                        
                    } catch (parseError) {
                        console.error(`❌ [SCHEDULER_EVENT] Error parsing message from ${channel}:`, parseError.message);
                    }
                });
            }

            // Set up subscription confirmation handler
            if (!redisSubscriber.listenerCount('subscribe')) {
                redisSubscriber.on('subscribe', (channel, count) => {
                    ////console.log(`✅ [REDIS_SUBSCRIPTION] Confirmed subscription to ${channel} (total: ${count})`);
                });
            }

            // Error handler - but don't let errors crash the app
            if (!redisSubscriber.listenerCount('error')) {
                redisSubscriber.on('error', (err) => {
                    console.error('❌ [REDIS_PUBSUB] Subscriber error:', err.message);
                    // Don't throw or reconnect - just log the error
                });
            }

            ////console.log(`✅ [REDIS_PUBSUB] Successfully subscribed to ${successfulSubscriptions}/${channels.length} channels`);
        } else {
            ////console.log('❌ [REDIS_PUBSUB] No successful subscriptions, Redis pub/sub disabled');
        }

        ////console.log('✅ [REDIS_PUBSUB] Redis subscriptions setup completed');

    } catch (error) {
        console.error('❌ [REDIS_PUBSUB] Error setting up Redis subscriptions:', error.message);
        ////console.log('⚠️ [REDIS_PUBSUB] Continuing without Redis subscriptions - WebSocket will use polling mode');
        
        // Don't throw the error - let the app continue without Redis subscriptions
        redisSubscriber = null;
    }
};
/**
 * CRITICAL: Add cleanup function
 */
const stopRedisSubscriptions = () => {
    try {
        if (global.strikeGameSubscriber) {
            global.strikeGameSubscriber.disconnect();
            ////console.log('🛑 [REDIS_PUBSUB] Strike Game subscriptions stopped');
        }
    } catch (error) {
        console.error('❌ [REDIS_PUBSUB] Error stopping subscriptions:', error);
    }
};

/**
 * CRITICAL FIX: Enhanced cleanup function
 */
const cleanupEventTracking = () => {
    const now = Date.now();
    const maxAge = 300000; // 5 minutes
    let cleaned = 0;
    
    // Clean processed events
    for (const [key, timestamp] of global.eventTracker.processedEvents.entries()) {
        if (now - timestamp > maxAge) {
            global.eventTracker.processedEvents.delete(key);
            cleaned++;
        }
    }
    
    // Clean period updates
    for (const [key, value] of global.eventTracker.lastPeriodUpdates.entries()) {
        // Keep only recent period tracking
        if (typeof value === 'string' && value.length === 17) {
            const periodDate = value.substring(0, 8);
            const today = new Date().toISOString().substring(0, 10).replace(/-/g, '');
            if (periodDate < today) {
                global.eventTracker.lastPeriodUpdates.delete(key);
                cleaned++;
            }
        }
    }
    
    if (cleaned > 0) {
        ////console.log(`🧹 [CLEANUP] Cleaned ${cleaned} tracking entries`);
    }
    
    // Log current tracking stats
    ////console.log(`📊 [TRACKING_STATS] Events: ${global.eventTracker.processedEvents.size}, Periods: ${global.eventTracker.lastPeriodUpdates.size}`);
};

// Run cleanup every 2 minutes
setInterval(cleanupEventTracking, 120000);


/**
 * Enhanced system health monitoring
 */
const monitorWebSocketHealth = () => {
    const health = {
        timestamp: new Date().toISOString(),
        websocket: !!io,
        connectedClients: io ? io.sockets.sockets.size : 0,
        activeBroadcasts: gameIntervals ? gameIntervals.size : 0,
        trackedEvents: global.eventTracker.processedEvents.size,
        trackedPeriods: global.eventTracker.lastPeriodUpdates.size
    };
    
    // Log every 5 minutes
    if (!global.lastHealthReport || Date.now() - global.lastHealthReport > 300000) {
        ////console.log(`💓 [WEBSOCKET_HEALTH]`, health);
        global.lastHealthReport = Date.now();
    }
    
    return health;
};

setInterval(monitorWebSocketHealth, 60000);

/**
 * CRITICAL FIX: Debounced period request to prevent spam
 */
const requestPeriodFromSchedulerDebounced = async (gameType, duration) => {
    const key = `request_${gameType}_${duration}`;
    const now = Date.now();
    
    // Check last request time
    const lastRequest = global.eventTracker.processedEvents.get(key);
    if (lastRequest && now - lastRequest < 3000) { // 3 second debounce
        ////console.log(`⏭️ [REQUEST_DEBOUNCE] Skipping ${key}, last request ${now - lastRequest}ms ago`);
        return;
    }
    
    global.eventTracker.processedEvents.set(key, now);
    
    try {
        const requestData = {
            action: 'request_period',
            gameType,
            duration,
            timestamp: new Date().toISOString(),
            source: 'websocket_debounced'
        };

        await getPublisherRedis().publish('scheduler:period_request', JSON.stringify(requestData));
        ////console.log(`📤 [PERIOD_REQUEST] Sent for ${gameType}_${duration}`);
        
        // Auto-cleanup
        setTimeout(() => {
            global.eventTracker.processedEvents.delete(key);
        }, 10000);
        
    } catch (error) {
        console.error(`❌ [PERIOD_REQUEST_ERROR] ${gameType}_${duration}:`, error.message);
        global.eventTracker.processedEvents.delete(key);
    }
};


/**
 * FIXED: Enhanced game scheduler event handler with proper channel mapping
 */
// Track processed events to prevent duplicates
const processedEvents = new Set();

/**
 * FIXED: Enhanced game scheduler event handler with better deduplication
 */
// Enhanced global tracking with better structure
if (!global.eventSequencer) {
    global.eventSequencer = {
        processedEvents: new Map(),
        periodStates: new Map(),
        sequenceLocks: new Map()
    };
}

/**
 * CRITICAL FIX: Enhanced handleGameSchedulerEvent with better deduplication
 */
const handleGameSchedulerEvent = (channel, data) => {
    try {
        const { gameType, duration, periodId } = data;
        const eventType = channel.split(':').pop();
        
        // CRITICAL FIX: Create a more unique deduplication key including timestamp
        const timestamp = data.timestamp || new Date().toISOString();
        const dedupeKey = `${eventType}_${gameType}_${duration}_${periodId}_${timestamp}`;
        
        // Check for exact duplicates
        if (global.eventSequencer.processedEvents.has(dedupeKey)) {
            ////console.log(`⏭️ [EXACT_DUPLICATE] Blocked: ${dedupeKey}`);
            return;
        }
        
        // CRITICAL FIX: Also check for logical duplicates (same event type and period, different timestamp)
        const logicalKey = `${eventType}_${gameType}_${duration}_${periodId}`;
        const lastProcessed = global.eventSequencer.processedEvents.get(logicalKey);
        
        if (lastProcessed && Date.now() - lastProcessed < 5000) { // 5 second window
            ////console.log(`⏭️ [LOGICAL_DUPLICATE] Blocked: ${logicalKey} (last processed ${Date.now() - lastProcessed}ms ago)`);
            return;
        }
        
        // Mark both keys as processed
        global.eventSequencer.processedEvents.set(dedupeKey, Date.now());
        global.eventSequencer.processedEvents.set(logicalKey, Date.now());
        
        // Auto-cleanup with shorter expiry
        setTimeout(() => {
            global.eventSequencer.processedEvents.delete(dedupeKey);
            global.eventSequencer.processedEvents.delete(logicalKey);
        }, 30000);

        if (!io) {
            console.error(`❌ [NO_IO] Socket.io not available`);
            return;
        }

        const roomId = `${gameType}_${duration}`;
        const room = io.sockets.adapter.rooms.get(roomId);
        const clientCount = room ? room.size : 0;

        const normalizedType = eventType === 'start' ? 'period_start' : 
                              eventType === 'result' ? 'period_result' : 
                              eventType;
        
        ////console.log(`📢 [SCHEDULER_EVENT] Processing ${normalizedType} for ${roomId} (${clientCount} clients)`);
        
        switch (normalizedType) {
            case 'period_start':
                // CRITICAL FIX: Set a sequence lock to prevent WebSocket from sending updates immediately
                const sequenceLock = `sequence_${gameType}_${duration}_${periodId}`;
                global.eventSequencer.sequenceLocks.set(sequenceLock, Date.now());
                
                const periodStartData = {
                    gameType,
                    duration,
                    periodId,
                    timeRemaining: Math.min(data.timeRemaining || duration, duration),
                    endTime: data.endTime,
                    bettingOpen: (data.timeRemaining || duration) >= 5,
                    bettingCloseTime: (data.timeRemaining || duration) < 5,
                    roomId,
                    source: 'scheduler_start',
                    timestamp: timestamp
                };
                
                io.to(roomId).emit('periodStart', periodStartData);
                ////console.log(`✅ [PERIOD_START] Sent to ${clientCount} clients: ${periodId}`);
                
                // Update WebSocket tracking AFTER sending periodStart
                const trackingKey = `last_period_${gameType}_${duration}`;
                global.eventSequencer.periodStates.set(trackingKey, {
                    periodId,
                    startedAt: Date.now(),
                    source: 'scheduler'
                });
                
                // Release sequence lock after small delay to allow proper sequencing
                setTimeout(() => {
                    global.eventSequencer.sequenceLocks.delete(sequenceLock);
                }, 500); // 500ms delay
                break;
                
            case 'period_result':
                const periodResultData = {
                    gameType,
                    duration,
                    periodId,
                    result: data.result?.result || data.result,
                    winners: data.result?.winners || [],
                    winnerCount: data.result?.winnerCount || 0,
                    totalPayout: data.result?.totalPayout || 0,
                    verification: data.result?.verification,
                    timeRemaining: 0,
                    bettingOpen: false,
                    bettingCloseTime: true,
                    roomId,
                    source: 'scheduler_result',
                    timestamp: timestamp
                };
                
                io.to(roomId).emit('periodResult', periodResultData);
                ////console.log(`✅ [PERIOD_RESULT] Sent to ${clientCount} clients: ${periodId}`);
                
                // Mark period as ended
                const resultTrackingKey = `last_period_${gameType}_${duration}`;
                const currentState = global.eventSequencer.periodStates.get(resultTrackingKey);
                if (currentState && currentState.periodId === periodId) {
                    currentState.endedAt = Date.now();
                    currentState.hasResult = true;
                }
                break;
                
            case 'betting_closed':
                const bettingClosedData = {
                    gameType,
                    duration,
                    periodId,
                    timeRemaining: 5,
                    bettingOpen: false,
                    bettingCloseTime: true,
                    message: `Betting closed for ${gameType} ${duration}s`,
                    roomId,
                    source: 'scheduler_betting_closed',
                    timestamp: timestamp
                };
                
                io.to(roomId).emit('bettingClosed', bettingClosedData);
                ////console.log(`✅ [BETTING_CLOSED] Sent to ${clientCount} clients: ${periodId}`);
                break;
                
            default:
                ////console.log(`⚠️ [UNKNOWN_EVENT] ${normalizedType} from ${channel}`);
                break;
        }
        
    } catch (error) {
        console.error(`❌ [SCHEDULER_EVENT_ERROR] ${channel}:`, error.message);
    }
};


/**
 * Generate all possible 3-number combinations from given numbers
 * @param {Array} numbers - Array of numbers to generate combinations from
 * @returns {Array} Array of combination strings
 */
function generateAllDifferentCombinations(numbers) {
    const combinations = [];
    for (let i = 0; i < numbers.length - 2; i++) {
        for (let j = i + 1; j < numbers.length - 1; j++) {
            for (let k = j + 1; k < numbers.length; k++) {
                combinations.push(`${numbers[i]},${numbers[j]},${numbers[k]}`);
            }
        }
    }
    return combinations;
}

/**
 * Generate all combinations containing a specific number
 * @param {number} number - The number that must be included in combinations
 * @returns {Array} Array of combination strings
 */
function generateAllDifferentCombinationsWithNumber(number) {
    const combinations = [];
    for (let i = 1; i <= 6; i++) {
        for (let j = i + 1; j <= 6; j++) {
            if (i !== number && j !== number) {
                // Sort to ensure consistent order
                const combo = [number, i, j].sort((a, b) => a - b);
                combinations.push(combo.join(','));
            }
        }
    }
    return [...new Set(combinations)]; // Remove duplicates
}

/**
 * K3 ROOM: Dedicated mapping function for K3 game
 */
const mapK3Bet = (betData) => {
    const { type, selection, extra, position } = betData;
    const clientType = String(type || '').toLowerCase();
    const clientSelection = String(selection || '').toLowerCase();
    const clientExtra = String(extra || '').toLowerCase();

    ////console.log(`🎲 [K3_MAPPING] Mapping K3 bet:`, { type: clientType, selection: clientSelection, extra: clientExtra });

    // SUM bet - Handle both single and multiple values
    if (clientType === 'sum') {
        // Check if this is a multiple sum bet (comma-separated values)
        if (clientSelection.includes(',')) {
            ////console.log(`🎲 [K3_MAPPING] Multiple sum bet detected: ${clientSelection}`);
            return {
                betType: 'SUM_MULTIPLE',
                betValue: clientSelection,
                odds: 0  // Will be calculated per individual value
            };
        }
        // Single sum bet
        else if (!isNaN(clientSelection)) {
            ////console.log(`🎲 [K3_MAPPING] Single sum bet detected: ${clientSelection}`);
            return {
                betType: 'SUM',
                betValue: clientSelection,
                odds: 0  // Will be calculated by game logic
            };
        }
    }

    // SUM_SIZE: big/small
    if (clientType === 'sum_size' || clientType === 'size') {
        if (clientSelection === 'big' || clientSelection === 'small') {
            return { betType: 'SUM_SIZE', betValue: clientSelection, odds: 0 };
        }
    }

    // SUM_PARITY: odd/even
    if (clientType === 'sum_parity' || clientType === 'parity') {
        if (clientSelection === 'odd' || clientSelection === 'even') {
            return { betType: 'SUM_PARITY', betValue: clientSelection, odds: 0 };
        }
    }

    // ANY_TRIPLE: any triple
    if (clientType === 'triple' && clientSelection === 'any') {
        return { betType: 'ANY_TRIPLE', betValue: null, odds: 0 };
    }

    // SPECIFIC_TRIPLE: specific triple (e.g., triple: 4)
    if (clientType === 'triple' && !isNaN(clientSelection)) {
        return { betType: 'SPECIFIC_TRIPLE', betValue: clientSelection, odds: 0 };
    }

    // ANY_PAIR: any pair
    if (clientType === 'pair' && clientSelection === 'any') {
        return { betType: 'MATCHING_DICE', betValue: 'pair_any', odds: 0 };
    }

    // SPECIFIC_PAIR: specific pair (e.g., pair: 2)
    if (clientType === 'pair' && !isNaN(clientSelection) && !clientExtra) {
        return { betType: 'SPECIFIC_PAIR', betValue: clientSelection, odds: 0 };
    }

    // PAIR_COMBINATION: specific pair with specific single (e.g., pair: 2, extra: 5)
    if (clientType === 'pair' && !isNaN(clientSelection) && !isNaN(clientExtra)) {
        return { betType: 'PAIR_COMBINATION', betValue: [clientSelection, clientExtra], odds: 0 };
    }

    // STRAIGHT: straight sequence (including "3 Continuous")
    if (clientType === 'straight' || (clientType === 'different' && clientSelection && (clientSelection.includes('continuous') || clientSelection.includes('straight')))) {
        return { betType: 'STRAIGHT', betValue: null, odds: 0 };
    }

    // DIFFERENT: Handle both "2 different" and "all different" bets
    if (clientType === 'all_different' || clientType === 'different') {
        if (clientSelection && clientSelection !== '') {
            // Check if this is a multiple number selection (e.g., "1,2,3,4,5,6")
            if (clientSelection.includes(',')) {
                const numbers = clientSelection.split(',').map(n => parseInt(n.trim()));
                
                // If more than 3 numbers, it's a "all possible combinations" bet
                if (numbers.length > 3) {
                    ////console.log(`🎲 [K3_MAPPING] Multiple number selection detected: ${clientSelection} - will generate all combinations`);
                    return {
                        betType: 'ALL_DIFFERENT_MULTIPLE',
                        betValue: clientSelection, // Keep original selection for display
                        odds: 0  // Will be calculated by game logic
                    };
                } else if (numbers.length === 3) {
                    // Three numbers = "all different" bet (e.g., "1,2,3")
                    ////console.log(`🎲 [K3_MAPPING] All different bet detected: ${clientSelection}`);
                    return {
                        betType: 'ALL_DIFFERENT',
                        betValue: clientSelection,
                        odds: 0
                    };
                } else if (numbers.length === 2) {
                    // Two numbers = "2 different" bet (e.g., "1,2")
                    ////console.log(`🎲 [K3_MAPPING] 2 different bet detected: ${clientSelection}`);
                    return {
                        betType: 'TWO_DIFFERENT',
                        betValue: clientSelection,
                        odds: 0
                    };
                }
            }
            // Check if betValue contains pipe-separated 2-number combinations (e.g., "1,2|1,3|1,4|...")
            else if (betData.betValue && betData.betValue.includes('|')) {
                const combinations = betData.betValue.split('|');
                // Check if all combinations have exactly 2 numbers
                const allTwoNumbers = combinations.every(combo => {
                    const nums = combo.split(',').map(n => parseInt(n.trim()));
                    return nums.length === 2;
                });
                
                if (allTwoNumbers) {
                    ////console.log(`🎲 [K3_MAPPING] 2 different multiple bet detected: ${betData.betValue}`);
                    return {
                        betType: 'TWO_DIFFERENT_MULTIPLE',
                        betValue: betData.betValue,
                        odds: 0
                    };
                }
            }
            // Single number selection (e.g., "1" - bet on all combinations containing 1)
            else if (!isNaN(clientSelection)) {
                ////console.log(`🎲 [K3_MAPPING] Single number selection detected: ${clientSelection} - will generate all combinations containing this number`);
                return {
                    betType: 'ALL_DIFFERENT_MULTIPLE',
                    betValue: clientSelection,
                    odds: 0
                };
            }
        }
        // Generic "all different" bet (wins on any all-different result)
        ////console.log(`🎲 [K3_MAPPING] Generic all_different bet detected`);
        return { betType: 'ALL_DIFFERENT', betValue: null, odds: 0 };
    }

    // TWO_DIFFERENT: two specific different numbers
    if (clientType === 'two_different' && clientSelection && clientExtra) {
        return { betType: 'TWO_DIFFERENT', betValue: [clientSelection, clientExtra], odds: 0 };
    }

    // SINGLE_NUMBER: single number 1-6
    if (clientType === 'number' && !isNaN(clientSelection)) {
        return { betType: 'SINGLE_NUMBER', betValue: clientSelection, odds: 0 };
    }

    // Handle direct ANY_PAIR from frontend
    if (clientType === 'any_pair') {
        // Validate betValue if provided (should be null for ANY_PAIR)
        if (clientSelection && clientSelection !== '') {
            ////console.log(`⚠️ [K3_MAPPING] ANY_PAIR bet with unexpected selection: ${clientSelection}, ignoring selection`);
        }
        return { betType: 'MATCHING_DICE', betValue: 'pair_any', odds: 0 };
    }

    // Fallback: return as-is
    ////console.log(`⚠️ [K3_MAPPING] Unknown bet type: ${clientType}, returning as-is`);
    return { betType: clientType.toUpperCase(), betValue: clientSelection, odds: 0 };
};

// Export WebSocket service - DURATION-BASED ROOMS WITH BET PLACEMENT
module.exports = {
    initializeWebSocket,

    broadcastToGame: (gameType, duration, event, data) => {
        try {
            if (!io) return;

            const roomId = `${gameType}_${duration}`;

            if (event === 'timeUpdate' && data.timeRemaining !== undefined) {
                if (data.timeRemaining < 0 || data.timeRemaining > duration) {
                    console.warn(`⚠️ WebSocket: Invalid time remaining ${data.timeRemaining}s in external broadcast, skipping`);
                    return;
                }
                // Cap time remaining to duration to prevent showing values like 61s for 60s game
                data.timeRemaining = Math.min(data.timeRemaining, duration);
                data.bettingOpen = data.timeRemaining > 5;
                data.bettingCloseTime = data.timeRemaining <= 5;
            }

            io.to(roomId).emit(event, {
                ...data,
                gameType,
                duration,
                roomId,
                source: 'external_broadcast',
                validated: true
            });

            ////console.log(`📢 WebSocket: External broadcast ${event} to ${roomId}`);
        } catch (error) {
            console.error('❌ WebSocket: Error broadcasting to game:', error);
        }
    },

    broadcastToAll: (event, data) => {
        try {
            if (!io) return;
            io.emit(event, {
                ...data,
                source: 'external_broadcast',
                supportedGames: Object.keys(GAME_CONFIGS),
                totalRooms: Object.values(GAME_CONFIGS).reduce((sum, durations) => sum + durations.length, 0),
                validated: true,
                bettingEnabled: true
            });
        } catch (error) {
            console.error('❌ WebSocket: Error broadcasting to all:', error);
        }
    },

    // NEW: Broadcast bet results only to users who placed bets
    broadcastBetResults: (gameType, duration, periodId, periodResult, winningBets = []) => {
        try {
            if (!io) return;

            const roomId = `${gameType}_${duration}`;
            const periodKey = `${gameType}_${duration}_${periodId}`;
            const timestamp = new Date().toISOString();

            ////console.log(`\n🎯 [BET_RESULTS_START] ==========================================`);
            ////console.log(`🎯 [BET_RESULTS_START] Broadcasting results for ${periodKey} at ${timestamp}`);
            ////console.log(`🎯 [BET_RESULTS_START] Game: ${gameType} ${duration}s`);
            ////console.log(`🎯 [BET_RESULTS_START] Period: ${periodId}`);
            ////console.log(`🎯 [BET_RESULTS_START] Result:`, JSON.stringify(periodResult, null, 2));
            ////console.log(`🎯 [BET_RESULTS_START] Winning bets count: ${winningBets.length}`);
            ////console.log(`🎯 [BET_RESULTS_START] Winning bets details:`, JSON.stringify(winningBets, null, 2));

            // Get all sockets in the room
            const room = io.sockets.adapter.rooms.get(roomId);
            if (!room) {
                ////console.log(`⚠️ [BET_RESULTS] No room found: ${roomId}`);
                return;
            }

            ////console.log(`👥 [BET_RESULTS_ROOM] ==========================================`);
            ////console.log(`👥 [BET_RESULTS_ROOM] Room ${roomId} has ${room.size} connected users`);

            let notificationsSent = 0;
            let bettingUsersFound = 0;
            let watchingUsersFound = 0;

            // Iterate through all sockets in the room
            for (const socketId of room) {
                const socket = io.sockets.sockets.get(socketId);

                if (!socket || !socket.user) {
                    ////console.log(`👤 [BET_RESULTS] Socket ${socketId} has no user, skipping`);
                    continue;
                }

                const userId = socket.user.userId || socket.user.id;

                if (!socket.activeBets) {
                    ////console.log(`👁️ [BET_RESULTS] User ${userId} has no active bets, watching only`);
                    watchingUsersFound++;
                    continue;
                }

                // Check if this user placed a bet in this period
                if (!socket.activeBets.has(periodKey)) {
                    ////console.log(`👁️ [BET_RESULTS] User ${userId} was only watching period ${periodId}, no notification sent`);
                    watchingUsersFound++;
                    continue;
                }

                bettingUsersFound++;
                ////console.log(`🎯 [BET_RESULTS_USER] ==========================================`);
                ////console.log(`🎯 [BET_RESULTS_USER] Processing results for betting user: ${userId}`);
                ////console.log(`🎯 [BET_RESULTS_USER] Socket ID: ${socket.id}`);
                ////console.log(`🎯 [BET_RESULTS_USER] Active bets:`, Array.from(socket.activeBets));

                // Find if this user won
                const userWinnings = winningBets.filter(bet =>
                    bet.userId === userId || bet.userId === socket.user.id
                );

                const hasWon = userWinnings.length > 0;
                const totalWinnings = userWinnings.reduce((sum, bet) => sum + (bet.winnings || 0), 0);

                ////console.log(`💰 [BET_RESULTS_WINNINGS] ==========================================`);
                ////console.log(`💰 [BET_RESULTS_WINNINGS] User ${userId} win status: ${hasWon ? 'WON' : 'LOST'}`);
                ////console.log(`💰 [BET_RESULTS_WINNINGS] Winning bets found: ${userWinnings.length}`);
                ////console.log(`💰 [BET_RESULTS_WINNINGS] Total winnings: ₹${totalWinnings}`);
                ////console.log(`💰 [BET_RESULTS_WINNINGS] Winning bet details:`, JSON.stringify(userWinnings, null, 2));

                // Prepare personalized result data
                const personalizedResult = {
                    gameType,
                    duration,
                    periodId,
                    result: periodResult,
                    userResult: {
                        hasWon,
                        totalWinnings,
                        winningBets: userWinnings.map(bet => ({
                            betId: bet.betId,
                            betType: bet.betType,
                            betValue: bet.betValue,
                            betAmount: bet.betAmount,
                            winnings: bet.winnings,
                            profitLoss: bet.winnings - bet.betAmount,
                            odds: bet.odds
                        }))
                    },
                    timestamp: timestamp,
                    source: 'bet_result_notification'
                };

                ////console.log(`📤 [BET_RESULTS_SEND] ==========================================`);
                ////console.log(`📤 [BET_RESULTS_SEND] Sending personalized result to user ${userId}:`);
                ////console.log(`📤 [BET_RESULTS_SEND] Result data:`, JSON.stringify(personalizedResult, null, 2));

                // Send personalized result to this betting user
                socket.emit('betResult', personalizedResult);

                notificationsSent++;

                ////console.log(`${hasWon ? '🎉' : '😔'} [BET_RESULTS_SENT] ==========================================`);
                ////console.log(`${hasWon ? '🎉' : '😔'} [BET_RESULTS_SENT] Result sent to user ${userId}: ${hasWon ? `WON ₹${totalWinnings}` : 'LOST'}`);
                ////console.log(`${hasWon ? '🎉' : '😔'} [BET_RESULTS_SENT] Notification #${notificationsSent} sent successfully`);

                // Remove this period from user's active bets
                socket.activeBets.delete(periodKey);
                ////console.log(`🗑️ [BET_RESULTS_CLEANUP] Removed period ${periodKey} from user ${userId} active bets`);
            }

            ////console.log(`✅ [BET_RESULTS_COMPLETE] ==========================================`);
            ////console.log(`✅ [BET_RESULTS_COMPLETE] Results broadcast completed for ${periodKey}`);
            ////console.log(`✅ [BET_RESULTS_COMPLETE] Total users in room: ${room.size}`);
            ////console.log(`✅ [BET_RESULTS_COMPLETE] Betting users found: ${bettingUsersFound}`);
            ////console.log(`✅ [BET_RESULTS_COMPLETE] Watching users found: ${watchingUsersFound}`);
            ////console.log(`✅ [BET_RESULTS_COMPLETE] Notifications sent: ${notificationsSent}`);
            ////console.log(`✅ [BET_RESULTS_COMPLETE] Winning bets total: ${winningBets.length}`);

        } catch (error) {
            ////console.log(`💥 [BET_RESULTS_ERROR] ==========================================`);
            ////console.log(`💥 [BET_RESULTS_ERROR] Error broadcasting bet results for ${gameType}_${duration}_${periodId}:`);
            ////console.log(`💥 [BET_RESULTS_ERROR] Error:`, error.message);
            ////console.log(`💥 [BET_RESULTS_ERROR] Stack:`, error.stack);
            ////console.log(`💥 [BET_RESULTS_ERROR] Result data:`, JSON.stringify(periodResult, null, 2));
            ////console.log(`💥 [BET_RESULTS_ERROR] Winning bets:`, JSON.stringify(winningBets, null, 2));
        }
    },

    // NEW: Broadcast general period result to all users in room (non-betting users get this)
    broadcastPeriodResult: async (io, gameType, duration, periodId, result, timeline = 'default') => {
        try {
            const roomId = getRoomId(gameType, duration, timeline);

            // Get total statistics using new hash structure
            const stats = await getTotalBetsForPeriod(gameType, duration, periodId, timeline);

            // Broadcast general period result to entire room
            io.to(roomId).emit('periodResult', {
                gameType,
                duration,
                periodId,
                result: result,
                timeline,
                statistics: {
                    totalBets: stats.totalAmount,
                    totalGross: stats.totalGross,
                    platformFees: stats.totalFees,
                    betCount: stats.betCount,
                    uniqueUsers: stats.uniqueUsers
                },
                timestamp: new Date().toISOString(),
                source: 'period_result_general'
            });

            ////console.log(`📢 [PERIOD_RESULT] Broadcasted general result for ${gameType}_${duration}_${periodId} to all users in room`);

        } catch (error) {
            console.error('❌ Error broadcasting period result:', error);
        }
    },

    // NEW: Broadcast balance update to specific user
    broadcastBalanceUpdate: (userId, balanceData) => {
        try {
            if (!io) return;

            for (const [socketId, socket] of io.sockets.sockets) {
                if (socket.user && (socket.user.userId === userId || socket.user.id === userId)) {
                    socket.emit('balanceUpdate', {
                        ...balanceData,
                        timestamp: new Date().toISOString(),
                        source: 'external_balance_update'
                    });
                    break;
                }
            }
        } catch (error) {
            console.error('❌ WebSocket: Error broadcasting balance update:', error);
        }
    },

    // Status functions
    getSystemStats: () => ({
        connectedClients: io ? io.sockets.sockets.size : 0,
        activeBroadcastIntervals: gameIntervals.size,
        broadcastTicksStarted: gameTicksStarted,
        mode: 'DURATION_BASED_ROOMS_WITH_BETTING',
        supportedGames: Object.keys(GAME_CONFIGS),
        gameConfigs: GAME_CONFIGS,
        totalRooms: Object.values(GAME_CONFIGS).reduce((sum, durations) => sum + durations.length, 0),
        bettingEnabled: true,
        features: ['time_validation', 'balance_validation', 'room_validation', 'bet_placement']
    }),

    getIo: () => io,

    stopGameTicks: () => {
        gameIntervals.forEach((intervalId, key) => {
            clearInterval(intervalId);
            ////console.log(`⏹️ WebSocket: Stopped broadcast ticks for ${key}`);
        });
        gameIntervals.clear();
        gameTicksStarted = false;
        ////console.log('🛑 WebSocket: All broadcast ticks stopped');
    },

    // Debug functions
    verifyGameTicks: () => {
        ////console.log('🔍 Verifying DURATION-BASED broadcast system with BETTING...');

        const expectedIntervals = Object.values(GAME_CONFIGS).reduce((sum, durations) => sum + durations.length, 0);
        const activeIntervals = gameIntervals.size;

        ////console.log(`📊 WebSocket broadcast system status:`);
        ////console.log(`   - Active intervals: ${activeIntervals}`);
        ////console.log(`   - Expected intervals: ${expectedIntervals}`);
        ////console.log(`   - System started: ${gameTicksStarted}`);
        ////console.log(`   - Connected clients: ${io ? io.sockets.sockets.size : 0}`);
        ////console.log(`   - Betting enabled: ✅`);

        // Show detailed status
        Object.keys(GAME_CONFIGS).forEach(gameType => {
            ////console.log(`\n📋 ${gameType.toUpperCase()} rooms:`);
            GAME_CONFIGS[gameType].forEach(duration => {
                const key = `${gameType}_${duration}`;
                const hasInterval = gameIntervals.has(key);
                const roomId = `${gameType}_${duration}`;
                const clientCount = io ? (io.sockets.adapter.rooms.get(roomId)?.size || 0) : 0;
                ////console.log(`   - ${key}: ${hasInterval ? '✅ Active' : '❌ Inactive'} | ${clientCount} clients | Betting: ✅`);
            });
        });

        return {
            active: activeIntervals,
            expected: expectedIntervals,
            started: gameTicksStarted,
            working: activeIntervals === expectedIntervals && gameTicksStarted,
            connectedClients: io ? io.sockets.sockets.size : 0,
            bettingEnabled: true
        };
    },

    // Additional utility functions for debugging
    getCurrentPeriodInfo: async (gameType, duration) => {
        return await getPeriodInfoFromRedis(gameType, duration);
    },

    validatePeriodTiming: (periodId, duration) => {
        try {
            const endTime = calculatePeriodEndTime(periodId, duration);
            const timeRemaining = Math.max(0, (endTime - new Date()) / 1000);
            const bettingOpen = timeRemaining > 5;

            return {
                valid: timeRemaining >= 0 && timeRemaining <= duration,
                timeRemaining,
                endTime: endTime.toISOString(),
                bettingOpen,
                bettingCloseTime: timeRemaining <= 5
            };
        } catch (error) {
            return {
                valid: false,
                error: error.message,
                bettingOpen: false
            };
        }
    },

    // NEW: Get connected users in a specific room
    getRoomUsers: (gameType, duration) => {
        try {
            if (!io) return [];

            const roomId = `${gameType}_${duration}`;
            const room = io.sockets.adapter.rooms.get(roomId);

            if (!room) return [];

            const users = [];
            for (const socketId of room) {
                const socket = io.sockets.sockets.get(socketId);
                if (socket && socket.user) {
                    users.push({
                        userId: socket.user.userId || socket.user.id,
                        socketId: socket.id,
                        connectedAt: socket.connectedAt || null
                    });
                }
            }

            return users;
        } catch (error) {
            console.error('❌ Error getting room users:', error);
            return [];
        }
    },

    // NEW: Get system health with betting features
    getSystemHealth: async () => {
        try {
            const health = {
                websocket: {
                    status: io ? 'healthy' : 'unhealthy',
                    connectedClients: io ? io.sockets.sockets.size : 0
                },
                broadcasting: {
                    status: gameTicksStarted ? 'active' : 'inactive',
                    activeIntervals: gameIntervals.size,
                    expectedIntervals: Object.values(GAME_CONFIGS).reduce((sum, durations) => sum + durations.length, 0)
                },
                betting: {
                    status: 'enabled',
                    features: ['balance_validation', 'time_validation', 'room_validation'],
                    validationActive: true
                },
                redis: {
                    status: 'connected'
                }
            };

            // Test Redis connectivity
            try {
                await getRedisHelper().ping();
                health.redis.latency = 'low';
            } catch (redisError) {
                health.redis.status = 'error';
                health.redis.error = redisError.message;
            }

            return health;
        } catch (error) {
            return {
                status: 'error',
                error: error.message
            };
        }
    },

    GAME_CONFIGS,
    initializeWebSocket,

    // NEW: Utility functions
    validateBetPlacement,
    getTotalBetsForPeriod,

    // Additional utility functions
    getRoomId,
    calculatePeriodStartTime,
    initializeWebSocketModels,
    processWebSocketBet,
    requestPeriodFromScheduler,
    mapClientBetType,
    mapClientBetValue,
    calculateOddsForBet,
    setupRedisSubscriptions,
    createRedisSubscriber,
    handleGameSchedulerEvent,
    stopRedisSubscriptions,
    startBroadcastTicks,
    startBroadcastTicksForGame,
    broadcastTick,
    getPeriodInfoFromRedis,
    sendCurrentPeriodFromRedisEnhanced,
    testClientBroadcasting,
    logRoomStatus,
    requestPeriodFromSchedulerDebounced,
    cleanupEventTracking,
    monitorWebSocketHealth,
    cleanupEventSequencer,


};

