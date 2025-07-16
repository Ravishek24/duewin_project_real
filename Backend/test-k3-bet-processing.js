const { processBet } = require('./services/gameLogicService');

async function testK3BetProcessing() {
    try {
        console.log('🎲 [K3_BET_PROCESSING_TEST] Testing K3 bet processing...');
        
        // Test K3 bet data
        const k3BetData = {
            userId: 13,
            gameType: 'k3',
            duration: 60,
            periodId: 'test_k3_period_' + Date.now(),
            betType: 'SUM',
            betValue: 'Small',
            betAmount: 100,  // Changed from 'amount' to 'betAmount'
            odds: 2.0,
            timeline: 'default'
        };
        
        console.log('🎲 [K3_BET_PROCESSING_TEST] Sending K3 bet data:', k3BetData);
        
        const result = await processBet(k3BetData);
        
        console.log('🎲 [K3_BET_PROCESSING_TEST] Process result:', result);
        
        if (result.success) {
            console.log('✅ [K3_BET_PROCESSING_TEST] K3 bet processed successfully!');
        } else {
            console.log('❌ [K3_BET_PROCESSING_TEST] K3 bet processing failed:', result.message);
        }
        
    } catch (error) {
        console.error('❌ [K3_BET_PROCESSING_TEST] Error:', error);
    }
}

// Run the test
testK3BetProcessing(); 