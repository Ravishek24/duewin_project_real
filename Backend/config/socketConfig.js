// Backend/config/socketConfig.js - ENHANCED WITH ADMIN LIVE DISTRIBUTION
let io = null;

/**
 * Set Socket.IO instance
 * @param {Object} socketIoInstance - Socket.IO server instance
 */
const setIo = (socketIoInstance) => {
    io = socketIoInstance;
    console.log('✅ Socket.IO instance set for game broadcasting');
    
    // Set up game-specific event handlers
    setupGameEventHandlers();
};

/**
 * Get Socket.IO instance
 * @returns {Object} Socket.IO server instance
 */
const getIo = () => {
    if (!io) {
        console.warn('⚠️ Socket.IO instance not initialized');
        return null;
    }
    return io;
};

/**
 * Setup game-specific event handlers
 */
const setupGameEventHandlers = () => {
    if (!io) return;

    io.on('connection', (socket) => {
        console.log(`🔌 New client connected: ${socket.id}`);

        // Join general games room
        socket.join('games');

        // Handle user authentication and role checking
        socket.on('authenticate', async (data) => {
            try {
                const { token, userId, isAdmin } = data;
                
                // Store user info in socket
                socket.userId = userId;
                socket.isAdmin = isAdmin;
                
                if (isAdmin) {
                    socket.join('admins');
                    console.log(`👨‍💼 Admin ${userId} connected: ${socket.id}`);
                    
                    // Send current admin dashboard data
                    await sendAdminDashboardData(socket);
                }
                
                socket.emit('authenticated', {
                    success: true,
                    userId,
                    isAdmin,
                    rooms: ['games', ...(isAdmin ? ['admins'] : [])]
                });
                
            } catch (error) {
                console.error('Authentication error:', error);
                socket.emit('authError', { message: 'Authentication failed' });
            }
        });

        // Handle joining specific game rooms
        socket.on('joinGame', (data) => {
            try {
                const { gameType, duration } = data;
                
                if (!gameType || !duration) {
                    socket.emit('error', { message: 'Game type and duration required' });
                    return;
                }

                const roomName = `${gameType}_${duration}`;
                socket.join(roomName);
                
                console.log(`👤 Client ${socket.id} joined game room: ${roomName}`);
                
                socket.emit('joinedGame', {
                    success: true,
                    gameType,
                    duration,
                    room: roomName
                });

                // Send current period info
                sendCurrentPeriodInfo(socket, gameType, duration);
                
                // If admin, also join admin room for this game
                if (socket.isAdmin) {
                    const adminRoomName = `admin_${gameType}_${duration}`;
                    socket.join(adminRoomName);
                    
                    // Send live bet distribution
                    sendLiveBetDistribution(socket, gameType, duration);
                }
                
            } catch (error) {
                console.error('Error joining game room:', error);
                socket.emit('error', { message: 'Failed to join game room' });
            }
        });

        // Handle admin requesting live bet distribution
        socket.on('requestBetDistribution', async (data) => {
            try {
                if (!socket.isAdmin) {
                    socket.emit('error', { message: 'Admin access required' });
                    return;
                }

                const { gameType, duration, periodId } = data;
                
                if (!gameType || !duration || !periodId) {
                    socket.emit('error', { message: 'Game type, duration, and period ID required' });
                    return;
                }

                await sendLiveBetDistribution(socket, gameType, duration, periodId);
                
            } catch (error) {
                console.error('Error sending bet distribution:', error);
                socket.emit('error', { message: 'Failed to get bet distribution' });
            }
        });

        // Handle admin requesting optimization analysis
        socket.on('requestOptimizationAnalysis', async (data) => {
            try {
                if (!socket.isAdmin) {
                    socket.emit('error', { message: 'Admin access required' });
                    return;
                }

                const { gameType, duration, periodId } = data;
                const gameLogicService = require('../services/gameLogicService');
                
                const analysis = await gameLogicService.calculateOptimizedResult(gameType, duration, periodId);
                const periodInfo = await gameLogicService.getEnhancedPeriodStatus(gameType, duration, periodId);
                
                socket.emit('optimizationAnalysis', {
                    gameType,
                    duration,
                    periodId,
                    analysis,
                    periodInfo: periodInfo.data,
                    timestamp: new Date().toISOString()
                });
                
            } catch (error) {
                console.error('Error getting optimization analysis:', error);
                socket.emit('error', { message: 'Failed to get optimization analysis' });
            }
        });

        // Handle leaving specific game rooms
        socket.on('leaveGame', (data) => {
            try {
                const { gameType, duration } = data;
                
                if (gameType && duration) {
                    const roomName = `${gameType}_${duration}`;
                    const adminRoomName = `admin_${gameType}_${duration}`;
                    
                    socket.leave(roomName);
                    socket.leave(adminRoomName);
                    
                    console.log(`👋 Client ${socket.id} left game room: ${roomName}`);
                    
                    socket.emit('leftGame', {
                        success: true,
                        gameType,
                        duration,
                        room: roomName
                    });
                }
            } catch (error) {
                console.error('Error leaving game room:', error);
                socket.emit('error', { message: 'Failed to leave game room' });
            }
        });

        // Handle bet placement confirmation
        socket.on('betPlaced', async (data) => {
            try {
                const { gameType, duration, periodId, userId, betData } = data;
                
                if (gameType && duration && periodId) {
                    const roomName = `${gameType}_${duration}`;
                    const adminRoomName = `admin_${gameType}_${duration}`;
                    
                    // Broadcast bet placement to other users in the same game
                    socket.to(roomName).emit('newBet', {
                        gameType,
                        duration,
                        periodId,
                        betAmount: betData.betAmount,
                        betType: betData.betType,
                        timestamp: new Date().toISOString()
                    });

                    // Update live bet distribution for admins
                    await broadcastLiveBetDistribution(gameType, duration, periodId);
                }
            } catch (error) {
                console.error('Error handling bet placement:', error);
            }
        });

        // Handle bet placement
        socket.on('placeBet', async (data) => {
            try {
                const { gameType, duration, periodId, betType, betValue, betAmount } = data;
                const userId = socket.userId;

                if (!userId) {
                    socket.emit('betError', { message: 'User not authenticated' });
                    return;
                }

                if (!gameType || !duration || !periodId || !betType || !betValue || !betAmount) {
                    socket.emit('betError', { message: 'Missing required bet information' });
                    return;
                }

                // Process the bet using gameLogicService
                const gameLogicService = require('../services/gameLogicService');
                const betData = {
                    userId,
                    gameType,
                    duration: parseInt(duration),
                    periodId,
                    betType,
                    betValue,
                    betAmount: parseFloat(betAmount),
                    odds: gameLogicService.calculateOdds(gameType, betType, betValue)
                };

                const result = await gameLogicService.processBet(betData);

                if (!result.success) {
                    socket.emit('betError', {
                        message: result.message,
                        code: result.code
                    });
                    return;
                }

                // Broadcast successful bet placement
                const roomName = `${gameType}_${duration}`;
                const adminRoomName = `admin_${gameType}_${duration}`;

                // Broadcast to game room
                io.to(roomName).emit('newBet', {
                    gameType,
                    duration,
                    periodId,
                    betAmount: betAmount,
                    betType,
                    betValue,
                    timestamp: new Date().toISOString()
                });

                // Broadcast to admin room
                io.to(adminRoomName).emit('newBet', {
                    gameType,
                    duration,
                    periodId,
                    betAmount: betAmount,
                    betType,
                    betValue,
                    userId,
                    timestamp: new Date().toISOString()
                });

                // Update live bet distribution for admins
                await broadcastLiveBetDistribution(gameType, duration, periodId);

                // Send success response to the user
                socket.emit('betPlaced', {
                    success: true,
                    data: {
                        betId: result.data.betId,
                        gameType,
                        duration,
                        periodId,
                        betType,
                        betValue,
                        betAmount: parseFloat(betAmount),
                        odds: result.data.odds,
                        expectedWin: result.data.expectedWin,
                        walletBalanceAfter: result.data.walletBalanceAfter
                    }
                });

            } catch (error) {
                console.error('Error processing bet:', error);
                socket.emit('betError', {
                    message: 'Failed to process bet',
                    code: 'PROCESSING_ERROR'
                });
            }
        });

        // Handle period status requests
        socket.on('getPeriodStatus', async (data) => {
            try {
                const { gameType, duration, periodId } = data;
                
                if (!gameType || !duration || !periodId) {
                    socket.emit('error', { message: 'Game type, duration, and period ID required' });
                    return;
                }

                const gameLogicService = require('../services/gameLogicService');
                const periodStatus = await gameLogicService.getEnhancedPeriodStatus(gameType, duration, periodId);
                
                socket.emit('periodStatus', periodStatus);
                
            } catch (error) {
                console.error('Error getting period status:', error);
                socket.emit('error', { message: 'Failed to get period status' });
            }
        });

        // Handle disconnect
        socket.on('disconnect', () => {
            console.log(`🔌 Client disconnected: ${socket.id}`);
        });
    });
};

/**
 * Send current period info to a socket
 * @param {Object} socket - Socket instance
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 */
const sendCurrentPeriodInfo = async (socket, gameType, duration) => {
    try {
        const gameLogicService = require('../services/gameLogicService');
        
        // Get current active period
        const activePeriods = await gameLogicService.getActivePeriods(gameType);
        const currentPeriod = activePeriods.find(p => p.duration === parseInt(duration));
        
        if (currentPeriod) {
            const periodStatus = await gameLogicService.getEnhancedPeriodStatus(
                gameType, 
                parseInt(duration), 
                currentPeriod.periodId
            );
            
            socket.emit('currentPeriod', periodStatus);
        }
    } catch (error) {
        console.error('Error sending current period info:', error);
    }
};

/**
 * Send live bet distribution to admin socket
 * @param {Object} socket - Socket instance
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 * @param {string} periodId - Period ID (optional, uses current if not provided)
 */
const sendLiveBetDistribution = async (socket, gameType, duration, periodId = null) => {
    try {
        const gameLogicService = require('../services/gameLogicService');
        
        // Get current period if not provided
        if (!periodId) {
            const activePeriods = await gameLogicService.getActivePeriods(gameType);
            const currentPeriod = activePeriods.find(p => p.duration === parseInt(duration));
            if (!currentPeriod) return;
            periodId = currentPeriod.periodId;
        }
        
        // Get bet distribution
        const distribution = await gameLogicService.getBetDistribution(gameType, parseInt(duration), periodId);
        
        // Get optimization stats
        const optimizationStats = await gameLogicService.getPeriodOptimizationStats(gameType, parseInt(duration), periodId);
        
        // Send to admin
        socket.emit('liveBetDistribution', {
            gameType,
            duration: parseInt(duration),
            periodId,
            distribution,
            optimizationStats,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error sending live bet distribution:', error);
    }
};

/**
 * Broadcast live bet distribution to all admins in a game room
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 * @param {string} periodId - Period ID
 */
const broadcastLiveBetDistribution = async (gameType, duration, periodId) => {
    if (!io) return;

    try {
        const gameLogicService = require('../services/gameLogicService');
        const adminRoomName = `admin_${gameType}_${duration}`;
        
        // Get bet distribution
        const distribution = await gameLogicService.getBetDistribution(gameType, duration, periodId);
        
        // Get optimization stats
        const optimizationStats = await gameLogicService.getPeriodOptimizationStats(gameType, duration, periodId);
        
        // Broadcast to all admins in this game room
        io.to(adminRoomName).emit('liveBetDistribution', {
            gameType,
            duration,
            periodId,
            distribution,
            optimizationStats,
            timestamp: new Date().toISOString()
        });

        // Also broadcast to general admin room
        io.to('admins').emit('liveBetDistribution', {
            gameType,
            duration,
            periodId,
            distribution,
            optimizationStats,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error broadcasting live bet distribution:', error);
    }
};

/**
 * Send admin dashboard data
 * @param {Object} socket - Admin socket
 */
const sendAdminDashboardData = async (socket) => {
    try {
        const gameLogicService = require('../services/gameLogicService');
        
        // Get active periods for all games
        const gameTypes = ['wingo', 'trx_wix', 'k3', 'fiveD'];
        const dashboardData = {};
        
        for (const gameType of gameTypes) {
            const activePeriods = await gameLogicService.getActivePeriods(gameType);
            dashboardData[gameType] = activePeriods;
        }
        
        // Get system health
        const systemHealth = await gameLogicService.getSystemHealthCheck();
        
        socket.emit('adminDashboard', {
            activePeriods: dashboardData,
            systemHealth,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error sending admin dashboard data:', error);
    }
};

/**
 * Broadcast game result to all clients in game rooms
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 * @param {string} periodId - Period ID
 * @param {Object} result - Game result
 * @param {Object} winners - Array of winners (optional)
 */
const broadcastGameResult = (gameType, duration, periodId, result, winners = []) => {
    if (!io) {
        console.warn('Cannot broadcast - Socket.IO not initialized');
        return;
    }

    try {
        const roomName = `${gameType}_${duration}`;
        
        // Enhanced result formatting based on game type
        let enhancedResult = { ...result };
        
        switch (gameType.toLowerCase()) {
            case 'wingo':
            case 'trx_wix':
                enhancedResult.parity = result.number % 2 === 0 ? 'even' : 'odd';
                if (gameType === 'trx_wix' && result.verification) {
                    enhancedResult.verification = result.verification;
                }
                break;
                
            case 'k3':
                // Ensure K3 result has all required fields
                enhancedResult = {
                    dice_1: result.dice_1,
                    dice_2: result.dice_2,
                    dice_3: result.dice_3,
                    sum: result.sum,
                    has_pair: result.has_pair,
                    has_triple: result.has_triple,
                    is_straight: result.is_straight,
                    sum_size: result.sum_size,
                    sum_parity: result.sum_parity
                };
                break;
                
            case 'fived':
            case '5d':
                // Ensure 5D result has all required fields
                enhancedResult = {
                    A: result.A,
                    B: result.B,
                    C: result.C,
                    D: result.D,
                    E: result.E,
                    sum: result.sum
                };
                break;
        }
        
        const broadcastData = {
            type: 'gameResult',
            gameType,
            duration,
            periodId,
            result: enhancedResult,
            winners: winners.map(winner => ({
                userId: winner.userId,
                winAmount: winner.winnings,
                betType: winner.betType
            })),
            timestamp: new Date().toISOString()
        };

        // Broadcast to specific game room
        io.to(roomName).emit('gameResult', broadcastData);
        
        // Also broadcast to general games room
        io.to('games').emit('gameResult', broadcastData);

        // Send additional admin data
        const adminRoomName = `admin_${gameType}_${duration}`;
        io.to(adminRoomName).emit('adminGameResult', {
            ...broadcastData,
            adminData: {
                totalPayout: winners.reduce((sum, w) => sum + w.winnings, 0),
                winnersCount: winners.length,
                profitLoss: result.totalBetAmount - winners.reduce((sum, w) => sum + w.winnings, 0)
            }
        });

        console.log(`📡 Game result broadcasted to ${roomName}:`, {
            periodId,
            result: typeof enhancedResult === 'object' ? JSON.stringify(enhancedResult) : enhancedResult,
            winnersCount: winners.length
        });

    } catch (error) {
        console.error('Error broadcasting game result:', error);
    }
};

/**
 * Broadcast period countdown updates
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 * @param {string} periodId - Period ID
 * @param {number} timeRemaining - Time remaining in seconds
 */
const broadcastPeriodCountdown = (gameType, duration, periodId, timeRemaining) => {
    if (!io) return;

    try {
        const roomName = `${gameType}_${duration}`;
        
        const countdownData = {
            type: 'periodCountdown',
            gameType,
            duration,
            periodId,
            timeRemaining: Math.max(0, Math.round(timeRemaining)),
            bettingTimeRemaining: Math.max(0, Math.round(timeRemaining - 5)),
            isBettingOpen: timeRemaining > 5,
            timestamp: new Date().toISOString()
        };

        io.to(roomName).emit('periodCountdown', countdownData);
        
        // Also send to general games room
        io.to('games').emit('periodCountdown', countdownData);

        // Update bet distribution for admins every 10 seconds
        if (Math.round(timeRemaining) % 10 === 0) {
            broadcastLiveBetDistribution(gameType, duration, periodId);
        }

    } catch (error) {
        console.error('Error broadcasting period countdown:', error);
    }
};

/**
 * Broadcast new period start
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 * @param {string} newPeriodId - New period ID
 */
const broadcastNewPeriod = (gameType, duration, newPeriodId) => {
    if (!io) return;

    try {
        const roomName = `${gameType}_${duration}`;
        const adminRoomName = `admin_${gameType}_${duration}`;
        
        const newPeriodData = {
            type: 'newPeriod',
            gameType,
            duration,
            periodId: newPeriodId,
            startTime: new Date().toISOString(),
            bettingOpen: true
        };

        io.to(roomName).emit('newPeriod', newPeriodData);
        io.to('games').emit('newPeriod', newPeriodData);
        
        // Initialize bet distribution for admins
        io.to(adminRoomName).emit('newPeriodAdmin', {
            ...newPeriodData,
            initialDistribution: {
                totalBetAmount: 0,
                distribution: [],
                uniqueUserCount: 0
            }
        });

        console.log(`🆕 New period broadcasted to ${roomName}: ${newPeriodId}`);

    } catch (error) {
        console.error('Error broadcasting new period:', error);
    }
};

/**
 * Get connected clients count for a game room
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 * @returns {number} - Number of connected clients
 */
const getGameRoomClientsCount = (gameType, duration) => {
    if (!io) return 0;

    try {
        const roomName = `${gameType}_${duration}`;
        const room = io.sockets.adapter.rooms.get(roomName);
        return room ? room.size : 0;
    } catch (error) {
        console.error('Error getting game room clients count:', error);
        return 0;
    }
};

/**
 * Get connected admin count
 * @returns {number} - Number of connected admins
 */
const getConnectedAdminCount = () => {
    if (!io) return 0;

    try {
        const adminRoom = io.sockets.adapter.rooms.get('admins');
        return adminRoom ? adminRoom.size : 0;
    } catch (error) {
        console.error('Error getting admin count:', error);
        return 0;
    }
};

module.exports = {
    setIo,
    getIo,
    setupGameEventHandlers,
    broadcastGameResult,
    broadcastPeriodCountdown,
    broadcastNewPeriod,
    broadcastLiveBetDistribution,
    getGameRoomClientsCount,
    getConnectedAdminCount
};