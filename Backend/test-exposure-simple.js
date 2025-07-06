// Test exposure calculation fix for red bet on different numbers
const { calculateWingoWin } = require('./services/gameLogicService');

console.log('🧪 Testing Exposure Calculation Fix');
console.log('===================================');

// Test case: Red bet on different numbers
const testBet = {
    bet_amount: 100, // Gross bet amount
    amount_after_tax: 98, // Net bet amount (after 2% platform fee)
    bet_type: 'COLOR:red'
};

// Test different numbers and their expected payouts
const testCases = [
    { number: 0, color: 'red_violet', expectedPayout: 147, expectedOdds: 1.5 },
    { number: 1, color: 'red', expectedPayout: 196, expectedOdds: 2.0 },
    { number: 2, color: 'red', expectedPayout: 196, expectedOdds: 2.0 },
    { number: 3, color: 'green', expectedPayout: 0, expectedOdds: 0 },
    { number: 4, color: 'green', expectedPayout: 0, expectedOdds: 0 },
    { number: 5, color: 'green_violet', expectedPayout: 0, expectedOdds: 0 },
    { number: 6, color: 'green_violet', expectedPayout: 0, expectedOdds: 0 },
    { number: 7, color: 'green', expectedPayout: 0, expectedOdds: 0 },
    { number: 8, color: 'green', expectedPayout: 0, expectedOdds: 0 },
    { number: 9, color: 'green', expectedPayout: 0, expectedOdds: 0 }
];

console.log('📋 Test Cases for RED bet:');
console.log('   Bet Amount: ₹100 (Gross), ₹98 (Net)');
console.log('   Bet Type: COLOR:red');
console.log('');

let totalExposure = 0;
let winningNumbers = [];

testCases.forEach((testCase, index) => {
    const result = {
        number: testCase.number,
        color: testCase.color,
        size: testCase.number >= 5 ? 'Big' : 'Small',
        parity: testCase.number % 2 === 0 ? 'even' : 'odd'
    };

    const payout = calculateWingoWin(testBet, result, 'COLOR', 'red');
    const odds = payout > 0 ? payout / testBet.amount_after_tax : 0;
    
    console.log(`🎯 Number ${testCase.number} (${testCase.color}):`);
    console.log(`   Expected: ₹${testCase.expectedPayout} (${testCase.expectedOdds}x odds)`);
    console.log(`   Actual: ₹${payout} (${odds.toFixed(1)}x odds)`);
    console.log(`   ✅ Correct: ${Math.abs(payout - testCase.expectedPayout) < 1 ? 'YES' : 'NO'}`);
    
    if (payout > 0) {
        totalExposure += payout;
        winningNumbers.push(testCase.number);
    }
    console.log('');
});

console.log('📊 Exposure Summary:');
console.log('====================');
console.log(`   Winning numbers: [${winningNumbers.join(', ')}]`);
console.log(`   Total exposure: ₹${totalExposure}`);
console.log(`   Expected total: ₹${147 + 196 + 196} = ₹539`);

// Test the old vs new exposure calculation
console.log('\n🔍 Old vs New Exposure Calculation:');
console.log('====================================');
console.log('OLD METHOD (using 2.0x for all red bets):');
console.log(`   - Number 0 (red_violet): ₹${98 * 2.0} = ₹196`);
console.log(`   - Number 1 (red): ₹${98 * 2.0} = ₹196`);
console.log(`   - Number 2 (red): ₹${98 * 2.0} = ₹196`);
console.log(`   - Total: ₹${196 * 3} = ₹588`);

console.log('\nNEW METHOD (using correct odds):');
console.log(`   - Number 0 (red_violet): ₹${98 * 1.5} = ₹147`);
console.log(`   - Number 1 (red): ₹${98 * 2.0} = ₹196`);
console.log(`   - Number 2 (red): ₹${98 * 2.0} = ₹196`);
console.log(`   - Total: ₹${147 + 196 + 196} = ₹539`);

console.log('\n💰 Difference:');
console.log(`   Old exposure: ₹588`);
console.log(`   New exposure: ₹539`);
console.log(`   Reduction: ₹${588 - 539} (${((588 - 539) / 588 * 100).toFixed(1)}% less)`);

console.log('\n🎯 Conclusion:');
if (totalExposure === 539) {
    console.log('✅ Exposure calculation is now FIXED!');
    console.log('   - Red bet on red_violet pays 1.5x correctly');
    console.log('   - Red bet on pure red pays 2.0x correctly');
    console.log('   - Exposure tracking now matches actual payouts');
} else {
    console.log('❌ Exposure calculation still has issues!');
    console.log(`   - Expected: ₹539, Actual: ₹${totalExposure}`);
} 