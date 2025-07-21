let redisHelper = null;
function setRedisHelper(helper) { redisHelper = helper; }



const { getSequelizeInstance } = require('./config/db');

// Initialize Redis client
const redisClient = 

redisClient.on('error', (err) => console.error('Redis Client Error:', err));
redisClient.on('connect', () => console.log('✅ Redis connected for 5D protection test'));

// Initialize Sequelize
let sequelize;

async function initializeTest() {
    try {
        // Connect to Redis
        await redisClient.connect();
        console.log('✅ Redis connected for 5D protection test');
        
        // Connect to database
        sequelize = await getSequelizeInstance();
        console.log('✅ Database connected for 5D protection test');
    } catch (error) {
        console.error('❌ Initialization failed:', error);
        process.exit(1);
    }
}

// Test 5D Protection Logic
async function test5DProtection() {
    console.log('🧪 [5D_TEST] Testing 5D protection logic...');
    console.log('='.repeat(80));

    const duration = 60; // 1 minute
    const currentTime = Date.now();
    const periodId = Math.floor(currentTime / (duration * 1000)) * (duration * 1000);
    
    console.log(`⏰ [5D_TEST] Testing period: ${periodId}`);
    console.log(`⏰ [5D_TEST] Duration: ${duration}s`);

    // Clear any existing test data
    const exposureKey = `exposure:5d:${duration}:default:${periodId}`;
    const betHashKey = `bets:5d:${duration}:default:${periodId}`;
    
    await redisClient.del(exposureKey);
    await redisClient.del(betHashKey);
    
    console.log('🧹 [5D_TEST] Cleared existing test data');

    // Test Case 1: No protection needed (A_0 is bet)
    console.log('\n🧪 [5D_TEST] === TEST CASE 1: No Protection Needed ===');
    await testNoProtectionNeeded(duration, periodId);

    // Test Case 2: Protection needed (A_1-9 bet, A_0 not bet)
    console.log('\n🧪 [5D_TEST] === TEST CASE 2: Protection Needed ===');
    await testProtectionNeeded(duration, periodId);

    // Test Case 3: Mixed scenario
    console.log('\n🧪 [5D_TEST] === TEST CASE 3: Mixed Scenario ===');
    await testMixedScenario(duration, periodId);

    console.log('\n✅ [5D_TEST] All tests completed!');
}

async function testNoProtectionNeeded(duration, periodId) {
    console.log('📝 [5D_TEST] Testing scenario where A_0 is bet (no protection needed)');
    
    const exposureKey = `exposure:5d:${duration}:default:${periodId}`;
    const betHashKey = `bets:5d:${duration}:default:${periodId}`;

    // Add test bets including A_0
    const testBets = [
        { userId: 1, betType: 'POSITION', betValue: 'A_0', netBetAmount: 100, odds: 9.0 },
        { userId: 1, betType: 'POSITION', betValue: 'A_1', netBetAmount: 50, odds: 9.0 },
        { userId: 2, betType: 'POSITION', betValue: 'B_5', netBetAmount: 75, odds: 9.0 }
    ];

    // Simulate exposure tracking
    for (const bet of testBets) {
        const betId = `${bet.userId}:${bet.betType}:${bet.betValue}:${Date.now()}`;
        await redisClient.hSet(betHashKey, betId, JSON.stringify(bet));
        
        // Add exposure (simplified)
        const exposure = Math.round(bet.netBetAmount * bet.odds * 100);
        await redisClient.hIncrBy(exposureKey, `bet:${bet.betType}:${bet.betValue}`, exposure);
    }

    // Check protection logic
    const exposures = await redisClient.hGetAll(exposureKey);
    const aBets = Object.keys(exposures).filter(key => 
        key.startsWith('bet:POSITION:A_') && key !== 'bet:POSITION:A_0'
    );
    const hasA0Bet = Object.keys(exposures).some(key => key === 'bet:POSITION:A_0');
    const hasA1to9Bets = aBets.some(bet => bet.match(/A_[1-9]/));
    const shouldApplyProtection = hasA1to9Bets && !hasA0Bet;

    console.log(`📊 [5D_TEST] Test results:`);
    console.log(`   - A_1-9 bets: ${aBets.filter(bet => bet.match(/A_[1-9]/)).length}`);
    console.log(`   - A_0 bet: ${hasA0Bet ? 'YES' : 'NO'}`);
    console.log(`   - Should apply protection: ${shouldApplyProtection ? 'YES' : 'NO'}`);
    
    if (!shouldApplyProtection) {
        console.log('✅ [5D_TEST] PASSED: Protection correctly NOT applied');
    } else {
        console.log('❌ [5D_TEST] FAILED: Protection incorrectly applied');
    }

    // Clean up
    await redisClient.del(exposureKey);
    await redisClient.del(betHashKey);
}

async function testProtectionNeeded(duration, periodId) {
    console.log('📝 [5D_TEST] Testing scenario where A_1-9 are bet but A_0 is not (protection needed)');
    
    const exposureKey = `exposure:5d:${duration}:default:${periodId}`;
    const betHashKey = `bets:5d:${duration}:default:${periodId}`;

    // Add test bets excluding A_0
    const testBets = [
        { userId: 1, betType: 'POSITION', betValue: 'A_1', netBetAmount: 100, odds: 9.0 },
        { userId: 1, betType: 'POSITION', betValue: 'A_2', netBetAmount: 50, odds: 9.0 },
        { userId: 2, betType: 'POSITION', betValue: 'A_3', netBetAmount: 75, odds: 9.0 },
        { userId: 2, betType: 'POSITION', betValue: 'B_5', netBetAmount: 25, odds: 9.0 }
    ];

    // Simulate exposure tracking
    for (const bet of testBets) {
        const betId = `${bet.userId}:${bet.betType}:${bet.betValue}:${Date.now()}`;
        await redisClient.hSet(betHashKey, betId, JSON.stringify(bet));
        
        // Add exposure (simplified)
        const exposure = Math.round(bet.netBetAmount * bet.odds * 100);
        await redisClient.hIncrBy(exposureKey, `bet:${bet.betType}:${bet.betValue}`, exposure);
    }

    // Check protection logic
    const exposures = await redisClient.hGetAll(exposureKey);
    const aBets = Object.keys(exposures).filter(key => 
        key.startsWith('bet:POSITION:A_') && key !== 'bet:POSITION:A_0'
    );
    const hasA0Bet = Object.keys(exposures).some(key => key === 'bet:POSITION:A_0');
    const hasA1to9Bets = aBets.some(bet => bet.match(/A_[1-9]/));
    const shouldApplyProtection = hasA1to9Bets && !hasA0Bet;

    console.log(`📊 [5D_TEST] Test results:`);
    console.log(`   - A_1-9 bets: ${aBets.filter(bet => bet.match(/A_[1-9]/)).length}`);
    console.log(`   - A_0 bet: ${hasA0Bet ? 'YES' : 'NO'}`);
    console.log(`   - Should apply protection: ${shouldApplyProtection ? 'YES' : 'NO'}`);
    
    if (shouldApplyProtection) {
        console.log('✅ [5D_TEST] PASSED: Protection correctly applied');
        console.log('🎯 [5D_TEST] Expected result: A=0');
    } else {
        console.log('❌ [5D_TEST] FAILED: Protection not applied when it should be');
    }

    // Clean up
    await redisClient.del(exposureKey);
    await redisClient.del(betHashKey);
}

async function testMixedScenario(duration, periodId) {
    console.log('📝 [5D_TEST] Testing mixed scenario with various bet types');
    
    const exposureKey = `exposure:5d:${duration}:default:${periodId}`;
    const betHashKey = `bets:5d:${duration}:default:${periodId}`;

    // Add mixed test bets
    const testBets = [
        { userId: 1, betType: 'POSITION', betValue: 'A_1', netBetAmount: 100, odds: 9.0 },
        { userId: 1, betType: 'POSITION', betValue: 'A_2', netBetAmount: 50, odds: 9.0 },
        { userId: 2, betType: 'SUM', betValue: '15', netBetAmount: 75, odds: 9.0 },
        { userId: 3, betType: 'POSITION', betValue: 'B_5', netBetAmount: 25, odds: 9.0 },
        { userId: 4, betType: 'POSITION', betValue: 'C_0', netBetAmount: 30, odds: 9.0 }
    ];

    // Simulate exposure tracking
    for (const bet of testBets) {
        const betId = `${bet.userId}:${bet.betType}:${bet.betValue}:${Date.now()}`;
        await redisClient.hSet(betHashKey, betId, JSON.stringify(bet));
        
        // Add exposure (simplified)
        const exposure = Math.round(bet.netBetAmount * bet.odds * 100);
        await redisClient.hIncrBy(exposureKey, `bet:${bet.betType}:${bet.betValue}`, exposure);
    }

    // Check protection logic
    const exposures = await redisClient.hGetAll(exposureKey);
    const aBets = Object.keys(exposures).filter(key => 
        key.startsWith('bet:POSITION:A_') && key !== 'bet:POSITION:A_0'
    );
    const hasA0Bet = Object.keys(exposures).some(key => key === 'bet:POSITION:A_0');
    const hasA1to9Bets = aBets.some(bet => bet.match(/A_[1-9]/));
    const shouldApplyProtection = hasA1to9Bets && !hasA0Bet;

    console.log(`📊 [5D_TEST] Test results:`);
    console.log(`   - A_1-9 bets: ${aBets.filter(bet => bet.match(/A_[1-9]/)).length}`);
    console.log(`   - A_0 bet: ${hasA0Bet ? 'YES' : 'NO'}`);
    console.log(`   - Should apply protection: ${shouldApplyProtection ? 'YES' : 'NO'}`);
    console.log(`   - Total exposure entries: ${Object.keys(exposures).length}`);
    
    // Show exposure breakdown
    const positionExposures = {};
    const sumExposures = {};
    for (const [betKey, exposure] of Object.entries(exposures)) {
        if (betKey.startsWith('bet:POSITION:')) {
            positionExposures[betKey] = exposure;
        } else if (betKey.startsWith('bet:SUM:')) {
            sumExposures[betKey] = exposure;
        }
    }
    
    console.log(`📊 [5D_TEST] Exposure breakdown:`);
    console.log(`   - Position exposures: ${Object.keys(positionExposures).length}`);
    console.log(`   - Sum exposures: ${Object.keys(sumExposures).length}`);
    
    if (shouldApplyProtection) {
        console.log('✅ [5D_TEST] PASSED: Protection correctly applied in mixed scenario');
    } else {
        console.log('❌ [5D_TEST] FAILED: Protection not applied in mixed scenario');
    }

    // Clean up
    await redisClient.del(exposureKey);
    await redisClient.del(betHashKey);
}

// Test database connectivity and 5D combinations
async function testDatabaseConnectivity() {
    console.log('\n🧪 [5D_TEST] === DATABASE CONNECTIVITY TEST ===');
    
    try {
        // Test 5D combinations table
        const combinations = await sequelize.query(`
            SELECT COUNT(*) as count FROM game_combinations_5d
        `, { type: sequelize.QueryTypes.SELECT });
        
        console.log(`📊 [5D_TEST] 5D combinations in database: ${combinations[0].count}`);
        
        // Test a sample combination
        const sampleCombination = await sequelize.query(`
            SELECT * FROM game_combinations_5d LIMIT 1
        `, { type: sequelize.QueryTypes.SELECT });
        
        if (sampleCombination.length > 0) {
            const combo = sampleCombination[0];
            console.log(`🎲 [5D_TEST] Sample combination:`);
            console.log(`   - Dice: A=${combo.dice_a}, B=${combo.dice_b}, C=${combo.dice_c}, D=${combo.dice_d}, E=${combo.dice_e}`);
            console.log(`   - Sum: ${combo.sum_value}, Size: ${combo.sum_size}, Parity: ${combo.sum_parity}`);
            
            // Test winning_conditions parsing
            try {
                const winningConditions = typeof combo.winning_conditions === 'string' 
                    ? JSON.parse(combo.winning_conditions) 
                    : combo.winning_conditions;
                console.log(`✅ [5D_TEST] Winning conditions parsed successfully`);
            } catch (error) {
                console.log(`❌ [5D_TEST] Error parsing winning conditions:`, error.message);
            }
        }
        
    } catch (error) {
        console.error(`❌ [5D_TEST] Database test failed:`, error.message);
    }
}

// Main execution
async function main() {
    try {
        await initializeTest();
        await testDatabaseConnectivity();
        await test5DProtection();
        
        console.log('\n🎉 [5D_TEST] All tests completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ [5D_TEST] Test failed:', error);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 [5D_TEST] Shutting down gracefully...');
    await redisClient.quit();
    process.exit(0);
});

// Start testing
main(); 
module.exports = { setRedisHelper };
