// Backend/services/websocketService.js - ENHANCED VERSION
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/constants');
const { redis, isConnected } = require('../config/redisConfig');
const { logger } = require('../utils/logger');
const Joi = require('joi');
const moment = require('moment-timezone');

// Import your services
const periodService = require('./periodService');
const gameLogicService = require('./gameLogicService');

// Socket.io server instance
let io;

// Game tick intervals storage
const gameIntervals = new Map();

// Constants
const GAME_CONFIGS = {
    wingo: [30, 60, 180, 300],    // 30s, 1m, 3m, 5m
    trx_wix: [30, 60, 180, 300],  // 30s, 1m, 3m, 5m
    fiveD: [60, 180, 300, 600],   // 1m, 3m, 5m, 10m
    k3: [60, 180, 300, 600]       // 1m, 3m, 5m, 10m
};

/**
 * Initialize the WebSocket server
 */
const initializeWebSocket = (server) => {
    console.log('🔄 Initializing WebSocket server...');
    
    // Create Socket.io server
    io = new Server(server, {
        cors: {
            origin: process.env.FRONTEND_URL || "*",
            methods: ["GET", "POST"],
            credentials: true
        },
        pingTimeout: 60000,
        pingInterval: 25000,
        transports: ['websocket', 'polling'] // Allow both for better compatibility
    });

    // Authentication middleware
    io.use(async (socket, next) => {
        try {
            let token = socket.handshake.auth.token || socket.handshake.query.token;
            
            if (!token) {
                console.log('❌ WebSocket: No token provided');
                return next(new Error('Authentication required'));
            }

            const decoded = jwt.verify(token, JWT_SECRET);
            socket.user = decoded;
            
            console.log('✅ WebSocket: User authenticated:', decoded.userId || decoded.id);
            next();
        } catch (error) {
            console.log('❌ WebSocket auth error:', error.message);
            next(new Error('Invalid token'));
        }
    });

    // Connection handling
    io.on('connection', (socket) => {
        console.log('🔗 New WebSocket connection:', socket.id, 'User:', socket.user.userId || socket.user.id);

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

                // Send current game state immediately
                await sendCurrentGameState(socket, gameType, duration);
                
                // Confirm join
                socket.emit('joinedGame', {
                    gameType,
                    duration,
                    roomId,
                    message: `Successfully joined ${gameType} ${duration}s game`
                });

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

        // Handle betting
        socket.on('placeBet', async (data) => {
            try {
                console.log('💰 Bet placement request:', data);
                
                // Process bet using your game logic service
                const result = await gameLogicService.processBet({
                    userId: socket.user.userId || socket.user.id,
                    ...data
                });

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

    // Start game tick system
    startGameTickSystem();
    
    console.log('✅ WebSocket server initialized successfully');
    return io;
};

/**
 * Start the game tick system for all games
 */
const startGameTickSystem = () => {
    console.log('🕐 Starting game tick system...');
    
    Object.entries(GAME_CONFIGS).forEach(([gameType, durations]) => {
        durations.forEach(duration => {
            startGameTicks(gameType, duration);
        });
    });
    
    console.log('✅ Game tick system started for all games');
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
 * Main game tick function
 */
const gameTick = async (gameType, duration) => {
    try {
        // Get current period info from your period service
        const currentPeriod = await periodService.getCurrentPeriod(gameType, duration);
        
        if (!currentPeriod) {
            // No active period, try to initialize one
            const now = new Date();
            const periodId = await periodService.getNextPeriodId(gameType, duration, now);
            await periodService.initializePeriod(gameType, duration, periodId);
            return;
        }

        const now = moment().tz('Asia/Kolkata');
        const endTime = moment(currentPeriod.endTime).tz('Asia/Kolkata');
        const timeRemaining = Math.max(0, endTime.diff(now, 'seconds'));
        
        const roomId = `${gameType}_${duration}`;
        
        // Broadcast time update every second
        io.to(roomId).emit('timeUpdate', {
            gameType,
            duration,
            periodId: currentPeriod.periodId,
            timeRemaining,
            endTime: endTime.toISOString(),
            bettingOpen: timeRemaining > 5,
            timestamp: now.toISOString()
        });

        // Handle different time stages
        if (timeRemaining === 5) {
            // 5 seconds left - close betting
            io.to(roomId).emit('bettingClosed', {
                gameType,
                duration,
                periodId: currentPeriod.periodId,
                message: 'Betting is now closed for this period'
            });
        } else if (timeRemaining === 0) {
            // Period ended - process results
            await handlePeriodEnd(gameType, duration, currentPeriod.periodId);
        } else if (timeRemaining % 10 === 0 && timeRemaining > 5) {
            // Every 10 seconds - send betting updates
            await broadcastBettingStats(gameType, duration, currentPeriod.periodId);
        }

    } catch (error) {
        console.error(`❌ Error in game tick for ${gameType} ${duration}s:`, error);
    }
};

/**
 * Handle period end and result processing
 */
const handlePeriodEnd = async (gameType, duration, periodId) => {
    try {
        console.log(`🏁 Period ended: ${gameType} ${duration}s - ${periodId}`);
        
        const roomId = `${gameType}_${duration}`;
        
        // Get the result (this should be processed by your game scheduler)
        const resultData = await gameLogicService.getLastResult(gameType, duration);
        
        if (resultData.success) {
            // Broadcast the result
            io.to(roomId).emit('periodResult', {
                gameType,
                duration,
                periodId,
                result: resultData.result.result,
                verification: resultData.result.verification,
                timestamp: new Date().toISOString()
            });
            
            console.log(`📢 Broadcasted result for ${gameType} ${duration}s - ${periodId}`);
        }

        // Wait a moment, then start next period
        setTimeout(async () => {
            const nextPeriod = await periodService.getCurrentPeriod(gameType, duration);
            if (nextPeriod) {
                io.to(roomId).emit('newPeriodStarted', {
                    gameType,
                    duration,
                    periodId: nextPeriod.periodId,
                    timeRemaining: Math.floor((new Date(nextPeriod.endTime) - new Date()) / 1000),
                    endTime: nextPeriod.endTime,
                    message: 'New period started - betting is open!'
                });
            }
        }, 2000);

    } catch (error) {
        console.error(`❌ Error handling period end for ${gameType} ${duration}s:`, error);
    }
};

/**
 * Send current game state to a newly connected client
 */
const sendCurrentGameState = async (socket, gameType, duration) => {
    try {
        // Get current period
        const currentPeriod = await periodService.getCurrentPeriod(gameType, duration);
        
        if (!currentPeriod) {
            socket.emit('noActivePeriod', {
                gameType,
                duration,
                message: 'No active period found'
            });
            return;
        }

        const now = moment().tz('Asia/Kolkata');
        const endTime = moment(currentPeriod.endTime).tz('Asia/Kolkata');
        const timeRemaining = Math.max(0, endTime.diff(now, 'seconds'));

        // Send current period info
        socket.emit('periodInfo', {
            gameType,
            duration,
            periodId: currentPeriod.periodId,
            timeRemaining,
            endTime: endTime.toISOString(),
            bettingOpen: timeRemaining > 5,
            timestamp: now.toISOString()
        });

        // Send recent results
        const recentResults = await gameLogicService.getGameHistory(gameType, duration, 5, 0);
        if (recentResults.success) {
            socket.emit('recentResults', {
                gameType,
                duration,
                results: recentResults.data.results
            });
        }

        // Send betting stats if betting is open
        if (timeRemaining > 5) {
            await sendBettingStats(socket, gameType, duration, currentPeriod.periodId);
        }

        console.log(`📤 Sent current game state to user for ${gameType} ${duration}s`);

    } catch (error) {
        console.error('❌ Error sending current game state:', error);
    }
};

/**
 * Send betting statistics to a specific socket
 */
const sendBettingStats = async (socket, gameType, duration, periodId) => {
    try {
        const status = await gameLogicService.getEnhancedPeriodStatus(gameType, duration, periodId);
        
        if (status.success) {
            socket.emit('bettingStats', {
                gameType,
                duration,
                periodId,
                totalBetAmount: status.data.totalBetAmount,
                uniqueUsers: status.data.uniqueUserCount,
                bettingOpen: status.data.isBettingOpen,
                timeRemaining: status.data.timeRemaining
            });
        }
    } catch (error) {
        console.error('❌ Error sending betting stats:', error);
    }
};

/**
 * Broadcast betting statistics to all users in a room
 */
const broadcastBettingStats = async (gameType, duration, periodId) => {
    try {
        const roomId = `${gameType}_${duration}`;
        const status = await gameLogicService.getEnhancedPeriodStatus(gameType, duration, periodId);
        
        if (status.success) {
            io.to(roomId).emit('bettingStats', {
                gameType,
                duration,
                periodId,
                totalBetAmount: status.data.totalBetAmount,
                uniqueUsers: status.data.uniqueUserCount,
                bettingOpen: status.data.isBettingOpen,
                timeRemaining: status.data.timeRemaining,
                timestamp: new Date().toISOString()
            });
        }
    } catch (error) {
        console.error('❌ Error broadcasting betting stats:', error);
    }
};

/**
 * Broadcast to specific game room
 */
const broadcastToGame = async (gameType, data) => {
    try {
        if (!io) {
            console.warn('⚠️ WebSocket not initialized, skipping broadcast');
            return;
        }

        // If data contains duration, broadcast to specific room
        if (data.duration) {
            const roomId = `${gameType}_${data.duration}`;
            io.to(roomId).emit('gameUpdate', data);
            console.log(`📢 Broadcasted to room ${roomId}:`, data.type || 'update');
        } else {
            // Broadcast to all rooms of this game type
            Object.values(GAME_CONFIGS[gameType] || []).forEach(duration => {
                const roomId = `${gameType}_${duration}`;
                io.to(roomId).emit('gameUpdate', data);
            });
            console.log(`📢 Broadcasted to all ${gameType} rooms:`, data.type || 'update');
        }
    } catch (error) {
        console.error('❌ Error broadcasting to game:', error);
    }
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
};

module.exports = {
    initializeWebSocket,
    broadcastToGame,
    getIo,
    startGameTickSystem,
    stopGameTicks
};