const gameLogicService = require('./services/gameLogicService');

console.log('🧪 Quick Test: K3 ALL_DIFFERENT Odds Calculation');
console.log('================================================');

// Test odds calculation for ALL_DIFFERENT
const odds = gameLogicService.calculateOdds('k3', 'ALL_DIFFERENT', '1,2,3');
console.log('ALL_DIFFERENT odds:', odds);
console.log('Expected: 34.56');
console.log('✅ Correct:', odds === 34.56);

// Test odds calculation for ALL_DIFFERENT_MULTIPLE
const oddsMultiple = gameLogicService.calculateOdds('k3', 'ALL_DIFFERENT_MULTIPLE', '1,2,3,4,5,6');
console.log('ALL_DIFFERENT_MULTIPLE odds:', oddsMultiple);
console.log('Expected: 34.56');
console.log('✅ Correct:', oddsMultiple === 34.56);

// Test combination generation
function generateAllDifferentCombinations(numbers) {
    const combinations = [];
    for (let i = 0; i < numbers.length - 2; i++) {
        for (let j = i + 1; j < numbers.length - 1; j++) {
            for (let k = j + 1; k < numbers.length; k++) {
                combinations.push(`${numbers[i]},${numbers[j]},${numbers[k]}`);
            }
        }
    }
    return combinations;
}

const numbers = [1, 2, 3, 4, 5, 6];
const combinations = generateAllDifferentCombinations(numbers);
console.log('Combinations from [1,2,3,4,5,6]:', combinations.length);
console.log('Expected: 20');
console.log('✅ Correct:', combinations.length === 20);

console.log('🎉 Quick test completed!'); 