const moment = require('moment-timezone');

/**
 * Debug script to test the new period stuck issue
 * This script simulates the time calculation logic to identify where the issue occurs
 */

// Mock the calculatePeriodEndTime function
const calculatePeriodEndTime = (periodId, duration) => {
    const dateStr = periodId.substring(0, 8);
    const sequence = parseInt(periodId.substring(8), 10);
    
    // Calculate start time based on sequence
    const startTime = moment.tz(dateStr, 'YYYYMMDD', 'UTC').add(sequence * duration, 'seconds');
    
    // Calculate end time
    const endTime = startTime.clone().add(duration, 'seconds');
    
    return endTime.toDate();
};

// Test the time calculation logic
const testTimeCalculation = () => {
    console.log('🔍 [DEBUG] Testing time calculation logic...\n');
    
    const now = new Date();
    const gameType = 'wingo';
    const duration = 30;
    
    // Simulate a period that just started
    const periodId = '20250728000002135'; // Example period ID
    const endTime = calculatePeriodEndTime(periodId, duration);
    
    console.log(`📅 [DEBUG] Current time: ${now.toISOString()}`);
    console.log(`📅 [DEBUG] Period ID: ${periodId}`);
    console.log(`📅 [DEBUG] Calculated end time: ${endTime.toISOString()}`);
    
    // Calculate time remaining
    let timeRemaining = Math.max(0, (endTime - now) / 1000);
    timeRemaining = Math.min(timeRemaining, duration);
    
    console.log(`⏰ [DEBUG] Calculated timeRemaining: ${timeRemaining}s`);
    console.log(`⏰ [DEBUG] Duration: ${duration}s`);
    console.log(`⏰ [DEBUG] Is stuck at start time? ${timeRemaining === duration ? 'YES' : 'NO'}`);
    
    if (timeRemaining === duration) {
        console.log('\n❌ [DEBUG] ISSUE DETECTED: Period is stuck at start time!');
        console.log(`❌ [DEBUG] This means the endTime calculation is incorrect or the period just started`);
        
        // Check if the period just started
        const startTime = new Date(endTime.getTime() - duration * 1000);
        const timeSinceStart = (now - startTime) / 1000;
        
        console.log(`📅 [DEBUG] Calculated start time: ${startTime.toISOString()}`);
        console.log(`⏰ [DEBUG] Time since period start: ${timeSinceStart.toFixed(2)}s`);
        
        if (timeSinceStart < 5) {
            console.log(`✅ [DEBUG] Period just started (${timeSinceStart.toFixed(2)}s ago) - this is normal`);
        } else {
            console.log(`❌ [DEBUG] Period started ${timeSinceStart.toFixed(2)}s ago but timeRemaining is still ${duration}s - THIS IS THE ISSUE!`);
        }
    } else {
        console.log('\n✅ [DEBUG] Time calculation looks correct');
    }
    
    console.log('\n' + '='.repeat(60));
};

// Test the scheduler's time calculation logic
const testSchedulerTimeCalculation = () => {
    console.log('🔍 [DEBUG] Testing scheduler time calculation logic...\n');
    
    const now = new Date();
    const gameType = 'wingo';
    const duration = 30;
    
    // Simulate period info from periodService
    const periodInfo = {
        periodId: '20250728000002135',
        gameType,
        duration,
        startTime: new Date(now.getTime() - 5 * 1000), // Started 5 seconds ago
        endTime: new Date(now.getTime() + 25 * 1000),  // Ends in 25 seconds
        active: true,
        bettingOpen: true
    };
    
    console.log(`📅 [DEBUG] Current time: ${now.toISOString()}`);
    console.log(`📅 [DEBUG] Period start time: ${periodInfo.startTime.toISOString()}`);
    console.log(`📅 [DEBUG] Period end time: ${periodInfo.endTime.toISOString()}`);
    
    // Simulate scheduler's time calculation
    const endTime = calculatePeriodEndTime(periodInfo.periodId, duration);
    let timeRemaining = Math.max(0, (endTime - now) / 1000);
    timeRemaining = Math.min(timeRemaining, duration);
    
    console.log(`⏰ [DEBUG] Scheduler calculated timeRemaining: ${timeRemaining}s`);
    
    // Simulate storePeriodInRedisForWebSocket logic
    let redisTimeRemaining = periodInfo.endTime ? Math.max(0, (periodInfo.endTime - now) / 1000) : duration;
    redisTimeRemaining = Math.min(redisTimeRemaining, duration);
    
    console.log(`⏰ [DEBUG] Redis stored timeRemaining: ${redisTimeRemaining}s`);
    
    if (timeRemaining === duration && redisTimeRemaining !== duration) {
        console.log('\n❌ [DEBUG] ISSUE: Scheduler and Redis calculations differ!');
        console.log(`❌ [DEBUG] Scheduler uses calculatePeriodEndTime, Redis uses periodInfo.endTime`);
    } else if (timeRemaining === duration) {
        console.log('\n❌ [DEBUG] ISSUE: Both calculations show stuck at start time!');
    } else {
        console.log('\n✅ [DEBUG] Time calculations look consistent');
    }
    
    console.log('\n' + '='.repeat(60));
};

// Test the WebSocket's time calculation logic
const testWebSocketTimeCalculation = () => {
    console.log('🔍 [DEBUG] Testing WebSocket time calculation logic...\n');
    
    const now = new Date();
    const gameType = 'wingo';
    const duration = 30;
    
    // Simulate period info from Redis
    const periodInfo = {
        periodId: '20250728000002135',
        gameType,
        duration,
        endTime: new Date(now.getTime() + 25 * 1000).toISOString(), // Ends in 25 seconds
        timeRemaining: 30, // This is the stuck value
        bettingOpen: true
    };
    
    console.log(`📅 [DEBUG] Current time: ${now.toISOString()}`);
    console.log(`📅 [DEBUG] Period info from Redis:`, JSON.stringify(periodInfo, null, 2));
    
    // Simulate WebSocket's time calculation
    let actualTimeRemaining;
    try {
        const actualEndTime = calculatePeriodEndTime(periodInfo.periodId, duration);
        actualTimeRemaining = Math.max(0, Math.ceil((actualEndTime - now) / 1000));
    } catch (timeError) {
        const redisEndTime = new Date(periodInfo.endTime);
        actualTimeRemaining = Math.max(0, Math.ceil((redisEndTime - now) / 1000));
    }
    
    actualTimeRemaining = Math.min(actualTimeRemaining, duration);
    
    console.log(`⏰ [DEBUG] WebSocket calculated timeRemaining: ${actualTimeRemaining}s`);
    console.log(`⏰ [DEBUG] Redis stored timeRemaining: ${periodInfo.timeRemaining}s`);
    
    if (actualTimeRemaining !== periodInfo.timeRemaining) {
        console.log('\n❌ [DEBUG] ISSUE: WebSocket and Redis timeRemaining differ!');
        console.log(`❌ [DEBUG] WebSocket recalculates, Redis uses stored value`);
        console.log(`❌ [DEBUG] This could cause the stuck issue if Redis value is incorrect`);
    } else if (actualTimeRemaining === duration) {
        console.log('\n❌ [DEBUG] ISSUE: Both calculations show stuck at start time!');
    } else {
        console.log('\n✅ [DEBUG] Time calculations look consistent');
    }
    
    console.log('\n' + '='.repeat(60));
};

// Run all tests
console.log('🚀 [DEBUG] Starting new period stuck issue debugging...\n');

testTimeCalculation();
testSchedulerTimeCalculation();
testWebSocketTimeCalculation();

console.log('🏁 [DEBUG] Debugging complete!'); 