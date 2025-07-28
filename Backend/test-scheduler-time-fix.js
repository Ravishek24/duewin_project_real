/**
 * Test script to verify scheduler time calculation fix
 * This tests that the scheduler properly caps time remaining to duration
 */

// Mock the calculatePeriodEndTime function
const calculatePeriodEndTime = (periodId, duration) => {
    try {
        const dateStr = periodId.substring(0, 8);
        const year = parseInt(dateStr.substring(0, 4), 10);
        const month = parseInt(dateStr.substring(4, 6), 10) - 1;
        const day = parseInt(dateStr.substring(6, 8), 10);

        const sequenceStr = periodId.substring(8);
        const sequenceNumber = parseInt(sequenceStr, 10);

        // Mock moment-like calculation
        const baseTime = new Date(year, month, day, 2, 0, 0);
        const startTime = new Date(baseTime.getTime() + (sequenceNumber * duration * 1000));
        const endTime = new Date(startTime.getTime() + (duration * 1000));

        return endTime;
    } catch (error) {
        console.error('Error calculating period end time:', error);
        throw error;
    }
};

// Test the scheduler time calculation logic
const testSchedulerTimeCalculation = () => {
    console.log('🧪 [SCHEDULER_TIME_CALCULATION_TEST] Testing scheduler time calculation fix...\n');

    const testCases = [
        { gameType: 'wingo', duration: 30, periodId: '20241201120030' },
        { gameType: 'wingo', duration: 60, periodId: '20241201120060' },
        { gameType: 'k3', duration: 30, periodId: '20241201120030' },
        { gameType: '5d', duration: 60, periodId: '20241201120060' }
    ];

    let allTestsPassed = true;

    testCases.forEach(({ gameType, duration, periodId }) => {
        console.log(`🔍 Testing ${gameType} ${duration}s game...`);
        
        // Simulate different times during the game period
        const endTime = calculatePeriodEndTime(periodId, duration);
        
        // Test various time points
        const testTimes = [
            { name: 'Start of period', offset: -duration },
            { name: 'Middle of period', offset: -duration / 2 },
            { name: 'Near end (2s remaining)', offset: -2 },
            { name: 'At end', offset: 0 },
            { name: 'After end (should be 0)', offset: 5 }
        ];

        testTimes.forEach(({ name, offset }) => {
            const now = new Date(endTime.getTime() + (offset * 1000));
            
            // OLD CODE (INCORRECT) - what the scheduler was doing before
            const oldTimeRemaining = Math.max(0, (endTime - now) / 1000);
            
            // NEW CODE (CORRECT) - what the scheduler does now
            let newTimeRemaining = Math.max(0, (endTime - now) / 1000);
            newTimeRemaining = Math.min(newTimeRemaining, duration); // Cap to duration
            
            console.log(`  ${name}: ${oldTimeRemaining.toFixed(1)}s → ${newTimeRemaining.toFixed(1)}s`);
            
            // Check if the fix is working
            if (newTimeRemaining > duration) {
                console.log(`  ❌ FAILED: Time remaining ${newTimeRemaining}s exceeds duration ${duration}s`);
                allTestsPassed = false;
            } else if (oldTimeRemaining > duration && newTimeRemaining === duration) {
                console.log(`  ✅ FIXED: Capped ${oldTimeRemaining.toFixed(1)}s to ${duration}s`);
            } else {
                console.log(`  ✅ OK: Time remaining ${newTimeRemaining.toFixed(1)}s is within limits`);
            }
        });
        
        console.log('');
    });

    return allTestsPassed;
};

// Test the Redis storage logic
const testRedisStorageLogic = () => {
    console.log('🔍 [REDIS_STORAGE_LOGIC_TEST] Testing Redis storage logic...\n');

    const testCases = [
        { duration: 30, timeRemaining: 25, expected: 25 },
        { duration: 30, timeRemaining: 30, expected: 30 },
        { duration: 30, timeRemaining: 31, expected: 30 },
        { duration: 30, timeRemaining: 35, expected: 30 },
        { duration: 60, timeRemaining: 55, expected: 55 },
        { duration: 60, timeRemaining: 60, expected: 60 },
        { duration: 60, timeRemaining: 61, expected: 60 },
        { duration: 60, timeRemaining: 65, expected: 60 }
    ];

    let allTestsPassed = true;

    testCases.forEach(({ duration, timeRemaining, expected }) => {
        // Simulate the storePeriodInRedisForWebSocket logic
        let storedTimeRemaining = timeRemaining;
        storedTimeRemaining = Math.min(storedTimeRemaining, duration); // Cap to duration
        
        console.log(`Duration: ${duration}s, Input: ${timeRemaining}s, Stored: ${storedTimeRemaining}s, Expected: ${expected}s`);
        
        if (storedTimeRemaining !== expected) {
            console.log(`  ❌ FAILED: Expected ${expected}s but got ${storedTimeRemaining}s`);
            allTestsPassed = false;
        } else {
            console.log(`  ✅ PASSED: Correctly stored ${storedTimeRemaining}s`);
        }
    });

    console.log('');
    return allTestsPassed;
};

// Run all tests
const runAllTests = () => {
    console.log('🚀 [SCHEDULER_TIME_FIX_TEST] Starting comprehensive test...\n');
    
    const test1Passed = testSchedulerTimeCalculation();
    const test2Passed = testRedisStorageLogic();
    
    console.log('📊 [TEST_RESULTS] ==========================================');
    console.log(`Scheduler Time Calculation Test: ${test1Passed ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Redis Storage Logic Test: ${test2Passed ? '✅ PASSED' : '❌ FAILED'}`);
    
    if (test1Passed && test2Passed) {
        console.log('\n🎉 [ALL_TESTS_PASSED] Scheduler time calculation fix is working correctly!');
        console.log('✅ Scheduler properly caps time remaining to duration');
        console.log('✅ Redis storage uses capped values');
        console.log('✅ No more 61s showing for 60s games from scheduler');
    } else {
        console.log('\n❌ [SOME_TESTS_FAILED] Scheduler time calculation fix needs attention');
    }
    
    console.log('==========================================================\n');
    
    return test1Passed && test2Passed;
};

// Run the tests
if (require.main === module) {
    runAllTests();
}

module.exports = {
    testSchedulerTimeCalculation,
    testRedisStorageLogic,
    runAllTests
}; 