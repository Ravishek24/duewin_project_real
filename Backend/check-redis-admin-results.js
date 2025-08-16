#!/usr/bin/env node
/**
 * Quick check for admin results in Redis
 */

const unifiedRedis = require('./config/unifiedRedisManager');
function getRedisHelper() { return unifiedRedis.getHelper(); }

async function checkRedisAdminResults() {
    console.log('🔍 [REDIS_CHECK] ===== CHECKING REDIS FOR ADMIN RESULTS =====');
    
    try {
        const helper = getRedisHelper();
        
        // Get all keys that might contain admin results
        console.log('\n🔍 [REDIS_CHECK] Searching for admin result keys...');
        
        const patterns = [
            'wingo:*:result',
            'wingo:*:result:override', 
            'wingo:*:admin:override',
            'wingo:result:*:forced',
            'game:wingo:*:admin_result',
            'wingo:*:admin_meta'
        ];
        
        let foundKeys = [];
        
        for (const pattern of patterns) {
            try {
                const keys = await helper.keys(pattern);
                if (keys && keys.length > 0) {
                    foundKeys = foundKeys.concat(keys);
                }
            } catch (error) {
                console.log(`⚠️ [REDIS_CHECK] Error searching pattern ${pattern}:`, error.message);
            }
        }
        
        console.log(`\n🔍 [REDIS_CHECK] Found ${foundKeys.length} potential admin result keys:`);
        
        if (foundKeys.length === 0) {
            console.log('❌ [REDIS_CHECK] No admin result keys found in Redis');
            console.log('❌ [REDIS_CHECK] This means either:');
            console.log('   1. No admin results have been set recently');
            console.log('   2. Admin results expired or were deleted');
            console.log('   3. Admin results are stored with different key pattern');
        } else {
            for (const key of foundKeys) {
                try {
                    const value = await helper.get(key);
                    if (value) {
                        console.log(`\n✅ [REDIS_CHECK] Key: ${key}`);
                        try {
                            const parsed = JSON.parse(value);
                            console.log(`📄 [REDIS_CHECK] Content:`, {
                                number: parsed.number,
                                color: parsed.color,
                                size: parsed.size,
                                isAdminOverride: parsed.isAdminOverride,
                                adminUserId: parsed.adminUserId,
                                overrideTimestamp: parsed.overrideTimestamp,
                                periodId: parsed.periodId
                            });
                        } catch (parseError) {
                            console.log(`📄 [REDIS_CHECK] Raw value: ${value.substring(0, 200)}...`);
                        }
                    }
                } catch (error) {
                    console.log(`⚠️ [REDIS_CHECK] Error reading key ${key}:`, error.message);
                }
            }
        }
        
        console.log('\n🔍 [REDIS_CHECK] === NEXT STEPS ===');
        if (foundKeys.length > 0) {
            console.log('✅ [REDIS_CHECK] Admin results found in Redis!');
            console.log('🔍 [REDIS_CHECK] Now check if scheduler is processing these periods');
            console.log('🔍 [REDIS_CHECK] Run: pm2 logs scheduler --lines 50');
            console.log('🔍 [REDIS_CHECK] Look for logs with the period IDs shown above');
        } else {
            console.log('❌ [REDIS_CHECK] No admin results in Redis');
            console.log('🔍 [REDIS_CHECK] Try setting a new admin result and run this script again');
        }
        
    } catch (error) {
        console.error('❌ [REDIS_CHECK] Fatal error:', error);
    }
    
    process.exit(0);
}

// Run the check
checkRedisAdminResults().catch(console.error);