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
    return 0.50;
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
        const timestamp = new Date().toISOString();

        console.log(`\n🎲 [WS_BET_PROCESS_START] ==========================================`);
        console.log(`🎲 [WS_BET_PROCESS_START] Processing WebSocket bet for user ${userId} at ${timestamp}`);
        console.log(`🎲 [WS_BET_PROCESS_START] Socket ID: ${socket.id}`);
        console.log(`🎲 [WS_BET_PROCESS_START] Bet data:`, JSON.stringify(data, null, 2));

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
        console.log(`⏰ [WS_BET_TIMING] Time remaining: ${timeRemaining}ms (${timeRemaining/1000}s)`);
        
        if (timeRemaining < 5000) {
            console.log(`❌ [WS_BET_TIMING] Betting closed - only ${timeRemaining}ms remaining`);
            socket.emit('betError', {
                success: false,
                message: 'Betting closed for this period'
            });
            return { success: false, message: 'Betting closed for this period' };
        }

        console.log(`✅ [WS_BET_TIMING] Betting is allowed - ${timeRemaining}ms remaining`);

        // Validate bet placement using new structure
        console.log(`🔍 [WS_BET_PLACEMENT_VALIDATION] ==========================================`);
        console.log(`🔍 [WS_BET_PLACEMENT_VALIDATION] Validating bet placement...`);
        
        const validation = await validateBetPlacement(userId, gameType, duration, currentPeriod.periodId, betAmount, timeline);
        if (!validation.valid) {
            console.log(`❌ [WS_BET_PLACEMENT_VALIDATION] Validation failed:`, validation.error);
            socket.emit('betError', {
                success: false,
                message: validation.error
            });
            return { success: false, message: validation.error };
        }

        console.log(`✅ [WS_BET_PLACEMENT_VALIDATION] Placement validation passed`);

        // Get odds
        console.log(`💰 [WS_BET_ODDS] ==========================================`);
        console.log(`💰 [WS_BET_ODDS] Calculating odds for bet type: ${betType}, value: ${betValue}`);
        
        const odds = calculateOddsForBet(betType, betValue);
        if (!odds) {
            console.log(`❌ [WS_BET_ODDS] Invalid bet type or value: ${betType}:${betValue}`);
            socket.emit('betError', {
                success: false,
                message: 'Invalid bet type or value'
            });
            return { success: false, message: 'Invalid bet type or value' };
        }

        console.log(`✅ [WS_BET_ODDS] Calculated odds: ${odds}x`);

        // Process the bet with new structure
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
            
            io.to(roomId).emit('totalBetsUpdate', {
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

        // --- Ensure admin exposure monitoring is always initialized ---
        try {
            const adminExposureService = require('./adminExposureService');
            adminExposureService.startExposureMonitoring(io);
            console.log('✅ [WEBSOCKET] Admin exposure monitoring initialized from websocketService');
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
                    const timestamp = new Date().toISOString();
                    
                    console.log(`\n🎯 [WEBSOCKET_BET_START] ==========================================`);
                    console.log(`🎯 [WEBSOCKET_BET_START] User ${userId} placing bet at ${timestamp}`);
                    console.log(`🎯 [WEBSOCKET_BET_START] Socket ID: ${socket.id}`);
                    console.log(`🎯 [WEBSOCKET_BET_START] Raw bet received:`, JSON.stringify(betData, null, 2));
                    console.log(`🎯 [WEBSOCKET_BET_START] User object:`, JSON.stringify(socket.user, null, 2));
                    
                    // Transform client data format to expected format
                    // Transform the client bet data to server format using room-wise mapping
                    let transformedBetData;
                    
                    // Use room-specific mapping for different games
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
                        // Use legacy mapping for other games (will be updated later)
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
                    
                    console.log(`🔄 [WEBSOCKET_BET_TRANSFORM] ==========================================`);
                    console.log(`🔄 [WEBSOCKET_BET_TRANSFORM] Original type: ${betData.type} -> Server type: ${transformedBetData.betType}`);
                    console.log(`🔄 [WEBSOCKET_BET_TRANSFORM] Original selection: ${betData.selection} -> Server value: ${transformedBetData.betValue}`);
                    console.log(`🔄 [WEBSOCKET_BET_TRANSFORM] Original amount: ${betData.amount} -> Server amount: ${transformedBetData.betAmount}`);
                    console.log(`🔄 [WEBSOCKET_BET_TRANSFORM] Calculated odds: ${transformedBetData.odds}`);
                    console.log(`🔄 [WEBSOCKET_BET_TRANSFORM] Transformed bet data:`, JSON.stringify(transformedBetData, null, 2));
                    
                    // CRITICAL: Validate bet placement first
                    console.log(`🔍 [WEBSOCKET_BET_VALIDATION] ==========================================`);
                    console.log(`🔍 [WEBSOCKET_BET_VALIDATION] Starting validation for user ${userId}...`);
                    
                    const validation = await validateBetPlacement(userId, transformedBetData.gameType, transformedBetData.duration, transformedBetData.periodId, transformedBetData.betAmount, transformedBetData.timeline);
                    
                    console.log(`🔍 [WEBSOCKET_BET_VALIDATION] Validation result:`, JSON.stringify(validation, null, 2));
                    
                    if (!validation.valid) {
                        console.log(`❌ [WEBSOCKET_BET_VALIDATION_FAILED] ==========================================`);
                        console.log(`❌ [WEBSOCKET_BET_VALIDATION_FAILED] Validation failed for user ${userId}:`, validation.message);
                        console.log(`❌ [WEBSOCKET_BET_VALIDATION_FAILED] Error details:`, JSON.stringify(validation, null, 2));
                        
                        socket.emit('betError', { 
                            message: validation.message,
                            code: validation.code,
                            timeRemaining: validation.timeRemaining,
                            currentBalance: validation.currentBalance,
                            debug: validation.debug,
                            timestamp: timestamp
                        });
                        return;
                    }
                    
                    console.log(`✅ [WEBSOCKET_BET_VALIDATION_SUCCESS] ==========================================`);
                    console.log(`✅ [WEBSOCKET_BET_VALIDATION_SUCCESS] Validation passed for user ${userId}`);
                    console.log(`✅ [WEBSOCKET_BET_VALIDATION_SUCCESS] Time remaining: ${validation.timeRemaining}s`);
                    console.log(`✅ [WEBSOCKET_BET_VALIDATION_SUCCESS] Current balance: ₹${validation.currentBalance}`);
                    
                    // Use corrected bet amount from validation
                    const finalBetData = {
                        ...transformedBetData,
                        betAmount: validation.correctedBetAmount || transformedBetData.betAmount
                    };
                    
                    console.log(`🔍 [WEBSOCKET_BET_FINAL_DATA] ==========================================`);
                    console.log(`🔍 [WEBSOCKET_BET_FINAL_DATA] Final bet data for processing:`, JSON.stringify(finalBetData, null, 2));
                    console.log(`🔍 [WEBSOCKET_BET_FINAL_DATA] Processing bet for user ${userId}...`);
                    
                    // Process bet using WebSocket-specific processing (bypasses timing validation)
                    const result = await processWebSocketBet(socket, finalBetData);
                    
                    console.log(`📊 [WEBSOCKET_BET_PROCESSING_RESULT] ==========================================`);
                    console.log(`📊 [WEBSOCKET_BET_PROCESSING_RESULT] Processing result:`, JSON.stringify(result, null, 2));
                    
                    if (result.success) {
                        console.log(`✅ [WEBSOCKET_BET_SUCCESS] ==========================================`);
                        console.log(`✅ [WEBSOCKET_BET_SUCCESS] Bet processed successfully for user ${userId}`);
                        console.log(`✅ [WEBSOCKET_BET_SUCCESS] Amount: ₹${finalBetData.betAmount}`);
                        console.log(`✅ [WEBSOCKET_BET_SUCCESS] Game: ${finalBetData.gameType} ${finalBetData.duration}s`);
                        console.log(`✅ [WEBSOCKET_BET_SUCCESS] Period: ${finalBetData.periodId}`);
                        console.log(`✅ [WEBSOCKET_BET_SUCCESS] Bet type: ${finalBetData.betType}:${finalBetData.betValue}`);
                        console.log(`✅ [WEBSOCKET_BET_SUCCESS] Odds: ${finalBetData.odds}x`);
                        
                        // Success response to the betting user only
                        socket.emit('betSuccess', {
                            ...result.data,
                            message: 'Bet placed successfully!',
                            timestamp: timestamp,
                            timeRemaining: validation.timeRemaining
                        });
                        
                        // Store user as having placed bet in this period for result notifications
                        const roomId = `${betData.gameType}_${betData.duration}`;
                        if (!socket.activeBets) {
                            socket.activeBets = new Set();
                        }
                        socket.activeBets.add(`${betData.gameType}_${betData.duration}_${betData.periodId}`);
                        
                        console.log(`📡 [WEBSOCKET_BET_BROADCAST] ==========================================`);
                        console.log(`📡 [WEBSOCKET_BET_BROADCAST] Broadcasting bet activity to room: ${roomId}`);
                        
                        // Broadcast general bet activity to room (no user-specific data)
                        const totalBets = await getTotalBetsForPeriod(
                            betData.gameType, 
                            betData.duration, 
                            betData.periodId, 
                            betData.timeline || 'default'
                        );
                        
                        console.log(`📡 [WEBSOCKET_BET_BROADCAST] Total bets for period:`, JSON.stringify(totalBets, null, 2));
                        
                        socket.to(roomId).emit('betActivity', {
                            periodId: betData.periodId,
                            totalBets: totalBets,
                            gameType: betData.gameType,
                            duration: betData.duration,
                            timestamp: timestamp
                        });
                        
                        console.log(`✅ [WEBSOCKET_BET_COMPLETE] ==========================================`);
                        console.log(`✅ [WEBSOCKET_BET_COMPLETE] Bet flow completed successfully for user ${userId}`);
                        
                    } else {
                        console.log(`❌ [WEBSOCKET_BET_PROCESSING_FAILED] ==========================================`);
                        console.log(`❌ [WEBSOCKET_BET_PROCESSING_FAILED] Bet processing failed for user ${userId}:`, result.message);
                        console.log(`❌ [WEBSOCKET_BET_PROCESSING_FAILED] Error details:`, JSON.stringify(result, null, 2));
                        
                        socket.emit('betError', { 
                            message: result.message,
                            code: result.code,
                            timestamp: timestamp
                        });
                    }
                    
                } catch (error) {
                    console.log(`💥 [WEBSOCKET_BET_ERROR] ==========================================`);
                    console.log(`💥 [WEBSOCKET_BET_ERROR] Unexpected error processing bet for user ${socket.user?.userId || socket.user?.id}:`);
                    console.log(`💥 [WEBSOCKET_BET_ERROR] Error:`, error.message);
                    console.log(`💥 [WEBSOCKET_BET_ERROR] Stack:`, error.stack);
                    console.log(`💥 [WEBSOCKET_BET_ERROR] Bet data:`, JSON.stringify(betData, null, 2));
                    
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
                    
                    // CRITICAL FIX: Add duration validation even in debug mode
                    const gameType = betData.gameType;
                    const duration = parseInt(betData.duration);
                    
                    // Validate duration for game type
                    if (!GAME_CONFIGS[gameType] || !GAME_CONFIGS[gameType].includes(duration)) {
                        socket.emit('betError', { 
                            message: `Invalid duration ${duration}s for game type ${gameType}. Valid durations: ${GAME_CONFIGS[gameType]?.join(', ') || 'none'}`,
                            code: 'INVALID_DURATION'
                        });
                        return;
                    }
                    
                    console.log(`🚧 [DEBUG_BET] Duration validation passed: ${gameType} ${duration}s`);
                    
                    // Transform data using room-wise mapping
                    let finalBetData;
                    
                    // Use room-specific mapping for different games
                    if (betData.gameType === 'fiveD' || betData.gameType === '5d') {
                        // 5D Room mapping
                        const fiveDMapping = mapFiveDBet(betData);
                        finalBetData = {
                            gameType: betData.gameType,
                            duration: betData.duration,
                            periodId: betData.periodId,
                            timeline: 'default',
                            userId,
                            betAmount: parseFloat(betData.amount),
                            betType: fiveDMapping.betType,
                            betValue: fiveDMapping.betValue,
                            odds: fiveDMapping.odds
                        };
                    } else if (betData.gameType === 'wingo' || betData.gameType === 'trx_wix') {
                        // WINGO/TRX_WIX Room mapping
                        const wingoMapping = mapWingoBet(betData);
                        finalBetData = {
                            gameType: betData.gameType,
                            duration: betData.duration,
                            periodId: betData.periodId,
                            timeline: 'default',
                            userId,
                            betAmount: parseFloat(betData.amount),
                            betType: wingoMapping.betType,
                            betValue: wingoMapping.betValue,
                            odds: wingoMapping.odds
                        };
                    } else if (betData.gameType === 'k3') {
                        // K3 Room mapping
                        const k3Mapping = mapK3Bet(betData);
                        finalBetData = {
                            gameType: betData.gameType,
                            duration: betData.duration,
                            periodId: betData.periodId,
                            timeline: 'default',
                            userId,
                            betAmount: parseFloat(betData.amount),
                            betType: k3Mapping.betType,
                            betValue: k3Mapping.betValue,
                            odds: k3Mapping.odds
                        };
                    } else {
                        // Use legacy mapping for other games
                        finalBetData = {
                            gameType: betData.gameType,
                            duration: betData.duration,
                            periodId: betData.periodId,
                            timeline: 'default',
                            userId,
                            betAmount: parseFloat(betData.amount),
                            betType: mapClientBetType(betData.type, betData),
                            betValue: mapClientBetValue(betData.selection, betData.type, betData),
                            odds: calculateOddsForBet(betData.type, betData.selection, betData)
                        };
                    }
                    
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
        const timestamp = new Date().toISOString();
        
        console.log(`\n📢 [WEBSOCKET_EVENT_START] ==========================================`);
        console.log(`📢 [WEBSOCKET_EVENT_START] Received event: ${channel} at ${timestamp}`);
        console.log(`📢 [WEBSOCKET_EVENT_START] Event data:`, JSON.stringify(data, null, 2));
        
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
                console.log(`📢 [WEBSOCKET_PERIOD_START] ==========================================`);
                console.log(`📢 [WEBSOCKET_PERIOD_START] Broadcasting period start: ${periodId} to ${expectedRoomId}`);
                console.log(`📢 [WEBSOCKET_PERIOD_START] Period data:`, JSON.stringify(data, null, 2));
                
                io.to(expectedRoomId).emit('periodStart', {
                    ...data,
                    roomId: expectedRoomId,
                    source: 'game_scheduler',
                    validated: true,
                    bettingOpen: true,
                    timestamp: timestamp
                });
                
                console.log(`✅ [WEBSOCKET_PERIOD_START] Period start broadcasted successfully`);
                break;
                
            case 'game_scheduler:period_result':
                console.log(`📢 [WEBSOCKET_PERIOD_RESULT] ==========================================`);
                console.log(`📢 [WEBSOCKET_PERIOD_RESULT] Broadcasting period result: ${periodId} to ${expectedRoomId}`);
                console.log(`📢 [WEBSOCKET_PERIOD_RESULT] Result data:`, JSON.stringify(data, null, 2));
                
                // Log detailed result information
                if (data.result) {
                    console.log(`📊 [WEBSOCKET_PERIOD_RESULT_DETAILS] ==========================================`);
                    console.log(`📊 [WEBSOCKET_PERIOD_RESULT_DETAILS] Game: ${gameType} ${duration}s`);
                    console.log(`📊 [WEBSOCKET_PERIOD_RESULT_DETAILS] Period: ${periodId}`);
                    console.log(`📊 [WEBSOCKET_PERIOD_RESULT_DETAILS] Result:`, JSON.stringify(data.result, null, 2));
                    
                    // Log game-specific result details
                    if (gameType === 'fiveD' || gameType === '5d') {
                        const result = data.result;
                        console.log(`🎲 [WEBSOCKET_5D_RESULT_DETAILS] ==========================================`);
                        console.log(`🎲 [WEBSOCKET_5D_RESULT_DETAILS] 5D Result: A=${result.A}, B=${result.B}, C=${result.C}, D=${result.D}, E=${result.E}`);
                        console.log(`🎲 [WEBSOCKET_5D_RESULT_DETAILS] Sum: ${result.A + result.B + result.C + result.D + result.E}`);
                        console.log(`🎲 [WEBSOCKET_5D_RESULT_DETAILS] Sum category: ${(result.A + result.B + result.C + result.D + result.E) > 22 ? 'BIG' : 'SMALL'}`);
                        console.log(`🎲 [WEBSOCKET_5D_RESULT_DETAILS] Sum parity: ${(result.A + result.B + result.C + result.D + result.E) % 2 === 0 ? 'EVEN' : 'ODD'}`);
                    } else if (gameType === 'wingo') {
                        const result = data.result;
                        console.log(`🎯 [WEBSOCKET_WINGO_RESULT_DETAILS] ==========================================`);
                        console.log(`🎯 [WEBSOCKET_WINGO_RESULT_DETAILS] Wingo Result: Number=${result.number}, Color=${result.color}`);
                        console.log(`🎯 [WEBSOCKET_WINGO_RESULT_DETAILS] Parity: ${result.number % 2 === 0 ? 'EVEN' : 'ODD'}`);
                    } else if (gameType === 'k3') {
                        const result = data.result;
                        console.log(`🎲 [WEBSOCKET_K3_RESULT_DETAILS] ==========================================`);
                        console.log(`🎲 [WEBSOCKET_K3_RESULT_DETAILS] K3 Result: Dice=[${result.dice_1}, ${result.dice_2}, ${result.dice_3}]`);
                        console.log(`🎲 [WEBSOCKET_K3_RESULT_DETAILS] Sum: ${result.sum}`);
                        console.log(`🎲 [WEBSOCKET_K3_RESULT_DETAILS] Has pair: ${result.has_pair}`);
                        console.log(`🎲 [WEBSOCKET_K3_RESULT_DETAILS] Has triple: ${result.has_triple}`);
                        console.log(`🎲 [WEBSOCKET_K3_RESULT_DETAILS] Is straight: ${result.is_straight}`);
                    }
                }
                
                io.to(expectedRoomId).emit('periodResult', {
                    ...data,
                    roomId: expectedRoomId,
                    source: 'game_scheduler',
                    validated: true,
                    bettingOpen: false,
                    timestamp: timestamp
                });
                
                console.log(`✅ [WEBSOCKET_PERIOD_RESULT] Period result broadcasted successfully`);
                break;
                
            case 'game_scheduler:betting_closed':
                console.log(`📢 [WEBSOCKET_BETTING_CLOSED] ==========================================`);
                console.log(`📢 [WEBSOCKET_BETTING_CLOSED] Broadcasting betting closed: ${periodId} to ${expectedRoomId}`);
                console.log(`📢 [WEBSOCKET_BETTING_CLOSED] Betting closed data:`, JSON.stringify(data, null, 2));
                
                io.to(expectedRoomId).emit('bettingClosed', {
                    ...data,
                    roomId: expectedRoomId,
                    source: 'game_scheduler',
                    validated: true,
                    bettingOpen: false,
                    timestamp: timestamp
                });
                
                console.log(`✅ [WEBSOCKET_BETTING_CLOSED] Betting closed broadcasted successfully`);
                break;
                
            case 'game_scheduler:period_error':
                console.log(`📢 [WEBSOCKET_PERIOD_ERROR] ==========================================`);
                console.log(`📢 [WEBSOCKET_PERIOD_ERROR] Broadcasting period error: ${periodId} to ${expectedRoomId}`);
                console.log(`📢 [WEBSOCKET_PERIOD_ERROR] Error data:`, JSON.stringify(data, null, 2));
                
                io.to(expectedRoomId).emit('periodError', {
                    ...data,
                    roomId: expectedRoomId,
                    source: 'game_scheduler',
                    validated: true,
                    timestamp: timestamp
                });
                
                console.log(`✅ [WEBSOCKET_PERIOD_ERROR] Period error broadcasted successfully`);
                break;
        }
        
        console.log(`✅ [WEBSOCKET_EVENT_COMPLETE] ==========================================`);
        console.log(`✅ [WEBSOCKET_EVENT_COMPLETE] Event ${channel} processed successfully`);
        
    } catch (error) {
        console.log(`💥 [WEBSOCKET_EVENT_ERROR] ==========================================`);
        console.log(`💥 [WEBSOCKET_EVENT_ERROR] Error handling game scheduler event: ${channel}`);
        console.log(`💥 [WEBSOCKET_EVENT_ERROR] Error:`, error.message);
        console.log(`💥 [WEBSOCKET_EVENT_ERROR] Stack:`, error.stack);
        console.log(`💥 [WEBSOCKET_EVENT_ERROR] Event data:`, JSON.stringify(data, null, 2));
    }
};

/**
 * K3 ROOM: Dedicated mapping function for K3 game
 */
const mapK3Bet = (betData) => {
    const { type, selection, extra, position } = betData;
    const clientType = String(type || '').toLowerCase();
    const clientSelection = String(selection || '').toLowerCase();
    const clientExtra = String(extra || '').toLowerCase();
    
    console.log(`🎲 [K3_MAPPING] Mapping K3 bet:`, { type: clientType, selection: clientSelection, extra: clientExtra });
    
    // SUM bet - Handle both single and multiple values
    if (clientType === 'sum') {
        // Check if this is a multiple sum bet (comma-separated values)
        if (clientSelection.includes(',')) {
            console.log(`🎲 [K3_MAPPING] Multiple sum bet detected: ${clientSelection}`);
            return { 
                betType: 'SUM_MULTIPLE', 
                betValue: clientSelection, 
                odds: 0  // Will be calculated per individual value
            };
        }
        // Single sum bet
        else if (!isNaN(clientSelection)) {
            console.log(`🎲 [K3_MAPPING] Single sum bet detected: ${clientSelection}`);
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
        return { betType: 'ANY_PAIR', betValue: null, odds: 0 };
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
    
    // ALL_DIFFERENT: three different numbers
    if (clientType === 'all_different' || clientType === 'different') {
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
    
    // Fallback: return as-is
    console.log(`⚠️ [K3_MAPPING] Unknown bet type: ${clientType}, returning as-is`);
    return { betType: clientType.toUpperCase(), betValue: clientSelection, odds: 0 };
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
            const timestamp = new Date().toISOString();
            
            console.log(`\n🎯 [BET_RESULTS_START] ==========================================`);
            console.log(`🎯 [BET_RESULTS_START] Broadcasting results for ${periodKey} at ${timestamp}`);
            console.log(`🎯 [BET_RESULTS_START] Game: ${gameType} ${duration}s`);
            console.log(`🎯 [BET_RESULTS_START] Period: ${periodId}`);
            console.log(`🎯 [BET_RESULTS_START] Result:`, JSON.stringify(periodResult, null, 2));
            console.log(`🎯 [BET_RESULTS_START] Winning bets count: ${winningBets.length}`);
            console.log(`🎯 [BET_RESULTS_START] Winning bets details:`, JSON.stringify(winningBets, null, 2));
            
            // Get all sockets in the room
            const room = io.sockets.adapter.rooms.get(roomId);
            if (!room) {
                console.log(`⚠️ [BET_RESULTS] No room found: ${roomId}`);
                return;
            }
            
            console.log(`👥 [BET_RESULTS_ROOM] ==========================================`);
            console.log(`👥 [BET_RESULTS_ROOM] Room ${roomId} has ${room.size} connected users`);
            
            let notificationsSent = 0;
            let bettingUsersFound = 0;
            let watchingUsersFound = 0;
            
            // Iterate through all sockets in the room
            for (const socketId of room) {
                const socket = io.sockets.sockets.get(socketId);
                
                if (!socket || !socket.user) {
                    console.log(`👤 [BET_RESULTS] Socket ${socketId} has no user, skipping`);
                    continue;
                }
                
                const userId = socket.user.userId || socket.user.id;
                
                if (!socket.activeBets) {
                    console.log(`👁️ [BET_RESULTS] User ${userId} has no active bets, watching only`);
                    watchingUsersFound++;
                    continue;
                }
                
                // Check if this user placed a bet in this period
                if (!socket.activeBets.has(periodKey)) {
                    console.log(`👁️ [BET_RESULTS] User ${userId} was only watching period ${periodId}, no notification sent`);
                    watchingUsersFound++;
                    continue;
                }
                
                bettingUsersFound++;
                console.log(`🎯 [BET_RESULTS_USER] ==========================================`);
                console.log(`🎯 [BET_RESULTS_USER] Processing results for betting user: ${userId}`);
                console.log(`🎯 [BET_RESULTS_USER] Socket ID: ${socket.id}`);
                console.log(`🎯 [BET_RESULTS_USER] Active bets:`, Array.from(socket.activeBets));
                
                // Find if this user won
                const userWinnings = winningBets.filter(bet => 
                    bet.userId === userId || bet.userId === socket.user.id
                );
                
                const hasWon = userWinnings.length > 0;
                const totalWinnings = userWinnings.reduce((sum, bet) => sum + (bet.winnings || 0), 0);
                
                console.log(`💰 [BET_RESULTS_WINNINGS] ==========================================`);
                console.log(`💰 [BET_RESULTS_WINNINGS] User ${userId} win status: ${hasWon ? 'WON' : 'LOST'}`);
                console.log(`💰 [BET_RESULTS_WINNINGS] Winning bets found: ${userWinnings.length}`);
                console.log(`💰 [BET_RESULTS_WINNINGS] Total winnings: ₹${totalWinnings}`);
                console.log(`💰 [BET_RESULTS_WINNINGS] Winning bet details:`, JSON.stringify(userWinnings, null, 2));
                
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
                
                console.log(`📤 [BET_RESULTS_SEND] ==========================================`);
                console.log(`📤 [BET_RESULTS_SEND] Sending personalized result to user ${userId}:`);
                console.log(`📤 [BET_RESULTS_SEND] Result data:`, JSON.stringify(personalizedResult, null, 2));
                
                // Send personalized result to this betting user
                socket.emit('betResult', personalizedResult);
                
                notificationsSent++;
                
                console.log(`${hasWon ? '🎉' : '😔'} [BET_RESULTS_SENT] ==========================================`);
                console.log(`${hasWon ? '🎉' : '😔'} [BET_RESULTS_SENT] Result sent to user ${userId}: ${hasWon ? `WON ₹${totalWinnings}` : 'LOST'}`);
                console.log(`${hasWon ? '🎉' : '😔'} [BET_RESULTS_SENT] Notification #${notificationsSent} sent successfully`);
                
                // Remove this period from user's active bets
                socket.activeBets.delete(periodKey);
                console.log(`🗑️ [BET_RESULTS_CLEANUP] Removed period ${periodKey} from user ${userId} active bets`);
            }
            
            console.log(`✅ [BET_RESULTS_COMPLETE] ==========================================`);
            console.log(`✅ [BET_RESULTS_COMPLETE] Results broadcast completed for ${periodKey}`);
            console.log(`✅ [BET_RESULTS_COMPLETE] Total users in room: ${room.size}`);
            console.log(`✅ [BET_RESULTS_COMPLETE] Betting users found: ${bettingUsersFound}`);
            console.log(`✅ [BET_RESULTS_COMPLETE] Watching users found: ${watchingUsersFound}`);
            console.log(`✅ [BET_RESULTS_COMPLETE] Notifications sent: ${notificationsSent}`);
            console.log(`✅ [BET_RESULTS_COMPLETE] Winning bets total: ${winningBets.length}`);
            
        } catch (error) {
            console.log(`💥 [BET_RESULTS_ERROR] ==========================================`);
            console.log(`💥 [BET_RESULTS_ERROR] Error broadcasting bet results for ${gameType}_${duration}_${periodId}:`);
            console.log(`💥 [BET_RESULTS_ERROR] Error:`, error.message);
            console.log(`💥 [BET_RESULTS_ERROR] Stack:`, error.stack);
            console.log(`💥 [BET_RESULTS_ERROR] Result data:`, JSON.stringify(periodResult, null, 2));
            console.log(`💥 [BET_RESULTS_ERROR] Winning bets:`, JSON.stringify(winningBets, null, 2));
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