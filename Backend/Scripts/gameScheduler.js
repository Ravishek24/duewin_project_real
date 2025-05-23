// Backend/scripts/gameScheduler.js
const { redis } = require('../config/redisConfig');
const { sequelize } = require('../config/db');
const gameLogicService = require('../services/gameLogicService');
const periodService = require('../services/periodService');
const { broadcastToGame } = require('../services/websocketService');
const cron = require('node-cron');
const seamlessService = require('../services/seamlessService');
const tronHashService = require('../services/tronHashService');
const logger = require('../utils/logger');

/**
 * Game scheduler to handle processing of game results
 * This script should be run as a separate process
 */

// Initialize function to connect to the database
async function initialize() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected for game scheduler');
    
    // Initialize TRON hash collection
    try {
      console.log('🔄 Starting TRON hash collection...');
      await tronHashService.startHashCollection();
      console.log('✅ TRON hash collection initialized');
    } catch (error) {
      console.error('❌ Error initializing TRON hash collection:', error);
      console.log('⚠️ Game results will use fallback hash generation');
    }
  } catch (error) {
    console.error('❌ Failed to connect to database:', error);
    process.exit(1);
  }
}

// Schedule weekly games list refresh (Every Monday at 4 AM IST)
function scheduleWeeklyRefresh() {
  cron.schedule('0 4 * * 1', async () => {
    console.log('🔄 Starting scheduled games list refresh...');
    try {
      // Get admin user ID (you might want to store this in env or config)
      const adminUserId = process.env.ADMIN_USER_ID;
      
      const result = await seamlessService.refreshGamesList(adminUserId);
      if (result.success) {
        console.log('✅ Games list cache refreshed successfully');
      } else {
        console.error('❌ Failed to refresh games list cache:', result.message);
      }
    } catch (error) {
      console.error('❌ Error in scheduled games list refresh:', error);
    }
  }, {
    timezone: "Asia/Kolkata" // IST timezone
  });
}

// Schedule Redis cleanup (Every day at midnight)
cron.schedule('0 0 * * *', async () => {
  console.log('Running daily Redis cleanup...');
  try {
    const result = await gameLogicService.cleanupRedisData();
    console.log('Redis cleanup result:', result);
  } catch (error) {
    console.error('Failed to run Redis cleanup:', error);
  }
});

// Schedule hourly TRON hash collection refresh
cron.schedule('0 * * * *', async () => {
  console.log('🔄 Refreshing TRON hash collection...');
  try {
    await tronHashService.startHashCollection();
    console.log('✅ TRON hash collection refreshed');
  } catch (error) {
    console.error('❌ Failed to refresh TRON hash collection:', error);
  }
});

// Game configurations with their respective durations
const GAME_CONFIGS = {
    trx_wix: [30, 60, 180, 300],  // 30s, 1m, 3m, 5m
    fiveD: [60, 180, 300, 600],   // 1m, 3m, 5m, 10m
    k3: [60, 180, 300, 600]       // 1m, 3m, 5m, 10m
};

// Initialize game periods
const initializeGamePeriods = async () => {
    try {
        for (const [gameType, durations] of Object.entries(GAME_CONFIGS)) {
            for (const duration of durations) {
                // Initialize current period
                const currentPeriod = await periodService.generatePeriodId(gameType, duration, new Date());
                await periodService.initializePeriod(gameType, duration, currentPeriod);
                
                // Schedule period processing
                schedulePeriodProcessor(gameType, duration);
                
                logger.info(`Scheduled processor for ${gameType} ${duration}s`);
            }
        }
        logger.info('All game schedules initialized');
    } catch (error) {
        logger.error('Error initializing game periods:', error);
    }
};

// Schedule period processor
const schedulePeriodProcessor = (gameType, duration) => {
    const cronExpression = getCronExpression(duration);
    
    cron.schedule(cronExpression, async () => {
        try {
            const now = new Date();
            const currentPeriod = await periodService.generatePeriodId(gameType, duration, now);
            
            // Process the current period
            await gameLogicService.processGameResults(gameType, duration, currentPeriod);
            
            // Initialize next period
            const nextPeriod = await periodService.generateNextPeriodId(currentPeriod, gameType, duration);
            await periodService.initializePeriod(gameType, duration, nextPeriod);
            
            logger.info(`Processed period ${currentPeriod} for ${gameType} ${duration}s`);
        } catch (error) {
            logger.error(`Error processing period for ${gameType} ${duration}s:`, error);
        }
    });
};

// Get cron expression based on duration
const getCronExpression = (duration) => {
    switch (duration) {
        case 30:
            return '*/30 * * * * *';  // Every 30 seconds
        case 60:
            return '0 * * * * *';     // Every minute
        case 180:
            return '0 */3 * * * *';   // Every 3 minutes
        case 300:
            return '0 */5 * * * *';   // Every 5 minutes
        case 600:
            return '0 */10 * * * *';  // Every 10 minutes
        default:
            throw new Error(`Invalid duration: ${duration}`);
    }
};

// Start the game scheduler
const startGameScheduler = async () => {
    try {
        await initialize();
        await initializeGamePeriods();
        logger.info('Game scheduler running. Press Ctrl+C to stop.');
        logger.info('✅ Game scheduler started successfully');
    } catch (error) {
        logger.error('Error starting game scheduler:', error);
        process.exit(1);
    }
};

// Handle process termination
process.on('SIGINT', () => {
    logger.info('Game scheduler stopped');
    process.exit(0);
});

// Export for use in other files
module.exports = {
    startGameScheduler
};