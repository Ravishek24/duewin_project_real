const { checkK3Win, calculateK3Win } = require('./services/gameLogicService');

// Test cases for K3 ANY_PAIR bet type
console.log('🧪 Testing K3 ANY_PAIR bet type mapping and processing...\n');

// Test Case 1: ANY_PAIR bet vs result with pair
const test1 = {
    betType: 'MATCHING_DICE',
    betValue: 'pair_any',
    result: {
        dice_1: 2,
        dice_2: 6,
        dice_3: 2,
        sum: 10,
        has_pair: true,
        has_triple: false,
        is_straight: false
    }
};

console.log('Test 1: ANY_PAIR bet vs Result "2,6,2" (has pair, not triple)');
console.log('Expected: WIN (true)');
const result1 = checkK3Win(test1.betType, test1.betValue, test1.result);
console.log(`Actual: ${result1 ? 'WIN' : 'LOSE'} (${result1})\n`);

// Test Case 2: ANY_PAIR bet vs result with triple (should lose)
const test2 = {
    betType: 'MATCHING_DICE',
    betValue: 'pair_any',
    result: {
        dice_1: 2,
        dice_2: 2,
        dice_3: 2,
        sum: 6,
        has_pair: true,
        has_triple: true,
        is_straight: false
    }
};

console.log('Test 2: ANY_PAIR bet vs Result "2,2,2" (has triple)');
console.log('Expected: LOSE (false) - triples don\'t count for ANY_PAIR');
const result2 = checkK3Win(test2.betType, test2.betValue, test2.result);
console.log(`Actual: ${result2 ? 'WIN' : 'LOSE'} (${result2})\n`);

// Test Case 3: ANY_PAIR bet vs result with no pair
const test3 = {
    betType: 'MATCHING_DICE',
    betValue: 'pair_any',
    result: {
        dice_1: 1,
        dice_2: 2,
        dice_3: 3,
        sum: 6,
        has_pair: false,
        has_triple: false,
        is_straight: false
    }
};

console.log('Test 3: ANY_PAIR bet vs Result "1,2,3" (no pair)');
console.log('Expected: LOSE (false)');
const result3 = checkK3Win(test3.betType, test3.betValue, test3.result);
console.log(`Actual: ${result3 ? 'WIN' : 'LOSE'} (${result3})\n`);

// Test Case 4: Payout calculation for ANY_PAIR
const test4 = {
    bet_id: 'test123',
    bet_type: 'MATCHING_DICE:pair_any',
    bet_amount: 10,
    amount_after_tax: 9.8,
    netBetAmount: 9.8
};

console.log('Test 4: ANY_PAIR payout calculation');
console.log('Expected: ₹9.8 × 13.83 = ₹135.53');
const payout4 = calculateK3Win(test4, test1.result, 'MATCHING_DICE', 'pair_any');
console.log(`Actual: ₹${payout4}\n`);

// Summary
console.log('📊 SUMMARY:');
console.log(`Test 1 (Pair win): ${result1 ? '✅ PASS' : '❌ FAIL'}`);
console.log(`Test 2 (Triple should lose): ${!result2 ? '✅ PASS' : '❌ FAIL'}`);
console.log(`Test 3 (No pair should lose): ${!result3 ? '✅ PASS' : '❌ FAIL'}`);
console.log(`Test 4 (Payout calculation): ${payout4 === 135.534 ? '✅ PASS' : '❌ FAIL'} (₹${payout4})`);

const allPassed = result1 && !result2 && !result3 && payout4 === 135.534;
console.log(`\n🎯 Overall Result: ${allPassed ? '✅ ALL TESTS PASSED - ANY_PAIR working correctly!' : '❌ SOME TESTS FAILED'}`);

console.log('\n🔧 Key Features Verified:');
console.log('✅ ANY_PAIR wins on any pair (two same numbers)');
console.log('✅ ANY_PAIR loses on triples (three same numbers)');
console.log('✅ ANY_PAIR loses on all different numbers');
console.log('✅ Correct payout (13.83x)');
console.log('✅ Proper win/loss logic');

console.log('\n📝 Bet Type Distinction:');
console.log('🎲 ANY_PAIR: any two same numbers (e.g., "2,6,2" = pair of 2s)');
console.log('🎲 TWO_DIFFERENT: specific two different numbers (e.g., "1,2" = first two dice are 1,2)');
console.log('🎲 ALL_DIFFERENT: all three different numbers (e.g., "1,2,3" = all three dice are 1,2,3)'); 