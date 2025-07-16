const { getSequelizeInstance } = require('./config/db');

async function checkPeriodResult() {
    try {
        const sequelize = await getSequelizeInstance();
        console.log('Connected to database');
        
        const periodId = '20250711000000043';
        const gameType = '5d';
        
        console.log('Checking database for period:', periodId);
        
        // Check game_results table
        const gameResults = await sequelize.query(`
            SELECT * FROM game_results 
            WHERE period_id = :periodId AND game_type = :gameType
            ORDER BY created_at DESC
            LIMIT 5
        `, {
            replacements: { periodId, gameType },
            type: sequelize.QueryTypes.SELECT
        });
        
        console.log('\n=== GAME RESULTS ===');
        console.log('Number of results found:', gameResults.length);
        console.log('Results:', gameResults);
        
        // Check game_sessions table
        const gameSessions = await sequelize.query(`
            SELECT * FROM game_sessions 
            WHERE period_id = :periodId AND game_type = :gameType
            ORDER BY created_at DESC
            LIMIT 5
        `, {
            replacements: { periodId, gameType },
            type: sequelize.QueryTypes.SELECT
        });
        
        console.log('\n=== GAME SESSIONS ===');
        console.log('Number of sessions found:', gameSessions.length);
        console.log('Sessions:', gameSessions);
        
        // Check if there are any recent 5D results
        const recentResults = await sequelize.query(`
            SELECT period_id, game_type, result, created_at 
            FROM game_results 
            WHERE game_type = '5d'
            ORDER BY created_at DESC
            LIMIT 10
        `, {
            type: sequelize.QueryTypes.SELECT
        });
        
        console.log('\n=== RECENT 5D RESULTS ===');
        console.log('Recent 5D results:', recentResults);
        
        // Check if there are any periods with similar ID pattern
        const similarPeriods = await sequelize.query(`
            SELECT period_id, game_type, result, created_at 
            FROM game_results 
            WHERE period_id LIKE '%20250711%' AND game_type = '5d'
            ORDER BY created_at DESC
            LIMIT 10
        `, {
            type: sequelize.QueryTypes.SELECT
        });
        
        console.log('\n=== SIMILAR PERIODS (20250711) ===');
        console.log('Similar periods:', similarPeriods);
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit(0);
    }
}

checkPeriodResult().catch(console.error); 