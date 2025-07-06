// Test odds calculation for red bet on red_violet result
const { calculateResultBasedOdds } = require('./services/gameLogicService');

console.log('🧪 Testing Odds Calculation for RED bet on RED_VIOLET result');
console.log('==========================================');

// Test case: Red bet on red_violet result
const testCase = {
    gameType: 'wingo',
    betType: 'COLOR',
    betValue: 'red',
    result: {
        number: 0,
        color: 'red_violet',
        size: 'Small',
        parity: 'even'
    }
};

console.log('📋 Test Case:', testCase);

// Calculate odds
const odds = calculateResultBasedOdds(
    testCase.gameType,
    testCase.betType,
    testCase.betValue,
    testCase.result
);

console.log('🎯 Calculated Odds:', odds);

// Expected result
const expectedOdds = 1.5;
console.log('✅ Expected Odds:', expectedOdds);

// Check if correct
if (odds === expectedOdds) {
    console.log('🎉 SUCCESS: Odds calculation is correct!');
} else {
    console.log('❌ FAILURE: Odds calculation is wrong!');
    console.log(`   Expected: ${expectedOdds}x, Got: ${odds}x`);
}

// Test payout calculation
const betAmount = 100;
const platformFee = 0.02; // 2%
const netBetAmount = betAmount * (1 - platformFee);
const winnings = netBetAmount * odds;
const totalPayout = winnings + netBetAmount;

console.log('\n💰 Payout Calculation:');
console.log(`   Bet Amount: ₹${betAmount}`);
console.log(`   Platform Fee: ${platformFee * 100}%`);
console.log(`   Net Bet Amount: ₹${netBetAmount}`);
console.log(`   Odds: ${odds}x`);
console.log(`   Winnings: ₹${winnings}`);
console.log(`   Total Payout: ₹${totalPayout}`);

// Expected payout
const expectedWinnings = netBetAmount * expectedOdds;
const expectedTotalPayout = expectedWinnings + netBetAmount;

console.log('\n✅ Expected Payout:');
console.log(`   Winnings: ₹${expectedWinnings}`);
console.log(`   Total Payout: ₹${expectedTotalPayout}`);

if (Math.abs(winnings - expectedWinnings) < 0.01) {
    console.log('🎉 SUCCESS: Payout calculation is correct!');
} else {
    console.log('❌ FAILURE: Payout calculation is wrong!');
    console.log(`   Expected: ₹${expectedWinnings}, Got: ₹${winnings}`);
} 