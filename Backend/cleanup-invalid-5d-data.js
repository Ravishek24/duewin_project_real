let redisHelper = null;
function setRedisHelper(helper) { redisHelper = helper; }




async function cleanupInvalid5DData() {
    const client = 
    
    try {
        await client.connect();
        console.log('🧹 Starting cleanup of invalid 5D 30s duration data...');
        
        // Find all 5D keys with 30s duration
        const keys = await client.keys('*5d*30*');
        console.log(`🔍 Found ${keys.length} 5D keys with 30s duration:`, keys);
        
        if (keys.length > 0) {
            // Delete all invalid 5D 30s keys
            for (const key of keys) {
                await client.del(key);
                console.log(`🗑️ Deleted: ${key}`);
            }
            console.log(`✅ Cleaned up ${keys.length} invalid 5D 30s keys`);
        } else {
            console.log('✅ No invalid 5D 30s data found');
        }
        
        // Verify cleanup by checking for any remaining 5D 30s keys
        const remainingKeys = await client.keys('*5d*30*');
        if (remainingKeys.length === 0) {
            console.log('✅ Verification: No 5D 30s keys remain');
        } else {
            console.log('⚠️ Warning: Some 5D 30s keys still exist:', remainingKeys);
        }
        
        // Show valid 5D keys (60s, 180s, 300s, 600s)
        const valid5DKeys = await client.keys('*5d*');
        const validKeys = valid5DKeys.filter(key => {
            const match = key.match(/5d:(\d+):/);
            if (match) {
                const duration = parseInt(match[1]);
                return [60, 180, 300, 600].includes(duration);
            }
            return false;
        });
        
        console.log(`📊 Valid 5D keys found: ${validKeys.length}`);
        if (validKeys.length > 0) {
            console.log('📋 Valid 5D keys:', validKeys);
        }
        
    } catch (error) {
        console.error('❌ Error during cleanup:', error);
    } finally {
        await client.disconnect();
        console.log('🔚 Cleanup completed');
    }
}

// Run cleanup
cleanupInvalid5DData().catch(console.error); 
module.exports = { setRedisHelper };
