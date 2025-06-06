// Backend/services/websocketService.js - FIXED VERSION WITH PROPER ROOM ISOLATION

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

// Game tick intervals storage - NOW WITH TIMELINE SUPPORT
const gameIntervals = new Map();
let gameTicksStarted = false;

// ENHANCED: Period cache with timeline support
const currentPeriods = new Map(); // Key: gameType_duration_timeline
const nextPeriods = new Map(); // PRE-LOADED next periods
const resultProcessingLocks = new Set(); // Track which periods are being processed

// Constants - ENHANCED WITH TIMELINE SUPPORT
const GAME_CONFIGS = {
    wingo: [30, 60, 180, 300],    // 30s, 1m, 3m, 5m
    trx_wix: [30, 60, 180, 300],  // 30s, 1m, 3m, 5m
    fiveD: [60, 180, 300, 600],   // 1m, 3m, 5m, 10m
    k3: [60, 180, 300, 600]       // 1m, 3m, 5m, 10m
};

const TIMELINES = ['default', 'timeline2', 'timeline3', 'timeline4'];

/**
 * FIXED: Calculate real-time period information with PROPER timeline staggering
 */
const calculateRealTimePeriod = (gameType, duration, timeline, now = new Date()) => {
    try {
        const istMoment = moment(now).tz('Asia/Kolkata');
        
        // Calculate time since 2 AM today
        let startOfPeriods = istMoment.clone().hour(2).minute(0).second(0).millisecond(0);
        
        // If current time is before 2 AM, use 2 AM of previous day
        if (istMoment.hour() < 2) {
            startOfPeriods.subtract(1, 'day');
        }
        
        // FIXED: Proper timeline offset calculation
        const timelineIndex = TIMELINES.indexOf(timeline);
        const timelineOffset = timelineIndex * Math.floor(duration / 4); // Stagger by quarter duration
        
        // Calculate total seconds since period start with timeline offset
        const totalSeconds = istMoment.diff(startOfPeriods, 'seconds') - timelineOffset;
        
        // Calculate current period number (0-based)
        const currentPeriodNumber = Math.floor(totalSeconds / duration);
        
        // Calculate when current period started and ends
        const currentPeriodStart = startOfPeriods.clone()
            .add(currentPeriodNumber * duration + timelineOffset, 'seconds');
        const currentPeriodEnd = currentPeriodStart.clone().add(duration, 'seconds');
        
        // More precise time remaining calculation
        const timeRemaining = Math.max(0, Math.ceil(currentPeriodEnd.diff(istMoment) / 1000));
        
        // FIXED: Generate period ID with timeline-specific sequence
        const dateStr = startOfPeriods.format('YYYYMMDD');
        const timelineSpecificSequence = currentPeriodNumber * TIMELINES.length + timelineIndex;
        const periodId = `${dateStr}${timelineSpecificSequence.toString().padStart(9, '0')}`;
        
        // PRE-CALCULATE next period info
        const nextPeriodNumber = currentPeriodNumber + 1;
        const nextTimelineSpecificSequence = nextPeriodNumber * TIMELINES.length + timelineIndex;
        const nextPeriodId = `${dateStr}${nextTimelineSpecificSequence.toString().padStart(9, '0')}`;
        const nextPeriodStart = currentPeriodEnd.clone();
        const nextPeriodEnd = nextPeriodStart.clone().add(duration, 'seconds');
        
        return {
            current: {
                periodId,
                gameType,
                duration,
                timeline,
                startTime: currentPeriodStart.toDate(),
                endTime: currentPeriodEnd.toDate(),
                timeRemaining,
                active: timeRemaining > 0,
                bettingOpen: timeRemaining > 5,
                currentPeriodNumber,
                timelineOffset
            },
            next: {
                periodId: nextPeriodId,
                gameType,
                duration,
                timeline,
                startTime: nextPeriodStart.toDate(),
                endTime: nextPeriodEnd.toDate(),
                timeRemaining: timeRemaining + duration,
                active: false,
                bettingOpen: false,
                currentPeriodNumber: nextPeriodNumber,
                timelineOffset
            }
        };
    } catch (error) {
        console.error('Error calculating real-time period:', error);
        throw error;
    }
};

/**
 * FIXED: Initialize the WebSocket server with STRICT room isolation
 */
const initializeWebSocket = (server, autoStartTicks = true) => {
    console.log('🔄 Initializing WebSocket server with STRICT room isolation...');
    
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

        // FIXED: Send connection confirmation with proper game data
        socket.emit('connected', {
            message: 'Connected to game server',
            timestamp: new Date().toISOString(),
            gameTicksActive: gameTicksStarted,
            userId: socket.user.userId || socket.user.id,
            supportedGames: Object.keys(GAME_CONFIGS),
            supportedTimelines: TIMELINES
        });

        // FIXED: Handle join game with STRICT validation
        socket.on('joinGame', async (data) => {
            try {
                console.log('🎮 Join game request:', data);
                
                const { gameType, duration, timeline = 'default' } = data;
                
                // STRICT validation
                if (!GAME_CONFIGS[gameType] || !GAME_CONFIGS[gameType].includes(duration)) {
                    socket.emit('error', { 
                        message: `Invalid game configuration: ${gameType} ${duration}s`,
                        code: 'INVALID_GAME_CONFIG'
                    });
                    return;
                }

                if (!TIMELINES.includes(timeline)) {
                    socket.emit('error', { 
                        message: `Invalid timeline: ${timeline}`,
                        code: 'INVALID_TIMELINE'
                    });
                    return;
                }

                // FIXED: Create EXACT room ID
                const roomId = `${gameType}_${duration}_${timeline}`;
                
                // Leave any previous rooms first
                if (socket.currentGame) {
                    const oldRoomId = `${socket.currentGame.gameType}_${socket.currentGame.duration}_${socket.currentGame.timeline}`;
                    socket.leave(oldRoomId);
                    console.log(`👋 User left previous room: ${oldRoomId}`);
                }
                
                // Join the NEW timeline-specific room
                socket.join(roomId);
                console.log(`✅ User ${socket.user.userId || socket.user.id} joined SPECIFIC room: ${roomId}`);

                // Store user's current game and timeline
                socket.currentGame = { gameType, duration, timeline, roomId };

                // Confirm join with EXACT details
                socket.emit('joinedGame', {
                    gameType,
                    duration,
                    timeline,
                    roomId,
                    message: `Successfully joined ${gameType} ${duration}s ${timeline}`,
                    gameTicksActive: gameTicksStarted,
                    timestamp: new Date().toISOString()
                });

                // Send current game state for THIS SPECIFIC timeline ONLY
                await sendCurrentGameState(socket, gameType, duration, timeline);

            } catch (error) {
                console.error('❌ Error joining game:', error);
                socket.emit('error', { message: 'Failed to join game' });
            }
        });

        // FIXED: Handle leave game with proper cleanup
        socket.on('leaveGame', (data) => {
            try {
                const { gameType, duration, timeline = 'default' } = data;
                const roomId = `${gameType}_${duration}_${timeline}`;
                
                socket.leave(roomId);
                console.log(`👋 User ${socket.user.userId || socket.user.id} left room: ${roomId}`);
                
                socket.currentGame = null;
                socket.emit('leftGame', { gameType, duration, timeline, roomId });
            } catch (error) {
                console.error('❌ Error leaving game:', error);
            }
        });

        // Other socket handlers remain the same...
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
            startGameTickSystem();
        }, 1000);
    }
    
    console.log('✅ WebSocket server initialized with STRICT room isolation');
    return io;
};

/**
 * FIXED: Start game ticks with PROPER separation
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
    console.log(`⏰ Started ISOLATED game ticks for ${gameType} ${duration}s ${timeline}`);
};

/**
 * FIXED: Game tick with STRICT room isolation
 */
const gameTick = async (gameType, duration, timeline) => {
    try {
        // Skip if Redis not connected
        if (!isConnected()) {
            return;
        }

        const now = new Date();
        const key = `${gameType}_${duration}_${timeline}`;
        
        // Get current cached periods
        const cachedCurrent = currentPeriods.get(key);
        const cachedNext = nextPeriods.get(key);
        
        // Calculate real-time periods
        const realTimePeriods = calculateRealTimePeriod(gameType, duration, timeline, now);
        
        // CHECK: If current period has changed, transition INSTANTLY
        if (!cachedCurrent || cachedCurrent.periodId !== realTimePeriods.current.periodId) {
            console.log(`⚡ PERIOD TRANSITION [${gameType}|${duration}s|${timeline}]: ${cachedCurrent?.periodId} → ${realTimePeriods.current.periodId}`);
            
            // Process previous period results in background (NON-BLOCKING)
            if (cachedCurrent && cachedCurrent.periodId !== realTimePeriods.current.periodId) {
                setImmediate(() => {
                    handlePeriodEnd(gameType, duration, timeline, cachedCurrent.periodId);
                });
            }
            
            // Update current period
            currentPeriods.set(key, realTimePeriods.current);
            nextPeriods.set(key, realTimePeriods.next);
            
            // FIXED: Broadcast to EXACT room only
            const exactRoomId = `${gameType}_${duration}_${timeline}`;
            const currentPeriod = currentPeriods.get(key);
            
            io.to(exactRoomId).emit('periodStart', {
                gameType,
                duration,
                timeline,
                periodId: currentPeriod.periodId,
                timeRemaining: Math.floor(currentPeriod.timeRemaining),
                endTime: currentPeriod.endTime.toISOString(),
                message: `New period started for ${gameType} ${duration}s ${timeline}`,
                roomId: exactRoomId
            });
            
            console.log(`📢 Period start broadcast to EXACT room: ${exactRoomId}`);
        }
        
        // Update time remaining
        const currentPeriod = currentPeriods.get(key);
        if (currentPeriod) {
            currentPeriod.timeRemaining = realTimePeriods.current.timeRemaining;
            currentPeriod.bettingOpen = realTimePeriods.current.bettingOpen;
        }
        
        const { periodId, timeRemaining, endTime, bettingOpen } = currentPeriod || realTimePeriods.current;
        const exactRoomId = `${gameType}_${duration}_${timeline}`;
        
        // FIXED: Broadcast time update to EXACT room only
        io.to(exactRoomId).emit('timeUpdate', {
            gameType,
            duration,
            timeline,
            periodId,
            timeRemaining: Math.floor(timeRemaining),
            endTime: endTime.toISOString(),
            bettingOpen,
            timestamp: now.toISOString(),
            roomId: exactRoomId
        });

        // Handle betting closure
        if (timeRemaining <= 5 && timeRemaining > 0 && bettingOpen) {
            io.to(exactRoomId).emit('bettingClosed', {
                gameType,
                duration,
                timeline,
                periodId,
                message: `Betting closed for ${gameType} ${duration}s ${timeline}`,
                roomId: exactRoomId
            });
        }

    } catch (error) {
        const errorKey = `${gameType}_${duration}_${timeline}_error`;
        const lastLogTime = global[errorKey] || 0;
        const now = Date.now();
        
        if (now - lastLogTime > 60000) {
            console.error(`❌ Game tick error [${gameType}|${duration}s|${timeline}]:`, error.message);
            global[errorKey] = now;
        }
    }
};

/**
 * FIXED: Handle period end with STRICT room isolation
 */
const handlePeriodEnd = async (gameType, duration, timeline, periodId) => {
    const globalLockKey = `result_lock_${gameType}_${duration}_${timeline}_${periodId}`;
    const processKey = `${gameType}_${duration}_${timeline}_${periodId}`;
    
    try {
        // Prevent duplicate processing
        if (resultProcessingLocks.has(processKey)) {
            console.log(`🔒 Period ${periodId} [${gameType}|${duration}s|${timeline}] already processing`);
            return;
        }
        
        resultProcessingLocks.add(processKey);
        
        console.log(`🏁 Processing period end [${gameType}|${duration}s|${timeline}]: ${periodId}`);
        
        // Redis lock
        const lockValue = `${Date.now()}_${process.pid}_${gameType}_${timeline}`;
        const lockAcquired = await redis.set(globalLockKey, lockValue, 'EX', 60, 'NX');
        
        if (!lockAcquired) {
            console.log(`⚠️ Period ${periodId} [${gameType}|${duration}s|${timeline}] already locked`);
            return;
        }
        
        if (!loadServices()) {
            console.error('❌ Services not ready');
            await redis.del(globalLockKey);
            return;
        }
        
        // Check for existing result
        const existingResult = await checkExistingResult(gameType, duration, timeline, periodId);
        if (existingResult) {
            console.log(`✅ Using existing result [${gameType}|${duration}s|${timeline}]: ${periodId}`);
            await broadcastPeriodResult(gameType, duration, timeline, periodId, existingResult, 'existing');
            await redis.del(globalLockKey);
            return;
        }
        
        // Process NEW results
        try {
            console.log(`🎲 Generating NEW result [${gameType}|${duration}s|${timeline}]: ${periodId}`);
            
            const gameResult = await gameLogicService.processGameResults(
                gameType, 
                duration, 
                periodId, 
                timeline
            );
            
            if (gameResult.success) {
                await broadcastPeriodResult(
                    gameType, 
                    duration, 
                    timeline, 
                    periodId, 
                    {
                        result: gameResult.gameResult,
                        winners: gameResult.winners || [],
                        verification: gameResult.verification
                    }, 
                    'new'
                );
                
                console.log(`✅ NEW result processed [${gameType}|${duration}s|${timeline}]: ${JSON.stringify(gameResult.gameResult)}`);
                
            } else {
                throw new Error(gameResult.message || 'Failed to process results');
            }
            
        } catch (processError) {
            console.error(`❌ Result processing error [${gameType}|${duration}s|${timeline}]:`, processError.message);
            
            const exactRoomId = `${gameType}_${duration}_${timeline}`;
            io.to(exactRoomId).emit('periodError', {
                gameType,
                duration,
                timeline,
                periodId,
                message: 'Error processing results',
                timestamp: new Date().toISOString(),
                roomId: exactRoomId
            });
        } finally {
            // Always release lock
            try {
                const currentLock = await redis.get(globalLockKey);
                if (currentLock === lockValue) {
                    await redis.del(globalLockKey);
                }
            } catch (lockError) {
                console.error('❌ Error releasing lock:', lockError);
            }
        }

    } catch (error) {
        console.error(`❌ Period end error [${gameType}|${duration}s|${timeline}]:`, error);
    } finally {
        resultProcessingLocks.delete(processKey);
    }
};

/**
 * FIXED: Broadcast period result to EXACT room only
 */
const broadcastPeriodResult = async (gameType, duration, timeline, periodId, resultData, source) => {
    try {
        // FIXED: Calculate EXACT room ID
        const exactRoomId = `${gameType}_${duration}_${timeline}`;
        
        const enhancedResultData = {
            gameType,
            duration,
            timeline,
            periodId,
            result: resultData.result,
            winners: resultData.winners || [],
            winnerCount: Array.isArray(resultData.winners) ? resultData.winners.length : 0,
            totalPayout: Array.isArray(resultData.winners) ? 
                resultData.winners.reduce((sum, winner) => sum + (winner.winnings || 0), 0) : 0,
            verification: resultData.verification,
            timestamp: new Date().toISOString(),
            source: source,
            roomId: exactRoomId
        };

        // ✅ BROADCAST TO EXACT ROOM ONLY - NO CROSS-CONTAMINATION
        io.to(exactRoomId).emit('periodResult', enhancedResultData);
        
        // ❌ REMOVED: General 'games' broadcast that was causing cross-contamination
        // io.to('games').emit('gameResult', enhancedResultData); // ← THIS WAS THE PROBLEM!

        console.log(`📢 STRICT BROADCAST [${gameType}|${duration}s|${timeline}] → ${exactRoomId}`);
        console.log(`🎯 Winners: ${enhancedResultData.winnerCount}, Payout: ₹${enhancedResultData.totalPayout}`);

        // Verify room isolation
        const room = io.sockets.adapter.rooms.get(exactRoomId);
        const clientCount = room ? room.size : 0;
        console.log(`📊 Room ${exactRoomId} has ${clientCount} clients`);

    } catch (error) {
        console.error('❌ Error broadcasting period result:', error);
    }
};

/**
 * FIXED: Check existing result with proper timeline filtering
 */
const checkExistingResult = async (gameType, duration, timeline, periodId) => {
    try {
        if (!loadServices()) {
            return null;
        }
        
        const models = await gameLogicService.ensureModelsInitialized();
        let existingResult = null;
        
        const whereClause = { 
            duration: duration,
            timeline: timeline  // ← CRITICAL: Timeline filtering
        };
        
        switch (gameType.toLowerCase()) {
            case 'wingo':
                whereClause.bet_number = periodId;
                existingResult = await models.BetResultWingo.findOne({
                    where: whereClause,
                    order: [['created_at', 'DESC']]
                });
                
                if (existingResult) {
                    return {
                        result: {
                            number: existingResult.result_of_number,
                            color: existingResult.result_of_color,
                            size: existingResult.result_of_size
                        },
                        winners: []
                    };
                }
                break;
                
            case 'trx_wix':
                whereClause.period = periodId;
                existingResult = await models.BetResultTrxWix.findOne({
                    where: whereClause,
                    order: [['created_at', 'DESC']]
                });
                
                if (existingResult) {
                    let resultData;
                    try {
                        resultData = typeof existingResult.result === 'string' ? 
                            JSON.parse(existingResult.result) : existingResult.result;
                    } catch (parseError) {
                        console.warn('Error parsing result:', parseError);
                        return null;
                    }
                    
                    return {
                        result: resultData,
                        verification: {
                            hash: existingResult.verification_hash,
                            link: existingResult.verification_link
                        },
                        winners: []
                    };
                }
                break;
                
            case 'fived':
            case '5d':
                whereClause.bet_number = periodId;
                existingResult = await models.BetResult5D.findOne({
                    where: whereClause,
                    order: [['created_at', 'DESC']]
                });
                
                if (existingResult) {
                    return {
                        result: {
                            A: existingResult.result_a,
                            B: existingResult.result_b,
                            C: existingResult.result_c,
                            D: existingResult.result_d,
                            E: existingResult.result_e,
                            sum: existingResult.total_sum
                        },
                        winners: []
                    };
                }
                break;
                
            case 'k3':
                whereClause.bet_number = periodId;
                existingResult = await models.BetResultK3.findOne({
                    where: whereClause,
                    order: [['created_at', 'DESC']]
                });
                
                if (existingResult) {
                    return {
                        result: {
                            dice_1: existingResult.dice_1,
                            dice_2: existingResult.dice_2,
                            dice_3: existingResult.dice_3,
                            sum: existingResult.sum,
                            has_pair: existingResult.has_pair,
                            has_triple: existingResult.has_triple,
                            is_straight: existingResult.is_straight,
                            sum_size: existingResult.sum_size,
                            sum_parity: existingResult.sum_parity
                        },
                        winners: []
                    };
                }
                break;
        }
        
        return null;
        
    } catch (error) {
        console.error(`❌ Error checking existing result [${gameType}|${duration}s|${timeline}]:`, error);
        return null;
    }
};

/**
 * FIXED: Send current game state for SPECIFIC timeline only
 */
const sendCurrentGameState = async (socket, gameType, duration, timeline) => {
    try {
        const key = `${gameType}_${duration}_${timeline}`;
        const exactRoomId = `${gameType}_${duration}_${timeline}`;
        
        // Get current period from cache
        let currentPeriod = currentPeriods.get(key);
        
        if (!currentPeriod) {
            // Calculate real-time period for THIS specific timeline
            const periods = calculateRealTimePeriod(gameType, duration, timeline);
            currentPeriod = periods.current;
        }
        
        // Send period info for THIS EXACT game/duration/timeline
        socket.emit('periodInfo', {
            gameType,
            duration,
            timeline,
            periodId: currentPeriod.periodId,
            timeRemaining: Math.floor(currentPeriod.timeRemaining),
            endTime: currentPeriod.endTime.toISOString(),
            bettingOpen: currentPeriod.bettingOpen,
            timestamp: new Date().toISOString(),
            roomId: exactRoomId
        });

        console.log(`📤 Game state sent [${gameType}|${duration}s|${timeline}]: Period ${currentPeriod.periodId}, Time: ${Math.floor(currentPeriod.timeRemaining)}s`);

    } catch (error) {
        console.error(`❌ Error sending game state [${gameType}|${duration}s|${timeline}]:`, error);
        socket.emit('error', { 
            message: 'Failed to get current game state',
            gameType,
            duration,
            timeline 
        });
    }
};

/**
 * DEBUGGING: Add room verification function
 */
const verifyRoomIsolation = () => {
    console.log('\n🔍 ROOM ISOLATION VERIFICATION:');
    
    if (io && io.sockets && io.sockets.adapter && io.sockets.adapter.rooms) {
        for (const [roomName, room] of io.sockets.adapter.rooms.entries()) {
            // Only show game rooms (contain underscores)
            if (roomName.includes('_') && !roomName.startsWith('room_')) {
                console.log(`📍 Room: ${roomName} - Clients: ${room.size}`);
                
                // Show which sockets are in each room
                for (const socketId of room) {
                    const socket = io.sockets.sockets.get(socketId);
                    const userId = socket?.user?.userId || socket?.user?.id || 'unknown';
                    console.log(`  └─ Socket: ${socketId} (User: ${userId})`);
                }
            }
        }
    }
    
    console.log('\n📊 ACTIVE GAME INTERVALS:');
    gameIntervals.forEach((intervalId, key) => {
        console.log(`⏰ ${key}: Interval ${intervalId}`);
    });
    
    console.log('\n📅 CACHED PERIODS:');
    currentPeriods.forEach((period, key) => {
        console.log(`📋 ${key}: Period ${period.periodId} (${Math.floor(period.timeRemaining)}s remaining)`);
    });
};

// Export with debugging function
module.exports = {
    initializeWebSocket,
    startGameTickSystem: async () => {
        try {
            console.log('🕐 Starting ISOLATED game tick system...');
            
            const servicesReady = loadServices();
            if (!servicesReady) {
                console.warn('⚠️ Services not ready, retrying...');
                setTimeout(module.exports.startGameTickSystem, 3000);
                return;
            }
            
            // Initialize periods for all combinations
            Object.entries(GAME_CONFIGS).forEach(([gameType, durations]) => {
                durations.forEach(duration => {
                    TIMELINES.forEach(timeline => {
                        const key = `${gameType}_${duration}_${timeline}`;
                        
                        // Calculate periods for this specific timeline
                        const periods = calculateRealTimePeriod(gameType, duration, timeline);
                        
                        // Store periods
                        currentPeriods.set(key, periods.current);
                        nextPeriods.set(key, periods.next);
                        
                        console.log(`📅 Loaded [${gameType}|${duration}s|${timeline}]: Current ${periods.current.periodId}, Next ${periods.next.periodId}`);
                        
                        // Start isolated ticks
                        startGameTicks(gameType, duration, timeline);
                    });
                });
            });
            
            gameTicksStarted = true;
            console.log('✅ ISOLATED game tick system started');
            
            // Start room verification every 2 minutes
            setInterval(verifyRoomIsolation, 120000);
            
            if (io) {
                io.emit('gameTicksStarted', {
                    message: 'ISOLATED game tick system active',
                    supportedGames: Object.keys(GAME_CONFIGS),
                    supportedTimelines: TIMELINES,
                    timestamp: new Date().toISOString()
                });
            }
            
        } catch (error) {
            console.error('❌ Error starting isolated game tick system:', error);
            setTimeout(module.exports.startGameTickSystem, 5000);
        }
    },
    
    broadcastToGame: (gameType, duration, timeline, event, data) => {
        try {
            if (!io) {
                console.warn('⚠️ WebSocket not initialized');
                return;
            }

            const exactRoomId = `${gameType}_${duration}_${timeline}`;
            
            io.to(exactRoomId).emit(event, {
                ...data,
                gameType,
                duration,
                timeline,
                roomId: exactRoomId
            });
            
            console.log(`📢 Broadcast ${event} to EXACT room: ${exactRoomId}`);
            
        } catch (error) {
            console.error('❌ Error broadcasting to game:', error);
        }
    },
    
    broadcastToAll: (event, data) => {
        try {
            if (!io) {
                console.warn(`⚠️ WebSocket not initialized, cannot broadcast ${event}`);
                return;
            }
            
            io.emit(event, {
                ...data,
                supportedGames: Object.keys(GAME_CONFIGS),
                supportedTimelines: TIMELINES
            });
            console.log(`📢 Broadcast ${event} to all clients`);
        } catch (error) {
            console.error(`❌ Error broadcasting to all:`, error.message);
        }
    },
    
    getCurrentPeriodInfo: (gameType, duration, timeline = 'default') => {
        const key = `${gameType}_${duration}_${timeline}`;
        const cached = currentPeriods.get(key);
        
        if (cached) {
            return cached;
        }
        
        // Calculate if not cached
        const periods = calculateRealTimePeriod(gameType, duration, timeline);
        return periods.current;
    },
    
    getAllCurrentPeriods: (gameType) => {
        const allPeriods = {};
        
        const durations = GAME_CONFIGS[gameType] || [];
        durations.forEach(duration => {
            allPeriods[duration] = {};
            TIMELINES.forEach(timeline => {
                const key = `${gameType}_${duration}_${timeline}`;
                const cached = currentPeriods.get(key);
                if (cached) {
                    allPeriods[duration][timeline] = cached;
                }
            });
        });
        
        return allPeriods;
    },
    
    getSystemStats: () => {
        return {
            connectedClients: io ? io.sockets.sockets.size : 0,
            activeGameIntervals: gameIntervals.size,
            cachedPeriods: currentPeriods.size,
            preLoadedPeriods: nextPeriods.size,
            processingLocks: resultProcessingLocks.size,
            gameTicksStarted: gameTicksStarted,
            supportedGames: Object.keys(GAME_CONFIGS),
            supportedTimelines: TIMELINES,
            gameConfigs: GAME_CONFIGS
        };
    },
    
    verifyGameTicks: () => {
        console.log('🔍 Verifying ISOLATED game tick system...');
        
        const activeIntervals = gameIntervals.size;
        const expectedIntervals = Object.values(GAME_CONFIGS).reduce((sum, durations) => sum + durations.length, 0) * TIMELINES.length;
        
        console.log(`📊 ISOLATED Game ticks status:`);
        console.log(`   - Active intervals: ${activeIntervals}`);
        console.log(`   - Expected intervals: ${expectedIntervals}`);
        console.log(`   - System started: ${gameTicksStarted}`);
        console.log(`   - Cached periods: ${currentPeriods.size}`);
        console.log(`   - Processing locks: ${resultProcessingLocks.size}`);
        console.log(`   - Supported timelines: ${TIMELINES.join(', ')}`);
        
        // Show detailed status
        Object.keys(GAME_CONFIGS).forEach(gameType => {
            console.log(`\n📋 ${gameType.toUpperCase()} ISOLATED Status:`);
            GAME_CONFIGS[gameType].forEach(duration => {
                TIMELINES.forEach(timeline => {
                    const key = `${gameType}_${duration}_${timeline}`;
                    const period = currentPeriods.get(key);
                    const nextPeriod = nextPeriods.get(key);
                    const roomId = `${gameType}_${duration}_${timeline}`;
                    
                    if (period) {
                        // Check room status
                        const room = io?.sockets?.adapter?.rooms?.get(roomId);
                        const clientCount = room ? room.size : 0;
                        
                        console.log(`   - ${duration}s ${timeline}: Period ${period.periodId} (${Math.floor(period.timeRemaining)}s) → Room ${roomId} (${clientCount} clients)`);
                    }
                });
            });
        });
        
        if (activeIntervals === expectedIntervals && gameTicksStarted) {
            console.log('\n✅ ISOLATED game tick system working correctly');
        } else {
            console.warn('\n⚠️ ISOLATED game tick system has issues');
            console.log(`Expected: ${expectedIntervals}, Active: ${activeIntervals}, Started: ${gameTicksStarted}`);
        }
        
        return {
            active: activeIntervals,
            expected: expectedIntervals,
            started: gameTicksStarted,
            cachedPeriods: currentPeriods.size,
            preLoadedPeriods: nextPeriods.size,
            processingLocks: resultProcessingLocks.size,
            supportedTimelines: TIMELINES.length,
            working: activeIntervals === expectedIntervals && gameTicksStarted
        };
    },
    
    getIo: () => io,
    
    stopGameTicks: () => {
        gameIntervals.forEach((intervalId, key) => {
            clearInterval(intervalId);
            console.log(`⏹️ Stopped ISOLATED ticks for ${key}`);
        });
        gameIntervals.clear();
        currentPeriods.clear();
        nextPeriods.clear();
        resultProcessingLocks.clear();
        gameTicksStarted = false;
        console.log('🛑 All ISOLATED game ticks stopped');
    },
    
    // DEBUGGING EXPORTS
    verifyRoomIsolation,
    GAME_CONFIGS,
    TIMELINES,
    calculateRealTimePeriod,
    
    // Force room verification
    debugRooms: () => {
        console.log('\n🔧 DEBUG: FORCE ROOM VERIFICATION');
        verifyRoomIsolation();
        
        console.log('\n🔧 DEBUG: GAME INTERVALS');
        gameIntervals.forEach((intervalId, key) => {
            console.log(`⏰ ${key}: Active`);
        });
        
        console.log('\n🔧 DEBUG: CURRENT PERIODS');
        currentPeriods.forEach((period, key) => {
            console.log(`📅 ${key}: ${period.periodId} (${Math.floor(period.timeRemaining)}s)`);
        });
        
        return {
            totalRooms: io?.sockets?.adapter?.rooms?.size || 0,
            gameIntervals: gameIntervals.size,
            currentPeriods: currentPeriods.size,
            nextPeriods: nextPeriods.size
        };
    }
};