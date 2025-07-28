/**
 * Debug script to test countdown stopping issue
 * This script simulates the time calculation logic to identify why countdown stops after 29 seconds
 */

const moment = require('moment-timezone');

// Mock calculatePeriodEndTime function
const calculatePeriodEndTime = (periodId, duration) => {
    const dateStr = periodId.substring(0, 8);
    const sequence = parseInt(periodId.substring(8), 10);
    
    // Calculate start time (2 AM IST on the date)
    const startDate = moment.tz(dateStr, 'YYYYMMDD', 'Asia/Kolkata');
    const startTime = startDate.hour(2).minute(0).second(0).millisecond(0);
    
    // Add sequence * duration seconds
    const periodStart = startTime.add(sequence * duration, 'seconds');
    const periodEnd = periodStart.clone().add(duration, 'seconds');
    
    return periodEnd.toDate();
};

// Test the time calculation logic
const testTimeCalculation = () => {
    console.log('🔍 Testing time calculation logic...\n');
    
    const now = new Date();
    const gameType = 'wingo';
    const duration = 30;
    
    // Simulate a period that should be counting down
    const periodId = '20250728000002274'; // Example period ID
    const endTime = calculatePeriodEndTime(periodId, duration);
    
    console.log(`📅 Period ID: ${periodId}`);
    console.log(`⏰ End Time: ${endTime.toISOString()}`);
    console.log(`🕐 Current Time: ${now.toISOString()}`);
    
    const timeRemaining = Math.max(0, Math.ceil((endTime - now) / 1000));
    console.log(`⏱️ Time Remaining: ${timeRemaining}s`);
    
    // Test the capping logic
    const cappedTimeRemaining = Math.min(timeRemaining, duration);
    console.log(`🔒 Capped Time Remaining: ${cappedTimeRemaining}s`);
    
    if (timeRemaining !== cappedTimeRemaining) {
        console.log(`⚠️ WARNING: Time was capped from ${timeRemaining}s to ${cappedTimeRemaining}s`);
    }
    
    return { timeRemaining, cappedTimeRemaining, endTime };
};

// Test the scheduler time calculation
const testSchedulerTimeCalculation = () => {
    console.log('\n🔍 Testing scheduler time calculation...\n');
    
    const now = new Date();
    const gameType = 'wingo';
    const duration = 30;
    const periodId = '20250728000002274';
    
    // Simulate what scheduler does
    const endTime = calculatePeriodEndTime(periodId, duration);
    let timeRemaining = Math.max(0, (endTime - now) / 1000);
    timeRemaining = Math.min(timeRemaining, duration);
    
    console.log(`📅 Scheduler calculation for ${periodId}:`);
    console.log(`⏰ End Time: ${endTime.toISOString()}`);
    console.log(`⏱️ Time Remaining: ${timeRemaining.toFixed(3)}s`);
    
    // Simulate storing in Redis
    const periodInfo = {
        periodId,
        gameType,
        duration,
        endTime: endTime.toISOString(),
        timeRemaining: timeRemaining,
        bettingOpen: timeRemaining >= 5
    };
    
    console.log(`💾 Period info to store:`, JSON.stringify(periodInfo, null, 2));
    
    return periodInfo;
};

// Test the WebSocket time calculation
const testWebSocketTimeCalculation = (periodInfo) => {
    console.log('\n🔍 Testing WebSocket time calculation...\n');
    
    const now = new Date();
    const gameType = 'wingo';
    const duration = 30;
    
    // Simulate what WebSocket does when reading from Redis
    let actualTimeRemaining;
    try {
        const actualEndTime = calculatePeriodEndTime(periodInfo.periodId, duration);
        actualTimeRemaining = Math.max(0, Math.ceil((actualEndTime - now) / 1000));
    } catch (timeError) {
        const redisEndTime = new Date(periodInfo.endTime);
        actualTimeRemaining = Math.max(0, Math.ceil((redisEndTime - now) / 1000));
    }
    
    // Cap time remaining
    actualTimeRemaining = Math.min(actualTimeRemaining, duration);
    
    console.log(`📡 WebSocket calculation:`);
    console.log(`⏰ Redis timeRemaining: ${periodInfo.timeRemaining}s`);
    console.log(`⏱️ Calculated timeRemaining: ${actualTimeRemaining}s`);
    console.log(`🔒 Capped timeRemaining: ${actualTimeRemaining}s`);
    
    if (Math.abs(periodInfo.timeRemaining - actualTimeRemaining) > 1) {
        console.log(`⚠️ WARNING: Time mismatch! Redis: ${periodInfo.timeRemaining}s, Calculated: ${actualTimeRemaining}s`);
    }
    
    return actualTimeRemaining;
};

// Test the period service logic
const testPeriodServiceLogic = () => {
    console.log('\n🔍 Testing period service logic...\n');
    
    const now = new Date();
    const istMoment = moment(now).tz('Asia/Kolkata');
    const gameType = 'wingo';
    const duration = 30;
    
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
    
    // Generate period ID
    const dateStr = startOfPeriods.format('YYYYMMDD');
    const periodId = `${dateStr}${currentPeriodNumber.toString().padStart(9, '0')}`;
    
    console.log(`📅 Period Service calculation:`);
    console.log(`⏰ Current time (IST): ${istMoment.format()}`);
    console.log(`📅 Start of periods: ${startOfPeriods.format()}`);
    console.log(`🔢 Current period number: ${currentPeriodNumber}`);
    console.log(`🆔 Period ID: ${periodId}`);
    console.log(`⏱️ Time remaining: ${timeRemaining}s`);
    
    return { periodId, timeRemaining, currentPeriodEnd };
};

// Main test function
const runTests = () => {
    console.log('🚀 Starting countdown stopping debug tests...\n');
    
    // Test 1: Basic time calculation
    const basicResult = testTimeCalculation();
    
    // Test 2: Scheduler calculation
    const schedulerResult = testSchedulerTimeCalculation();
    
    // Test 3: WebSocket calculation
    const websocketResult = testWebSocketTimeCalculation(schedulerResult);
    
    // Test 4: Period service calculation
    const periodServiceResult = testPeriodServiceLogic();
    
    console.log('\n📊 Summary:');
    console.log(`Basic calculation: ${basicResult.cappedTimeRemaining}s`);
    console.log(`Scheduler calculation: ${schedulerResult.timeRemaining.toFixed(3)}s`);
    console.log(`WebSocket calculation: ${websocketResult}s`);
    console.log(`Period service calculation: ${periodServiceResult.timeRemaining}s`);
    
    // Check for inconsistencies
    const times = [basicResult.cappedTimeRemaining, schedulerResult.timeRemaining, websocketResult, periodServiceResult.timeRemaining];
    const maxDiff = Math.max(...times) - Math.min(...times);
    
    if (maxDiff > 1) {
        console.log(`\n⚠️ WARNING: Time calculations are inconsistent! Max difference: ${maxDiff.toFixed(3)}s`);
    } else {
        console.log(`\n✅ Time calculations are consistent (max difference: ${maxDiff.toFixed(3)}s)`);
    }
};

// Run the tests
runTests(); 