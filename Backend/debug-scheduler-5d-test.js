const gameLogicService = require('./services/gameLogicService');

async function testScheduler5D() {
    try {
        console.log('🔍 [SCHEDULER_5D_TEST] Starting scheduler 5D test...');
        
        // Initialize models
        await gameLogicService.ensureModelsInitialized();
        console.log('✅ [SCHEDULER_5D_TEST] Models initialized');
        
        // Test the exact same call that the scheduler makes
        const gameType = 'fiveD'; // This is what GAME_CONFIGS has
        const duration = 60;
        const periodId = '20250803000000133'; // Use the same period from our debug
        
        console.log(`🎯 [SCHEDULER_5D_TEST] Testing scheduler call for:`, {
            gameType,
            duration,
            periodId,
            gameTypeLowercase: gameType.toLowerCase(),
            is5D: ['5d', 'fived'].includes(gameType.toLowerCase())
        });
        
        // Test the exact condition from scheduler
        if (['5d', 'fived'].includes(gameType.toLowerCase())) {
            console.log(`🎯 [SCHEDULER_5D_TEST] Condition passed - calling processGameResultsWithPreCalc`);
            
            const result = await gameLogicService.processGameResultsWithPreCalc(
                gameType, 
                duration, 
                periodId,
                'default'
            );
            
            console.log(`🎯 [SCHEDULER_5D_TEST] processGameResultsWithPreCalc completed:`, {
                success: result.success,
                source: result.source,
                winnersCount: result.winners?.length || 0,
                hasGameResult: !!result.gameResult,
                gameResultKeys: result.gameResult ? Object.keys(result.gameResult) : []
            });
            
            return result;
        } else {
            console.log(`🎯 [SCHEDULER_5D_TEST] Condition failed - would call processGameResults`);
            
            const result = await gameLogicService.processGameResults(
                gameType, 
                duration, 
                periodId,
                'default'
            );
            
            console.log(`🎯 [SCHEDULER_5D_TEST] processGameResults completed:`, {
                success: result.success,
                source: result.source,
                winnersCount: result.winners?.length || 0
            });
            
            return result;
        }
        
    } catch (error) {
        console.error('❌ [SCHEDULER_5D_TEST] Error:', error);
        throw error;
    }
}

testScheduler5D().then(() => {
    console.log('✅ [SCHEDULER_5D_TEST] Test completed');
    process.exit(0);
}).catch((error) => {
    console.error('❌ [SCHEDULER_5D_TEST] Test failed:', error);
    process.exit(1);
}); 