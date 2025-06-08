// Backend/services/websocketService.js - FIXED: Enhanced time validation and period management

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/constants');
const { redis, isConnected } = require('../config/redisConfig');
const { logger } = require('../utils/logger');
const moment = require('moment-timezone');

// Socket.io server instance
let io;

// Game tick intervals storage
const gameIntervals = new Map();
let gameTicksStarted = false;

// FIXED: No timeline multiplication - duration-based rooms only
const GAME_CONFIGS = {
    wingo: [30, 60, 180, 300],       // 4 rooms: wingo_30, wingo_60, wingo_180, wingo_300
    trx_wix: [30, 60, 180, 300],     // 4 rooms: trx_wix_30, trx_wix_60, trx_wix_180, trx_wix_300
    fiveD: [60, 180, 300, 600],      // 4 rooms: fiveD_60, fiveD_180, fiveD_300, fiveD_600
    k3: [60, 180, 300, 600]          // 4 rooms: k3_60, k3_180, k3_300, k3_600
};

// Total: 16 rooms (4 games × 4 durations each)

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

/**
 * FIXED: Initialize WebSocket server with duration-based rooms only
 */
const initializeWebSocket = async (server, autoStartTicks = true) => {
    try {
        console.log('🔄 Initializing WebSocket server - DURATION-BASED ROOMS ONLY...');
        
        // Wait for Redis connection
        if (!isConnected()) {
            console.log('⏳ Waiting for Redis connection...');
            await new Promise(resolve => {
                const checkRedis = setInterval(() => {
                    if (isConnected()) {
                        clearInterval(checkRedis);
                        resolve();
                    }
                }, 1000);
            });
        }
        
        console.log('✅ Redis connected, creating WebSocket server...');
        
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

        // Connection handling
        io.on('connection', (socket) => {
            console.log('🔗 New WebSocket connection:', socket.id, 'User:', socket.user.userId || socket.user.id);

            socket.emit('connected', {
                message: 'Connected to DueWin game server',
                timestamp: new Date().toISOString(),
                mode: 'DURATION_BASED_ROOMS',
                supportedGames: Object.keys(GAME_CONFIGS),
                totalRooms: Object.values(GAME_CONFIGS).reduce((sum, durations) => sum + durations.length, 0)
            });

            // FIXED: Handle join game with duration-based validation only
            socket.on('joinGame', async (data) => {
                try {
                    const { gameType, duration } = data;
                    
                    console.log(`🎮 Join game request: ${gameType} ${duration}s`);
                    
                    // FIXED: Validation - no timeline, only duration
                    if (!GAME_CONFIGS[gameType] || !GAME_CONFIGS[gameType].includes(duration)) {
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
                        console.log(`👋 User left previous room: ${oldRoomId}`);
                    }
                    
                    // Join new duration-based room
                    socket.join(roomId);
                    socket.currentGame = { gameType, duration, roomId };

                    socket.emit('joinedGame', {
                        gameType, 
                        duration, 
                        roomId,
                        message: `Joined ${gameType} ${duration}s room`,
                        timestamp: new Date().toISOString()
                    });

                    // Send current period info from Redis (populated by game scheduler)
                    await sendCurrentPeriodFromRedis(socket, gameType, duration);

                } catch (error) {
                    console.error('❌ Error joining game:', error);
                    socket.emit('error', { message: 'Failed to join game' });
                }
            });

            // FIXED: Handle leave game with duration-based rooms
            socket.on('leaveGame', (data) => {
                try {
                    const { gameType, duration } = data;
                    const roomId = `${gameType}_${duration}`;
                    
                    socket.leave(roomId);
                    socket.currentGame = null;
                    socket.emit('leftGame', { gameType, duration, roomId });
                    
                    console.log(`👋 User left room: ${roomId}`);
                } catch (error) {
                    console.error('❌ Error leaving game:', error);
                }
            });

            socket.on('ping', () => {
                socket.emit('pong', { 
                    timestamp: new Date().toISOString(),
                    gameTicksActive: gameTicksStarted,
                    currentGame: socket.currentGame
                });
            });

            socket.on('disconnect', () => {
                console.log('🔌 WebSocket disconnected:', socket.id);
            });
        });

        if (autoStartTicks) {
            setTimeout(() => {
                startBroadcastTicks();
            }, 1000);
        }
        
        console.log('✅ WebSocket server initialized - DURATION-BASED ROOMS ONLY');
        return io;
    } catch (error) {
        console.error('❌ Failed to initialize WebSocket server:', error);
        throw error;
    }
};

/**
 * FIXED: Start broadcast ticks for duration-based rooms only
 */
const startBroadcastTicks = () => {
    try {
        console.log('🕐 Starting DURATION-BASED broadcast tick system...');
        
        // FIXED: Start broadcast ticks for each game/duration combination
        Object.entries(GAME_CONFIGS).forEach(([gameType, durations]) => {
            durations.forEach(duration => {
                startBroadcastTicksForGame(gameType, duration);
            });
        });
        
        gameTicksStarted = true;
        console.log('✅ DURATION-BASED broadcast tick system started');
        
        // Log active rooms
        console.log('\n📋 ACTIVE ROOMS:');
        Object.entries(GAME_CONFIGS).forEach(([gameType, durations]) => {
            durations.forEach(duration => {
                console.log(`   - ${gameType}_${duration}`);
            });
        });
        console.log(`📊 Total rooms: ${Object.values(GAME_CONFIGS).reduce((sum, durations) => sum + durations.length, 0)}\n`);
        
    } catch (error) {
        console.error('❌ Error starting broadcast ticks:', error);
    }
};

/**
 * FIXED: Start broadcast ticks for specific game/duration combination
 */
const startBroadcastTicksForGame = (gameType, duration) => {
    const key = `${gameType}_${duration}`;
    
    // Clear existing interval
    if (gameIntervals.has(key)) {
        clearInterval(gameIntervals.get(key));
    }
    
    // Start broadcast interval - every 1 second
    const intervalId = setInterval(async () => {
        await broadcastTick(gameType, duration);
    }, 1000);
    
    gameIntervals.set(key, intervalId);
    console.log(`⏰ Started broadcast ticks for ${gameType} ${duration}s`);
};

/**
 * FIXED: Broadcast tick - Enhanced time validation to prevent race conditions
 */
const broadcastTick = async (gameType, duration) => {
    try {
        if (!isConnected()) return;

        const roomId = `${gameType}_${duration}`;
        
        // Get period info from Redis (populated by game scheduler process)
        const periodInfo = await getPeriodInfoFromRedis(gameType, duration);
        
        if (!periodInfo) {
            // No period info available - request new period from scheduler
            await redis.publish('game_scheduler:period_request', JSON.stringify({
                gameType,
                duration,
                roomId,
                timestamp: new Date().toISOString()
            }));
            return;
        }

        const now = new Date();
        
        // Calculate actual time remaining using period end time
        let actualTimeRemaining;
        try {
            const actualEndTime = calculatePeriodEndTime(periodInfo.periodId, duration);
            actualTimeRemaining = Math.max(0, Math.ceil((actualEndTime - now) / 1000));
        } catch (timeError) {
            // Fallback to Redis time if calculation fails
            const redisEndTime = new Date(periodInfo.endTime);
            actualTimeRemaining = Math.max(0, Math.ceil((redisEndTime - now) / 1000));
        }
        
        // Validate time remaining is within reasonable bounds
        if (actualTimeRemaining < 0 || actualTimeRemaining > duration + 5) {
            // Period has ended or is invalid, request new period from scheduler
            await redis.publish('game_scheduler:period_request', JSON.stringify({
                gameType,
                duration,
                roomId,
                currentPeriodId: periodInfo.periodId,
                timestamp: now.toISOString()
            }));
            return;
        }
        
        const bettingOpen = actualTimeRemaining > 5;

        // Broadcast time update to specific room
        io.to(roomId).emit('timeUpdate', {
            gameType,
            duration,
            periodId: periodInfo.periodId,
            timeRemaining: actualTimeRemaining,
            endTime: periodInfo.endTime,
            bettingOpen,
            timestamp: now.toISOString(),
            roomId,
            source: 'websocket_validated'
        });

        // Handle betting closure notification - only once at exactly 5 seconds
        if (actualTimeRemaining === 5 && bettingOpen) {
            io.to(roomId).emit('bettingClosed', {
                gameType, 
                duration,
                periodId: periodInfo.periodId,
                message: `Betting closed for ${gameType} ${duration}s`,
                roomId,
                timestamp: now.toISOString()
            });
            console.log(`📢 WebSocket: Betting closed for ${roomId} - ${periodInfo.periodId}`);
        }

        // If period is about to end (less than 1 second remaining), request next period
        if (actualTimeRemaining <= 1) {
            await redis.publish('game_scheduler:period_request', JSON.stringify({
                gameType,
                duration,
                roomId,
                currentPeriodId: periodInfo.periodId,
                timestamp: now.toISOString()
            }));
        }

    } catch (error) {
        // Suppress frequent errors to avoid log spam
        const errorKey = `broadcast_error_${gameType}_${duration}`;
        const lastError = global[errorKey] || 0;
        if (Date.now() - lastError > 60000) { // Log once per minute
            console.error(`❌ WebSocket broadcast tick error [${gameType}|${duration}s]:`, error.message);
            global[errorKey] = Date.now();
        }
    }
};

/**
 * FIXED: Get period info from Redis (populated by game scheduler)
 */
const getPeriodInfoFromRedis = async (gameType, duration) => {
    try {
        // FIXED: Simple Redis key without timeline complexity
        const currentPeriodKey = `game_scheduler:${gameType}:${duration}:current`;
        const periodData = await redis.get(currentPeriodKey);
        
        if (!periodData) {
            return null;
        }
        
        const parsed = JSON.parse(periodData);
        
        // FIXED: Additional validation to ensure data integrity
        if (!parsed.periodId || !parsed.endTime) {
            console.warn(`⚠️ WebSocket: Invalid period data structure for ${gameType}_${duration}`);
            return null;
        }
        
        return parsed;
    } catch (error) {
        console.error('❌ WebSocket: Error getting period info from Redis:', error);
        return null;
    }
};

/**
 * FIXED: Send current period info from Redis with enhanced validation
 */
const sendCurrentPeriodFromRedis = async (socket, gameType, duration) => {
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
        if (timeRemaining > duration + 5) {
            console.warn(`⚠️ WebSocket: Unrealistic time remaining ${timeRemaining}s for period ${periodInfo.periodId}, using fallback`);
            timeRemaining = duration; // Fallback to full duration
        }

        socket.emit('periodInfo', {
            gameType, 
            duration,
            periodId: periodInfo.periodId,
            timeRemaining,
            endTime: periodInfo.endTime,
            bettingOpen,
            timestamp: now.toISOString(),
            source: 'websocket_validated'
        });

        console.log(`📤 WebSocket: Sent validated period info [${gameType}|${duration}s]: ${periodInfo.periodId} (${timeRemaining}s)`);

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
 * FIXED: Setup Redis subscriptions for game scheduler events
 */
const setupRedisSubscriptions = () => {
    try {
        const { redis: subscriberRedis } = require('../config/redisConfig');
        
        // Create separate Redis connection for subscriptions
        const subscriber = subscriberRedis.duplicate();
        
        // Subscribe to game scheduler events
        subscriber.subscribe('game_scheduler:period_start');
        subscriber.subscribe('game_scheduler:period_result');
        subscriber.subscribe('game_scheduler:betting_closed');
        subscriber.subscribe('game_scheduler:period_error');
        
        subscriber.on('message', (channel, message) => {
            try {
                const data = JSON.parse(message);
                handleGameSchedulerEvent(channel, data);
            } catch (error) {
                console.error('❌ WebSocket: Error handling Redis message:', error);
            }
        });
        
        console.log('✅ WebSocket: Redis subscriptions setup for game scheduler events');
        
    } catch (error) {
        console.error('❌ WebSocket: Error setting up Redis subscriptions:', error);
    }
};

/**
 * FIXED: Handle events from game scheduler process with validation
 */
const handleGameSchedulerEvent = (channel, data) => {
    try {
        const { gameType, duration, roomId, periodId } = data;
        
        // FIXED: Validate roomId format (should be gameType_duration only)
        const expectedRoomId = `${gameType}_${duration}`;
        if (roomId !== expectedRoomId) {
            console.warn(`⚠️ WebSocket: Room ID mismatch: expected ${expectedRoomId}, got ${roomId}`);
            // Use expected room ID to ensure delivery
            data.roomId = expectedRoomId;
        }
        
        // FIXED: Additional validation for period events
        if (periodId && (channel === 'game_scheduler:period_start' || channel === 'game_scheduler:period_result')) {
            try {
                // Validate period ID format
                if (!/^\d{17}$/.test(periodId)) {
                    console.warn(`⚠️ WebSocket: Invalid period ID format: ${periodId}`);
                    return;
                }
                
                // For period start events, validate timing
                if (channel === 'game_scheduler:period_start') {
                    const endTime = calculatePeriodEndTime(periodId, duration);
                    const timeRemaining = Math.max(0, (endTime - new Date()) / 1000);
                    
                    if (timeRemaining < duration - 5) {
                        console.warn(`⚠️ WebSocket: Period start event received too late for ${periodId} (${timeRemaining}s remaining)`);
                    }
                }
            } catch (validationError) {
                console.error(`❌ WebSocket: Event validation error for ${periodId}:`, validationError.message);
                return;
            }
        }
        
        switch (channel) {
            case 'game_scheduler:period_start':
                console.log(`📢 WebSocket: Broadcasting period start: ${periodId} to ${expectedRoomId}`);
                io.to(expectedRoomId).emit('periodStart', {
                    ...data,
                    roomId: expectedRoomId,
                    source: 'game_scheduler',
                    validated: true
                });
                break;
                
            case 'game_scheduler:period_result':
                console.log(`📢 WebSocket: Broadcasting period result: ${periodId} to ${expectedRoomId}`);
                io.to(expectedRoomId).emit('periodResult', {
                    ...data,
                    roomId: expectedRoomId,
                    source: 'game_scheduler',
                    validated: true
                });
                break;
                
            case 'game_scheduler:betting_closed':
                console.log(`📢 WebSocket: Broadcasting betting closed: ${periodId} to ${expectedRoomId}`);
                io.to(expectedRoomId).emit('bettingClosed', {
                    ...data,
                    roomId: expectedRoomId,
                    source: 'game_scheduler',
                    validated: true
                });
                break;
                
            case 'game_scheduler:period_error':
                console.log(`📢 WebSocket: Broadcasting period error: ${periodId} to ${expectedRoomId}`);
                io.to(expectedRoomId).emit('periodError', {
                    ...data,
                    roomId: expectedRoomId,
                    source: 'game_scheduler',
                    validated: true
                });
                break;
        }
        
    } catch (error) {
        console.error('❌ WebSocket: Error handling game scheduler event:', error);
    }
};

// Export WebSocket service - DURATION-BASED ROOMS ONLY
module.exports = {
    initializeWebSocket,
    
    startGameTickSystem: () => {
        console.log('🕐 Starting WebSocket DURATION-BASED broadcast system...');
        startBroadcastTicks();
        setupRedisSubscriptions();
    },
    
    // Broadcast functions for external use
    broadcastToGame: (gameType, duration, event, data) => {
        try {
            if (!io) return;
            
            const roomId = `${gameType}_${duration}`;
            
            // FIXED: Add validation before broadcasting
            if (event === 'timeUpdate' && data.timeRemaining !== undefined) {
                if (data.timeRemaining < 0 || data.timeRemaining > duration + 5) {
                    console.warn(`⚠️ WebSocket: Invalid time remaining ${data.timeRemaining}s in external broadcast, skipping`);
                    return;
                }
            }
            
            io.to(roomId).emit(event, {
                ...data,
                gameType, 
                duration, 
                roomId,
                source: 'external_broadcast',
                validated: true
            });
            
            console.log(`📢 WebSocket: External broadcast ${event} to ${roomId}`);
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
                validated: true
            });
        } catch (error) {
            console.error('❌ WebSocket: Error broadcasting to all:', error);
        }
    },
    
    // Status functions
    getSystemStats: () => ({
        connectedClients: io ? io.sockets.sockets.size : 0,
        activeBroadcastIntervals: gameIntervals.size,
        broadcastTicksStarted: gameTicksStarted,
        mode: 'DURATION_BASED_ROOMS_VALIDATED',
        supportedGames: Object.keys(GAME_CONFIGS),
        gameConfigs: GAME_CONFIGS,
        totalRooms: Object.values(GAME_CONFIGS).reduce((sum, durations) => sum + durations.length, 0)
    }),
    
    getIo: () => io,
    
    stopGameTicks: () => {
        gameIntervals.forEach((intervalId, key) => {
            clearInterval(intervalId);
            console.log(`⏹️ WebSocket: Stopped broadcast ticks for ${key}`);
        });
        gameIntervals.clear();
        gameTicksStarted = false;
        console.log('🛑 WebSocket: All broadcast ticks stopped');
    },
    
    // Debug functions
    verifyGameTicks: () => {
        console.log('🔍 Verifying DURATION-BASED broadcast system...');
        
        const expectedIntervals = Object.values(GAME_CONFIGS).reduce((sum, durations) => sum + durations.length, 0);
        const activeIntervals = gameIntervals.size;
        
        console.log(`📊 WebSocket broadcast system status:`);
        console.log(`   - Active intervals: ${activeIntervals}`);
        console.log(`   - Expected intervals: ${expectedIntervals}`);
        console.log(`   - System started: ${gameTicksStarted}`);
        console.log(`   - Connected clients: ${io ? io.sockets.sockets.size : 0}`);
        
        // Show detailed status
        Object.keys(GAME_CONFIGS).forEach(gameType => {
            console.log(`\n📋 ${gameType.toUpperCase()} rooms:`);
            GAME_CONFIGS[gameType].forEach(duration => {
                const key = `${gameType}_${duration}`;
                const hasInterval = gameIntervals.has(key);
                const roomId = `${gameType}_${duration}`;
                const clientCount = io ? (io.sockets.adapter.rooms.get(roomId)?.size || 0) : 0;
                console.log(`   - ${key}: ${hasInterval ? '✅ Active' : '❌ Inactive'} | ${clientCount} clients`);
            });
        });
        
        return {
            active: activeIntervals,
            expected: expectedIntervals,
            started: gameTicksStarted,
            working: activeIntervals === expectedIntervals && gameTicksStarted,
            connectedClients: io ? io.sockets.sockets.size : 0
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
            return {
                valid: timeRemaining >= 0 && timeRemaining <= duration,
                timeRemaining,
                endTime: endTime.toISOString()
            };
        } catch (error) {
            return {
                valid: false,
                error: error.message
            };
        }
    },
    
    GAME_CONFIGS
};