let redisHelper = null;
function setRedisHelper(helper) { redisHelper = helper; }



const redisClient = 

async function testSingleUserProtection() {
    console.log('🧪 Testing Single User Protection (Should NEVER Win)');
    console.log('===================================================');
    
    const gameType = 'wingo';
    const duration = 30;
    const periodId = 'test_protection_' + Date.now();
    const timeline = 'default';
    const userId = 'single_user_123';
    
    try {
        // Simulate a single user placing a bet on RED
        console.log('\n📝 Simulating single user bet on RED...');
        
        const bet = {
            id: 'bet_1',
            userId: userId,
            gameType: gameType,
            duration: duration,
            periodId: periodId,
            betType: 'COLOR',
            betValue: 'red',
            amount: 100,
            timestamp: Date.now()
        };
        
        // Store bet in Redis
        const betHashKey = `bets:${gameType}:${duration}:${timeline}:${periodId}`;
        const exposureKey = `exposure:${gameType}:${duration}:${periodId}`;
        const userCountKey = `unique_users:${gameType}:${duration}:${timeline}:${periodId}`;
        
        // Store bet
        await redisClient.hset(betHashKey, bet.id, JSON.stringify(bet));
        
        // Update exposure for RED numbers (0,2,4,6,8)
        await redisClient.hincrby(exposureKey, 'number:0', bet.amount * 100);
        await redisClient.hincrby(exposureKey, 'number:2', bet.amount * 100);
        await redisClient.hincrby(exposureKey, 'number:4', bet.amount * 100);
        await redisClient.hincrby(exposureKey, 'number:6', bet.amount * 100);
        await redisClient.hincrby(exposureKey, 'number:8', bet.amount * 100);
        
        // Store unique user count (single user)
        await redisClient.sadd(userCountKey, userId);
        
        console.log('✅ Bet stored successfully');
        
        // Check current state
        console.log('\n📊 Current state:');
        const exposures = await redisClient.hgetall(exposureKey);
        console.log('  Exposures:');
        for (let num = 0; num <= 9; num++) {
            const exposure = parseInt(exposures[`number:${num}`] || 0) / 100;
            console.log(`    Number ${num}: ${exposure}₹`);
        }
        
        const uniqueUsers = await redisClient.scard(userCountKey);
        console.log(`  Unique users: ${uniqueUsers}`);
        
        // Test the protection logic step by step
        console.log('\n🛡️ Testing protection logic step by step...');
        
        // Step 1: Check user count
        console.log('\n1️⃣ Checking user count...');
        if (uniqueUsers < 100) {
            console.log(`   ❌ User count (${uniqueUsers}) < threshold (100) - Protection should activate`);
        } else {
            console.log(`   ✅ User count (${uniqueUsers}) >= threshold (100) - No protection needed`);
        }
        
        // Step 2: Analyze user bets
        console.log('\n2️⃣ Analyzing user bets...');
        const betsData = await redisClient.hgetall(betHashKey);
        const userBetOutcomes = new Set();
        
        for (const [betId, betJson] of Object.entries(betsData)) {
            try {
                const bet = JSON.parse(betJson);
                if (bet.betType === 'COLOR' && bet.betValue === 'red') {
                    // User bet on red - add red numbers
                    userBetOutcomes.add(0); userBetOutcomes.add(2); 
                    userBetOutcomes.add(4); userBetOutcomes.add(6); 
                    userBetOutcomes.add(8);
                } else if (bet.betType === 'COLOR' && bet.betValue === 'green') {
                    // User bet on green - add green numbers
                    userBetOutcomes.add(1); userBetOutcomes.add(3); 
                    userBetOutcomes.add(5); userBetOutcomes.add(7); 
                    userBetOutcomes.add(9);
                } else if (bet.betType === 'NUMBER') {
                    // User bet on specific number
                    userBetOutcomes.add(parseInt(bet.betValue));
                }
            } catch (parseError) {
                continue;
            }
        }
        
        console.log(`   User bet on outcomes: [${Array.from(userBetOutcomes).sort((a,b) => a-b).join(', ')}]`);
        
        // Step 3: Find losing numbers
        console.log('\n3️⃣ Finding losing numbers...');
        const losingNumbers = [];
        for (let num = 0; num <= 9; num++) {
            if (!userBetOutcomes.has(num)) {
                losingNumbers.push(num);
            }
        }
        
        console.log(`   Losing numbers (user did NOT bet on): [${losingNumbers.join(', ')}]`);
        
        // Step 4: Test protection selection
        console.log('\n4️⃣ Testing protection selection...');
        if (losingNumbers.length === 0) {
            console.log('   ⚠️ User bet on ALL numbers! Using lowest exposure fallback');
            let minExposure = Infinity;
            let lowestExposureNumber = 0;
            
            for (let num = 0; num <= 9; num++) {
                const exposure = parseInt(exposures[`number:${num}`] || 0);
                if (exposure < minExposure) {
                    minExposure = exposure;
                    lowestExposureNumber = num;
                }
            }
            
            console.log(`   🛡️ Selected lowest exposure number: ${lowestExposureNumber} (${minExposure/100}₹)`);
            
            // Check if user would win
            const userWouldWin = userBetOutcomes.has(lowestExposureNumber);
            console.log(`   ${userWouldWin ? '❌ BUG: User would still win!' : '✅ Protection working: User loses'}`);
            
        } else {
            // Select a random losing number
            const randomLosingNumber = losingNumbers[Math.floor(Math.random() * losingNumbers.length)];
            console.log(`   🛡️ Selected losing number: ${randomLosingNumber}`);
            
            // Check if user would win
            const userWouldWin = userBetOutcomes.has(randomLosingNumber);
            console.log(`   ${userWouldWin ? '❌ BUG: User would still win!' : '✅ Protection working: User loses'}`);
        }
        
        // Step 5: Simulate multiple periods
        console.log('\n5️⃣ Simulating multiple periods...');
        const periods = 10;
        let wins = 0;
        let losses = 0;
        
        for (let i = 1; i <= periods; i++) {
            const testPeriodId = `test_period_${i}_${Date.now()}`;
            
            // Simulate the same bet for each period
            const testBetHashKey = `bets:${gameType}:${duration}:${timeline}:${testPeriodId}`;
            const testExposureKey = `exposure:${gameType}:${duration}:${testPeriodId}`;
            const testUserCountKey = `unique_users:${gameType}:${duration}:${timeline}:${testPeriodId}`;
            
            // Store bet
            await redisClient.hset(testBetHashKey, bet.id, JSON.stringify(bet));
            
            // Update exposure
            await redisClient.hincrby(testExposureKey, 'number:0', bet.amount * 100);
            await redisClient.hincrby(testExposureKey, 'number:2', bet.amount * 100);
            await redisClient.hincrby(testExposureKey, 'number:4', bet.amount * 100);
            await redisClient.hincrby(testExposureKey, 'number:6', bet.amount * 100);
            await redisClient.hincrby(testExposureKey, 'number:8', bet.amount * 100);
            
            // Store single user
            await redisClient.sadd(testUserCountKey, userId);
            
            // Simulate protection logic
            const testBetsData = await redisClient.hgetall(testBetHashKey);
            const testUserBetOutcomes = new Set();
            
            for (const [betId, betJson] of Object.entries(testBetsData)) {
                try {
                    const bet = JSON.parse(betJson);
                    if (bet.betType === 'COLOR' && bet.betValue === 'red') {
                        testUserBetOutcomes.add(0); testUserBetOutcomes.add(2); 
                        testUserBetOutcomes.add(4); testUserBetOutcomes.add(6); 
                        testUserBetOutcomes.add(8);
                    }
                } catch (parseError) {
                    continue;
                }
            }
            
            const testLosingNumbers = [];
            for (let num = 0; num <= 9; num++) {
                if (!testUserBetOutcomes.has(num)) {
                    testLosingNumbers.push(num);
                }
            }
            
            let selectedNumber;
            if (testLosingNumbers.length === 0) {
                // Use lowest exposure
                const testExposures = await redisClient.hgetall(testExposureKey);
                let minExposure = Infinity;
                selectedNumber = 0;
                
                for (let num = 0; num <= 9; num++) {
                    const exposure = parseInt(testExposures[`number:${num}`] || 0);
                    if (exposure < minExposure) {
                        minExposure = exposure;
                        selectedNumber = num;
                    }
                }
            } else {
                // Use random losing number
                selectedNumber = testLosingNumbers[Math.floor(Math.random() * testLosingNumbers.length)];
            }
            
            const userWon = testUserBetOutcomes.has(selectedNumber);
            if (userWon) {
                wins++;
                console.log(`   Period ${i}: ❌ User WON (selected ${selectedNumber})`);
            } else {
                losses++;
                console.log(`   Period ${i}: ✅ User LOST (selected ${selectedNumber})`);
            }
            
            // Cleanup test data
            await redisClient.del(testBetHashKey);
            await redisClient.del(testExposureKey);
            await redisClient.del(testUserCountKey);
        }
        
        console.log(`\n📊 Results: ${wins} wins, ${losses} losses out of ${periods} periods`);
        
        if (wins > 0) {
            console.log('❌ BUG FOUND: Single user is winning when they should never win!');
            console.log('🔧 The protection logic needs to be fixed.');
        } else {
            console.log('✅ Protection working correctly: Single user never wins!');
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        // Cleanup
        await redisClient.del(`bets:${gameType}:${duration}:${timeline}:${periodId}`);
        await redisClient.del(`exposure:${gameType}:${duration}:${periodId}`);
        await redisClient.del(`unique_users:${gameType}:${duration}:${timeline}:${periodId}`);
        await redisClient.quit();
    }
}

testSingleUserProtection(); 
module.exports = { setRedisHelper };
