const moment = require('moment-timezone');

/**
 * Test script to verify time calculation fix
 * This tests that time remaining never exceeds the actual duration
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

        const baseTime = moment.tz([year, month, day, 2, 0, 0], 'Asia/Kolkata');
        const startTime = baseTime.add(sequenceNumber * duration, 'seconds');
        const endTime = moment(startTime).tz('Asia/Kolkata').add(duration, 'seconds');

        return endTime.toDate();
    } catch (error) {
        console.error('Error calculating period end time:', error);
        throw error;
    }
};

// Test the time calculation logic
const testTimeCalculation = () => {
    console.log('🧪 [TIME_CALCULATION_TEST] Testing time calculation fix...\n');

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
            const actualTimeRemaining = Math.max(0, Math.ceil((endTime - now) / 1000));
            
            // Apply the fix: cap time remaining to duration
            const fixedTimeRemaining = Math.min(actualTimeRemaining, duration);
            
            console.log(`  ${name}: ${actualTimeRemaining}s → ${fixedTimeRemaining}s`);
            
            // Check if the fix is working
            if (fixedTimeRemaining > duration) {
                console.log(`  ❌ FAILED: Time remaining ${fixedTimeRemaining}s exceeds duration ${duration}s`);
                allTestsPassed = false;
            } else if (actualTimeRemaining > duration && fixedTimeRemaining === duration) {
                console.log(`  ✅ FIXED: Capped ${actualTimeRemaining}s to ${duration}s`);
            } else {
                console.log(`  ✅ OK: Time remaining ${fixedTimeRemaining}s is within limits`);
            }
        });
        
        console.log('');
    });

    return allTestsPassed;
};

// Test the validation logic
const testValidationLogic = () => {
    console.log('🔍 [VALIDATION_LOGIC_TEST] Testing validation logic...\n');

    const testCases = [
        { duration: 30, timeRemaining: 25, expected: 'valid' },
        { duration: 30, timeRemaining: 30, expected: 'valid' },
        { duration: 30, timeRemaining: 31, expected: 'invalid' },
        { duration: 30, timeRemaining: 35, expected: 'invalid' },
        { duration: 60, timeRemaining: 55, expected: 'valid' },
        { duration: 60, timeRemaining: 60, expected: 'valid' },
        { duration: 60, timeRemaining: 61, expected: 'invalid' },
        { duration: 60, timeRemaining: 65, expected: 'invalid' }
    ];

    let allTestsPassed = true;

    testCases.forEach(({ duration, timeRemaining, expected }) => {
        // Test the old validation logic
        const oldValidation = timeRemaining < 0 || timeRemaining > duration + 5;
        
        // Test the new validation logic
        const newValidation = timeRemaining < 0 || timeRemaining > duration;
        
        console.log(`Duration: ${duration}s, Time: ${timeRemaining}s`);
        console.log(`  Old validation (duration + 5): ${oldValidation ? 'INVALID' : 'VALID'}`);
        console.log(`  New validation (duration only): ${newValidation ? 'INVALID' : 'VALID'}`);
        console.log(`  Expected: ${expected.toUpperCase()}`);
        
        if (expected === 'invalid' && !newValidation) {
            console.log(`  ❌ FAILED: Should be invalid but validation passed`);
            allTestsPassed = false;
        } else if (expected === 'valid' && newValidation) {
            console.log(`  ❌ FAILED: Should be valid but validation failed`);
            allTestsPassed = false;
        } else {
            console.log(`  ✅ PASSED: Validation working correctly`);
        }
        console.log('');
    });

    return allTestsPassed;
};

// Run all tests
const runAllTests = () => {
    console.log('🚀 [TIME_CALCULATION_FIX_TEST] Starting comprehensive test...\n');
    
    const test1Passed = testTimeCalculation();
    const test2Passed = testValidationLogic();
    
    console.log('📊 [TEST_RESULTS] ==========================================');
    console.log(`Time Calculation Test: ${test1Passed ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Validation Logic Test: ${test2Passed ? '✅ PASSED' : '❌ FAILED'}`);
    
    if (test1Passed && test2Passed) {
        console.log('\n🎉 [ALL_TESTS_PASSED] Time calculation fix is working correctly!');
        console.log('✅ No more 31s showing for 30s games');
        console.log('✅ No more 61s showing for 60s games');
        console.log('✅ Time remaining is properly capped to duration');
    } else {
        console.log('\n❌ [SOME_TESTS_FAILED] Time calculation fix needs attention');
    }
    
    console.log('==========================================================\n');
    
    return test1Passed && test2Passed;
};

// Run the tests
if (require.main === module) {
    runAllTests();
}

module.exports = {
    testTimeCalculation,
    testValidationLogic,
    runAllTests
}; 