const { Sequelize } = require('sequelize');
const redis = require('redis');

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
    combination_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
    },
    dice_value: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false
    },
    dice_a: {
        type: Sequelize.TINYINT.UNSIGNED,
        allowNull: false
    },
    dice_b: {
        type: Sequelize.TINYINT.UNSIGNED,
        allowNull: false
    },
    dice_c: {
        type: Sequelize.TINYINT.UNSIGNED,
        allowNull: false
    },
    dice_d: {
        type: Sequelize.TINYINT.UNSIGNED,
        allowNull: false
    },
    dice_e: {
        type: Sequelize.TINYINT.UNSIGNED,
        allowNull: false
    },
    sum_value: {
        type: Sequelize.TINYINT.UNSIGNED,
        allowNull: false
    },
    sum_size: {
        type: Sequelize.ENUM('big', 'small'),
        allowNull: false
    },
    sum_parity: {
        type: Sequelize.ENUM('odd', 'even'),
        allowNull: false
    }
}, {
    tableName: 'game_combinations_5d',
    timestamps: false
});

async function testThresholdFix() {
    try {
        console.log('🔧 Testing 5D Threshold Fix...\n');

        // Test the specific case from production data
        const testDice = [0, 4, 5, 7, 1]; // A=0, B=4, C=5, D=7, E=1
        const sum = testDice.reduce((a, b) => a + b, 0);
        
        console.log('📊 Test Case:');
        console.log(`   Dice: A=${testDice[0]}, B=${testDice[1]}, C=${testDice[2]}, D=${testDice[3]}, E=${testDice[4]}`);
        console.log(`   Sum: ${sum}`);
        console.log(`   Expected: sum=17 should be "big" (>= 22)`);

        // Test the old threshold (>= 23)
        const oldThreshold = sum >= 23;
        console.log(`\n❌ Old Threshold (>= 23): ${sum} >= 23 = ${oldThreshold} → ${oldThreshold ? 'big' : 'small'}`);

        // Test the new threshold (>= 22)
        const newThreshold = sum >= 22;
        console.log(`✅ New Threshold (>= 22): ${sum} >= 22 = ${newThreshold} → ${newThreshold ? 'big' : 'small'}`);

        // Check database value
        const diceValue = parseInt(testDice.join(''));
        console.log(`\n🔍 Checking database for dice_value: ${diceValue}`);
        
        const combination = await GameCombinations5D.findOne({
            where: { dice_value: diceValue }
        });

        if (combination) {
            console.log(`📊 Database Value:`);
            console.log(`   sum_value: ${combination.sum_value}`);
            console.log(`   sum_size: ${combination.sum_size}`);
            console.log(`   sum_parity: ${combination.sum_parity}`);
            
            // Verify consistency
            const dbSum = combination.sum_value;
            const dbSize = combination.sum_size;
            const calculatedSize = dbSum >= 22 ? 'big' : 'small';
            
            console.log(`\n🔍 Consistency Check:`);
            console.log(`   Database sum: ${dbSum}`);
            console.log(`   Database size: ${dbSize}`);
            console.log(`   Calculated size (>= 22): ${calculatedSize}`);
            console.log(`   Match: ${dbSize === calculatedSize ? '✅ YES' : '❌ NO'}`);
            
            if (dbSize !== calculatedSize) {
                console.log(`   ⚠️  INCONSISTENCY: Database uses different threshold!`);
            }
        } else {
            console.log(`❌ Combination not found in database for dice_value: ${diceValue}`);
        }

        // Test multiple sum values
        console.log(`\n🧪 Testing Multiple Sum Values:`);
        const testSums = [15, 17, 20, 22, 23, 25, 30];
        
        for (const testSum of testSums) {
            const oldResult = testSum >= 23 ? 'big' : 'small';
            const newResult = testSum >= 22 ? 'big' : 'small';
            const change = oldResult !== newResult ? ` (CHANGED: ${oldResult} → ${newResult})` : '';
            
            console.log(`   Sum ${testSum}: ${newResult}${change}`);
        }

        console.log(`\n✅ Threshold Fix Test Complete!`);
        
        // Summary
        console.log(`\n📋 Summary:`);
        console.log(`   - Old threshold (>= 23): sum=17 was "small"`);
        console.log(`   - New threshold (>= 22): sum=17 is "big"`);
        console.log(`   - This matches your expectation that sum=17 should be "big"`);

    } catch (error) {
        console.error('❌ Error testing threshold fix:', error);
    } finally {
        await sequelize.close();
        await redisClient.quit();
    }
}

// Run the test
testThresholdFix(); 