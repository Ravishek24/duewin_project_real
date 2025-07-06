const gameLogicService = require('./services/gameLogicService');

async function analyzeWinLossLogic() {
    console.log('🎯 ANALYZING WIN/LOSS DETERMINATION LOGIC');
    console.log('=========================================\n');
    
    try {
        // Initialize combinations
        await gameLogicService.initializeGameCombinations();
        
        // Test scenarios
        const testScenarios = [
            {
                name: 'User bets RED, Result is GREEN (should LOSE)',
                bet: { bet_type: 'COLOR:red', amount_after_tax: 98 },
                result: { number: 3, color: 'green' },
                expected: false
            },
            {
                name: 'User bets RED, Result is RED (should WIN)',
                bet: { bet_type: 'COLOR:red', amount_after_tax: 98 },
                result: { number: 2, color: 'red' },
                expected: true
            },
            {
                name: 'User bets RED, Result is RED_VIOLET (should WIN)',
                bet: { bet_type: 'COLOR:red', amount_after_tax: 98 },
                result: { number: 0, color: 'red_violet' },
                expected: true
            },
            {
                name: 'User bets GREEN, Result is GREEN (should WIN)',
                bet: { bet_type: 'COLOR:green', amount_after_tax: 98 },
                result: { number: 1, color: 'green' },
                expected: true
            },
            {
                name: 'User bets GREEN, Result is GREEN_VIOLET (should WIN)',
                bet: { bet_type: 'COLOR:green', amount_after_tax: 98 },
                result: { number: 5, color: 'green_violet' },
                expected: true
            }
        ];
        
        console.log('🧪 Testing win/loss scenarios:\n');
        
        for (const scenario of testScenarios) {
            console.log(`📋 ${scenario.name}`);
            console.log(`   Bet: ${scenario.bet.bet_type}`);
            console.log(`   Result: Number ${scenario.result.number}, Color ${scenario.result.color}`);
            
            const winResult = await gameLogicService.checkBetWin(scenario.bet, scenario.result, 'wingo');
            
            console.log(`   Expected: ${scenario.expected ? 'WIN' : 'LOSE'}`);
            console.log(`   Actual: ${winResult ? 'WIN' : 'LOSE'}`);
            console.log(`   Status: ${winResult === scenario.expected ? '✅ CORRECT' : '❌ BUG FOUND!'}`);
            console.log('');
        }
        
        // Check the actual checkWinCondition function logic
        console.log('🔍 Analyzing checkWinCondition logic:\n');
        
        // Test RED bet logic
        console.log('🔴 RED bet logic:');
        for (let num = 0; num <= 9; num++) {
            const combo = global.wingoCombinations[num];
            const wins = gameLogicService.checkWinCondition(combo, 'COLOR', 'red');
            console.log(`   Number ${num} (${combo.color}): ${wins ? '✅ WINS' : '❌ NO WIN'}`);
        }
        
        console.log('\n🟢 GREEN bet logic:');
        for (let num = 0; num <= 9; num++) {
            const combo = global.wingoCombinations[num];
            const wins = gameLogicService.checkWinCondition(combo, 'COLOR', 'green');
            console.log(`   Number ${num} (${combo.color}): ${wins ? '✅ WINS' : '❌ NO WIN'}`);
        }
        
        // Check the actual bug from production data
        console.log('\n🚨 PRODUCTION BUG ANALYSIS:');
        console.log('Based on your report: User 13 bet RED, result was GREEN, but user WON');
        console.log('');
        
        const productionBet = { bet_type: 'COLOR:red', amount_after_tax: 98 };
        const productionResult = { number: 3, color: 'green' };
        
        const productionWinCheck = await gameLogicService.checkBetWin(productionBet, productionResult, 'wingo');
        
        console.log('📊 Production scenario test:');
        console.log(`   User bets: ${productionBet.bet_type}`);
        console.log(`   Result: Number ${productionResult.number}, Color ${productionResult.color}`);
        console.log(`   Win check result: ${productionWinCheck}`);
        console.log(`   Expected: false (user should lose)`);
        console.log(`   Actual: ${productionWinCheck}`);
        console.log(`   Status: ${productionWinCheck === false ? '✅ LOGIC CORRECT' : '❌ LOGIC BUGGED'}`);
        
        if (productionWinCheck === false) {
            console.log('\n🎯 CONCLUSION:');
            console.log('The win/loss logic is CORRECT!');
            console.log('The bug must be elsewhere in the system.');
            console.log('');
            console.log('Possible causes:');
            console.log('1. Results are processed by a different system');
            console.log('2. Database records are updated incorrectly');
            console.log('3. Multiple result processing paths exist');
            console.log('4. Timing issues between bet placement and result processing');
        } else {
            console.log('\n🎯 CONCLUSION:');
            console.log('The win/loss logic has a BUG!');
            console.log('This is the root cause of the issue.');
        }
        
    } catch (error) {
        console.error('❌ Analysis failed:', error.message);
    }
}

// Run the analysis
analyzeWinLossLogic().catch(console.error); 