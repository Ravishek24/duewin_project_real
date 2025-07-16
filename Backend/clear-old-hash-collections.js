const redisClient = require('./config/redisConfig').redis;
const tronHashService = require('./services/tronHashService');

async function clearOldHashCollections() {
    try {
        console.log('🧹 Clearing old hash collections...');
        
        // Get all TRX_WIX durations
        const durations = tronHashService.getTrxWixDurations();
        
        // Clear old global collection
        const oldKey = 'tron:hash_collection';
        await redisClient.del(oldKey);
        console.log(`🗑️ Cleared old global collection: ${oldKey}`);
        
        // Clear duration-specific collections
        for (const duration of durations) {
            const key = tronHashService.getDurationHashKey(duration);
            await redisClient.del(key);
            console.log(`🗑️ Cleared duration collection: ${key}`);
        }
        
        console.log('✅ All old hash collections cleared successfully!');
        
        // Start fresh hash collection
        console.log('\n🚀 Starting fresh hash collection for all durations...');
        await tronHashService.startHashCollection();
        console.log('✅ Fresh hash collection completed!');
        
    } catch (error) {
        console.error('❌ Error clearing hash collections:', error);
        throw error;
    }
}

async function main() {
    try {
        await clearOldHashCollections();
        console.log('\n🎉 Hash collection cleanup completed successfully!');
    } catch (error) {
        console.error('❌ Cleanup failed:', error);
    } finally {
        await redisClient.quit();
        process.exit(0);
    }
}

main(); 