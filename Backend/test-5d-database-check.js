const gameLogicService = require('./services/gameLogicService');
const { getSequelizeInstance } = require('./config/db');

async function test5DDatabaseCheck() {
    try {
        console.log('🎯 [5D_DATABASE_CHECK] ==========================================');
        console.log('🎯 [5D_DATABASE_CHECK] Testing 5D Database Combinations');
        console.log('🎯 [5D_DATABASE_CHECK] ==========================================');

        // Get database connection
        const sequelize = await getSequelizeInstance();
        console.log('✅ Database connection established');

        // Initialize models
        await gameLogicService.ensureModelsInitialized();
        console.log('✅ Models initialized');

        // Test 1: Check if combinations with dice_a = 0 exist
        console.log('\n🔍 [5D_DB_CHECK_1] Checking for combinations with dice_a = 0...');
        const query1 = `
            SELECT dice_value, dice_a, dice_b, dice_c, dice_d, dice_e,
                   sum_value, sum_size, sum_parity, winning_conditions
            FROM game_combinations_5d
            WHERE dice_a = 0
            ORDER BY RAND()
            LIMIT 5
        `;

        const result1 = await sequelize.query(query1, {
            type: sequelize.QueryTypes.SELECT
        });

        console.log(`🔍 [5D_DB_CHECK_1] Found ${result1.length} combinations with dice_a = 0:`);
        for (let i = 0; i < result1.length; i++) {
            const combo = result1[i];
            console.log(`   ${i + 1}. A=${combo.dice_a}, B=${combo.dice_b}, C=${combo.dice_c}, D=${combo.dice_d}, E=${combo.dice_e}, Sum=${combo.sum_value}`);
        }

        // Test 2: Check total combinations count
        console.log('\n🔍 [5D_DB_CHECK_2] Checking total combinations count...');
        const query2 = `
            SELECT COUNT(*) as total_combinations
            FROM game_combinations_5d
        `;

        const result2 = await sequelize.query(query2, {
            type: sequelize.QueryTypes.SELECT
        });

        console.log(`🔍 [5D_DB_CHECK_2] Total combinations in database: ${result2[0].total_combinations}`);

        // Test 3: Check combinations with specific dice_a values
        console.log('\n🔍 [5D_DB_CHECK_3] Checking combinations by dice_a value...');
        for (let dice_a = 0; dice_a <= 9; dice_a++) {
            const query3 = `
                SELECT COUNT(*) as count
                FROM game_combinations_5d
                WHERE dice_a = ${dice_a}
            `;

            const result3 = await sequelize.query(query3, {
                type: sequelize.QueryTypes.SELECT
            });

            console.log(`   dice_a = ${dice_a}: ${result3[0].count} combinations`);
        }

        // Test 4: Test the exact protection query
        console.log('\n🔍 [5D_DB_CHECK_4] Testing exact protection query...');
        const protectionQuery = `
            SELECT dice_value, dice_a, dice_b, dice_c, dice_d, dice_e,
                   sum_value, sum_size, sum_parity, winning_conditions
            FROM game_combinations_5d
            WHERE dice_a IN (0)
            ORDER BY RAND()
            LIMIT 1
        `;

        const protectionResult = await sequelize.query(protectionQuery, {
            type: sequelize.QueryTypes.SELECT
        });

        console.log(`🔍 [5D_DB_CHECK_4] Protection query result:`, protectionResult);

        if (protectionResult.length > 0) {
            const combo = protectionResult[0];
            const formattedResult = gameLogicService.format5DResult(combo);
            console.log(`🔍 [5D_DB_CHECK_4] Formatted result:`, formattedResult);
            
            if (formattedResult.A === 0) {
                console.log('✅ [5D_DB_CHECK_4] SUCCESS: Protection query correctly returns A=0');
            } else {
                console.log('❌ [5D_DB_CHECK_4] FAILURE: Protection query returns A=', formattedResult.A, 'instead of A=0');
            }
        } else {
            console.log('❌ [5D_DB_CHECK_4] FAILURE: Protection query returned no results');
        }

        // Test 5: Check if there are any combinations at all
        console.log('\n🔍 [5D_DB_CHECK_5] Checking random combinations...');
        const randomQuery = `
            SELECT dice_value, dice_a, dice_b, dice_c, dice_d, dice_e,
                   sum_value, sum_size, sum_parity, winning_conditions
            FROM game_combinations_5d
            ORDER BY RAND()
            LIMIT 3
        `;

        const randomResult = await sequelize.query(randomQuery, {
            type: sequelize.QueryTypes.SELECT
        });

        console.log(`🔍 [5D_DB_CHECK_5] Random combinations:`, randomResult);

        console.log('\n🎯 [5D_DATABASE_CHECK] ==========================================');
        console.log('🎯 [5D_DATABASE_CHECK] 5D Database Check completed');
        console.log('🎯 [5D_DATABASE_CHECK] ==========================================');

    } catch (error) {
        console.error('❌ [5D_DATABASE_CHECK] Error in 5D database check:', error);
    }
}

// Run the test
test5DDatabaseCheck().then(() => {
    console.log('✅ 5D database check completed');
    process.exit(0);
}).catch(error => {
    console.error('❌ 5D database check failed:', error);
    process.exit(1);
}); 