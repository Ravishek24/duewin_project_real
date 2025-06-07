// Backend/services/websocketService.js - FIXED: Duration-based rooms only

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
 * FIXED: Initialize WebSocket server with duration-based rooms only
 */
const initializeWebSocket = (server, autoStartTicks = true) => {
    console.log('🔄 Initializing WebSocket server - DURATION-BASED ROOMS ONLY...');
    
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
 * FIXED: Broadcast tick - reads Redis data populated by game scheduler
 */
const broadcastTick = async (gameType, duration) => {
    try {
        if (!isConnected()) return;

        const roomId = `${gameType}_${duration}`;
        
        // FIXED: Read period info from Redis (populated by game scheduler process)
        const periodInfo = await getPeriodInfoFromRedis(gameType, duration);
        
        if (!periodInfo) {
            // No period info available - game scheduler might not be running
            return;
        }

        const now = new Date();
        const endTime = new Date(periodInfo.endTime);
        const timeRemaining = Math.max(0, Math.ceil((endTime - now) / 1000));
        const bettingOpen = timeRemaining > 5;

        // Broadcast time update to specific room
        io.to(roomId).emit('timeUpdate', {
            gameType,
            duration,
            periodId: periodInfo.periodId,
            timeRemaining,
            endTime: periodInfo.endTime,
            bettingOpen,
            timestamp: now.toISOString(),
            roomId,
            source: 'game_scheduler'
        });

        // Handle betting closure notification
        if (timeRemaining === 5) {
            io.to(roomId).emit('bettingClosed', {
                gameType, 
                duration,
                periodId: periodInfo.periodId,
                message: `Betting closed for ${gameType} ${duration}s`,
                roomId
            });
        }

    } catch (error) {
        // Suppress frequent errors
        const errorKey = `broadcast_error_${gameType}_${duration}`;
        const lastError = global[errorKey] || 0;
        if (Date.now() - lastError > 60000) { // Log once per minute
            console.error(`❌ Broadcast tick error [${gameType}|${duration}s]:`, error.message);
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
        
        return JSON.parse(periodData);
    } catch (error) {
        console.error('❌ Error getting period info from Redis:', error);
        return null;
    }
};

/**
 * FIXED: Send current period info from Redis
 */
const sendCurrentPeriodFromRedis = async (socket, gameType, duration) => {
    try {
        const periodInfo = await getPeriodInfoFromRedis(gameType, duration);
        
        if (!periodInfo) {
            socket.emit('error', { 
                message: 'No active period found - game scheduler may not be running',
                gameType, 
                duration
            });
            return;
        }

        const now = new Date();
        const endTime = new Date(periodInfo.endTime);
        const timeRemaining = Math.max(0, Math.ceil((endTime - now) / 1000));
        const bettingOpen = timeRemaining > 5;

        socket.emit('periodInfo', {
            gameType, 
            duration,
            periodId: periodInfo.periodId,
            timeRemaining,
            endTime: periodInfo.endTime,
            bettingOpen,
            timestamp: now.toISOString(),
            source: 'game_scheduler'
        });

        console.log(`📤 Sent period info [${gameType}|${duration}s]: ${periodInfo.periodId} (${timeRemaining}s)`);

    } catch (error) {
        console.error('❌ Error sending period info:', error);
        socket.emit('error', { 
            message: 'Failed to get current period info',
            gameType, 
            duration
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
                console.error('❌ Error handling Redis message:', error);
            }
        });
        
        console.log('✅ Redis subscriptions setup for game scheduler events');
        
    } catch (error) {
        console.error('❌ Error setting up Redis subscriptions:', error);
    }
};

/**
 * FIXED: Handle events from game scheduler process
 */
const handleGameSchedulerEvent = (channel, data) => {
    try {
        const { gameType, duration, roomId } = data;
        
        // FIXED: Validate roomId format (should be gameType_duration only)
        const expectedRoomId = `${gameType}_${duration}`;
        if (roomId !== expectedRoomId) {
            console.warn(`⚠️ Room ID mismatch: expected ${expectedRoomId}, got ${roomId}`);
        }
        
        switch (channel) {
            case 'game_scheduler:period_start':
                console.log(`📢 Broadcasting period start: ${data.periodId} to ${roomId}`);
                io.to(roomId).emit('periodStart', {
                    ...data,
                    source: 'game_scheduler'
                });
                break;
                
            case 'game_scheduler:period_result':
                console.log(`📢 Broadcasting period result: ${data.periodId} to ${roomId}`);
                io.to(roomId).emit('periodResult', {
                    ...data,
                    source: 'game_scheduler'
                });
                break;
                
            case 'game_scheduler:betting_closed':
                console.log(`📢 Broadcasting betting closed: ${data.periodId} to ${roomId}`);
                io.to(roomId).emit('bettingClosed', {
                    ...data,
                    source: 'game_scheduler'
                });
                break;
                
            case 'game_scheduler:period_error':
                console.log(`📢 Broadcasting period error: ${data.periodId} to ${roomId}`);
                io.to(roomId).emit('periodError', {
                    ...data,
                    source: 'game_scheduler'
                });
                break;
        }
        
    } catch (error) {
        console.error('❌ Error handling game scheduler event:', error);
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
            io.to(roomId).emit(event, {
                ...data,
                gameType, 
                duration, 
                roomId,
                source: 'external_broadcast'
            });
            
            console.log(`📢 External broadcast ${event} to ${roomId}`);
        } catch (error) {
            console.error('❌ Error broadcasting to game:', error);
        }
    },
    
    broadcastToAll: (event, data) => {
        try {
            if (!io) return;
            io.emit(event, {
                ...data,
                source: 'external_broadcast',
                supportedGames: Object.keys(GAME_CONFIGS),
                totalRooms: Object.values(GAME_CONFIGS).reduce((sum, durations) => sum + durations.length, 0)
            });
        } catch (error) {
            console.error('❌ Error broadcasting to all:', error);
        }
    },
    
    // Status functions
    getSystemStats: () => ({
        connectedClients: io ? io.sockets.sockets.size : 0,
        activeBroadcastIntervals: gameIntervals.size,
        broadcastTicksStarted: gameTicksStarted,
        mode: 'DURATION_BASED_ROOMS',
        supportedGames: Object.keys(GAME_CONFIGS),
        gameConfigs: GAME_CONFIGS,
        totalRooms: Object.values(GAME_CONFIGS).reduce((sum, durations) => sum + durations.length, 0)
    }),
    
    getIo: () => io,
    
    stopGameTicks: () => {
        gameIntervals.forEach((intervalId, key) => {
            clearInterval(intervalId);
            console.log(`⏹️ Stopped broadcast ticks for ${key}`);
        });
        gameIntervals.clear();
        gameTicksStarted = false;
        console.log('🛑 All broadcast ticks stopped');
    },
    
    // Debug functions
    verifyGameTicks: () => {
        console.log('🔍 Verifying DURATION-BASED broadcast system...');
        
        const expectedIntervals = Object.values(GAME_CONFIGS).reduce((sum, durations) => sum + durations.length, 0);
        const activeIntervals = gameIntervals.size;
        
        console.log(`📊 Broadcast system status:`);
        console.log(`   - Active intervals: ${activeIntervals}`);
        console.log(`   - Expected intervals: ${expectedIntervals}`);
        console.log(`   - System started: ${gameTicksStarted}`);
        
        // Show detailed status
        Object.keys(GAME_CONFIGS).forEach(gameType => {
            console.log(`\n📋 ${gameType.toUpperCase()} rooms:`);
            GAME_CONFIGS[gameType].forEach(duration => {
                const key = `${gameType}_${duration}`;
                const hasInterval = gameIntervals.has(key);
                console.log(`   - ${key}: ${hasInterval ? '✅ Active' : '❌ Inactive'}`);
            });
        });
        
        return {
            active: activeIntervals,
            expected: expectedIntervals,
            started: gameTicksStarted,
            working: activeIntervals === expectedIntervals && gameTicksStarted
        };
    },
    
    GAME_CONFIGS
};