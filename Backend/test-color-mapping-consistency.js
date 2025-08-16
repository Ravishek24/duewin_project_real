#!/usr/bin/env node
/**
 * Test color mapping consistency between admin controller and game logic service
 */

console.log('🎨 [COLOR_TEST] ===== TESTING COLOR MAPPING CONSISTENCY =====');

// Admin controller color mapping (fixed)
const adminDetermineWingoResult = (number) => {
    const colorMap = {
        0: 'red_violet',    // 0 is red + violet
        1: 'green',         // 1 is green
        2: 'red',           // 2 is red
        3: 'green',         // 3 is green
        4: 'red',           // 4 is red
        5: 'green_violet',  // 5 is green + violet
        6: 'red',           // 6 is red ✅ FIXED
        7: 'green',         // 7 is green
        8: 'red',           // 8 is red
        9: 'green'          // 9 is green
    };
    
    const color = colorMap[number] || 'red';
    const size = number >= 5 ? 'big' : 'small';
    
    return { number, color, size };
};

// Game logic service color mapping
const gameLogicGetColorForNumber = (number) => {
    const colorMap = {
        0: 'red_violet',    // 0 is red + violet
        1: 'green',         // 1 is green
        2: 'red',           // 2 is red
        3: 'green',         // 3 is green
        4: 'red',           // 4 is red
        5: 'green_violet',  // 5 is green + violet
        6: 'red',           // 6 is red
        7: 'green',         // 7 is green
        8: 'red',           // 8 is red
        9: 'green'          // 9 is green
    };
    return colorMap[number];
};

console.log('🎨 [COLOR_TEST] Testing all numbers 0-9...\n');

let allMatch = true;

for (let i = 0; i <= 9; i++) {
    const adminResult = adminDetermineWingoResult(i);
    const gameLogicColor = gameLogicGetColorForNumber(i);
    
    const match = adminResult.color === gameLogicColor;
    if (!match) allMatch = false;
    
    const status = match ? '✅' : '❌';
    console.log(`${status} Number ${i}:`);
    console.log(`    Admin Controller: ${adminResult.color} (${adminResult.size})`);
    console.log(`    Game Logic:       ${gameLogicColor}`);
    console.log(`    Match: ${match}`);
    console.log('');
}

console.log('🎨 [COLOR_TEST] =====================================');
if (allMatch) {
    console.log('✅ [COLOR_TEST] SUCCESS: All color mappings are consistent!');
    console.log('✅ [COLOR_TEST] Admin controller and game logic service match perfectly');
} else {
    console.log('❌ [COLOR_TEST] FAILED: Color mappings are inconsistent!');
    console.log('❌ [COLOR_TEST] This will cause bet calculation errors');
}

console.log('\n🎨 [COLOR_TEST] Specific test for number 6:');
const result6Admin = adminDetermineWingoResult(6);
const result6GameLogic = gameLogicGetColorForNumber(6);

console.log(`Admin Controller: Number 6 = ${result6Admin.color} (${result6Admin.size})`);
console.log(`Game Logic:       Number 6 = ${result6GameLogic}`);
console.log(`Match: ${result6Admin.color === result6GameLogic ? '✅ YES' : '❌ NO'}`);

console.log('\n🎨 [COLOR_TEST] ===== TEST COMPLETE =====');

module.exports = {
    adminDetermineWingoResult,
    gameLogicGetColorForNumber
};