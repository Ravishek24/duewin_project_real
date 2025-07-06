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

async function debugProtectionFailure() {
    try {
        console.log('🔍 [DEBUG] Debugging protection failure in period 1756...');
        
        const gameType = 'wingo';
        const duration = '30';
        const timeline = 'default';
        const periodId = '20250706000001756';
        
        // Check bet data
        console.log('\n📝 [DEBUG] Step 1: Checking bet data...');
        const betKey = `bets:${gameType}:${duration}:${timeline}:${periodId}`;
        const betData = await redisClient.hgetall(betKey);
        
        console.log(`📝 [DEBUG] Bet key: ${betKey}`);
        console.log(`📝 [DEBUG] Bets found: ${Object.keys(betData).length}`);
        
        if (Object.keys(betData).length > 0) {
            console.log('📝 [DEBUG] Bet details:');
            for (const [betId, betJson] of Object.entries(betData)) {
                try {
                    const bet = JSON.parse(betJson);
                    console.log(`  - Bet ID: ${betId}`);
                    console.log(`    User ID: ${bet.userId}`);
                    console.log(`    Bet Type: ${bet.betType}`);
                    console.log(`    Bet Value: ${bet.betValue}`);
                    console.log(`    Bet Amount: ${bet.betAmount} cents`);
                    console.log(`    Net Bet Amount: ${bet.netBetAmount} cents`);
                    console.log(`    Odds: ${bet.odds}`);
                    console.log(`    Timestamp: ${new Date(bet.timestamp).toISOString()}`);
                } catch (parseError) {
                    console.log(`  - Bet ID: ${betId} (Parse error: ${parseError.message})`);
                }
            }
        } else {
            console.log('❌ [DEBUG] No bet data found!');
        }
        
        // Check exposure data
        console.log('\n💰 [DEBUG] Step 2: Checking exposure data...');
        const exposureKey = `exposure:${gameType}:${duration}:${timeline}:${periodId}`;
        const exposureData = await redisClient.hgetall(exposureKey);
        
        console.log(`💰 [DEBUG] Exposure key: ${exposureKey}`);
        console.log(`💰 [DEBUG] Exposure entries: ${Object.keys(exposureData).length}`);
        
        if (Object.keys(exposureData).length > 0) {
            console.log('💰 [DEBUG] Exposure details:');
            for (const [number, exposure] of Object.entries(exposureData)) {
                console.log(`  - ${number}: ${exposure} cents (${(exposure / 100).toFixed(2)}₹)`);
            }
        } else {
            console.log('❌ [DEBUG] No exposure data found!');
        }
        
        // Check unique user count
        console.log('\n👥 [DEBUG] Step 3: Checking unique user count...');
        const uniqueUsers = new Set();
        
        for (const [betId, betJson] of Object.entries(betData)) {
            try {
                const bet = JSON.parse(betJson);
                if (bet.userId) {
                    uniqueUsers.add(bet.userId);
                }
            } catch (parseError) {
                console.warn('👥 [DEBUG] Failed to parse bet for user count:', parseError.message);
            }
        }
        
        console.log(`👥 [DEBUG] Unique users: ${uniqueUsers.size}`);
        console.log(`👥 [DEBUG] User IDs: [${Array.from(uniqueUsers).join(', ')}]`);
        
        // Check protection threshold
        const ENHANCED_USER_THRESHOLD = 2; // From your config
        const meetsThreshold = uniqueUsers.size >= ENHANCED_USER_THRESHOLD;
        
        console.log(`👥 [DEBUG] Protection threshold: ${ENHANCED_USER_THRESHOLD}`);
        console.log(`👥 [DEBUG] Meets threshold: ${meetsThreshold ? '✅ YES' : '❌ NO'}`);
        
        // Check what result was generated
        console.log('\n🎯 [DEBUG] Step 4: Checking what result was generated...');
        
        // Look for result in Redis
        const resultKeys = await redisClient.keys(`*result*${periodId}*`);
        console.log(`🎯 [DEBUG] Result keys found: ${resultKeys.length}`);
        
        if (resultKeys.length > 0) {
            console.log('🎯 [DEBUG] Result keys:');
            resultKeys.forEach(key => console.log(`  - ${key}`));
            
            // Check result data
            for (const resultKey of resultKeys) {
                const resultData = await redisClient.get(resultKey);
                console.log(`🎯 [DEBUG] Result data for ${resultKey}:`, resultData);
            }
        }
        
        // Check database for result
        console.log('\n🎯 [DEBUG] Step 5: Checking database for result...');
        console.log('🎯 [DEBUG] You would need to check the database for period:', periodId);
        console.log('🎯 [DEBUG] Table: BetResultWingo');
        console.log('🎯 [DEBUG] Column: bet_number');
        console.log('🎯 [DEBUG] Value:', periodId);
        
        // Analyze protection logic
        console.log('\n🛡️ [DEBUG] Step 6: Protection logic analysis...');
        
        if (!meetsThreshold) {
            console.log('🛡️ [DEBUG] PROTECTION SHOULD HAVE ACTIVATED:');
            console.log('  - Single user detected');
            console.log('  - Should have used selectProtectedResultWithExposure()');
            console.log('  - Should have selected zero-exposure number');
        } else {
            console.log('🛡️ [DEBUG] PROTECTION NOT NEEDED:');
            console.log('  - Multiple users detected');
            console.log('  - Normal result generation used');
        }
        
        // Check if exposure calculation was correct
        console.log('\n💰 [DEBUG] Step 7: Exposure calculation verification...');
        
        for (const [betId, betJson] of Object.entries(betData)) {
            try {
                const bet = JSON.parse(betJson);
                const actualBetAmount = bet.netBetAmount || bet.betAmount || 0;
                const expectedExposure = Math.round(actualBetAmount * bet.odds * 100);
                
                console.log(`💰 [DEBUG] Bet ${betId} exposure calculation:`);
                console.log(`  - Bet amount: ${actualBetAmount} cents`);
                console.log(`  - Odds: ${bet.odds}`);
                console.log(`  - Expected exposure: ${expectedExposure} cents`);
                
                if (bet.betType === 'NUMBER') {
                    const actualExposure = parseInt(exposureData[`number:${bet.betValue}`] || 0);
                    console.log(`  - Actual exposure for number ${bet.betValue}: ${actualExposure} cents`);
                    
                    if (actualExposure === expectedExposure) {
                        console.log(`  ✅ Exposure calculation correct`);
                    } else {
                        console.log(`  ❌ Exposure calculation wrong! Expected: ${expectedExposure}, Got: ${actualExposure}`);
                    }
                }
            } catch (parseError) {
                console.log(`💰 [DEBUG] Failed to verify exposure for bet ${betId}: ${parseError.message}`);
            }
        }
        
        // Final analysis
        console.log('\n🎯 [DEBUG] FINAL ANALYSIS:');
        console.log(`📝 Bets: ${Object.keys(betData).length}`);
        console.log(`💰 Exposure entries: ${Object.keys(exposureData).length}`);
        console.log(`👥 Unique users: ${uniqueUsers.size}`);
        console.log(`🛡️ Protection threshold met: ${meetsThreshold ? 'YES' : 'NO'}`);
        
        if (!meetsThreshold) {
            console.log('❌ [DEBUG] PROTECTION FAILED:');
            console.log('  - Single user should have triggered protection');
            console.log('  - Check if selectProtectedResultWithExposure() was called');
            console.log('  - Check if zero-exposure numbers were available');
            console.log('  - Check if result was forced to make user lose');
        } else {
            console.log('✅ [DEBUG] PROTECTION WORKED AS EXPECTED:');
            console.log('  - Multiple users, normal result generation');
        }
        
    } catch (error) {
        console.error('❌ [DEBUG] Error during debugging:', error);
    } finally {
        redisClient.quit();
    }
}

// Run the debug
debugProtectionFailure(); 