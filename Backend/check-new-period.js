let redisHelper = null;
function setRedisHelper(helper) { redisHelper = helper; }




async function checkNewPeriod() {
    const client = 
    
    try {
        await client.connect();
        console.log('Connected to Redis');
        
        const periodId = '20250711000000067';
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
        
        // Analyze position exposures for dice A
        console.log('\n=== DICE A POSITION ANALYSIS ===');
        const diceAExposures = {};
        for (let i = 0; i <= 9; i++) {
            const key = `bet:POSITION:A_${i}`;
            const exposure = exposureData[key] || '0';
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
        
        // Check if there's a result and analyze it
        if (resultData) {
            try {
                const result = JSON.parse(resultData);
                console.log('\n=== RESULT ANALYSIS ===');
                console.log('Parsed result:', result);
                
                if (result.A !== undefined) {
                    console.log(`🎯 Result A=${result.A}, which means A_${result.A} won`);
                    
                    // Check which A positions would win with this result
                    let winningCount = 0;
                    for (let i = 0; i <= 9; i++) {
                        const key = `bet:POSITION:A_${i}`;
                        const hasBet = exposureData[key] && exposureData[key] !== '0';
                        if (hasBet && i === result.A) {
                            winningCount++;
                            console.log(`✅ A_${i} wins (has bet)`);
                        } else if (hasBet && i !== result.A) {
                            console.log(`❌ A_${i} loses (has bet)`);
                        } else if (!hasBet) {
                            console.log(`ℹ️ A_${i} no bet`);
                        }
                    }
                    
                    console.log(`📊 Total winning A positions with bets: ${winningCount}`);
                    
                    if (winningCount === 0) {
                        console.log('✅ Protection working correctly - no A positions with bets won');
                    } else if (winningCount === 1) {
                        console.log('✅ Protection working correctly - only one A position won');
                    } else {
                        console.log('❌ Protection failed - multiple A positions won');
                    }
                }
            } catch (parseError) {
                console.log('Could not parse result data:', parseError.message);
            }
        }
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await client.quit();
    }
}

checkNewPeriod().catch(console.error); 
module.exports = { setRedisHelper };
