// Backend/services/websocketService.js - FIXED REAL-TIME VERSION

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/constants');
const { redis, isConnected } = require('../config/redisConfig');
const { logger } = require('../utils/logger');
const moment = require('moment-timezone');

// Import services properly
let periodService;
let gameLogicService;

// Load services with error handling
const loadServices = () => {
    try {
        if (!periodService) {
            periodService = require('./periodService');
            console.log('✅ Period service loaded');
        }
        if (!gameLogicService) {
            gameLogicService = require('./gameLogicService');
            console.log('✅ Game logic service loaded');
        }
        return true;
    } catch (error) {
        console.warn('⚠️ Services not ready yet:', error.message);
        return false;
    }
};

// Socket.io server instance
let io;

// Game tick intervals storage
const gameIntervals = new Map();
let gameTicksStarted = false;

// Period cache to track current periods
const currentPeriods = new Map();

// Constants
const GAME_CONFIGS = {
    wingo: [30, 60, 180, 300],    // 30s, 1m, 3m, 5m
    trx_wix: [30, 60, 180, 300],  // 30s, 1m, 3m, 5m
    fiveD: [60, 180, 300, 600],   // 1m, 3m, 5m, 10m
    k3: [60, 180, 300, 600]       // 1m, 3m, 5m, 10m
};

/**
 * Calculate real-time period information
 */
const calculateRealTimePeriod = (gameType, duration, now = new Date()) => {
    try {
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
        
        console.log(`Real-time calculation for ${gameType} ${duration}s:`, {
            currentTime: istMoment.format(),
            startOfPeriods: startOfPeriods.format(),
            totalSeconds,
            currentPeriodNumber,
            periodId,
            timeRemaining,
            currentPeriodStart: currentPeriodStart.format(),
            currentPeriodEnd: currentPeriodEnd.format()
        });
        
        return {
            periodId,
            gameType,
            duration,
            startTime: currentPeriodStart.toDate(),
            endTime: currentPeriodEnd.toDate(),
            timeRemaining,
            active: timeRemaining > 0,
            bettingOpen: timeRemaining > 5
        };
    } catch (error) {
        console.error('Error calculating real-time period:', error);
        throw error;
    }
};

/**
 * Initialize the WebSocket server
 */
const initializeWebSocket = (server, autoStartTicks = true) => {
    console.log('🔄 Initializing WebSocket server...');
    
    // Create Socket.io server
    io = new Server(server, {
        cors: {
            origin:[
                process.env.FRONTEND_URL || "*",
                "http://localhost:3000",
                "http://localhost:3001", 
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
            console.log('🔍 WebSocket Auth: Attempting authentication...');
            
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

        // Send connection confirmation immediately
        socket.emit('connected', {
            message: 'Connected to game server',
            timestamp: new Date().toISOString(),
            gameTicksActive: gameTicksStarted,
            userId: socket.user.userId || socket.user.id
        });

        // Handle join game
        socket.on('joinGame', async (data) => {
            try {
                console.log('🎮 Join game request:', data);
                
                const { gameType, duration } = data;
                
                // Validate game type and duration
                if (!GAME_CONFIGS[gameType] || !GAME_CONFIGS[gameType].includes(duration)) {
                    socket.emit('error', { message: 'Invalid game type or duration' });
                    return;
                }

                const roomId = `${gameType}_${duration}`;
                
                // Join the room
                socket.join(roomId);
                console.log(`✅ User ${socket.user.userId || socket.user.id} joined room: ${roomId}`);

                // Confirm join FIRST
                socket.emit('joinedGame', {
                    gameType,
                    duration,
                    roomId,
                    message: `Successfully joined ${gameType} ${duration}s game`,
                    gameTicksActive: gameTicksStarted,
                    timestamp: new Date().toISOString()
                });

                // Send current game state immediately
                await sendCurrentGameState(socket, gameType, duration);

            } catch (error) {
                console.error('❌ Error joining game:', error);
                socket.emit('error', { message: 'Failed to join game' });
            }
        });

        // Handle leave game
        socket.on('leaveGame', (data) => {
            try {
                const { gameType, duration } = data;
                const roomId = `${gameType}_${duration}`;
                
                socket.leave(roomId);
                console.log(`👋 User ${socket.user.userId || socket.user.id} left room: ${roomId}`);
                
                socket.emit('leftGame', { gameType, duration });
            } catch (error) {
                console.error('❌ Error leaving game:', error);
            }
        });

        // Handle ping/pong
        socket.on('ping', () => {
            socket.emit('pong', { 
                timestamp: new Date().toISOString(),
                gameTicksActive: gameTicksStarted 
            });
        });

        // Handle betting
        socket.on('placeBet', async (data) => {
            try {
                console.log('💰 Bet placement request:', data);
                
                if (!loadServices()) {
                    socket.emit('betError', { message: 'Game services not ready' });
                    return;
                }
                
                // Map the incoming data to the expected format
                const mappedData = {
                    userId: socket.user.userId || socket.user.id,
                    gameType: data.gameType,
                    duration: data.duration,
                    periodId: data.periodId,
                    betType: data.type,
                    betValue: data.selection,
                    betAmount: data.amount,
                    timeline: 'default'  // Explicitly set timeline to default
                };
                
                const result = await gameLogicService.processBet(mappedData);

                if (result.success) {
                    socket.emit('betPlaced', result.data);
                    
                    // Broadcast bet update to room
                    const roomId = `${data.gameType}_${data.duration}`;
                    io.to(roomId).emit('betUpdate', {
                        gameType: data.gameType,
                        duration: data.duration,
                        periodId: data.periodId,
                        timestamp: new Date().toISOString()
                    });
                } else {
                    socket.emit('betError', { message: result.message });
                }
            } catch (error) {
                console.error('❌ Error processing bet:', error);
                socket.emit('betError', { message: 'Failed to process bet' });
            }
        });

        // Handle disconnect
        socket.on('disconnect', () => {
            console.log('🔌 WebSocket disconnected:', socket.id);
        });
    });

    // Only start game tick system if autoStartTicks is true
    if (autoStartTicks) {
        setTimeout(() => {
            startGameTickSystem();
        }, 1000);
    }
    
    console.log('✅ WebSocket server initialized successfully');
    return io;
};

/**
 * Start the game tick system for all games
 */
const startGameTickSystem = async () => {
    try {
        console.log('🕐 Starting game tick system...');
        
        // Load services
        const servicesReady = loadServices();
        if (!servicesReady) {
            console.warn('⚠️ Services not ready, retrying in 3 seconds...');
            setTimeout(startGameTickSystem, 3000);
            return;
        }
        
        // Initialize current periods for all games
        Object.entries(GAME_CONFIGS).forEach(([gameType, durations]) => {
            durations.forEach(duration => {
                const key = `${gameType}_${duration}`;
                // Calculate and store current period
                const currentPeriod = calculateRealTimePeriod(gameType, duration);
                currentPeriods.set(key, currentPeriod);
                
                // Initialize period in database if needed
                if (periodService && periodService.initializePeriod) {
                    periodService.initializePeriod(gameType, duration, currentPeriod.periodId)
                        .catch(err => console.warn(`Failed to initialize period ${currentPeriod.periodId}:`, err.message));
                }
            });
        });
        
        // Start game ticks for all configured games
        Object.entries(GAME_CONFIGS).forEach(([gameType, durations]) => {
            durations.forEach(duration => {
                startGameTicks(gameType, duration);
            });
        });
        
        gameTicksStarted = true;
        console.log('✅ Game tick system started for all games');
        
        // Broadcast to all connected clients
        if (io) {
            io.emit('gameTicksStarted', {
                message: 'Game tick system is now active',
                timestamp: new Date().toISOString()
            });
        }
        
    } catch (error) {
        console.error('❌ Error starting game tick system:', error);
        // Retry after 5 seconds
        setTimeout(startGameTickSystem, 5000);
    }
};

/**
 * Start game ticks for a specific game and duration
 */
const startGameTicks = (gameType, duration) => {
    const key = `${gameType}_${duration}`;
    
    // Clear existing interval if any
    if (gameIntervals.has(key)) {
        clearInterval(gameIntervals.get(key));
    }
    
    // Start new interval - tick every second
    const intervalId = setInterval(async () => {
        await gameTick(gameType, duration);
    }, 1000);
    
    gameIntervals.set(key, intervalId);
    console.log(`⏰ Started game ticks for ${gameType} ${duration}s`);
};

/**
 * FIXED: Main game tick function with real-time calculation
 */
const gameTick = async (gameType, duration) => {
    try {
        // Skip if Redis not connected
        if (!isConnected()) {
            return;
        }

        const now = new Date();
        const key = `${gameType}_${duration}`;
        
        // Calculate current real-time period
        const currentPeriod = calculateRealTimePeriod(gameType, duration, now);
        const cachedPeriod = currentPeriods.get(key);
        
        // Check if we need to start a new period
        if (!cachedPeriod || cachedPeriod.periodId !== currentPeriod.periodId) {
            console.log(`🔄 Period change detected for ${gameType} ${duration}s: ${cachedPeriod?.periodId} -> ${currentPeriod.periodId}`);
            
            // If there was a previous period, process its results
            if (cachedPeriod && cachedPeriod.periodId !== currentPeriod.periodId) {
                await handlePeriodEnd(gameType, duration, cachedPeriod.periodId, `${gameType}_${duration}`);
            }
            
            // Update cached period
            currentPeriods.set(key, currentPeriod);
            
            // Initialize new period in database
            if (loadServices() && periodService.initializePeriod) {
                try {
                    await periodService.initializePeriod(gameType, duration, currentPeriod.periodId);
                } catch (initError) {
                    console.warn(`Failed to initialize period ${currentPeriod.periodId}:`, initError.message);
                }
            }
            
            // Broadcast new period start
            const roomId = `${gameType}_${duration}`;
            io.to(roomId).emit('periodStart', {
                gameType,
                duration,
                periodId: currentPeriod.periodId,
                timeRemaining: Math.floor(currentPeriod.timeRemaining),
                endTime: currentPeriod.endTime.toISOString(),
                message: 'New period started - betting is open!'
            });
        }
        
        const { periodId, timeRemaining, endTime, bettingOpen } = currentPeriod;
        const roomId = `${gameType}_${duration}`;
        
        // Broadcast time update every second
        io.to(roomId).emit('timeUpdate', {
            gameType,
            duration,
            periodId,
            timeRemaining: Math.floor(timeRemaining),
            endTime: endTime.toISOString(),
            bettingOpen,
            timestamp: now.toISOString()
        });

        // Handle different time stages
        if (timeRemaining <= 5 && timeRemaining > 0 && bettingOpen) {
            // Last 5 seconds - close betting
            io.to(roomId).emit('bettingClosed', {
                gameType,
                duration,
                periodId,
                message: 'Betting is now closed for this period'
            });
        }

        // Debug logging every 15 seconds for first minute, then every 30 seconds
        const logInterval = timeRemaining > 60 ? 30 : 15;
        if (Math.floor(timeRemaining) % logInterval === 0 && timeRemaining > 0) {
            console.log(`Game tick: ${gameType}, ${duration}s, Period: ${periodId}, Time: ${Math.floor(timeRemaining)}s`);
        }

    } catch (error) {
        // Reduce noise - only log every minute for the same error
        const errorKey = `${gameType}_${duration}_error`;
        const lastLogTime = global[errorKey] || 0;
        const now = Date.now();
        
        if (now - lastLogTime > 60000) { // 1 minute
            console.error(`❌ Error in game tick for ${gameType} ${duration}s:`, error.message);
            global[errorKey] = now;
        }
    }
};

/**
 * FIXED: Handle period end with immediate result processing
 */
const handlePeriodEnd = async (gameType, duration, periodId, roomId) => {
    try {
        console.log(`🏁 Period ended: ${gameType} ${duration}s - ${periodId}`);
        
        if (!loadServices()) {
            console.error('❌ Services not ready for period end processing');
            return;
        }
        
        // Process the game results immediately
        try {
            console.log(`🎲 Processing results for ${periodId}...`);
            const gameResult = await gameLogicService.processGameResults(gameType, duration, periodId);
            
            if (gameResult.success) {
                // Broadcast result immediately to all users in the room
                const resultData = {
                    gameType,
                    duration,
                    periodId,
                    result: gameResult.gameResult,
                    winners: gameResult.winners?.length || 0,
                    timestamp: new Date().toISOString()
                };
                
                io.to(roomId).emit('periodResult', resultData);
                
                // Also broadcast to general games room
                io.to('games').emit('gameResult', resultData);
                
                console.log(`📢 Broadcasted result for ${gameType} ${duration}s - ${periodId}`);
                console.log(`🏆 Result: ${JSON.stringify(gameResult.gameResult)}, Winners: ${gameResult.winners?.length || 0}`);
                
            } else {
                console.error(`❌ Failed to process game results for ${periodId}:`, gameResult.message || 'Unknown error');
                
                // Broadcast error to room
                io.to(roomId).emit('periodError', {
                    gameType,
                    duration,
                    periodId,
                    message: 'Failed to process results',
                    //timestamp: new Date().toISOString()
                });
            }
        } catch (processError) {
            console.error(`❌ Error processing game results for ${periodId}:`, processError.message);
            console.error('Stack trace:', processError.stack);
            
            // Broadcast error to room
            io.to(roomId).emit('periodError', {
                gameType,
                duration,
                periodId,
                message: 'Error processing results',
                timestamp: new Date().toISOString()
            });
        }

    } catch (error) {
        console.error(`❌ Error handling period end for ${gameType} ${duration}s:`, error);
    }
};

/**
 * FIXED: Send current game state with real-time calculation
 */
const sendCurrentGameState = async (socket, gameType, duration) => {
    try {
        // Calculate current real-time period
        const currentPeriod = calculateRealTimePeriod(gameType, duration);
        
        // Send current period info
        socket.emit('periodInfo', {
            gameType,
            duration,
            periodId: currentPeriod.periodId,
            timeRemaining: Math.floor(currentPeriod.timeRemaining),
            endTime: currentPeriod.endTime.toISOString(),
            bettingOpen: currentPeriod.bettingOpen,
            timestamp: new Date().toISOString()
        });

        // Send recent results if services are available
        if (loadServices()) {
            try {
                const recentResults = await gameLogicService.getGameHistory(gameType, duration, 5, 0);
                if (recentResults && recentResults.success) {
                    socket.emit('recentResults', {
                        gameType,
                        duration,
                        results: recentResults.data.results
                    });
                }
            } catch (historyError) {
                console.warn('⚠️ Could not get recent results:', historyError.message);
            }
        }

        // Send betting closed status if needed
        if (!currentPeriod.bettingOpen) {
            socket.emit('bettingClosed', {
                gameType,
                duration,
                periodId: currentPeriod.periodId
            });
        }

        console.log(`📤 Sent current game state to user for ${gameType} ${duration}s - Period: ${currentPeriod.periodId}, Time: ${Math.floor(currentPeriod.timeRemaining)}s`);

    } catch (error) {
        console.error('❌ Error sending current game state:', error);
        socket.emit('error', { 
            message: 'Failed to get current game state',
            gameType,
            duration 
        });
    }
};

/**
 * Broadcast to specific game room
 */
const broadcastToGame = async (gameType, durationOrData, event, data) => {
    try {
        if (!io) {
            console.warn('⚠️ WebSocket not initialized, skipping broadcast');
            return;
        }

        if (typeof durationOrData === 'number') {
            const roomId = `${gameType}_${durationOrData}`;
            io.to(roomId).emit(event, data);
            console.log(`📢 Broadcasted ${event} to ${roomId}`);
        } else {
            const durations = GAME_CONFIGS[gameType] || [];
            durations.forEach(duration => {
                const roomId = `${gameType}_${duration}`;
                io.to(roomId).emit('gameUpdate', durationOrData);
            });
            console.log(`📢 Broadcasted to all ${gameType} rooms`);
        }
    } catch (error) {
        console.error('❌ Error broadcasting to game:', error);
    }
};

/**
 * Broadcast to all connected clients
 */
const broadcastToAll = (event, data) => {
    try {
        if (!io) {
            console.warn(`⚠️ WebSocket not initialized, cannot broadcast ${event} to all`);
            return;
        }
        
        io.emit(event, data);
        console.log(`📢 Broadcast ${event} to all clients successful`);
    } catch (error) {
        console.error(`❌ Error broadcasting to all:`, error.message);
    }
};

/**
 * Get current period info for external use
 */
const getCurrentPeriodInfo = (gameType, duration) => {
    const key = `${gameType}_${duration}`;
    const cached = currentPeriods.get(key);
    
    if (cached) {
        return cached;
    }
    
    // Calculate if not cached
    return calculateRealTimePeriod(gameType, duration);
};

/**
 * Verify game ticks are working
 */
const verifyGameTicks = () => {
    console.log('🔍 Verifying game tick system...');
    
    const activeIntervals = gameIntervals.size;
    const expectedIntervals = Object.values(GAME_CONFIGS).reduce((sum, durations) => sum + durations.length, 0);
    
    console.log(`📊 Game ticks status:`);
    console.log(`   - Active intervals: ${activeIntervals}`);
    console.log(`   - Expected intervals: ${expectedIntervals}`);
    console.log(`   - System started: ${gameTicksStarted}`);
    console.log(`   - Cached periods: ${currentPeriods.size}`);
    
    // Show current periods
    currentPeriods.forEach((period, key) => {
        console.log(`   - ${key}: ${period.periodId} (${Math.floor(period.timeRemaining)}s remaining)`);
    });
    
    if (activeIntervals === expectedIntervals && gameTicksStarted) {
        console.log('✅ Game tick system is working correctly');
    } else {
        console.warn('⚠️ Game tick system may have issues');
    }
    
    return {
        active: activeIntervals,
        expected: expectedIntervals,
        started: gameTicksStarted,
        cachedPeriods: currentPeriods.size,
        working: activeIntervals === expectedIntervals && gameTicksStarted
    };
};

/**
 * Get Socket.IO instance
 */
const getIo = () => io;

/**
 * Stop all game ticks (for cleanup)
 */
const stopGameTicks = () => {
    gameIntervals.forEach((intervalId, key) => {
        clearInterval(intervalId);
        console.log(`⏹️ Stopped game ticks for ${key}`);
    });
    gameIntervals.clear();
    currentPeriods.clear();
    gameTicksStarted = false;
};

/**
 * Join a game channel
 */
const joinGameChannel = async (socketId, gameType) => {
    try {
        if (!io) {
            console.warn('⚠️ WebSocket not initialized, skipping channel join');
            return;
        }

        const socket = io.sockets.sockets.get(socketId);
        if (!socket) {
            console.warn('⚠️ Socket not found:', socketId);
            return;
        }

        const channel = `${gameType}_channel`;
        await socket.join(channel);
        
        console.log(`✅ Socket ${socketId} joined channel: ${channel}`);
    } catch (error) {
        console.error('❌ Error joining game channel:', error);
    }
};

/**
 * Leave a game channel
 */
const leaveGameChannel = async (socketId, gameType) => {
    try {
        if (!io) {
            console.warn('⚠️ WebSocket not initialized, skipping channel leave');
            return;
        }

        const socket = io.sockets.sockets.get(socketId);
        if (!socket) {
            console.warn('⚠️ Socket not found:', socketId);
            return;
        }

        const channel = `${gameType}_channel`;
        await socket.leave(channel);
        
        console.log(`✅ Socket ${socketId} left channel: ${channel}`);
    } catch (error) {
        console.error('❌ Error leaving game channel:', error);
    }
};

module.exports = {
    initializeWebSocket,
    broadcastToGame,
    broadcastToAll,
    joinGameChannel,
    leaveGameChannel,
    startGameTickSystem,
    stopGameTicks,
    verifyGameTicks,
    getCurrentPeriodInfo,
    getIo
};