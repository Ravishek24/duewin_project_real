// Backend/utils/websocketDebugHelper.js - Debug utility for testing WebSocket periods

const moment = require('moment-timezone');

/**
 * Debug function to test period calculations
 * @param {string} gameType - Game type  
 * @param {number} duration - Duration in seconds
 * @param {Date} testTime - Time to test (optional, defaults to now)
 */
const debugPeriodCalculation = (gameType, duration, testTime = new Date()) => {
    console.log('\n=== WEBSOCKET PERIOD DEBUG ===');
    console.log(`Game: ${gameType}, Duration: ${duration}s`);
    console.log(`Test Time: ${testTime.toISOString()}`);
    
    const istMoment = moment(testTime).tz('Asia/Kolkata');
    console.log(`IST Time: ${istMoment.format()}`);
    
    // Calculate time since 2 AM today
    let startOfPeriods = istMoment.clone().hour(2).minute(0).second(0).millisecond(0);
    
    // If current time is before 2 AM, use 2 AM of previous day
    if (istMoment.hour() < 2) {
        startOfPeriods.subtract(1, 'day');
        console.log('Before 2 AM, using previous day');
    }
    
    console.log(`Start of periods: ${startOfPeriods.format()}`);
    
    // Calculate total seconds since period start
    const totalSeconds = istMoment.diff(startOfPeriods, 'seconds');
    console.log(`Total seconds since start: ${totalSeconds}`);
    
    // Calculate current period number (0-based)
    const currentPeriodNumber = Math.floor(totalSeconds / duration);
    console.log(`Current period number: ${currentPeriodNumber}`);
    
    // Calculate when current period started
    const currentPeriodStart = startOfPeriods.clone().add(currentPeriodNumber * duration, 'seconds');
    console.log(`Current period start: ${currentPeriodStart.format()}`);
    
    // Calculate when current period ends
    const currentPeriodEnd = currentPeriodStart.clone().add(duration, 'seconds');
    console.log(`Current period end: ${currentPeriodEnd.format()}`);
    
    // Calculate time remaining in current period
    const timeRemaining = Math.max(0, currentPeriodEnd.diff(istMoment, 'seconds'));
    console.log(`Time remaining: ${timeRemaining}s`);
    
    // Generate period ID
    const dateStr = startOfPeriods.format('YYYYMMDD');
    const periodId = `${dateStr}${currentPeriodNumber.toString().padStart(9, '0')}`;
    console.log(`Period ID: ${periodId}`);
    
    console.log(`Betting open: ${timeRemaining > 5}`);
    console.log('=== END DEBUG ===\n');
    
    return {
        periodId,
        timeRemaining,
        currentPeriodStart: currentPeriodStart.toDate(),
        currentPeriodEnd: currentPeriodEnd.toDate(),
        bettingOpen: timeRemaining > 5,
        active: timeRemaining > 0
    };
};

/**
 * Test multiple time scenarios
 */
const testMultipleScenarios = () => {
    console.log('\n🧪 TESTING MULTIPLE SCENARIOS FOR 1-MINUTE WINGO');
    
    const gameType = 'wingo';
    const duration = 60; // 1 minute
    
    // Test scenarios
    const scenarios = [
        { description: '31 seconds into period', secondsInto: 31 },
        { description: '59 seconds into period', secondsInto: 59 },
        { description: '5 seconds into period', secondsInto: 5 },
        { description: '30 seconds into period', secondsInto: 30 },
        { description: '55 seconds into period (betting closed)', secondsInto: 55 }
    ];
    
    const now = new Date();
    const istNow = moment(now).tz('Asia/Kolkata');
    
    // Calculate current period start
    let startOfPeriods = istNow.clone().hour(2).minute(0).second(0).millisecond(0);
    if (istNow.hour() < 2) {
        startOfPeriods.subtract(1, 'day');
    }
    
    const totalSeconds = istNow.diff(startOfPeriods, 'seconds');
    const currentPeriodNumber = Math.floor(totalSeconds / duration);
    const currentPeriodStart = startOfPeriods.clone().add(currentPeriodNumber * duration, 'seconds');
    
    scenarios.forEach(scenario => {
        console.log(`\n--- ${scenario.description} ---`);
        
        // Create test time
        const testTime = currentPeriodStart.clone().add(scenario.secondsInto, 'seconds').toDate();
        
        const result = debugPeriodCalculation(gameType, duration, testTime);
        
        console.log(`✅ Expected remaining: ${60 - scenario.secondsInto}s`);
        console.log(`✅ Actual remaining: ${result.timeRemaining}s`);
        console.log(`✅ Match: ${result.timeRemaining === (60 - scenario.secondsInto) ? 'YES' : 'NO'}`);
    });
};

/**
 * Continuous monitoring function
 */
const startContinuousMonitoring = (gameType, duration, intervalSeconds = 5) => {
    console.log(`\n🔄 Starting continuous monitoring for ${gameType} ${duration}s (every ${intervalSeconds}s)`);
    
    const interval = setInterval(() => {
        const result = debugPeriodCalculation(gameType, duration);
        
        console.log(`📊 Period: ${result.periodId}, Remaining: ${result.timeRemaining}s, Betting: ${result.bettingOpen ? 'OPEN' : 'CLOSED'}`);
        
        // Stop if period changes (for demonstration)
        if (result.timeRemaining < 10) {
            console.log('🔚 Period ending soon, stopping monitor');
            clearInterval(interval);
        }
    }, intervalSeconds * 1000);
    
    return interval;
};

module.exports = {
    debugPeriodCalculation,
    testMultipleScenarios,
    startContinuousMonitoring
};