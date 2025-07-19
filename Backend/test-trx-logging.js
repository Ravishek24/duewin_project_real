const tronHashService = require('./services/tronHashService');

async function testTrxLogging() {
    try {
        console.log('🧪 Testing TRX_WIX logging with crypto money emoji...');
        
        // Test result generation
        const testResult = {
            number: 8,
            color: 'green',
            size: 'Big'
        };
        
        console.log('📋 Generating verification for test result...');
        const verification = await tronHashService.getResultWithVerification(testResult);
        
        console.log('💰 [TRX_WIX_TEST] Test verification generated:', {
            result: testResult,
            hash: verification.hash,
            link: verification.link,
            blockNumber: verification.blockNumber || 'NULL',
            resultTime: verification.resultTime || 'DEFAULT',
            timestamp: new Date().toISOString()
        });
        
        console.log('✅ Test completed! Look for the 💰 emoji in the logs above.');
        console.log('📝 When new TRX_WIX results are generated, you will see:');
        console.log('   💰 [TRX_WIX_RESULT] - When result is stored in database');
        console.log('   💰 [TRX_WIX_GAME_LOGIC] - When result is created via game logic');
        console.log('   💰 [TRX_WIX_BROADCAST] - When result is sent to clients');
        console.log('   💰 [TRX_WIX_HISTORY] - When history is retrieved');
        
    } catch (error) {
        console.error('❌ Error testing TRX_WIX logging:', error);
    }
}

// Run the test
testTrxLogging(); 