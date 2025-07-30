const unifiedRedis = require('./config/unifiedRedisManager');

async function diagnose5DTiming() {
    console.log('🔍 [5D_TIMING_DIAGNOSTIC] Starting 5D timing diagnosis...');
    
    const redis = unifiedRedis.getHelper();
    const gameType = '5d';
    const duration = 60;
    
    try {
        // Get current period info
        console.log('\n📊 Current Period Analysis:');
        
        const periodKey = `period:${gameType}:${duration}`;
        const periodInfo = await redis.get(periodKey);
        
        if (!periodInfo) {
            console.log('❌ No current period info found');
            return;
        }
        
        const period = JSON.parse(periodInfo);
        console.log(`📅 Current period: ${period.periodId}`);
        console.log(`⏰ Start time: ${period.startTime}`);
        console.log(`🏁 End time: ${period.endTime}`);
        
        // Calculate current timing
        const now = new Date();
        const endTime = new Date(period.endTime);
        const timeRemaining = Math.max(0, Math.floor((endTime - now) / 1000));
        
        console.log(`⏰ Current time: ${now.toISOString()}`);
        console.log(`🏁 Period end: ${endTime.toISOString()}`);
        console.log(`⏱️ Time remaining: ${timeRemaining}s`);
        
        // Check if we're in the pre-calculation window
        const inPreCalcWindow = timeRemaining === 3;
        const shouldPreCalc = timeRemaining === 3;
        
        console.log(`\n🎯 Pre-calculation Status:`);
        console.log(`├─ In pre-calc window (t=3s): ${inPreCalcWindow ? 'YES' : 'NO'}`);
        console.log(`├─ Should pre-calc (t=3s): ${shouldPreCalc ? 'YES' : 'NO'}`);
        console.log(`└─ Time remaining: ${timeRemaining}s`);
        
        // Check if pre-calculation was triggered
        const preCalcTriggerKey = `precalc_triggered_${period.periodId}`;
        const wasTriggered = await redis.exists(preCalcTriggerKey);
        
        console.log(`\n🔄 Pre-calculation Trigger Status:`);
        console.log(`├─ Trigger key exists: ${wasTriggered ? 'YES' : 'NO'}`);
        console.log(`└─ Trigger key: ${preCalcTriggerKey}`);
        
        // Check if result was pre-calculated
        const resultKey = `precalc_result_${gameType}_${duration}_${period.periodId}_default`;
        const resultExists = await redis.exists(resultKey);
        
        console.log(`\n📈 Pre-calculation Result Status:`);
        console.log(`├─ Result key exists: ${resultExists ? 'YES' : 'NO'}`);
        console.log(`└─ Result key: ${resultKey}`);
        
        if (resultExists) {
            const resultData = await redis.get(resultKey);
            const parsed = JSON.parse(resultData);
            console.log(`├─ Calculated at: ${parsed.calculatedAt}`);
            console.log(`├─ Protection mode: ${parsed.protectionMode}`);
            console.log(`└─ Result: ${JSON.stringify(parsed.result)}`);
        }
        
        // Check for any stuck locks
        const lockKey = `precalc_lock_${gameType}_${duration}_${period.periodId}_default`;
        const lockExists = await redis.exists(lockKey);
        
        console.log(`\n🔒 Lock Status:`);
        console.log(`├─ Lock exists: ${lockExists ? 'YES' : 'NO'}`);
        console.log(`└─ Lock key: ${lockKey}`);
        
        if (lockExists) {
            const lockTTL = await redis.ttl(lockKey);
            const lockValue = await redis.get(lockKey);
            console.log(`├─ Lock TTL: ${lockTTL}s`);
            console.log(`└─ Lock value: ${lockValue}`);
            
            if (lockTTL > 25) {
                console.log('⚠️ WARNING: Lock has high TTL - might be stuck!');
            }
        }
        
        // Check websocket broadcast timing
        console.log(`\n📡 WebSocket Broadcast Analysis:`);
        
        // Check if broadcast tick is running
        const broadcastKey = `broadcast_tick_${gameType}_${duration}`;
        const broadcastExists = await redis.exists(broadcastKey);
        console.log(`├─ Broadcast tick active: ${broadcastExists ? 'YES' : 'NO'}`);
        
        // Check event sequencer
        console.log(`\n🎭 Event Sequencer Analysis:`);
        
        // Check for any processed events
        const processedEvents = await redis.keys(`*${period.periodId}*`);
        console.log(`├─ Related keys: ${processedEvents.length}`);
        
        for (const key of processedEvents) {
            const ttl = await redis.ttl(key);
            console.log(`├─ ${key}: TTL=${ttl}s`);
        }
        
        // Timing recommendations
        console.log(`\n💡 Timing Recommendations:`);
        
                 if (timeRemaining > 10) {
             console.log(`├─ Period is still active (${timeRemaining}s remaining)`);
             console.log(`├─ Pre-calculation should trigger at t=3s`);
             console.log(`└─ Current status: Waiting for pre-calculation window`);
         } else if (timeRemaining === 3) {
            console.log(`├─ In pre-calculation window (${timeRemaining}s remaining)`);
            if (!wasTriggered) {
                console.log(`├─ ⚠️ Pre-calculation not triggered yet!`);
                console.log(`└─ Should trigger immediately`);
            } else {
                console.log(`├─ ✅ Pre-calculation triggered`);
                if (!resultExists) {
                    console.log(`├─ ⚠️ Result not calculated yet`);
                    console.log(`└─ Check for calculation errors`);
                } else {
                    console.log(`├─ ✅ Result pre-calculated`);
                    console.log(`└─ Ready for instant delivery at t=0`);
                }
            }
        } else if (timeRemaining === 0) {
            console.log(`├─ Period ended (t=0)`);
            if (resultExists) {
                console.log(`├─ ✅ Pre-calculated result available`);
                console.log(`└─ Should be delivered instantly`);
            } else {
                console.log(`├─ ⚠️ No pre-calculated result`);
                console.log(`└─ Will use real-time calculation (slower)`);
            }
        } else {
            console.log(`├─ Period has ended (${timeRemaining}s ago)`);
            console.log(`└─ Check next period`);
        }
        
        // Performance analysis
        console.log(`\n⚡ Performance Analysis:`);
        
        if (resultExists) {
            const resultData = await redis.get(resultKey);
            const parsed = JSON.parse(resultData);
            const calculatedAt = new Date(parsed.calculatedAt);
            const calcAge = Date.now() - calculatedAt.getTime();
            
            console.log(`├─ Result age: ${Math.round(calcAge / 1000)}s`);
            console.log(`├─ Calculation time: ${parsed.calculatedAt}`);
            
            if (calcAge < 120000) { // 2 minutes
                console.log(`├─ ✅ Result is fresh`);
                console.log(`└─ Ready for instant delivery`);
            } else {
                console.log(`├─ ⚠️ Result is old`);
                console.log(`└─ May need recalculation`);
            }
        } else {
            console.log(`├─ No pre-calculated result`);
            console.log(`└─ Will use real-time calculation`);
        }
        
    } catch (error) {
        console.error('❌ [5D_TIMING_DIAGNOSTIC] Diagnosis failed:', error.message);
        console.error(error.stack);
    }
}

// Run diagnosis
diagnose5DTiming().then(() => {
    console.log('\n🏁 [5D_TIMING_DIAGNOSTIC] Diagnosis completed');
    process.exit(0);
}).catch(error => {
    console.error('❌ [5D_TIMING_DIAGNOSTIC] Diagnosis failed:', error);
    process.exit(1);
}); 