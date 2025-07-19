const gameLogicService = require('./services/gameLogicService');
const tronHashService = require('./services/tronHashService');

async function debugResultGeneration() {
    try {
        console.log('🧪 Debugging TRX_WIX result generation...');
        
        // Test 1: Direct tronHashService call
        console.log('\n📋 Test 1: Direct tronHashService.getResultWithVerification()');
        const testResult = {
            number: 7,
            color: 'green',
            size: 'Small'
        };
        
        const verification = await tronHashService.getResultWithVerification(testResult, 30);
        console.log('✅ Direct verification result:', {
            hash: verification.hash,
            link: verification.link,
            blockNumber: verification.blockNumber,
            resultTime: verification.resultTime
        });
        
        // Test 2: Game logic service result calculation
        console.log('\n📋 Test 2: Game logic service calculateResultWithVerification()');
        const gameResult = await gameLogicService.calculateResultWithVerification('trx_wix', 30, 'TEST_PERIOD_' + Date.now());
        console.log('✅ Game logic result:', {
            result: gameResult.result,
            verification: gameResult.verification,
            protectionMode: gameResult.protectionMode
        });
        
        // Test 3: Check if verification has block number
        if (gameResult.verification) {
            console.log('\n📋 Test 3: Verification object analysis');
            console.log('Verification object keys:', Object.keys(gameResult.verification));
            console.log('Block number present:', !!gameResult.verification.blockNumber);
            console.log('Result time present:', !!gameResult.verification.resultTime);
            console.log('Full verification:', gameResult.verification);
        }
        
        console.log('\n🎯 Summary:');
        console.log('- If Test 1 shows block numbers, tronHashService is working');
        console.log('- If Test 2 shows block numbers, game logic is working');
        console.log('- If both work but API doesn\'t show them, there\'s a storage issue');
        
    } catch (error) {
        console.error('❌ Error debugging result generation:', error);
    }
}

// Run the debug
debugResultGeneration(); 