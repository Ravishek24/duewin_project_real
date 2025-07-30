const unifiedRedis = require('./config/unifiedRedisManager');

async function test5DTimingChange() {
    console.log('🚀 [5D_TIMING_CHANGE] Testing new pre-calculation timing (t=3s)...');
    
    const redis = unifiedRedis.getHelper();
    const gameType = '5d';
    const duration = 60;
    
    try {
        // Get current period info
        const periodKey = `period:${gameType}:${duration}`;
        const periodInfo = await redis.get(periodKey);
        
        if (!periodInfo) {
            console.log('❌ No current period info found');
            return;
        }
        
        const period = JSON.parse(periodInfo);
        console.log(`📅 Current period: ${period.periodId}`);
        
        // Calculate current timing
        const now = new Date();
        const endTime = new Date(period.endTime);
        const timeRemaining = Math.max(0, Math.floor((endTime - now) / 1000));
        
        console.log(`⏰ Current time: ${now.toISOString()}`);
        console.log(`🏁 Period end: ${endTime.toISOString()}`);
        console.log(`⏱️ Time remaining: ${timeRemaining}s`);
        
        // Check new timing logic
        console.log('\n🎯 NEW TIMING LOGIC:');
        console.log(`├─ Pre-calculation triggers at: t=3s`);
        console.log(`├─ Current time remaining: ${timeRemaining}s`);
        console.log(`├─ Should trigger now: ${timeRemaining === 3 ? 'YES' : 'NO'}`);
        console.log(`└─ Bet freeze at: t=5s`);
        
        // Check if pre-calculation was triggered
        const preCalcTriggerKey = `precalc_triggered_${period.periodId}`;
        const wasTriggered = await redis.exists(preCalcTriggerKey);
        
        console.log('\n🔄 Pre-calculation Status:');
        console.log(`├─ Trigger key exists: ${wasTriggered ? 'YES' : 'NO'}`);
        console.log(`└─ Trigger key: ${preCalcTriggerKey}`);
        
        // Check if result was pre-calculated
        const resultKey = `precalc_result_${gameType}_${duration}_${period.periodId}_default`;
        const resultExists = await redis.exists(resultKey);
        
        console.log('\n📈 Result Status:');
        console.log(`├─ Result key exists: ${resultExists ? 'YES' : 'NO'}`);
        console.log(`└─ Result key: ${resultKey}`);
        
        if (resultExists) {
            const resultData = await redis.get(resultKey);
            const parsed = JSON.parse(resultData);
            console.log(`├─ Calculated at: ${parsed.calculatedAt}`);
            console.log(`├─ Protection mode: ${parsed.protectionMode}`);
            console.log(`└─ Result: ${JSON.stringify(parsed.result)}`);
        }
        
        // Timing analysis
        console.log('\n💡 TIMING ANALYSIS:');
        
        if (timeRemaining > 5) {
            console.log(`├─ Period active (${timeRemaining}s remaining)`);
            console.log(`├─ Pre-calculation will trigger at t=3s`);
            console.log(`└─ Bet freeze at t=5s`);
        } else if (timeRemaining === 3) {
            console.log(`├─ ⚡ PRE-CALCULATION WINDOW (t=3s)`);
            console.log(`├─ Should trigger pre-calculation NOW`);
            console.log(`└─ Bet freeze in 2 seconds`);
        } else if (timeRemaining === 2 || timeRemaining === 1) {
            console.log(`├─ Bet freeze window (${timeRemaining}s remaining)`);
            console.log(`├─ Pre-calculation should have triggered`);
            console.log(`└─ Status: ${wasTriggered ? '✅ Triggered' : '❌ Not triggered'}`);
        } else if (timeRemaining === 0) {
            console.log(`├─ Period ended (t=0s)`);
            console.log(`├─ Pre-calculation should have completed`);
            console.log(`└─ Status: ${resultExists ? '✅ Result ready' : '❌ No result'}`);
        } else {
            console.log(`├─ Period ended (${Math.abs(timeRemaining)}s ago)`);
            console.log(`└─ Check next period`);
        }
        
        // Performance check
        if (resultExists) {
            const resultData = await redis.get(resultKey);
            const parsed = JSON.parse(resultData);
            const calculatedAt = new Date(parsed.calculatedAt);
            const calcAge = Date.now() - calculatedAt.getTime();
            
            console.log('\n⚡ PERFORMANCE CHECK:');
            console.log(`├─ Result age: ${Math.round(calcAge / 1000)}s`);
            console.log(`├─ Calculation time: ${parsed.calculatedAt}`);
            
            if (calcAge < 120000) { // 2 minutes
                console.log(`├─ ✅ Result is fresh`);
                console.log(`└─ Ready for instant delivery`);
            } else {
                console.log(`├─ ⚠️ Result is old`);
                console.log(`└─ May need recalculation`);
            }
        }
        
        // Summary
        console.log('\n📋 SUMMARY:');
        console.log(`├─ New trigger time: t=3s (was t=5s)`);
        console.log(`├─ Current time: t=${timeRemaining}s`);
        console.log(`├─ Pre-calculation triggered: ${wasTriggered ? 'Yes' : 'No'}`);
        console.log(`├─ Result available: ${resultExists ? 'Yes' : 'No'}`);
        console.log(`└─ Status: ${timeRemaining === 3 ? '⚡ TRIGGER WINDOW' : timeRemaining > 3 ? '⏳ Waiting' : '✅ Complete'}`);
        
    } catch (error) {
        console.error('❌ [5D_TIMING_CHANGE] Test failed:', error.message);
        console.error(error.stack);
    }
}

// Run the test
test5DTimingChange().then(() => {
    console.log('\n🏁 [5D_TIMING_CHANGE] Test completed');
    process.exit(0);
}).catch(error => {
    console.error('❌ [5D_TIMING_CHANGE] Test failed:', error);
    process.exit(1);
}); 