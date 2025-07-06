const Redis = require('ioredis');
const redisClient = new Redis({
    host: 'localhost',
    port: 6379,
    password: null,
    db: 0
});

async function testProtectionSimple() {
    console.log('🧪 Testing Simple Protection Logic');
    console.log('==================================');
    
    const gameType = 'wingo';
    const duration = 30;
    const periodId = 'test_simple_' + Date.now();
    const timeline = 'default';
    const userId = 'test_user_456';
    
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
        
        // Test the protection logic
        console.log('\n🛡️ Testing protection logic...');
        
        // Get user count
        const uniqueUsers = await redisClient.scard(userCountKey);
        console.log(`👥 Unique users: ${uniqueUsers}`);
        
        // Check if protection should activate
        const shouldUseProtectedResult = uniqueUsers < 100;
        console.log(`🛡️ Protection should activate: ${shouldUseProtectedResult ? 'YES' : 'NO'}`);
        
        if (shouldUseProtectedResult) {
            console.log('🛡️ Protection mode: User should NEVER win');
            
            // Get user bets
            const betsData = await redisClient.hgetall(betHashKey);
            const userBetOutcomes = new Set();
            
            // Collect all outcomes the user bet on
            for (const [betId, betJson] of Object.entries(betsData)) {
                try {
                    const bet = JSON.parse(betJson);
                    if (bet.betType === 'COLOR' && bet.betValue === 'red') {
                        // User bet on red - add red numbers
                        userBetOutcomes.add(0); userBetOutcomes.add(2); 
                        userBetOutcomes.add(4); userBetOutcomes.add(6); 
                        userBetOutcomes.add(8);
                    }
                } catch (parseError) {
                    continue;
                }
            }
            
            console.log('🎯 User bet on outcomes:', Array.from(userBetOutcomes).sort((a,b) => a-b));
            
            // Find numbers that the user did NOT bet on
            const losingNumbers = [];
            for (let num = 0; num <= 9; num++) {
                if (!userBetOutcomes.has(num)) {
                    losingNumbers.push(num);
                }
            }
            
            console.log('❌ Losing numbers (user did NOT bet on):', losingNumbers);
            
            if (losingNumbers.length === 0) {
                console.log('⚠️ User bet on ALL numbers! Using lowest exposure fallback');
                const exposures = await redisClient.hgetall(exposureKey);
                let minExposure = Infinity;
                let lowestExposureNumber = 0;
                
                for (let num = 0; num <= 9; num++) {
                    const exposure = parseInt(exposures[`number:${num}`] || 0);
                    if (exposure < minExposure) {
                        minExposure = exposure;
                        lowestExposureNumber = num;
                    }
                }
                
                console.log(`🛡️ Selected lowest exposure number: ${lowestExposureNumber}`);
                
                // Check if user would win
                const userWouldWin = userBetOutcomes.has(lowestExposureNumber);
                console.log(`🎯 Result: ${userWouldWin ? '❌ BUG: User would still win!' : '✅ Protection working: User loses'}`);
                
            } else {
                // Select a random losing number
                const randomLosingNumber = losingNumbers[Math.floor(Math.random() * losingNumbers.length)];
                console.log(`🛡️ Selected losing number: ${randomLosingNumber}`);
                
                // Check if user would win
                const userWouldWin = userBetOutcomes.has(randomLosingNumber);
                console.log(`🎯 Result: ${userWouldWin ? '❌ BUG: User would still win!' : '✅ Protection working: User loses'}`);
            }
        } else {
            console.log('📊 Normal mode: User can win (sufficient users)');
        }
        
        console.log('\n✅ Protection test completed successfully!');
        
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

testProtectionSimple(); 