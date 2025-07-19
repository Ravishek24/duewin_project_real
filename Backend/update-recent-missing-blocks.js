const { Sequelize } = require('sequelize');
const config = require('./config/config');
const tronHashService = require('./services/tronHashService');

// Get the environment-specific config
const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

// Initialize database connection
const sequelize = new Sequelize(dbConfig.database, dbConfig.username, dbConfig.password, {
    host: dbConfig.host,
    port: dbConfig.port,
    dialect: dbConfig.dialect,
    logging: false,
    pool: dbConfig.pool,
    retry: dbConfig.retry,
    define: dbConfig.define
});

async function updateRecentMissingBlocks() {
    try {
        console.log('🔄 Connecting to database...');
        await sequelize.authenticate();
        console.log('✅ Database connected successfully');
        
        // Get recent records that are missing block numbers (last 2 hours)
        const [results] = await sequelize.query(`
            SELECT 
                result_id, 
                period, 
                verification_hash, 
                verification_link, 
                created_at,
                duration,
                timeline
            FROM bet_result_trx_wix 
            WHERE block_number IS NULL 
            AND created_at >= DATE_SUB(NOW(), INTERVAL 2 HOUR)
            ORDER BY created_at DESC
            LIMIT 50
        `);
        
        console.log(`📊 Found ${results.length} recent records missing block numbers`);
        
        if (results.length === 0) {
            console.log('✅ No recent records need updating');
            return;
        }
        
        let updatedCount = 0;
        let errorCount = 0;
        
        for (const record of results) {
            try {
                console.log(`🔄 Processing record ${record.result_id} (${record.period})`);
                
                // Extract block number from hash
                let blockNumber = null;
                if (record.verification_hash) {
                    blockNumber = await tronHashService.extractBlockNumber(record.verification_hash);
                    console.log(`  📦 Block number: ${blockNumber}`);
                }
                
                // Update the record
                await sequelize.query(`
                    UPDATE bet_result_trx_wix 
                    SET 
                        block_number = :blockNumber,
                        updated_at = NOW()
                    WHERE result_id = :resultId
                `, {
                    replacements: {
                        blockNumber: blockNumber,
                        resultId: record.result_id
                    }
                });
                
                console.log(`  ✅ Updated record ${record.result_id}`);
                updatedCount++;
                
                // Add a small delay to avoid overwhelming the TRON API
                await new Promise(resolve => setTimeout(resolve, 100));
                
            } catch (error) {
                console.error(`  ❌ Error updating record ${record.result_id}:`, error.message);
                errorCount++;
            }
        }
        
        console.log('\n📊 Update Summary:');
        console.log(`✅ Successfully updated: ${updatedCount} records`);
        console.log(`❌ Errors: ${errorCount} records`);
        console.log(`📈 Total processed: ${results.length} records`);
        
        // Verify the update for the specific periods from API
        const specificPeriods = [
            '20250719000000674',
            '20250719000000673', 
            '20250719000000672',
            '20250719000000671',
            '20250719000000670'
        ];
        
        console.log('\n🔍 Verification for API periods:');
        for (const periodId of specificPeriods) {
            const [verificationResults] = await sequelize.query(`
                SELECT 
                    period,
                    block_number,
                    result_time,
                    updated_at
                FROM bet_result_trx_wix 
                WHERE period = :periodId
            `, {
                replacements: { periodId }
            });
            
            if (verificationResults.length > 0) {
                const record = verificationResults[0];
                console.log(`  Period: ${record.period}`);
                console.log(`  Block Number: ${record.block_number || 'NULL'}`);
                console.log(`  Result Time: ${record.result_time}`);
                console.log(`  Updated At: ${record.updated_at}`);
                console.log('  ---');
            }
        }
        
        console.log('\n🎯 Next Steps:');
        console.log('1. Test the API again - it should now include block and time fields');
        console.log('2. Look for the 💰 logs when new results are generated');
        console.log('3. Verify that new results automatically include block numbers');
        
    } catch (error) {
        console.error('❌ Error updating recent missing blocks:', error);
        throw error;
    } finally {
        await sequelize.close();
        console.log('🔌 Database connection closed');
    }
}

// Run the update
updateRecentMissingBlocks().catch(console.error); 