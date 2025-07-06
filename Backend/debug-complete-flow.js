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

// Import the game logic functions (simplified versions for debugging)
function checkWinCondition(combination, betType, betValue) {
    switch (betType) {
        case 'NUMBER':
            return combination.number === parseInt(betValue);
        case 'COLOR':
            if (betValue === 'red') {
                return combination.color === 'red' || combination.color === 'red_violet';
            }
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

async function debugCompleteFlow() {
    try {
        console.log('🔍 [DEBUG] Starting complete flow debugging...');
        
        // Step 1: Check current Redis state
        console.log('\n📊 [DEBUG] Step 1: Current Redis State');
        const allKeys = await redisClient.keys('*');
        const betKeys = allKeys.filter(key => key.includes('bets'));
        const exposureKeys = allKeys.filter(key => key.includes('exposure'));
        
        console.log(`📊 [DEBUG] Total keys: ${allKeys.length}`);
        console.log(`📊 [DEBUG] Bet keys: ${betKeys.length}`);
        console.log(`📊 [DEBUG] Exposure keys: ${exposureKeys.length}`);
        
        if (betKeys.length === 0) {
            console.log('❌ [DEBUG] No bet keys found - place a bet first!');
            return;
        }
        
        // Find the most recent period with bets
        const recentBetKey = betKeys[betKeys.length - 1];
        console.log(`📊 [DEBUG] Analyzing most recent period: ${recentBetKey}`);
        
        // Extract period info
        const parts = recentBetKey.split(':');
        const gameType = parts[1];
        const duration = parts[2];
        const timeline = parts[3];
        const periodId = parts[4];
        
        console.log(`📊 [DEBUG] Period info: gameType=${gameType}, duration=${duration}, timeline=${timeline}, periodId=${periodId}`);
        
        // Step 2: Analyze bet data
        console.log('\n📝 [DEBUG] Step 2: Analyzing Bet Data');
        const betData = await redisClient.hgetall(recentBetKey);
        console.log(`📝 [DEBUG] Bets found: ${Object.keys(betData).length}`);
        
        const uniqueUsers = new Set();
        const betDetails = [];
        
        for (const [betId, betJson] of Object.entries(betData)) {
            try {
                const bet = JSON.parse(betJson);
                uniqueUsers.add(bet.userId);
                betDetails.push({
                    betId,
                    userId: bet.userId,
                    betType: bet.betType,
                    betValue: bet.betValue,
                    betAmount: bet.betAmount,
                    netBetAmount: bet.netBetAmount,
                    odds: bet.odds
                });
                
                console.log(`📝 [DEBUG] Bet ${betId}: User ${bet.userId}, ${bet.betType} ${bet.betValue}, ${bet.netBetAmount} cents, odds ${bet.odds}`);
            } catch (parseError) {
                console.log(`📝 [DEBUG] Failed to parse bet ${betId}: ${parseError.message}`);
            }
        }
        
        console.log(`📝 [DEBUG] Unique users: ${uniqueUsers.size} (${Array.from(uniqueUsers).join(', ')})`);
        
        // Step 3: Check protection threshold
        console.log('\n🛡️ [DEBUG] Step 3: Protection Threshold Check');
        const ENHANCED_USER_THRESHOLD = 2; // From your config
        const meetsThreshold = uniqueUsers.size >= ENHANCED_USER_THRESHOLD;
        
        console.log(`🛡️ [DEBUG] Protection threshold: ${ENHANCED_USER_THRESHOLD}`);
        console.log(`🛡️ [DEBUG] Unique users: ${uniqueUsers.size}`);
        console.log(`🛡️ [DEBUG] Meets threshold: ${meetsThreshold ? '✅ YES' : '❌ NO'}`);
        
        if (!meetsThreshold) {
            console.log('🛡️ [DEBUG] PROTECTION SHOULD ACTIVATE - Single user detected!');
        } else {
            console.log('🛡️ [DEBUG] Protection not needed - Multiple users detected');
        }
        
        // Step 4: Analyze exposure data
        console.log('\n💰 [DEBUG] Step 4: Analyzing Exposure Data');
        const exposureKey = `exposure:${gameType}:${duration}:${timeline}:${periodId}`;
        const exposureData = await redisClient.hgetall(exposureKey);
        
        console.log(`💰 [DEBUG] Exposure key: ${exposureKey}`);
        console.log(`💰 [DEBUG] Exposure entries: ${Object.keys(exposureData).length}`);
        
        if (Object.keys(exposureData).length > 0) {
            console.log('💰 [DEBUG] Exposure details:');
            for (const [number, exposure] of Object.entries(exposureData)) {
                console.log(`  ${number}: ${exposure} cents (${(exposure / 100).toFixed(2)}₹)`);
            }
        } else {
            console.log('❌ [DEBUG] No exposure data found!');
        }
        
        // Step 5: Verify exposure calculation
        console.log('\n🧮 [DEBUG] Step 5: Verifying Exposure Calculation');
        for (const betDetail of betDetails) {
            const actualBetAmount = betDetail.netBetAmount || betDetail.betAmount || 0;
            const expectedExposure = Math.round(actualBetAmount * betDetail.odds * 100);
            
            console.log(`🧮 [DEBUG] Bet ${betDetail.betId} exposure calculation:`);
            console.log(`  - Bet amount: ${actualBetAmount} cents`);
            console.log(`  - Odds: ${betDetail.odds}`);
            console.log(`  - Expected exposure: ${expectedExposure} cents`);
            
            if (betDetail.betType === 'NUMBER') {
                const actualExposure = parseInt(exposureData[`number:${betDetail.betValue}`] || 0);
                console.log(`  - Actual exposure for number ${betDetail.betValue}: ${actualExposure} cents`);
                
                if (actualExposure === expectedExposure) {
                    console.log(`  ✅ Exposure calculation correct`);
                } else {
                    console.log(`  ❌ Exposure calculation wrong! Expected: ${expectedExposure}, Got: ${actualExposure}`);
                }
            } else if (betDetail.betType === 'COLOR') {
                // Check exposure for all numbers that would win
                const winningNumbers = [];
                for (let num = 0; num <= 9; num++) {
                    const combo = {
                        number: num,
                        color: getColorForNumber(num),
                        size: num >= 5 ? 'Big' : 'Small',
                        parity: num % 2 === 0 ? 'even' : 'odd'
                    };
                    
                    if (checkWinCondition(combo, betDetail.betType, betDetail.betValue)) {
                        winningNumbers.push(num);
                    }
                }
                
                console.log(`  - Winning numbers for ${betDetail.betType} ${betDetail.betValue}: [${winningNumbers.join(', ')}]`);
                
                let totalExposure = 0;
                for (const num of winningNumbers) {
                    const exposure = parseInt(exposureData[`number:${num}`] || 0);
                    totalExposure += exposure;
                    console.log(`  - Number ${num} exposure: ${exposure} cents`);
                }
                
                if (totalExposure === expectedExposure) {
                    console.log(`  ✅ Total exposure correct: ${totalExposure} cents`);
                } else {
                    console.log(`  ❌ Total exposure wrong! Expected: ${expectedExposure}, Got: ${totalExposure}`);
                }
            }
        }
        
        // Step 6: Simulate protection logic
        console.log('\n🎯 [DEBUG] Step 6: Simulating Protection Logic');
        
        if (!meetsThreshold) {
            console.log('🎯 [DEBUG] PROTECTION MODE: Finding zero-exposure numbers...');
            
            const zeroExposureNumbers = [];
            const exposureAnalysis = {};
            
            for (let num = 0; num <= 9; num++) {
                const exposure = parseInt(exposureData[`number:${num}`] || 0);
                exposureAnalysis[`number:${num}`] = `${(exposure / 100).toFixed(2)}₹`;
                
                if (exposure === 0) {
                    zeroExposureNumbers.push(num);
                }
            }
            
            console.log('🎯 [DEBUG] Exposure analysis:');
            for (const [number, exposure] of Object.entries(exposureAnalysis)) {
                console.log(`  ${number}: ${exposure}`);
            }
            
            console.log(`🎯 [DEBUG] Zero-exposure numbers: [${zeroExposureNumbers.join(', ')}]`);
            
            if (zeroExposureNumbers.length > 0) {
                console.log('✅ [DEBUG] Protection can work - zero-exposure numbers available');
                
                // Check if user would lose on these numbers
                for (const betDetail of betDetails) {
                    console.log(`🎯 [DEBUG] Checking if user loses on zero-exposure numbers:`);
                    for (const num of zeroExposureNumbers) {
                        const combo = {
                            number: num,
                            color: getColorForNumber(num),
                            size: num >= 5 ? 'Big' : 'Small',
                            parity: num % 2 === 0 ? 'even' : 'odd'
                        };
                        
                        const wins = checkWinCondition(combo, betDetail.betType, betDetail.betValue);
                        console.log(`  Number ${num} (${combo.color}): ${wins ? '❌ USER WINS' : '✅ USER LOSES'}`);
                    }
                }
            } else {
                console.log('❌ [DEBUG] Protection cannot work - no zero-exposure numbers!');
                console.log('❌ [DEBUG] This means the user bet on ALL possible numbers!');
            }
        } else {
            console.log('🎯 [DEBUG] NORMAL MODE: Multiple users, normal result generation');
        }
        
        // Step 7: Check what result was actually generated
        console.log('\n🎲 [DEBUG] Step 7: Checking Actual Result');
        
        // Look for result in Redis
        const resultKeys = await redisClient.keys(`*result*${periodId}*`);
        console.log(`🎲 [DEBUG] Result keys found: ${resultKeys.length}`);
        
        if (resultKeys.length > 0) {
            console.log('🎲 [DEBUG] Result keys:');
            resultKeys.forEach(key => console.log(`  - ${key}`));
            
            for (const resultKey of resultKeys) {
                const resultData = await redisClient.get(resultKey);
                console.log(`🎲 [DEBUG] Result data for ${resultKey}:`, resultData);
            }
        }
        
        // Check database for result
        console.log('\n🎲 [DEBUG] Database result check:');
        console.log('🎲 [DEBUG] You need to check the database for period:', periodId);
        console.log('🎲 [DEBUG] Table: BetResultWingo');
        console.log('🎲 [DEBUG] Column: bet_number');
        console.log('🎲 [DEBUG] Value:', periodId);
        
        // Step 8: Final analysis
        console.log('\n🎯 [DEBUG] FINAL ANALYSIS');
        console.log(`📝 Bets: ${Object.keys(betData).length}`);
        console.log(`👥 Unique users: ${uniqueUsers.size}`);
        console.log(`💰 Exposure entries: ${Object.keys(exposureData).length}`);
        console.log(`🛡️ Protection threshold met: ${meetsThreshold ? 'YES' : 'NO'}`);
        
        if (!meetsThreshold) {
            const zeroExposureNumbers = [];
            for (let num = 0; num <= 9; num++) {
                const exposure = parseInt(exposureData[`number:${num}`] || 0);
                if (exposure === 0) {
                    zeroExposureNumbers.push(num);
                }
            }
            
            console.log(`🎯 [DEBUG] Zero-exposure numbers available: ${zeroExposureNumbers.length}`);
            
            if (zeroExposureNumbers.length > 0) {
                console.log('✅ [DEBUG] Protection logic should have worked');
                console.log('❌ [DEBUG] But user still won - check result generation function!');
            } else {
                console.log('❌ [DEBUG] Protection cannot work - no zero-exposure numbers');
                console.log('❌ [DEBUG] User bet on all possible outcomes!');
            }
        } else {
            console.log('✅ [DEBUG] Protection not needed - multiple users');
        }
        
    } catch (error) {
        console.error('❌ [DEBUG] Error during debugging:', error);
    } finally {
        redisClient.quit();
    }
}

// Run the complete flow debug
debugCompleteFlow(); 