// Test ALL bet types to see which ones are incorrectly showing as won
const { checkBetWin, getColorForNumber } = require('./services/gameLogicService');

console.log('🧪 Testing ALL Bet Types for Win Logic');
console.log('=====================================');

// Test scenarios
const testScenarios = [
    // COLOR TESTS
    {
        name: 'RED bet on GREEN result (should LOSE)',
        bet: { bet_type: 'COLOR:red' },
        result: { number: 3, color: 'green' },
        gameType: 'wingo',
        shouldWin: false
    },
    {
        name: 'RED bet on GREEN_VIOLET result (should LOSE)',
        bet: { bet_type: 'COLOR:red' },
        result: { number: 5, color: 'green_violet' },
        gameType: 'wingo',
        shouldWin: false
    },
    {
        name: 'RED bet on RED result (should WIN)',
        bet: { bet_type: 'COLOR:red' },
        result: { number: 2, color: 'red' },
        gameType: 'wingo',
        shouldWin: true
    },
    {
        name: 'GREEN bet on RED result (should LOSE)',
        bet: { bet_type: 'COLOR:green' },
        result: { number: 2, color: 'red' },
        gameType: 'wingo',
        shouldWin: false
    },
    
    // SIZE TESTS
    {
        name: 'BIG bet on SMALL result (should LOSE)',
        bet: { bet_type: 'SIZE:big' },
        result: { number: 3, size: 'small' },
        gameType: 'wingo',
        shouldWin: false
    },
    {
        name: 'SMALL bet on BIG result (should LOSE)',
        bet: { bet_type: 'SIZE:small' },
        result: { number: 7, size: 'big' },
        gameType: 'wingo',
        shouldWin: false
    },
    {
        name: 'BIG bet on BIG result (should WIN)',
        bet: { bet_type: 'SIZE:big' },
        result: { number: 7, size: 'big' },
        gameType: 'wingo',
        shouldWin: true
    },
    
    // NUMBER TESTS
    {
        name: 'NUMBER 3 bet on NUMBER 5 result (should LOSE)',
        bet: { bet_type: 'NUMBER:3' },
        result: { number: 5, color: 'green_violet' },
        gameType: 'wingo',
        shouldWin: false
    },
    {
        name: 'NUMBER 5 bet on NUMBER 5 result (should WIN)',
        bet: { bet_type: 'NUMBER:5' },
        result: { number: 5, color: 'green_violet' },
        gameType: 'wingo',
        shouldWin: true
    }
];

console.log('📊 Running', testScenarios.length, 'test scenarios...\n');

let passedTests = 0;
let failedTests = 0;

async function runTests() {
    for (const scenario of testScenarios) {
        console.log(`🧪 Test: ${scenario.name}`);
        console.log(`   Bet: ${scenario.bet.bet_type}`);
        console.log(`   Result: ${JSON.stringify(scenario.result)}`);
        console.log(`   Expected: ${scenario.shouldWin ? 'WIN' : 'LOSE'}`);
        
        // Test the win logic using checkBetWin (await the async function)
        const actualWin = await checkBetWin(scenario.bet, scenario.result, scenario.gameType);
        console.log(`   Actual: ${actualWin ? 'WIN' : 'LOSE'}`);
        
        // Check if result matches expectation
        const testPassed = actualWin === scenario.shouldWin;
        if (testPassed) {
            console.log(`   ✅ PASSED`);
            passedTests++;
        } else {
            console.log(`   ❌ FAILED - This is the bug!`);
            failedTests++;
        }
        console.log('');
    }

    console.log('📊 Test Summary:');
    console.log(`   ✅ Passed: ${passedTests}`);
    console.log(`   ❌ Failed: ${failedTests}`);
    console.log(`   📈 Success Rate: ${((passedTests / testScenarios.length) * 100).toFixed(1)}%`);

    if (failedTests > 0) {
        console.log('\n🚨 BUGS FOUND! The following scenarios are incorrectly showing as wins:');
        for (let i = 0; i < testScenarios.length; i++) {
            const scenario = testScenarios[i];
            const actualWin = await checkBetWin(scenario.bet, scenario.result, scenario.gameType);
            if (actualWin !== scenario.shouldWin) {
                console.log(`   ${i + 1}. ${scenario.name}`);
                console.log(`      Expected: ${scenario.shouldWin ? 'WIN' : 'LOSE'}, Got: ${actualWin ? 'WIN' : 'LOSE'}`);
            }
        }
    } else {
        console.log('\n✅ All tests passed! The win logic is working correctly.');
    }
}

// Run the tests
runTests().catch(console.error); 