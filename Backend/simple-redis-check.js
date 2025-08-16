#!/usr/bin/env node
/**
 * Simple Redis check for admin-set result
 */

async function checkRedisData() {
    console.log('🔍 [REDIS_CHECK] ===== CHECKING REDIS DATA =====');
    
    const periodId = '20250808000000044';
    const durationKey = '30s';
    
    try {
        // Try to get Redis helper
        const { getRedisHelper } = require('./config/unifiedRedisManager');
        const redis = getRedisHelper();
        
        console.log(`🔍 [REDIS_CHECK] Checking Redis data for period: ${periodId}`);
        
        // Check the main admin result keys
        const keysToCheck = [
            `wingo:${durationKey}:${periodId}:result`,
            `wingo:${durationKey}:${periodId}:result:override`,
            `wingo:${periodId}:admin:override`,
            `wingo:result:${periodId}:forced`,
            `game:wingo:${durationKey}:${periodId}:admin_result`
        ];
        
        console.log('\n🔍 [REDIS_CHECK] === REDIS KEYS STATUS ===');
        
        for (const key of keysToCheck) {
            try {
                const value = await redis.get(key);
                if (value) {
                    console.log(`✅ ${key}: EXISTS`);
                    try {
                        const parsed = JSON.parse(value);
                        console.log(`   Number: ${parsed.number}`);
                        console.log(`   Color: ${parsed.color}`);
                        console.log(`   Size: ${parsed.size}`);
                        console.log(`   Admin Override: ${parsed.isAdminOverride}`);
                        console.log(`   Admin User: ${parsed.adminUserId}`);
                        console.log(`   Request ID: ${parsed.requestId}`);
                    } catch {
                        console.log(`   Raw Value: ${value}`);
                    }
                } else {
                    console.log(`❌ ${key}: NOT FOUND`);
                }
            } catch (error) {
                console.log(`⚠️  ${key}: ERROR - ${error.message}`);
            }
        }
        
        console.log('\n🔍 [REDIS_CHECK] ===== CHECK COMPLETE =====');
        
    } catch (error) {
        console.error('❌ [REDIS_CHECK] Error:', error.message);
    } finally {
        process.exit(0);
    }
}

checkRedisData();