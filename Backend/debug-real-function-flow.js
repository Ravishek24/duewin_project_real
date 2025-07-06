// Real Function Flow Test Script
// Tests using actual functions from gameLogicService.js

const path = require('path');

// Import real functions from gameLogicService
let gameLogicService;
try {
    gameLogicService = require('./services/gameLogicService.js');
    console.log('✅ Successfully imported gameLogicService');
} catch (error) {
    console.error('❌ Failed to import gameLogicService:', error.message);
    process.exit(1);
}

// Mock database models
const mockModels = {
    User: {
        increment: async (field, options) => {
            console.log('🔄 Mock User.increment called:', { field, options });
            return true;
        }
    },
    BetRecordWingo: {
        findAll: async (options) => {
            console.log('🔄 Mock BetRecordWingo.findAll called with:', options);
            
            // Return our test bet
            const mockBet = {
                user_id: 13,
                bet_type: 'COLOR:red',
                bet_amount: 100.00000000,
                amount_after_tax: 98.00000000,
                wallet_balance_before: 5000.00000000,
                bet_id: 'test_bet_001',
                odds: 2.0,
                update: async function(data, options) {
                    console.log('🔄 Mock bet.update called with:', data);
                    Object.assign(this, data);
                    return this;
                }
            };
            
            return [mockBet];
        }
    }
};

// Main test function using real functions
async function testRealFunctionFlow() {
    try {
        console.log('🚀 REAL FUNCTION FLOW TEST');
        console.log('==========================================');
        console.log('🎯 Testing ACTUAL gameLogicService functions');
        console.log('');
        
        // Test parameters
        const gameType = 'wingo';
        const duration = 30;
        const periodId = '20250706000001881';
        const timeline = 'default';
        
        // Test bet data
        const testBet = {
            user_id: 13,
            bet_type: 'COLOR:red',
            betAmount: 100,
            amount_after_tax: 98,
            netBetAmount: 98,
            wallet_balance_before: 5000
        };
        
        console.log('📋 Test setup:', {
            gameType, duration, periodId, timeline,
            testBet: testBet
        });
        console.log('');
        
        // STEP 1: Test updateBetExposure (real function)
        console.log('📊 [STEP 1] TESTING REAL updateBetExposure');
        console.log('==========================================');
        
        try {
            // Note: This function might need Redis, so we'll catch errors
            await gameLogicService.updateBetExposure(gameType, duration, periodId, testBet, timeline);
            console.log('✅ updateBetExposure completed successfully');
        } catch (error) {
            console.log('⚠️ updateBetExposure failed (expected if Redis not available):', error.message);
        }
        
        // STEP 2: Test getUniqueUserCount (real function)
        console.log('\n👥 [STEP 2] TESTING REAL getUniqueUserCount');
        console.log('==========================================');
        
        try {
            const userCountResult = await gameLogicService.getUniqueUserCount(gameType, duration, periodId, timeline);
            console.log('✅ getUniqueUserCount result:', userCountResult);
        } catch (error) {
            console.log('⚠️ getUniqueUserCount failed:', error.message);
        }
        
        // STEP 3: Test selectProtectedResultWithExposure (real function)
        console.log('\n🛡️ [STEP 3] TESTING REAL selectProtectedResultWithExposure');
        console.log('==========================================');
        
        try {
            const protectedResult = await gameLogicService.selectProtectedResultWithExposure(gameType, duration, periodId, timeline);
            console.log('✅ selectProtectedResultWithExposure result:', protectedResult);
        } catch (error) {
            console.log('⚠️ selectProtectedResultWithExposure failed:', error.message);
        }
        
        // STEP 4: Test checkBetWin with a known scenario (real function)
        console.log('\n🎯 [STEP 4] TESTING REAL checkBetWin');
        console.log('==========================================');
        
        // Create a test result that should make the RED bet lose
        const testResult = {
            number: 3,  // Green number
            color: 'green',
            size: 'Small',
            parity: 'odd'
        };
        
        const testBetForWinCheck = {
            bet_type: 'COLOR:red',
            user_id: 13,
            bet_amount: 100
        };
        
        console.log('🔍 Testing checkBetWin with:');
        console.log('   Bet:', testBetForWinCheck);
        console.log('   Result:', testResult);
        console.log('   Expected: FALSE (RED bet vs GREEN result)');
        
        try {
            const winResult = await gameLogicService.checkBetWin(testBetForWinCheck, testResult, gameType);
            console.log('✅ checkBetWin result:', winResult);
            
            if (winResult === false) {
                console.log('✅ CORRECT: checkBetWin correctly returned FALSE');
            } else {
                console.log('❌ BUG FOUND: checkBetWin returned TRUE when it should be FALSE!');
            }
        } catch (error) {
            console.log('❌ checkBetWin failed:', error.message);
            console.log('Stack:', error.stack);
        }
        
        // STEP 5: Test processWinningBets (real function) - with mocked models
        console.log('\n💰 [STEP 5] TESTING REAL processWinningBets');
        console.log('==========================================');
        
        // Temporarily replace models
        const originalModels = gameLogicService.models;
        if (gameLogicService.models) {
            gameLogicService.models = mockModels;
        }
        
        try {
            const winningBetsResult = await gameLogicService.processWinningBets(
                gameType, duration, periodId, testResult, null
            );
            console.log('✅ processWinningBets result:', winningBetsResult);
        } catch (error) {
            console.log('⚠️ processWinningBets failed:', error.message);
            console.log('Stack:', error.stack);
        } finally {
            // Restore original models
            if (originalModels) {
                gameLogicService.models = originalModels;
            }
        }
        
        // STEP 6: Test individual win calculation functions
        console.log('\n🔢 [STEP 6] TESTING REAL calculateWingoWin');
        console.log('==========================================');
        
        const testBetForCalc = {
            betAmount: 98,
            bet_amount: 98
        };
        
        try {
            const winAmount = gameLogicService.calculateWingoWin(testBetForCalc, testResult, 'COLOR', 'red');
            console.log('✅ calculateWingoWin result:', winAmount);
            
            if (winAmount === 0) {
                console.log('✅ CORRECT: calculateWingoWin returned 0 (no win)');
            } else {
                console.log('❌ BUG FOUND: calculateWingoWin returned', winAmount, 'when it should be 0!');
            }
        } catch (error) {
            console.log('❌ calculateWingoWin failed:', error.message);
        }
        
        // STEP 7: Test the odds calculation
        console.log('\n⚖️ [STEP 7] TESTING REAL calculateOdds');
        console.log('==========================================');
        
        try {
            const odds = gameLogicService.calculateOdds(gameType, 'COLOR', 'red');
            console.log('✅ calculateOdds result:', odds);
        } catch (error) {
            console.log('⚠️ calculateOdds failed:', error.message);
        }
        
        console.log('\n📊 [FINAL ANALYSIS]');
        console.log('==========================================');
        console.log('🎯 This test calls the ACTUAL production functions');
        console.log('🎯 Any bugs found here exist in the real system');
        console.log('🎯 Compare with our simulation to find differences');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
    }
}

// Run the test
testRealFunctionFlow().then(() => {
    console.log('\n✅ Real function flow test finished');
    process.exit(0);
}).catch(error => {
    console.error('❌ Test error:', error);
    process.exit(1);
}); 