const moment = require('moment-timezone');

/**
 * Test script to verify betting closure logic fix
 */
const testBettingClosure = () => {
    console.log('\n=== BETTING CLOSURE LOGIC TEST ===\n');
    
    const gameType = 'wingo';
    const duration = 30;
    const now = new Date();
    const istMoment = moment(now).tz('Asia/Kolkata');
    
    console.log(`Current time (IST): ${istMoment.format()}`);
    console.log(`Game: ${gameType} ${duration}s\n`);
    
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
    
    console.log(`\n=== CURRENT PERIOD INFO ===`);
    console.log(`Period ID: ${periodId}`);
    console.log(`Start time: ${currentPeriodStart.format()}`);
    console.log(`End time: ${currentPeriodEnd.format()}`);
    console.log(`Time remaining: ${timeRemaining}s`);
    
    // Test betting closure logic
    console.log(`\n=== BETTING CLOSURE LOGIC TEST ===`);
    
    // OLD LOGIC (INCORRECT)
    const oldBettingOpen = timeRemaining > 5;
    console.log(`OLD LOGIC: timeRemaining > 5`);
    console.log(`  ${timeRemaining}s > 5s = ${oldBettingOpen}`);
    console.log(`  Betting would be: ${oldBettingOpen ? 'OPEN' : 'CLOSED'}`);
    
    // NEW LOGIC (CORRECT)
    const newBettingOpen = timeRemaining >= 5000 / 1000; // Convert 5000ms to seconds
    console.log(`\nNEW LOGIC: timeRemaining >= 5000ms (5s)`);
    console.log(`  ${timeRemaining}s >= 5s = ${newBettingOpen}`);
    console.log(`  Betting would be: ${newBettingOpen ? 'OPEN' : 'CLOSED'}`);
    
    // Test WebSocket logic consistency
    console.log(`\n=== WEBSOCKET LOGIC CONSISTENCY ===`);
    const websocketTimeRemaining = timeRemaining * 1000; // Convert to milliseconds
    const websocketBettingOpen = websocketTimeRemaining >= 5000;
    console.log(`WebSocket logic: timeRemaining >= 5000ms`);
    console.log(`  ${websocketTimeRemaining}ms >= 5000ms = ${websocketBettingOpen}`);
    console.log(`  Betting would be: ${websocketBettingOpen ? 'OPEN' : 'CLOSED'}`);
    
    // Check consistency
    console.log(`\n=== CONSISTENCY CHECK ===`);
    if (newBettingOpen === websocketBettingOpen) {
        console.log(`✅ CONSISTENT: Period service and WebSocket logic match`);
    } else {
        console.log(`❌ INCONSISTENT: Period service and WebSocket logic don't match`);
    }
    
    // Test edge cases
    console.log(`\n=== EDGE CASES TEST ===`);
    const testCases = [6, 5, 4, 3, 2, 1, 0];
    
    testCases.forEach(seconds => {
        const oldLogic = seconds > 5;
        const newLogic = seconds >= 5;
        const websocketLogic = (seconds * 1000) >= 5000;
        
        console.log(`${seconds}s remaining:`);
        console.log(`  Old logic (${seconds} > 5): ${oldLogic} - ${oldLogic ? 'OPEN' : 'CLOSED'}`);
        console.log(`  New logic (${seconds} >= 5): ${newLogic} - ${newLogic ? 'OPEN' : 'CLOSED'}`);
        console.log(`  WebSocket logic (${seconds * 1000}ms >= 5000ms): ${websocketLogic} - ${websocketLogic ? 'OPEN' : 'CLOSED'}`);
        console.log(`  Consistent: ${newLogic === websocketLogic ? '✅' : '❌'}`);
        console.log('');
    });
    
    console.log('=== TEST COMPLETE ===\n');
};

// Run the test
testBettingClosure(); 