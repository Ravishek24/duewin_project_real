#!/usr/bin/env node
/**
 * Verify Wingo color mapping
 */

console.log('🎨 [COLOR_MAPPING] ===== WINGO COLOR MAPPING VERIFICATION =====');

// Current mapping in the code
const determineWingoResult = (number) => {
    let color, size;
    
    // Determine size (big = 5-9, small = 0-4)
    size = number >= 5 ? 'big' : 'small';
    
    // Determine color based on number
    switch (number) {
        case 0:
            color = 'red_violet';  // 0 is red-violet
            break;
        case 1:
        case 2:
        case 3:
        case 4:
            color = 'red';  // 1-4 are red
            break;
        case 5:
            color = 'green_violet';  // 5 is green-violet
            break;
        case 6:
        case 7:
        case 8:
        case 9:
            color = 'green';  // 6-9 are green
            break;
        default:
            color = 'red';  // fallback
    }
    
    return {
        number: number,
        color: color,
        size: size
    };
};

console.log('🎨 [COLOR_MAPPING] Current color mapping:');
for (let i = 0; i <= 9; i++) {
    const result = determineWingoResult(i);
    console.log(`  ${i}: ${result.color} (${result.size})`);
}

console.log('\n🎨 [COLOR_MAPPING] Specific check for number 6:');
const result6 = determineWingoResult(6);
console.log(`  Number 6: ${result6.color} (${result6.size})`);

console.log('\n🎨 [COLOR_MAPPING] Please verify this is correct!');
console.log('🎨 [COLOR_MAPPING] If number 6 should be a different color, please specify.');

// Alternative mapping suggestions
console.log('\n🎨 [COLOR_MAPPING] Alternative mappings to consider:');
console.log('  Option 1 (Current): 0=red_violet, 1-4=red, 5=green_violet, 6-9=green');
console.log('  Option 2: 0,5=violet, 1-4=red, 6-9=green');
console.log('  Option 3: Different pattern entirely');

console.log('\n🎨 [COLOR_MAPPING] ===== END VERIFICATION =====');