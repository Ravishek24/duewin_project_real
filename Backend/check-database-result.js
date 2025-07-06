const { Sequelize } = require('sequelize');

// Database configuration
const sequelize = new Sequelize({
    dialect: 'mysql',
    host: 'localhost',
    port: 3306,
    username: 'root',
    password: 'root',
    database: 'duewin_db',
    logging: false
});

async function checkDatabaseResult() {
    try {
        console.log('🔍 [DB_CHECK] Checking database for result...');
        
        const periodId = '20250706000001768';
        
        // Check BetResultWingo table
        console.log('\n📊 [DB_CHECK] Checking BetResultWingo table...');
        
        const [wingoResults] = await sequelize.query(`
            SELECT * FROM BetResultWingo 
            WHERE bet_number = :periodId
            ORDER BY created_at DESC
            LIMIT 5
        `, {
            replacements: { periodId },
            type: Sequelize.QueryTypes.SELECT
        });
        
        console.log(`📊 [DB_CHECK] Found ${wingoResults.length} results in BetResultWingo`);
        
        if (wingoResults.length > 0) {
            console.log('📊 [DB_CHECK] Latest result:');
            console.log(JSON.stringify(wingoResults[0], null, 2));
            
            const result = wingoResults[0];
            console.log('\n🎯 [DB_CHECK] Result analysis:');
            console.log(`  - Number: ${result.result_of_number}`);
            console.log(`  - Color: ${result.result_of_color}`);
            console.log(`  - Size: ${result.result_of_size}`);
            console.log(`  - Duration: ${result.duration}`);
            console.log(`  - Timeline: ${result.timeline}`);
            console.log(`  - Created at: ${result.created_at}`);
            
            // Check if this result would make the user lose
            const userBetOnGreen = true; // From debug output
            const resultIsGreen = ['green', 'green_violet'].includes(result.result_of_color);
            const userWins = userBetOnGreen === resultIsGreen;
            
            console.log('\n🎯 [DB_CHECK] User bet analysis:');
            console.log(`  - User bet on: green`);
            console.log(`  - Result color: ${result.result_of_color}`);
            console.log(`  - Result is green: ${resultIsGreen}`);
            console.log(`  - User wins: ${userWins ? '✅ YES' : '❌ NO'}`);
            
            if (userWins) {
                console.log('❌ [DB_CHECK] ISSUE: User won despite protection!');
                console.log('❌ [DB_CHECK] Protection logic failed to make user lose');
            } else {
                console.log('✅ [DB_CHECK] SUCCESS: User lost as expected');
            }
        } else {
            console.log('❌ [DB_CHECK] No result found in BetResultWingo table');
        }
        
        // Check if there are multiple results for this period
        console.log('\n🔍 [DB_CHECK] Checking for multiple results...');
        
        const [allResults] = await sequelize.query(`
            SELECT bet_number, result_of_number, result_of_color, result_of_size, 
                   created_at, updated_at, timeline
            FROM BetResultWingo 
            WHERE bet_number = :periodId
            ORDER BY created_at DESC
        `, {
            replacements: { periodId },
            type: Sequelize.QueryTypes.SELECT
        });
        
        console.log(`🔍 [DB_CHECK] Total results for period: ${allResults.length}`);
        
        if (allResults.length > 1) {
            console.log('⚠️ [DB_CHECK] Multiple results found:');
            allResults.forEach((result, index) => {
                console.log(`  ${index + 1}. Number: ${result.result_of_number}, Color: ${result.result_of_color}, Created: ${result.created_at}`);
            });
        }
        
        // Check if result was generated recently
        console.log('\n⏰ [DB_CHECK] Checking result timing...');
        
        const [recentResults] = await sequelize.query(`
            SELECT bet_number, result_of_number, result_of_color, created_at
            FROM BetResultWingo 
            WHERE created_at >= NOW() - INTERVAL 1 HOUR
            ORDER BY created_at DESC
            LIMIT 10
        `, {
            type: Sequelize.QueryTypes.SELECT
        });
        
        console.log(`⏰ [DB_CHECK] Results in last hour: ${recentResults.length}`);
        
        if (recentResults.length > 0) {
            console.log('⏰ [DB_CHECK] Recent results:');
            recentResults.forEach((result, index) => {
                console.log(`  ${index + 1}. Period: ${result.bet_number}, Number: ${result.result_of_number}, Color: ${result.result_of_color}, Time: ${result.created_at}`);
            });
        }
        
        // Check for any processing logs or errors
        console.log('\n📝 [DB_CHECK] Checking for processing logs...');
        
        // You might want to check other tables that might contain processing information
        // For now, let's check if there are any related records
        
        console.log('📝 [DB_CHECK] Database check completed');
        
    } catch (error) {
        console.error('❌ [DB_CHECK] Error checking database:', error);
    } finally {
        await sequelize.close();
    }
}

// Run the check
checkDatabaseResult(); 