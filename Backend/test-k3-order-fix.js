const { checkK3Win } = require('./services/gameLogicService');

// Test cases for K3 ALL_DIFFERENT bets where order matters
console.log('🧪 Testing K3 ALL_DIFFERENT order sensitivity...\n');

// Test Case 1: Bet on "2,3,5" vs Result "2,3,5" (EXACT MATCH - should WIN)
const test1 = {
    betType: 'ALL_DIFFERENT',
    betValue: '2,3,5',
    result: {
        dice_1: 2,
        dice_2: 3,
        dice_3: 5,
        sum: 10,
        has_pair: false,
        has_triple: false,
        is_straight: false
    }
};

console.log('Test 1: Bet "2,3,5" vs Result "2,3,5" (EXACT MATCH)');
console.log('Expected: WIN (true)');
const result1 = checkK3Win(test1.betType, test1.betValue, test1.result);
console.log(`Actual: ${result1 ? 'WIN' : 'LOSE'} (${result1})\n`);

// Test Case 2: Bet on "2,3,5" vs Result "2,5,3" (SAME NUMBERS, DIFFERENT ORDER - should LOSE)
const test2 = {
    betType: 'ALL_DIFFERENT',
    betValue: '2,3,5',
    result: {
        dice_1: 2,
        dice_2: 5,
        dice_3: 3,
        sum: 10,
        has_pair: false,
        has_triple: false,
        is_straight: false
    }
};

console.log('Test 2: Bet "2,3,5" vs Result "2,5,3" (SAME NUMBERS, DIFFERENT ORDER)');
console.log('Expected: LOSE (false)');
const result2 = checkK3Win(test2.betType, test2.betValue, test2.result);
console.log(`Actual: ${result2 ? 'WIN' : 'LOSE'} (${result2})\n`);

// Test Case 3: Bet on "1,2,3" vs Result "3,2,1" (SAME NUMBERS, REVERSED ORDER - should LOSE)
const test3 = {
    betType: 'ALL_DIFFERENT',
    betValue: '1,2,3',
    result: {
        dice_1: 3,
        dice_2: 2,
        dice_3: 1,
        sum: 6,
        has_pair: false,
        has_triple: false,
        is_straight: false
    }
};

console.log('Test 3: Bet "1,2,3" vs Result "3,2,1" (SAME NUMBERS, REVERSED ORDER)');
console.log('Expected: LOSE (false)');
const result3 = checkK3Win(test3.betType, test3.betValue, test3.result);
console.log(`Actual: ${result3 ? 'WIN' : 'LOSE'} (${result3})\n`);

// Test Case 4: Generic ALL_DIFFERENT bet (should win on any 3 different numbers)
const test4 = {
    betType: 'ALL_DIFFERENT',
    betValue: null,
    result: {
        dice_1: 2,
        dice_2: 5,
        dice_3: 3,
        sum: 10,
        has_pair: false,
        has_triple: false,
        is_straight: false
    }
};

console.log('Test 4: Generic ALL_DIFFERENT bet vs Result "2,5,3" (any 3 different numbers)');
console.log('Expected: WIN (true)');
const result4 = checkK3Win(test4.betType, test4.betValue, test4.result);
console.log(`Actual: ${result4 ? 'WIN' : 'LOSE'} (${result4})\n`);

// Summary
console.log('📊 SUMMARY:');
console.log(`Test 1 (Exact match): ${result1 ? '✅ PASS' : '❌ FAIL'}`);
console.log(`Test 2 (Different order): ${!result2 ? '✅ PASS' : '❌ FAIL'}`);
console.log(`Test 3 (Reversed order): ${!result3 ? '✅ PASS' : '❌ FAIL'}`);
console.log(`Test 4 (Generic all_different): ${result4 ? '✅ PASS' : '❌ FAIL'}`);

const allPassed = result1 && !result2 && !result3 && result4;
console.log(`\n🎯 Overall Result: ${allPassed ? '✅ ALL TESTS PASSED - Order sensitivity working correctly!' : '❌ SOME TESTS FAILED'}`); 