// Backend/services/websocketService.js
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/constants');
const { redis, isConnected } = require('../config/redisConfig');
const RateLimitService = require('./rateLimitService');
const RateLimiterService = require('./rateLimiterService');
const errorHandler = require('../utils/errorHandler');
const securityConfig = require('../config/securityConfig');
const { logger } = require('../utils/logger');
const Joi = require('joi');
const { 
  getActivePeriods, 
  getPeriodStatus, 
  generatePeriodId, 
  calculatePeriodEndTime 
} = require('./gameLogicService.js');
const WebSocket = require('ws');
const User = require('../models/User');

// Constants
const MAX_ROOM_SIZE = 1000;
const CONNECTION_TIMEOUT = 5 * 60 * 1000; // 5 minutes
const MESSAGE_RATE_LIMIT = {
    points: 5,
    duration: 1 // per second
};

// Socket.io server instance
let io;

// Connection manager
const connectionManager = {
    connections: new Map(),
    
    async addConnection(socket) {
        try {
            // Rate limiting checks bypassed
            console.log('Connection manager: Rate limiting checks bypassed for IP:', socket.handshake.address);
            
            this.connections.set(socket.id, {
                userId: socket.user.id,
                ip: socket.handshake.address,
                connectedAt: new Date(),
                lastActivity: new Date(),
                rooms: new Set()
            });
            
            logger.info('New connection established', {
                socketId: socket.id,
                userId: socket.user.id,
                ip: socket.handshake.address
            });
        } catch (error) {
            socketErrorHandler.handleError(socket, error, 'addConnection');
            throw error;
        }
    },
    
    async removeConnection(socket) {
        try {
            const conn = this.connections.get(socket.id);
            if (conn) {
                // Rate limiting checks bypassed
                console.log('Connection manager: Rate limiting cleanup bypassed for IP:', socket.handshake.address);
                
                await this.cleanupUserRooms(socket.user.id);
                this.connections.delete(socket.id);
                
                logger.info('Connection removed', {
                    socketId: socket.id,
                    userId: socket.user.id
                });
            }
        } catch (error) {
            logger.error('Error removing connection:', error);
        }
    },
    
    updateActivity(socket) {
        const conn = this.connections.get(socket.id);
        if (conn) {
            conn.lastActivity = new Date();
        }
    },
    
    async cleanupStaleConnections() {
        const now = new Date();
        for (const [id, conn] of this.connections) {
            if (now - conn.lastActivity > securityConfig.rateLimits.connection.timeout) {
                const socket = io.sockets.sockets.get(id);
                if (socket) {
                    await this.removeConnection(socket);
                    socket.disconnect(true);
                }
            }
        }
    },

    async cleanupUserRooms(userId) {
        try {
            const rooms = await redis.smembers(`user:${userId}:rooms`);
            for (const room of rooms) {
                await redis.srem(`user:${userId}:rooms`, room);
            }
        } catch (error) {
            logger.error('Error cleaning up user rooms:', error);
        }
    }
};

// Message validation schemas
const messageSchemas = {
    joinGame: Joi.object({
        gameType: Joi.string().valid(...securityConfig.game.validGameTypes).required(),
        duration: Joi.number().valid(...securityConfig.game.validDurations).required()
    }),
    bet: Joi.object({
        gameType: Joi.string().valid(...securityConfig.game.validGameTypes).required(),
        duration: Joi.number().valid(...securityConfig.game.validDurations).required(),
        amount: Joi.number()
            .min(securityConfig.game.minBetAmount)
            .max(securityConfig.game.maxBetAmount)
            .required(),
        betType: Joi.string().required()
    })
};

// Error handler
const socketErrorHandler = {
    handleError(socket, error, context) {
        logger.error({
            error: error.message,
            stack: error.stack,
            context,
            userId: socket.user?.id,
            socketId: socket.id
        });

        if (error.isOperational) {
            socket.emit('error', error.message);
        } else {
            socket.emit('error', 'An unexpected error occurred');
        }

        if (error.requiresDisconnect) {
            socket.disconnect(true);
        }
    }
};

// Rate limiter for messages - bypassed
const messageRateLimiter = {
    async checkLimit(socket, messageType) {
        // Rate limiting checks bypassed
        console.log('Message rate limiter: Rate limiting checks bypassed for IP:', socket.handshake.address);
        return true;
    }
};

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
                
                // For debugging
                console.log('WebSocket token decoded:', decoded);

                // Get user
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

                // Store client connection
                this.clients.set(userId, socket);

                // Send welcome message
                socket.send(JSON.stringify({
                    type: 'connection',
                    message: 'Connected successfully'
                }));

                // Handle messages
                socket.on('message', async (message) => {
                    try {
                        const data = JSON.parse(message);
                        
                        // Rate limiting checks bypassed for messages
                        console.log('WebSocket message: Rate limiting checks bypassed for IP:', socket.handshake.address);

                        // Handle different message types
                        switch (data.type) {
                            case 'ping':
                                socket.send(JSON.stringify({
                                    type: 'pong',
                                    timestamp: Date.now()
                                }));
                                break;
                            default:
                                console.log('Unknown message type:', data.type);
                        }
                    } catch (error) {
                        console.error('Error handling message:', error);
                        socket.send(JSON.stringify({
                            type: 'error',
                            message: 'Invalid message format'
                        }));
                    }
                });

                // Handle disconnection
                socket.on('close', () => {
                    this.clients.delete(userId);
                    console.log(`Client disconnected: ${userId}`);
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

/**
 * Initialize the WebSocket server
 * @param {Object} server - HTTP server instance
 */
const initializeWebSocket = (server) => {
    // Create Socket.io server with security options
    io = new Server(server, {
        cors: {
            origin: process.env.FRONTEND_URL,
            methods: ["GET", "POST"],
            credentials: true
        },
        pingTimeout: 60000,
        pingInterval: 25000,
        maxHttpBufferSize: 1e6, // 1MB
        transports: ['websocket'],
        allowEIO3: false
    });

    // Add security headers
    io.engine.on('headers', (headers, req) => {
        Object.entries(securityConfig.headers).forEach(([key, value]) => {
            headers[key] = value;
        });
    });

    // Authentication middleware
    io.use(async (socket, next) => {
        try {
            // Try to get token from auth object first
            let token = socket.handshake.auth.token;
            
            // If not found, check query params
            if (!token && socket.handshake.query && socket.handshake.query.token) {
                token = socket.handshake.query.token;
            }
            
            if (!token) {
                return next(new Error('Authentication required'));
            }

            // For debugging
            console.log('Socket.io auth: Token received, verifying...');

            // Verify token
            const decoded = jwt.verify(token, JWT_SECRET);
            
            // Check token expiration
            if (decoded.exp < Date.now() / 1000) {
                console.error('Socket.io auth: Token expired');
                return next(new Error('Token expired'));
            }

            console.log('Socket.io auth: Token valid for user:', decoded.userId || decoded.id);

            // Set user data on socket
            socket.user = decoded;
            next();
        } catch (error) {
            console.error('Socket.io auth error:', error.message);
            next(new Error('Invalid token'));
        }
    });

    // Connection event
    io.on('connection', (socket) => {
        try {
            // Add to connection manager
            connectionManager.addConnection(socket);

            // Join game room
            socket.on('joinGame', async (data) => {
                try {
                    // Rate limiting checks bypassed
                    console.log('Join game: Rate limiting checks bypassed for IP:', socket.handshake.address);

                    // Validate message
                    const { error, value } = messageSchemas.joinGame.validate(data);
                    if (error) {
                        throw new Error('Invalid join game data');
                    }

                    const { gameType, duration } = value;
                    const roomId = `${gameType}_${duration}`;

                    // Check room size
                    const roomSize = await io.sockets.adapter.rooms.get(roomId)?.size || 0;
                    if (roomSize >= securityConfig.game.maxRoomSize) {
                        throw new Error('Room is full');
                    }

                    // Join room
                    socket.join(roomId);
                    await redis.sadd(`user:${socket.user.id}:rooms`, roomId);
                    
                    // Send current game state
                    await sendGameState(socket, gameType, duration);
                    
                    logger.info('Client joined room', {
                        socketId: socket.id,
                        userId: socket.user.id,
                        roomId
                    });
                } catch (error) {
                    socketErrorHandler.handleError(socket, error, 'joinGame');
                }
            });

            // Handle bets
            socket.on('placeBet', async (data) => {
                try {
                    // Rate limiting checks bypassed
                    console.log('Place bet: Rate limiting checks bypassed for IP:', socket.handshake.address);

                    // Validate message
                    const { error, value } = messageSchemas.bet.validate(data);
                    if (error) {
                        throw new Error('Invalid bet data');
                    }

                    // Process bet
                    await processBet(socket, value);
                } catch (error) {
                    socketErrorHandler.handleError(socket, error, 'placeBet');
                }
            });

            // Leave game room
            socket.on('leaveGame', async (data) => {
                try {
                    const { gameType, duration } = data;
                    const roomId = `${gameType}_${duration}`;
                    
                    socket.leave(roomId);
                    await redis.srem(`user:${socket.user.id}:rooms`, roomId);
                    
                    logger.info('Client left room', {
                        socketId: socket.id,
                        userId: socket.user.id,
                        roomId
                    });
                } catch (error) {
                    socketErrorHandler.handleError(socket, error, 'leaveGame');
                }
            });

            // Handle disconnection
            socket.on('disconnect', () => {
                try {
                    connectionManager.removeConnection(socket);
                } catch (error) {
                    logger.error('Error handling disconnect:', error);
                }
            });

            // Handle errors
            socket.on('error', (error) => {
                socketErrorHandler.handleError(socket, error, 'socket_error');
            });

        } catch (error) {
            socketErrorHandler.handleError(socket, error, 'connection');
        }
    });

    // Set up periodic cleanup
    setInterval(() => {
        connectionManager.cleanupStaleConnections();
    }, 60000); // Every minute

    // Set up game tick intervals
    setupGameTicks();

    return io;
};

/**
 * Set up game tick intervals for each game type and duration
 */
const setupGameTicks = () => {
  // Wingo game ticks
  setupGameTypeTicks('wingo', [30, 60, 180, 300]);
  
  // 5D game ticks
  setupGameTypeTicks('fiveD', [60, 180, 300, 600]);
  
  // K3 game ticks
  setupGameTypeTicks('k3', [60, 180, 300, 600]);
};

/**
 * Set up ticks for a specific game type
 * @param {string} gameType - Game type
 * @param {Array} durations - Array of durations in seconds
 */
const setupGameTypeTicks = (gameType, durations) => {
  durations.forEach(duration => {
    // Set up tick interval (every second)
    setInterval(() => {
      gameTick(gameType, duration);
    }, 1000);
  });
};

/**
 * Game tick function - updates game state and broadcasts to clients
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 */
const gameTick = async (gameType, duration) => {
  try {
    // Check Redis connection
    if (!isConnected()) {
      console.error('Redis not connected, skipping game tick');
      return;
    }

    const now = new Date();
    
    // Generate current period ID
    const currentPeriodId = generatePeriodId(gameType, duration, now);
    
    // Calculate end time
    const endTime = calculatePeriodEndTime(currentPeriodId, duration);
    
    // Calculate time remaining
    const timeRemaining = Math.max(0, (endTime - now) / 1000);
    
    // Create room ID
    const roomId = `${gameType}_${duration}`;
    
    // Broadcast time update
    io.to(roomId).emit('timeUpdate', {
      gameType,
      duration,
      periodId: currentPeriodId,
      timeRemaining: Math.floor(timeRemaining),
      endTime: endTime.toISOString()
    });
    
    // Check if period just ended (timeRemaining === 0)
    if (timeRemaining === 0) {
      // Get period result
      const durationKey = duration === 30 ? '30s' : 
                         duration === 60 ? '1m' : 
                         duration === 180 ? '3m' : 
                         duration === 300 ? '5m' : '10m';
      
      // Check for an overridden result first
      const overrideKey = `${gameType}:${durationKey}:${currentPeriodId}:result:override`;
      const overrideResult = await redis.get(overrideKey);
      
      let result;
      if (overrideResult) {
        result = JSON.parse(overrideResult);
      } else {
        // Get the result from Redis
        const resultKey = `${gameType}:${durationKey}:${currentPeriodId}:result`;
        const resultStr = await redis.get(resultKey);
        result = resultStr ? JSON.parse(resultStr) : null;
      }
      
      // Broadcast result
      io.to(roomId).emit('periodResult', {
        gameType,
        duration,
        periodId: currentPeriodId,
        result
      });
      
      // Also broadcast the start of next period
      const nextPeriodId = getNextPeriodId(currentPeriodId);
      const nextEndTime = new Date(endTime.getTime() + duration * 1000);
      
      io.to(roomId).emit('periodStart', {
        gameType,
        duration,
        periodId: nextPeriodId,
        timeRemaining: duration,
        endTime: nextEndTime.toISOString()
      });
    }
    
    // Additional logic for specific times
    if (timeRemaining <= 5) {
      // Last 5 seconds, betting should be closed
      io.to(roomId).emit('bettingClosed', {
        gameType,
        duration,
        periodId: currentPeriodId
      });
    } else if (timeRemaining >= duration - 5) {
      // First 5 seconds of the period, show previous result
      // This could be enhanced to fetch actual previous result
      const previousPeriodId = getPreviousPeriodId(currentPeriodId);
      
      // Get previous result
      const durationKey = duration === 30 ? '30s' : 
                         duration === 60 ? '1m' : 
                         duration === 180 ? '3m' : 
                         duration === 300 ? '5m' : '10m';
      
      const resultKey = `${gameType}:${durationKey}:${previousPeriodId}:result`;
      const resultStr = await redis.get(resultKey);
      const previousResult = resultStr ? JSON.parse(resultStr) : null;
      
      if (previousResult) {
        io.to(roomId).emit('previousPeriodResult', {
          gameType,
          duration,
          periodId: previousPeriodId,
          result: previousResult
        });
      }
    }
    
    // For development: log every 15 seconds
    if (Math.floor(timeRemaining) % 15 === 0) {
      console.log(`Game tick: ${gameType}, ${duration}s, Period: ${currentPeriodId}, Time: ${Math.floor(timeRemaining)}s`);
    }
    
    // Broadcast bet updates periodically (every 3 seconds)
    if (Math.floor(timeRemaining) % 3 === 0) {
      broadcastBetUpdates(gameType, duration, currentPeriodId);
    }
    
  } catch (error) {
    console.error(`Error in game tick for ${gameType} ${duration}s:`, error);
  }
};

/**
 * Send current game state to a client
 * @param {Object} socket - Socket.io socket
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 */
const sendGameState = async (socket, gameType, duration) => {
  try {
    // Get active periods
    const activePeriods = await getActivePeriods(gameType);
    
    // Filter for the specific duration
    const currentPeriod = activePeriods.find(p => p.duration === duration && p.timeRemaining > 0);
    
    if (currentPeriod) {
      // Send period info
      socket.emit('periodInfo', {
        gameType,
        duration,
        periodId: currentPeriod.periodId,
        timeRemaining: Math.floor(currentPeriod.timeRemaining),
        endTime: currentPeriod.endTime.toISOString()
      });
      
      // Check if close to period end
      if (currentPeriod.timeRemaining <= 5) {
        socket.emit('bettingClosed', {
          gameType,
          duration,
          periodId: currentPeriod.periodId
        });
      }
      
      // Also send betting distribution
      await broadcastBetUpdates(gameType, duration, currentPeriod.periodId, socket);
    }
  } catch (error) {
    console.error('Error sending game state:', error);
  }
};

/**
 * Broadcast bet updates to clients
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 * @param {string} periodId - Period ID
 * @param {Object} socket - Optional specific socket to send to
 */
const broadcastBetUpdates = async (gameType, duration, periodId, socket = null) => {
  try {
    const durationKey = duration === 30 ? '30s' : 
                       duration === 60 ? '1m' : 
                       duration === 180 ? '3m' : 
                       duration === 300 ? '5m' : '10m';
    
    // Get current time
    const now = Date.now();
    const endTime = await redis.get(`${gameType}:${durationKey}:${periodId}:end_time`);
    const timeRemaining = Math.max(0, (endTime - now) / 1000);
    
    // Basic period info for all users
    const periodInfo = {
        period_id: periodId,
        time_remaining: timeRemaining,
        end_time: new Date(endTime),
        betting_closed: timeRemaining <= 5
    };

    // Default odds configuration
    const defaultOdds = {
        "number": 9,
        "color": {
            "red": 2,
            "green": 2,
            "violet": 4.5,
            "red_violet": 2,
            "green_violet": 2
        },
        "size": {
            "big": 2,
            "small": 2
        },
        "parity": {
            "odd": 2,
            "even": 2
        }
    };

    // User data (limited information)
    const userData = {
        ...periodInfo,
        odds: defaultOdds
    };

    // Admin data (complete information)
    const adminData = {
        ...periodInfo,
        odds: defaultOdds,
        distribution: await getBetDistribution(gameType, durationKey, periodId),
        recent_bets: await getRecentBets(gameType, durationKey, periodId, 50),
        statistics: await getGameStatistics(gameType, durationKey, periodId)
    };

    // Broadcast to appropriate rooms
    if (socket) {
        // Single socket update
        if (socket.isAdmin) {
            socket.emit('betUpdate', adminData);
        } else {
            socket.emit('betUpdate', userData);
        }
    } else {
        // Broadcast to all
        io.to(`admin_${gameType}_${duration}`).emit('betUpdate', adminData);
        io.to(`${gameType}_${duration}`).emit('betUpdate', userData);
    }
  } catch (error) {
    console.error('Error broadcasting bet updates:', error);
  }
};

// Helper function to get bet distribution (admin only)
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
                distribution = await getWingoDistribution(durationKey, periodId, totalAmount);
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

// Helper function to get recent bets (admin only)
const getRecentBets = async (gameType, durationKey, periodId, limit) => {
    const recentBets = await redis.lrange(`${gameType}:${durationKey}:${periodId}:bets`, 0, limit - 1);
    return recentBets.map(bet => {
        const betData = JSON.parse(bet);
        return {
            username: betData.username,
            bet_type: betData.bet_type,
            bet_value: betData.bet_value,
            timestamp: betData.timestamp
        };
    });
};

// Helper function to get game statistics (admin only)
const getGameStatistics = async (gameType, durationKey, periodId) => {
    try {
        const stats = {
            totalBets: await redis.get(`${gameType}:${durationKey}:${periodId}:betCount`) || 0,
            totalAmount: parseFloat(await redis.get(`${gameType}:${durationKey}:${periodId}:total`) || 0),
            uniqueBettors: await redis.get(`${gameType}:${durationKey}:${periodId}:uniqueBettors`) || 0,
            averageBetAmount: 0,
            highestBet: 0,
            lowestBet: 0,
            timestamp: new Date().toISOString()
        };

        // Calculate additional statistics
        if (stats.totalBets > 0) {
            stats.averageBetAmount = stats.totalAmount / stats.totalBets;
            stats.highestBet = parseFloat(await redis.get(`${gameType}:${durationKey}:${periodId}:highestBet`) || 0);
            stats.lowestBet = parseFloat(await redis.get(`${gameType}:${durationKey}:${periodId}:lowestBet`) || 0);
        }

        return stats;
    } catch (error) {
        console.error('Error getting game statistics:', error);
        return null;
    }
};

// Helper function to get Wingo distribution (admin only)
const getWingoDistribution = async (durationKey, periodId, totalAmount) => {
    const distribution = {
        numbers: [],
        colors: [],
        sizes: [],
        parities: []
    };

    // Get number distribution
    for (let i = 0; i < 10; i++) {
        const amount = parseFloat(await redis.get(`wingo:${durationKey}:${periodId}:number:${i}`) || 0);
        distribution.numbers.push({
            value: i,
            amount,
            percentage: totalAmount > 0 ? (amount / totalAmount) * 100 : 0
        });
    }

    // Get color distribution
    for (const color of ['red', 'green', 'violet', 'red_violet', 'green_violet']) {
        const amount = parseFloat(await redis.get(`wingo:${durationKey}:${periodId}:color:${color}`) || 0);
        distribution.colors.push({
            value: color,
            amount,
            percentage: totalAmount > 0 ? (amount / totalAmount) * 100 : 0
        });
    }

    // Get size distribution
    for (const size of ['big', 'small']) {
        const amount = parseFloat(await redis.get(`wingo:${durationKey}:${periodId}:size:${size}`) || 0);
        distribution.sizes.push({
            value: size,
            amount,
            percentage: totalAmount > 0 ? (amount / totalAmount) * 100 : 0
        });
    }

    // Get parity distribution
    for (const parity of ['odd', 'even']) {
        const amount = parseFloat(await redis.get(`wingo:${durationKey}:${periodId}:parity:${parity}`) || 0);
        distribution.parities.push({
            value: parity,
            amount,
            percentage: totalAmount > 0 ? (amount / totalAmount) * 100 : 0
        });
    }

    return distribution;
};

// Helper function to get 5D distribution (admin only)
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

// Helper function to get K3 distribution (admin only)
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

    // Get matching distributions
    for (const type of ['triple_exact', 'triple_any', 'pair_any', 'pair_specific']) {
        const amount = parseFloat(await redis.get(`k3:${durationKey}:${periodId}:matching:${type}`) || 0);
        distribution.matching[type].push({
            value: type,
            amount,
            percentage: totalAmount > 0 ? (amount / totalAmount) * 100 : 0
        });
    }

    // Get pattern distributions
    for (const pattern of ['all_different', 'straight', 'two_different']) {
        const amount = parseFloat(await redis.get(`k3:${durationKey}:${periodId}:pattern:${pattern}`) || 0);
        distribution.patterns[pattern].push({
            value: pattern,
            amount,
            percentage: totalAmount > 0 ? (amount / totalAmount) * 100 : 0
        });
    }

    return distribution;
};

/**
 * Get previous period ID
 * @param {string} currentPeriodId - Current period ID
 * @returns {string} - Previous period ID
 */
const getPreviousPeriodId = (currentPeriodId) => {
  // Extract the numerical part of the period ID
  const prefix = currentPeriodId.replace(/\d+$/, '');
  const periodNumber = parseInt(currentPeriodId.match(/\d+$/)[0], 10);
  
  // Decrement period number
  const previousPeriodNumber = periodNumber - 1;
  
  // Format with leading zeros
  const periodStr = previousPeriodNumber.toString().padStart(5, '0');
  
  return `${prefix}${periodStr}`;
};

/**
 * Get next period ID
 * @param {string} currentPeriodId - Current period ID
 * @returns {string} - Next period ID
 */
const getNextPeriodId = (currentPeriodId) => {
  // Extract the numerical part of the period ID
  const prefix = currentPeriodId.replace(/\d+$/, '');
  const periodNumber = parseInt(currentPeriodId.match(/\d+$/)[0], 10);
  
  // Increment period number
  const nextPeriodNumber = periodNumber + 1;
  
  // Format with leading zeros
  const periodStr = nextPeriodNumber.toString().padStart(5, '0');
  
  return `${prefix}${periodStr}`;
};

/**
 * Broadcast an event to a specific game room
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 * @param {string} event - Event name
 * @param {Object} data - Event data
 */
const broadcastToGame = (gameType, duration, event, data) => {
  try {
    // Check if io is initialized
    if (!io) {
      console.warn(`WebSocket io not initialized yet, cannot broadcast ${event} to ${gameType}_${duration}`);
      return;
    }
    
    const roomId = `${gameType}_${duration}`;
    io.to(roomId).emit(event, data);
    console.log(`Broadcast ${event} to ${roomId} successful`);
  } catch (error) {
    console.error(`Error broadcasting to game ${gameType}_${duration}:`, error.message);
  }
};

/**
 * Broadcast an event to all connected clients
 * @param {string} event - Event name
 * @param {Object} data - Event data
 */
const broadcastToAll = (event, data) => {
  try {
    // Check if io is initialized
    if (!io) {
      console.warn(`WebSocket io not initialized yet, cannot broadcast ${event} to all`);
      return;
    }
    
    io.emit(event, data);
    console.log(`Broadcast ${event} to all successful`);
  } catch (error) {
    console.error(`Error broadcasting to all:`, error.message);
  }
};

module.exports = {
  initializeWebSocket,
  broadcastToGame,
  broadcastToAll,
  WebSocketService
};