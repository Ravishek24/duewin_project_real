// Test win logic for RED bet on GREEN_VIOLET result
const { checkWingoWin, checkColorWin, getColorForNumber } = require('./services/gameLogicService');

console.log('🧪 Testing Win Logic for RED bet on GREEN_VIOLET result');
console.log('=====================================================');

// Scenario: User bets on RED, result is GREEN_VIOLET (number 5)
const betType = 'COLOR';
const betValue = 'red';
const result = {
    number: 5,
    color: 'green_violet'
};

console.log('📊 Test Parameters:');
console.log(`   Bet: ${betType}:${betValue}`);
console.log(`   Result: ${JSON.stringify(result)}`);

// Test 1: Check color mapping
console.log('\n🎨 Test 1: Color Mapping');
const actualColor = getColorForNumber(5);
console.log(`   Number 5 -> getColorForNumber(5) = ${actualColor}`);

// Test 2: Check color win logic
console.log('\n🎯 Test 2: Color Win Logic');
const colorWin = checkColorWin(betValue, result.number, result.color);
console.log(`   checkColorWin('${betValue}', ${result.number}, '${result.color}') = ${colorWin}`);

// Test 3: Check Wingo win logic
console.log('\n🎲 Test 3: Wingo Win Logic');
const wingoWin = checkWingoWin(betType, betValue, result);
console.log(`   checkWingoWin('${betType}', '${betValue}', result) = ${wingoWin}`);

// Expected result
console.log('\n📋 Expected Result:');
console.log(`   User bet on RED, result is GREEN_VIOLET (number 5)`);
console.log(`   Should WIN: false (user should lose)`);
console.log(`   Actual WIN: ${wingoWin}`);
console.log(`   Status: ${wingoWin ? '❌ BUG: User wins when should lose' : '✅ CORRECT: User loses as expected'}`);

console.log('\n🔍 Debug Information:');
console.log(`   - Number 5 color mapping: ${actualColor}`);
console.log(`   - Result color: ${result.color}`);
console.log(`   - Bet value: ${betValue}`);
console.log(`   - Color win check: ${colorWin}`);
console.log(`   - Final win result: ${wingoWin}`);

// Test the logic step by step
console.log('\n🔬 Step-by-step logic analysis:');
console.log(`   1. getColorForNumber(5) = '${actualColor}'`);
console.log(`   2. checkColorWin('red', 5, 'green_violet') checks:`);
console.log(`      - betValue === 'red' = true`);
console.log(`      - actualColor === 'red' = '${actualColor}' === 'red' = ${actualColor === 'red'}`);
console.log(`      - actualColor === 'red_violet' = '${actualColor}' === 'red_violet' = ${actualColor === 'red_violet'}`);
console.log(`      - Final result: ${actualColor === 'red'} || ${actualColor === 'red_violet'} = ${colorWin}`); 