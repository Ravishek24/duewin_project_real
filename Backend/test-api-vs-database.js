const { Sequelize } = require('sequelize');
const config = require('./config/config');
const gameLogicService = require('./services/gameLogicService');

// Get the environment-specific config
const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

// Initialize database connection (same as your check script)
const sequelize = new Sequelize(dbConfig.database, dbConfig.username, dbConfig.password, {
    host: dbConfig.host,
    port: dbConfig.port,
    dialect: dbConfig.dialect,
    logging: false,
    pool: dbConfig.pool,
    retry: dbConfig.retry,
    define: dbConfig.define
});

async function testApiVsDatabase() {
    try {
        console.log('🔍 [API_VS_DB_TEST] Testing API vs Database discrepancy');
        console.log('=====================================================\n');
        
        // Step 1: Connect to database
        console.log('🔄 Connecting to database...');
        await sequelize.authenticate();
        console.log('✅ Database connected successfully\n');
        
        // Step 2: Get direct database results (like your check script)
        console.log('📊 [DIRECT_DB] Getting direct database results...');
        const [directResults] = await sequelize.query(`
            SELECT 
                period,
                verification_hash,
                verification_link,
                block_number,
                result_time,
                created_at,
                duration
            FROM bet_result_trx_wix 
            ORDER BY created_at DESC
            LIMIT 5
        `);
        
        console.log(`✅ Direct DB found ${directResults.length} results\n`);
        
        // Step 3: Initialize gameLogicService models
        console.log('🔄 Initializing gameLogicService models...');
        await gameLogicService.ensureModelsInitialized();
        console.log('✅ gameLogicService models initialized\n');
        
        // Step 4: Get results through gameLogicService (like the API does)
        console.log('📊 [API_SERVICE] Getting results through gameLogicService...');
        const apiResults = await gameLogicService.getGameHistory('trx_wix', 30, 5, 0);
        
        if (apiResults.success) {
            console.log(`✅ API Service found ${apiResults.data.results.length} results\n`);
        } else {
            console.log(`❌ API Service failed: ${apiResults.message}\n`);
            return;
        }
        
        // Step 5: Compare the results
        console.log('🔍 [COMPARISON] Comparing Direct DB vs API Service results:');
        console.log('==========================================================\n');
        
        for (let i = 0; i < Math.min(directResults.length, apiResults.data.results.length); i++) {
            const directResult = directResults[i];
            const apiResult = apiResults.data.results[i];
            
            console.log(`📋 Result ${i + 1} (Period: ${directResult.period}):`);
            console.log(`  Direct DB - Block: ${directResult.block_number || 'NULL'}, Time: ${directResult.result_time || 'NULL'}`);
            console.log(`  API Service - Block: ${apiResult.verification.block || 'NULL'}, Time: ${apiResult.verification.time || 'NULL'}`);
            
            const blockMatch = (directResult.block_number === apiResult.verification.block);
            const timeMatch = (directResult.result_time === apiResult.verification.time);
            
            console.log(`  Block Match: ${blockMatch ? '✅' : '❌'}`);
            console.log(`  Time Match: ${timeMatch ? '✅' : '❌'}`);
            console.log('');
        }
        
        // Step 6: Check if there's a model caching issue
        console.log('🔍 [MODEL_CHECK] Checking model initialization...');
        const models = await gameLogicService.ensureModelsInitialized();
        const trxWixModel = models.BetResultTrxWix;
        
        if (trxWixModel) {
            console.log('✅ BetResultTrxWix model found');
            console.log(`  Model attributes: ${Object.keys(trxWixModel.rawAttributes).join(', ')}`);
            
            // Check if block_number and result_time are in the model
            const hasBlockNumber = 'block_number' in trxWixModel.rawAttributes;
            const hasResultTime = 'result_time' in trxWixModel.rawAttributes;
            
            console.log(`  Has block_number: ${hasBlockNumber ? '✅' : '❌'}`);
            console.log(`  Has result_time: ${hasResultTime ? '✅' : '❌'}`);
        } else {
            console.log('❌ BetResultTrxWix model not found');
        }
        
        console.log('\n🔍 [CONCLUSION]');
        console.log('===============');
        console.log('If the API service results are missing block/time but direct DB has them,');
        console.log('it means the API service is using cached/old models or a different connection.');
        console.log('This would require restarting the API service to pick up the updated models.');
        
    } catch (error) {
        console.error('❌ Error in API vs Database test:', error);
    } finally {
        await sequelize.close();
        console.log('\n🔌 Database connection closed');
    }
}

// Run the test
testApiVsDatabase(); 