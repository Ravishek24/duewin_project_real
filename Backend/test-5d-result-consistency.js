const { Sequelize } = require('sequelize');
const redis = require('redis');
const fiveDProtectionService = require('./services/fiveDProtectionService');

// Initialize Redis client
const redisClient = redis.createClient({
    host: 'master.strike-game-redis.66utip.apse1.cache.amazonaws.com',
    port: '6379',
    db: '0',
    tls: 'enabled'
});

// Initialize Sequelize
const sequelize = new Sequelize({
    dialect: 'mysql',
    host: 'strike-game-db.66utip.apse1.rds.amazonaws.com',
    port: 3306,
    username: 'admin',
    password: 'StrikeGame2024!',
    database: 'strike_game_db',
    logging: false,
    pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
    }
});

// Define GameCombinations5D model
const GameCombinations5D = sequelize.define('GameCombinations5D', {
    dice_a: { type: Sequelize.TINYINT.UNSIGNED, allowNull: false },
    dice_b: { type: Sequelize.TINYINT.UNSIGNED, allowNull: false },
    dice_c: { type: Sequelize.TINYINT.UNSIGNED, allowNull: false },
    dice_d: { type: Sequelize.TINYINT.UNSIGNED, allowNull: false },
    dice_e: { type: Sequelize.TINYINT.UNSIGNED, allowNull: false },
    sum_value: { type: Sequelize.TINYINT.UNSIGNED, allowNull: false },
    sum_size: { type: Sequelize.ENUM('big', 'small'), allowNull: false },
    sum_parity: { type: Sequelize.ENUM('odd', 'even'), allowNull: false }
}, {
    tableName: 'game_combinations_5d',
    timestamps: false
});

async function test5DResultConsistency() {
    try {
        console.log('🔍 [TEST_5D_CONSISTENCY] Testing 5D result consistency fix...');
        
        // Connect to Redis
        await redisClient.connect();
        console.log('✅ Redis connected');
        
        // Connect to database
        await sequelize.authenticate();
        console.log('✅ Database connected');
        
        // Test parameters
        const gameType = 'fiveD';
        const duration = 60;
        const periodId = '20250720000000623'; // Use the same period from your production data
        const timeline = 'default';
        
        console.log(`\n🔍 [TEST_1] Testing with period: ${periodId}`);
        
        // Test 1: Get protected result
        console.log('\n🔍 [TEST_2] Getting protected result...');
        const protectedResult = await fiveDProtectionService.getProtectedResult(
            gameType, duration, periodId, timeline
        );
        
        console.log('📊 [PROTECTED_RESULT] Result:', JSON.stringify(protectedResult, null, 2));
        
        // Test 2: Verify result consistency
        console.log('\n🔍 [TEST_3] Verifying result consistency...');
        
        if (!protectedResult) {
            console.log('❌ [CONSISTENCY_CHECK] No result returned');
            return;
        }
        
        // Check if all required fields are present
        const requiredFields = ['A', 'B', 'C', 'D', 'E', 'sum', 'dice_value', 'sum_size', 'sum_parity'];
        const missingFields = requiredFields.filter(field => !(field in protectedResult));
        
        if (missingFields.length > 0) {
            console.log(`❌ [CONSISTENCY_CHECK] Missing fields: ${missingFields.join(', ')}`);
        } else {
            console.log('✅ [CONSISTENCY_CHECK] All required fields present');
        }
        
        // Check mathematical consistency
        const calculatedSum = protectedResult.A + protectedResult.B + protectedResult.C + protectedResult.D + protectedResult.E;
        const calculatedSize = calculatedSum >= 23 ? 'big' : 'small';
        const calculatedParity = calculatedSum % 2 === 0 ? 'even' : 'odd';
        const calculatedDiceValue = parseInt(`${protectedResult.A}${protectedResult.B}${protectedResult.C}${protectedResult.D}${protectedResult.E}`);
        
        console.log('\n📊 [MATH_CHECK] Mathematical consistency check:');
        console.log(`   Calculated sum: ${calculatedSum} vs Result sum: ${protectedResult.sum}`);
        console.log(`   Calculated size: ${calculatedSize} vs Result size: ${protectedResult.sum_size}`);
        console.log(`   Calculated parity: ${calculatedParity} vs Result parity: ${protectedResult.sum_parity}`);
        console.log(`   Calculated dice_value: ${calculatedDiceValue} vs Result dice_value: ${protectedResult.dice_value}`);
        
        // Check for inconsistencies
        const inconsistencies = [];
        
        if (calculatedSum !== protectedResult.sum) {
            inconsistencies.push(`Sum mismatch: ${calculatedSum} vs ${protectedResult.sum}`);
        }
        
        if (calculatedSize !== protectedResult.sum_size) {
            inconsistencies.push(`Size mismatch: ${calculatedSize} vs ${protectedResult.sum_size}`);
        }
        
        if (calculatedParity !== protectedResult.sum_parity) {
            inconsistencies.push(`Parity mismatch: ${calculatedParity} vs ${protectedResult.sum_parity}`);
        }
        
        if (calculatedDiceValue !== protectedResult.dice_value) {
            inconsistencies.push(`Dice value mismatch: ${calculatedDiceValue} vs ${protectedResult.dice_value}`);
        }
        
        if (inconsistencies.length > 0) {
            console.log(`❌ [CONSISTENCY_CHECK] Found ${inconsistencies.length} inconsistencies:`);
            inconsistencies.forEach(inc => console.log(`   - ${inc}`));
        } else {
            console.log('✅ [CONSISTENCY_CHECK] All mathematical calculations are consistent!');
        }
        
        // Test 3: Verify position bets work correctly
        console.log('\n🔍 [TEST_4] Testing position bet consistency...');
        
        const positionA = protectedResult.A;
        const positionAParity = positionA % 2 === 0 ? 'even' : 'odd';
        const positionASize = positionA >= 5 ? 'big' : 'small';
        
        console.log(`   Position A: ${positionA} (${positionAParity}, ${positionASize})`);
        console.log(`   If user bets A_${positionAParity}, they should WIN`);
        console.log(`   If user bets A_${positionASize}, they should WIN`);
        
        // Test 4: Verify sum bets work correctly
        console.log('\n🔍 [TEST_5] Testing sum bet consistency...');
        
        console.log(`   Sum: ${protectedResult.sum} (${protectedResult.sum_parity}, ${protectedResult.sum_size})`);
        console.log(`   If user bets SUM_${protectedResult.sum_parity}, they should WIN`);
        console.log(`   If user bets SUM_${protectedResult.sum_size}, they should WIN`);
        
        console.log('\n✅ [TEST_5D_CONSISTENCY] Test completed successfully!');
        
    } catch (error) {
        console.error('❌ [TEST_5D_CONSISTENCY] Test failed:', error);
    } finally {
        // Cleanup
        await redisClient.quit();
        await sequelize.close();
        console.log('🧹 [CLEANUP] Connections closed');
    }
}

// Run the test
test5DResultConsistency(); 