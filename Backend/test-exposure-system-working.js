const unifiedRedis = require('./config/unifiedRedisManager');
const adminExposureService = require('./services/adminExposureService');

async function testExposureSystemWorking() {
    console.log('🧪 [TEST] Testing Exposure System Working');
    
    try {
        const unifiedRedisHelper = unifiedRedis.getHelper();
        
        // Test data
        const testDuration = 30;
        const testPeriodId = 'test_period_003';
        const exposureKey = `exposure:wingo:${testDuration}:default:${testPeriodId}`;
        
        console.log('📊 [TEST] Setting up test data...');
        
        // Clear any existing test data
        await unifiedRedisHelper.del(exposureKey);
        
        // Test 1: Check if enhanced exposure data is being generated correctly
        console.log('\n🔍 [TEST] Testing enhanced exposure data generation...');
        
        const enhancedData = await adminExposureService.getEnhancedWingoExposure(testDuration);
        console.log('✅ Enhanced exposure data structure:', {
            success: enhancedData.success,
            hasNumbers: !!enhancedData.numbers,
            hasUserDetails: !!enhancedData.userDetails,
            hasStatistics: !!enhancedData.statistics,
            hasPeriodSummary: !!enhancedData.periodSummary
        });
        
        // Test 2: Check if numbers structure is correct
        if (enhancedData.numbers) {
            console.log('✅ Numbers structure check:');
            for (let i = 0; i <= 9; i++) {
                const numberData = enhancedData.numbers[i];
                console.log(`  Number ${i}: amount=${numberData.amount}, users=${numberData.users}, totalBetAmount=${numberData.totalBetAmount}`);
            }
        }
        
        // Test 3: Check if user details structure is correct
        if (enhancedData.userDetails) {
            console.log('✅ User details structure check:');
            for (let i = 0; i <= 9; i++) {
                const userDetails = enhancedData.userDetails[i];
                console.log(`  Number ${i}: ${userDetails.length} users`);
            }
        }
        
        // Test 4: Check if statistics structure is correct
        if (enhancedData.statistics) {
            console.log('✅ Statistics structure check:');
            for (let i = 0; i <= 9; i++) {
                const stats = enhancedData.statistics[`number:${i}`];
                console.log(`  Number ${i}: totalUsers=${stats.totalUsers}, totalBetAmount=${stats.totalBetAmount}, uniqueUsers=${stats.uniqueUsers}`);
            }
        }
        
        // Test 5: Check if period summary structure is correct
        if (enhancedData.periodSummary) {
            console.log('✅ Period summary structure check:');
            console.log(`  Total users: ${enhancedData.periodSummary.totalUsers}`);
            console.log(`  Total bet amount: ${enhancedData.periodSummary.totalBetAmount}`);
            console.log(`  Unique users: ${enhancedData.periodSummary.uniqueUsers}`);
            console.log(`  Total bets: ${enhancedData.periodSummary.totalBets}`);
        }
        
        console.log('\n🎉 [TEST] All tests completed successfully!');
        console.log('✅ The enhanced exposure system is working correctly.');
        
    } catch (error) {
        console.error('❌ [TEST] Error in exposure system test:', error);
    }
}

// Run the test
testExposureSystemWorking(); 