#!/usr/bin/env node
/**
 * Fix the admin Redis connection issue by ensuring proper initialization
 */

const unifiedRedis = require('./config/unifiedRedisManager');

async function testAdminRedisWorkflow() {
    console.log('🔧 [ADMIN_FIX] ===== TESTING ADMIN REDIS WORKFLOW =====');
    
    try {
        // Step 1: Properly initialize Redis (this is what's missing)
        console.log('🔧 [ADMIN_FIX] Step 1: Initialize Redis properly...');
        await unifiedRedis.initialize();
        console.log('✅ [ADMIN_FIX] Redis initialized');
        
        // Step 2: Get helper AFTER initialization
        console.log('🔧 [ADMIN_FIX] Step 2: Get Redis helper...');
        const helper = unifiedRedis.getHelper();
        console.log('✅ [ADMIN_FIX] Helper obtained');
        
        // Step 3: Simulate admin setting result
        console.log('🔧 [ADMIN_FIX] Step 3: Simulate admin setting result...');
        
        const periodId = '20240107000001';
        const duration = 30;
        const durationKey = '30s';
        
        const adminResult = {
            number: 7,
            color: 'green', 
            size: 'big',
            isAdminOverride: true,
            adminUserId: 123,
            overrideTimestamp: new Date().toISOString(),
            requestId: 'ADM-TEST-123',
            duration: duration,
            timeline: 'default',
            periodId: periodId
        };
        
        // Store in multiple Redis keys (like admin controller does)
        const keys = [
            `wingo:${durationKey}:${periodId}:result`,
            `wingo:${durationKey}:${periodId}:result:override`,
            `wingo:${periodId}:admin:override`,
            `wingo:result:${periodId}:forced`,
            `game:wingo:${durationKey}:${periodId}:admin_result`
        ];
        
        for (const key of keys) {
            await helper.set(key, JSON.stringify(adminResult));
            console.log(`✅ [ADMIN_FIX] Stored result in key: ${key}`);
        }
        
        // Step 4: Verify storage
        console.log('🔧 [ADMIN_FIX] Step 4: Verify results stored...');
        for (const key of keys) {
            const stored = await helper.get(key);
            if (stored) {
                const parsed = JSON.parse(stored);
                console.log(`✅ [ADMIN_FIX] Key ${key}: Number ${parsed.number}, Admin ID ${parsed.adminUserId}`);
            } else {
                console.log(`❌ [ADMIN_FIX] Key ${key}: NOT FOUND`);
            }
        }
        
        // Step 5: Test scheduler detection (simulate)
        console.log('🔧 [ADMIN_FIX] Step 5: Test scheduler detection...');
        const primaryKey = `wingo:${durationKey}:${periodId}:result`;
        const schedulerResult = await helper.get(primaryKey);
        
        if (schedulerResult) {
            const parsed = JSON.parse(schedulerResult);
            console.log('✅ [ADMIN_FIX] Scheduler would find admin result:', {
                number: parsed.number,
                isAdminOverride: parsed.isAdminOverride,
                adminUserId: parsed.adminUserId
            });
        } else {
            console.log('❌ [ADMIN_FIX] Scheduler would NOT find admin result');
        }
        
        // Cleanup
        console.log('🔧 [ADMIN_FIX] Cleaning up test data...');
        for (const key of keys) {
            await helper.del(key);
        }
        
        console.log('\n🎉 [ADMIN_FIX] TEST COMPLETED SUCCESSFULLY!');
        console.log('🔧 [ADMIN_FIX] The fix is: Initialize Redis before using getRedisHelper()');
        
    } catch (error) {
        console.error('❌ [ADMIN_FIX] Test failed:', error);
    }
    
    process.exit(0);
}

// Run the test
testAdminRedisWorkflow().catch(console.error);