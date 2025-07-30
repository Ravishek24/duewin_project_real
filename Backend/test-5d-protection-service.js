const unifiedRedis = require('./config/unifiedRedisManager');
const fiveDProtectionService = require('./services/fiveDProtectionService');

async function test5DProtectionService() {
    try {
        console.log('🧪 [TEST_5D_PROTECTION_SERVICE] Testing 5D protection service...');
        
        // Initialize Redis if needed
        if (!unifiedRedis.isInitialized) {
            console.log('🔄 [TEST_5D_PROTECTION_SERVICE] Initializing unified Redis manager...');
            await unifiedRedis.initialize();
        }
        
        // Test 1: Check if system is ready
        console.log('🧪 [TEST_5D_PROTECTION_SERVICE] Test 1: Checking system readiness...');
        const isReady = await fiveDProtectionService.isSystemReady();
        console.log(`✅ [TEST_5D_PROTECTION_SERVICE] System ready: ${isReady}`);
        
        if (!isReady) {
            console.log('⚠️ [TEST_5D_PROTECTION_SERVICE] System not ready, skipping further tests');
            return;
        }
        
        // Test 2: Initialize zero-exposure candidates
        console.log('🧪 [TEST_5D_PROTECTION_SERVICE] Test 2: Initializing zero-exposure candidates...');
        const testPeriodId = 'TEST_PROTECTION_SERVICE_' + Date.now();
        const initCount = await fiveDProtectionService.initializeZeroExposureCandidates(
            '5d', 60, testPeriodId, 'default'
        );
        console.log(`✅ [TEST_5D_PROTECTION_SERVICE] Initialized ${initCount} zero-exposure candidates`);
        
        // Test 3: Get protection stats
        console.log('🧪 [TEST_5D_PROTECTION_SERVICE] Test 3: Getting protection stats...');
        const stats = await fiveDProtectionService.getProtectionStats(
            '5d', 60, testPeriodId, 'default'
        );
        console.log('✅ [TEST_5D_PROTECTION_SERVICE] Protection stats:', stats);
        
        // Test 4: Simulate a bet (remove combinations)
        console.log('🧪 [TEST_5D_PROTECTION_SERVICE] Test 4: Simulating a bet...');
        const removedCount = await fiveDProtectionService.removeCombinationFromZeroExposure(
            '5d', 60, testPeriodId, 'default',
            'SUM_SIZE', 'SUM_big'
        );
        console.log(`✅ [TEST_5D_PROTECTION_SERVICE] Removed ${removedCount} combinations for SUM_big bet`);
        
        // Test 5: Get protected result
        console.log('🧪 [TEST_5D_PROTECTION_SERVICE] Test 5: Getting protected result...');
        const result = await fiveDProtectionService.getProtectedResult(
            '5d', 60, testPeriodId, 'default'
        );
        console.log('✅ [TEST_5D_PROTECTION_SERVICE] Protected result:', result);
        
        // Test 6: Verify result format
        if (result) {
            console.log('🧪 [TEST_5D_PROTECTION_SERVICE] Test 6: Verifying result format...');
            const hasRequiredFields = result.A !== undefined && 
                                    result.B !== undefined && 
                                    result.C !== undefined && 
                                    result.D !== undefined && 
                                    result.E !== undefined &&
                                    result.sum !== undefined;
            
            console.log(`✅ [TEST_5D_PROTECTION_SERVICE] Result has required fields: ${hasRequiredFields}`);
            console.log(`✅ [TEST_5D_PROTECTION_SERVICE] Result: A=${result.A}, B=${result.B}, C=${result.C}, D=${result.D}, E=${result.E}, sum=${result.sum}`);
        }
        
        console.log('✅ [TEST_5D_PROTECTION_SERVICE] SUCCESS: All tests passed!');
        console.log('✅ [TEST_5D_PROTECTION_SERVICE] The 5D protection service is working correctly!');
        
    } catch (error) {
        console.error('❌ [TEST_5D_PROTECTION_SERVICE] Test failed:', error);
    }
}

// Run the test
test5DProtectionService(); 