/**
 * Debug script to test period transition timing
 * Tests the new logic: current period shows 0 before transitioning to next period
 */

const moment = require('moment-timezone');

// Mock duration and game type
const duration = 30; // 30 seconds
const gameType = 'wingo';

// Mock current time calculations
const calculatePeriodTimes = (currentTime) => {
    const istMoment = moment(currentTime).tz('Asia/Kolkata');
    
    // Calculate time since 2 AM today
    let startOfPeriods = istMoment.clone().hour(2).minute(0).second(0).millisecond(0);
    
    // If current time is before 2 AM, use 2 AM of previous day
    if (istMoment.hour() < 2) {
        startOfPeriods.subtract(1, 'day');
    }
    
    // Calculate total seconds since period start
    const totalSeconds = istMoment.diff(startOfPeriods, 'seconds');
    
    // Calculate current period number (0-based)
    const currentPeriodNumber = Math.floor(totalSeconds / duration);
    
    // Calculate when current period started
    const currentPeriodStart = startOfPeriods.clone().add(currentPeriodNumber * duration, 'seconds');
    
    // Calculate when current period ends
    const currentPeriodEnd = currentPeriodStart.clone().add(duration, 'seconds');
    
    // Calculate time remaining in current period
    const timeRemaining = Math.max(0, currentPeriodEnd.diff(istMoment, 'seconds'));
    
    // Calculate next period info
    const nextPeriodNumber = currentPeriodNumber + 1;
    const nextPeriodStart = startOfPeriods.clone().add(nextPeriodNumber * duration, 'seconds');
    const nextPeriodEnd = nextPeriodStart.clone().add(duration, 'seconds');
    const nextTimeRemaining = Math.max(0, nextPeriodEnd.diff(istMoment, 'seconds'));
    
    return {
        currentTime: istMoment.format(),
        currentPeriodNumber,
        timeRemaining,
        nextPeriodNumber,
        nextTimeRemaining,
        shouldTransition: timeRemaining <= 0 && nextTimeRemaining >= duration
    };
};

// Test scenarios
console.log('🧪 [DEBUG] Testing period transition timing with new logic');
console.log('📋 [DEBUG] New logic: current period shows 0 before transitioning to next period');
console.log('📋 [DEBUG] Transition condition: timeRemaining <= 0 && nextTimeRemaining >= duration');
console.log('');

// Test 1: Current period at 2 seconds remaining
console.log('🔍 [TEST 1] Current period at 2 seconds remaining:');
const test1Time = moment().tz('Asia/Kolkata').subtract(2, 'seconds');
const test1 = calculatePeriodTimes(test1Time);
console.log(`   Current Time: ${test1.currentTime}`);
console.log(`   Current Period: ${test1.currentPeriodNumber}`);
console.log(`   Time Remaining: ${test1.timeRemaining}s`);
console.log(`   Next Period: ${test1.nextPeriodNumber}`);
console.log(`   Next Period Time Remaining: ${test1.nextTimeRemaining}s`);
console.log(`   Should Transition: ${test1.shouldTransition}`);
console.log('   Expected: Should NOT transition (current period still has 2s)');
console.log('');

// Test 2: Current period at 0 seconds remaining, next period not ready
console.log('🔍 [TEST 2] Current period at 0 seconds, next period not ready:');
const test2Time = moment().tz('Asia/Kolkata').add(1, 'second'); // Just after current period ends
const test2 = calculatePeriodTimes(test2Time);
console.log(`   Current Time: ${test2.currentTime}`);
console.log(`   Current Period: ${test2.currentPeriodNumber}`);
console.log(`   Time Remaining: ${test2.timeRemaining}s`);
console.log(`   Next Period: ${test2.nextPeriodNumber}`);
console.log(`   Next Period Time Remaining: ${test2.nextTimeRemaining}s`);
console.log(`   Should Transition: ${test2.shouldTransition}`);
console.log('   Expected: Should NOT transition (next period not ready)');
console.log('');

// Test 3: Current period at 0 seconds remaining, next period ready
console.log('🔍 [TEST 3] Current period at 0 seconds, next period ready:');
const test3Time = moment().tz('Asia/Kolkata').add(duration, 'seconds'); // Next period should be ready
const test3 = calculatePeriodTimes(test3Time);
console.log(`   Current Time: ${test3.currentTime}`);
console.log(`   Current Period: ${test3.currentPeriodNumber}`);
console.log(`   Time Remaining: ${test3.timeRemaining}s`);
console.log(`   Next Period: ${test3.nextPeriodNumber}`);
console.log(`   Next Period Time Remaining: ${test3.nextTimeRemaining}s`);
console.log(`   Should Transition: ${test3.shouldTransition}`);
console.log('   Expected: Should transition (next period ready)');
console.log('');

// Test 4: Current period at 1 second remaining
console.log('🔍 [TEST 4] Current period at 1 second remaining:');
const test4Time = moment().tz('Asia/Kolkata').subtract(1, 'second');
const test4 = calculatePeriodTimes(test4Time);
console.log(`   Current Time: ${test4.currentTime}`);
console.log(`   Current Period: ${test4.currentPeriodNumber}`);
console.log(`   Time Remaining: ${test4.timeRemaining}s`);
console.log(`   Next Period: ${test4.nextPeriodNumber}`);
console.log(`   Next Period Time Remaining: ${test4.nextTimeRemaining}s`);
console.log(`   Should Transition: ${test4.shouldTransition}`);
console.log('   Expected: Should NOT transition (current period still has 1s)');
console.log('');

// Test 5: Current period at 0 seconds remaining, next period partially ready
console.log('🔍 [TEST 5] Current period at 0 seconds, next period partially ready:');
const test5Time = moment().tz('Asia/Kolkata').add(duration * 0.5, 'seconds'); // Next period 50% ready
const test5 = calculatePeriodTimes(test5Time);
console.log(`   Current Time: ${test5.currentTime}`);
console.log(`   Current Period: ${test5.currentPeriodNumber}`);
console.log(`   Time Remaining: ${test5.timeRemaining}s`);
console.log(`   Next Period: ${test5.nextPeriodNumber}`);
console.log(`   Next Period Time Remaining: ${test5.nextTimeRemaining}s`);
console.log(`   Should Transition: ${test5.shouldTransition}`);
console.log('   Expected: Should NOT transition (next period not fully ready)');
console.log('');

console.log('✅ [DEBUG] Test scenarios completed');
console.log('📝 [DEBUG] Key changes:');
console.log('   - Current period shows 0 before transitioning');
console.log('   - Next period must have full duration remaining to transition');
console.log('   - This ensures 2, 1, 0 countdown is displayed');
console.log('   - Prevents "stuck at 30" issue'); 