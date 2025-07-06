// Test comprehensive payout calculations for all games
const { calculateWingoWin, calculateK3Win, calculateFiveDWin } = require('./services/gameLogicService');

console.log('🧪 Testing Comprehensive Payout Calculations');
console.log('==========================================');

// Test WINGO/TRX_WIX payouts
console.log('\n🎲 WINGO/TRX_WIX Payout Tests:');
console.log('--------------------------------');

const wingoTests = [
    // Red bet tests
    {
        name: 'Red bet on red result',
        bet: { betAmount: 100 },
        betType: 'COLOR',
        betValue: 'red',
        result: { number: 2, color: 'red' },
        expected: 200 // 2.0x
    },
    {
        name: 'Red bet on red_violet result',
        bet: { betAmount: 100 },
        betType: 'COLOR',
        betValue: 'red',
        result: { number: 0, color: 'red_violet' },
        expected: 150 // 1.5x
    },
    // Green bet tests
    {
        name: 'Green bet on green result',
        bet: { betAmount: 100 },
        betType: 'COLOR',
        betValue: 'green',
        result: { number: 1, color: 'green' },
        expected: 200 // 2.0x
    },
    {
        name: 'Green bet on green_violet result',
        bet: { betAmount: 100 },
        betType: 'COLOR',
        betValue: 'green',
        result: { number: 5, color: 'green_violet' },
        expected: 150 // 1.5x
    },
    // Violet bet tests
    {
        name: 'Violet bet on red_violet result',
        bet: { betAmount: 100 },
        betType: 'COLOR',
        betValue: 'violet',
        result: { number: 0, color: 'red_violet' },
        expected: 450 // 4.5x
    },
    {
        name: 'Violet bet on green_violet result',
        bet: { betAmount: 100 },
        betType: 'COLOR',
        betValue: 'violet',
        result: { number: 5, color: 'green_violet' },
        expected: 450 // 4.5x
    },
    // Number bet test
    {
        name: 'Number bet on exact number',
        bet: { betAmount: 100 },
        betType: 'NUMBER',
        betValue: '5',
        result: { number: 5, color: 'green_violet' },
        expected: 900 // 9.0x
    },
    // Size bet test
    {
        name: 'Big bet on big number',
        bet: { betAmount: 100 },
        betType: 'SIZE',
        betValue: 'big',
        result: { number: 7, color: 'green' },
        expected: 200 // 2.0x
    },
    // Parity bet test
    {
        name: 'Even bet on even number',
        bet: { betAmount: 100 },
        betType: 'PARITY',
        betValue: 'even',
        result: { number: 8, color: 'red' },
        expected: 200 // 2.0x
    }
];

wingoTests.forEach(test => {
    const winnings = calculateWingoWin(test.bet, test.result, test.betType, test.betValue);
    const passed = winnings === test.expected;
    console.log(`${passed ? '✅' : '❌'} ${test.name}: ₹${winnings} (expected: ₹${test.expected})`);
});

// Test K3 payouts
console.log('\n🎲 K3 Payout Tests:');
console.log('-------------------');

const k3Tests = [
    {
        name: 'Sum bet on 3',
        bet: { betAmount: 100 },
        betType: 'SUM',
        betValue: '3',
        result: { dice_1: 1, dice_2: 1, dice_3: 1, sum: 3 },
        expected: 20736 // 207.36x
    },
    {
        name: 'Sum bet on 10',
        bet: { betAmount: 100 },
        betType: 'SUM',
        betValue: '10',
        result: { dice_1: 4, dice_2: 3, dice_3: 3, sum: 10 },
        expected: 768 // 7.68x
    },
    {
        name: 'Big sum bet',
        bet: { betAmount: 100 },
        betType: 'SUM_CATEGORY',
        betValue: 'big',
        result: { dice_1: 6, dice_2: 6, dice_3: 6, sum: 18 },
        expected: 200 // 2.0x
    },
    {
        name: 'Triple any',
        bet: { betAmount: 100 },
        betType: 'MATCHING_DICE',
        betValue: 'triple_any',
        result: { dice_1: 5, dice_2: 5, dice_3: 5, has_triple: true },
        expected: 3456 // 34.56x
    }
];

k3Tests.forEach(test => {
    const winnings = calculateK3Win(test.bet, test.result, test.betType, test.betValue);
    const passed = winnings === test.expected;
    console.log(`${passed ? '✅' : '❌'} ${test.name}: ₹${winnings} (expected: ₹${test.expected})`);
});

// Test 5D payouts
console.log('\n🎲 5D Payout Tests:');
console.log('-------------------');

const fiveDTests = [
    {
        name: 'Position bet A_5',
        bet: { betAmount: 100 },
        betType: 'POSITION',
        betValue: 'A_5',
        result: { A: 5, B: 3, C: 1, D: 6, E: 2 },
        expected: 200 // 2.0x
    },
    {
        name: 'Position size bet A_big',
        bet: { betAmount: 100 },
        betType: 'POSITION_SIZE',
        betValue: 'A_big',
        result: { A: 5, B: 3, C: 1, D: 6, E: 2 },
        expected: 200 // 2.0x
    },
    {
        name: 'Sum big bet',
        bet: { betAmount: 100 },
        betType: 'SUM',
        betValue: 'big',
        result: { A: 6, B: 6, C: 6, D: 6, E: 6, sum: 30 },
        expected: 198 // 1.98x
    }
];

fiveDTests.forEach(test => {
    const winnings = calculateFiveDWin(test.bet, test.result, test.betType, test.betValue);
    const passed = winnings === test.expected;
    console.log(`${passed ? '✅' : '❌'} ${test.name}: ₹${winnings} (expected: ₹${test.expected})`);
});

console.log('\n🎯 Test Summary:');
console.log('================');
console.log('All payout calculations should now use the comprehensive payout functions');
console.log('that contain the complete and correct payout details for each game type.'); 