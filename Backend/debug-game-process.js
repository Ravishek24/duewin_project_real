const Redis = require('ioredis');

// Redis client setup
const redisClient = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || null,
    db: process.env.REDIS_DB || 0
});

redisClient.on('error', (err) => console.log('Redis Client Error', err));
redisClient.on('connect', () => console.log('Redis client connected'));
redisClient.on('ready', () => console.log('Redis client ready'));

// Debug configuration
const DEBUG_CONFIG = {
    showBetProcessing: true,
    showExposureTracking: true,
    showUserCount: true,
    showResultCalculation: true,
    showProtectionLogic: true,
    showRedisKeys: true,
    showTimeline: true
};

/**
 * Debug script to monitor game processing in detail
 */
async function debugGameProcess() {
    try {
        console.log('🔍 [DEBUG] Redis connection established');

        // Monitor all Redis operations
        const originalHset = redisClient.hset.bind(redisClient);
        const originalHgetall = redisClient.hgetall.bind(redisClient);
        const originalGet = redisClient.get.bind(redisClient);
        const originalSet = redisClient.set.bind(redisClient);

        // Override Redis methods to log operations
        redisClient.hset = async (...args) => {
            if (DEBUG_CONFIG.showRedisKeys) {
                console.log('📝 [REDIS_HSET]', {
                    key: args[0],
                    field: args[1],
                    value: typeof args[2] === 'string' ? args[2].substring(0, 100) + '...' : args[2]
                });
            }
            return originalHset(...args);
        };

        redisClient.hgetall = async (...args) => {
            if (DEBUG_CONFIG.showRedisKeys) {
                console.log('📖 [REDIS_HGETALL]', { key: args[0] });
            }
            const result = await originalHgetall(...args);
            if (DEBUG_CONFIG.showRedisKeys && result) {
                console.log('📖 [REDIS_HGETALL_RESULT]', {
                    key: args[0],
                    fields: Object.keys(result).length,
                    data: Object.keys(result).slice(0, 3) // Show first 3 fields
                });
            }
            return result;
        };

        redisClient.get = async (...args) => {
            if (DEBUG_CONFIG.showRedisKeys) {
                console.log('📖 [REDIS_GET]', { key: args[0] });
            }
            return originalGet(...args);
        };

        redisClient.set = async (...args) => {
            if (DEBUG_CONFIG.showRedisKeys) {
                console.log('📝 [REDIS_SET]', { 
                    key: args[0], 
                    value: typeof args[1] === 'string' ? args[1].substring(0, 100) + '...' : args[1]
                });
            }
            return originalSet(...args);
        };

        console.log('🎯 [DEBUG] Redis monitoring enabled');

    } catch (error) {
        console.error('❌ [DEBUG] Error setting up debug environment:', error);
    }
}

/**
 * Monitor specific period for detailed analysis
 */
async function monitorPeriod(gameType, duration, periodId, timeline = 'default') {
    try {
        console.log('\n🔍 [MONITOR] ==========================================');
        console.log('🔍 [MONITOR] Starting detailed period monitoring');
        console.log('🔍 [MONITOR] ==========================================');
        console.log('🔍 [MONITOR] Game Type:', gameType);
        console.log('🔍 [MONITOR] Duration:', duration);
        console.log('🔍 [MONITOR] Period ID:', periodId);
        console.log('🔍 [MONITOR] Timeline:', timeline);

        // Check Redis keys - FIXED: Use correct key pattern
        const betHashKey = `bets:${gameType}:${duration}:${timeline}:${periodId}`;
        const exposureKey = `exposure:${gameType}:${duration}:${periodId}`;
        
        console.log('\n📊 [MONITOR] Redis Keys:');
        console.log('📊 [MONITOR] Bet Hash Key:', betHashKey);
        console.log('📊 [MONITOR] Exposure Key:', exposureKey);

        // Get bet data with better error handling
        let betsData = {};
        try {
            betsData = await redisClient.hgetall(betHashKey);
            console.log('\n📊 [MONITOR] Bet Data:');
            console.log('📊 [MONITOR] Total bets:', Object.keys(betsData).length);
            
            if (Object.keys(betsData).length > 0) {
                console.log('📊 [MONITOR] Sample bet:', JSON.stringify(JSON.parse(Object.values(betsData)[0]), null, 2));
            } else {
                console.log('📊 [MONITOR] No bets found in Redis hash');
                
                // Try alternative key patterns to debug
                const altKeys = [
                    `duewin:bets:${gameType}:${duration}:${timeline}:${periodId}`,
                    `bets:${gameType}:${duration}:default:${periodId}`,
                    `duewin:bets:${gameType}:${duration}:default:${periodId}`
                ];
                
                console.log('🔍 [MONITOR] Trying alternative key patterns...');
                for (const altKey of altKeys) {
                    const altData = await redisClient.hgetall(altKey);
                    if (Object.keys(altData).length > 0) {
                        console.log(`✅ [MONITOR] Found bets in alternative key: ${altKey}`);
                        console.log(`📊 [MONITOR] Alternative key total bets: ${Object.keys(altData).length}`);
                        betsData = altData;
                        break;
                    }
                }
            }
        } catch (redisError) {
            console.error('❌ [MONITOR] Redis error getting bet data:', redisError.message);
        }

        // Get exposure data
        let exposureData = {};
        try {
            exposureData = await redisClient.hgetall(exposureKey);
            console.log('\n📊 [MONITOR] Exposure Data:');
            console.log('📊 [MONITOR] Total exposures:', Object.keys(exposureData).length);
            
            if (Object.keys(exposureData).length > 0) {
                const exposuresInRupees = {};
                for (const [key, value] of Object.entries(exposureData)) {
                    exposuresInRupees[key] = `${(parseInt(value) / 100).toFixed(2)}₹`;
                }
                console.log('📊 [MONITOR] Exposures (in rupees):', exposuresInRupees);
            }
        } catch (redisError) {
            console.error('❌ [MONITOR] Redis error getting exposure data:', redisError.message);
        }

        // Count unique users with better error handling
        const uniqueUsers = new Set();
        let parseErrors = 0;
        
        for (const [betId, betJson] of Object.entries(betsData)) {
            try {
                const bet = JSON.parse(betJson);
                if (bet.userId) {
                    uniqueUsers.add(bet.userId);
                }
            } catch (parseError) {
                parseErrors++;
                if (parseErrors <= 3) { // Only show first 3 errors
                    console.warn('⚠️ [MONITOR] Failed to parse bet:', parseError.message);
                }
            }
        }

        if (parseErrors > 3) {
            console.warn(`⚠️ [MONITOR] ... and ${parseErrors - 3} more parse errors`);
        }

        console.log('\n👥 [MONITOR] User Analysis:');
        console.log('👥 [MONITOR] Unique users:', uniqueUsers.size);
        console.log('👥 [MONITOR] User IDs:', Array.from(uniqueUsers));
        console.log('👥 [MONITOR] Threshold (100):', uniqueUsers.size >= 100 ? '✅ MET' : '❌ NOT MET');

        // Analyze bet distribution
        const betDistribution = {};
        for (const [betId, betJson] of Object.entries(betsData)) {
            try {
                const bet = JSON.parse(betJson);
                const betKey = `${bet.betType}:${bet.betValue}`;
                betDistribution[betKey] = (betDistribution[betKey] || 0) + 1;
            } catch (parseError) {
                // Skip invalid bets
            }
        }

        console.log('\n📊 [MONITOR] Bet Distribution:');
        console.log('📊 [MONITOR] Bet types:', betDistribution);

        console.log('\n🔍 [MONITOR] ==========================================');
        console.log('🔍 [MONITOR] Period monitoring completed');
        console.log('🔍 [MONITOR] ==========================================\n');

    } catch (error) {
        console.error('❌ [MONITOR] Error monitoring period:', error);
    }
}

/**
 * Simulate bet processing with detailed logging
 */
async function simulateBetProcessing(betData) {
    try {
        console.log('\n🎯 [SIMULATION] ==========================================');
        console.log('🎯 [SIMULATION] Simulating bet processing');
        console.log('🎯 [SIMULATION] ==========================================');
        console.log('🎯 [SIMULATION] Bet Data:', JSON.stringify(betData, null, 2));

        // Import game logic service
        const gameLogicService = require('./services/gameLogicService');

        // Process bet
        console.log('\n🎯 [SIMULATION] Processing bet...');
        const betResult = await gameLogicService.processBet(betData);
        console.log('🎯 [SIMULATION] Bet Result:', JSON.stringify(betResult, null, 2));

        // Monitor the period after bet
        await monitorPeriod(betData.gameType, betData.duration, betData.periodId, betData.timeline);

        console.log('\n🎯 [SIMULATION] ==========================================');
        console.log('🎯 [SIMULATION] Bet processing simulation completed');
        console.log('🎯 [SIMULATION] ==========================================\n');

        return betResult;

    } catch (error) {
        console.error('❌ [SIMULATION] Error simulating bet processing:', error);
        throw error;
    }
}

/**
 * Monitor result generation process
 */
async function monitorResultGeneration(gameType, duration, periodId, timeline = 'default') {
    try {
        console.log('\n🎲 [RESULT_MONITOR] ==========================================');
        console.log('🎲 [RESULT_MONITOR] Monitoring result generation');
        console.log('🎲 [RESULT_MONITOR] ==========================================');

        // Import game logic service
        const gameLogicService = require('./services/gameLogicService');

        // Check user count for protection
        console.log('\n👥 [RESULT_MONITOR] Checking user count for protection...');
        const uniqueUserCount = await gameLogicService.getUniqueUserCount(gameType, duration, periodId, timeline);
        const shouldUseProtectedResult = uniqueUserCount < 100;
        console.log('👥 [RESULT_MONITOR] User Count Result:', {
            uniqueUserCount,
            shouldUseProtectedResult,
            threshold: 100
        });

        // Calculate result with verification
        console.log('\n🎯 [RESULT_MONITOR] Calculating result with verification...');
        const resultWithVerification = await gameLogicService.calculateResultWithVerification(gameType, duration, periodId, timeline);
        console.log('🎯 [RESULT_MONITOR] Result with Verification:', JSON.stringify(resultWithVerification, null, 2));

        console.log('\n🎲 [RESULT_MONITOR] ==========================================');
        console.log('🎲 [RESULT_MONITOR] Result generation monitoring completed');
        console.log('🎲 [RESULT_MONITOR] ==========================================\n');

        return resultWithVerification;

    } catch (error) {
        console.error('❌ [RESULT_MONITOR] Error monitoring result generation:', error);
        throw error;
    }
}

/**
 * Show all Redis keys for a game
 */
async function showAllRedisKeys(gameType, duration) {
    try {
        console.log('\n🔍 [REDIS_KEYS] ==========================================');
        console.log('🔍 [REDIS_KEYS] Showing all Redis keys for game');
        console.log('🔍 [REDIS_KEYS] ==========================================');

        // Get all keys
        const allKeys = await redisClient.keys('*');
        const gameKeys = allKeys.filter(key => key.includes(gameType) && key.includes(duration.toString()));

        console.log('🔍 [REDIS_KEYS] Total keys found:', gameKeys.length);
        
        for (const key of gameKeys) {
            const keyType = await redisClient.type(key);
            console.log(`�� [REDIS_KEYS] ${key} (${keyType})`);
            
            if (keyType === 'hash') {
                const hashData = await redisClient.hgetall(key);
                console.log(`🔍 [REDIS_KEYS] Hash fields: ${Object.keys(hashData).length}`);
            } else if (keyType === 'string') {
                const stringData = await redisClient.get(key);
                console.log(`🔍 [REDIS_KEYS] String value: ${stringData ? stringData.substring(0, 100) + '...' : 'null'}`);
            }
        }

        console.log('🔍 [REDIS_KEYS] ==========================================\n');

    } catch (error) {
        console.error('❌ [REDIS_KEYS] Error showing Redis keys:', error);
    }
}

/**
 * Main debug function
 */
async function main() {
    try {
        await debugGameProcess();

        // Example usage
        console.log('🎯 [DEBUG] Debug script ready!');
        console.log('🎯 [DEBUG] Available functions:');
        console.log('🎯 [DEBUG] - monitorPeriod(gameType, duration, periodId, timeline)');
        console.log('🎯 [DEBUG] - simulateBetProcessing(betData)');
        console.log('🎯 [DEBUG] - monitorResultGeneration(gameType, duration, periodId, timeline)');
        console.log('🎯 [DEBUG] - showAllRedisKeys(gameType, duration)');

        // Example: Monitor a specific period
        // await monitorPeriod('wingo', 30, '20250706000000252', 'default');

        // Example: Show all Redis keys for Wingo 30s
        // await showAllRedisKeys('wingo', 30);

    } catch (error) {
        console.error('❌ [DEBUG] Error in main:', error);
    }
}

// Export functions for use
module.exports = {
    debugGameProcess,
    monitorPeriod,
    simulateBetProcessing,
    monitorResultGeneration,
    showAllRedisKeys,
    main
};

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
} 