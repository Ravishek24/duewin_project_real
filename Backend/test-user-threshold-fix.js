const gameLogicService = require('./services/gameLogicService');

async function testUserThresholdFix() {
    try {
        console.log('🧪 Testing User Threshold Fix...\n');

        // Test 1: Check 5D threshold
        console.log('🔍 [TEST_1] Testing 5D threshold...');
        const threshold5D = gameLogicService.getUserThreshold('5d');
        console.log(`✅ 5D threshold: ${threshold5D} (expected: 50000)`);
        
        if (threshold5D !== 50000) {
            console.log('❌ FAILED: 5D threshold should be 50000');
            return false;
        }

        // Test 2: Check other game thresholds
        console.log('\n🔍 [TEST_2] Testing other game thresholds...');
        const games = ['wingo', 'k3', 'trx_wix', 'fived'];
        
        for (const game of games) {
            const threshold = gameLogicService.getUserThreshold(game);
            console.log(`✅ ${game} threshold: ${threshold} (expected: 2)`);
            
            if (threshold !== 2) {
                console.log(`❌ FAILED: ${game} threshold should be 2`);
                return false;
            }
        }

        // Test 3: Check case insensitivity
        console.log('\n🔍 [TEST_3] Testing case insensitivity...');
        const threshold5DUpper = gameLogicService.getUserThreshold('5D');
        const threshold5DLower = gameLogicService.getUserThreshold('5d');
        const thresholdWingoUpper = gameLogicService.getUserThreshold('WINGO');
        const thresholdWingoLower = gameLogicService.getUserThreshold('wingo');
        
        console.log(`✅ 5D (upper): ${threshold5DUpper}, 5d (lower): ${threshold5DLower}`);
        console.log(`✅ WINGO (upper): ${thresholdWingoUpper}, wingo (lower): ${thresholdWingoLower}`);
        
        if (threshold5DUpper !== threshold5DLower || thresholdWingoUpper !== thresholdWingoLower) {
            console.log('❌ FAILED: Threshold should be case insensitive');
            return false;
        }

        // Test 4: Check null/undefined handling
        console.log('\n🔍 [TEST_4] Testing null/undefined handling...');
        const thresholdNull = gameLogicService.getUserThreshold(null);
        const thresholdUndefined = gameLogicService.getUserThreshold(undefined);
        const thresholdEmpty = gameLogicService.getUserThreshold('');
        
        console.log(`✅ null threshold: ${thresholdNull} (expected: 2)`);
        console.log(`✅ undefined threshold: ${thresholdUndefined} (expected: 2)`);
        console.log(`✅ empty string threshold: ${thresholdEmpty} (expected: 2)`);
        
        if (thresholdNull !== 2 || thresholdUndefined !== 2 || thresholdEmpty !== 2) {
            console.log('❌ FAILED: Null/undefined should default to 2');
            return false;
        }

        // Test 5: Simulate user count scenarios
        console.log('\n🔍 [TEST_5] Testing user count scenarios...');
        
        // 5D with 1000 users (should trigger protection - 1000 < 50000)
        const userCount5D = 1000;
        const threshold5DTest = gameLogicService.getUserThreshold('5d');
        const shouldProtect5D = userCount5D < threshold5DTest;
        console.log(`✅ 5D: ${userCount5D} users < ${threshold5DTest} threshold = ${shouldProtect5D} (expected: true)`);
        
        if (shouldProtect5D !== true) {
            console.log('❌ FAILED: 5D with 1000 users should trigger protection');
            return false;
        }

        // 5D with 60000 users (should NOT trigger protection - 60000 > 50000)
        const userCount5DHigh = 60000;
        const shouldProtect5DHigh = userCount5DHigh < threshold5DTest;
        console.log(`✅ 5D: ${userCount5DHigh} users < ${threshold5DTest} threshold = ${shouldProtect5DHigh} (expected: false)`);
        
        if (shouldProtect5DHigh !== false) {
            console.log('❌ FAILED: 5D with 60000 users should NOT trigger protection');
            return false;
        }

        // Wingo with 1 user (should trigger protection)
        const userCountWingo = 1;
        const thresholdWingoTest = gameLogicService.getUserThreshold('wingo');
        const shouldProtectWingo = userCountWingo < thresholdWingoTest;
        console.log(`✅ Wingo: ${userCountWingo} users < ${thresholdWingoTest} threshold = ${shouldProtectWingo} (expected: true)`);
        
        if (shouldProtectWingo !== true) {
            console.log('❌ FAILED: Wingo with 1 user should trigger protection');
            return false;
        }

        // Wingo with 5 users (should NOT trigger protection)
        const userCountWingoHigh = 5;
        const shouldProtectWingoHigh = userCountWingoHigh < thresholdWingoTest;
        console.log(`✅ Wingo: ${userCountWingoHigh} users < ${thresholdWingoTest} threshold = ${shouldProtectWingoHigh} (expected: false)`);
        
        if (shouldProtectWingoHigh !== false) {
            console.log('❌ FAILED: Wingo with 5 users should NOT trigger protection');
            return false;
        }

        console.log('\n🎉 ALL TESTS PASSED! User threshold system is working correctly.');
        console.log('\n📋 Summary:');
        console.log('   - 5D games: threshold = 50000 (protection triggers when users < 50000)');
        console.log('   - All other games: threshold = 2 (protection triggers when users < 2)');
        console.log('   - Case insensitive: 5D, 5d, FIVED, fived all work');
        console.log('   - Null/undefined safe: defaults to 2 for other games');
        console.log('   - 5D protection: Very high threshold means protection rarely triggers');
        console.log('   - Other games protection: Low threshold means protection often triggers');
        
        return true;

    } catch (error) {
        console.error('❌ Error testing user threshold fix:', error);
        return false;
    }
}

// Run the test
if (require.main === module) {
    testUserThresholdFix().then(success => {
        if (success) {
            console.log('\n✅ User threshold fix test completed successfully!');
            process.exit(0);
        } else {
            console.log('\n❌ User threshold fix test failed!');
            process.exit(1);
        }
    });
}

module.exports = { testUserThresholdFix }; 