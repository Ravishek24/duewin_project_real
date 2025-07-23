let redisHelper = null;
function setRedisHelper(helper) { redisHelper = helper; }


const { Sequelize } = require('sequelize');
const config = require('./config/config.cjs');
const { initializeGameCombinations } = require('./services/gameLogicService');

// Import Redis properly

const { CACHE } = require('./config/constants');

// Redis configuration
const redisConfig = {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || '',
    db: process.env.REDIS_DB || 0,
    keyPrefix: CACHE.PREFIX,
    retryStrategy: function(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
    }
};

// Create Redis client
const redisClient = 

const gameLogicService = require('./services/gameLogicService');

async function examineK3Exposure() {
    try {
        console.log('🎲 [K3_EXPOSURE_ANALYSIS] Examining K3 Exposure System');
        console.log('=====================================================');

        // Initialize combinations
        await gameLogicService.initializeGameCombinations();
        
        console.log('\n📊 [K3_COMBINATIONS] K3 Combination Analysis:');
        console.log(`Total K3 combinations: ${Object.keys(global.k3Combinations).length}`);
        
        // Show sample combinations
        const sampleCombos = Object.entries(global.k3Combinations).slice(0, 5);
        console.log('\n🎲 Sample K3 Combinations:');
        sampleCombos.forEach(([key, combo]) => {
            console.log(`  ${key}: [${combo.dice_1},${combo.dice_2},${combo.dice_3}] = Sum:${combo.sum}, Patterns:`, {
                triple: combo.patterns.triple,
                pair: combo.patterns.pair,
                straight: combo.patterns.straight,
                allDifferent: combo.patterns.all_different
            });
        });

        // Test exposure calculation for different bet types
        console.log('\n🧪 [K3_EXPOSURE_TEST] Testing Exposure Calculation:');
        
        const testPeriodId = 'k3_test_' + Date.now();
        const testDuration = 600; // 10 minutes
        const testTimeline = 'default';
        
        // Test different bet types
        const testBets = [
            { betType: 'SUM', betValue: '10', betAmount: 100, description: 'SUM bet on 10' },
            { betType: 'SUM_CATEGORY', betValue: 'big', betAmount: 100, description: 'SUM_CATEGORY bet on big' },
            { betType: 'MATCHING_DICE', betValue: 'triple_any', betAmount: 100, description: 'MATCHING_DICE bet on triple_any' },
            { betType: 'PATTERN', betValue: 'all_different', betAmount: 100, description: 'PATTERN bet on all_different' }
        ];

        for (const testBet of testBets) {
            console.log(`\n🔍 Testing: ${testBet.description}`);
            
            // Clear previous exposure
            const exposureKey = `exposure:k3:${testDuration}:${testTimeline}:${testPeriodId}`;
            await redisClient.del(exposureKey);
            
            // Calculate odds
            const odds = gameLogicService.calculateOdds('k3', testBet.betType, testBet.betValue);
            console.log(`  Odds: ${odds}x`);
            
            // Simulate bet exposure update
            const betData = {
                bet_type: `${testBet.betType}:${testBet.betValue}`,
                amount_after_tax: testBet.betAmount,
                netBetAmount: testBet.betAmount
            };
            
            await gameLogicService.updateBetExposure('k3', testDuration, testPeriodId, betData, testTimeline);
            
            // Get exposure data
            const exposureData = await redisClient.hgetall(exposureKey);
            const exposureCount = Object.keys(exposureData).length;
            
            console.log(`  Exposure entries created: ${exposureCount}`);
            console.log(`  Exposure entries per combination: ${(exposureCount / 216 * 100).toFixed(1)}%`);
            
            // Show sample exposures
            const sampleExposures = Object.entries(exposureData).slice(0, 3);
            console.log('  Sample exposures:');
            sampleExposures.forEach(([key, value]) => {
                const exposureInRupees = parseInt(value) / 100;
                console.log(`    ${key}: ₹${exposureInRupees}`);
            });
            
            // Calculate total exposure
            const totalExposure = Object.values(exposureData).reduce((sum, value) => sum + parseInt(value), 0) / 100;
            console.log(`  Total exposure: ₹${totalExposure}`);
            console.log(`  Average exposure per combination: ₹${(totalExposure / 216).toFixed(2)}`);
        }

        // Analyze exposure distribution
        console.log('\n📈 [K3_EXPOSURE_DISTRIBUTION] Exposure Distribution Analysis:');
        
        // Test with a SUM bet to see distribution
        const analysisExposureKey = `exposure:k3:${testDuration}:${testTimeline}:analysis_${Date.now()}`;
        await redisClient.del(analysisExposureKey);
        
        const analysisBet = {
            bet_type: 'SUM:10',
            amount_after_tax: 100,
            netBetAmount: 100
        };
        
        await gameLogicService.updateBetExposure('k3', testDuration, 'analysis_period', analysisBet, testTimeline);
        
        const analysisData = await redisClient.hgetall(analysisExposureKey);
        
        // Group by sum values
        const sumDistribution = {};
        for (const [key, value] of Object.entries(analysisData)) {
            if (key.startsWith('dice:')) {
                const diceKey = key.replace('dice:', '');
                const combo = global.k3Combinations[diceKey];
                if (combo) {
                    const sum = combo.sum;
                    if (!sumDistribution[sum]) {
                        sumDistribution[sum] = { count: 0, totalExposure: 0 };
                    }
                    sumDistribution[sum].count++;
                    sumDistribution[sum].totalExposure += parseInt(value) / 100;
                }
            }
        }
        
        console.log('\n🎯 SUM Distribution (SUM:10 bet):');
        Object.entries(sumDistribution)
            .sort(([a], [b]) => parseInt(a) - parseInt(b))
            .forEach(([sum, data]) => {
                const avgExposure = data.totalExposure / data.count;
                console.log(`  Sum ${sum}: ${data.count} combinations, Avg exposure: ₹${avgExposure.toFixed(2)}`);
            });

        // Show why K3 exposure is large
        console.log('\n⚠️ [K3_EXPOSURE_ISSUES] Why K3 Exposure is Large:');
        console.log('1. 216 combinations vs 10 for Wingo (21.6x more)');
        console.log('2. Each bet affects multiple combinations');
        console.log('3. High multipliers (up to 207.36x) create large exposures');
        console.log('4. Complex bet types affect many combinations simultaneously');
        
        // Memory usage analysis
        console.log('\n💾 [K3_MEMORY_USAGE] Memory Usage Analysis:');
        const avgKeySize = 20; // Average Redis key size
        const avgValueSize = 10; // Average Redis value size
        const totalMemory = Object.keys(analysisData).length * (avgKeySize + avgValueSize);
        console.log(`Estimated memory per K3 period: ${totalMemory} bytes`);
        console.log(`With 216 combinations: ~${216 * (avgKeySize + avgValueSize)} bytes per bet`);
        
        // Performance impact
        console.log('\n⚡ [K3_PERFORMANCE] Performance Impact:');
        console.log('1. 216 Redis operations per bet (vs 10 for Wingo)');
        console.log('2. 21.6x more memory usage');
        console.log('3. Slower exposure calculations');
        console.log('4. More complex result selection');

        // Cleanup
        await redisClient.del(analysisExposureKey);
        
        console.log('\n✅ [K3_EXPOSURE_ANALYSIS] Analysis Complete!');

    } catch (error) {
        console.error('❌ Error examining K3 exposure:', error);
    } finally {
        await redisClient.quit();
        process.exit(0);
    }
}

// Run the analysis
examineK3Exposure(); 
module.exports = { setRedisHelper };
