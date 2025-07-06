const gameLogicService = require('./services/gameLogicService');

async function testManualResult() {
    try {
        console.log('🎲 [MANUAL_TEST] Starting manual result processing test...');
        
        // Use the exact period ID from your logs
        const gameType = 'wingo';
        const duration = 30;
        const periodId = '20250706000000252'; // From your logs
        const timeline = 'default';
        
        console.log('🎲 [MANUAL_TEST] Processing period:', {
            gameType,
            duration,
            periodId,
            timeline
        });
        
        // Check if period has ended
        const periodEndTime = gameLogicService.calculatePeriodEndTime(periodId, duration);
        const now = new Date();
        const timeSinceEnd = (now - periodEndTime) / 1000;
        
        console.log('⏰ [MANUAL_TEST] Period timing check:', {
            periodEndTime: periodEndTime.toISOString(),
            currentTime: now.toISOString(),
            timeSinceEnd: timeSinceEnd.toFixed(2) + 's',
            shouldProcess: timeSinceEnd >= -5
        });
        
        if (timeSinceEnd < -5) {
            console.log('⚠️ [MANUAL_TEST] Period hasn\'t ended yet, but forcing processing for testing...');
        }
        
        // Manually trigger result processing
        console.log('🎲 [MANUAL_TEST] Calling processGameResults...');
        const result = await gameLogicService.processGameResults(
            gameType, 
            duration, 
            periodId, 
            timeline
        );
        
        console.log('✅ [MANUAL_TEST] Result processing completed:', {
            success: result.success,
            source: result.source,
            protectionMode: result.protectionMode,
            protectionReason: result.protectionReason,
            result: result.gameResult,
            winnersCount: result.winners ? result.winners.length : 0
        });
        
        if (result.success) {
            console.log('🎯 [MANUAL_TEST] Final result:', result.gameResult);
            console.log('👥 [MANUAL_TEST] Winners:', result.winners ? result.winners.length : 0);
        } else {
            console.log('❌ [MANUAL_TEST] Result processing failed:', result.message);
        }
        
    } catch (error) {
        console.error('❌ [MANUAL_TEST] Error in manual result processing:', error);
        console.error('Stack trace:', error.stack);
    }
}

// Run the test
testManualResult()
    .then(() => {
        console.log('✅ [MANUAL_TEST] Test completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ [MANUAL_TEST] Test failed:', error);
        process.exit(1);
    }); 