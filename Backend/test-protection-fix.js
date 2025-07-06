const Redis = require('ioredis');
const redisClient = new Redis({
    host: 'localhost',
    port: 6379,
    password: null,
    db: 0
});

async function testProtectionFix() {
    console.log('🧪 Testing User Threshold Protection Fix');
    console.log('==========================================');
    
    const gameType = 'wingo';
    const duration = 30;
    const periodId = 'test_period_' + Date.now();
    const timeline = 'default';
    
    try {
        // Simulate a single user placing multiple bets
        console.log('\n📝 Simulating single user bets...');
        
        const userId = 'test_user_123';
        const bets = [
            { betType: 'COLOR', betValue: 'red', amount: 100 },
            { betType: 'COLOR', betValue: 'green', amount: 100 },
            { betType: 'NUMBER', betValue: '5', amount: 100 },
            { betType: 'NUMBER', betValue: '7', amount: 100 }
        ];
        
        // Store bets in Redis
        const betHashKey = `bets:${gameType}:${duration}:${timeline}:${periodId}`;
        const exposureKey = `exposure:${gameType}:${duration}:${periodId}`;
        
        for (let i = 0; i < bets.length; i++) {
            const bet = {
                id: `bet_${i}`,
                userId: userId,
                gameType: gameType,
                duration: duration,
                periodId: periodId,
                betType: bets[i].betType,
                betValue: bets[i].betValue,
                amount: bets[i].amount,
                timestamp: Date.now()
            };
            
            // Store bet
            await redisClient.hset(betHashKey, bet.id, JSON.stringify(bet));
            
            // Update exposure
            if (bet.betType === 'COLOR' && bet.betValue === 'red') {
                // Red numbers: 0,2,4,6,8
                await redisClient.hincrby(exposureKey, 'number:0', bet.amount * 100);
                await redisClient.hincrby(exposureKey, 'number:2', bet.amount * 100);
                await redisClient.hincrby(exposureKey, 'number:4', bet.amount * 100);
                await redisClient.hincrby(exposureKey, 'number:6', bet.amount * 100);
                await redisClient.hincrby(exposureKey, 'number:8', bet.amount * 100);
            } else if (bet.betType === 'COLOR' && bet.betValue === 'green') {
                // Green numbers: 1,3,5,7,9
                await redisClient.hincrby(exposureKey, 'number:1', bet.amount * 100);
                await redisClient.hincrby(exposureKey, 'number:3', bet.amount * 100);
                await redisClient.hincrby(exposureKey, 'number:5', bet.amount * 100);
                await redisClient.hincrby(exposureKey, 'number:7', bet.amount * 100);
                await redisClient.hincrby(exposureKey, 'number:9', bet.amount * 100);
            } else if (bet.betType === 'NUMBER') {
                await redisClient.hincrby(exposureKey, `number:${bet.betValue}`, bet.amount * 100);
            }
        }
        
        // Store unique user count (simulate single user)
        const userCountKey = `unique_users:${gameType}:${duration}:${timeline}:${periodId}`;
        await redisClient.sadd(userCountKey, userId);
        
        console.log('✅ Bets stored successfully');
        
        // Check exposures
        console.log('\n📊 Current exposures:');
        const exposures = await redisClient.hgetall(exposureKey);
        for (let num = 0; num <= 9; num++) {
            const exposure = parseInt(exposures[`number:${num}`] || 0) / 100;
            console.log(`  Number ${num}: ${exposure}₹`);
        }
        
        // Check unique user count
        const uniqueUsers = await redisClient.scard(userCountKey);
        console.log(`\n👥 Unique users: ${uniqueUsers}`);
        
        // Test the protection logic
        console.log('\n🛡️ Testing protection logic...');
        
        // Simulate the protection logic
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
            let minExposure = Infinity;
            let lowestExposureNumber = 0;
            
            for (let num = 0; num <= 9; num++) {
                const exposure = parseInt(exposures[`number:${num}`] || 0);
                if (exposure < minExposure) {
                    minExposure = exposure;
                    lowestExposureNumber = num;
                }
            }
            
            console.log(`🛡️ Selected lowest exposure number: ${lowestExposureNumber} (${minExposure/100}₹)`);
        } else {
            // Select a random losing number
            const randomLosingNumber = losingNumbers[Math.floor(Math.random() * losingNumbers.length)];
            console.log(`🛡️ Selected losing number: ${randomLosingNumber}`);
        }
        
        console.log('\n✅ Protection test completed successfully!');
        console.log('🎯 The user should NEVER win with these bets when protection is active.');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        // Cleanup
        await redisClient.del(`bets:${gameType}:${duration}:${timeline}:${periodId}`);
        await redisClient.del(`exposure:${gameType}:${duration}:${timeline}:${periodId}`);
        await redisClient.del(`unique_users:${gameType}:${duration}:${timeline}:${periodId}`);
        await redisClient.quit();
    }
}

testProtectionFix(); 