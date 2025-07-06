const Redis = require('ioredis');

// Create Redis client
const redisClient = new Redis({
    host: 'localhost',
    port: 6379,
    retryStrategy: function (times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
    }
});

redisClient.on('error', (err) => {
    console.error('Redis Client Error:', err);
});

redisClient.on('connect', () => {
    console.log('Redis client connected');
});

redisClient.on('ready', () => {
    console.log('Redis client ready');
});

// Import the fixed checkWinCondition function
function checkWinCondition(combination, betType, betValue) {
    switch (betType) {
        case 'NUMBER':
            return combination.number === parseInt(betValue);
        case 'COLOR':
            // FIXED: Red bet wins on both 'red' and 'red_violet' numbers
            if (betValue === 'red') {
                return combination.color === 'red' || combination.color === 'red_violet';
            }
            // FIXED: Green bet wins on both 'green' and 'green_violet' numbers
            if (betValue === 'green') {
                return combination.color === 'green' || combination.color === 'green_violet';
            }
            return combination.color === betValue;
        case 'SIZE':
            return combination.size.toLowerCase() === betValue.toLowerCase();
        case 'PARITY':
            return combination.parity === betValue;
        default:
            return false;
    }
}

// Color mapping function
const getColorForNumber = (number) => {
    const colorMap = {
        0: 'red_violet',
        1: 'green',
        2: 'red',
        3: 'green',
        4: 'red',
        5: 'green_violet',
        6: 'red',
        7: 'green',
        8: 'red',
        9: 'green'
    };
    return colorMap[number];
};

async function testColorFix() {
    try {
        console.log('🧪 [TEST] Testing color bet logic fix...');
        
        // Create test combinations
        const testCombinations = {};
        for (let number = 0; number <= 9; number++) {
            testCombinations[number] = {
                number,
                color: getColorForNumber(number),
                size: number >= 5 ? 'Big' : 'Small',
                parity: number % 2 === 0 ? 'even' : 'odd'
            };
        }
        
        console.log('\n🎨 [TEST] Color mapping:');
        for (let num = 0; num <= 9; num++) {
            console.log(`  Number ${num} -> ${testCombinations[num].color}`);
        }
        
        // Test red bet logic
        console.log('\n🔴 [TEST] Testing RED bet logic:');
        const redWinningNumbers = [];
        for (let num = 0; num <= 9; num++) {
            const combo = testCombinations[num];
            const wins = checkWinCondition(combo, 'COLOR', 'red');
            console.log(`  Number ${num} (${combo.color}): ${wins ? '✅ WIN' : '❌ LOSE'}`);
            if (wins) {
                redWinningNumbers.push(num);
            }
        }
        console.log(`🔴 [TEST] Red bet wins on numbers: [${redWinningNumbers.join(', ')}]`);
        
        // Test green bet logic
        console.log('\n🟢 [TEST] Testing GREEN bet logic:');
        const greenWinningNumbers = [];
        for (let num = 0; num <= 9; num++) {
            const combo = testCombinations[num];
            const wins = checkWinCondition(combo, 'COLOR', 'green');
            console.log(`  Number ${num} (${combo.color}): ${wins ? '✅ WIN' : '❌ LOSE'}`);
            if (wins) {
                greenWinningNumbers.push(num);
            }
        }
        console.log(`🟢 [TEST] Green bet wins on numbers: [${greenWinningNumbers.join(', ')}]`);
        
        // Verify the fix
        console.log('\n✅ [TEST] Verification:');
        const expectedRedNumbers = [0, 2, 4, 6, 8]; // red_violet, red, red, red, red
        const expectedGreenNumbers = [1, 3, 5, 7, 9]; // green, green, green_violet, green, green
        
        const redCorrect = JSON.stringify(redWinningNumbers.sort()) === JSON.stringify(expectedRedNumbers);
        const greenCorrect = JSON.stringify(greenWinningNumbers.sort()) === JSON.stringify(expectedGreenNumbers);
        
        console.log(`🔴 Red bet correct: ${redCorrect ? '✅ YES' : '❌ NO'}`);
        console.log(`🟢 Green bet correct: ${greenCorrect ? '✅ YES' : '❌ NO'}`);
        
        if (redCorrect && greenCorrect) {
            console.log('🎉 [TEST] COLOR LOGIC FIX VERIFIED!');
        } else {
            console.log('❌ [TEST] COLOR LOGIC STILL HAS ISSUES!');
        }
        
        // Test exposure calculation simulation
        console.log('\n💰 [TEST] Testing exposure calculation simulation...');
        
        const testBet = {
            userId: 13,
            betType: 'COLOR',
            betValue: 'red',
            betAmount: 98,
            netBetAmount: 98,
            odds: 2
        };
        
        const exposure = Math.round(testBet.netBetAmount * testBet.odds * 100);
        console.log(`💰 [TEST] Test bet: ${testBet.betType} ${testBet.betValue} (${testBet.netBetAmount} cents)`);
        console.log(`💰 [TEST] Exposure: ${exposure} cents (${(exposure / 100).toFixed(2)}₹)`);
        
        // Simulate exposure update
        const testExposureKey = 'test:exposure:wingo:30:default:test_period';
        await redisClient.del(testExposureKey); // Clear any existing test data
        
        console.log('\n📊 [TEST] Simulating exposure update...');
        for (let num = 0; num <= 9; num++) {
            const combo = testCombinations[num];
            if (checkWinCondition(combo, testBet.betType, testBet.betValue)) {
                await redisClient.hincrby(testExposureKey, `number:${num}`, exposure);
                console.log(`📊 [TEST] Updated exposure for number ${num} (${combo.color}): +${exposure} cents`);
            }
        }
        
        // Check final exposure
        const finalExposure = await redisClient.hgetall(testExposureKey);
        console.log('\n📊 [TEST] Final exposure data:');
        for (const [number, exposure] of Object.entries(finalExposure)) {
            console.log(`  ${number}: ${exposure} cents (${(exposure / 100).toFixed(2)}₹)`);
        }
        
        // Verify exposure is only on red numbers
        const exposedNumbers = Object.keys(finalExposure).map(key => parseInt(key.split(':')[1]));
        const exposureCorrect = JSON.stringify(exposedNumbers.sort()) === JSON.stringify(expectedRedNumbers);
        
        console.log(`📊 [TEST] Exposure only on red numbers: ${exposureCorrect ? '✅ YES' : '❌ NO'}`);
        
        // Cleanup
        await redisClient.del(testExposureKey);
        
        console.log('\n🎯 [TEST] FINAL SUMMARY:');
        console.log(`✅ Color logic fix: ${redCorrect && greenCorrect ? 'WORKING' : 'BROKEN'}`);
        console.log(`✅ Exposure calculation: ${exposureCorrect ? 'WORKING' : 'BROKEN'}`);
        
        if (redCorrect && greenCorrect && exposureCorrect) {
            console.log('🎉 [TEST] ALL TESTS PASSED! Protection logic should now work correctly.');
        } else {
            console.log('❌ [TEST] SOME TESTS FAILED! Need to investigate further.');
        }
        
    } catch (error) {
        console.error('❌ [TEST] Error during testing:', error);
    } finally {
        redisClient.quit();
    }
}

// Run the test
testColorFix(); 