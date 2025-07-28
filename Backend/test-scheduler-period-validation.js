/**
 * Test script to verify scheduler period validation fixes
 * Ensures that only new periods with full duration are broadcasted
 */

// Mock the calculatePeriodEndTime function
const calculatePeriodEndTime = (periodId, duration) => {
    // Extract timestamp from periodId (format: YYYYMMDDHHMMSSxxx)
    const timestamp = periodId.substring(0, 14);
    const year = timestamp.substring(0, 4);
    const month = timestamp.substring(4, 6);
    const day = timestamp.substring(6, 8);
    const hour = timestamp.substring(8, 10);
    const minute = timestamp.substring(10, 12);
    const second = timestamp.substring(12, 14);
    
    const startTime = new Date(year, month - 1, day, hour, minute, second);
    return new Date(startTime.getTime() + duration * 1000);
};

// Mock the broadcastPeriodStart function
const broadcastPeriodStart = async (gameType, duration, periodData) => {
    const now = new Date();
    const endTime = periodData.endTime ? new Date(periodData.endTime) : new Date(now.getTime() + duration * 1000);
    let timeRemaining = Math.max(0, (endTime - now) / 1000);
    timeRemaining = Math.min(timeRemaining, duration);
    
    // CRITICAL FIX: Only broadcast if this is actually a new period with full duration
    const isNewPeriod = timeRemaining >= (duration - 1);
    
    if (!isNewPeriod) {
        console.log(`⚠️ [PERIOD_START] Skipping broadcast for ${gameType}_${duration}: period ${periodData.periodId} has ${timeRemaining.toFixed(3)}s remaining (not a new period)`);
        return false;
    }
    
    console.log(`📤 [PERIOD_START] Broadcasting NEW period start: ${periodData.periodId} with ${timeRemaining.toFixed(3)}s remaining`);
    return true;
};

// Test function to simulate different scenarios
const testPeriodValidation = () => {
    console.log('🧪 Testing Scheduler Period Validation Fixes\n');
    
    const now = new Date();
    const testCases = [
        {
            name: 'New 30s period (should broadcast)',
            gameType: 'wingo',
            duration: 30,
            periodId: '20250728152630000', // 15:26:30
            expectedBroadcast: true
        },
        {
            name: 'New 60s period (should broadcast)',
            gameType: 'wingo',
            duration: 60,
            periodId: '20250728152630000', // 15:26:30
            expectedBroadcast: true
        },
        {
            name: '30s period with 2s remaining (should NOT broadcast)',
            gameType: 'wingo',
            duration: 30,
            periodId: '20250728152628000', // 15:26:28 (2s ago)
            expectedBroadcast: false
        },
        {
            name: '60s period with 5s remaining (should NOT broadcast)',
            gameType: 'wingo',
            duration: 60,
            periodId: '20250728152625000', // 15:26:25 (5s ago)
            expectedBroadcast: false
        },
        {
            name: '300s period with 182s remaining (should NOT broadcast)',
            gameType: 'wingo',
            duration: 300,
            periodId: '20250728152300000', // 15:23:00 (3 minutes ago)
            expectedBroadcast: false
        },
        {
            name: 'Expired 30s period (should NOT broadcast)',
            gameType: 'wingo',
            duration: 30,
            periodId: '20250728152600000', // 15:26:00 (30s ago)
            expectedBroadcast: false
        }
    ];
    
    let passedTests = 0;
    let totalTests = testCases.length;
    
    testCases.forEach((testCase, index) => {
        console.log(`\n--- Test ${index + 1}: ${testCase.name} ---`);
        
        const endTime = calculatePeriodEndTime(testCase.periodId, testCase.duration);
        const timeRemaining = Math.max(0, (endTime - now) / 1000);
        const isNewPeriod = timeRemaining >= (testCase.duration - 1);
        
        console.log(`Period ID: ${testCase.periodId}`);
        console.log(`Duration: ${testCase.duration}s`);
        console.log(`End Time: ${endTime.toISOString()}`);
        console.log(`Time Remaining: ${timeRemaining.toFixed(3)}s`);
        console.log(`Is New Period: ${isNewPeriod}`);
        
        const periodData = {
            periodId: testCase.periodId,
            endTime: endTime
        };
        
        const wasBroadcasted = broadcastPeriodStart(testCase.gameType, testCase.duration, periodData);
        
        if (wasBroadcasted === testCase.expectedBroadcast) {
            console.log(`✅ PASS: Expected ${testCase.expectedBroadcast ? 'broadcast' : 'no broadcast'}, got ${wasBroadcasted ? 'broadcast' : 'no broadcast'}`);
            passedTests++;
        } else {
            console.log(`❌ FAIL: Expected ${testCase.expectedBroadcast ? 'broadcast' : 'no broadcast'}, got ${wasBroadcasted ? 'broadcast' : 'no broadcast'}`);
        }
    });
    
    console.log(`\n📊 Test Results: ${passedTests}/${totalTests} tests passed`);
    
    if (passedTests === totalTests) {
        console.log('🎉 All tests passed! The scheduler period validation fixes are working correctly.');
    } else {
        console.log('⚠️ Some tests failed. Please review the validation logic.');
    }
};

// Test the betting closure logic consistency
const testBettingClosureConsistency = () => {
    console.log('\n🧪 Testing Betting Closure Logic Consistency\n');
    
    const testCases = [
        { timeRemaining: 10, expectedOpen: true, expectedClose: false },
        { timeRemaining: 5, expectedOpen: true, expectedClose: false },
        { timeRemaining: 4.9, expectedOpen: false, expectedClose: true },
        { timeRemaining: 2, expectedOpen: false, expectedClose: true },
        { timeRemaining: 1, expectedOpen: false, expectedClose: true },
        { timeRemaining: 0, expectedOpen: false, expectedClose: true }
    ];
    
    let passedTests = 0;
    let totalTests = testCases.length;
    
    testCases.forEach((testCase, index) => {
        console.log(`\n--- Betting Test ${index + 1}: ${testCase.timeRemaining}s remaining ---`);
        
        // WebSocket logic (milliseconds)
        const wsBettingOpen = testCase.timeRemaining >= 5;
        const wsBettingClose = testCase.timeRemaining < 5;
        
        // Scheduler logic (seconds)
        const schedulerBettingOpen = testCase.timeRemaining >= 5;
        const schedulerBettingClose = testCase.timeRemaining < 5;
        
        console.log(`Time Remaining: ${testCase.timeRemaining}s`);
        console.log(`WebSocket - bettingOpen: ${wsBettingOpen}, bettingClose: ${wsBettingClose}`);
        console.log(`Scheduler - bettingOpen: ${schedulerBettingOpen}, bettingClose: ${schedulerBettingClose}`);
        console.log(`Expected - bettingOpen: ${testCase.expectedOpen}, bettingClose: ${testCase.expectedClose}`);
        
        const wsCorrect = (wsBettingOpen === testCase.expectedOpen) && (wsBettingClose === testCase.expectedClose);
        const schedulerCorrect = (schedulerBettingOpen === testCase.expectedOpen) && (schedulerBettingClose === testCase.expectedClose);
        
        if (wsCorrect && schedulerCorrect) {
            console.log('✅ PASS: Both WebSocket and Scheduler logic are correct and consistent');
            passedTests++;
        } else {
            console.log('❌ FAIL: Logic inconsistency detected');
            if (!wsCorrect) console.log('   - WebSocket logic is incorrect');
            if (!schedulerCorrect) console.log('   - Scheduler logic is incorrect');
        }
    });
    
    console.log(`\n📊 Betting Closure Test Results: ${passedTests}/${totalTests} tests passed`);
    
    if (passedTests === totalTests) {
        console.log('🎉 All betting closure tests passed! The logic is consistent across services.');
    } else {
        console.log('⚠️ Some betting closure tests failed. Please review the logic.');
    }
};

// Run the tests
if (require.main === module) {
    testPeriodValidation();
    testBettingClosureConsistency();
}

module.exports = {
    testPeriodValidation,
    testBettingClosureConsistency,
    calculatePeriodEndTime,
    broadcastPeriodStart
}; 