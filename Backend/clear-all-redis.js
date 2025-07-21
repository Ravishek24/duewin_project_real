let redisHelper = null;
function setRedisHelper(helper) { redisHelper = helper; }




// Create Redis client
const redisClient =  {
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

async function clearAllRedis() {
    try {
        console.log('🗑️ [CLEAR] Starting Redis cleanup...');
        
        // First, let's see what we're about to delete
        console.log('\n🔍 [CLEAR] Current Redis keys before deletion:');
        
        const allKeys = await redisClient.keys('*');
        console.log(`🔍 [CLEAR] Total keys found: ${allKeys.length}`);
        
        if (allKeys.length > 0) {
            console.log('🔍 [CLEAR] Sample keys:');
            allKeys.slice(0, 10).forEach(key => console.log(`  - ${key}`));
            
            if (allKeys.length > 10) {
                console.log(`  ... and ${allKeys.length - 10} more keys`);
            }
            
            // Count by type
            const betKeys = allKeys.filter(key => key.includes('bets'));
            const exposureKeys = allKeys.filter(key => key.includes('exposure'));
            const otherKeys = allKeys.filter(key => !key.includes('bets') && !key.includes('exposure'));
            
            console.log('\n📊 [CLEAR] Key breakdown:');
            console.log(`  - Bet keys: ${betKeys.length}`);
            console.log(`  - Exposure keys: ${exposureKeys.length}`);
            console.log(`  - Other keys: ${otherKeys.length}`);
            
            // Show some examples of each type
            if (betKeys.length > 0) {
                console.log('\n🔍 [CLEAR] Sample bet keys:');
                betKeys.slice(0, 5).forEach(key => console.log(`  - ${key}`));
            }
            
            if (exposureKeys.length > 0) {
                console.log('\n🔍 [CLEAR] Sample exposure keys:');
                exposureKeys.slice(0, 5).forEach(key => console.log(`  - ${key}`));
            }
            
            if (otherKeys.length > 0) {
                console.log('\n🔍 [CLEAR] Sample other keys:');
                otherKeys.slice(0, 5).forEach(key => console.log(`  - ${key}`));
            }
        } else {
            console.log('ℹ️ [CLEAR] No keys found - Redis is already empty');
            return;
        }
        
        console.log('\n⚠️ [CLEAR] WARNING: About to delete ALL Redis data!');
        console.log('⚠️ [CLEAR] This will remove:');
        console.log('   - All bet data');
        console.log('   - All exposure data');
        console.log('   - All game results');
        console.log('   - All user sessions');
        console.log('   - All cached data');
        console.log('   - Everything else in Redis');
        
        console.log('\n🗑️ [CLEAR] Proceeding with deletion...');
        
        // Clear all keys
        const deletedCount = await redisClient.flushall();
        
        console.log(`✅ [CLEAR] Successfully deleted ${allKeys.length} keys`);
        
        // Verify deletion
        console.log('\n🔍 [CLEAR] Verifying deletion...');
        const remainingKeys = await redisClient.keys('*');
        console.log(`🔍 [CLEAR] Remaining keys: ${remainingKeys.length}`);
        
        if (remainingKeys.length === 0) {
            console.log('✅ [CLEAR] SUCCESS: All Redis data cleared successfully!');
        } else {
            console.log('⚠️ [CLEAR] WARNING: Some keys remain:', remainingKeys);
        }
        
        console.log('\n🎯 [CLEAR] SUMMARY:');
        console.log(`✅ Deleted: ${allKeys.length} keys`);
        console.log(`✅ Remaining: ${remainingKeys.length} keys`);
        console.log('✅ Redis is now clean and ready for fresh data');
        
    } catch (error) {
        console.error('❌ [CLEAR] Error clearing Redis:', error);
    } finally {
        redisClient.quit();
    }
}

// Run the clear operation
clearAllRedis(); 
module.exports = { setRedisHelper };
