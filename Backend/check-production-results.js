const { Sequelize } = require('sequelize');
const config = require('./config/config');

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

async function checkProductionResults() {
    try {
        console.log('🔄 Connecting to database...');
        await sequelize.authenticate();
        console.log('✅ Database connected successfully');
        
        // Get the 10 most recent TRX_WIX results
        const [results] = await sequelize.query(`
            SELECT 
                result_id,
                period,
                verification_hash,
                verification_link,
                block_number,
                result_time,
                created_at,
                updated_at,
                duration,
                timeline
            FROM bet_result_trx_wix 
            ORDER BY created_at DESC
            LIMIT 10
        `);
        
        console.log(`📊 Found ${results.length} most recent production results\n`);
        
        let hasBlockNumbers = 0;
        let missingBlockNumbers = 0;
        
        for (let i = 0; i < results.length; i++) {
            const record = results[i];
            console.log(`📋 Result ${i + 1}:`);
            console.log(`  Period: ${record.period}`);
            console.log(`  Created At: ${record.created_at}`);
            console.log(`  Hash: ${record.verification_hash}`);
            console.log(`  Block Number: ${record.block_number || 'NULL'}`);
            console.log(`  Result Time: ${record.result_time}`);
            console.log(`  Duration: ${record.duration}`);
            console.log(`  Timeline: ${record.timeline}`);
            
            if (record.block_number) {
                console.log(`  ✅ Block number is present`);
                hasBlockNumbers++;
            } else {
                console.log(`  ❌ Block number is missing`);
                missingBlockNumbers++;
            }
            
            console.log('  ---');
        }
        
        console.log('\n📊 Summary:');
        console.log(`  Total recent results: ${results.length}`);
        console.log(`  With block numbers: ${hasBlockNumbers}`);
        console.log(`  Missing block numbers: ${missingBlockNumbers}`);
        
        if (missingBlockNumbers > 0) {
            console.log('\n⚠️ ISSUE: Recent production results are missing block numbers!');
            console.log('   This means the production result generation is not using the updated code.');
            console.log('   The test worked because it was a fresh call, but production is still using old logic.');
        } else {
            console.log('\n✅ All recent production results have block numbers');
        }
        
        // Check when the last result with block number was created
        const [lastBlockResult] = await sequelize.query(`
            SELECT 
                period,
                created_at,
                block_number
            FROM bet_result_trx_wix 
            WHERE block_number IS NOT NULL
            ORDER BY created_at DESC
            LIMIT 1
        `);
        
        if (lastBlockResult.length > 0) {
            console.log('\n📅 Last result with block number:');
            console.log(`  Period: ${lastBlockResult[0].period}`);
            console.log(`  Created At: ${lastBlockResult[0].created_at}`);
            console.log(`  Block Number: ${lastBlockResult[0].block_number}`);
        }
        
        // Check if any results were created after our code update (let's say after 2 hours ago)
        const [recentResults] = await sequelize.query(`
            SELECT 
                COUNT(*) as total_recent,
                COUNT(block_number) as with_block,
                COUNT(CASE WHEN block_number IS NULL THEN 1 END) as without_block
            FROM bet_result_trx_wix 
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 2 HOUR)
        `);
        
        console.log('\n⏰ Results in last 2 hours:');
        console.log(`  Total: ${recentResults[0].total_recent}`);
        console.log(`  With block numbers: ${recentResults[0].with_block}`);
        console.log(`  Without block numbers: ${recentResults[0].without_block}`);
        
    } catch (error) {
        console.error('❌ Error checking production results:', error);
        throw error;
    } finally {
        await sequelize.close();
        console.log('🔌 Database connection closed');
    }
}

// Run the check
checkProductionResults().catch(console.error); 