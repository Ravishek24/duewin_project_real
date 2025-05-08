// Backend/scripts/gameScheduler.js
const { redis } = require('../config/redisConfig');
const { sequelize } = require('../config/db');
const gameLogicService = require('../services/gameLogicService');
const { broadcastToGame } = require('../services/websocketService');

/**
 * Game scheduler to handle processing of game results
 * This script should be run as a separate process
 */

// Connect to the database
await sequelize.authenticate();
console.log('✅ Database connected for game scheduler');

// Define game types and durations
const gameConfigs = [
  { type: 'wingo', durations: [30, 60, 180, 300] },
  { type: 'fiveD', durations: [60, 180, 300, 600] },
  { type: 'k3', durations: [60, 180, 300, 600] }
];

/**
 * Schedule processor for a specific game type and duration
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 */
const scheduleProcessor = (gameType, duration) => {
  // Calculate offset to ensure schedules are staggered
  const offsetSeconds = Math.random() * 0.5; // Random offset up to 0.5 seconds
  
  // Set initial timeout
  setTimeout(() => {
    // Set up recurring interval
    setInterval(() => {
      processGame(gameType, duration);
    }, duration * 1000);
    
    // Also process immediately
    processGame(gameType, duration);
  }, offsetSeconds * 1000);
  
  console.log(`Scheduled processor for ${gameType} ${duration}s`);
};

/**
 * Process a game at the end of its period
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 */
const processGame = async (gameType, duration) => {
  try {
    // Generate the current period ID
    const now = new Date();
    const periodId = gameLogicService.generatePeriodId(gameType, duration, now);
    
    // Check if the period is about to end
    const endTime = gameLogicService.calculatePeriodEndTime(periodId, duration);
    const timeRemaining = (endTime - now) / 1000;
    
    // Only process if within last second or already ended
    if (timeRemaining <= 1) {
      console.log(`Processing results for ${gameType} ${duration}s period ${periodId}`);
      
      // Process game results
      const result = await gameLogicService.processGameResults(gameType, duration, periodId);
      
      // Broadcast result via WebSocket (if successful)
      if (result.success) {
        broadcastToGame(gameType, duration, 'periodResult', {
          gameType,
          duration,
          periodId,
          result: result.result
        });
        
        console.log(`Result processed for ${gameType} ${duration}s period ${periodId}:`, JSON.stringify(result.result));
      } else {
        console.error(`Failed to process result for ${gameType} ${duration}s period ${periodId}:`, result.message);
      }
    }
  } catch (error) {
    console.error(`Error processing ${gameType} ${duration}s game:`, error);
  }
};

/**
 * Initialize all game schedules
 */
const initializeSchedules = () => {
  console.log('Initializing game schedules...');
  
  // Schedule each game type and duration
  for (const config of gameConfigs) {
    for (const duration of config.durations) {
      scheduleProcessor(config.type, duration);
    }
  }
  
  console.log('All game schedules initialized');
};

// Start scheduling
initializeSchedules();

// Keep the process alive
console.log('Game scheduler running. Press Ctrl+C to stop.');
process.stdin.resume();

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down game scheduler...');
  await redis.quit();
  await sequelize.close();
  process.exit(0);
});

module.exports = {
  startGameScheduler
};