const unifiedRedis = require('../config/unifiedRedisManager');
const { connectDB } = require('../config/db');
const cron = require('node-cron');
const logger = require('../utils/logger');
const moment = require('moment-timezone');

// Import services after DB connection is established
let periodService = null;
let gameLogicService = null;

// Models and sequelize
let models = null;
let sequelize = null;

// 5D Pre-Calculation Scheduler specific variables
let schedulerPublisher = null;
let schedulerSubscriber = null;
let schedulerHelper = null;

// 5D Pre-Calculation tracking
const fiveDPreCalcTracking = new Map(); // Key: gameType_duration_periodId
const fiveDPreCalcLocks = new Set(); // Prevent duplicate pre-calculations

// 5D Game configurations
const FIVE_D_CONFIGS = {
    'fiveD': [60, 180, 300, 600]  // 4 rooms: fiveD_60, fiveD_180, fiveD_300, fiveD_600
};

/**
 * Setup Redis communication for 5D pre-calculation scheduler
 */
const setup5DPreCalcCommunication = async () => {
    try {
        console.log('🔄 [5D_PRECALC_COMM] Setting up 5D pre-calculation communication...');
        
        // Initialize UnifiedRedisManager first
        console.log('🔄 [5D_PRECALC_COMM] Initializing Unified Redis Manager...');
        await unifiedRedis.initialize();
        console.log('✅ [5D_PRECALC_COMM] Unified Redis Manager initialized');
        
        // Get Redis helper for operations
        schedulerHelper = await unifiedRedis.getHelper();
        console.log('✅ [5D_PRECALC_COMM] Redis helper obtained');
        
        // Create dedicated publisher for pub/sub functionality
        schedulerPublisher = new (require('ioredis'))({
            host: process.env.REDIS_HOST || 'localhost',
            port: process.env.REDIS_PORT || 6379,
            password: process.env.REDIS_PASSWORD || '',
            db: process.env.REDIS_DB || 0,
            
            // TLS configuration for ElastiCache
            tls: process.env.REDIS_HOST?.includes('cache.amazonaws.com') ? {
                rejectUnauthorized: false,
                requestCert: false,
                agent: false
            } : false,
            
            // Connection settings
            connectTimeout: 15000,
            commandTimeout: 30000, // INCREASED: 30 seconds for large operations
            lazyConnect: false,
            enableOfflineQueue: true,
            maxRetriesPerRequest: 3,
            family: 4,
            
            // Retry strategy
            retryStrategy: (times) => {
                return Math.min(times * 50, 2000);
            }
        });
        
        // Wait for publisher to be ready
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('5D pre-calculation publisher connection timeout'));
            }, 15000);
            
            if (schedulerPublisher.status === 'ready') {
                clearTimeout(timeout);
                resolve();
                return;
            }
            
            schedulerPublisher.on('ready', () => {
                clearTimeout(timeout);
                resolve();
            });
            
            schedulerPublisher.on('error', (err) => {
                clearTimeout(timeout);
                reject(err);
            });
        });
        
        console.log('✅ [5D_PRECALC_COMM] Publisher created and connected');
        
        // Create dedicated subscriber for pub/sub functionality
        schedulerSubscriber = new (require('ioredis'))({
            host: process.env.REDIS_HOST || 'localhost',
            port: process.env.REDIS_PORT || 6379,
            password: process.env.REDIS_PASSWORD || '',
            db: process.env.REDIS_DB || 0,
            
            // TLS configuration for ElastiCache
            tls: process.env.REDIS_HOST?.includes('cache.amazonaws.com') ? {
                rejectUnauthorized: false,
                requestCert: false,
                agent: false
            } : false,
            
            // Connection settings
            connectTimeout: 30000,
            commandTimeout: 30000,
            lazyConnect: false,
            enableOfflineQueue: true,
            maxRetriesPerRequest: null,
            
            // Retry strategy
            retryStrategy: (times) => {
                const delay = Math.min(times * 1000, 5000);
                return delay;
            }
        });
        
        // Wait for subscriber to be ready
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('5D pre-calculation subscriber connection timeout'));
            }, 15000);
            
            if (schedulerSubscriber.status === 'ready') {
                clearTimeout(timeout);
                resolve();
                return;
            }
            
            schedulerSubscriber.on('ready', () => {
                clearTimeout(timeout);
                resolve();
            });
            
            schedulerSubscriber.on('error', (err) => {
                clearTimeout(timeout);
                reject(err);
            });
        });
        
        // Subscribe to the channel
        await schedulerSubscriber.subscribe('5d_precalc:trigger');
        
        schedulerSubscriber.on('message', async (channel, message) => {
            try {
                const request = JSON.parse(message);
                console.log(`📥 [5D_PRECALC_COMM] Received pre-calculation request:`, request);
                
                if (request.action === 'trigger_precalc') {
                    await handle5DPreCalcRequest(request.gameType, request.duration, request.periodId);
                }
            } catch (error) {
                console.error('❌ [5D_PRECALC_COMM] Error handling pre-calculation request:', error);
            }
        });
        
        console.log('✅ [5D_PRECALC_COMM] 5D pre-calculation communication setup complete');
        
    } catch (error) {
        console.error('❌ [5D_PRECALC_COMM] Error setting up communication:', error);
        throw error;
    }
};

/**
 * Handle 5D pre-calculation request from WebSocket service
 */
const handle5DPreCalcRequest = async (gameType, duration, periodId) => {
    try {
        const trackingKey = `${gameType}_${duration}_${periodId}`;
        
        // Check if already processing
        if (fiveDPreCalcLocks.has(trackingKey)) {
            console.log(`🔒 [5D_PRECALC] Already processing pre-calculation for ${trackingKey}`);
            return;
        }
        
        // Add to processing locks
        fiveDPreCalcLocks.add(trackingKey);
        
        console.log(`🔄 [5D_PRECALC] Starting pre-calculation for ${trackingKey}`);
        
        // Execute pre-calculation
        await execute5DPreCalculation(gameType, duration, periodId);
        
        // Remove from processing locks
        fiveDPreCalcLocks.delete(trackingKey);
        
    } catch (error) {
        console.error(`❌ [5D_PRECALC] Error handling pre-calculation request:`, error);
        // Remove from processing locks on error
        const trackingKey = `${gameType}_${duration}_${periodId}`;
        fiveDPreCalcLocks.delete(trackingKey);
    }
};

/**
 * Execute 5D pre-calculation at bet freeze with final bet patterns
 * ENHANCED: Load balancer safety mechanisms + Sorted Set optimization
 */
const execute5DPreCalculation = async (gameType, duration, periodId) => {
    const startTime = Date.now();
    const timeline = 'default';
    
    try {
        console.log(`🎯 [5D_PRECALC_EXEC] Starting pre-calculation for period ${periodId}`);
        
        // 1. Verify bet freeze is active (betting should be closed)
        const bettingStatus = await verifyBetFreezeStatus(gameType, duration, periodId);
        if (!bettingStatus.isFrozen) {
            console.log(`⚠️ [5D_PRECALC_EXEC] Betting not frozen yet for period ${periodId}, skipping`);
            return;
        }
        
        console.log(`✅ [5D_PRECALC_EXEC] Bet freeze confirmed for period ${periodId}`);
        
        // 2. Get current bet patterns from Redis
        const betPatterns = await getCurrentBetPatterns(gameType, duration, periodId, timeline);
        console.log(`📊 [5D_PRECALC_EXEC] Retrieved bet patterns for period ${periodId}:`, {
            totalBets: Object.keys(betPatterns).length,
            totalExposure: Object.values(betPatterns).reduce((sum, val) => sum + parseFloat(val), 0)
        });
        
        // 3. 🚀 ENHANCED: Try Parallel Processing method first for ultra-fast results
        console.log(`🚀 [5D_PRECALC_EXEC] Attempting Parallel Processing method for period ${periodId}`);
        
        let result = null;
        let methodUsed = 'hash';
        
        // 🚀 OPTIMIZATION: Check if there are any bets before attempting parallel processing
        const betCount = Object.keys(betPatterns).length;
        if (betCount === 0) {
            console.log(`🚀 [5D_PRECALC_EXEC] No bets detected - using instant result generation`);
            
            // Generate a simple random result instantly
            const randomResult = {
                A: Math.floor(Math.random() * 10),
                B: Math.floor(Math.random() * 10),
                C: Math.floor(Math.random() * 10),
                D: Math.floor(Math.random() * 10),
                E: Math.floor(Math.random() * 10)
            };
            
            const sum = randomResult.A + randomResult.B + randomResult.C + randomResult.D + randomResult.E;
            randomResult.sum = sum;
            randomResult.sum_size = sum < 22 ? 'small' : 'big';
            randomResult.sum_parity = sum % 2 === 0 ? 'even' : 'odd';
            randomResult.exposure = 0;
            randomResult.method = 'instant_no_bets';
            
            result = randomResult;
            methodUsed = 'instant_no_bets';
            
            console.log(`✅ [5D_PRECALC_EXEC] Instant result generated for period ${periodId} (no bets)`);
            
        } else {
            try {
                // Import Parallel Processing service
                const { getOptimal5DResultParallel } = require('../services/5dParallelProcessor');
                
                // Try Parallel Processing method (2 worker threads, 50,000 combinations each)
                result = await getOptimal5DResultParallel(duration, periodId, timeline);
                methodUsed = 'parallel_worker_threads';
                
                console.log(`✅ [5D_PRECALC_EXEC] Parallel Processing method successful for period ${periodId}`);
                
            } catch (parallelError) {
                console.log(`⚠️ [5D_PRECALC_EXEC] Parallel Processing method failed, trying Sorted Set method:`, parallelError.message);
                
                try {
                    // Fallback to Sorted Set method
                    const { getOptimal5DResultByExposureSortedSet } = require('../services/5dSortedSetService');
                    result = await getOptimal5DResultByExposureSortedSet(duration, periodId, timeline);
                    methodUsed = 'sorted_set_fallback';
                    
                    console.log(`✅ [5D_PRECALC_EXEC] Sorted Set fallback successful for period ${periodId}`);
                    
                } catch (sortedSetError) {
                    console.log(`⚠️ [5D_PRECALC_EXEC] Sorted Set method also failed, falling back to Hash method:`, sortedSetError.message);
                    
                    // Final fallback to original Hash method
                    result = await gameLogicService.getOptimal5DResultByExposureFast(duration, periodId, timeline);
                    methodUsed = 'hash_fallback';
                }
            }
        }
        
        if (!result) {
            console.log(`❌ [5D_PRECALC_EXEC] No result generated for period ${periodId}`);
            return;
        }
        
        // 4. Store result in Redis (with load balancer safety)
        const resultKey = `precalc_5d_result:${gameType}:${duration}:${timeline}:${periodId}`;
        const preCalcData = {
            result: result,
            betPatterns: betPatterns,
            calculatedAt: new Date().toISOString(),
            periodId: periodId,
            gameType: gameType,
            duration: duration,
            timeline: timeline,
            methodUsed: methodUsed, // Track which method was used
            // ENHANCED: Add load balancer safety data
            schedulerInstance: process.env.PM2_INSTANCE_ID || 'unknown',
            schedulerHost: require('os').hostname(),
            schedulerPid: process.pid,
            calculatedBy: '5d_precalc_scheduler'
        };
        
        // ENHANCED: Use Redis SET with NX to prevent race conditions
        const stored = await schedulerHelper.set(resultKey, JSON.stringify(preCalcData), 'EX', 300, 'NX');
        
        if (!stored) {
            console.log(`⚠️ [5D_PRECALC_EXEC] Result already stored by another instance for period ${periodId}`);
            return;
        }
        
        console.log(`💾 [5D_PRECALC_EXEC] Result stored in Redis for period ${periodId} (method: ${methodUsed})`);
        
        console.log(`🗄️ [5D_PRECALC_EXEC] About to attempt database save for period ${periodId}...`);
        
        // 🗄️ CRITICAL: Save result to database so API can read it
        try {
            console.log(`💾 [5D_PRECALC_EXEC] Saving result to database for period ${periodId}...`);
            console.log(`💾 [5D_PRECALC_EXEC] gameLogicService available:`, !!gameLogicService);
            
            // Ensure models are initialized
            await gameLogicService.ensureModelsInitialized();
            const models = await gameLogicService.models;
            console.log(`💾 [5D_PRECALC_EXEC] Models available:`, !!models);
            console.log(`💾 [5D_PRECALC_EXEC] BetResult5D model available:`, !!models.BetResult5D);
            
            // Check if result already exists to avoid duplicates
            const existingResult = await models.BetResult5D.findOne({
                where: {
                    bet_number: periodId,
                    duration: duration,
                    timeline: timeline
                }
            });
            
            if (existingResult) {
                console.log(`⚠️ [5D_PRECALC_EXEC] Result already exists in database, skipping save`);
            } else {
                console.log(`💾 [5D_PRECALC_EXEC] No existing result found, proceeding with database save...`);
                
                // 🚀 DEADLOCK PREVENTION: Use database transaction with proper error handling
                let savedResult = null;
                let retryCount = 0;
                const maxRetries = 3;
                const baseDelay = 1000; // 1 second base delay
                
                while (!savedResult && retryCount < maxRetries) {
                    try {
                        let transaction = null;
                        
                        // Try to create transaction, fallback to direct create if it fails
                        try {
                            // Create transaction with timeout only (compatible with all Sequelize versions)
                            transaction = await models.sequelize.transaction({
                                timeout: 30000 // 30 second timeout
                            });
                            
                        } catch (transactionError) {
                            console.warn(`⚠️ [5D_PRECALC_EXEC] Transaction creation failed, using direct create:`, transactionError.message);
                            transaction = null;
                        }
                        
                        try {
                            // 🚀 CRITICAL FIX: Check for existing result before creating new one
                            const existingResult = await models.BetResult5D.findOne({
                                where: {
                                    bet_number: periodId,
                                    duration: duration,
                                    timeline: timeline
                                },
                                transaction: transaction
                            });
                            
                            if (existingResult) {
                                console.log(`⚠️ [DUPLICATE_RESULT_PREVENTION] Result already exists for period ${periodId}, skipping creation`);
                                savedResult = existingResult;
                            } else {
                                console.log(`💾 [RESULT_CREATION] Creating new BetResult5D for period ${periodId}`);
                                
                                if (transaction) {
                                    // Use transaction if available
                                    savedResult = await models.BetResult5D.create({
                                        bet_number: periodId,
                                        result_a: result.A,
                                        result_b: result.B,
                                        result_c: result.C,
                                        result_d: result.D,
                                        result_e: result.E,
                                        total_sum: result.sum,
                                        duration: duration,
                                        timeline: timeline
                                    }, { transaction });
                                    
                                    // Commit transaction
                                    await transaction.commit();
                                    console.log(`✅ [5D_PRECALC_EXEC] Successfully saved to database with transaction, ID: ${savedResult.bet_id}`);
                                } else {
                                    // Fallback to direct create without transaction
                                    savedResult = await models.BetResult5D.create({
                                        bet_number: periodId,
                                        result_a: result.A,
                                        result_b: result.B,
                                        result_c: result.C,
                                        result_d: result.D,
                                        result_e: result.E,
                                        total_sum: result.sum,
                                        duration: duration,
                                        timeline: timeline
                                    });
                                    
                                    console.log(`✅ [5D_PRECALC_EXEC] Successfully saved to database without transaction, ID: ${savedResult.bet_id}`);
                                }
                            }
                            
                        } catch (createError) {
                            // Rollback transaction on error if transaction exists
                            if (transaction) {
                                try {
                                    await transaction.rollback();
                                } catch (rollbackError) {
                                    console.warn(`⚠️ [5D_PRECALC_EXEC] Transaction rollback failed:`, rollbackError.message);
                                }
                            }
                            throw createError;
                        }
                        
                    } catch (createError) {
                        retryCount++;
                        
                        // Check if it's a deadlock error
                        const isDeadlock = createError.message.includes('Lock wait timeout exceeded') || 
                                         createError.message.includes('Deadlock found') ||
                                         createError.message.includes('ER_LOCK_WAIT_TIMEOUT');
                        
                        if (isDeadlock) {
                            console.error(`🚨 [5D_PRECALC_EXEC] DEADLOCK detected on attempt ${retryCount}:`, createError.message);
                        } else {
                            console.error(`❌ [5D_PRECALC_EXEC] Database error on attempt ${retryCount}:`, createError.message);
                        }
                        
                        if (retryCount < maxRetries) {
                            // Exponential backoff with jitter for deadlocks
                            const delay = isDeadlock ? 
                                (baseDelay * Math.pow(2, retryCount) + Math.random() * 1000) : // Add jitter for deadlocks
                                (baseDelay * Math.pow(2, retryCount));
                            
                            console.log(`⏳ [5D_PRECALC_EXEC] Waiting ${Math.round(delay)}ms before retry...`);
                            await new Promise(resolve => setTimeout(resolve, delay));
                        } else {
                            console.error(`❌ [5D_PRECALC_EXEC] All retry attempts failed`);
                            console.error(`❌ [5D_PRECALC_EXEC] Final error:`, createError.message);
                        }
                    }
                }
            }
        } catch (dbError) {
            console.error(`❌ [5D_PRECALC_EXEC] Failed to save to database:`, dbError.message);
            // Continue even if DB save fails
        }
        
        // 5. Publish completion notification (load balancer safe)
        const completionMessage = {
            action: 'precalc_completed',
            gameType: gameType,
            duration: duration,
            periodId: periodId,
            timeline: timeline,
            result: result,
            methodUsed: methodUsed, // Include method used
            completedAt: new Date().toISOString(),
            // ENHANCED: Add load balancer safety data
            schedulerInstance: process.env.PM2_INSTANCE_ID || 'unknown',
            schedulerHost: require('os').hostname(),
            schedulerPid: process.pid,
            resultKey: resultKey, // Include Redis key for verification
            betPatternCount: Object.keys(betPatterns).length,
            totalExposure: Object.values(betPatterns).reduce((sum, val) => sum + parseFloat(val), 0)
        };
        
        try {
            await schedulerPublisher.publish('5d_precalc:completed', JSON.stringify(completionMessage));
            console.log(`📤 [5D_PRECALC_EXEC] Completion notification published for period ${periodId}`);
        } catch (pubError) {
            console.error(`❌ [5D_PRECALC_EXEC] Error publishing completion notification:`, pubError.message);
            // Continue even if publish fails
        }
        
        const executionTime = Date.now() - startTime;
        console.log(`✅ [5D_PRECALC_EXEC] Pre-calculation completed for period ${periodId} in ${executionTime}ms (method: ${methodUsed})`);
        
        // 🎯 DETAILED LOGGING: Show the final stored result
        console.log(`🎯 [5D_PRECALC_EXEC] FINAL STORED RESULT FOR PERIOD ${periodId}:`);
        console.log(`   - Method used: ${methodUsed}`);
        console.log(`   - Result: A=${result.A}, B=${result.B}, C=${result.C}, D=${result.D}, E=${result.E}`);
        console.log(`   - Sum: ${result.sum} (${result.sum_size}, ${result.sum_parity})`);
        console.log(`   - Exposure: ${result.exposure}`);
        console.log(`   - Combination string: ${result.combination || 'N/A'}`);
        console.log(`   - Processing time: ${result.processingTime || executionTime}ms`);
        console.log(`   - Total combinations: ${result.totalCombinations || 'N/A'}`);
        console.log(`   - Zero exposure count: ${result.zeroExposureCount || 'N/A'}`);
        
        // 6. 🚀 CRITICAL FIX: Process user bets immediately after result creation
        console.log(`🔥 [5D_PRECALC_EXEC] Processing user bets for period ${periodId}...`);
        try {
            // Ensure models are initialized
            await gameLogicService.ensureModelsInitialized();
            const models = await gameLogicService.models;
            
            // Process winning bets using the result we just created
            const winners = await gameLogicService.processWinningBetsWithTimeline(
                gameType, 
                duration, 
                periodId, 
                timeline, 
                result, 
                null // No transaction needed, we're already in a transaction
            );
            
            console.log(`🏆 [5D_PRECALC_EXEC] User bets processed successfully for period ${periodId}:`, {
                winnerCount: winners.length,
                winners: winners.map(w => ({ userId: w.userId, winnings: w.winnings }))
            });
            
            // Reset period exposure
            try {
                await gameLogicService.resetPeriodExposure(gameType, duration, periodId);
                console.log(`✅ [5D_PRECALC_EXEC] Period exposure reset for period ${periodId}`);
            } catch (cleanupError) {
                console.error(`❌ [5D_PRECALC_EXEC] Error resetting period exposure:`, cleanupError.message);
            }
            
        } catch (betProcessingError) {
            console.error(`❌ [5D_PRECALC_EXEC] Error processing user bets:`, betProcessingError.message);
            // Don't throw here - result creation succeeded, bet processing failed
        }
        
        // 7. Update tracking
        fiveDPreCalcTracking.set(`${gameType}_${duration}_${periodId}`, {
            status: 'completed',
            result: result,
            methodUsed: methodUsed,
            completedAt: new Date().toISOString(),
            executionTime: executionTime,
            schedulerInstance: process.env.PM2_INSTANCE_ID || 'unknown',
            schedulerHost: require('os').hostname()
        });
        
    } catch (error) {
        console.error(`❌ [5D_PRECALC_EXEC] Error executing pre-calculation for period ${periodId}:`, error);
        
        // Publish error notification
        const errorMessage = {
            action: 'precalc_error',
            gameType: gameType,
            duration: duration,
            periodId: periodId,
            timeline: timeline,
            error: error.message,
            occurredAt: new Date().toISOString(),
            // ENHANCED: Add load balancer safety data
            schedulerInstance: process.env.PM2_INSTANCE_ID || 'unknown',
            schedulerHost: require('os').hostname(),
            schedulerPid: process.pid
        };
        
        try {
            await schedulerPublisher.publish('5d_precalc:error', JSON.stringify(errorMessage));
        } catch (pubError) {
            console.error(`❌ [5D_PRECALC_EXEC] Error publishing error notification:`, pubError);
        }
        
        throw error;
    }
};

/**
 * Verify that betting is frozen (bet freeze is active)
 */
const verifyBetFreezeStatus = async (gameType, duration, periodId) => {
    try {
        // Get current period info from Redis
        const periodKey = `game_scheduler:${gameType}:${duration}:current`;
        const periodInfo = await schedulerHelper.get(periodKey);
        
        if (!periodInfo) {
            return { isFrozen: false, reason: 'No period info found' };
        }
        
        // Handle both string and object formats
        let period;
        try {
            period = typeof periodInfo === 'string' ? JSON.parse(periodInfo) : periodInfo;
        } catch (parseError) {
            console.error(`❌ [5D_PRECALC_VERIFY] Error parsing period info:`, parseError.message);
            return { isFrozen: false, reason: 'Error parsing period info' };
        }
        const now = new Date();
        const endTime = new Date(period.endTime);
        const timeRemaining = Math.max(0, (endTime - now) / 1000);
        
        // Betting is frozen when timeRemaining < 5 seconds
        const isFrozen = timeRemaining < 5;
        
        return {
            isFrozen: isFrozen,
            timeRemaining: timeRemaining,
            bettingOpen: period.bettingOpen,
            reason: isFrozen ? 'Bet freeze active' : 'Betting still open'
        };
        
    } catch (error) {
        console.error(`❌ [5D_PRECALC_VERIFY] Error verifying bet freeze status:`, error);
        return { isFrozen: false, reason: 'Error checking status' };
    }
};

/**
 * Get current bet patterns from Redis
 */
const getCurrentBetPatterns = async (gameType, duration, periodId, timeline) => {
    try {
        const exposureKey = `exposure:${gameType}:${duration}:${timeline}:${periodId}`;
        console.log(`🔍 [5D_PRECALC_PATTERNS] Looking for bets in Redis key: ${exposureKey}`);
        const betExposures = await schedulerHelper.hgetall(exposureKey);
        console.log(`🔍 [5D_PRECALC_PATTERNS] Raw bet exposures from Redis:`, betExposures);
        
        // Convert to bet patterns format
        const betPatterns = {};
        for (const [betKey, exposure] of Object.entries(betExposures)) {
            if (!betKey.startsWith('bet:')) continue;
            
            // Remove 'bet:' prefix
            const actualBetKey = betKey.replace('bet:', '');
            
            // Handle different bet key formats
            if (actualBetKey.includes('POSITION:')) {
                // Format: POSITION:A_0 -> POSITION:A:0
                const parts = actualBetKey.split(':');
                if (parts.length >= 2) {
                    const betType = parts[0]; // POSITION
                    const positionValue = parts[1]; // A_0
                    
                    // Split position and value (e.g., A_0 -> A and 0)
                    const [position, value] = positionValue.split('_');
                    if (position && value) {
                        betPatterns[`${betType}:${position}:${value}`] = parseFloat(exposure);
                    }
                }
            } else if (actualBetKey.includes('SUM_')) {
                // Format: SUM_SIZE:big -> SUM_SIZE:big
                const [betType, betValue] = actualBetKey.split(':');
                if (betType && betValue) {
                    betPatterns[`${betType}:${betValue}`] = parseFloat(exposure);
                }
            } else {
                // Default format: betType:betValue
                const [betType, betValue] = actualBetKey.split(':');
                if (betType && betValue) {
                    betPatterns[`${betType}:${betValue}`] = parseFloat(exposure);
                }
            }
        }
        
        console.log(`🔍 [5D_PRECALC_PATTERNS] Processed bet patterns:`, betPatterns);
        
        // Debug: Show how each bet key was parsed
        console.log(`🔍 [5D_PRECALC_PATTERNS] Bet key parsing details:`);
        for (const [betKey, exposure] of Object.entries(betExposures)) {
            if (betKey.startsWith('bet:')) {
                const actualBetKey = betKey.replace('bet:', '');
                console.log(`   ${betKey} -> ${actualBetKey}`);
            }
        }
        
        return betPatterns;
        
    } catch (error) {
        console.error(`❌ [5D_PRECALC_PATTERNS] Error getting bet patterns:`, error);
        return {};
    }
};

/**
 * Start 5D pre-calculation monitoring
 */
const start5DPreCalcMonitoring = async () => {
    try {
        console.log('🔄 [5D_PRECALC_MONITOR] Starting 5D pre-calculation monitoring...');
        
        // Start monitoring for each 5D duration
        for (const [gameType, durations] of Object.entries(FIVE_D_CONFIGS)) {
            for (const duration of durations) {
                start5DPreCalcTicksForGame(gameType, duration);
            }
        }
        
        console.log('✅ [5D_PRECALC_MONITOR] 5D pre-calculation monitoring started');
        
    } catch (error) {
        console.error('❌ [5D_PRECALC_MONITOR] Error starting monitoring:', error);
        throw error;
    }
};

/**
 * Start monitoring ticks for a specific 5D game
 */
const start5DPreCalcTicksForGame = (gameType, duration) => {
    const key = `${gameType}_${duration}`;
    console.log(`🔄 [5D_PRECALC_TICKS] Starting ticks for ${key}`);
    
    // Run tick every second
    const tickInterval = setInterval(async () => {
        try {
            await fiveDPreCalcTick(gameType, duration);
        } catch (error) {
            console.error(`❌ [5D_PRECALC_TICK_ERROR] ${key}:`, error.message);
        }
    }, 1000);
    
    // Store interval for cleanup
    if (!global.fiveDPreCalcIntervals) {
        global.fiveDPreCalcIntervals = new Map();
    }
    global.fiveDPreCalcIntervals.set(key, tickInterval);
};

/**
 * 5D pre-calculation tick function
 */
const fiveDPreCalcTick = async (gameType, duration) => {
    try {
        const key = `${gameType}_${duration}`;
        
        // Get current period info
        const periodKey = `game_scheduler:${gameType}:${duration}:current`;
        const periodInfo = await schedulerHelper.get(periodKey);
        
        if (!periodInfo) {
            return;
        }
        
        // Handle both string and object formats
        let period;
        try {
            period = typeof periodInfo === 'string' ? JSON.parse(periodInfo) : periodInfo;
        } catch (parseError) {
            console.error(`❌ [5D_PRECALC_TICK_ERROR] ${gameType}_${duration}: Error parsing period info:`, parseError.message);
            return;
        }
        const now = new Date();
        const endTime = new Date(period.endTime);
        const timeRemaining = Math.max(0, (endTime - now) / 1000);
        
        // Check if we're at bet freeze (t=5s) and haven't triggered pre-calculation yet
        if (timeRemaining <= 5 && timeRemaining > 0) {
            const trackingKey = `${gameType}_${duration}_${period.periodId}`;
            
            // Check if pre-calculation already triggered for this period
            if (!fiveDPreCalcTracking.has(trackingKey)) {
                console.log(`🎯 [5D_PRECALC_TRIGGER] Bet freeze detected for ${key}, period ${period.periodId} (t=${timeRemaining.toFixed(1)}s)`);
                
                // 🚀 ENABLE parallel processing with non-blocking execution
                console.log(`🚀 [5D_PRECALC_ENABLED] Starting parallel pre-calculation for ${key}`);
                
                // Mark as triggered
                fiveDPreCalcTracking.set(trackingKey, {
                    status: 'triggered',
                    triggeredAt: new Date().toISOString(),
                    timeRemaining: timeRemaining,
                    reason: 'Parallel processing enabled'
                });
                
                // 🚀 Use setImmediate to ensure non-blocking execution
                setImmediate(async () => {
                    try {
                        console.log(`🚀 [5D_PARALLEL_TRIGGER] Starting parallel pre-calculation for ${key}, period ${period.periodId}`);
                        
                        // Execute parallel pre-calculation
                        await execute5DPreCalculation(gameType, duration, period.periodId);
                        
                        console.log(`✅ [5D_PARALLEL_TRIGGER] Parallel pre-calculation completed for ${key}`);
                        
                    } catch (error) {
                        console.error(`❌ [5D_PARALLEL_TRIGGER] Error in parallel pre-calculation:`, error.message);
                        
                        // Update tracking on error
                        fiveDPreCalcTracking.set(trackingKey, {
                            status: 'error',
                            error: error.message,
                            occurredAt: new Date().toISOString()
                        });
                    }
                });
            }
        }
        
    } catch (error) {
        console.error(`❌ [5D_PRECALC_TICK_ERROR] ${gameType}_${duration}:`, error.message);
    }
};

/**
 * Cleanup 5D pre-calculation resources
 */
const cleanup5DPreCalc = async () => {
    try {
        console.log('🧹 [5D_PRECALC_CLEANUP] Starting cleanup...');
        
        // Close Redis connections
        if (schedulerPublisher) {
            try {
                await schedulerPublisher.quit();
                console.log('🔌 [5D_PRECALC_CLEANUP] Publisher connection closed');
            } catch (error) {
                console.error('❌ [5D_PRECALC_CLEANUP] Error closing publisher:', error.message);
            }
        }
        
        if (schedulerSubscriber) {
            try {
                await schedulerSubscriber.quit();
                console.log('🔌 [5D_PRECALC_CLEANUP] Subscriber connection closed');
            } catch (error) {
                console.error('❌ [5D_PRECALC_CLEANUP] Error closing subscriber:', error.message);
            }
        }
        
        // Clear intervals
        if (global.fiveDPreCalcIntervals) {
            for (const [key, interval] of global.fiveDPreCalcIntervals) {
                clearInterval(interval);
                console.log(`🧹 [5D_PRECALC_CLEANUP] Cleared interval for ${key}`);
            }
            global.fiveDPreCalcIntervals.clear();
        }
        
        // Clear tracking
        fiveDPreCalcTracking.clear();
        fiveDPreCalcLocks.clear();
        
        console.log('✅ [5D_PRECALC_CLEANUP] Cleanup completed');
        
    } catch (error) {
        console.error('❌ [5D_PRECALC_CLEANUP] Error during cleanup:', error);
    }
};

/**
 * Initialize 5D pre-calculation scheduler
 */
async function initialize() {
    try {
        console.log('🚀 [5D_PRECALC_INIT] Initializing 5D pre-calculation scheduler...');
        
        // Connect to database
        await connectDB();
        console.log('✅ [5D_PRECALC_INIT] Database connected');
        
        // Initialize models and sequelize
        models = require('../models');
        const { getSequelizeInstance } = require('../config/db');
        sequelize = await getSequelizeInstance();
        console.log('✅ [5D_PRECALC_INIT] Models initialized');
        
        // Initialize services
        periodService = require('../services/periodService');
        gameLogicService = require('../services/gameLogicService');
        console.log('✅ [5D_PRECALC_INIT] Services initialized');
        
        // Setup Redis communication
        await setup5DPreCalcCommunication();
        console.log('✅ [5D_PRECALC_INIT] Redis communication setup complete');
        
        // Start 5D pre-calculation monitoring
        await start5DPreCalcMonitoring();
        console.log('✅ [5D_PRECALC_INIT] 5D pre-calculation monitoring started');
        
        console.log('🎉 [SCHEDULER_1_LOWERCASE] 5D pre-calculation scheduler initialized successfully');
        
    } catch (error) {
        console.error('❌ [5D_PRECALC_INIT] Error initializing 5D pre-calculation scheduler:', error);
        throw error;
    }
}

/**
 * Start 5D pre-calculation scheduler
 */
const start5DPreCalcScheduler = async () => {
    try {
        console.log('🚀 [SCHEDULER_1_LOWERCASE] Starting 5D pre-calculation scheduler (lowercase version)...');
        
        // Initialize
        await initialize();
        
        // Setup graceful shutdown
        process.on('SIGINT', async () => {
            console.log('🛑 [5D_PRECALC_SCHEDULER] Received SIGINT, shutting down gracefully...');
            await cleanup5DPreCalc(); // Call the new cleanup function
            process.exit(0);
        });
        
        process.on('SIGTERM', async () => {
            console.log('🛑 [5D_PRECALC_SCHEDULER] Received SIGTERM, shutting down gracefully...');
            await cleanup5DPreCalc(); // Call the new cleanup function
            process.exit(0);
        });
        
        console.log('✅ [SCHEDULER_1_LOWERCASE] 5D pre-calculation scheduler started successfully');
        
    } catch (error) {
        console.error('❌ [5D_PRECALC_SCHEDULER] Error starting 5D pre-calculation scheduler:', error);
        process.exit(1);
    }
};

// Export functions
module.exports = {
    start5DPreCalcScheduler,
    execute5DPreCalculation,
    handle5DPreCalcRequest,
    cleanup5DPreCalc
};

// 🚀 ENABLED: Auto-start for main scheduler (lowercase version)
// This is the primary scheduler that should start automatically
if (require.main === module) {
    start5DPreCalcScheduler();
} 