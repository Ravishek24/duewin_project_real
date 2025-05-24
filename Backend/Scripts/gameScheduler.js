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
const moment = require('moment-timezone');
const models = require('../models');
const { initializeModels } = models;

/**
 * Game scheduler to handle processing of game results
 * This script should be run as a separate process
 */

// Initialize function to connect to the database
async function initialize() {
  try {
    console.log('🔄 Starting initialization...');
    
    // Step 1: Connect to database
    await sequelize.authenticate();
    console.log('✅ Database connected for game scheduler');
    
    // Step 2: Initialize models
    console.log('🔄 Initializing models...');
    await initializeModels();
    console.log('✅ Models initialized for game scheduler');
    
    // Step 3: Initialize Redis
    if (!redis.status === 'ready') {
      console.log('🔄 Waiting for Redis to be ready...');
      await new Promise((resolve) => {
        redis.on('ready', resolve);
      });
    }
    console.log('✅ Redis connection verified');
    
    // Step 4: Initialize TRON hash collection
    try {
      console.log('🔄 Starting TRON hash collection...');
      await tronHashService.startHashCollection();
      console.log('✅ TRON hash collection initialized');
    } catch (error) {
      console.error('❌ Error initializing TRON hash collection:', error);
      console.log('⚠️ Game results will use fallback hash generation');
    }
    
    // Step 5: Initialize game periods
    console.log('🔄 Initializing game periods...');
    await initializeGamePeriods();
    console.log('✅ Game periods initialized');
    
    console.log('✅ Initialization completed successfully');
  } catch (error) {
    console.error('❌ Failed to initialize:', error);
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
    wingo: [30, 60, 180, 300],    // 30s, 1m, 3m, 5m
    trx_wix: [30, 60, 180, 300],  // 30s, 1m, 3m, 5m
    fiveD: [60, 180, 300, 600],   // 1m, 3m, 5m, 10m
    k3: [60, 180, 300, 600]       // 1m, 3m, 5m, 10m
};

// Initialize game periods
const initializeGamePeriods = async () => {
    try {
        console.log('Initializing game periods...');
        for (const [gameType, durations] of Object.entries(GAME_CONFIGS)) {
            for (const duration of durations) {
                try {
                    console.log(`Initializing ${gameType} ${duration}s period...`);
                    // Initialize current period
                    const currentPeriod = await periodService.generatePeriodId(gameType, duration, new Date());
                    console.log(`Generated period ID for ${gameType} ${duration}s: ${currentPeriod}`);
                    await periodService.initializePeriod(gameType, duration, currentPeriod);
                    
                    // Schedule period processing using cron
                    const cronExpression = getCronExpression(duration);
                    cron.schedule(cronExpression, async () => {
                        try {
                            console.log(`Processing ${gameType} ${duration}s period...`);
                            await processPeriod(gameType, duration);
                        } catch (error) {
                            console.error(`Error in cron period processing for ${gameType} ${duration}s:`, error);
                            logger.error('Error in cron period processing:', {
                                error: error.message,
                                stack: error.stack,
                                gameType,
                                duration
                            });
                        }
                    }, {
                        timezone: "Asia/Kolkata" // IST timezone
                    });
                    
                    console.log(`Scheduled processor for ${gameType} ${duration}s with cron: ${cronExpression}`);
                    logger.info(`Scheduled processor for ${gameType} ${duration}s with cron: ${cronExpression}`);
                } catch (error) {
                    console.error(`Error initializing ${gameType} ${duration}s period:`, error);
                    logger.error(`Error initializing game period:`, {
                        error: error.message,
                        stack: error.stack,
                        gameType,
                        duration
                    });
                }
            }
        }
        console.log('✅ All game schedules initialized');
        logger.info('✅ All game schedules initialized');
    } catch (error) {
        console.error('❌ Error initializing game periods:', error);
        logger.error('❌ Error initializing game periods:', error);
        throw error; // Re-throw to be caught by the main initialization
    }
};

// Initialize WebSocket
let io = null;
try {
    const socketConfig = require('../config/socketConfig');
    io = socketConfig.io;
} catch (error) {
    logger.warn('WebSocket configuration not found, results will not be broadcast:', {
        error: error.message
    });
}

// Broadcast result to WebSocket clients
const broadcastResult = async (gameType, data) => {
    if (!io) {
        logger.warn('WebSocket not initialized, skipping broadcast:', {
            gameType,
            data
        });
        return;
    }
    try {
        await broadcastToGame(gameType, {
            type: 'result_published',
            data: {
                ...data,
                timestamp: moment().tz('Asia/Kolkata').toISOString()
            }
        });
        logger.info('Broadcast result:', { 
            gameType, 
            data,
            timestamp: moment().tz('Asia/Kolkata').toISOString()
        });
    } catch (error) {
        logger.error('Error broadcasting result:', {
            error: error.message,
            stack: error.stack,
            gameType,
            data
        });
    }
};

/**
 * Process a single period
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 */
async function processPeriod(gameType, duration) {
    console.log(`Processing ${gameType} ${duration}s period...`);
    console.log('=== PROCESSING PERIOD START ===');
    console.log('Game Type:', gameType);
    console.log('Duration:', duration);
    console.log('Current time:', new Date().toISOString());

    try {
        // Generate period ID
        console.log('=== GENERATING PERIOD ID ===');
        console.log('Game Type:', gameType);
        console.log('Duration:', duration);
        console.log('Timestamp:', new Date().toISOString());
        const periodId = await periodService.generatePeriodId(gameType, duration, new Date());
        console.log('Generated period ID:', periodId);
        console.log('=== PERIOD ID GENERATION COMPLETE ===');

        // Check if period already exists
        const existingPeriod = await models.GamePeriod.findOne({
            where: {
                period_id: periodId,
                game_type: gameType,
                duration: duration
            }
        });

        if (existingPeriod) {
            console.log(`Period ${periodId} already exists, skipping creation`);
            return;
        }

        // Create period key
        const periodKey = `${gameType}:${duration}s:${periodId}`;
        console.log('Period key:', periodKey);

        // Get period data from Redis
        const periodData = await redis.get(periodKey);
        console.log('Period data from Redis:', periodData);

        let period;
        if (!periodData) {
            console.log('No period data found, initializing new period...');
            const now = new Date();
            const startTime = new Date(now);
            const endTime = new Date(now.getTime() + (duration * 1000));

            console.log('Initializing period with times:', {
                periodId,
                startTime: startTime.toISOString(),
                endTime: endTime.toISOString(),
                duration,
                currentTime: now.toISOString()
            });

            period = {
                gameType,
                duration,
                periodId,
                startTime: startTime.toISOString(),
                endTime: endTime.toISOString(),
                durationKey: `${duration}s`,
                periodKey,
                betsKey: `${periodKey}:bets`,
                resultKey: `${periodKey}:result`
            };

            // Store period data in Redis
            await redis.set(periodKey, JSON.stringify(period), {
                EX: duration * 2 // Set expiry to 2x duration
            });
            console.log('Period initialized:', period);
        } else {
            period = JSON.parse(periodData);
            console.log('Using existing period data:', period);
        }

        // Create period in database
        try {
            const dbPeriod = await models.GamePeriod.create({
                period_id: period.periodId,
                game_type: gameType,
                duration: duration,
                start_time: period.startTime,
                end_time: period.endTime,
                is_completed: false,
                total_bet_amount: 0,
                total_payout_amount: 0,
                unique_bettors: 0
            });
            console.log('Period stored in database:', dbPeriod.period_id);
        } catch (error) {
            if (error.name === 'SequelizeUniqueConstraintError') {
                console.log(`Period ${period.periodId} already exists in database, continuing...`);
            } else {
                throw error;
            }
        }

        // Process game results
        const result = await gameLogicService.processGameResults(gameType, duration, period.periodId);
        console.log('Result processing completed:', result);

        if (!result.success) {
            console.error('Failed to process results:', result.error);
        }

    } catch (error) {
        console.error('Error processing period:', error);
        console.error('Error stack:', error.stack);
    }
}

// Get cron expression based on duration
const getCronExpression = (duration) => {
    if (duration <= 60) {
        return `*/${duration} * * * * *`; // Every X seconds
    } else {
        const minutes = duration / 60;
        return `0 */${minutes} * * * *`; // Every X minutes
    }
};

// Start the game scheduler
const startGameScheduler = async () => {
    try {
        await initialize();
        logger.info('Game scheduler running. Press Ctrl+C to stop.');
        logger.info('✅ Game scheduler started successfully');
    } catch (error) {
        logger.error('❌ Error starting game scheduler:', error);
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

// Start the game scheduler
startGameScheduler().catch(error => {
    console.error('Failed to start game scheduler:', error);
    process.exit(1);
});