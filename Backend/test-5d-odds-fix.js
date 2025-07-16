const gameLogicService = require('./services/gameLogicService');

async function test5DOddsFix() {
    try {
        console.log('🎯 [5D_ODDS_FIX_TEST] ==========================================');
        console.log('🎯 [5D_ODDS_FIX_TEST] Testing 5D Position Bet Odds Fix');
        console.log('🎯 [5D_ODDS_FIX_TEST] ==========================================');

        // Test scenario: User bets on A_1 and wins
        const testBet = {
            betType: 'POSITION',
            betValue: 'A_1',
            betAmount: 100,
            amount_after_tax: 98, // After 2% tax
            odds: 9.0
        };

        const testResult = {
            A: 1,  // User wins because A = 1
            B: 2,
            C: 4,
            D: 6,
            E: 5,
            sum: 18
        };

        console.log('\n💰 [5D_TEST_SCENARIO] Test Scenario:');
        console.log(`   - Bet Type: ${testBet.betType}`);
        console.log(`   - Bet Value: ${testBet.betValue}`);
        console.log(`   - Bet Amount: ₹${testBet.betAmount}`);
        console.log(`   - Amount After Tax: ₹${testBet.amount_after_tax}`);
        console.log(`   - Expected Odds: ${testBet.odds}x`);
        console.log(`   - Result: A=${testResult.A}, B=${testResult.B}, C=${testResult.C}, D=${testResult.D}, E=${testResult.E}`);

        // Step 1: Test win condition check
        console.log('\n🎯 [5D_WIN_CHECK] Testing win condition...');
        const isWinner = gameLogicService.checkFiveDWin(testBet.betType, testBet.betValue, testResult);
        console.log(`🎯 [5D_WIN_CHECK] Bet wins: ${isWinner ? '✅ YES' : '❌ NO'}`);

        if (!isWinner) {
            console.log('❌ [5D_WIN_CHECK] FAILURE: Bet should win but didn\'t!');
            return;
        }

        // Step 2: Test payout calculation
        console.log('\n💰 [5D_PAYOUT_TEST] Testing payout calculation...');
        const payout = gameLogicService.calculateFiveDWin(testBet, testResult, testBet.betType, testBet.betValue);
        console.log(`💰 [5D_PAYOUT_TEST] Calculated payout: ₹${payout.toFixed(2)}`);

        // Step 3: Verify correct payout
        const expectedPayout = testBet.amount_after_tax * 9.0; // 9x payout
        console.log(`💰 [5D_PAYOUT_TEST] Expected payout: ₹${expectedPayout.toFixed(2)} (${testBet.odds}x)`);

        if (Math.abs(payout - expectedPayout) < 0.01) {
            console.log('✅ [5D_PAYOUT_SUCCESS] SUCCESS: Payout is correct (9x)');
        } else {
            console.log('❌ [5D_PAYOUT_FAILURE] FAILURE: Payout is incorrect!');
            console.log(`❌ [5D_PAYOUT_FAILURE] Expected: ₹${expectedPayout.toFixed(2)}, Got: ₹${payout.toFixed(2)}`);
        }

        // Step 4: Test odds calculation
        console.log('\n📊 [5D_ODDS_TEST] Testing odds calculation...');
        const calculatedOdds = gameLogicService.calculateOdds('5d', testBet.betType, testBet.betValue);
        console.log(`📊 [5D_ODDS_TEST] Calculated odds: ${calculatedOdds}x`);

        if (calculatedOdds === 9.0) {
            console.log('✅ [5D_ODDS_SUCCESS] SUCCESS: Odds calculation is correct (9x)');
        } else {
            console.log('❌ [5D_ODDS_FAILURE] FAILURE: Odds calculation is incorrect!');
            console.log(`❌ [5D_ODDS_FAILURE] Expected: 9.0x, Got: ${calculatedOdds}x`);
        }

        // Step 5: Test losing scenario
        console.log('\n💔 [5D_LOSE_TEST] Testing losing scenario...');
        const losingResult = {
            A: 0,  // User loses because A = 0, not 1
            B: 2,
            C: 4,
            D: 6,
            E: 5,
            sum: 17
        };

        const isLoser = gameLogicService.checkFiveDWin(testBet.betType, testBet.betValue, losingResult);
        const losingPayout = gameLogicService.calculateFiveDWin(testBet, losingResult, testBet.betType, testBet.betValue);

        console.log(`💔 [5D_LOSE_TEST] Bet wins: ${isLoser ? '❌ YES (should lose)' : '✅ NO (correctly loses)'}`);
        console.log(`💔 [5D_LOSE_TEST] Losing payout: ₹${losingPayout.toFixed(2)} (should be ₹0.00)`);

        if (!isLoser && losingPayout === 0) {
            console.log('✅ [5D_LOSE_SUCCESS] SUCCESS: Losing scenario works correctly');
        } else {
            console.log('❌ [5D_LOSE_FAILURE] FAILURE: Losing scenario is incorrect!');
        }

        // Step 6: Test your actual scenario
        console.log('\n📋 [5D_REAL_SCENARIO] Testing your actual scenario...');
        console.log('📋 [5D_REAL_SCENARIO] You bet on A_1, A_2, A_3, A_4, A_5, A_6, A_7, A_8, A_9');
        console.log('📋 [5D_REAL_SCENARIO] Result was A: 1 (you won on A_1, lost on others)');
        console.log('📋 [5D_REAL_SCENARIO] You should have received 9x payout, not 2x');

        const yourBet = {
            betType: 'POSITION',
            betValue: 'A_1',
            betAmount: 100,
            amount_after_tax: 98,
            odds: 9.0
        };

        const yourResult = {
            A: 1,
            B: 2,
            C: 4,
            D: 6,
            E: 5,
            sum: 18
        };

        const yourPayout = gameLogicService.calculateFiveDWin(yourBet, yourResult, yourBet.betType, yourBet.betValue);
        const correctPayout = yourBet.amount_after_tax * 9.0;
        const wrongPayout = yourBet.amount_after_tax * 2.0;

        console.log(`📋 [5D_REAL_SCENARIO] Your bet amount: ₹${yourBet.betAmount}`);
        console.log(`📋 [5D_REAL_SCENARIO] Amount after tax: ₹${yourBet.amount_after_tax}`);
        console.log(`📋 [5D_REAL_SCENARIO] Correct payout (9x): ₹${correctPayout.toFixed(2)}`);
        console.log(`📋 [5D_REAL_SCENARIO] Wrong payout (2x): ₹${wrongPayout.toFixed(2)}`);
        console.log(`📋 [5D_REAL_SCENARIO] Fixed payout: ₹${yourPayout.toFixed(2)}`);

        if (Math.abs(yourPayout - correctPayout) < 0.01) {
            console.log('✅ [5D_REAL_SUCCESS] SUCCESS: Your scenario now pays correctly (9x)');
        } else {
            console.log('❌ [5D_REAL_FAILURE] FAILURE: Your scenario still pays incorrectly!');
        }

        console.log('\n🎯 [5D_ODDS_FIX_TEST] ==========================================');
        console.log('🎯 [5D_ODDS_FIX_TEST] 5D Odds Fix Test completed');
        console.log('🎯 [5D_ODDS_FIX_TEST] ==========================================');

    } catch (error) {
        console.error('❌ [5D_ODDS_FIX_TEST] Error in 5D odds fix test:', error);
    }
}

// Run the test
test5DOddsFix().then(() => {
    console.log('✅ 5D odds fix test completed');
    process.exit(0);
}).catch(error => {
    console.error('❌ 5D odds fix test failed:', error);
    process.exit(1);
}); 