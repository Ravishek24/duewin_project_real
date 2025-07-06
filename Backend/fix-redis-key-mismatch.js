const Redis = require('ioredis');

// Create Redis client
const redisClient = new Redis({
    host: 'localhost',
    port: 6379,
    retryStrategy: function (times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
    }
});

redisClient.on('error', (err) => {
    console.error('Redis Client Error:', err);
});

redisClient.on('connect', () => {
    console.log('Redis client connected');
});

redisClient.on('ready', () => {
    console.log('Redis client ready');
});

async function fixRedisKeyMismatch() {
    try {
        console.log('🔧 [FIX] Checking Redis key mismatch...');
        
        // Check old bet keys (with duewin: prefix)
        console.log('\n🔍 [FIX] Checking old bet keys (with duewin: prefix)...');
        const oldBetKeys = await redisClient.keys('duewin:bets:*');
        console.log(`🔍 [FIX] Found ${oldBetKeys.length} old bet keys with duewin: prefix`);
        
        if (oldBetKeys.length > 0) {
            console.log('🔍 [FIX] Sample old bet keys:');
            oldBetKeys.slice(0, 5).forEach(key => console.log(`  - ${key}`));
        }
        
        // Check new bet keys (without duewin: prefix)
        console.log('\n🔍 [FIX] Checking new bet keys (without duewin: prefix)...');
        const newBetKeys = await redisClient.keys('bets:*');
        console.log(`🔍 [FIX] Found ${newBetKeys.length} new bet keys without duewin: prefix`);
        
        if (newBetKeys.length > 0) {
            console.log('🔍 [FIX] Sample new bet keys:');
            newBetKeys.slice(0, 5).forEach(key => console.log(`  - ${key}`));
        }
        
        // Check exposure keys
        console.log('\n🔍 [FIX] Checking exposure keys...');
        const exposureKeys = await redisClient.keys('exposure:*');
        console.log(`🔍 [FIX] Found ${exposureKeys.length} exposure keys`);
        
        if (exposureKeys.length > 0) {
            console.log('🔍 [FIX] Sample exposure keys:');
            exposureKeys.slice(0, 5).forEach(key => console.log(`  - ${key}`));
        }
        
        // Analyze the mismatch
        console.log('\n📊 [FIX] Analysis:');
        
        if (oldBetKeys.length > 0 && newBetKeys.length > 0) {
            console.log('⚠️ [FIX] MIXED STATE: Both old and new bet keys exist');
            console.log('⚠️ [FIX] This will cause protection logic to fail');
            console.log('⚠️ [FIX] Functions can only see new bets, not old ones');
        } else if (oldBetKeys.length > 0) {
            console.log('⚠️ [FIX] OLD STATE: Only old bet keys exist');
            console.log('⚠️ [FIX] Functions cannot see any bets (wrong prefix)');
        } else if (newBetKeys.length > 0) {
            console.log('✅ [FIX] NEW STATE: Only new bet keys exist');
            console.log('✅ [FIX] Functions can see all bets correctly');
        } else {
            console.log('ℹ️ [FIX] NO BETS: No bet keys found');
        }
        
        // Check if we need to migrate old keys
        if (oldBetKeys.length > 0) {
            console.log('\n🔄 [FIX] MIGRATION NEEDED:');
            console.log(`🔄 [FIX] Need to migrate ${oldBetKeys.length} old bet keys`);
            
            // Ask user if they want to migrate
            console.log('\n❓ [FIX] Do you want to migrate old bet keys to new format?');
            console.log('❓ [FIX] This will:');
            console.log('   - Copy data from duewin:bets:* to bets:*');
            console.log('   - Delete old duewin:bets:* keys');
            console.log('   - Ensure protection logic works correctly');
            
            // For now, just show what would be migrated
            console.log('\n📋 [FIX] Migration plan:');
            oldBetKeys.slice(0, 10).forEach(oldKey => {
                const newKey = oldKey.replace('duewin:', '');
                console.log(`   ${oldKey} → ${newKey}`);
            });
            
            if (oldBetKeys.length > 10) {
                console.log(`   ... and ${oldBetKeys.length - 10} more keys`);
            }
        }
        
        // Test protection logic with current state
        console.log('\n🧪 [FIX] Testing protection logic with current state...');
        
        // Find a recent period with bets
        const recentBetKey = newBetKeys.length > 0 ? newBetKeys[0] : oldBetKeys[0];
        
        if (recentBetKey) {
            console.log(`🧪 [FIX] Testing with key: ${recentBetKey}`);
            
            // Extract components from the key
            const parts = recentBetKey.replace('duewin:', '').split(':');
            const gameType = parts[1];
            const duration = parts[2];
            const timeline = parts[3];
            const periodId = parts[4];
            
            console.log(`🧪 [FIX] Components: gameType=${gameType}, duration=${duration}, timeline=${timeline}, periodId=${periodId}`);
            
            // Check if we can find bets
            const betHashKey = `bets:${gameType}:${duration}:${timeline}:${periodId}`;
            const betsData = await redisClient.hgetall(betHashKey);
            
            console.log(`🧪 [FIX] Bets found in ${betHashKey}: ${Object.keys(betsData).length}`);
            
            // Check if we can find exposure
            const exposureKey = `exposure:${gameType}:${duration}:${timeline}:${periodId}`;
            const exposureData = await redisClient.hgetall(exposureKey);
            
            console.log(`🧪 [FIX] Exposure found in ${exposureKey}: ${Object.keys(exposureData).length}`);
            
            if (Object.keys(betsData).length > 0 && Object.keys(exposureData).length > 0) {
                console.log('✅ [FIX] Protection logic should work correctly');
            } else {
                console.log('❌ [FIX] Protection logic will fail - missing data');
            }
        }
        
        console.log('\n🎯 [FIX] SUMMARY:');
        console.log(`✅ Exposure keys: ${exposureKeys.length} (correct format)`);
        console.log(`⚠️ Old bet keys: ${oldBetKeys.length} (with duewin: prefix)`);
        console.log(`✅ New bet keys: ${newBetKeys.length} (without duewin: prefix)`);
        
        if (oldBetKeys.length > 0) {
            console.log('🔧 [FIX] ACTION NEEDED: Migrate old bet keys or update functions');
        } else {
            console.log('✅ [FIX] All keys are in correct format');
        }
        
    } catch (error) {
        console.error('❌ [FIX] Error:', error);
    } finally {
        redisClient.quit();
    }
}

// Run the fix check
fixRedisKeyMismatch(); 