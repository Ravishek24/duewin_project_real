// Backend/services/websocketService.js - ZERO DELAY VERSION

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

// ENHANCED: Period cache with pre-loaded next periods
const currentPeriods = new Map();
const nextPeriods = new Map(); // PRE-LOADED next periods
const resultProcessingLocks = new Set(); // Track which periods are being processed

// Constants
const GAME_CONFIGS = {
    wingo: [30, 60, 180, 300],    // 30s, 1m, 3m, 5m
    trx_wix: [30, 60, 180, 300],  // 30s, 1m, 3m, 5m
    fiveD: [60, 180, 300, 600],   // 1m, 3m, 5m, 10m
    k3: [60, 180, 300, 600]       // 1m, 3m, 5m, 10m
};

/**
 * Calculate real-time period information with pre-calculation
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
        
        // Calculate when current period started and ends
        const currentPeriodStart = startOfPeriods.clone().add(currentPeriodNumber * duration, 'seconds');
        const currentPeriodEnd = currentPeriodStart.clone().add(duration, 'seconds');
        
        // ENHANCED: More precise time remaining calculation
        const timeRemaining = Math.max(0, Math.ceil(currentPeriodEnd.diff(istMoment) / 1000));
        
        // Generate period ID
        const dateStr = startOfPeriods.format('YYYYMMDD');
        const periodId = `${dateStr}${currentPeriodNumber.toString().padStart(9, '0')}`;
        
        // PRE-CALCULATE next period info
        const nextPeriodNumber = currentPeriodNumber + 1;
        const nextPeriodId = `${dateStr}${nextPeriodNumber.toString().padStart(9, '0')}`;
        const nextPeriodStart = currentPeriodEnd.clone();
        const nextPeriodEnd = nextPeriodStart.clone().add(duration, 'seconds');
        
        return {
            current: {
                periodId,
                gameType,
                duration,
                startTime: currentPeriodStart.toDate(),
                endTime: currentPeriodEnd.toDate(),
                timeRemaining,
                active: timeRemaining > 0,
                bettingOpen: timeRemaining > 5,
                currentPeriodNumber
            },
            next: {
                periodId: nextPeriodId,
                gameType,
                duration,
                startTime: nextPeriodStart.toDate(),
                endTime: nextPeriodEnd.toDate(),
                timeRemaining: timeRemaining + duration,
                active: false, // Will be active when current ends
                bettingOpen: false,
                currentPeriodNumber: nextPeriodNumber
            }
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
                    timeline: 'default'
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
 * ENHANCED: Start the game tick system with pre-loaded periods
 */
const startGameTickSystem = async () => {
    try {
        console.log('🕐 Starting game tick system with pre-loading...');
        
        // Load services
        const servicesReady = loadServices();
        if (!servicesReady) {
            console.warn('⚠️ Services not ready, retrying in 3 seconds...');
            setTimeout(startGameTickSystem, 3000);
            return;
        }
        
        // ENHANCED: Initialize current AND next periods for all games
        Object.entries(GAME_CONFIGS).forEach(([gameType, durations]) => {
            durations.forEach(duration => {
                const key = `${gameType}_${duration}`;
                
                // Calculate current and next periods
                const periods = calculateRealTimePeriod(gameType, duration);
                
                // Store both current and next periods
                currentPeriods.set(key, periods.current);
                nextPeriods.set(key, periods.next);
                
                console.log(`📅 Pre-loaded ${key}:`);
                console.log(`   Current: ${periods.current.periodId} (${periods.current.timeRemaining}s)`);
                console.log(`   Next: ${periods.next.periodId} (ready)`);
                
                // Initialize BOTH periods in database asynchronously
                if (periodService && periodService.initializePeriod) {
                    // Initialize current period
                    periodService.initializePeriod(gameType, duration, periods.current.periodId)
                        .catch(err => console.warn(`Failed to initialize current period ${periods.current.periodId}:`, err.message));
                    
                    // PRE-INITIALIZE next period
                    periodService.initializePeriod(gameType, duration, periods.next.periodId)
                        .catch(err => console.warn(`Failed to pre-initialize next period ${periods.next.periodId}:`, err.message));
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
        console.log('✅ Game tick system started with pre-loaded periods');
        
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
 * ENHANCED: Game tick with ZERO DELAY period transitions
 */
const gameTick = async (gameType, duration) => {
    try {
        // Skip if Redis not connected
        if (!isConnected()) {
            return;
        }

        const now = new Date();
        const key = `${gameType}_${duration}`;
        
        // Get current cached periods
        const cachedCurrent = currentPeriods.get(key);
        const cachedNext = nextPeriods.get(key);
        
        // Calculate real-time periods
        const realTimePeriods = calculateRealTimePeriod(gameType, duration, now);
        
        // CHECK: If current period has changed, we need to transition INSTANTLY
        if (!cachedCurrent || cachedCurrent.periodId !== realTimePeriods.current.periodId) {
            console.log(`⚡ INSTANT TRANSITION: ${gameType} ${duration}s: ${cachedCurrent?.periodId} -> ${realTimePeriods.current.periodId}`);
            
            // Process previous period results in background (NON-BLOCKING)
            if (cachedCurrent && cachedCurrent.periodId !== realTimePeriods.current.periodId) {
                // Process results without awaiting to avoid blocking
                setImmediate(() => {
                    handlePeriodEnd(gameType, duration, cachedCurrent.periodId, `${gameType}_${duration}`);
                });
            }
            
            // INSTANT UPDATE: Use pre-loaded next period as current
            if (cachedNext && cachedNext.periodId === realTimePeriods.current.periodId) {
                console.log(`🚀 Using PRE-LOADED period: ${cachedNext.periodId}`);
                
                // Move next period to current (ZERO DELAY)
                currentPeriods.set(key, {
                    ...cachedNext,
                    active: true,
                    bettingOpen: true,
                    timeRemaining: realTimePeriods.current.timeRemaining
                });
            } else {
                // Fallback: Calculate current period
                currentPeriods.set(key, realTimePeriods.current);
                console.warn(`⚠️ Using calculated period: ${realTimePeriods.current.periodId}`);
            }
            
            // PRE-LOAD next-next period
            nextPeriods.set(key, realTimePeriods.next);
            
            // Pre-initialize the new next period in database (background)
            if (loadServices() && periodService.initializePeriod) {
                setImmediate(() => {
                    periodService.initializePeriod(gameType, duration, realTimePeriods.next.periodId)
                        .catch(err => console.warn(`Failed to pre-initialize period ${realTimePeriods.next.periodId}:`, err.message));
                });
            }
            
            // INSTANT BROADCAST: New period started
            const roomId = `${gameType}_${duration}`;
            const currentPeriod = currentPeriods.get(key);
            
            io.to(roomId).emit('periodStart', {
                gameType,
                duration,
                periodId: currentPeriod.periodId,
                timeRemaining: Math.floor(currentPeriod.timeRemaining),
                endTime: currentPeriod.endTime.toISOString(),
                message: 'New period started - betting is open!',
                transition: 'instant',
                preLoaded: cachedNext && cachedNext.periodId === realTimePeriods.current.periodId
            });
            
            console.log(`⚡ ZERO-DELAY broadcast: Period ${currentPeriod.periodId} for ${gameType} ${duration}s`);
        }
        
        // Update time remaining for current period
        const currentPeriod = currentPeriods.get(key);
        if (currentPeriod) {
            currentPeriod.timeRemaining = realTimePeriods.current.timeRemaining;
            currentPeriod.bettingOpen = realTimePeriods.current.bettingOpen;
        }
        
        const { periodId, timeRemaining, endTime, bettingOpen } = currentPeriod || realTimePeriods.current;
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

        // Pre-load warning at 10 seconds
        if (timeRemaining === 10) {
            console.log(`🔄 Pre-loading next period for ${gameType} ${duration}s in 10 seconds...`);
        }

        // Reduced logging frequency
        const logInterval = timeRemaining > 60 ? 30 : 10;
        if (Math.floor(timeRemaining) % logInterval === 0 && timeRemaining > 0) {
            const nextPeriod = nextPeriods.get(key);
            console.log(`Game tick: ${gameType}, ${duration}s, Current: ${periodId}, Time: ${Math.floor(timeRemaining)}s, Next ready: ${nextPeriod?.periodId}`);
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
 * ENHANCED: Handle period end with STRICT duplicate prevention
 */
const handlePeriodEnd = async (gameType, duration, periodId, roomId) => {
    const globalLockKey = `global_result_${gameType}_${duration}_${periodId}`;
    const processKey = `${gameType}_${duration}_${periodId}`;
    
    try {
        // FIRST CHECK: Local memory lock to prevent multiple calls
        if (resultProcessingLocks.has(processKey)) {
            console.log(`🔒 Period ${periodId} already being processed locally, skipping...`);
            return;
        }
        
        // Add to local processing locks immediately
        resultProcessingLocks.add(processKey);
        
        console.log(`🏁 Period end processing: ${gameType} ${duration}s - ${periodId}`);
        
        // SECOND CHECK: Global Redis lock to prevent cross-process duplicates
        const lockValue = `${Date.now()}_${process.pid}_websocket`;
        const lockAcquired = await redis.set(globalLockKey, lockValue, 'EX', 60, 'NX');
        
        if (!lockAcquired) {
            console.log(`⚠️ Period ${periodId} already being processed globally, waiting for result...`);
            
            // Wait for result and broadcast when available
            let attempts = 0;
            while (attempts < 15) { // Wait up to 15 seconds
                const existingResult = await checkExistingResult(gameType, duration, periodId);
                if (existingResult) {
                    console.log(`✅ Found existing result for ${periodId}, broadcasting...`);
                    
                    const resultData = {
                        gameType,
                        duration,
                        periodId,
                        result: existingResult.result,
                        winners: existingResult.winners || 0,
                        timestamp: new Date().toISOString(),
                        source: 'existing'
                    };
                    
                    io.to(roomId).emit('periodResult', resultData);
                    io.to('games').emit('gameResult', resultData);
                    return;
                }
                
                await new Promise(resolve => setTimeout(resolve, 1000));
                attempts++;
            }
            
            console.warn(`⚠️ No result found after waiting for ${periodId}`);
            return;
        }
        
        console.log(`🔒 Acquired GLOBAL result lock for ${periodId}`);
        
        if (!loadServices()) {
            console.error('❌ Services not ready for period end processing');
            await redis.del(globalLockKey);
            return;
        }
        
        // THIRD CHECK: Database existence check
        try {
            const existingResult = await checkExistingResult(gameType, duration, periodId);
            if (existingResult) {
                console.log(`✅ Result already exists in DB for ${periodId}, broadcasting existing result`);
                
                const resultData = {
                    gameType,
                    duration,
                    periodId,
                    result: existingResult.result,
                    winners: existingResult.winners || 0,
                    timestamp: new Date().toISOString(),
                    source: 'existing'
                };
                
                io.to(roomId).emit('periodResult', resultData);
                io.to('games').emit('gameResult', resultData);
                
                await redis.del(globalLockKey);
                return;
            }
        } catch (checkError) {
            console.warn(`⚠️ Error checking existing result for ${periodId}:`, checkError.message);
        }
        
        // Process new game results ONLY if no existing result
        try {
            console.log(`🎲 Processing NEW results for ${periodId}...`);
            
            const gameResult = await gameLogicService.processGameResults(
                gameType, 
                duration, 
                periodId, 
                'default' // timeline
            );
            
            if (gameResult.success) {
                const resultData = {
                    gameType,
                    duration,
                    periodId,
                    result: gameResult.gameResult,
                    winners: gameResult.winners?.length || 0,
                    timestamp: new Date().toISOString(),
                    source: 'new',
                    processor: 'websocket'
                };
                
                io.to(roomId).emit('periodResult', resultData);
                io.to('games').emit('gameResult', resultData);
                
                console.log(`📢 Broadcasted NEW result for ${gameType} ${duration}s - ${periodId}`);
                console.log(`🏆 Result: ${JSON.stringify(gameResult.gameResult)}, Winners: ${gameResult.winners?.length || 0}`);
                
            } else {
                throw new Error(gameResult.message || 'Failed to process results');
            }
            
        } catch (processError) {
            console.error(`❌ Error processing game results for ${periodId}:`, processError.message);
            
            io.to(roomId).emit('periodError', {
                gameType,
                duration,
                periodId,
                message: 'Error processing results',
                timestamp: new Date().toISOString()
            });
        } finally {
            // Always release the global lock
            try {
                const currentLock = await redis.get(globalLockKey);
                if (currentLock === lockValue) {
                    await redis.del(globalLockKey);
                    console.log(`🔓 Released global result lock for ${periodId}`);
                }
            } catch (lockError) {
                console.error('❌ Error releasing global lock:', lockError);
            }
        }

    } catch (error) {
        console.error(`❌ Error handling period end for ${gameType} ${duration}s:`, error);
        
        // Cleanup on error
        try {
            await redis.del(globalLockKey);
        } catch (cleanupError) {
            console.error('❌ Error cleaning up lock:', cleanupError);
        }
    } finally {
        // ALWAYS remove from local processing locks
        resultProcessingLocks.delete(processKey);
        
        // Clean up old locks periodically
        if (resultProcessingLocks.size > 100) {
            console.log(`🧹 Cleaning up ${resultProcessingLocks.size} processing locks`);
            resultProcessingLocks.clear();
        }
    }
};

/**
 * Check if result already exists for a period
 */
const checkExistingResult = async (gameType, duration, periodId) => {
    try {
        if (!loadServices()) {
            return null;
        }
        
        const models = await gameLogicService.ensureModelsInitialized();
        
        let existingResult = null;
        
        switch (gameType.toLowerCase()) {
            case 'wingo':
                existingResult = await models.BetResultWingo.findOne({
                    where: { 
                        bet_number: periodId,
                        duration: duration,
                        timeline: 'default'
                    },
                    order: [['created_at', 'DESC']]
                });
                
                if (existingResult) {
                    return {
                        result: {
                            number: existingResult.result_of_number,
                            color: existingResult.result_of_color,
                            size: existingResult.result_of_size
                        },
                        winners: 0
                    };
                }
                break;
                
            case 'trx_wix':
                existingResult = await models.BetResultTrxWix.findOne({
                    where: { 
                        period: periodId,
                        duration: duration,
                        timeline: 'default'
                    },
                    order: [['created_at', 'DESC']]
                });
                
                if (existingResult) {
                    let resultData;
                    try {
                        resultData = typeof existingResult.result === 'string' ? 
                            JSON.parse(existingResult.result) : existingResult.result;
                    } catch (parseError) {
                        console.warn('Error parsing existing result:', parseError);
                        return null;
                    }
                    
                    return {
                        result: resultData,
                        winners: 0
                    };
                }
                break;
                
            // Add other game types as needed
            case 'fived':
            case '5d':
                existingResult = await models.BetResult5D.findOne({
                    where: { 
                        bet_number: periodId,
                        duration: duration,
                        timeline: 'default'
                    },
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
                        winners: 0
                    };
                }
                break;
                
            case 'k3':
                existingResult = await models.BetResultK3.findOne({
                    where: { 
                        bet_number: periodId,
                        duration: duration,
                        timeline: 'default'
                    },
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
                        winners: 0
                    };
                }
                break;
        }
        
        return null;
        
    } catch (error) {
        console.error('Error checking existing result:', error);
        return null;
    }
};

/**
 * ENHANCED: Send current game state with pre-loaded info
 */
const sendCurrentGameState = async (socket, gameType, duration) => {
    try {
        const key = `${gameType}_${duration}`;
        
        // Get current period from cache (faster than calculation)
        let currentPeriod = currentPeriods.get(key);
        
        if (!currentPeriod) {
            // Fallback: Calculate real-time period
            const periods = calculateRealTimePeriod(gameType, duration);
            currentPeriod = periods.current;
        }
        
        // Send current period info immediately
        socket.emit('periodInfo', {
            gameType,
            duration,
            periodId: currentPeriod.periodId,
            timeRemaining: Math.floor(currentPeriod.timeRemaining),
            endTime: currentPeriod.endTime.toISOString(),
            bettingOpen: currentPeriod.bettingOpen,
            timestamp: new Date().toISOString(),
            immediate: true,
            preLoaded: true
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

        console.log(`📤 Sent INSTANT game state to user for ${gameType} ${duration}s - Period: ${currentPeriod.periodId}, Time: ${Math.floor(currentPeriod.timeRemaining)}s`);

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
    const periods = calculateRealTimePeriod(gameType, duration);
    return periods.current;
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
    console.log(`   - Pre-loaded periods: ${nextPeriods.size}`);
    console.log(`   - Processing locks: ${resultProcessingLocks.size}`);
    
    // Show current periods
    currentPeriods.forEach((period, key) => {
        const nextPeriod = nextPeriods.get(key);
        console.log(`   - ${key}: Current ${period.periodId} (${Math.floor(period.timeRemaining)}s), Next ${nextPeriod?.periodId} (ready)`);
    });
    
    if (activeIntervals === expectedIntervals && gameTicksStarted) {
        console.log('✅ Game tick system is working correctly with pre-loading');
    } else {
        console.warn('⚠️ Game tick system may have issues');
    }
    
    return {
        active: activeIntervals,
        expected: expectedIntervals,
        started: gameTicksStarted,
        cachedPeriods: currentPeriods.size,
        preLoadedPeriods: nextPeriods.size,
        processingLocks: resultProcessingLocks.size,
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
    nextPeriods.clear();
    resultProcessingLocks.clear();
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