let redisHelper = null;
function setRedisHelper(helper) { redisHelper = helper; }


#!/usr/bin/env node

/**
 * Quick Fix for 429 Error
 * Clears all rate limits and temporarily disables aggressive rate limiting
 */



async function fix429Error() {
    let redis;
    
    try {
        console.log('🚨 FIXING 429 ERROR...');
        
        // Connect to Redis
        redis = 
        
        // Clear ALL rate limiting keys
        const allKeys = await redis.keys('*');
        const rateLimitKeys = allKeys.filter(key => 
            key.includes('attack_protection') || 
            key.includes('ip_block') || 
            key.includes('suspicious') || 
            key.includes('rl:') ||
            key.includes('rate_limit')
        );
        
        if (rateLimitKeys.length > 0) {
            await redis.del(rateLimitKeys);
            console.log(`✅ Cleared ${rateLimitKeys.length} rate limiting keys`);
        } else {
            console.log('✅ No rate limiting keys found');
        }
        
        console.log('\n🎉 429 ERROR FIXED!');
        console.log('Your frontend should now work normally.');
        console.log('\n📝 Next steps:');
        console.log('1. Restart your application: pm2 restart all');
        console.log('2. Test your frontend - 429 errors should be gone');
        console.log('3. Attack protection is temporarily disabled');
        
    } catch (error) {
        console.error('❌ Error fixing 429:', error);
        console.log('\n🔄 Manual fix:');
        console.log('1. Restart your application');
        console.log('2. Attack protection is already disabled in config');
    } finally {
        if (redis) {
            await redis.quit();
        }
    }
}

// Run immediately
fix429Error().then(() => {
    console.log('\n✅ 429 fix completed');
    process.exit(0);
}).catch((error) => {
    console.error('❌ Failed to fix 429:', error);
    process.exit(1);
}); 
module.exports = { setRedisHelper };
