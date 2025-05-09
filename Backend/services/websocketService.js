// Backend/services/websocketService.js
const { Server } = require('socket.io');
const { redis, isConnected } = require('../config/redisConfig');
const { 
  getActivePeriods, 
  getPeriodStatus, 
  generatePeriodId, 
  calculatePeriodEndTime 
} = require('./gameLogicService.js');

// Socket.io server instance
let io;

/**
 * Initialize the WebSocket server
 * @param {Object} server - HTTP server instance
 */
const initializeWebSocket = (server) => {
  // Create Socket.io server
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true
    }
  });
  
  // Connection event
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    // Join game room
    socket.on('joinGame', (data) => {
      const { gameType, duration } = data;
      
      // Create room ID
      const roomId = `${gameType}_${duration}`;
      
      // Join room
      socket.join(roomId);
      console.log(`Client ${socket.id} joined room ${roomId}`);
      
      // Send current game state
      sendGameState(socket, gameType, duration);
    });
    
    // Leave game room
    socket.on('leaveGame', (data) => {
      const { gameType, duration } = data;
      
      // Create room ID
      const roomId = `${gameType}_${duration}`;
      
      // Leave room
      socket.leave(roomId);
      console.log(`Client ${socket.id} left room ${roomId}`);
    });
    
    // Disconnection event
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });
  
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
    // Get bet distribution from Redis
    const durationKey = duration === 30 ? '30s' : 
                       duration === 60 ? '1m' : 
                       duration === 180 ? '3m' : 
                       duration === 300 ? '5m' : '10m';
    
    // Calculate total bet amount
    const totalBetAmount = parseFloat(
      await redis.get(`${gameType}:${durationKey}:${periodId}:total`) || 0
    );
    
    if (totalBetAmount === 0) {
      return; // No bets to broadcast
    }
    
    // Create distribution object based on game type
    let distribution = {};
    
    switch (gameType) {
      case 'wingo':
        // Number bets
        const numberDistribution = {};
        for (let i = 0; i < 10; i++) {
          const amount = parseFloat(
            await redis.get(`wingo:${durationKey}:${periodId}:number:${i}`) || 0
          );
          if (amount > 0) {
            numberDistribution[i] = amount;
          }
        }
        
        // Color bets
        const colorDistribution = {};
        for (const color of ['red', 'green', 'violet', 'red_violet', 'green_violet']) {
          const amount = parseFloat(
            await redis.get(`wingo:${durationKey}:${periodId}:color:${color}`) || 0
          );
          if (amount > 0) {
            colorDistribution[color] = amount;
          }
        }
        
        // Size bets
        const sizeDistribution = {};
        for (const size of ['big', 'small']) {
          const amount = parseFloat(
            await redis.get(`wingo:${durationKey}:${periodId}:size:${size}`) || 0
          );
          if (amount > 0) {
            sizeDistribution[size] = amount;
          }
        }
        
        distribution = {
          number: numberDistribution,
          color: colorDistribution,
          size: sizeDistribution,
          total: totalBetAmount
        };
        break;
        
      case 'fiveD':
        // Implement 5D distribution
        break;
        
      case 'k3':
        // Implement K3 distribution
        break;
    }
    
    // Emit update
    const updateData = {
      gameType,
      duration,
      periodId,
      distribution
    };
    
    if (socket) {
      // Send only to the specific socket
      socket.emit('betDistribution', updateData);
    } else {
      // Broadcast to all clients in the room
      const roomId = `${gameType}_${duration}`;
      io.to(roomId).emit('betDistribution', updateData);
    }
  } catch (error) {
    console.error('Error broadcasting bet updates:', error);
  }
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
  const roomId = `${gameType}_${duration}`;
  io.to(roomId).emit(event, data);
};

/**
 * Broadcast an event to all connected clients
 * @param {string} event - Event name
 * @param {Object} data - Event data
 */
const broadcastToAll = (event, data) => {
  io.emit(event, data);
};

module.exports = {
  initializeWebSocket,
  broadcastToGame,
  broadcastToAll
};