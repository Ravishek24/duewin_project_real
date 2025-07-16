const { calculateOdds } = require('./services/gameLogicService');

console.log('🎲 Testing K3 calculateOdds function...\n');

// Test some key K3 bets
const testBets = [
    { betType: 'SUM', betValue: '3', expected: 207.36 },
    { betType: 'SUM', betValue: '10', expected: 7.68 },
    { betType: 'SUM_CATEGORY', betValue: 'Small', expected: 2.0 },
    { betType: 'PATTERN', betValue: 'straight', expected: 8.64 },
    { betType: 'MATCHING_DICE', betValue: 'triple_any', expected: 34.56 },
];

testBets.forEach(({ betType, betValue, expected }) => {
    const actual = calculateOdds('k3', betType, betValue);
    const status = actual === expected ? '✅' : '❌';
    console.log(`${status} ${betType}:${betValue} -> ${actual} (expected: ${expected})`);
});

console.log('\n🎲 K3 calculateOdds function test completed!'); 