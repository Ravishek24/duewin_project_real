// Backend/scripts/gameScheduler.js - DISABLED RESULT PROCESSING VERSION
const { redis } = require('../config/redisConfig');
const { connectDB } = require('../config/db');
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
let sequelize = null;

/**
 * Game scheduler - MONITORING MODE ONLY
 * WebSocket service handles ALL result processing
 */

async function initialize() {
  try {
    console.log('🔄 Starting scheduler initialization...');
    
    // Step 1: Connect to database
    console.log('🔄 Connecting to database...');
    await connectDB();
    
    const { sequelize: seq } = require('../config/db');
    sequelize = seq;
    
    await sequelize.authenticate();
    console.log('✅ Database connected for game scheduler');
    
    // Step 2: Initialize models
    console.log('🔄 Initializing models...');
    const modelsModule = require('../models');
    
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      models = await modelsModule.initializeModels();
      if (!models) {
        throw new Error('Models initialization failed - no models returned');
      }
      
      if (!models.GamePeriod) {
        throw new Error('GamePeriod model not found in initialized models');
      }
      
      console.log('✅ Models initialized for game scheduler');
      console.log('📊 Available models:', Object.keys(models));
    } catch (error) {
      console.error('❌ Error initializing models:', error);
      throw error;
    }
    
    // Step 3: Load services
    console.log('🔄 Loading services...');
    
    periodService = require('../services/periodService');
    
    try {
      await periodService.ensureModelsLoaded();
      console.log('✅ Period service models verified');
    } catch (error) {
      console.error('❌ Period service models failed:', error);
      throw error;
    }
    
    const websocketService = require('../services/websocketService');
    broadcastToGame = websocketService.broadcastToGame;
    seamlessService = require('../services/seamlessService');
    tronHashService = require('../services/tronHashService');
    console.log('✅ Services loaded');
    
    // Step 4: Initialize Redis
    if (!redis.status === 'ready') {
      console.log('🔄 Waiting for Redis to be ready...');
      await new Promise((resolve) => {
        redis.on('ready', resolve);
      });
    }
    console.log('✅ Redis connection verified');
    
    // Step 5: Initialize TRON hash collection
    try {
      console.log('🔄 Starting TRON hash collection...');
      await tronHashService.startHashCollection();
      console.log('✅ TRON hash collection initialized');
    } catch (error) {
      console.error('❌ Error initializing TRON hash collection:', error);
      console.log('⚠️ Game results will use fallback hash generation');
    }
    
    console.log('✅ Scheduler initialization completed - MONITORING MODE');
  } catch (error) {
    console.error('❌ Failed to initialize:', error);
    process.exit(1);
  }
}

/**
 * Reset all sequence counters at 2 AM IST
 */
const resetDailySequences = async () => {
    const lockKey = 'daily_sequence_reset_lock';
    const lockValue = `${Date.now()}_${process.pid}`;
    
    try {
        console.log('🔄 Starting daily sequence reset at 2 AM IST...');
        
        const acquired = await redis.set(lockKey, lockValue, 'EX', 600, 'NX');
        
        if (!acquired) {
            console.log('⚠️ Daily reset already running on another instance, skipping...');
            return;
        }

        console.log('🔒 Acquired reset lock, proceeding with daily sequence reset');
        
        const today = moment.tz('Asia/Kolkata').format('YYYYMMDD');
        
        const gameConfigs = {
            'wingo': ['30s', '1m', '3m', '5m'],
            'trx_wix': ['30s', '1m', '3m', '5m'],
            'k3': ['1m', '3m', '5m', '10m'],
            'fiveD': ['1m', '3m', '5m', '10m']
        };

        console.log(`🔄 Resetting daily sequences for ${today}`);

        let resetCount = 0;
        for (const [gameType, durations] of Object.entries(gameConfigs)) {
            for (const duration of durations) {
                try {
                    const sequenceKey = `${gameType}:${duration}:daily_sequence:${today}`;
                    await redis.set(sequenceKey, '0');
                    
                    const tomorrow2AM = moment.tz('Asia/Kolkata')
                        .add(1, 'day')
                        .hour(2)
                        .minute(0)
                        .second(0);
                    const expirySeconds = Math.max(3600, tomorrow2AM.diff(moment.tz('Asia/Kolkata'), 'seconds'));
                    await redis.expire(sequenceKey, expirySeconds);
                    
                    resetCount++;
                    console.log(`✅ Reset sequence for ${gameType}:${duration} (expires in ${expirySeconds}s)`);
                } catch (sequenceError) {
                    console.error(`❌ Failed to reset sequence for ${gameType}:${duration}:`, sequenceError);
                }
            }
        }

        console.log(`✅ Daily sequence reset completed! Reset ${resetCount} sequences`);
        logger.info('Daily sequence reset completed', {
            date: today,
            resetCount,
            timestamp: moment.tz('Asia/Kolkata').toISOString()
        });

    } catch (error) {
        console.error('❌ Error in daily sequence reset:', error);
        logger.error('Error in daily sequence reset:', {
            error: error.message,
            stack: error.stack,
            timestamp: moment.tz('Asia/Kolkata').toISOString()
        });
    } finally {
        try {
            const currentValue = await redis.get(lockKey);
            if (currentValue === lockValue) {
                await redis.del(lockKey);
                console.log('🔓 Released reset lock');
            }
        } catch (lockError) {
            console.error('❌ Error releasing reset lock:', lockError);
        }
    }
};

// Schedule daily period sequence reset at 2 AM IST
cron.schedule('0 2 * * *', async () => {
    console.log('🕐 2 AM IST - Starting daily period sequence reset...');
    try {
        await resetDailySequences();
    } catch (error) {
        console.error('❌ Failed to run daily sequence reset:', error);
        logger.error('Failed to run daily sequence reset:', {
            error: error.message,
            stack: error.stack
        });
    }
}, {
    timezone: "Asia/Kolkata"
});

// Schedule weekly games list refresh (Every Monday at 4 AM IST)
function scheduleWeeklyRefresh() {
  cron.schedule('0 4 * * 1', async () => {
    console.log('🔄 Starting scheduled games list refresh...');
    try {
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
    timezone: "Asia/Kolkata"
  });
}

// Schedule Redis cleanup (Every day at midnight)
cron.schedule('0 0 * * *', async () => {
  console.log('Running daily Redis cleanup...');
  try {
    // DISABLED: No game logic service in scheduler
    console.log('⚠️ Redis cleanup disabled - handled by WebSocket service');
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

// DISABLED: Game processing functions
const GAME_CONFIGS = {
    wingo: [30, 60, 180, 300],
    trx_wix: [30, 60, 180, 300],
    fiveD: [60, 180, 300, 600],
    k3: [60, 180, 300, 600]
};

// MONITORING MODE: No period processing
const initializeGamePeriods = async () => {
  try {
      console.log('🚫 GAME SCHEDULER: Result processing DISABLED');
      console.log('📱 WebSocket service handles ALL period processing');
      console.log('📊 Scheduler running in MONITORING MODE only');
      
      // Only log available games, don't schedule any processing
      for (const [gameType, durations] of Object.entries(GAME_CONFIGS)) {
          console.log(`📋 Monitoring: ${gameType} with durations ${durations.join(', ')}s`);
      }
      
      console.log('✅ Game scheduler in monitoring mode - all processing via WebSocket');
      logger.info('✅ Game scheduler in monitoring mode - WebSocket handles all processing');
      
  } catch (error) {
      console.error('❌ Error in game scheduler setup:', error);
      throw error;
  }
};

// DISABLED: No result processing
async function processPeriod(gameType, duration) {
  console.log(`🚫 DISABLED: Period processing for ${gameType} ${duration}s`);
  console.log(`📱 WebSocket service handles all result processing`);
  // This function is now completely disabled
}

// Start the game scheduler in monitoring mode
const startGameScheduler = async () => {
    try {
        await initialize();
        
        // Initialize monitoring mode
        await initializeGamePeriods();
        
        // Call scheduleWeeklyRefresh
        scheduleWeeklyRefresh();
        
        logger.info('Game scheduler running in MONITORING MODE. Press Ctrl+C to stop.');
        logger.info('✅ Game scheduler started successfully - WebSocket handles processing');
        
        // Log all scheduled cron jobs
        console.log('\n📅 SCHEDULED CRON JOBS (Monitoring Mode):');
        console.log('⏰ 2:00 AM IST - Daily period sequence reset');
        console.log('⏰ Every hour - TRON hash collection refresh');
        console.log('⏰ 4:00 AM IST (Monday) - Weekly games list refresh');
        console.log('🚫 DISABLED - Game period result processing (handled by WebSocket)\n');
        
        return true; // Return success
        
    } catch (error) {
        logger.error('❌ Error starting game scheduler:', error);
        return false; // Return failure
    }
};

// Handle process termination
process.on('SIGINT', () => {
    logger.info('Game scheduler stopped');
    process.exit(0);
});

// Export for use in other files
module.exports = {
    startGameScheduler,
    resetDailySequences
};

// Don't auto-start if this file is run directly
if (require.main === module) {
    console.log('🚫 Auto-start disabled - use start-scheduler.js instead');
}