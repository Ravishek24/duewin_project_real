// Backend/config/socketConfig.js - WebSocket Configuration for Game Results
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

                // Send current period info if available
                sendCurrentPeriodInfo(socket, gameType, duration);
                
            } catch (error) {
                console.error('Error joining game room:', error);
                socket.emit('error', { message: 'Failed to join game room' });
            }
        });

        // Handle leaving specific game rooms
        socket.on('leaveGame', (data) => {
            try {
                const { gameType, duration } = data;
                
                if (gameType && duration) {
                    const roomName = `${gameType}_${duration}`;
                    socket.leave(roomName);
                    
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
        socket.on('betPlaced', (data) => {
            try {
                const { gameType, duration, periodId, userId, betData } = data;
                
                if (gameType && duration && periodId) {
                    const roomName = `${gameType}_${duration}`;
                    
                    // Broadcast bet placement to other users in the same game
                    socket.to(roomName).emit('newBet', {
                        gameType,
                        duration,
                        periodId,
                        betAmount: betData.betAmount,
                        betType: betData.betType,
                        timestamp: new Date().toISOString()
                    });
                }
            } catch (error) {
                console.error('Error handling bet placement:', error);
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

                // Get period status from game logic service
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
        
        const broadcastData = {
            type: 'gameResult',
            gameType,
            duration,
            periodId,
            result,
            winners: winners.map(winner => ({
                userId: winner.userId,
                winAmount: winner.winnings,
                betType: winner.betType
            })),
            timestamp: new Date().toISOString()
        };

        // Add verification for trx_wix
        if (gameType === 'trx_wix' && result.verification) {
            broadcastData.verification = result.verification;
        }

        // Broadcast to specific game room
        io.to(roomName).emit('gameResult', broadcastData);
        
        // Also broadcast to general games room
        io.to('games').emit('gameResult', broadcastData);

        console.log(`📡 Game result broadcasted to ${roomName}:`, {
            periodId,
            result: typeof result === 'object' ? JSON.stringify(result) : result,
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

module.exports = {
    setIo,
    getIo,
    setupGameEventHandlers,
    broadcastGameResult,
    broadcastPeriodCountdown,
    broadcastNewPeriod,
    getGameRoomClientsCount
};