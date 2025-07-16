const redis = require('redis');

async function cleanupRedisOnly() {
    const client = redis.createClient({ url: 'redis://localhost:6379' });
    
    try {
        await client.connect();
        console.log('🧹 Starting Redis-only cleanup...');
        
        // Find all 5D keys
        const all5DKeys = await client.keys('*5d*');
        console.log(`🔍 Found ${all5DKeys.length} total 5D keys`);
        
        if (all5DKeys.length > 0) {
            console.log('📋 All 5D keys:');
            all5DKeys.forEach(key => {
                console.log(`  ${key}`);
            });
            
            // Find invalid 5D 30s keys
            const invalidKeys = all5DKeys.filter(key => key.includes(':30:'));
            console.log(`\n❌ Found ${invalidKeys.length} invalid 5D 30s keys:`);
            invalidKeys.forEach(key => {
                console.log(`  ${key}`);
            });
            
            // Delete invalid keys
            if (invalidKeys.length > 0) {
                console.log('\n🗑️ Deleting invalid 5D 30s keys...');
                for (const key of invalidKeys) {
                    await client.del(key);
                    console.log(`  Deleted: ${key}`);
                }
                console.log(`✅ Cleaned up ${invalidKeys.length} invalid keys`);
            }
            
            // Show remaining valid keys
            const remainingKeys = await client.keys('*5d*');
            const validKeys = remainingKeys.filter(key => {
                const match = key.match(/5d:(\d+):/);
                if (match) {
                    const duration = parseInt(match[1]);
                    return [60, 180, 300, 600].includes(duration);
                }
                return false;
            });
            
            console.log(`\n✅ Remaining valid 5D keys: ${validKeys.length}`);
            validKeys.forEach(key => {
                console.log(`  ${key}`);
            });
        } else {
            console.log('✅ No 5D keys found in Redis');
        }
        
        // Check for any other game keys
        const allGameKeys = await client.keys('*');
        const gameTypes = ['wingo', 'k3', 'trx_wix', '5d', 'fived'];
        const gameKeys = allGameKeys.filter(key => 
            gameTypes.some(game => key.toLowerCase().includes(game))
        );
        
        console.log(`\n📊 Total game-related keys: ${gameKeys.length}`);
        
    } catch (error) {
        console.error('❌ Error during cleanup:', error);
    } finally {
        await client.disconnect();
        console.log('🔚 Cleanup completed');
    }
}

// Run cleanup
cleanupRedisOnly().catch(console.error); 