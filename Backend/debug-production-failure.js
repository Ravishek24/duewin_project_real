function getRedisClient() {
  if (!redisHelper) throw new Error('redisHelper not set!');
  return getRedisClient();
}
const redisHelper = require('./config/redis');

const { updateBetExposure, ensureModelsInitialized } = require('./services/gameLogicService');

async function debugProductionFailure() {
    try {
        console.log('🔍 [PROD_DEBUG] Reproducing production failure scenario...');
        
        // Initialize models
        await ensureModelsInitialized();
        
        // EXACT data from the failing production period
        const gameType = 'wingo';
        const duration = 30;
        const timeline = 'default';
        const periodId = '20250706000001849'; // The actual failing period
        const userId = 13; // The actual user
        
        console.log('📊 [PROD_DEBUG] Reproducing exact scenario:', {
            gameType, duration, timeline, periodId, userId
        });
        
        // Clear the exposure key first
        const exposureKey = `exposure:${gameType}:${duration}:${timeline}:${periodId}`;
        await redisClient.del(exposureKey);
        console.log('🧹 [PROD_DEBUG] Cleared exposure key:', exposureKey);
        
        // EXACT bet data from production
        const betData = {
            betType: 'COLOR',
            betValue: 'red', // User bet on RED
            netBetAmount: 98,
            odds: 2
        };
        
        console.log('🎯 [PROD_DEBUG] Calling updateBetExposure with exact production data...');
        console.log('🎯 [PROD_DEBUG] Bet data:', betData);
        
        // Call the exact same function that should have run in production
        await updateBetExposure(gameType, duration, periodId, betData, timeline);
        
        console.log('✅ [PROD_DEBUG] updateBetExposure completed');
        
        // Check what was actually written
        const exposures = await redisClient.hgetall(exposureKey);
        console.log('📊 [PROD_DEBUG] Exposures after updateBetExposure:', exposures);
        
        // Analyze the results
        console.log('\n📋 [PROD_DEBUG] Analysis:');
        
        if (Object.keys(exposures).length === 0) {
            console.log('❌ [BUG REPRODUCED] Exposure hash is empty - updateBetExposure failed!');
            console.log('💡 [BUG CAUSE] This explains why protection logic fails in production');
        } else {
            console.log('✅ [WORKING] Exposure hash has data:');
            for (const [key, value] of Object.entries(exposures)) {
                console.log(`   ${key}: ${(parseInt(value) / 100).toFixed(2)}₹`);
            }
            
            // Check which numbers should be zero exposure
            const zeroExposureNumbers = [];
            for (let num = 0; num <= 9; num++) {
                const exposure = parseInt(exposures[`number:${num}`] || 0);
                if (exposure === 0) {
                    zeroExposureNumbers.push(num);
                }
            }
            
            console.log('🔍 [ANALYSIS] Zero exposure numbers (should be GREEN [1,3,5,7,9]):', zeroExposureNumbers);
            
            if (zeroExposureNumbers.length === 5 && zeroExposureNumbers.every(n => [1,3,5,7,9].includes(n))) {
                console.log('✅ [SUCCESS] Exposure tracking working correctly');
                console.log('✅ [SUCCESS] Protection should select from GREEN numbers and user should lose');
            } else {
                console.log('❌ [BUG] Exposure tracking not working as expected');
            }
        }
        
        // Test the protection logic with this data
        console.log('\n🛡️ [PROD_DEBUG] Testing protection logic...');
        
        // Simulate what selectProtectedResultWithExposure would see
        const zeroExposureNumbers = [];
        for (let num = 0; num <= 9; num++) {
            const exposure = parseInt(exposures[`number:${num}`] || 0);
            if (exposure === 0) {
                zeroExposureNumbers.push(num);
            }
        }
        
        console.log('🔍 [PROTECTION] Zero exposure numbers available for selection:', zeroExposureNumbers);
        
        if (zeroExposureNumbers.length === 10) {
            console.log('❌ [BUG CONFIRMED] All numbers have zero exposure!');
            console.log('💡 [BUG IMPACT] Protection will randomly select from ALL numbers [0-9]');
            console.log('💡 [BUG RESULT] Sometimes picks RED (user loses), sometimes GREEN (user wins)');
        } else if (zeroExposureNumbers.length === 5) {
            console.log('✅ [WORKING] Only 5 numbers have zero exposure - this is correct');
        }
        
        console.log('\n🔍 [PROD_DEBUG] Production failure analysis completed');
        
    } catch (error) {
        console.error('❌ [PROD_DEBUG] Error during reproduction:', error);
        console.error('❌ [PROD_DEBUG] Stack:', error.stack);
    }
}

// Run the debug
debugProductionFailure().then(() => {
    console.log('🎯 Production failure analysis completed');
    process.exit(0);
}).catch((error) => {
    console.error('❌ [FATAL] Production debug failed:', error);
    process.exit(1);
}); 