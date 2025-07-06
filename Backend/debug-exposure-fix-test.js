const { updateBetExposure, selectProtectedResultWithExposure, checkBetWin } = require('./services/gameLogicService');
const { redisClient } = require('./config/redis');
const gameLogicService = require('./services/gameLogicService');

// Comprehensive diagnostic function below replaces simple test

async function debugUpdateBetExposure() {
    console.log('🔧 EXPOSURE FUNCTION DIAGNOSTIC TEST');
    console.log('===================================\n');

    // Test data
    const testData = {
        gameType: 'wingo',
        duration: 30,
        timeline: 'default',
        periodId: '20250706TEST001',
        bet: {
            userId: 13,
            betType: 'COLOR',
            betValue: 'red',
            netBetAmount: 98,
            platformFee: 2,
            grossBetAmount: 100,
            timestamp: Date.now()
        }
    };

    try {
        // Step 1: Clear any existing data
        const exposureKey = `exposure:${testData.gameType}:${testData.duration}:${testData.timeline}:${testData.periodId}`;
        await redisClient.del(exposureKey);
        console.log('🧹 Step 1: Cleared existing data');

        // Step 2: Initialize combinations
        console.log('\n🎲 Step 2: Initialize combinations');
        await gameLogicService.initializeGameCombinations();
        console.log('✅ Combinations initialized');
        
        // Check if combinations exist
        console.log('🔍 Wing combinations exist:', !!global.wingoCombinations);
        if (global.wingoCombinations) {
            console.log('📊 Sample combination (0):', global.wingoCombinations[0]);
        }

        // Step 3: Manual exposure calculation
        console.log('\n🧮 Step 3: Manual calculation test');
        const { betType, betValue, netBetAmount } = testData.bet;
        const odds = gameLogicService.calculateOdds(testData.gameType, betType, betValue);
        const exposure = Math.round(netBetAmount * odds * 100); // Convert to cents
        
        console.log('📊 Calculation details:');
        console.log(`   - Bet Type: ${betType}`);
        console.log(`   - Bet Value: ${betValue}`);
        console.log(`   - Net Amount: ${netBetAmount}`);
        console.log(`   - Odds: ${odds}`);
        console.log(`   - Exposure (cents): ${exposure}`);
        console.log(`   - Exposure (rupees): ${exposure / 100}`);

        // Step 4: Test checkWinCondition for each number
        console.log('\n🎯 Step 4: Test win conditions');
        const winningNumbers = [];
        for (let num = 0; num <= 9; num++) {
            const combo = global.wingoCombinations[num];
            const wins = gameLogicService.checkWinCondition(combo, betType, betValue);
            console.log(`   Number ${num} (${combo.color}): ${wins ? '✅ WINS' : '❌ NO WIN'}`);
            if (wins) winningNumbers.push(num);
        }
        console.log(`🎯 Expected winning numbers: [${winningNumbers.join(', ')}]`);

        // Step 5: Test direct Redis operations
        console.log('\n💾 Step 5: Test direct Redis operations');
        
        // Try manual Redis writes
        for (const num of winningNumbers) {
            await redisClient.hincrby(exposureKey, `number:${num}`, exposure);
            console.log(`   ✅ Manually wrote exposure for number ${num}`);
        }
        
        // Verify manual write
        const manualResult = await redisClient.hgetall(exposureKey);
        console.log('📊 Manual Redis result:', manualResult);
        
        // Clear for next test
        await redisClient.del(exposureKey);

        // Step 6: Test the actual updateBetExposure function
        console.log('\n🔧 Step 6: Test updateBetExposure function');
        
        // Add detailed logging to catch any errors
        const originalLog = console.log;
        const originalError = console.error;
        let capturedLogs = [];
        
        console.log = (...args) => {
            capturedLogs.push(['LOG', ...args]);
            originalLog(...args);
        };
        
        console.error = (...args) => {
            capturedLogs.push(['ERROR', ...args]);
            originalError(...args);
        };
        
        try {
            const result = await gameLogicService.updateBetExposure(
                testData.gameType,
                testData.duration,
                testData.periodId,
                testData.bet,
                testData.timeline
            );
            
            console.log('🔧 updateBetExposure returned:', result);
            
        } catch (error) {
            console.error('❌ updateBetExposure threw error:', error);
        }
        
        // Restore console
        console.log = originalLog;
        console.error = originalError;
        
        // Check result
        const functionResult = await redisClient.hgetall(exposureKey);
        console.log('📊 Function Redis result:', functionResult);
        console.log('📊 Result count:', Object.keys(functionResult).length);
        
        if (Object.keys(functionResult).length === 0) {
            console.log('\n❌ FUNCTION FAILED TO WRITE DATA');
            console.log('📋 Captured logs during function call:');
            capturedLogs.forEach(([type, ...args]) => {
                console.log(`   ${type}:`, ...args);
            });
        } else {
            console.log('\n✅ FUNCTION WORKED CORRECTLY');
        }

        // Step 7: Test the specific logic branches
        console.log('\n🌿 Step 7: Test specific logic paths');
        
        // Test the bet parsing
        console.log('🔍 Testing bet parsing logic:');
        const bet = testData.bet;
        
        // Test legacy format path
        console.log('   Legacy format test:');
        const legacyBet = {
            betType: 'COLOR',
            betValue: 'red',
            netBetAmount: 98,
            odds: 2
        };
        console.log('   - betType exists:', !!legacyBet.betType);
        console.log('   - betValue exists:', !!legacyBet.betValue);
        console.log('   - odds exists:', !!legacyBet.odds);
        
        // Test production format path  
        console.log('   Production format test:');
        const prodBet = {
            bet_type: 'COLOR:red',
            netBetAmount: 98
        };
        console.log('   - bet_type exists:', !!prodBet.bet_type);
        if (prodBet.bet_type) {
            const [pType, pValue] = prodBet.bet_type.split(':');
            console.log(`   - parsed betType: ${pType}`);
            console.log(`   - parsed betValue: ${pValue}`);
        }

        // Step 8: Check Redis client state
        console.log('\n🔌 Step 8: Redis client diagnostics');
        console.log('   Redis connected:', redisClient.isReady);
        console.log('   Redis status:', redisClient.status);
        
        // Test basic Redis operation
        await redisClient.set('test:key', 'test:value');
        const testVal = await redisClient.get('test:key');
        console.log('   Basic Redis test:', testVal === 'test:value' ? '✅ PASS' : '❌ FAIL');
        await redisClient.del('test:key');

    } catch (error) {
        console.error('❌ Diagnostic failed:', error);
        console.error('Stack:', error.stack);
    } finally {
        console.log('\n✅ Diagnostic completed');
    }
}

// Run the diagnostic
debugUpdateBetExposure().catch(console.error); 