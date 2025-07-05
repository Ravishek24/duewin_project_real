// Backend/services/websocketService.js - ENHANCED: Added bet placement with validation

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/constants');
const redisHelper = require('../config/redis');
const redisClient = redisHelper.getClient();
const { redis: pubsubRedis, isConnected } = require('../config/redisConfig');
const { logger } = require('../utils/logger');
const moment = require('moment-timezone');
const { getSequelizeInstance } = require('../config/db');
const { initializeModels } = require('../models');
const { recordVipExperience } = require('./autoVipService');

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

/**
 * Bet limit functions for WebSocket validation
 */
const getMinBetAmount = (gameType) => {
    // Minimum bet amount is ₹1 (net amount after platform fee)
    return 1;
};

const getMaxBetAmount = (gameType) => {
    // Maximum bet amount is ₹1,00,000 (gross amount)
    return 100000;
};

const getMaxBetsPerUser = (gameType) => {
    // Maximum 50 bets per user per period
    return 50;
};

const getMaxTotalBetPerPeriod = (gameType) => {
    // Maximum total bet amount per period (same as max bet amount)
    return 100000;
};

// Import period service
const periodService = require('./periodService');

// Import game logic service for direct access
const gameLogicService = require('./gameLogicService');

// Socket.io server instance
let io = null;
let models = null;

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
        console.log('🔄 Initializing WebSocket models...');
        const sequelize = await getSequelizeInstance();
        models = await initializeModels();
        // Attach sequelize instance to models
        models.sequelize = sequelize;
        // Ensure new models are present
        if (!models.GameCombinations5D || !models.Game5DSummaryStats) {
            throw new Error('GameCombinations5D or Game5DSummaryStats model not initialized');
        }
        console.log('✅ WebSocket models initialized successfully');
        return models;
    } catch (error) {
        console.error('❌ Failed to initialize WebSocket models:', error);
        throw error;
    }
};

/**
 * NEW: WebSocket-specific bet processing that handles timing validation properly
 */
const processWebSocketBet = async (socket, data) => {
    try {
        const { gameType, duration, betType, betValue, betAmount, timeline = 'default' } = data;
        const userId = socket.user.userId || socket.user.id;

        console.log(`🎲 [WS_BET] User ${userId} placing bet:`, {
            gameType, duration, betType, betValue, betAmount, timeline
        });

        // Validate input
        if (!gameType || !duration || !betType || !betValue || !betAmount) {
            socket.emit('betError', {
                success: false,
                message: 'Missing required fields'
            });
            return { success: false, message: 'Missing required fields' };
        }

        // Validate bet amount
        if (isNaN(betAmount) || parseFloat(betAmount) <= 0) {
            socket.emit('betError', {
                success: false,
                message: 'Invalid bet amount'
            });
            return { success: false, message: 'Invalid bet amount' };
        }

        // Get current period
        const currentPeriod = await periodService.getCurrentPeriod(gameType, duration, timeline);
        if (!currentPeriod || !currentPeriod.periodId) {
            socket.emit('betError', {
                success: false,
                message: 'No active betting period'
            });
            return { success: false, message: 'No active betting period' };
        }

        // Check if betting is allowed (not in last 5 seconds)
        const now = Date.now();
        const periodEnd = currentPeriod.endTime;
        const timeRemaining = periodEnd - now;
        
        if (timeRemaining < 5000) {
            socket.emit('betError', {
                success: false,
                message: 'Betting closed for this period'
            });
            return { success: false, message: 'Betting closed for this period' };
        }

        // Validate bet placement using new structure
        const validation = await validateBetPlacement(userId, gameType, duration, currentPeriod.periodId, betAmount, timeline);
        if (!validation.valid) {
            socket.emit('betError', {
                success: false,
                message: validation.error
            });
            return { success: false, message: validation.error };
        }

        // Get odds
        const odds = calculateOddsForBet(betType, betValue);
        if (!odds) {
            socket.emit('betError', {
                success: false,
                message: 'Invalid bet type or value'
            });
            return { success: false, message: 'Invalid bet type or value' };
        }

        // Process the bet with new structure
        const betResult = await gameLogicService.processBet({
            userId,
            gameType,
            duration,
            timeline,
            periodId: currentPeriod.periodId,
            betType,
            betValue,
            betAmount,
            odds
        });

        if (betResult.success) {
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
            const roomId = getRoomId(gameType, duration, timeline);
            const totalBets = await getTotalBetsForPeriod(gameType, duration, currentPeriod.periodId, timeline);
            
            io.to(roomId).emit('totalBetsUpdate', {
                gameType,
                duration,
                periodId: currentPeriod.periodId,
                totalBets: totalBets.totalAmount,
                betCount: totalBets.betCount,
                timeline
            });

            console.log(`✅ [WS_BET] Bet placed successfully for user ${userId}`);
            return { success: true, data: betResult.data };
        } else {
            socket.emit('betError', {
                success: false,
                message: betResult.message || 'Failed to place bet',
                code: betResult.code
            });
            return { success: false, message: betResult.message || 'Failed to place bet', code: betResult.code };
        }

    } catch (error) {
        console.error('❌ [WS_BET] Error processing WebSocket bet:', error);
        socket.emit('betError', {
            success: false,
            message: 'Server error while processing bet'
        });
        return { success: false, message: 'Server error while processing bet' };
    }
};

const mapClientBetType = (clientType) => {
    const typeMapping = {
        'color': 'COLOR',
        'number': 'NUMBER',
        'size': 'SIZE',
        'parity': 'PARITY',
        'odd': 'PARITY',
        'even': 'PARITY',
        'sum': 'SUM' // Add support for sum bets (k3 game)
    };
    
    return typeMapping[String(clientType || '').toLowerCase()] || 'COLOR';
};

/**
 * NEW: Transform client bet value to server format
 */
const mapClientBetValue = (clientSelection, clientType) => {
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
    
    // Size mapping
    if (type === 'size') {
        const sizeMapping = {
            'big': 'big',
            'small': 'small'
        };
        return sizeMapping[selection] || 'small';
    }
    
    // Parity mapping
    if (type === 'parity' || type === 'odd' || type === 'even') {
        const parityMapping = {
            'odd': 'odd',
            'even': 'even'
        };
        return parityMapping[selection] || 'odd';
    }
    
    // Number mapping (direct pass-through)
    if (type === 'number') {
        return String(clientSelection);
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
const calculateOddsForBet = (clientType, clientSelection) => {
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
            return 2.0; // Big/Small odds
            
        case 'parity':
        case 'odd':
        case 'even':
            return 2.0; // Odd/Even odds
            
        case 'sum':
            return 9.0; // 1:9 odds for sum bets (k3 game)
            
        default:
            return 2.0; // Default odds
    }
};

/**
 * NEW: Transform client bet type to server format
 */
const getTotalBetsForPeriod = async (gameType, duration, periodId, timeline = 'default') => {
    try {
        const betHashKey = `bets:${gameType}:${duration}:${timeline}:${periodId}`;
        const betsData = await redisClient.hgetall(betHashKey);
        
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
        const allBets = await redisClient.hgetall(betHashKey);
        
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
const initializeWebSocket = async (server, autoStartTicks = true) => {
    try {
        console.log('🔄 Initializing WebSocket server with BET PLACEMENT - DURATION-BASED ROOMS ONLY...');
        
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
        
        // Ensure game logic models are initialized
        await ensureModelsInitialized();
        console.log('✅ Game logic models initialized');
        
        // Initialize WebSocket models
        models = await initializeWebSocketModels();
        console.log('✅ WebSocket models initialized');
        
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
                mode: 'DURATION_BASED_ROOMS_WITH_BETTING',
                supportedGames: Object.keys(GAME_CONFIGS),
                totalRooms: Object.values(GAME_CONFIGS).reduce((sum, durations) => sum + durations.length, 0),
                bettingEnabled: true
            });

            // EXISTING: Handle join game with duration-based validation only
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

                    socket.emit('joinedGame', {
                        gameType, 
                        duration, 
                        roomId,
                        message: `Joined ${gameType} ${duration}s room`,
                        timestamp: new Date().toISOString(),
                        bettingEnabled: true
                    });

                    // Send current period info from Redis (populated by game scheduler)
                    await sendCurrentPeriodFromRedis(socket, gameType, duration);

                } catch (error) {
                    console.error('❌ Error joining game:', error);
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
                    
                    console.log(`👋 User left room: ${roomId}`);
                } catch (error) {
                    console.error('❌ Error leaving game:', error);
                }
            });

            // NEW: Handle bet placement with comprehensive validation + DEBUG MODE
            socket.on('placeBet', async (betData) => {
                try {
                    const userId = socket.user.userId || socket.user.id;
                    console.log(`🎯 [WEBSOCKET_BET] Raw bet received from user ${userId}:`, JSON.stringify(betData, null, 2));
                    
                    // Transform client data format to expected format
                    const transformedBetData = {
                        gameType: betData.gameType,
                        duration: betData.duration,
                        periodId: betData.periodId,
                        timeline: betData.timeline || 'default',
                        userId,
                        
                        // Transform amount to betAmount
                        betAmount: betData.amount || betData.betAmount,
                        
                        // Transform selection and type to betType and betValue
                        betType: mapClientBetType(betData.type),
                        betValue: mapClientBetValue(betData.selection, betData.type),
                        
                        // Calculate odds based on bet type
                        odds: calculateOddsForBet(betData.type, betData.selection)
                    };
                    
                    console.log(`🔄 [WEBSOCKET_BET] Transformed bet data:`, JSON.stringify(transformedBetData, null, 2));
                    
                    // CRITICAL: Validate bet placement first
                    const validation = await validateBetPlacement(userId, transformedBetData.gameType, transformedBetData.duration, transformedBetData.periodId, transformedBetData.betAmount, transformedBetData.timeline);
                    if (!validation.valid) {
                        console.log(`❌ [WEBSOCKET_BET] Validation failed for user ${userId}:`, validation.message);
                        socket.emit('betError', { 
                            message: validation.message,
                            code: validation.code,
                            timeRemaining: validation.timeRemaining,
                            currentBalance: validation.currentBalance,
                            debug: validation.debug,
                            timestamp: new Date().toISOString()
                        });
                        return;
                    }
                    
                    // Use corrected bet amount from validation
                    const finalBetData = {
                        ...transformedBetData,
                        betAmount: validation.correctedBetAmount || transformedBetData.betAmount
                    };
                    
                    console.log(`🔍 [WEBSOCKET_BET] Final bet data for processing:`, JSON.stringify(finalBetData, null, 2));
                    console.log(`✅ [WEBSOCKET_BET] Validation passed for user ${userId}, processing bet...`);
                    
                    // Process bet using WebSocket-specific processing (bypasses timing validation)
                    const result = await processWebSocketBet(socket, finalBetData);
                    
                    if (result.success) {
                        // Success response to the betting user only
                        socket.emit('betSuccess', {
                            ...result.data,
                            message: 'Bet placed successfully!',
                            timestamp: new Date().toISOString(),
                            timeRemaining: validation.timeRemaining
                        });
                        
                        // Store user as having placed bet in this period for result notifications
                        const roomId = `${betData.gameType}_${betData.duration}`;
                        if (!socket.activeBets) {
                            socket.activeBets = new Set();
                        }
                        socket.activeBets.add(`${betData.gameType}_${betData.duration}_${betData.periodId}`);
                        
                        // Broadcast general bet activity to room (no user-specific data)
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
                            timestamp: new Date().toISOString()
                        });
                        
                        console.log(`✅ [WEBSOCKET_BET] Bet processed successfully for user ${userId}, amount: ₹${finalBetData.betAmount}`);
                        
                    } else {
                        console.log(`❌ [WEBSOCKET_BET] Bet processing failed for user ${userId}:`, result.message);
                        socket.emit('betError', { 
                            message: result.message,
                            code: result.code,
                            timestamp: new Date().toISOString()
                        });
                    }
                    
                } catch (error) {
                    console.error('❌ [WEBSOCKET_BET] Error processing bet:', error);
                    socket.emit('betError', { 
                        message: 'Failed to process bet due to server error',
                        code: 'PROCESSING_ERROR',
                        timestamp: new Date().toISOString()
                    });
                }
            });

            // NEW: Debug bet placement (bypasses game logic validation)
            socket.on('debugPlaceBet', async (betData) => {
                try {
                    const userId = socket.user.userId || socket.user.id;
                    console.log(`🚧 [DEBUG_BET] Debug bet received from user ${userId}:`, JSON.stringify(betData, null, 2));
                    
                    // Simple validation only (no game logic validation)
                    if (!betData.amount || betData.amount <= 0) {
                        socket.emit('betError', { 
                            message: 'Invalid bet amount',
                            code: 'INVALID_AMOUNT'
                        });
                        return;
                    }
                    
                    // Transform data
                    const finalBetData = {
                        gameType: betData.gameType,
                        duration: betData.duration,
                        periodId: betData.periodId,
                        timeline: 'default',
                        userId,
                        betAmount: parseFloat(betData.amount),
                        betType: mapClientBetType(betData.type),
                        betValue: mapClientBetValue(betData.selection, betData.type),
                        odds: calculateOddsForBet(betData.type, betData.selection)
                    };
                    
                    console.log(`🚧 [DEBUG_BET] Bypassing validation, processing directly:`, JSON.stringify(finalBetData, null, 2));
                    
                    // Process bet directly
                    const result = await processBet(finalBetData);
                    
                    if (result.success) {
                        socket.emit('betSuccess', {
                            ...result.data,
                            message: '🚧 DEBUG: Bet placed successfully (validation bypassed)!',
                            timestamp: new Date().toISOString()
                        });
                        
                        console.log(`🚧 [DEBUG_BET] Debug bet processed successfully for user ${userId}`);
                    } else {
                        socket.emit('betError', { 
                            message: `🚧 DEBUG: ${result.message}`,
                            code: result.code,
                            timestamp: new Date().toISOString()
                        });
                    }
                    
                } catch (error) {
                    console.error('❌ [DEBUG_BET] Error in debug bet:', error);
                    socket.emit('betError', { 
                        message: '🚧 DEBUG: Server error',
                        code: 'DEBUG_ERROR'
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
                console.log('🔌 WebSocket disconnected:', socket.id);
                
                // Clean up user's active bets tracking
                if (socket.activeBets) {
                    socket.activeBets.clear();
                }
            });
        });

        if (autoStartTicks) {
            setTimeout(() => {
                startBroadcastTicks();
            }, 1000);
        }
        
        console.log('✅ WebSocket server initialized with BET PLACEMENT - DURATION-BASED ROOMS ONLY');
        return io;
    } catch (error) {
        console.error('❌ Failed to initialize WebSocket server:', error);
        throw error;
    }
};

/**
 * EXISTING: Start broadcast ticks for duration-based rooms only
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
 * EXISTING: Start broadcast ticks for specific game/duration combination
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


const updateLiveExposure = async (gameType, duration, periodId, betData) => {
    // Placeholder for future real-time exposure monitoring
    // This will be implemented when you add admin monitoring features
    try {
        // Future implementation will broadcast exposure updates to admin users
        // For now, exposure is handled in gameLogicService
        return;
    } catch (error) {
        console.error('Error updating live exposure:', error);
    }
};


const broadcastExposureUpdate = async (io, gameType, duration, periodId) => {
    // Placeholder for future admin monitoring
    try {
        // Future implementation:
        // 1. Get current exposure data from Redis
        // 2. Calculate optimal result
        // 3. Broadcast to admin room
        
        // const adminRoomId = `admin_${gameType}_${duration}`;
        // const exposureData = await gameLogicService.getExposureSnapshot(gameType, duration, periodId);
        // io.to(adminRoomId).emit('exposureUpdate', exposureData);
        
        return;
    } catch (error) {
        console.error('Error broadcasting exposure update:', error);
    }
};

const getExposureSnapshot = async (gameType, duration, periodId) => {
    // Placeholder for future admin monitoring
    try {
        // Future implementation will return:
        // - Current exposure by outcome
        // - Optimal result based on exposure
        // - Potential payout amounts
        // - Risk analysis
        
        return {
            exposures: {},
            totalExposure: 0,
            optimalResult: null,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        console.error('Error getting exposure snapshot:', error);
        return null;
    }
};

const handleAdminConnection = async (socket) => {
    // Placeholder for future admin monitoring
    socket.on('subscribeToExposure', async (data) => {
        const { gameType, duration } = data;
        const adminRoomId = `admin_${gameType}_${duration}`;
        
        socket.join(adminRoomId);
        console.log(`Admin ${socket.userId} subscribed to exposure updates for ${gameType} ${duration}s`);
        
        // Send initial exposure data
        // const exposureData = await getExposureSnapshot(gameType, duration, currentPeriodId);
        // socket.emit('exposureSnapshot', exposureData);
    });
    
    socket.on('unsubscribeFromExposure', (data) => {
        const { gameType, duration } = data;
        const adminRoomId = `admin_${gameType}_${duration}`;
        
        socket.leave(adminRoomId);
        console.log(`Admin ${socket.userId} unsubscribed from exposure updates`);
    });
};

const getUserBetsForPeriod = async (userId, gameType, duration, periodId, timeline = 'default') => {
    try {
        const betHashKey = `bets:${gameType}:${duration}:${timeline}:${periodId}`;
        const allBets = await redisClient.hgetall(betHashKey);
        
        const userBets = [];
        for (const [betId, betJson] of Object.entries(allBets)) {
            const bet = JSON.parse(betJson);
            if (bet.userId === userId) {
                userBets.push({
                    betId,
                    ...bet
                });
            }
        }
        
        return userBets;
    } catch (error) {
        console.error('Error getting user bets:', error);
        return [];
    }
};


/**
 * EXISTING: Broadcast tick - Enhanced time validation to prevent race conditions
 */
const broadcastTick = async (gameType, duration) => {
    try {
        if (!isConnected()) return;

        const roomId = `${gameType}_${duration}`;
        
        // Get period info from Redis (populated by game scheduler process)
        const periodInfo = await getPeriodInfoFromRedis(gameType, duration);
        
        if (!periodInfo) {
            // No period info available - request new period from scheduler
            await pubsubRedis.publish('game_scheduler:period_request', JSON.stringify({
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
            await pubsubRedis.publish('game_scheduler:period_request', JSON.stringify({
                gameType,
                duration,
                roomId,
                currentPeriodId: periodInfo.periodId,
                timestamp: now.toISOString()
            }));
            return;
        }
        
        // CRITICAL: Betting closes at exactly 5 seconds remaining
        const bettingOpen = actualTimeRemaining > 5;

        // Broadcast time update to specific room
        io.to(roomId).emit('timeUpdate', {
            gameType,
            duration,
            periodId: periodInfo.periodId,
            timeRemaining: actualTimeRemaining,
            endTime: periodInfo.endTime,
            bettingOpen,
            bettingCloseTime: actualTimeRemaining <= 5,
            timestamp: now.toISOString(),
            roomId,
            source: 'websocket_validated'
        });

        // Handle betting closure notification - only once at exactly 5 seconds
        if (actualTimeRemaining === 5 && !bettingOpen) {
            io.to(roomId).emit('bettingClosed', {
                gameType, 
                duration,
                periodId: periodInfo.periodId,
                message: `Betting closed for ${gameType} ${duration}s`,
                timeRemaining: 5,
                roomId,
                timestamp: now.toISOString()
            });
            console.log(`📢 WebSocket: Betting closed for ${roomId} - ${periodInfo.periodId}`);
        }

        // If period is about to end (less than 1 second remaining), request next period
        if (actualTimeRemaining <= 1) {
            await pubsubRedis.publish('game_scheduler:period_request', JSON.stringify({
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
const getPeriodInfoFromRedis = async (gameType, duration, timeline = 'default') => {
    try {
        // FIXED: Use the correct Redis key format that matches game scheduler
        const periodKey = `game_scheduler:${gameType}:${duration}:current`;
        const periodData = await pubsubRedis.get(periodKey);
        
        if (!periodData) {
            return null;
        }
        
        return JSON.parse(periodData);
    } catch (error) {
        console.error('Error getting period info from Redis:', error);
        return null;
    }
};

/**
 * FIXED: Send current period info from Redis with enhanced validation
 */
const sendCurrentPeriodFromRedis = async (socket, gameType, duration, timeline = 'default') => {
    try {
        // FIXED: Use the correct Redis key format that matches game scheduler
        const periodKey = `game_scheduler:${gameType}:${duration}:current`;
        const periodData = await pubsubRedis.get(periodKey);
        
        if (!periodData) {
            console.log(`No period data in Redis for ${gameType} ${duration}s ${timeline}`);
            return;
        }
        
        const period = JSON.parse(periodData);
        const now = Date.now();
        const timeRemaining = Math.max(0, period.endTime - now);
        
        // Get total bets using new structure
        const totalBets = await getTotalBetsForPeriod(gameType, duration, period.periodId, timeline);
        
        socket.emit('currentPeriod', {
            gameType,
            duration,
            periodId: period.periodId,
            timeRemaining: Math.floor(timeRemaining / 1000),
            totalBets: totalBets.totalAmount,
            betCount: totalBets.betCount,
            uniqueUsers: totalBets.uniqueUsers,
            timeline,
            status: timeRemaining > 5000 ? 'betting' : 'closed'
        });
        
    } catch (error) {
        console.error('Error sending current period from Redis:', error);
    }
};

/**
 * EXISTING: Setup Redis subscriptions for game scheduler events
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
 * EXISTING: Handle events from game scheduler process with validation
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
                    validated: true,
                    bettingOpen: true
                });
                break;
                
            case 'game_scheduler:period_result':
                console.log(`📢 WebSocket: Broadcasting period result: ${periodId} to ${expectedRoomId}`);
                io.to(expectedRoomId).emit('periodResult', {
                    ...data,
                    roomId: expectedRoomId,
                    source: 'game_scheduler',
                    validated: true,
                    bettingOpen: false
                });
                break;
                
            case 'game_scheduler:betting_closed':
                console.log(`📢 WebSocket: Broadcasting betting closed: ${periodId} to ${expectedRoomId}`);
                io.to(expectedRoomId).emit('bettingClosed', {
                    ...data,
                    roomId: expectedRoomId,
                    source: 'game_scheduler',
                    validated: true,
                    bettingOpen: false
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

// Export WebSocket service - DURATION-BASED ROOMS WITH BET PLACEMENT
module.exports = {
    initializeWebSocket,
    
    startGameTickSystem: () => {
        console.log('🕐 Starting WebSocket DURATION-BASED broadcast system with BETTING...');
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
                // Add betting status
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
            
            console.log(`🎯 [BET_RESULTS] Broadcasting results for ${periodKey} to betting users only`);
            
            // Get all sockets in the room
            const room = io.sockets.adapter.rooms.get(roomId);
            if (!room) {
                console.log(`⚠️ [BET_RESULTS] No room found: ${roomId}`);
                return;
            }
            
            let notificationsSent = 0;
            
            // Iterate through all sockets in the room
            for (const socketId of room) {
                const socket = io.sockets.sockets.get(socketId);
                
                if (!socket || !socket.user || !socket.activeBets) continue;
                
                // Check if this user placed a bet in this period
                if (!socket.activeBets.has(periodKey)) {
                    console.log(`👁️ [BET_RESULTS] User ${socket.user.userId || socket.user.id} was only watching, no notification sent`);
                    continue;
                }
                
                const userId = socket.user.userId || socket.user.id;
                
                // Find if this user won
                const userWinnings = winningBets.filter(bet => 
                    bet.userId === userId || bet.userId === socket.user.id
                );
                
                const hasWon = userWinnings.length > 0;
                const totalWinnings = userWinnings.reduce((sum, bet) => sum + (bet.winnings || 0), 0);
                
                // Send personalized result to this betting user
                socket.emit('betResult', {
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
                            betAmount: bet.betAmount,
                            winnings: bet.winnings,
                            profitLoss: bet.winnings - bet.betAmount
                        }))
                    },
                    timestamp: new Date().toISOString(),
                    source: 'bet_result_notification'
                });
                
                notificationsSent++;
                
                console.log(`${hasWon ? '🎉' : '😔'} [BET_RESULTS] Sent result to user ${userId}: ${hasWon ? `WON ₹${totalWinnings}` : 'LOST'}`);
                
                // Remove this period from user's active bets
                socket.activeBets.delete(periodKey);
            }
            
            console.log(`✅ [BET_RESULTS] Sent ${notificationsSent} personalized result notifications for ${periodKey}`);
            
        } catch (error) {
            console.error('❌ [BET_RESULTS] Error broadcasting bet results:', error);
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
            
            console.log(`📢 [PERIOD_RESULT] Broadcasted general result for ${gameType}_${duration}_${periodId} to all users in room`);
            
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
            console.log(`⏹️ WebSocket: Stopped broadcast ticks for ${key}`);
        });
        gameIntervals.clear();
        gameTicksStarted = false;
        console.log('🛑 WebSocket: All broadcast ticks stopped');
    },
    
    // Debug functions
    verifyGameTicks: () => {
        console.log('🔍 Verifying DURATION-BASED broadcast system with BETTING...');
        
        const expectedIntervals = Object.values(GAME_CONFIGS).reduce((sum, durations) => sum + durations.length, 0);
        const activeIntervals = gameIntervals.size;
        
        console.log(`📊 WebSocket broadcast system status:`);
        console.log(`   - Active intervals: ${activeIntervals}`);
        console.log(`   - Expected intervals: ${expectedIntervals}`);
        console.log(`   - System started: ${gameTicksStarted}`);
        console.log(`   - Connected clients: ${io ? io.sockets.sockets.size : 0}`);
        console.log(`   - Betting enabled: ✅`);
        
        // Show detailed status
        Object.keys(GAME_CONFIGS).forEach(gameType => {
            console.log(`\n📋 ${gameType.toUpperCase()} rooms:`);
            GAME_CONFIGS[gameType].forEach(duration => {
                const key = `${gameType}_${duration}`;
                const hasInterval = gameIntervals.has(key);
                const roomId = `${gameType}_${duration}`;
                const clientCount = io ? (io.sockets.adapter.rooms.get(roomId)?.size || 0) : 0;
                console.log(`   - ${key}: ${hasInterval ? '✅ Active' : '❌ Inactive'} | ${clientCount} clients | Betting: ✅`);
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
                    status: isConnected() ? 'connected' : 'disconnected'
                }
            };
            
            // Test Redis connectivity
            try {
                await pubsubRedis.ping();
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
    
    // NEW: Utility functions
    validateBetPlacement,
    getTotalBetsForPeriod,
    
    // Additional utility functions
    getRoomId,
    isConnected,
    calculatePeriodStartTime,
    calculatePeriodEndTime,
    initializeWebSocketModels,
    processWebSocketBet,
    mapClientBetType,
    mapClientBetValue,
    calculateOddsForBet,
    startBroadcastTicks,
    startBroadcastTicksForGame,
    updateLiveExposure,
    broadcastExposureUpdate,
    getExposureSnapshot,
    handleAdminConnection,
    getUserBetsForPeriod,
    broadcastTick,
    getPeriodInfoFromRedis,
    sendCurrentPeriodFromRedis,
    setupRedisSubscriptions,
    handleGameSchedulerEvent
};