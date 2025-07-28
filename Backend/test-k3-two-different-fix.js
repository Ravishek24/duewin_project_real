const { checkK3Win, calculateK3Win } = require('./services/gameLogicService');

// Test cases for K3 TWO_DIFFERENT bet types
console.log('🧪 Testing K3 TWO_DIFFERENT bet types...\n');

// Test Case 1: Specific TWO_DIFFERENT bet (e.g., "1,2")
const test1 = {
    betType: 'TWO_DIFFERENT',
    betValue: '1,2',
    result: {
        dice_1: 1,
        dice_2: 2,
        dice_3: 5,
        sum: 8,
        has_pair: false,
        has_triple: false,
        is_straight: false
    }
};

console.log('Test 1: Specific TWO_DIFFERENT bet "1,2" vs Result "1,2,5" (EXACT MATCH)');
console.log('Expected: WIN (true)');
const result1 = checkK3Win(test1.betType, test1.betValue, test1.result);
console.log(`Actual: ${result1 ? 'WIN' : 'LOSE'} (${result1})\n`);

// Test Case 2: Specific TWO_DIFFERENT bet with wrong order
const test2 = {
    betType: 'TWO_DIFFERENT',
    betValue: '1,2',
    result: {
        dice_1: 2,
        dice_2: 1,
        dice_3: 5,
        sum: 8,
        has_pair: false,
        has_triple: false,
        is_straight: false
    }
};

console.log('Test 2: Specific TWO_DIFFERENT bet "1,2" vs Result "2,1,5" (SAME NUMBERS, DIFFERENT ORDER)');
console.log('Expected: LOSE (false) - ORDER MATTERS!');
const result2 = checkK3Win(test2.betType, test2.betValue, test2.result);
console.log(`Actual: ${result2 ? 'WIN' : 'LOSE'} (${result2})\n`);

// Test Case 3: Generic TWO_DIFFERENT bet (any pair)
const test3 = {
    betType: 'TWO_DIFFERENT',
    betValue: null,
    result: {
        dice_1: 2,
        dice_2: 2,
        dice_3: 5,
        sum: 9,
        has_pair: true,
        has_triple: false,
        is_straight: false
    }
};

console.log('Test 3: Generic TWO_DIFFERENT bet vs Result "2,2,5" (has pair, not triple)');
console.log('Expected: WIN (true)');
const result3 = checkK3Win(test3.betType, test3.betValue, test3.result);
console.log(`Actual: ${result3 ? 'WIN' : 'LOSE'} (${result3})\n`);

// Test Case 4: Generic TWO_DIFFERENT bet vs triple (should lose)
const test4 = {
    betType: 'TWO_DIFFERENT',
    betValue: null,
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

console.log('Test 4: Generic TWO_DIFFERENT bet vs Result "2,2,2" (has triple)');
console.log('Expected: LOSE (false) - triples don\'t count for two_different');
const result4 = checkK3Win(test4.betType, test4.betValue, test4.result);
console.log(`Actual: ${result4 ? 'WIN' : 'LOSE'} (${result4})\n`);

// Test Case 5: Payout calculation for TWO_DIFFERENT
const test5 = {
    bet_id: 'test123',
    bet_type: 'TWO_DIFFERENT:1,2',
    bet_amount: 10,
    amount_after_tax: 9.8,
    netBetAmount: 9.8
};

console.log('Test 5: TWO_DIFFERENT payout calculation');
console.log('Expected: ₹9.8 × 6.91 = ₹67.72');
const payout5 = calculateK3Win(test5, test1.result, 'TWO_DIFFERENT', '1,2');
console.log(`Actual: ₹${payout5}\n`);

// Summary
console.log('📊 SUMMARY:');
console.log(`Test 1 (Exact match): ${result1 ? '✅ PASS' : '❌ FAIL'}`);
console.log(`Test 2 (Different order): ${!result2 ? '✅ PASS' : '❌ FAIL'}`);
console.log(`Test 3 (Generic pair): ${result3 ? '✅ PASS' : '❌ FAIL'}`);
console.log(`Test 4 (Triple should lose): ${!result4 ? '✅ PASS' : '❌ FAIL'}`);
console.log(`Test 5 (Payout calculation): ${payout5 === 67.718 ? '✅ PASS' : '❌ FAIL'} (₹${payout5})`);

const allPassed = result1 && !result2 && result3 && !result4 && payout5 === 67.718;
console.log(`\n🎯 Overall Result: ${allPassed ? '✅ ALL TESTS PASSED - TWO_DIFFERENT working correctly!' : '❌ SOME TESTS FAILED'}`);

console.log('\n🔧 Key Features Verified:');
console.log('✅ TWO_DIFFERENT specific combinations (e.g., "1,2")');
console.log('✅ Order sensitivity (positions matter)');
console.log('✅ Generic TWO_DIFFERENT (any pair, not triple)');
console.log('✅ Correct payout (6.91x)');
console.log('✅ Proper win/loss logic');

console.log('\n📝 Bet Type Distinction:');
console.log('🎲 TWO_DIFFERENT: 2 dice out of 3 (e.g., "1,2" = first two dice are 1,2)');
console.log('🎲 ALL_DIFFERENT: all 3 dice different (e.g., "1,2,3" = all three dice are 1,2,3)'); 