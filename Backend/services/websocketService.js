// Backend/services/websocketService.js - FIXED WITH TIMELINE SUPPORT

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

// Period cache to track current periods (with timeline support)
const currentPeriods = new Map();

// User bet tracking for personalized results
const userBets = new Map(); // userId -> { gameType, duration, timeline, periodId, betData }

// Constants
const GAME_CONFIGS = {
    wingo: {
        durations: [30, 60, 180, 300],
        timelines: ['default', 'timeline2', 'timeline3', 'timeline4']
    },
    trx_wix: {
        durations: [30, 60, 180, 300], 
        timelines: ['default', 'timeline2', 'timeline3', 'timeline4']
    },
    fiveD: {
        durations: [60, 180, 300, 600],
        timelines: ['default', 'timeline2', 'timeline3', 'timeline4']
    },
    k3: {
        durations: [60, 180, 300, 600],
        timelines: ['default', 'timeline2', 'timeline3', 'timeline4']
    }
};

/**
 * Calculate real-time period information with timeline support
 */
const calculateRealTimePeriod = (gameType, duration, timeline = 'default', now = new Date()) => {
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
        
        // Generate period ID with timeline
        const dateStr = startOfPeriods.format('YYYYMMDD');
        const periodId = `${dateStr}${currentPeriodNumber.toString().padStart(9, '0')}`;
        
        return {
            periodId,
            gameType,
            duration,
            timeline,
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
 * Get cached period or calculate new one
 */
const getCachedPeriod = (gameType, duration, timeline = 'default') => {
    const key = `${gameType}_${duration}_${timeline}`;
    let cached = currentPeriods.get(key);
    
    if (!cached) {
        cached = calculateRealTimePeriod(gameType, duration, timeline);
        currentPeriods.set(key, cached);
    }
    
    // Recalculate time remaining
    const now = new Date();
    const timeRemaining = Math.max(0, (cached.endTime - now) / 1000);
    
    return {
        ...cached,
        timeRemaining,
        active: timeRemaining > 0,
        bettingOpen: timeRemaining > 5
    };
};

/**
 * Initialize the WebSocket server
 */
const initializeWebSocket = (server, autoStartTicks = true) => {
    console.log('🔄 Initializing WebSocket server with timeline support...');
    
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
            const { authenticateWebSocket } = require('../middleware/websocketAuth');
            await authenticateWebSocket(socket, next);
        } catch (authError) {
            console.error('❌ Auth middleware error:', authError);
            next(new Error(`AUTH_ERROR: ${authError.message}`));
        }
    });

    // Connection handling
    io.on('connection', (socket) => {
        const userId = socket.user.userId || socket.user.id;
        console.log('🔗 New WebSocket connection:', socket.id, 'User:', userId);

        // Send connection confirmation
        socket.emit('connected', {
            message: 'Connected to game server',
            timestamp: new Date().toISOString(),
            gameTicksActive: gameTicksStarted,
            userId: userId
        });

        // Handle join game with timeline
        socket.on('joinGame', async (data) => {
            try {
                console.log('🎮 Join game request:', data);
                
                const { gameType, duration, timeline = 'default' } = data;
                
                // Validate game type and duration
                if (!GAME_CONFIGS[gameType] || !GAME_CONFIGS[gameType].durations.includes(duration)) {
                    socket.emit('error', { message: 'Invalid game type or duration' });
                    return;
                }
                
                // Validate timeline
                if (!GAME_CONFIGS[gameType].timelines.includes(timeline)) {
                    socket.emit('error', { message: 'Invalid timeline' });
                    return;
                }

                const roomId = `${gameType}_${duration}_${timeline}`;
                
                // Join the specific timeline room
                socket.join(roomId);
                console.log(`✅ User ${userId} joined room: ${roomId}`);

                // Store user's current game context
                socket.currentGame = { gameType, duration, timeline };

                // Confirm join
                socket.emit('joinedGame', {
                    gameType,
                    duration,
                    timeline,
                    roomId,
                    message: `Successfully joined ${gameType} ${duration}s ${timeline}`,
                    gameTicksActive: gameTicksStarted,
                    timestamp: new Date().toISOString()
                });

                // Send current game state for this timeline
                await sendCurrentGameState(socket, gameType, duration, timeline);

            } catch (error) {
                console.error('❌ Error joining game:', error);
                socket.emit('error', { message: 'Failed to join game' });
            }
        });

        // Handle leave game
        socket.on('leaveGame', (data) => {
            try {
                const { gameType, duration, timeline = 'default' } = data;
                const roomId = `${gameType}_${duration}_${timeline}`;
                
                socket.leave(roomId);
                console.log(`👋 User ${userId} left room: ${roomId}`);
                
                // Clear user's game context
                delete socket.currentGame;
                
                socket.emit('leftGame', { gameType, duration, timeline });
            } catch (error) {
                console.error('❌ Error leaving game:', error);
            }
        });

        // Handle betting with enhanced validation
        socket.on('placeBet', async (data) => {
            try {
                console.log('💰 Bet placement request:', data);
                
                if (!loadServices()) {
                    socket.emit('betError', { message: 'Game services not ready' });
                    return;
                }

                const { gameType, duration, timeline = 'default', betAmount, periodId } = data;
                
                // Enhanced validation
                if (!gameType || !duration || !betAmount || !periodId) {
                    socket.emit('betError', { message: 'Missing required bet data' });
                    return;
                }

                // Validate user is in the correct room
                if (!socket.currentGame || 
                    socket.currentGame.gameType !== gameType || 
                    socket.currentGame.duration !== duration ||
                    socket.currentGame.timeline !== timeline) {
                    socket.emit('betError', { message: 'You must join the game room first' });
                    return;
                }

                // Check if betting is still open for this period
                const currentPeriod = getCachedPeriod(gameType, duration, timeline);
                if (!currentPeriod.bettingOpen || currentPeriod.periodId !== periodId) {
                    socket.emit('betError', { message: 'Betting is closed for this period' });
                    return;
                }

                // Process bet with enhanced data
                const betData = {
                    userId,
                    gameType,
                    duration,
                    timeline,
                    periodId,
                    ...data
                };

                const result = await gameLogicService.processBet(betData);

                if (result.success) {
                    // Store user bet for personalized results
                    userBets.set(userId, {
                        gameType,
                        duration,
                        timeline,
                        periodId,
                        betData: result.data,
                        socketId: socket.id
                    });

                    socket.emit('betPlaced', {
                        ...result.data,
                        timeline,
                        message: `Bet placed successfully in ${gameType} ${duration}s ${timeline}`
                    });
                    
                    // Broadcast bet update to specific timeline room only
                    const roomId = `${gameType}_${duration}_${timeline}`;
                    socket.to(roomId).emit('betUpdate', {
                        gameType,
                        duration,
                        timeline,
                        periodId,
                        timestamp: new Date().toISOString()
                    });

                    console.log(`✅ Bet placed by user ${userId} in ${roomId}: ${betAmount}`);
                } else {
                    console.log(`❌ Bet failed for user ${userId}: ${result.message}`);
                    socket.emit('betError', { 
                        message: result.message,
                        code: result.code || 'BET_FAILED'
                    });
                }
            } catch (error) {
                console.error('❌ Error processing bet:', error);
                socket.emit('betError', { message: 'Failed to process bet' });
            }
        });

        // Handle disconnect
        socket.on('disconnect', () => {
            console.log('🔌 WebSocket disconnected:', socket.id);
            // Clean up user bet tracking
            userBets.delete(userId);
        });
    });

    // Start game tick system
    if (autoStartTicks) {
        setTimeout(() => {
            startGameTickSystem();
        }, 1000);
    }
    
    console.log('✅ WebSocket server initialized with timeline support');
    return io;
};

/**
 * Start the game tick system for all games and timelines
 */
const startGameTickSystem = async () => {
    try {
        console.log('🕐 Starting game tick system with timeline support...');
        
        // Load services
        const servicesReady = loadServices();
        if (!servicesReady) {
            console.warn('⚠️ Services not ready, retrying in 3 seconds...');
            setTimeout(startGameTickSystem, 3000);
            return;
        }
        
        // Initialize periods for all games and timelines
        Object.entries(GAME_CONFIGS).forEach(([gameType, config]) => {
            config.durations.forEach(duration => {
                config.timelines.forEach(timeline => {
                    const key = `${gameType}_${duration}_${timeline}`;
                    const currentPeriod = calculateRealTimePeriod(gameType, duration, timeline);
                    currentPeriods.set(key, currentPeriod);
                    
                    // Initialize period in database
                    if (periodService && periodService.initializePeriod) {
                        periodService.initializePeriod(gameType, duration, currentPeriod.periodId, timeline)
                            .catch(err => console.warn(`Failed to initialize period ${currentPeriod.periodId} for ${timeline}:`, err.message));
                    }
                });
            });
        });
        
        // Start game ticks for all games and timelines
        Object.entries(GAME_CONFIGS).forEach(([gameType, config]) => {
            config.durations.forEach(duration => {
                config.timelines.forEach(timeline => {
                    startGameTicks(gameType, duration, timeline);
                });
            });
        });
        
        gameTicksStarted = true;
        console.log('✅ Game tick system started for all games and timelines');
        
        // Broadcast to all connected clients
        if (io) {
            io.emit('gameTicksStarted', {
                message: 'Game tick system is now active',
                timestamp: new Date().toISOString()
            });
        }
        
    } catch (error) {
        console.error('❌ Error starting game tick system:', error);
        setTimeout(startGameTickSystem, 5000);
    }
};

/**
 * Start game ticks for a specific game, duration, and timeline
 */
const startGameTicks = (gameType, duration, timeline) => {
    const key = `${gameType}_${duration}_${timeline}`;
    
    // Clear existing interval if any
    if (gameIntervals.has(key)) {
        clearInterval(gameIntervals.get(key));
    }
    
    // Start new interval - tick every second
    const intervalId = setInterval(async () => {
        await gameTick(gameType, duration, timeline);
    }, 1000);
    
    gameIntervals.set(key, intervalId);
    console.log(`⏰ Started game ticks for ${gameType} ${duration}s ${timeline}`);
};

/**
 * Main game tick function with timeline support
 */
const gameTick = async (gameType, duration, timeline) => {
    try {
        if (!isConnected()) {
            return;
        }

        const now = new Date();
        const key = `${gameType}_${duration}_${timeline}`;
        
        // Get current period for this timeline
        const currentPeriod = getCachedPeriod(gameType, duration, timeline);
        const cachedPeriod = currentPeriods.get(key);
        
        // Check if we need to start a new period
        if (!cachedPeriod || cachedPeriod.periodId !== currentPeriod.periodId) {
            console.log(`🔄 Period change detected for ${gameType} ${duration}s ${timeline}: ${cachedPeriod?.periodId} -> ${currentPeriod.periodId}`);
            
            // If there was a previous period, process its results
            if (cachedPeriod && cachedPeriod.periodId !== currentPeriod.periodId) {
                await handlePeriodEnd(gameType, duration, timeline, cachedPeriod.periodId);
            }
            
            // Update cached period
            currentPeriods.set(key, currentPeriod);
            
            // Broadcast new period start to specific timeline room
            const roomId = `${gameType}_${duration}_${timeline}`;
            io.to(roomId).emit('periodStart', {
                gameType,
                duration,
                timeline,
                periodId: currentPeriod.periodId,
                timeRemaining: Math.floor(currentPeriod.timeRemaining),
                endTime: currentPeriod.endTime.toISOString(),
                message: `New period started - betting is open! (${timeline})`
            });
        }
        
        const { periodId, timeRemaining, endTime, bettingOpen } = currentPeriod;
        const roomId = `${gameType}_${duration}_${timeline}`;
        
        // Broadcast time update to specific timeline room only
        io.to(roomId).emit('timeUpdate', {
            gameType,
            duration,
            timeline,
            periodId,
            timeRemaining: Math.floor(timeRemaining),
            endTime: endTime.toISOString(),
            bettingOpen,
            timestamp: now.toISOString()
        });

        // Handle betting close
        if (timeRemaining <= 5 && timeRemaining > 0 && bettingOpen) {
            io.to(roomId).emit('bettingClosed', {
                gameType,
                duration,
                timeline,
                periodId,
                message: `Betting is now closed for this period (${timeline})`
            });
        }

    } catch (error) {
        const errorKey = `${gameType}_${duration}_${timeline}_error`;
        const lastLogTime = global[errorKey] || 0;
        const now = Date.now();
        
        if (now - lastLogTime > 60000) {
            console.error(`❌ Error in game tick for ${gameType} ${duration}s ${timeline}:`, error.message);
            global[errorKey] = now;
        }
    }
};

/**
 * Handle period end with personalized results
 */
const handlePeriodEnd = async (gameType, duration, timeline, periodId) => {
    try {
        console.log(`🏁 Period ended: ${gameType} ${duration}s ${timeline} - ${periodId}`);
        
        if (!loadServices()) {
            console.error('❌ Services not ready for period end processing');
            return;
        }
        
        const roomId = `${gameType}_${duration}_${timeline}`;
        
        // Process the game results for this specific timeline
        try {
            console.log(`🎲 Processing results for ${periodId} in ${timeline}...`);
            const gameResult = await gameLogicService.processGameResults(gameType, duration, periodId, timeline);
            
            if (gameResult.success) {
                // Broadcast general result to timeline room
                const resultData = {
                    gameType,
                    duration,
                    timeline,
                    periodId,
                    result: gameResult.gameResult,
                    winners: gameResult.winners?.length || 0,
                    timestamp: new Date().toISOString()
                };
                
                io.to(roomId).emit('periodResult', resultData);
                
                // Send personalized results to users who bet in this period/timeline
                await sendPersonalizedResults(gameType, duration, timeline, periodId, gameResult);
                
                console.log(`📢 Broadcasted result for ${gameType} ${duration}s ${timeline} - ${periodId}`);
                
            } else {
                console.error(`❌ Failed to process game results for ${periodId} ${timeline}:`, gameResult.message);
                
                io.to(roomId).emit('periodError', {
                    gameType,
                    duration,
                    timeline,
                    periodId,
                    message: 'Failed to process results',
                    timestamp: new Date().toISOString()
                });
            }
        } catch (processError) {
            console.error(`❌ Error processing game results for ${periodId} ${timeline}:`, processError.message);
        }

    } catch (error) {
        console.error(`❌ Error handling period end for ${gameType} ${duration}s ${timeline}:`, error);
    }
};

/**
 * Send personalized win/loss results to users
 */
const sendPersonalizedResults = async (gameType, duration, timeline, periodId, gameResult) => {
    try {
        // Find users who bet in this specific period/timeline
        for (const [userId, userBet] of userBets.entries()) {
            if (userBet.gameType === gameType && 
                userBet.duration === duration && 
                userBet.timeline === timeline && 
                userBet.periodId === periodId) {
                
                // Find the socket for this user
                const userSocket = io.sockets.sockets.get(userBet.socketId);
                
                if (userSocket) {
                    // Determine if user won or lost
                    const userWon = gameResult.winners?.some(winner => winner.userId === userId) || false;
                    
                    // Send personalized result
                    userSocket.emit('personalResult', {
                        gameType,
                        duration,
                        timeline,
                        periodId,
                        result: gameResult.gameResult,
                        userResult: userWon ? 'WON' : 'LOST',
                        betData: userBet.betData,
                        winAmount: userWon ? (gameResult.winners?.find(w => w.userId === userId)?.winnings || 0) : 0,
                        timestamp: new Date().toISOString()
                    });
                    
                    console.log(`📤 Sent personalized result to user ${userId}: ${userWon ? 'WON' : 'LOST'}`);
                }
                
                // Remove user bet from tracking
                userBets.delete(userId);
            }
        }
    } catch (error) {
        console.error('❌ Error sending personalized results:', error);
    }
};

/**
 * Send current game state for specific timeline
 */
const sendCurrentGameState = async (socket, gameType, duration, timeline) => {
    try {
        const currentPeriod = getCachedPeriod(gameType, duration, timeline);
        
        // Send current period info for this timeline
        socket.emit('periodInfo', {
            gameType,
            duration,
            timeline,
            periodId: currentPeriod.periodId,
            timeRemaining: Math.floor(currentPeriod.timeRemaining),
            endTime: currentPeriod.endTime.toISOString(),
            bettingOpen: currentPeriod.bettingOpen,
            timestamp: new Date().toISOString()
        });

        // Send recent results for this timeline if available
        if (loadServices()) {
            try {
                const recentResults = await gameLogicService.getGameHistory(gameType, duration, 5, 0, timeline);
                if (recentResults && recentResults.success) {
                    socket.emit('recentResults', {
                        gameType,
                        duration,
                        timeline,
                        results: recentResults.data.results
                    });
                }
            } catch (historyError) {
                console.warn('⚠️ Could not get recent results:', historyError.message);
            }
        }

        console.log(`📤 Sent current game state to user for ${gameType} ${duration}s ${timeline} - Period: ${currentPeriod.periodId}, Time: ${Math.floor(currentPeriod.timeRemaining)}s`);

    } catch (error) {
        console.error('❌ Error sending current game state:', error);
        socket.emit('error', { 
            message: 'Failed to get current game state',
            gameType,
            duration,
            timeline
        });
    }
};

/**
 * Get Socket.IO instance
 */
const getIo = () => io;

/**
 * Stop all game ticks
 */
const stopGameTicks = () => {
    gameIntervals.forEach((intervalId, key) => {
        clearInterval(intervalId);
        console.log(`⏹️ Stopped game ticks for ${key}`);
    });
    gameIntervals.clear();
    currentPeriods.clear();
    userBets.clear();
    gameTicksStarted = false;
};

/**
 * Verify that game ticks are running properly
 * @returns {Object} Status of game ticks
 */
const verifyGameTicks = () => {
    try {
        const status = {
            success: true,
            gameTicksActive: gameTicksStarted,
            activeGames: [],
            timestamp: new Date().toISOString()
        };

        // Check each game configuration
        Object.entries(GAME_CONFIGS).forEach(([gameType, config]) => {
            config.durations.forEach(duration => {
                config.timelines.forEach(timeline => {
                    const key = `${gameType}_${duration}_${timeline}`;
                    const intervalId = gameIntervals.get(key);
                    const period = currentPeriods.get(key);
                    
                    status.activeGames.push({
                        gameType,
                        duration,
                        timeline,
                        hasInterval: !!intervalId,
                        hasPeriod: !!period,
                        periodId: period?.periodId,
                        timeRemaining: period?.timeRemaining
                    });
                });
            });
        });

        return status;
    } catch (error) {
        console.error('Error verifying game ticks:', error);
        return {
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
};

module.exports = {
    initializeWebSocket,
    startGameTickSystem,
    stopGameTicks,
    getIo,
    getCachedPeriod,
    verifyGameTicks
};