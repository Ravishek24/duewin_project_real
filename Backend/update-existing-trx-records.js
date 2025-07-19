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

async function updateExistingTrxRecords() {
    try {
        console.log('🔄 Connecting to database...');
        await sequelize.authenticate();
        console.log('✅ Database connected successfully');
        
        console.log('🔄 Updating existing TRX_WIX records with block numbers and result times...');
        
        // Get all existing TRX_WIX results that don't have block_number or result_time
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
            WHERE block_number IS NULL OR result_time IS NULL
            ORDER BY created_at DESC
        `);
        
        console.log(`📊 Found ${results.length} records to update`);
        
        if (results.length === 0) {
            console.log('✅ No records need updating');
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
                
                // Use created_at as result_time (since we don't have the original time)
                const resultTime = record.created_at;
                console.log(`  ⏰ Result time: ${resultTime}`);
                
                // Update the record
                await sequelize.query(`
                    UPDATE bet_result_trx_wix 
                    SET 
                        block_number = :blockNumber,
                        result_time = :resultTime,
                        updated_at = NOW()
                    WHERE result_id = :resultId
                `, {
                    replacements: {
                        blockNumber: blockNumber,
                        resultTime: resultTime,
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
        
        // Verify the update
        const [verificationResults] = await sequelize.query(`
            SELECT 
                COUNT(*) as total_records,
                COUNT(block_number) as records_with_block,
                COUNT(result_time) as records_with_time
            FROM bet_result_trx_wix
        `);
        
        console.log('\n🔍 Verification:');
        console.log(`📊 Total records: ${verificationResults[0].total_records}`);
        console.log(`📦 Records with block number: ${verificationResults[0].records_with_block}`);
        console.log(`⏰ Records with result time: ${verificationResults[0].records_with_time}`);
        
        if (verificationResults[0].records_with_block === verificationResults[0].total_records &&
            verificationResults[0].records_with_time === verificationResults[0].total_records) {
            console.log('🎉 All records have been successfully updated!');
        } else {
            console.log('⚠️ Some records may still need updating');
        }
        
    } catch (error) {
        console.error('❌ Error updating existing records:', error);
        throw error;
    } finally {
        // Close the database connection
        await sequelize.close();
        console.log('🔌 Database connection closed');
    }
}

// Run the update
updateExistingTrxRecords().catch(console.error); 