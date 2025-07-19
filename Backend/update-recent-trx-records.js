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

async function updateRecentTrxRecords() {
    try {
        console.log('🔄 Connecting to database...');
        await sequelize.authenticate();
        console.log('✅ Database connected successfully');
        
        // Get recent TRX_WIX results that don't have block_number (last 50 records)
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
            ORDER BY created_at DESC
            LIMIT 50
        `);
        
        console.log(`📊 Found ${results.length} recent records to update`);
        
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
        
        // Verify the update for the specific record
        const [verificationResults] = await sequelize.query(`
            SELECT 
                period,
                block_number,
                result_time,
                updated_at
            FROM bet_result_trx_wix 
            WHERE period IN ('20250719000000650', '20250719000000654', '20250719000000653')
            ORDER BY created_at DESC
        `);
        
        console.log('\n🔍 Verification for recent records:');
        verificationResults.forEach(record => {
            console.log(`  Period: ${record.period}`);
            console.log(`  Block Number: ${record.block_number || 'NULL'}`);
            console.log(`  Result Time: ${record.result_time}`);
            console.log(`  Updated At: ${record.updated_at}`);
            console.log('  ---');
        });
        
    } catch (error) {
        console.error('❌ Error updating recent records:', error);
        throw error;
    } finally {
        // Close the database connection
        await sequelize.close();
        console.log('🔌 Database connection closed');
    }
}

// Run the update
updateRecentTrxRecords().catch(console.error); 