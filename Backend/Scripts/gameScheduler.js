// Backend/Scripts/gameScheduler.js - FIXED: Time-based period management

const { redis } = require('../config/redisConfig');
const { connectDB } = require('../config/db');
const cron = require('node-cron');
const logger = require('../utils/logger');
const moment = require('moment-timezone');

// Import services after DB connection is established
let periodService = null;
let gameLogicService = null;
let tronHashService = null;

// Models and sequelize
let models = null;
let sequelize = null;

// FIXED: Game tick intervals for scheduler process ONLY - duration-based
const schedulerGameIntervals = new Map();
let schedulerGameTicksStarted = false;

// FIXED: Period cache for scheduler process ONLY - duration-based
const schedulerCurrentPeriods = new Map(); // Key: gameType_duration
const schedulerProcessingLocks = new Set();

// FIXED: Track processed periods to prevent duplicates
const processedPeriods = new Set(); // Key: gameType_duration_periodId

// FIXED: Database connection health monitoring
let dbHealthCheckInterval = null;
let lastDbHealthCheck = Date.now();

// FIXED: Duration-based game configs only
const GAME_CONFIGS = {
    'wingo': [30, 60, 180, 300],     // 4 rooms: wingo_30, wingo_60, wingo_180, wingo_300
    'trx_wix': [30, 60, 180, 300],   // 4 rooms: trx_wix_30, trx_wix_60, trx_wix_180, trx_wix_300
    'k3': [60, 180, 300, 600],       // 4 rooms: k3_60, k3_180, k3_300, k3_600
    'fiveD': [60, 180, 300, 600]     // 4 rooms: fiveD_60, fiveD_180, fiveD_300, fiveD_600
};

/**
 * FIXED: Period start time calculation (from your code)
 */
const calculatePeriodStartTime = (periodId, duration) => {
    try {
        const dateStr = periodId.substring(0, 8);
        const year = parseInt(dateStr.substring(0, 4), 10);
        const month = parseInt(dateStr.substring(4, 6), 10) - 1;
        const day = parseInt(dateStr.substring(6, 8), 10);
        
        const sequenceStr = periodId.substring(8);
        const sequenceNumber = parseInt(sequenceStr, 10);
        
        const baseTime = moment.tz([year, month, day, 2, 0, 0], 'Asia/Kolkata');
        const startTime = baseTime.add(sequenceNumber * duration, 'seconds');
        
        return startTime.toDate();
    } catch (error) {
        console.error('Error calculating period start time:', error);
        throw error;
    }
};

/**
 * FIXED: Period end time calculation (from your code)
 */
const calculatePeriodEndTime = (periodId, duration) => {
    try {
        const startTime = calculatePeriodStartTime(periodId, duration);
        const endTime = moment(startTime).tz('Asia/Kolkata').add(duration, 'seconds');
        return endTime.toDate();
    } catch (error) {
        console.error('Error calculating period end time:', error);
        throw error;
    }
};

/**
 * FIXED: Database connection health check
 */
const checkDatabaseHealth = async () => {
    try {
        if (!sequelize) {
            console.warn('⚠️ Database connection not available');
            return false;
        }
        
        await sequelize.authenticate();
        lastDbHealthCheck = Date.now();
        return true;
    } catch (error) {
        console.error('❌ Database health check failed:', error.message);
        return false;
    }
};

/**
 * FIXED: Start database health monitoring
 */
const startDatabaseHealthMonitoring = () => {
    // Cleanup existing interval
    if (dbHealthCheckInterval) {
        clearInterval(dbHealthCheckInterval);
        dbHealthCheckInterval = null;
    }
    
    dbHealthCheckInterval = setInterval(async () => {
        const isHealthy = await checkDatabaseHealth();
        if (!isHealthy) {
            console.warn('⚠️ Database health check failed, attempting reconnection...');
            try {
                await connectDB();
                console.log('✅ Database reconnection successful');
            } catch (error) {
                console.error('❌ Database reconnection failed:', error.message);
            }
        }
    }, 30000); // Check every 30 seconds
    
    console.log('🔍 Database health monitoring started');
};

/**
 * FIXED: Initialize scheduler with duration-based period management only
 */
async function initialize() {
    try {
        console.log('🔄 Starting GAME SCHEDULER initialization - DURATION-BASED ONLY...');
        
        await connectDB();
        const { sequelize: seq } = require('../config/db');
        sequelize = seq;
        
        await sequelize.authenticate();
        console.log('✅ Database connected for game scheduler');
        
        const modelsModule = require('../models');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        models = await modelsModule.initializeModels();
        if (!models) {
            throw new Error('Models initialization failed - no models returned');
        }
        
        console.log('✅ Models initialized for game scheduler');
        
        periodService = require('../services/periodService');
        gameLogicService = require('../services/gameLogicService');
        
        await periodService.ensureModelsLoaded();
        console.log('✅ Period service models verified');
        
        try {
            tronHashService = require('../services/tronHashService');
            await tronHashService.startHashCollection();
            console.log('✅ TRON hash collection initialized');
        } catch (error) {
            console.error('❌ Error initializing TRON hash collection:', error);
            console.log('⚠️ Game results will use fallback hash generation');
        }
        
        if (!redis.status === 'ready') {
            console.log('🔄 Waiting for Redis to be ready...');
            await new Promise((resolve) => {
                redis.on('ready', resolve);
            });
        }
        console.log('✅ Redis connection verified for game scheduler');
        
        // Start database health monitoring
        startDatabaseHealthMonitoring();
        
        console.log('✅ GAME SCHEDULER initialization completed - DURATION-BASED ONLY');
    } catch (error) {
        console.error('❌ Failed to initialize game scheduler:', error);
        process.exit(1);
    }
}

/**
 * FIXED: Start duration-based game tick system for scheduler
 */
const startSchedulerGameTicks = async () => {
    try {
        console.log('🕐 Starting SCHEDULER DURATION-BASED game tick system...');
        
        for (const [gameType, durations] of Object.entries(GAME_CONFIGS)) {
            for (const duration of durations) {
                try {
                    const key = `${gameType}_${duration}`;
                    
                    // FIXED: Get current period using duration-based calculation
                    const currentPeriod = await periodService.getCurrentPeriod(gameType, duration);
                    
                    if (currentPeriod) {
                        // FIXED: Validate that period hasn't ended
                        const endTime = calculatePeriodEndTime(currentPeriod.periodId, duration);
                        const timeRemaining = Math.max(0, (endTime - new Date()) / 1000);
                        
                        if (timeRemaining > 0) {
                            schedulerCurrentPeriods.set(key, {
                                ...currentPeriod,
                                endTime: endTime
                            });
                            
                            await storePeriodInRedisForWebSocket(gameType, duration, currentPeriod);
                            console.log(`📅 SCHEDULER loaded [${gameType}|${duration}s]: Period ${currentPeriod.periodId} (${Math.ceil(timeRemaining)}s remaining)`);
                        } else {
                            console.warn(`⚠️ Period ${currentPeriod.periodId} has already ended, getting next period`);
                            // Get next period
                            const nextPeriod = await getNextPeriod(gameType, duration, currentPeriod.periodId);
                            if (nextPeriod) {
                                schedulerCurrentPeriods.set(key, nextPeriod);
                                await storePeriodInRedisForWebSocket(gameType, duration, nextPeriod);
                            }
                        }
                    } else {
                        console.warn(`⚠️ No active period for [${gameType}|${duration}s]`);
                    }
                    
                    startSchedulerTicksForGame(gameType, duration);
                    
                } catch (error) {
                    console.error(`❌ Error initializing scheduler for [${gameType}|${duration}s]:`, error.message);
                }
            }
        }
        
        schedulerGameTicksStarted = true;
        console.log('✅ SCHEDULER DURATION-BASED game tick system started');
        
        console.log('\n📋 SCHEDULER ACTIVE COMBINATIONS:');
        Object.entries(GAME_CONFIGS).forEach(([gameType, durations]) => {
            durations.forEach(duration => {
                console.log(`   - ${gameType}_${duration}`);
            });
        });
        console.log(`📊 Total combinations: ${Object.values(GAME_CONFIGS).reduce((sum, durations) => sum + durations.length, 0)}\n`);
        
    } catch (error) {
        console.error('❌ Error starting scheduler game ticks:', error);
        setTimeout(startSchedulerGameTicks, 5000);
    }
};

/**
 * FIXED: Start scheduler ticks for specific game/duration combination
 */
const startSchedulerTicksForGame = (gameType, duration) => {
    const key = `${gameType}_${duration}`;
    
    if (schedulerGameIntervals.has(key)) {
        clearInterval(schedulerGameIntervals.get(key));
    }
    
    const intervalId = setInterval(async () => {
        await schedulerGameTick(gameType, duration);
    }, 1000);
    
    schedulerGameIntervals.set(key, intervalId);
    console.log(`⏰ SCHEDULER started ticks for ${gameType} ${duration}s`);
};

// Backend/scripts/gameScheduler.js - COMPLETE FIX 3
/**
 * FIXED: Enhanced scheduler game tick with strict period transition validation
 */
const schedulerGameTick = async (gameType, duration) => {
    try {
        const now = new Date();
        const key = `${gameType}_${duration}`;
        
        // Get current period using duration-based calculation
        const currentPeriodInfo = await periodService.getCurrentPeriod(gameType, duration);
        
        if (!currentPeriodInfo || !currentPeriodInfo.active) {
            // No active period, try to get next period
            const cachedCurrent = schedulerCurrentPeriods.get(key);
            if (cachedCurrent) {
                const nextPeriod = await getNextPeriod(gameType, duration, cachedCurrent.periodId);
                if (nextPeriod) {
                    schedulerCurrentPeriods.set(key, nextPeriod);
                    await storePeriodInRedisForWebSocket(gameType, duration, nextPeriod);
                    await publishPeriodStart(gameType, duration, nextPeriod);
                }
            }
            return;
        }
        
        // Get cached period
        const cachedCurrent = schedulerCurrentPeriods.get(key);
        
        // Enhanced period transition detection with validation
        if (!cachedCurrent || cachedCurrent.periodId !== currentPeriodInfo.periodId) {
            console.log(`⚡ SCHEDULER PERIOD TRANSITION [${gameType}|${duration}s]:`);
            console.log(`   - Previous: ${cachedCurrent?.periodId || 'NONE'}`);
            console.log(`   - Current: ${currentPeriodInfo.periodId}`);
            console.log(`   - Transition time: ${now.toISOString()}`);
            
            // 🎯 WINGO-SPECIFIC LOGGING
            if (gameType.toLowerCase() === 'wingo') {
                console.log(`🎯 [WINGO_SCHEDULER] PERIOD TRANSITION DETECTED`);
                console.log(`🎯 [WINGO_SCHEDULER] Previous: ${cachedCurrent?.periodId || 'NONE'}`);
                console.log(`🎯 [WINGO_SCHEDULER] Current: ${currentPeriodInfo.periodId}`);
                console.log(`🎯 [WINGO_SCHEDULER] Duration: ${duration}s`);
            }
            
            // Process previous period if it exists
            if (cachedCurrent && cachedCurrent.periodId !== currentPeriodInfo.periodId) {
                try {
                    const prevPeriodEndTime = calculatePeriodEndTime(cachedCurrent.periodId, duration);
                    const timeSincePrevEnd = (now - prevPeriodEndTime) / 1000;
                    
                    console.log(`⏰ Previous period ${cachedCurrent.periodId} validation:`);
                    console.log(`   - Should have ended: ${prevPeriodEndTime.toISOString()}`);
                    console.log(`   - Time since end: ${timeSincePrevEnd.toFixed(2)}s`);
                    
                    // 🎯 WINGO-SPECIFIC LOGGING
                    if (gameType.toLowerCase() === 'wingo') {
                        console.log(`🎯 [WINGO_SCHEDULER] Previous period validation:`);
                        console.log(`🎯 [WINGO_SCHEDULER] - Period: ${cachedCurrent.periodId}`);
                        console.log(`🎯 [WINGO_SCHEDULER] - Should have ended: ${prevPeriodEndTime.toISOString()}`);
                        console.log(`🎯 [WINGO_SCHEDULER] - Time since end: ${timeSincePrevEnd.toFixed(2)}s`);
                    }
                    
                    // Process previous period if timing is reasonable
                    if (timeSincePrevEnd >= -2 && timeSincePrevEnd <= 60) {
                        console.log(`✅ Processing previous period ${cachedCurrent.periodId} (valid timing)`);
                        
                        // 🎯 WINGO-SPECIFIC LOGGING
                        if (gameType.toLowerCase() === 'wingo') {
                            console.log(`🎯 [WINGO_SCHEDULER] ✅ PROCESSING PREVIOUS PERIOD`);
                            console.log(`🎯 [WINGO_SCHEDULER] Period: ${cachedCurrent.periodId}`);
                            console.log(`🎯 [WINGO_SCHEDULER] Timing: ${timeSincePrevEnd.toFixed(2)}s since end`);
                        }
                        
                        await processSchedulerPeriodEnd(gameType, duration, cachedCurrent.periodId);
                    } else {
                        console.warn(`⚠️ Skipping previous period ${cachedCurrent.periodId}: Invalid timing (${timeSincePrevEnd.toFixed(2)}s since end)`);
                        
                        // 🎯 WINGO-SPECIFIC LOGGING
                        if (gameType.toLowerCase() === 'wingo') {
                            console.log(`🎯 [WINGO_SCHEDULER] ⚠️ SKIPPING PREVIOUS PERIOD`);
                            console.log(`🎯 [WINGO_SCHEDULER] Period: ${cachedCurrent.periodId}`);
                            console.log(`🎯 [WINGO_SCHEDULER] Reason: Invalid timing (${timeSincePrevEnd.toFixed(2)}s since end)`);
                        }
                    }
                } catch (timingError) {
                    console.error(`❌ Error validating previous period timing:`, timingError.message);
                    
                    // 🎯 WINGO-SPECIFIC LOGGING
                    if (gameType.toLowerCase() === 'wingo') {
                        console.log(`🎯 [WINGO_SCHEDULER] ❌ TIMING VALIDATION ERROR`);
                        console.log(`🎯 [WINGO_SCHEDULER] Error: ${timingError.message}`);
                    }
                }
            }
            
            // Update cached period with new period info
            schedulerCurrentPeriods.set(key, currentPeriodInfo);
            
            // Store new period in Redis for WebSocket service
            await storePeriodInRedisForWebSocket(gameType, duration, currentPeriodInfo);
            
            // Publish period start event
            await publishPeriodStart(gameType, duration, currentPeriodInfo);
            
            console.log(`📢 SCHEDULER: Broadcasted new period start: ${currentPeriodInfo.periodId}`);
        }
        
        // Update cached period with latest time info
        const currentPeriod = schedulerCurrentPeriods.get(key);
        if (currentPeriod) {
            const endTime = calculatePeriodEndTime(currentPeriod.periodId, duration);
            const timeRemaining = Math.max(0, (endTime - now) / 1000);
            
            currentPeriod.timeRemaining = timeRemaining;
            currentPeriod.bettingOpen = timeRemaining > 5;
            
            // Update Redis for WebSocket service
            await storePeriodInRedisForWebSocket(gameType, duration, currentPeriod);
            
            // Handle betting closure notification
            if (timeRemaining <= 5 && timeRemaining > 0 && currentPeriod.bettingOpen) {
                await publishBettingClosed(gameType, duration, currentPeriod);
                console.log(`🔒 SCHEDULER: Betting closed for ${currentPeriod.periodId} (${timeRemaining.toFixed(1)}s remaining)`);
                
                // 🚀 ENHANCED: Trigger 5D pre-calculation during bet freeze
                if (gameType.toLowerCase() === '5d' || gameType.toLowerCase() === 'fived') {
                    try {
                        console.log(`⚡ [5D_PRE_CALC_TRIGGER] Starting pre-calculation for ${currentPeriod.periodId}`);
                        
                        const gameLogicService = require('../services/gameLogicService');
                        await gameLogicService.preCalculate5DResult(
                            gameType, duration, currentPeriod.periodId, 'default'
                        );
                        
                        console.log(`✅ [5D_PRE_CALC_TRIGGER] Pre-calculation completed for ${currentPeriod.periodId}`);
                    } catch (error) {
                        console.error(`❌ [5D_PRE_CALC_TRIGGER] Error in pre-calculation:`, error.message);
                        // Continue with normal processing even if pre-calculation fails
                    }
                }
            }
        }
        
    } catch (error) {
        console.error(`❌ Error in scheduler game tick [${gameType}|${duration}s]:`, error.message);
    }
};

/**
 * FIXED: Get next period for a game/duration
 */
const getNextPeriod = async (gameType, duration, currentPeriodId) => {
    try {
        // Extract current sequence number
        const currentSequence = parseInt(currentPeriodId.substring(8), 10);
        const dateStr = currentPeriodId.substring(0, 8);
        
        // Generate next period ID
        const nextSequence = currentSequence + 1;
        const nextPeriodId = `${dateStr}${nextSequence.toString().padStart(9, '0')}`;
        
        // Calculate times for next period
        const startTime = calculatePeriodStartTime(nextPeriodId, duration);
        const endTime = calculatePeriodEndTime(nextPeriodId, duration);
        
        return {
            periodId: nextPeriodId,
            gameType,
            duration,
            startTime,
            endTime,
            timeRemaining: duration,
            active: true,
            bettingOpen: true
        };
    } catch (error) {
        console.error('Error getting next period:', error);
        return null;
    }
};

/**
 * FIXED: Store period info in Redis for WebSocket service to read
 */
const storePeriodInRedisForWebSocket = async (gameType, duration, periodInfo) => {
    try {
        const redisKey = `game_scheduler:${gameType}:${duration}:current`;
        
        const periodData = {
            periodId: periodInfo.periodId,
            gameType,
            duration,
            startTime: periodInfo.startTime.toISOString(),
            endTime: periodInfo.endTime.toISOString(),
            timeRemaining: Math.max(0, (periodInfo.endTime - new Date()) / 1000),
            bettingOpen: periodInfo.bettingOpen !== false,
            updatedAt: new Date().toISOString(),
            source: 'game_scheduler'
        };
        
        await redis.set(redisKey, JSON.stringify(periodData));
        await redis.expire(redisKey, 3600);
        
    } catch (error) {
        console.error('❌ Error storing period in Redis for WebSocket:', error);
    }
};

/**
 * FIXED: Publish period start event for WebSocket service
 */
const publishPeriodStart = async (gameType, duration, periodInfo) => {
    try {
        const roomId = `${gameType}_${duration}`;
        
        const eventData = {
            gameType,
            duration,
            periodId: periodInfo.periodId,
            timeRemaining: duration,
            endTime: periodInfo.endTime.toISOString(),
            message: `New period started: ${periodInfo.periodId}`,
            roomId,
            timestamp: new Date().toISOString()
        };
        
        await redis.publish('game_scheduler:period_start', JSON.stringify(eventData));
        
    } catch (error) {
        console.error('❌ Error publishing period start:', error);
    }
};

/**
 * FIXED: Publish betting closed event for WebSocket service
 */
const publishBettingClosed = async (gameType, duration, periodInfo) => {
    try {
        const roomId = `${gameType}_${duration}`;
        
        const eventData = {
            gameType,
            duration,
            periodId: periodInfo.periodId,
            message: `Betting closed for ${periodInfo.periodId}`,
            roomId,
            timestamp: new Date().toISOString()
        };
        
        await redis.publish('game_scheduler:betting_closed', JSON.stringify(eventData));
        
    } catch (error) {
        console.error('❌ Error publishing betting closed:', error);
    }
};

// Backend/scripts/gameScheduler.js - COMPLETE FIX 1
/**
 * FIXED: Process period end with strict timing validation
 */
const processSchedulerPeriodEnd = async (gameType, duration, periodId) => {
  const processKey = `scheduler_${gameType}_${duration}_${periodId}`;
  
  try {
      // Prevent duplicate processing
      if (schedulerProcessingLocks.has(processKey)) {
          console.log(`🔒 SCHEDULER: Period ${periodId} already processing`);
          return;
      }
      
      schedulerProcessingLocks.add(processKey);
      
      console.log(`🏁 SCHEDULER: Starting period end validation [${gameType}|${duration}s]: ${periodId}`);
      console.log(`🏁 SCHEDULER: Period details: gameType=${gameType}, duration=${duration}, periodId=${periodId}`);
      
      // ✅ CRITICAL: Strict timing validation to prevent premature processing
      const periodEndTime = periodService.calculatePeriodEndTime(periodId, duration);
      const now = new Date();
      const timeSinceEnd = (now - periodEndTime) / 1000;
      
      console.log(`⏰ TIMING CHECK for ${periodId}:`);
      console.log(`   - Period should end at: ${periodEndTime.toISOString()}`);
      console.log(`   - Current time: ${now.toISOString()}`);
      console.log(`   - Time since end: ${timeSinceEnd.toFixed(2)}s`);
      
      // ✅ STRICT VALIDATION: Only process if period actually ended
      if (timeSinceEnd < -5) {
          console.warn(`⚠️ SCHEDULER: Period ${periodId} hasn't ended yet (${Math.abs(timeSinceEnd).toFixed(2)}s early) - REJECTING`);
          console.warn(`⚠️ This prevents premature result generation!`);
          return;
      }
      
      if (timeSinceEnd > 120) { // More than 2 minutes late
          console.warn(`⚠️ SCHEDULER: Period ${periodId} ended too long ago (${timeSinceEnd.toFixed(2)}s late) - REJECTING`);
          console.warn(`⚠️ This prevents processing very old periods!`);
          return;
      }
      
      console.log(`✅ SCHEDULER: Period ${periodId} timing is valid (${timeSinceEnd.toFixed(2)}s after end) - PROCEEDING`);
      
      // Enhanced Redis lock for cross-process safety with longer expiry
      const globalLockKey = `scheduler_result_lock_${gameType}_${duration}_${periodId}`;
      const lockValue = `scheduler_${Date.now()}_${process.pid}_${Math.random().toString(36).substr(2, 9)}`;
      
      console.log(`🔒 SCHEDULER: Acquiring enhanced Redis lock for ${periodId}...`);
      
      // ✅ Extended lock time to prevent race conditions
      const lockAcquired = await redis.set(globalLockKey, lockValue, 'EX', 300, 'NX'); // 5 minutes
      
      if (!lockAcquired) {
          const currentLockHolder = await redis.get(globalLockKey);
          console.log(`⚠️ SCHEDULER: Period ${periodId} already locked by: ${currentLockHolder}`);
          
          // Enhanced wait with timeout
          let waitAttempts = 0;
          const maxWaitAttempts = 60; // Wait up to 60 seconds
          
          while (waitAttempts < maxWaitAttempts) {
              await new Promise(resolve => setTimeout(resolve, 1000));
              
              const existingResult = await checkExistingSchedulerResult(gameType, duration, periodId);
              if (existingResult) {
                  console.log(`✅ SCHEDULER: Found existing result after wait for ${periodId}`);
                  await publishPeriodResult(gameType, duration, periodId, existingResult, 'existing_after_wait');
                  return;
              }
              
              // Check if lock is released
              const lockStatus = await redis.get(globalLockKey);
              if (!lockStatus) {
                  console.log(`🔓 SCHEDULER: Lock released for ${periodId}, retrying...`);
                  break;
              }
              
              waitAttempts++;
          }
          
          if (waitAttempts >= maxWaitAttempts) {
              console.error(`❌ SCHEDULER: Timeout waiting for ${periodId} processing`);
              return;
          }
          
          // Try to acquire lock again
          const retryLockAcquired = await redis.set(globalLockKey, lockValue, 'EX', 300, 'NX');
          if (!retryLockAcquired) {
              console.error(`❌ SCHEDULER: Failed to acquire lock after retry for ${periodId}`);
              return;
          }
      }
      
      console.log(`🔒 SCHEDULER: Enhanced lock acquired for ${periodId} by ${lockValue}`);
      
      try {
          // ✅ Final check for existing result with enhanced query
          const existingResult = await checkExistingSchedulerResult(gameType, duration, periodId);
          if (existingResult) {
              console.log(`✅ SCHEDULER: Using existing result for ${periodId}`);
              await publishPeriodResult(gameType, duration, periodId, existingResult, 'existing');
              return;
          }
          
          // ✅ Additional timing check before processing
          const finalTimingCheck = (new Date() - periodEndTime) / 1000;
          if (finalTimingCheck < -2) {
              console.warn(`⚠️ SCHEDULER: Final timing check failed for ${periodId} (${finalTimingCheck.toFixed(2)}s early)`);
              return;
          }
          
          console.log(`🎲 SCHEDULER: Generating NEW result for ${periodId} (${finalTimingCheck.toFixed(2)}s after end)`);
          console.log(`🎲 SCHEDULER: Calling gameLogicService.processGameResults...`);
          console.log(`🎲 SCHEDULER: Parameters: gameType=${gameType}, duration=${duration}, periodId=${periodId}, timeline=default`);
          
          // 🎯 WINGO-SPECIFIC LOGGING
          if (gameType.toLowerCase() === 'wingo') {
              console.log(`🎯 [WINGO_SCHEDULER] ==========================================`);
              console.log(`🎯 [WINGO_SCHEDULER] WINGO RESULT PROCESSING STARTED`);
              console.log(`🎯 [WINGO_SCHEDULER] Period: ${periodId}, Duration: ${duration}s`);
              console.log(`🎯 [WINGO_SCHEDULER] Time since period end: ${finalTimingCheck.toFixed(2)}s`);
              console.log(`🎯 [WINGO_SCHEDULER] ==========================================`);
          }
          
          // Process NEW results using gameLogicService with explicit timeline
          console.log(`🎲 SCHEDULER: About to call processGameResults...`);
          
          // Add connection timeout handling
          const processWithTimeout = async () => {
              return await gameLogicService.processGameResults(
                  gameType, 
                  duration, 
                  periodId,
                  'default' // ✅ Always use default timeline to prevent confusion
              );
          };
          
          const gameResult = await Promise.race([
              processWithTimeout(),
              new Promise((_, reject) => 
                  setTimeout(() => reject(new Error('Database operation timeout')), 45000)
              )
          ]);
          console.log(`🎲 SCHEDULER: processGameResults returned:`, gameResult);
          
          // 🎯 WINGO-SPECIFIC LOGGING
          if (gameType.toLowerCase() === 'wingo') {
              console.log(`🎯 [WINGO_SCHEDULER] processGameResults completed:`);
              console.log(`🎯 [WINGO_SCHEDULER] - Success: ${gameResult.success}`);
              console.log(`🎯 [WINGO_SCHEDULER] - Source: ${gameResult.source}`);
              console.log(`🎯 [WINGO_SCHEDULER] - Protection Mode: ${gameResult.protectionMode}`);
              console.log(`🎯 [WINGO_SCHEDULER] - Protection Reason: ${gameResult.protectionReason}`);
              if (gameResult.gameResult) {
                  console.log(`🎯 [WINGO_SCHEDULER] - Result: ${JSON.stringify(gameResult.gameResult)}`);
              }
              if (gameResult.winners && gameResult.winners.length > 0) {
                  console.log(`🎯 [WINGO_SCHEDULER] - Winners count: ${gameResult.winners.length}`);
                  console.log(`🎯 [WINGO_SCHEDULER] - First few winners:`, gameResult.winners.slice(0, 3));
              } else {
                  console.log(`🎯 [WINGO_SCHEDULER] - No winners found`);
              }
          }
          
          console.log(`🎲 SCHEDULER: processGameResults completed for ${periodId}:`, {
              success: gameResult.success,
              source: gameResult.source,
              protectionMode: gameResult.protectionMode,
              protectionReason: gameResult.protectionReason
          });
          
          if (gameResult.success) {
              // 🎯 WINGO-SPECIFIC LOGGING
              if (gameType.toLowerCase() === 'wingo') {
                  console.log(`🎯 [WINGO_SCHEDULER] Publishing result to WebSocket...`);
              }
              
              await publishPeriodResult(
                  gameType, 
                  duration, 
                  periodId, 
                  {
                      result: gameResult.gameResult,
                      winners: gameResult.winners || [],
                      verification: gameResult.verification
                  }, 
                  'new'
              );
              
              // 🎯 WINGO-SPECIFIC LOGGING
              if (gameType.toLowerCase() === 'wingo') {
                  console.log(`🎯 [WINGO_SCHEDULER] ==========================================`);
                  console.log(`🎯 [WINGO_SCHEDULER] WINGO RESULT PROCESSING COMPLETED`);
                  console.log(`🎯 [WINGO_SCHEDULER] Period: ${periodId}`);
                  console.log(`🎯 [WINGO_SCHEDULER] Result: ${JSON.stringify(gameResult.gameResult)}`);
                  console.log(`🎯 [WINGO_SCHEDULER] Winners: ${gameResult.winners ? gameResult.winners.length : 0}`);
                  console.log(`🎯 [WINGO_SCHEDULER] ==========================================`);
              }
              
              console.log(`✅ SCHEDULER: NEW result processed for ${periodId}: ${JSON.stringify(gameResult.gameResult)}`);
              
          } else {
              // 🎯 WINGO-SPECIFIC LOGGING
              if (gameType.toLowerCase() === 'wingo') {
                  console.log(`🎯 [WINGO_SCHEDULER] ❌ RESULT PROCESSING FAILED`);
                  console.log(`🎯 [WINGO_SCHEDULER] Error: ${gameResult.message}`);
              }
              throw new Error(gameResult.message || 'Failed to process results');
          }
          
      } catch (processError) {
          console.error(`❌ SCHEDULER: Result processing error for ${periodId}:`, processError.message);
          
          // 🎯 WINGO-SPECIFIC LOGGING
          if (gameType.toLowerCase() === 'wingo') {
              console.log(`🎯 [WINGO_SCHEDULER] ❌ ERROR DURING RESULT PROCESSING`);
              console.log(`🎯 [WINGO_SCHEDULER] Error: ${processError.message}`);
              console.log(`🎯 [WINGO_SCHEDULER] Stack: ${processError.stack}`);
          }
          
          // Generate fallback result only if timing is still valid
          const fallbackTimingCheck = (new Date() - periodEndTime) / 1000;
          if (fallbackTimingCheck >= -2 && fallbackTimingCheck <= 180) { // Within 3 minutes
              try {
                  console.log(`🎲 SCHEDULER: Generating fallback result for ${periodId}`);
                  
                  // 🎯 WINGO-SPECIFIC LOGGING
                  if (gameType.toLowerCase() === 'wingo') {
                      console.log(`🎯 [WINGO_SCHEDULER] Generating fallback result...`);
                  }
                  
                  const fallbackResult = await generateSchedulerFallbackResult(gameType);
                  
                  // 🎯 WINGO-SPECIFIC LOGGING
                  if (gameType.toLowerCase() === 'wingo') {
                      console.log(`🎯 [WINGO_SCHEDULER] Fallback result: ${JSON.stringify(fallbackResult)}`);
                  }
                  
                  await publishPeriodResult(
                      gameType, 
                      duration, 
                      periodId, 
                      {
                          result: fallbackResult,
                          winners: [],
                          verification: null
                      }, 
                      'fallback'
                  );
                  
                  // 🎯 WINGO-SPECIFIC LOGGING
                  if (gameType.toLowerCase() === 'wingo') {
                      console.log(`🎯 [WINGO_SCHEDULER] ✅ FALLBACK RESULT PUBLISHED`);
                  }
                  
                  console.log(`✅ SCHEDULER: Fallback result generated for ${periodId}`);
                  
              } catch (fallbackError) {
                  console.error(`❌ SCHEDULER: Fallback result generation failed for ${periodId}:`, fallbackError.message);
                  
                  // 🎯 WINGO-SPECIFIC LOGGING
                  if (gameType.toLowerCase() === 'wingo') {
                      console.log(`🎯 [WINGO_SCHEDULER] ❌ FALLBACK RESULT GENERATION FAILED`);
                      console.log(`🎯 [WINGO_SCHEDULER] Error: ${fallbackError.message}`);
                  }
                  
                  await publishPeriodError(gameType, duration, periodId, 'Failed to generate result');
              }
          } else {
              console.error(`❌ SCHEDULER: Timing invalid for fallback (${fallbackTimingCheck.toFixed(2)}s)`);
              
              // 🎯 WINGO-SPECIFIC LOGGING
              if (gameType.toLowerCase() === 'wingo') {
                  console.log(`🎯 [WINGO_SCHEDULER] ❌ TIMING INVALID FOR FALLBACK`);
                  console.log(`🎯 [WINGO_SCHEDULER] Time since end: ${fallbackTimingCheck.toFixed(2)}s`);
              }
              
              await publishPeriodError(gameType, duration, periodId, 'Timing validation failed');
          }
      } finally {
          // Always release lock
          try {
              const currentLock = await redis.get(globalLockKey);
              if (currentLock === lockValue) {
                  await redis.del(globalLockKey);
                  console.log(`🔓 SCHEDULER: Released enhanced lock for ${periodId}`);
              } else {
                  console.warn(`⚠️ SCHEDULER: Lock changed for ${periodId}: expected ${lockValue}, found ${currentLock}`);
              }
          } catch (lockError) {
              console.error('❌ SCHEDULER: Error releasing enhanced lock:', lockError);
          }
      }

  } catch (error) {
      console.error(`❌ SCHEDULER: Period end error for ${periodId}:`, error);
  } finally {
      schedulerProcessingLocks.delete(processKey);
  }
};

// [Include all other existing functions: checkExistingSchedulerResult, generateSchedulerFallbackResult, 
//  publishPeriodResult, publishPeriodError, resetDailySequences, etc. - unchanged]

/**
 * FIXED: Check existing result for scheduler - duration-based only
 */
const checkExistingSchedulerResult = async (gameType, duration, periodId) => {
    try {
        const whereClause = { duration: duration };
        let existingResult = null;
        
        switch (gameType.toLowerCase()) {
            case 'wingo':
                whereClause.bet_number = periodId;
                existingResult = await models.BetResultWingo.findOne({
                    where: whereClause,
                    order: [['created_at', 'DESC']]
                });
                
                if (existingResult) {
                    return {
                        result: {
                            number: existingResult.result_of_number,
                            color: existingResult.result_of_color,
                            size: existingResult.result_of_size
                        },
                        winners: []
                    };
                }
                break;
                
            case 'trx_wix':
                whereClause.period = periodId;
                existingResult = await models.BetResultTrxWix.findOne({
                    where: whereClause,
                    order: [['created_at', 'DESC']]
                });
                
                if (existingResult) {
                    let resultData;
                    try {
                        resultData = typeof existingResult.result === 'string' ? 
                            JSON.parse(existingResult.result) : existingResult.result;
                    } catch (parseError) {
                        console.warn('SCHEDULER: Error parsing result:', parseError);
                        return null;
                    }
                    
                    return {
                        result: resultData,
                        verification: {
                            hash: existingResult.verification_hash,
                            link: existingResult.verification_link
                        },
                        winners: []
                    };
                }
                break;
                
            case 'fived':
            case '5d':
                whereClause.bet_number = periodId;
                existingResult = await models.BetResult5D.findOne({
                    where: whereClause,
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
                        winners: []
                    };
                }
                break;
                
            case 'k3':
                whereClause.bet_number = periodId;
                existingResult = await models.BetResultK3.findOne({
                    where: whereClause,
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
                        winners: []
                    };
                }
                break;
        }
        
        return null;
        
    } catch (error) {
        console.error(`❌ SCHEDULER: Error checking existing result:`, error);
        return null;
    }
};

/**
 * FIXED: Generate fallback result for scheduler
 */
const generateSchedulerFallbackResult = async (gameType) => {
    try {
        const randomBase = Date.now() % 10000;
        
        switch (gameType.toLowerCase()) {
            case 'wingo':
            case 'trx_wix':
                const number = randomBase % 10;
                const color = getColorForNumber(number);
                return {
                    number: number,
                    size: number >= 5 ? 'Big' : 'Small',
                    color: color,
                    verification: gameType === 'trx_wix' ? {
                        hash: generateVerificationHash(),
                        link: generateVerificationLink()
                    } : undefined
                };

            case 'fived':
            case '5d':
                const dice = [];
                for (let i = 0; i < 5; i++) {
                    dice.push(((randomBase + i) % 6) + 1);
                }
                return {
                    A: dice[0], B: dice[1], C: dice[2], D: dice[3], E: dice[4],
                    sum: dice.reduce((a, b) => a + b, 0)
                };

            case 'k3':
                const k3Dice = [];
                for (let i = 0; i < 3; i++) {
                    k3Dice.push(((randomBase + i) % 6) + 1);
                }
                const sum = k3Dice.reduce((a, b) => a + b, 0);
                const counts = k3Dice.reduce((acc, val) => {
                    acc[val] = (acc[val] || 0) + 1;
                    return acc;
                }, {});

                return {
                    dice_1: k3Dice[0], dice_2: k3Dice[1], dice_3: k3Dice[2],
                    sum: sum,
                    has_pair: Object.values(counts).includes(2) && !Object.values(counts).includes(3),
                    has_triple: Object.values(counts).includes(3),
                    is_straight: k3Dice.sort((a, b) => a - b).every((val, idx, arr) =>
                        idx === 0 || val === arr[idx - 1] + 1
                    ),
                    sum_size: sum > 10 ? 'Big' : 'Small',
                    sum_parity: sum % 2 === 0 ? 'Even' : 'Odd'
                };

            default:
                throw new Error(`Unsupported game type: ${gameType}`);
        }
    } catch (error) {
        console.error('❌ SCHEDULER: Error generating fallback result:', error);
        throw error;
    }
};

/**
 * FIXED: Publish period result for WebSocket service
 */
const publishPeriodResult = async (gameType, duration, periodId, resultData, source) => {
    try {
        const roomId = `${gameType}_${duration}`;
        
        const eventData = {
            gameType,
            duration,
            periodId,
            result: resultData.result,
            winners: resultData.winners || [],
            winnerCount: Array.isArray(resultData.winners) ? resultData.winners.length : 0,
            totalPayout: Array.isArray(resultData.winners) ? 
                resultData.winners.reduce((sum, winner) => sum + (winner.winnings || 0), 0) : 0,
            verification: resultData.verification,
            timestamp: new Date().toISOString(),
            source: `scheduler_${source}`,
            roomId
        };

        await redis.publish('game_scheduler:period_result', JSON.stringify(eventData));
        
        console.log(`📢 SCHEDULER: Published result for ${periodId} (${source}) to ${roomId}`);

    } catch (error) {
        console.error('❌ SCHEDULER: Error publishing period result:', error);
    }
};

/**
 * FIXED: Publish period error for WebSocket service
 */
const publishPeriodError = async (gameType, duration, periodId, message) => {
    try {
        const roomId = `${gameType}_${duration}`;
        
        const eventData = {
            gameType,
            duration,
            periodId,
            message,
            timestamp: new Date().toISOString(),
            source: 'scheduler_error',
            roomId
        };

        await redis.publish('game_scheduler:period_error', JSON.stringify(eventData));

    } catch (error) {
        console.error('❌ SCHEDULER: Error publishing period error:', error);
    }
};

/**
 * Utility functions
 */
const getColorForNumber = (number) => {
    const colorMap = {
        0: 'red_violet', 1: 'green', 2: 'red', 3: 'green', 4: 'red',
        5: 'green_violet', 6: 'red', 7: 'green', 8: 'red', 9: 'green'
    };
    return colorMap[number];
};

const generateVerificationHash = () => {
    const crypto = require('crypto');
    return crypto.randomBytes(32).toString('hex');
};

const generateVerificationLink = () => {
    const hash = generateVerificationHash();
    return `https://tronscan.org/#/transaction/${hash}`;
};

/**
 * FIXED: Reset all sequence counters at 2 AM IST - duration-based only
 */
const resetDailySequences = async () => {
    const lockKey = 'daily_sequence_reset_lock';
    const lockValue = `${Date.now()}_${process.pid}`;
    
    try {
        console.log('🔄 SCHEDULER: Starting daily sequence reset at 2 AM IST...');
        
        const acquired = await redis.set(lockKey, lockValue, 'EX', 600, 'NX');
        
        if (!acquired) {
            console.log('⚠️ SCHEDULER: Daily reset already running on another instance, skipping...');
            return;
        }

        console.log('🔒 SCHEDULER: Acquired reset lock, proceeding with daily sequence reset');
        
        const today = moment.tz('Asia/Kolkata').format('YYYYMMDD');
        console.log(`🔄 SCHEDULER: Resetting daily sequences for ${today}`);

        let resetCount = 0;
        for (const [gameType, durations] of Object.entries(GAME_CONFIGS)) {
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
                    console.log(`✅ SCHEDULER: Reset sequence for ${gameType}:${duration}`);
                } catch (sequenceError) {
                    console.error(`❌ SCHEDULER: Failed to reset sequence for ${gameType}:${duration}:`, sequenceError);
                }
            }
        }

        console.log(`✅ SCHEDULER: Daily sequence reset completed! Reset ${resetCount} sequences`);

    } catch (error) {
        console.error('❌ SCHEDULER: Error in daily sequence reset:', error);
    } finally {
        try {
            const currentValue = await redis.get(lockKey);
            if (currentValue === lockValue) {
                await redis.del(lockKey);
                console.log('🔓 SCHEDULER: Released reset lock');
            }
        } catch (lockError) {
            console.error('❌ SCHEDULER: Error releasing reset lock:', lockError);
        }
    }
};

// Schedule daily period sequence reset at 2 AM IST
cron.schedule('0 2 * * *', async () => {
    console.log('🕐 SCHEDULER: 2 AM IST - Starting daily period sequence reset...');
    try {
        await resetDailySequences();
    } catch (error) {
        console.error('❌ SCHEDULER: Failed to run daily sequence reset:', error);
    }
}, {
    timezone: "Asia/Kolkata"
});

// Schedule hourly TRON hash collection refresh
cron.schedule('0 * * * *', async () => {
    console.log('🔄 SCHEDULER: Refreshing TRON hash collection...');
    try {
        if (tronHashService) {
            await tronHashService.startHashCollection();
            console.log('✅ SCHEDULER: TRON hash collection refreshed');
        }
    } catch (error) {
        console.error('❌ SCHEDULER: Failed to refresh TRON hash collection:', error);
    }
});

/**
 * FIXED: Start the game scheduler with duration-based period management
 */
const startGameScheduler = async () => {
    try {
        await initialize();
        
        // Start duration-based game tick system
        await startSchedulerGameTicks();
        
        console.log('✅ SCHEDULER: Game scheduler started successfully with TIME-BASED period management');
        
        // Log all scheduled cron jobs
        console.log('\n📅 SCHEDULER CRON JOBS:');
        console.log('⏰ 2:00 AM IST - Daily period sequence reset');
        console.log('⏰ Every hour - TRON hash collection refresh');
        console.log('🎮 SCHEDULER handles ALL period management and result processing');
        console.log('📡 WebSocket service handles ONLY broadcasting');
        console.log('🎯 FIXED: Time-based period validation (no early results)\n');
        
        return true;
        
    } catch (error) {
        console.error('❌ SCHEDULER: Error starting game scheduler:', error);
        return false;
    }
};

// Handle process termination
process.on('SIGINT', () => {
    console.log('SCHEDULER: Game scheduler stopped');
    
    // Clean up intervals
    schedulerGameIntervals.forEach((intervalId, key) => {
        clearInterval(intervalId);
        console.log(`⏹️ SCHEDULER: Stopped ticks for ${key}`);
    });
    
    process.exit(0);
});

// Export for use in other files
module.exports = {
    startGameScheduler,
    resetDailySequences,
    
    // Status functions
    getSchedulerStats: () => ({
        schedulerGameTicksStarted,
        activeSchedulerIntervals: schedulerGameIntervals.size,
        cachedSchedulerPeriods: schedulerCurrentPeriods.size,
        processingLocks: schedulerProcessingLocks.size,
        processedPeriods: processedPeriods.size,
        supportedGames: Object.keys(GAME_CONFIGS),
        gameConfigs: GAME_CONFIGS,
        mode: 'TIME_BASED_PERIOD_MANAGEMENT',
        totalRooms: Object.values(GAME_CONFIGS).reduce((sum, durations) => sum + durations.length, 0)
    }),
    
    // Debug function
    verifySchedulerTicks: () => {
        console.log('🔍 Verifying SCHEDULER TIME-BASED tick system...');
        
        const expectedIntervals = Object.values(GAME_CONFIGS).reduce((sum, durations) => sum + durations.length, 0);
        const activeIntervals = schedulerGameIntervals.size;
        
        console.log(`📊 Scheduler tick system status:`);
        console.log(`   - Active intervals: ${activeIntervals}`);
        console.log(`   - Expected intervals: ${expectedIntervals}`);
        console.log(`   - System started: ${schedulerGameTicksStarted}`);
        console.log(`   - Cached periods: ${schedulerCurrentPeriods.size}`);
        console.log(`   - Processing locks: ${schedulerProcessingLocks.size}`);
        console.log(`   - Processed periods: ${processedPeriods.size}`);
        
        // Show detailed status
        Object.keys(GAME_CONFIGS).forEach(gameType => {
            console.log(`\n📋 ${gameType.toUpperCase()} rooms:`);
            GAME_CONFIGS[gameType].forEach(duration => {
                const key = `${gameType}_${duration}`;
                const hasInterval = schedulerGameIntervals.has(key);
                const hasCachedPeriod = schedulerCurrentPeriods.has(key);
                console.log(`   - ${key}: ${hasInterval ? '✅' : '❌'} Interval | ${hasCachedPeriod ? '✅' : '❌'} Period`);
            });
        });
        
        return {
            active: activeIntervals,
            expected: expectedIntervals,
            started: schedulerGameTicksStarted,
            working: activeIntervals === expectedIntervals && schedulerGameTicksStarted
        };
    }
};

// Don't auto-start if this file is run directly
if (require.main === module) {
    console.log('🚫 SCHEDULER: Auto-start disabled - use start-scheduler.js instead');
}