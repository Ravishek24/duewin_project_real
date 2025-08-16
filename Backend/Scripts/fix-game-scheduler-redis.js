#!/usr/bin/env node

/**
 * Fix Game Scheduler Redis Data Script
 * This script initializes missing Redis data for all game types and durations
 */

const unifiedRedis = require('../config/unifiedRedisManager');
const { connectDB } = require('../config/db');

// Game configurations
const GAME_CONFIGS = {
    'wingo': [30, 60, 180, 300],     // 4 rooms: wingo_30, wingo_60, wingo_180, wingo_300
    'trx_wix': [30, 60, 180, 300],   // 4 rooms: trx_wix_30, trx_wix_60, trx_wix_180, trx_wix_300
    'k3': [60, 180, 300, 600],       // 4 rooms: k3_60, k3_180, k3_300, k3_600
    'fiveD': [60, 180, 300, 600]     // 4 rooms: fiveD_60, fiveD_180, fiveD_300, fiveD_600
};

/**
 * Generate current period ID based on current time
 */
function generateCurrentPeriodId() {
    const now = new Date();
    const dateStr = now.getFullYear().toString() + 
                   (now.getMonth() + 1).toString().padStart(2, '0') + 
                   now.getDate().toString().padStart(2, '0');
    
    // Calculate sequence based on time of day (reset daily)
    const secondsSinceMidnight = Math.floor(now.getTime() / 1000) % 86400;
    const sequence = Math.floor(secondsSinceMidnight / 60) + 1; // New period every minute
    
    return `${dateStr}${sequence.toString().padStart(9, '0')}`;
}

/**
 * Calculate period start and end times
 */
function calculatePeriodTimes(periodId, duration) {
    const dateStr = periodId.substring(0, 8);
    const year = parseInt(dateStr.substring(0, 4));
    const month = parseInt(dateStr.substring(4, 6)) - 1;
    const day = parseInt(dateStr.substring(6, 8));
    
    // Start time: beginning of the day
    const startTime = new Date(year, month, day);
    
    // End time: start time + duration
    const endTime = new Date(startTime.getTime() + duration * 1000);
    
    return { startTime, endTime };
}

/**
 * Initialize Redis data for a specific game type and duration
 */
async function initializeGameRedisData(gameType, duration) {
    try {
        const redis = await unifiedRedis.getHelper();
        const key = `game_scheduler:${gameType}:${duration}:current`;
        
        // Generate current period data
        const periodId = generateCurrentPeriodId();
        const { startTime, endTime } = calculatePeriodTimes(periodId, duration);
        const now = new Date();
        const timeRemaining = Math.max(0, (endTime - now) / 1000);
        
        const periodData = {
            periodId: periodId,
            gameType: gameType,
            duration: duration,
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            timeRemaining: Math.min(timeRemaining, duration),
            bettingOpen: timeRemaining >= 5,
            updatedAt: now.toISOString(),
            source: 'game_scheduler_fix'
        };
        
        // Store in Redis
        await redis.set(key, JSON.stringify(periodData));
        await redis.expire(key, 3600); // 1 hour TTL
        
        console.log(`✅ [REDIS_FIX] Initialized ${gameType}_${duration}: ${periodId} (${Math.ceil(timeRemaining)}s remaining)`);
        
        return periodData;
        
    } catch (error) {
        console.error(`❌ [REDIS_FIX] Error initializing ${gameType}_${duration}:`, error.message);
        return null;
    }
}

/**
 * Check existing Redis data
 */
async function checkExistingRedisData() {
    try {
        const redis = await unifiedRedis.getHelper();
        console.log('\n🔍 [REDIS_CHECK] Checking existing Redis data...');
        
        for (const [gameType, durations] of Object.entries(GAME_CONFIGS)) {
            for (const duration of durations) {
                const key = `game_scheduler:${gameType}:${duration}:current`;
                const data = await redis.get(key);
                
                if (data) {
                    try {
                        const parsed = JSON.parse(data);
                        const timeRemaining = parsed.timeRemaining || 0;
                        console.log(`✅ ${gameType}_${duration}: EXISTS (${Math.ceil(timeRemaining)}s remaining)`);
                    } catch {
                        console.log(`⚠️ ${gameType}_${duration}: EXISTS but invalid JSON`);
                    }
                } else {
                    console.log(`❌ ${gameType}_${duration}: MISSING`);
                }
            }
        }
        
    } catch (error) {
        console.error('❌ [REDIS_CHECK] Error checking Redis data:', error.message);
    }
}

/**
 * Initialize all missing Redis data
 */
async function initializeAllMissingData() {
    try {
        console.log('\n🚀 [REDIS_FIX] Initializing all missing Redis data...');
        
        for (const [gameType, durations] of Object.entries(GAME_CONFIGS)) {
            for (const duration of durations) {
                const key = `game_scheduler:${gameType}:${duration}:current`;
                const redis = await unifiedRedis.getHelper();
                const existingData = await redis.get(key);
                
                if (!existingData) {
                    await initializeGameRedisData(gameType, duration);
                } else {
                    console.log(`⏭️ [REDIS_FIX] Skipping ${gameType}_${duration}: already exists`);
                }
            }
        }
        
        console.log('\n✅ [REDIS_FIX] All missing Redis data initialized');
        
    } catch (error) {
        console.error('❌ [REDIS_FIX] Error initializing missing data:', error.message);
    }
}

/**
 * Set up periodic refresh for Redis data
 */
async function setupPeriodicRefresh() {
    try {
        console.log('\n🔄 [REDIS_FIX] Setting up periodic refresh...');
        
        // Refresh every 5 minutes
        setInterval(async () => {
            try {
                for (const [gameType, durations] of Object.entries(GAME_CONFIGS)) {
                    for (const duration of durations) {
                        const key = `game_scheduler:${gameType}:${duration}:current`;
                        const redis = await unifiedRedis.getHelper();
                        const existingData = await redis.get(key);
                        
                        if (existingData) {
                            try {
                                const parsed = JSON.parse(existingData);
                                const now = new Date();
                                const endTime = new Date(parsed.endTime);
                                const timeRemaining = Math.max(0, (endTime - now) / 1000);
                                
                                // Update time remaining
                                parsed.timeRemaining = Math.min(timeRemaining, duration);
                                parsed.bettingOpen = timeRemaining >= 5;
                                parsed.updatedAt = now.toISOString();
                                
                                await redis.set(key, JSON.stringify(parsed));
                                await redis.expire(key, 3600);
                                
                            } catch (parseError) {
                                console.error(`❌ [REDIS_REFRESH] Error parsing data for ${gameType}_${duration}:`, parseError.message);
                            }
                        }
                    }
                }
                
                console.log(`🔄 [REDIS_REFRESH] Refreshed all game data at ${new Date().toISOString()}`);
                
            } catch (error) {
                console.error('❌ [REDIS_REFRESH] Error during refresh:', error.message);
            }
        }, 5 * 60 * 1000); // 5 minutes
        
        console.log('✅ [REDIS_FIX] Periodic refresh set up (every 5 minutes)');
        
    } catch (error) {
        console.error('❌ [REDIS_FIX] Error setting up periodic refresh:', error.message);
    }
}

/**
 * Main function
 */
async function main() {
    try {
        console.log('🔧 [GAME_SCHEDULER_REDIS_FIX] Starting Redis data fix...');
        
        // Initialize Redis
        await unifiedRedis.initialize();
        console.log('✅ [REDIS_FIX] Redis initialized');
        
        // Check existing data
        await checkExistingRedisData();
        
        // Initialize missing data
        await initializeAllMissingData();
        
        // Set up periodic refresh
        await setupPeriodicRefresh();
        
        // Final check
        await checkExistingRedisData();
        
        console.log('\n🎉 [GAME_SCHEDULER_REDIS_FIX] Redis data fix completed successfully!');
        console.log('📊 [REDIS_FIX] All game types and durations now have Redis data');
        console.log('🔄 [REDIS_FIX] Data will be refreshed every 5 minutes');
        console.log('\n💡 [REDIS_FIX] You can now restart your game scheduler');
        
    } catch (error) {
        console.error('❌ [GAME_SCHEDULER_REDIS_FIX] Fatal error:', error.message);
        process.exit(1);
    }
}

// Run the script
if (require.main === module) {
    main().catch(console.error);
}

module.exports = {
    initializeGameRedisData,
    initializeAllMissingData,
    setupPeriodicRefresh
};
