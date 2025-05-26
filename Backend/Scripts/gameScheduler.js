// Backend/scripts/gameScheduler.js
const { redis } = require('../config/redisConfig');
const { connectDB } = require('../config/db'); // Changed: Import connectDB instead of sequelize directly
const cron = require('node-cron');
const logger = require('../utils/logger');
const moment = require('moment-timezone');

// Import services after DB connection is established
let periodService = null;
let broadcastToGame = null;
let seamlessService = null;
let tronHashService = null;

// Don't require models or gameLogicService at the top level
let models = null;
let gameLogicService = null;
let sequelize = null; // Will be set after connection

/**
 * Game scheduler to handle processing of game results
 * This script should be run as a separate process
 */

// Initialize function to connect to the database
async function initialize() {
  try {
    console.log('🔄 Starting initialization...');
    
    // Step 1: Connect to database and ensure connection is established
    console.log('🔄 Connecting to database...');
    await connectDB(); // Use connectDB() first
    
    // Now get the sequelize instance after connection is established
    const { sequelize: seq } = require('../config/db');
    sequelize = seq;
    
    await sequelize.authenticate();
    console.log('✅ Database connected for game scheduler');
    
    // Step 2: Initialize models FIRST before any services
    console.log('🔄 Initializing models...');
    const modelsModule = require('../models');
    
    // Ensure models are properly initialized with error handling
    try {
      // Wait for database connection to be fully established
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      models = await modelsModule.initializeModels();
      if (!models) {
        throw new Error('Models initialization failed - no models returned');
      }
      
      // Verify critical models exist
      if (!models.GamePeriod) {
        throw new Error('GamePeriod model not found in initialized models');
      }
      
      // Verify Sequelize instance is properly initialized
      if (!sequelize.getQueryInterface) {
        throw new Error('Sequelize instance is not properly initialized');
      }
      
      console.log('✅ Models initialized for game scheduler');
      console.log('📊 Available models:', Object.keys(models));
    } catch (error) {
      console.error('❌ Error initializing models:', error);
      throw error;
    }
    
    // Step 3: NOW load services after models are initialized
    console.log('🔄 Loading services...');
    
    // Load period service
    periodService = require('../services/periodService');
    
    // Test that periodService can access models
    try {
      await periodService.ensureModelsLoaded();
      console.log('✅ Period service models verified');
    } catch (error) {
      console.error('❌ Period service models failed:', error);
      throw error;
    }
    
    // Load other services
    const websocketService = require('../services/websocketService');
    broadcastToGame = websocketService.broadcastToGame;
    seamlessService = require('../services/seamlessService');
    tronHashService = require('../services/tronHashService');
    console.log('✅ Services loaded');
    
    // Step 4: Now that models are initialized, require gameLogicService
    console.log('🔄 Loading game logic service...');
    gameLogicService = require('../services/gameLogicService');
    
    // Give gameLogicService time to initialize its models
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('✅ Game logic service loaded');
    
    // Step 5: Initialize Redis
    if (!redis.status === 'ready') {
      console.log('🔄 Waiting for Redis to be ready...');
      await new Promise((resolve) => {
        redis.on('ready', resolve);
      });
    }
    console.log('✅ Redis connection verified');
    
    // Step 6: Initialize TRON hash collection
    try {
      console.log('🔄 Starting TRON hash collection...');
      await tronHashService.startHashCollection();
      console.log('✅ TRON hash collection initialized');
    } catch (error) {
      console.error('❌ Error initializing TRON hash collection:', error);
      console.log('⚠️ Game results will use fallback hash generation');
    }
    
    // Step 7: Initialize game periods (ONLY after everything else is ready)
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
    if (gameLogicService) {
      const result = await gameLogicService.cleanupRedisData();
      console.log('Redis cleanup result:', result);
    } else {
      console.log('Game logic service not initialized, skipping cleanup');
    }
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
        
        // CRITICAL: Verify periodService is ready before using it
        if (!periodService) {
            throw new Error('Period service not initialized');
        }
        
        // Test period service works
        try {
            await periodService.ensureModelsLoaded();
            console.log('✅ Period service ready for initialization');
        } catch (error) {
            console.error('❌ Period service not ready:', error);
            throw error;
        }
        
        for (const [gameType, durations] of Object.entries(GAME_CONFIGS)) {
            for (const duration of durations) {
                try {
                    console.log(`Initializing ${gameType} ${duration}s period...`);
                    
                    // Initialize current period - ONLY call this after models are ready
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
  const now = new Date();
  
  try {
    // Ensure services are still available
    if (!periodService || !gameLogicService) {
      throw new Error('Required services not initialized');
    }
    
    const periodId = await periodService.generatePeriodId(gameType, duration, now);

    console.log(`🔄 Closing and finalizing period: ${gameType} ${duration}s - ${periodId}`);
    
    // 1. Process the current period (generate result, process winners)
    const resultData = await gameLogicService.processGameResults(gameType, duration, periodId);
    
    // 2. Broadcast result via WebSocket
    await broadcastResult(gameType, {
      periodId,
      result: resultData.result,
      gameType,
      duration
    });

    console.log(`✅ Period processed and result broadcasted: ${gameType} ${duration}s - ${periodId}`);

    // 3. Initialize next period
    const nextPeriodId = await periodService.generatePeriodId(gameType, duration, new Date());
    await periodService.initializePeriod(gameType, duration, nextPeriodId);

    console.log(`✅ Next period initialized: ${gameType} ${duration}s - ${nextPeriodId}`);
    
  } catch (error) {
    console.error(`❌ Error processing period for ${gameType} ${duration}s:`, error);
    logger.error('Error processing period:', {
      gameType,
      duration,
      error: error.message,
      stack: error.stack
    });
  }
}

/**
 * Get a cron expression for the given duration
 * @param {number} duration - Duration in seconds
 * @returns {string} Cron expression
 */
function getCronExpression(duration) {
  switch (duration) {
    case 30: return '*/30 * * * * *'; // Every 30 seconds (Fixed: cron-like syntax)
    case 60: return '* * * * *';       // Every 1 minute
    case 180: return '*/3 * * * *';    // Every 3 minutes
    case 300: return '*/5 * * * *';    // Every 5 minutes
    case 600: return '*/10 * * * *';   // Every 10 minutes
    default: throw new Error(`Unsupported game duration: ${duration}`);
  }
}

// Start the game scheduler
const startGameScheduler = async () => {
    try {
        await initialize();
        
        // Call scheduleWeeklyRefresh after initialization
        scheduleWeeklyRefresh();
        
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