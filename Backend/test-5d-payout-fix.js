/**
 * Test script to verify 5D payout calculation fix
 * This script tests the missing SUM_SIZE and SUM_PARITY cases in calculateFiveDWin
 */

const { calculateFiveDWin } = require('./services/gameLogicService');

console.log('🧪 Testing 5D Payout Calculation Fix...\n');

// Test result: sum=22 (even, big)
const testResult = {
    A: 6,
    B: 2,
    C: 6,
    D: 0,
    E: 8,
    sum: 22,
    dice_value: 62608,
    sum_size: "big",
    sum_parity: "even"
};

// Test cases based on the reported bug
const testCases = [
    {
        name: 'SUM_PARITY - SUM_even on sum=22 (should WIN)',
        betType: 'SUM_PARITY',
        betValue: 'SUM_even',
        betAmount: 10,
        expectedWin: true,
        expectedPayout: 20 // 10 * 2.0
    },
    {
        name: 'SUM_PARITY - SUM_odd on sum=22 (should LOSE)',
        betType: 'SUM_PARITY',
        betValue: 'SUM_odd',
        betAmount: 1,
        expectedWin: false,
        expectedPayout: 0
    },
    {
        name: 'SUM_SIZE - SUM_big on sum=22 (should WIN)',
        betType: 'SUM_SIZE',
        betValue: 'SUM_big',
        betAmount: 1,
        expectedWin: true,
        expectedPayout: 2 // 1 * 2.0
    },
    {
        name: 'SUM_SIZE - SUM_small on sum=22 (should LOSE)',
        betType: 'SUM_SIZE',
        betValue: 'SUM_small',
        betAmount: 10,
        expectedWin: false,
        expectedPayout: 0
    }
];

console.log('📊 Testing Payout Calculations:');
console.log('================================');

let passedTests = 0;
let totalTests = testCases.length;

testCases.forEach((testCase, index) => {
    console.log(`\n${index + 1}. ${testCase.name}`);
    console.log(`   Bet: ${testCase.betType}:${testCase.betValue}, Amount: ${testCase.betAmount}`);
    console.log(`   Result: sum=${testResult.sum} (${testResult.sum_parity}, ${testResult.sum_size})`);
    
    // Create a mock bet object
    const mockBet = {
        amount_after_tax: testCase.betAmount,
        betAmount: testCase.betAmount,
        bet_amount: testCase.betAmount
    };
    
    // Calculate payout
    const payout = calculateFiveDWin(mockBet, testResult, testCase.betType, testCase.betValue);
    
    // Check if it's a win
    const isWin = payout > 0;
    const expectedWinText = testCase.expectedWin ? 'WIN' : 'LOSE';
    const actualWinText = isWin ? 'WIN' : 'LOSE';
    
    console.log(`   Expected: ${expectedWinText} (payout: ${testCase.expectedPayout})`);
    console.log(`   Actual: ${actualWinText} (payout: ${payout})`);
    
    // Verify results
    const payoutCorrect = payout === testCase.expectedPayout;
    const winCorrect = isWin === testCase.expectedWin;
    
    if (payoutCorrect && winCorrect) {
        console.log(`   ✅ PASS - Payout and win/lose status correct`);
        passedTests++;
    } else {
        console.log(`   ❌ FAIL - Expected payout: ${testCase.expectedPayout}, got: ${payout}`);
        console.log(`   ❌ FAIL - Expected win: ${testCase.expectedWin}, got: ${isWin}`);
    }
});

console.log('\n📈 Test Results:');
console.log(`Passed: ${passedTests}/${totalTests}`);
console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

if (passedTests === totalTests) {
    console.log('\n🎉 ALL TESTS PASSED! The 5D payout calculation fix is working correctly.');
    console.log('✅ SUM_SIZE bet types now calculate payouts correctly');
    console.log('✅ SUM_PARITY bet types now calculate payouts correctly');
    console.log('✅ The reported bug (winAmount: 0 for winning bets) is FIXED!');
} else {
    console.log('\n⚠️  Some tests failed. The payout calculation still has issues.');
}

// Test the specific cases from the reported bug
console.log('\n🔍 Testing the reported bug cases:');
console.log('===================================');

const bugCases = [
    {
        betId: "dbfc07d5-265c-4fd5-aa5b-8fc052b51171",
        betType: "SUM_PARITY",
        betValue: "SUM_even",
        betAmount: 10,
        expectedPayout: 20
    },
    {
        betId: "a9192c90-6470-42d3-a852-702a023dd73a",
        betType: "SUM_SIZE",
        betValue: "SUM_big",
        betAmount: 1,
        expectedPayout: 2
    }
];

bugCases.forEach((bugCase, index) => {
    console.log(`\nBug Case ${index + 1}:`);
    console.log(`   Bet ID: ${bugCase.betId}`);
    console.log(`   Type: ${bugCase.betType}:${bugCase.betValue}`);
    console.log(`   Amount: ${bugCase.betAmount}`);
    
    const mockBet = {
        amount_after_tax: bugCase.betAmount,
        betAmount: bugCase.betAmount,
        bet_amount: bugCase.betAmount
    };
    
    const payout = calculateFiveDWin(mockBet, testResult, bugCase.betType, bugCase.betValue);
    
    if (payout === bugCase.expectedPayout) {
        console.log(`   ✅ FIXED: Payout is now ${payout} (was 0 before)`);
    } else {
        console.log(`   ❌ STILL BROKEN: Payout is ${payout} (should be ${bugCase.expectedPayout})`);
    }
});

console.log('\n🎯 Summary:');
console.log('- The bug was missing SUM_SIZE and SUM_PARITY cases in calculateFiveDWin');
console.log('- Added the missing cases with correct payout calculations');
console.log('- SUM_SIZE and SUM_PARITY bets now return proper payouts (2.0x multiplier)');
console.log('- This should fix the winAmount: 0 issue in the bet history'); 