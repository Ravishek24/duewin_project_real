// Test win logic for RED bet on GREEN result
const { checkWingoWin, checkColorWin, getColorForNumber } = require('./services/gameLogicService');

console.log('🧪 Testing Win Logic for RED bet on GREEN result');
console.log('================================================');

// Scenario: User bets on RED, result is GREEN (number 3)
const betType = 'COLOR';
const betValue = 'red';
const result = {
    number: 3,
    color: 'green'
};

console.log('📊 Test Parameters:');
console.log(`   Bet: ${betType}:${betValue}`);
console.log(`   Result: ${JSON.stringify(result)}`);

// Test 1: Check color mapping
console.log('\n🎨 Test 1: Color Mapping');
const actualColor = getColorForNumber(3);
console.log(`   Number 3 -> getColorForNumber(3) = ${actualColor}`);

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
console.log(`   User bet on RED, result is GREEN (number 3)`);
console.log(`   Should WIN: false (user should lose)`);
console.log(`   Actual WIN: ${wingoWin}`);
console.log(`   Status: ${wingoWin ? '❌ BUG: User wins when should lose' : '✅ CORRECT: User loses as expected'}`);

console.log('\n🔍 Debug Information:');
console.log(`   - Number 3 color mapping: ${actualColor}`);
console.log(`   - Result color: ${result.color}`);
console.log(`   - Bet value: ${betValue}`);
console.log(`   - Color win check: ${colorWin}`);
console.log(`   - Final win result: ${wingoWin}`); 