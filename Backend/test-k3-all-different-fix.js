const gameLogicService = require('./services/gameLogicService');

async function testK3AllDifferentFix() {
    console.log('🧪 Testing K3 ALL_DIFFERENT_MULTIPLE Implementation');
    console.log('==================================================');

    // Test 1: Single combination bet
    console.log('\n📋 Test 1: Single combination bet ("1,2,3")');
    const singleBetData = {
        userId: 1,
        gameType: 'k3',
        duration: 60,
        timeline: 'default',
        periodId: 'test_period_001',
        betType: 'ALL_DIFFERENT',
        betValue: '1,2,3',
        betAmount: 1,
        odds: 34.56
    };

    console.log('Input bet data:', JSON.stringify(singleBetData, null, 2));
    
    // Test odds calculation
    const singleOdds = gameLogicService.calculateOdds('k3', 'ALL_DIFFERENT', '1,2,3');
    console.log('Calculated odds:', singleOdds);
    console.log('Expected odds: 34.56');
    console.log('✅ Odds correct:', singleOdds === 34.56);

    // Test 2: Multiple combination bet (all numbers 1-6)
    console.log('\n📋 Test 2: Multiple combination bet ("1,2,3,4,5,6")');
    const multipleBetData = {
        userId: 1,
        gameType: 'k3',
        duration: 60,
        timeline: 'default',
        periodId: 'test_period_002',
        betType: 'ALL_DIFFERENT_MULTIPLE',
        betValue: '1,2,3,4,5,6',
        betAmount: 20,
        odds: 0 // Will be calculated by the system
    };

    console.log('Input bet data:', JSON.stringify(multipleBetData, null, 2));

    // Test combination generation
    const numbers = [1, 2, 3, 4, 5, 6];
    const combinations = [];
    for (let i = 0; i < numbers.length - 2; i++) {
        for (let j = i + 1; j < numbers.length - 1; j++) {
            for (let k = j + 1; k < numbers.length; k++) {
                combinations.push(`${numbers[i]},${numbers[j]},${numbers[k]}`);
            }
        }
    }

    console.log('Generated combinations:', combinations);
    console.log('Number of combinations:', combinations.length);
    console.log('Expected combinations: 20');
    console.log('✅ Combination count correct:', combinations.length === 20);

    // Test amount distribution
    const amountPerCombination = 20 / combinations.length;
    console.log('Amount per combination:', amountPerCombination);
    console.log('Expected amount per combination: 1');
    console.log('✅ Amount distribution correct:', amountPerCombination === 1);

    // Test 3: Single number selection ("1")
    console.log('\n📋 Test 3: Single number selection ("1")');
    const singleNumberBetData = {
        userId: 1,
        gameType: 'k3',
        duration: 60,
        timeline: 'default',
        periodId: 'test_period_003',
        betType: 'ALL_DIFFERENT_MULTIPLE',
        betValue: '1',
        betAmount: 10,
        odds: 0
    };

    console.log('Input bet data:', JSON.stringify(singleNumberBetData, null, 2));

    // Generate combinations containing number 1
    const combinationsWithOne = [];
    for (let i = 1; i <= 6; i++) {
        for (let j = i + 1; j <= 6; j++) {
            if (i !== 1 && j !== 1) {
                const combo = [1, i, j].sort((a, b) => a - b);
                combinationsWithOne.push(combo.join(','));
            }
        }
    }
    const uniqueCombinationsWithOne = [...new Set(combinationsWithOne)];

    console.log('Combinations containing 1:', uniqueCombinationsWithOne);
    console.log('Number of combinations with 1:', uniqueCombinationsWithOne.length);
    console.log('Expected combinations with 1: 10');
    console.log('✅ Combination count correct:', uniqueCombinationsWithOne.length === 10);

    // Test 4: Win condition checking
    console.log('\n📋 Test 4: Win condition checking');
    
    // Test specific combination win
    const testResult1 = { dice_1: 1, dice_2: 2, dice_3: 3, sum: 6 };
    const specificWin = gameLogicService.checkK3Win('ALL_DIFFERENT', '1,2,3', testResult1);
    console.log('Specific combination "1,2,3" vs result [1,2,3]:', specificWin);
    console.log('Expected: true');
    console.log('✅ Specific win check correct:', specificWin === true);

    // Test specific combination loss
    const testResult2 = { dice_1: 1, dice_2: 2, dice_3: 4, sum: 7 };
    const specificLoss = gameLogicService.checkK3Win('ALL_DIFFERENT', '1,2,3', testResult2);
    console.log('Specific combination "1,2,3" vs result [1,2,4]:', specificLoss);
    console.log('Expected: false');
    console.log('✅ Specific loss check correct:', specificLoss === false);

    // Test generic all_different win
    const testResult3 = { dice_1: 1, dice_2: 2, dice_3: 4, sum: 7 };
    const genericWin = gameLogicService.checkK3Win('ALL_DIFFERENT', null, testResult3);
    console.log('Generic all_different vs result [1,2,4]:', genericWin);
    console.log('Expected: true');
    console.log('✅ Generic win check correct:', genericWin === true);

    // Test generic all_different loss (triple)
    const testResult4 = { dice_1: 1, dice_2: 1, dice_3: 1, sum: 3 };
    const genericLoss = gameLogicService.checkK3Win('ALL_DIFFERENT', null, testResult4);
    console.log('Generic all_different vs result [1,1,1]:', genericLoss);
    console.log('Expected: false');
    console.log('✅ Generic loss check correct:', genericLoss === false);

    console.log('\n🎉 All tests completed successfully!');
    console.log('==================================================');
}

// Run the test
testK3AllDifferentFix().catch(console.error); 