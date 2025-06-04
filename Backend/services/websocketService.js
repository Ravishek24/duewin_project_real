// Backend/services/websocketService.js - FIXED VERSION WITH ALL ORIGINAL FEATURES

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/constants');
const { redis, isConnected } = require('../config/redisConfig');
const { logger } = require('../utils/logger');
const moment = require('moment-timezone');

// Import your services (lazy loaded to avoid circular dependencies)
let periodService;
let gameLogicService;

// Socket.io server instance
let io;

// Game tick intervals storage
const gameIntervals = new Map();
let gameTicksStarted = false;

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

    // Authentication middleware - ENHANCED
    io.use(async (socket, next) => {
        try {
            console.log('🔍 WebSocket Auth: Attempting authentication...');
            console.log('🔍 Handshake auth:', socket.handshake.auth);
            console.log('🔍 Handshake query:', socket.handshake.query);
            console.log('🔍 Handshake headers:', socket.handshake.headers);
            
            // Enhanced authentication
            const { authenticateWebSocket } = require('../middleware/websocketAuth');
            await authenticateWebSocket(socket, next);
            
        } catch (authError) {
            console.error('❌ Auth middleware error:', authError);
            // Provide specific error message to client
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

                // Send current game state immediately AFTER join confirmation
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

        // Handle ping/pong for connection testing
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
                
                // Ensure game logic service is loaded
                if (!gameLogicService) {
                    gameLogicService = require('./gameLogicService');
                }
                
                // Process bet using your game logic service
                const result = await gameLogicService.processBet({
                    userId: socket.user.userId || socket.user.id,
                    ...data
                });

                if (result.success) {
                    socket.emit('betPlaced', result.data);
                    
                    // Broadcast bet update to room (for admins only)
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
        
        // Load services if not already loaded
        if (!periodService) {
            try {
                periodService = require('./periodService');
            } catch (e) {
                console.warn('⚠️ Period service not available yet');
            }
        }
        if (!gameLogicService) {
            try {
                gameLogicService = require('./gameLogicService');
            } catch (e) {
                console.warn('⚠️ Game logic service not available yet');
            }
        }
        
        // Wait for services to be ready
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Start game ticks for all configured games
        Object.entries(GAME_CONFIGS).forEach(([gameType, durations]) => {
            durations.forEach(duration => {
                startGameTicks(gameType, duration);
            });
        });
        
        gameTicksStarted = true;
        console.log('✅ Game tick system started for all games');
        
        // Broadcast to all connected clients that game ticks are now active
        if (io) {
            io.emit('gameTicksStarted', {
                message: 'Game tick system is now active',
                timestamp: new Date().toISOString()
            });
        }
        
    } catch (error) {
        console.error('❌ Error starting game tick system:', error);
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
 * Main game tick function - ENHANCED with original functionality
 */
const gameTick = async (gameType, duration) => {
    try {
        // Skip if Redis not connected
        if (!isConnected()) {
            return;
        }

        const now = new Date();
        
        // Generate current period ID using the original method
        const currentPeriodId = generatePeriodId(gameType, duration, now);
        
        // Calculate end time using the original method
        const endTime = calculatePeriodEndTime(currentPeriodId, duration);
        
        // Calculate time remaining
        const timeRemaining = Math.max(0, Math.floor((endTime - now) / 1000));
        
        const roomId = `${gameType}_${duration}`;
        
        // Broadcast time update every second (for all users)
        io.to(roomId).emit('timeUpdate', {
            gameType,
            duration,
            periodId: currentPeriodId,
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
                periodId: currentPeriodId,
                message: 'Betting is now closed for this period'
            });
        } else if (timeRemaining === 0) {
            // Period ended - process results
            await handlePeriodEnd(gameType, duration, currentPeriodId, roomId);
        } else if (timeRemaining % 10 === 0 && timeRemaining > 5) {
            // Every 10 seconds - send betting updates (admin only)
            await broadcastBettingStats(gameType, duration, currentPeriodId);
        }

        // For development: log every 15 seconds
        if (timeRemaining % 15 === 0) {
            console.log(`Game tick: ${gameType}, ${duration}s, Period: ${currentPeriodId}, Time: ${timeRemaining}s`);
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
 * Handle period end and result processing - ENHANCED
 */
const handlePeriodEnd = async (gameType, duration, periodId, roomId) => {
    try {
        console.log(`🏁 Period ended: ${gameType} ${duration}s - ${periodId}`);
        
        const durationKey = duration === 30 ? '30s' : 
                           duration === 60 ? '1m' : 
                           duration === 180 ? '3m' : 
                           duration === 300 ? '5m' : '10m';
        
        // Check for an overridden result first
        const overrideKey = `${gameType}:${durationKey}:${periodId}:result:override`;
        const overrideResult = await redis.get(overrideKey);
        
        let result;
        if (overrideResult) {
            result = JSON.parse(overrideResult);
        } else {
            // Get the result from Redis
            const resultKey = `${gameType}:${durationKey}:${periodId}:result`;
            const resultStr = await redis.get(resultKey);
            result = resultStr ? JSON.parse(resultStr) : null;
        }
        
        // Broadcast result to all users in the room
        if (result) {
            io.to(roomId).emit('periodResult', {
                gameType,
                duration,
                periodId,
                result,
                timestamp: new Date().toISOString()
            });
            
            console.log(`📢 Broadcasted result for ${gameType} ${duration}s - ${periodId}`);
        }

        // Wait a moment, then broadcast next period start
        setTimeout(async () => {
            const nextPeriodId = getNextPeriodId(periodId);
            const nextEndTime = new Date(Date.now() + duration * 1000);
            
            io.to(roomId).emit('periodStart', {
                gameType,
                duration,
                periodId: nextPeriodId,
                timeRemaining: duration,
                endTime: nextEndTime.toISOString(),
                message: 'New period started - betting is open!'
            });
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
        // Skip if services not ready
        if (!periodService && !gameLogicService) {
            socket.emit('serviceNotReady', {
                gameType,
                duration,
                message: 'Game services are still initializing, please wait...'
            });
            return;
        }
        
        const now = new Date();
        const currentPeriodId = generatePeriodId(gameType, duration, now);
        const endTime = calculatePeriodEndTime(currentPeriodId, duration);
        const timeRemaining = Math.max(0, Math.floor((endTime - now) / 1000));

        // Send current period info
        socket.emit('periodInfo', {
            gameType,
            duration,
            periodId: currentPeriodId,
            timeRemaining,
            endTime: endTime.toISOString(),
            bettingOpen: timeRemaining > 5,
            timestamp: now.toISOString()
        });

        // Send recent results if available
        try {
            if (gameLogicService) {
                const recentResults = await gameLogicService.getGameHistory(gameType, duration, 5, 0);
                if (recentResults && recentResults.success) {
                    socket.emit('recentResults', {
                        gameType,
                        duration,
                        results: recentResults.data.results
                    });
                }
            }
        } catch (historyError) {
            console.warn('⚠️ Could not get recent results:', historyError.message);
        }

        // Send betting closed status if needed
        if (timeRemaining <= 5) {
            socket.emit('bettingClosed', {
                gameType,
                duration,
                periodId: currentPeriodId
            });
        }

        console.log(`📤 Sent current game state to user for ${gameType} ${duration}s`);

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
 * Broadcast betting statistics (admin only)
 */
const broadcastBettingStats = async (gameType, duration, periodId) => {
    try {
        const durationKey = duration === 30 ? '30s' : 
                           duration === 60 ? '1m' : 
                           duration === 180 ? '3m' : 
                           duration === 300 ? '5m' : '10m';
        
        // Get basic betting stats
        const totalAmount = parseFloat(await redis.get(`${gameType}:${durationKey}:${periodId}:total`) || 0);
        const betCount = await redis.get(`${gameType}:${durationKey}:${periodId}:betCount`) || 0;
        
        // Broadcast to admin room only
        const adminRoomId = `admin_${gameType}_${duration}`;
        
        // Get detailed distribution for admins
        const distribution = await getBetDistribution(gameType, durationKey, periodId);
        
        io.to(adminRoomId).emit('bettingStats', {
            gameType,
            duration,
            periodId,
            totalAmount,
            betCount,
            distribution,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        // Reduce error noise
        const errorKey = `broadcast_stats_error_${gameType}_${duration}`;
        const lastLogTime = global[errorKey] || 0;
        const now = Date.now();
        
        if (now - lastLogTime > 60000) { // 1 minute
            console.warn('⚠️ Error broadcasting betting stats:', error.message);
            global[errorKey] = now;
        }
    }
};

/**
 * Generate period ID - ORIGINAL IMPLEMENTATION
 */
const generatePeriodId = (gameType, duration, now) => {
    try {
        const date = moment(now).tz('Asia/Kolkata');
        const dateStr = date.format('YYYYMMDD');
        
        // Calculate periods since 2 AM
        const startOfDay = date.clone().hour(2).minute(0).second(0).millisecond(0);
        const secondsSinceStart = Math.max(0, date.diff(startOfDay, 'seconds'));
        const periodNumber = Math.floor(secondsSinceStart / duration);
        
        // Format: YYYYMMDD000000000 (with 9-digit sequence)
        const sequenceStr = periodNumber.toString().padStart(9, '0');
        
        return `${dateStr}${sequenceStr}`;
    } catch (error) {
        console.error('Error generating period ID:', error);
        // Fallback
        const dateStr = moment().tz('Asia/Kolkata').format('YYYYMMDD');
        return `${dateStr}000000001`;
    }
};

/**
 * Calculate period end time - ORIGINAL IMPLEMENTATION
 */
const calculatePeriodEndTime = (periodId, duration) => {
    try {
        // Parse period ID to get date and sequence
        const dateStr = periodId.substring(0, 8);
        const sequenceStr = periodId.substring(8);

        const year = parseInt(dateStr.substring(0, 4), 10);
        const month = parseInt(dateStr.substring(4, 6), 10) - 1; // 0-indexed
        const day = parseInt(dateStr.substring(6, 8), 10);
        const sequenceNumber = parseInt(sequenceStr, 10);

        // Create start time (base time = 2 AM IST + sequence * duration)
        const baseTime = moment.tz([year, month, day, 2, 0, 0], 'Asia/Kolkata');
        const startTime = baseTime.add(sequenceNumber * duration, 'seconds');

        // Add duration to get end time
        const endTime = startTime.clone().add(duration, 'seconds');

        return endTime.toDate();
    } catch (error) {
        console.error('Error calculating period end time:', error);
        // Return current time + duration as fallback
        return new Date(Date.now() + (duration * 1000));
    }
};

/**
 * Get bet distribution (admin only) - ORIGINAL IMPLEMENTATION
 */
const getBetDistribution = async (gameType, durationKey, periodId) => {
    try {
        const totalAmount = parseFloat(await redis.get(`${gameType}:${durationKey}:${periodId}:total`) || 0);
        
        if (totalAmount === 0) {
            return {
                totalAmount: 0,
                totalBets: 0,
                uniqueBettors: 0,
                distribution: {}
            };
        }

        let distribution = {};
        
        switch (gameType) {
            case 'wingo':
            case 'trx_wix':
                distribution = await getWingoDistribution(gameType, durationKey, periodId, totalAmount);
                break;
            case 'fiveD':
                distribution = await getFiveDDistribution(durationKey, periodId, totalAmount);
                break;
            case 'k3':
                distribution = await getK3Distribution(durationKey, periodId, totalAmount);
                break;
        }

        return {
            totalAmount,
            totalBets: await redis.get(`${gameType}:${durationKey}:${periodId}:betCount`) || 0,
            uniqueBettors: await redis.get(`${gameType}:${durationKey}:${periodId}:uniqueBettors`) || 0,
            distribution
        };
    } catch (error) {
        console.error('Error getting bet distribution:', error);
        return null;
    }
};

/**
 * Get Wingo distribution (admin only) - ORIGINAL IMPLEMENTATION
 */
const getWingoDistribution = async (gameType, durationKey, periodId, totalAmount) => {
    const distribution = {
        numbers: [],
        colors: [],
        sizes: [],
        parities: []
    };

    // Get number distribution
    for (let i = 0; i < 10; i++) {
        const amount = parseFloat(await redis.get(`${gameType}:${durationKey}:${periodId}:number:${i}`) || 0);
        distribution.numbers.push({
            value: i,
            amount,
            percentage: totalAmount > 0 ? (amount / totalAmount) * 100 : 0
        });
    }

    // Get color distribution
    for (const color of ['red', 'green', 'violet', 'red_violet', 'green_violet']) {
        const amount = parseFloat(await redis.get(`${gameType}:${durationKey}:${periodId}:color:${color}`) || 0);
        distribution.colors.push({
            value: color,
            amount,
            percentage: totalAmount > 0 ? (amount / totalAmount) * 100 : 0
        });
    }

    // Get size distribution
    for (const size of ['big', 'small']) {
        const amount = parseFloat(await redis.get(`${gameType}:${durationKey}:${periodId}:size:${size}`) || 0);
        distribution.sizes.push({
            value: size,
            amount,
            percentage: totalAmount > 0 ? (amount / totalAmount) * 100 : 0
        });
    }

    // Get parity distribution
    for (const parity of ['odd', 'even']) {
        const amount = parseFloat(await redis.get(`${gameType}:${durationKey}:${periodId}:parity:${parity}`) || 0);
        distribution.parities.push({
            value: parity,
            amount,
            percentage: totalAmount > 0 ? (amount / totalAmount) * 100 : 0
        });
    }

    return distribution;
};

/**
 * Get 5D distribution (admin only) - ORIGINAL IMPLEMENTATION
 */
const getFiveDDistribution = async (durationKey, periodId, totalAmount) => {
    const distribution = {
        positions: {
            A: [], B: [], C: [], D: [], E: []
        },
        sums: [],
        sizes: [],
        parities: []
    };

    // Get position distributions
    for (const pos of ['A', 'B', 'C', 'D', 'E']) {
        for (let i = 0; i < 10; i++) {
            const amount = parseFloat(await redis.get(`fiveD:${durationKey}:${periodId}:${pos}:${i}`) || 0);
            distribution.positions[pos].push({
                value: i,
                amount,
                percentage: totalAmount > 0 ? (amount / totalAmount) * 100 : 0
            });
        }
    }

    // Get sum distribution
    for (let sum = 0; sum <= 45; sum++) {
        const amount = parseFloat(await redis.get(`fiveD:${durationKey}:${periodId}:sum:${sum}`) || 0);
        distribution.sums.push({
            value: sum,
            amount,
            percentage: totalAmount > 0 ? (amount / totalAmount) * 100 : 0
        });
    }

    // Get size and parity distributions
    for (const size of ['big', 'small']) {
        const amount = parseFloat(await redis.get(`fiveD:${durationKey}:${periodId}:size:${size}`) || 0);
        distribution.sizes.push({
            value: size,
            amount,
            percentage: totalAmount > 0 ? (amount / totalAmount) * 100 : 0
        });
    }

    for (const parity of ['odd', 'even']) {
        const amount = parseFloat(await redis.get(`fiveD:${durationKey}:${periodId}:parity:${parity}`) || 0);
        distribution.parities.push({
            value: parity,
            amount,
            percentage: totalAmount > 0 ? (amount / totalAmount) * 100 : 0
        });
    }

    return distribution;
};

/**
 * Get K3 distribution (admin only) - ORIGINAL IMPLEMENTATION
 */
const getK3Distribution = async (durationKey, periodId, totalAmount) => {
    const distribution = {
        sums: [],
        categories: {
            size: [],
            parity: []
        },
        matching: {
            triple_exact: [],
            triple_any: [],
            pair_any: [],
            pair_specific: []
        },
        patterns: {
            all_different: [],
            straight: [],
            two_different: []
        }
    };

    // Get sum distribution
    for (let sum = 3; sum <= 18; sum++) {
        const amount = parseFloat(await redis.get(`k3:${durationKey}:${periodId}:sum:${sum}`) || 0);
        distribution.sums.push({
            value: sum,
            amount,
            percentage: totalAmount > 0 ? (amount / totalAmount) * 100 : 0
        });
    }

    // Get category distributions
    for (const size of ['big', 'small']) {
        const amount = parseFloat(await redis.get(`k3:${durationKey}:${periodId}:size:${size}`) || 0);
        distribution.categories.size.push({
            value: size,
            amount,
            percentage: totalAmount > 0 ? (amount / totalAmount) * 100 : 0
        });
    }

    for (const parity of ['odd', 'even']) {
        const amount = parseFloat(await redis.get(`k3:${durationKey}:${periodId}:parity:${parity}`) || 0);
        distribution.categories.parity.push({
            value: parity,
            amount,
            percentage: totalAmount > 0 ? (amount / totalAmount) * 100 : 0
        });
    }

    return distribution;
};

/**
 * Get next period ID - ORIGINAL IMPLEMENTATION
 */
const getNextPeriodId = (currentPeriodId) => {
    try {
        // Extract the numerical part of the period ID (last 9 digits)
        const dateStr = currentPeriodId.substring(0, 8);
        const sequenceStr = currentPeriodId.substring(8);
        const periodNumber = parseInt(sequenceStr, 10);
        
        // Increment period number
        const nextPeriodNumber = periodNumber + 1;
        
        // Format with leading zeros (9 digits)
        const nextSequenceStr = nextPeriodNumber.toString().padStart(9, '0');
        
        return `${dateStr}${nextSequenceStr}`;
    } catch (error) {
        console.error('Error getting next period ID:', error);
        return currentPeriodId;
    }
};

/**
 * Get previous period ID - ORIGINAL IMPLEMENTATION
 */
const getPreviousPeriodId = (currentPeriodId) => {
    try {
        // Extract the numerical part of the period ID (last 9 digits)
        const dateStr = currentPeriodId.substring(0, 8);
        const sequenceStr = currentPeriodId.substring(8);
        const periodNumber = parseInt(sequenceStr, 10);
        
        // Decrement period number
        const previousPeriodNumber = Math.max(0, periodNumber - 1);
        
        // Format with leading zeros (9 digits)
        const prevSequenceStr = previousPeriodNumber.toString().padStart(9, '0');
        
        return `${dateStr}${prevSequenceStr}`;
    } catch (error) {
        console.error('Error getting previous period ID:', error);
        return currentPeriodId;
    }
};

/**
 * Broadcast to specific game room - ENHANCED
 */
const broadcastToGame = async (gameType, durationOrData, event, data) => {
    try {
        if (!io) {
            console.warn('⚠️ WebSocket not initialized, skipping broadcast');
            return;
        }

        // Handle both function signatures
        if (typeof durationOrData === 'number') {
            // Original signature: (gameType, duration, event, data)
            const roomId = `${gameType}_${durationOrData}`;
            io.to(roomId).emit(event, data);
            console.log(`📢 Broadcasted ${event} to ${roomId}`);
        } else {
            // New signature: (gameType, data)
            // Broadcast to all durations of this game type
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
 * Broadcast an event to all connected clients - ORIGINAL
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
 * Join a game channel - ORIGINAL
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
 * Leave a game channel - ORIGINAL
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
    
    if (activeIntervals === expectedIntervals && gameTicksStarted) {
        console.log('✅ Game tick system is working correctly');
    } else {
        console.warn('⚠️ Game tick system may have issues');
    }
    
    return {
        active: activeIntervals,
        expected: expectedIntervals,
        started: gameTicksStarted,
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
    gameTicksStarted = false;
};

/**
 * WebSocket Service Class - ORIGINAL IMPLEMENTATION
 */
class WebSocketService {
    constructor(server) {
        this.wss = new WebSocket.Server({ server });
        this.clients = new Map();
        this.setupWebSocket();
    }

    setupWebSocket() {
        this.wss.on('connection', async (socket, req) => {
            try {
                // Get token from query string
                const url = new URL(req.url, 'http://localhost');
                const token = url.searchParams.get('token');
                
                if (!token) {
                    socket.close(1008, 'No token provided');
                    return;
                }

                // Verify token
                const decoded = jwt.verify(token, JWT_SECRET);
                const userId = decoded.userId || decoded.id;
                
                console.log('WebSocket token decoded:', decoded);

                // Get user (if User model is available)
                try {
                    const User = require('../models/User');
                    const user = await User.findByPk(userId);
                    if (!user) {
                        console.error(`WebSocket: User not found for ID ${userId}`);
                        socket.close(1008, 'User not found');
                        return;
                    }

                    // Check if user is active
                    if (!user.is_active) {
                        socket.close(1008, 'Account is deactivated');
                        return;
                    }
                } catch (userError) {
                    console.warn('⚠️ User model not available, skipping user validation');
                }

                // Store client connection
                this.clients.set(userId, socket);

                // Send welcome message
                socket.send(JSON.stringify({
                    type: 'connection',
                    message: 'Connected successfully',
                    userId: userId,
                    timestamp: new Date().toISOString()
                }));

                // Handle messages
                socket.on('message', async (message) => {
                    try {
                        const data = JSON.parse(message);
                        
                        console.log('WebSocket message received:', data.type);

                        // Handle different message types
                        switch (data.type) {
                            case 'ping':
                                socket.send(JSON.stringify({
                                    type: 'pong',
                                    timestamp: Date.now()
                                }));
                                break;
                            case 'joinGame':
                                // Handle join game via WebSocket
                                const { gameType, duration } = data;
                                socket.send(JSON.stringify({
                                    type: 'joinedGame',
                                    gameType,
                                    duration,
                                    message: `Joined ${gameType} ${duration}s game`
                                }));
                                break;
                            default:
                                console.log('Unknown WebSocket message type:', data.type);
                        }
                    } catch (error) {
                        console.error('Error handling WebSocket message:', error);
                        socket.send(JSON.stringify({
                            type: 'error',
                            message: 'Invalid message format'
                        }));
                    }
                });

                // Handle disconnection
                socket.on('close', () => {
                    this.clients.delete(userId);
                    console.log(`WebSocket client disconnected: ${userId}`);
                });

            } catch (error) {
                console.error('WebSocket connection error:', error);
                if (error.name === 'JsonWebTokenError') {
                    socket.close(1008, 'Invalid token');
                } else if (error.name === 'TokenExpiredError') {
                    socket.close(1008, 'Token expired');
                } else {
                    socket.close(1011, 'Internal server error');
                }
            }
        });
    }

    // Broadcast message to all connected clients
    broadcast(message) {
        this.wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(message));
            }
        });
    }

    // Send message to specific user
    sendToUser(userId, message) {
        const client = this.clients.get(userId);
        if (client && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
        }
    }
}

module.exports = {
    initializeWebSocket,
    broadcastToGame,
    broadcastToAll,
    WebSocketService,
    joinGameChannel,
    leaveGameChannel,
    startGameTickSystem,
    stopGameTicks,
    verifyGameTicks,
    getIo
};