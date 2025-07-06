// Test payout fix for red bet on red_violet result
const { calculateWingoWin, calculateWinnings } = require('./services/gameLogicService');

console.log('🧪 Testing Payout Fix for RED bet on RED_VIOLET result');
console.log('=====================================================');

// Test case: Red bet on red_violet result
const testBet = {
    bet_id: 'test-123',
    bet_amount: 100, // Gross bet amount
    amount_after_tax: 98, // Net bet amount (after 2% platform fee)
    bet_type: 'COLOR:red'
};

const testResult = {
    number: 0,
    color: 'red_violet',
    size: 'Small',
    parity: 'even'
};

console.log('📋 Test Case:');
console.log('   Bet:', testBet);
console.log('   Result:', testResult);

// Test 1: Direct calculateWingoWin function
console.log('\n🎯 Test 1: Direct calculateWingoWin function');
const directWinnings = calculateWingoWin(testBet, testResult, 'COLOR', 'red');
console.log(`   Direct winnings: ₹${directWinnings}`);
console.log(`   Expected: ₹147 (98 × 1.5)`);
console.log(`   ✅ Correct: ${directWinnings === 147 ? 'YES' : 'NO'}`);

// Test 2: calculateWinnings function
console.log('\n🎯 Test 2: calculateWinnings function');
const calculatedWinnings = calculateWinnings(testBet, testResult, 'wingo');
console.log(`   Calculated winnings: ₹${calculatedWinnings}`);
console.log(`   Expected: ₹147 (98 × 1.5)`);
console.log(`   ✅ Correct: ${calculatedWinnings === 147 ? 'YES' : 'NO'}`);

// Test 3: Exposure calculation
console.log('\n🎯 Test 3: Exposure calculation simulation');
const exposureOdds = 2.0; // Red bet on pure red = 2.0x (max exposure)
const exposureAmount = testBet.amount_after_tax * exposureOdds;
console.log(`   Exposure amount: ₹${exposureAmount}`);
console.log(`   Expected: ₹196 (98 × 2.0)`);
console.log(`   ✅ Correct: ${exposureAmount === 196 ? 'YES' : 'NO'}`);

console.log('\n🎯 Summary:');
console.log('================');
if (directWinnings === 147 && calculatedWinnings === 147) {
    console.log('✅ Payout calculation is now FIXED!');
    console.log('   - Red bet on red_violet result pays 1.5x correctly');
    console.log('   - Net bet amount (₹98) is used for calculations');
    console.log('   - Expected payout: ₹147 instead of ₹196');
} else {
    console.log('❌ Payout calculation still has issues!');
    console.log(`   - Direct winnings: ₹${directWinnings} (expected: ₹147)`);
    console.log(`   - Calculated winnings: ₹${calculatedWinnings} (expected: ₹147)`);
} 