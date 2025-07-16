const redis = require('redis');

async function checkRedisPeriod() {
    const client = redis.createClient();
    
    try {
        await client.connect();
        console.log('Connected to Redis');
        
        const periodId = '20250711000000043';
        const gameType = '5d';
        const duration = 60;
        const timeline = 'default';
        
        const betHashKey = `bets:${gameType}:${duration}:${timeline}:${periodId}`;
        const exposureKey = `exposure:${gameType}:${duration}:${timeline}:${periodId}`;
        const resultKey = `result:${gameType}:${duration}:${timeline}:${periodId}`;
        
        console.log('Checking Redis data for period:', periodId);
        console.log('Bet hash key:', betHashKey);
        console.log('Exposure key:', exposureKey);
        console.log('Result key:', resultKey);
        
        // Check bets data
        const betsData = await client.hGetAll(betHashKey);
        console.log('\n=== BETS DATA ===');
        console.log('Number of bets:', Object.keys(betsData).length);
        console.log('Bets:', betsData);
        
        // Check exposure data
        const exposureData = await client.hGetAll(exposureKey);
        console.log('\n=== EXPOSURE DATA ===');
        console.log('Number of exposures:', Object.keys(exposureData).length);
        console.log('Exposures:', exposureData);
        
        // Check result data
        const resultData = await client.get(resultKey);
        console.log('\n=== RESULT DATA ===');
        console.log('Result:', resultData);
        
        // Check if there are any other 5D periods with data
        console.log('\n=== CHECKING OTHER 5D PERIODS ===');
        const allKeys = await client.keys('bets:5d:*');
        console.log('All 5D bet keys:', allKeys);
        
        if (allKeys.length > 0) {
            console.log('\n=== CHECKING FIRST AVAILABLE PERIOD ===');
            const firstKey = allKeys[0];
            console.log('Checking key:', firstKey);
            
            const firstBetsData = await client.hGetAll(firstKey);
            console.log('Bets in first period:', firstBetsData);
            
            // Extract period ID from key
            const periodMatch = firstKey.match(/bets:5d:\d+:\w+:(\d+)/);
            if (periodMatch) {
                const actualPeriodId = periodMatch[1];
                console.log('Actual period ID found:', actualPeriodId);
                
                // Check exposures for this period
                const actualExposureKey = `exposure:5d:60:default:${actualPeriodId}`;
                const actualExposureData = await client.hGetAll(actualExposureKey);
                console.log('Exposures for actual period:', actualExposureData);
                
                // Analyze position exposures for dice A
                console.log('\n=== DICE A POSITION ANALYSIS FOR ACTUAL PERIOD ===');
                const diceAExposures = {};
                for (let i = 0; i <= 9; i++) {
                    const key = `bet:POSITION:A_${i}`;
                    const exposure = actualExposureData[key] || '0';
                    diceAExposures[`A_${i}`] = exposure;
                    console.log(`A_${i}: ${exposure}`);
                }
                
                // Find zero exposure positions for dice A
                const zeroExposurePositions = [];
                for (const [position, exposure] of Object.entries(diceAExposures)) {
                    if (exposure === '0' || exposure === 0) {
                        zeroExposurePositions.push(position);
                    }
                }
                
                console.log('\n=== ZERO EXPOSURE POSITIONS FOR DICE A ===');
                console.log('Zero exposure positions:', zeroExposurePositions);
                
                if (zeroExposurePositions.length === 1) {
                    console.log('✅ Only one zero exposure position found for dice A:', zeroExposurePositions[0]);
                    console.log('This should have been selected by protection logic');
                } else if (zeroExposurePositions.length === 0) {
                    console.log('❌ No zero exposure positions found for dice A');
                } else {
                    console.log('⚠️ Multiple zero exposure positions found for dice A:', zeroExposurePositions);
                }
            }
        }
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await client.quit();
    }
}

checkRedisPeriod().catch(console.error); 