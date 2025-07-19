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

async function checkRecentApiRecords() {
    try {
        console.log('🔄 Connecting to database...');
        await sequelize.authenticate();
        console.log('✅ Database connected successfully');
        
        // Check the specific periods from the API response
        const periodsToCheck = [
            '20250719000000674',
            '20250719000000673', 
            '20250719000000672',
            '20250719000000671',
            '20250719000000670',
            '20250719000000669',
            '20250719000000668',
            '20250719000000667',
            '20250719000000666',
            '20250719000000665'
        ];
        
        console.log(`📊 Checking ${periodsToCheck.length} recent records from API response...\n`);
        
        for (const periodId of periodsToCheck) {
            const [results] = await sequelize.query(`
                SELECT 
                    period,
                    verification_hash,
                    verification_link,
                    block_number,
                    result_time,
                    created_at,
                    updated_at
                FROM bet_result_trx_wix 
                WHERE period = :periodId
            `, {
                replacements: { periodId }
            });
            
            if (results.length > 0) {
                const record = results[0];
                console.log(`📋 Period: ${record.period}`);
                console.log(`  Hash: ${record.verification_hash}`);
                console.log(`  Block Number: ${record.block_number || 'NULL'}`);
                console.log(`  Result Time: ${record.result_time || 'NULL'}`);
                console.log(`  Created At: ${record.created_at}`);
                console.log(`  Updated At: ${record.updated_at}`);
                
                if (record.block_number) {
                    console.log(`  ✅ Block number is present`);
                } else {
                    console.log(`  ❌ Block number is missing`);
                }
                
                if (record.result_time) {
                    console.log(`  ✅ Result time is present`);
                } else {
                    console.log(`  ❌ Result time is missing`);
                }
            } else {
                console.log(`❌ Period ${periodId} not found in database`);
            }
            
            console.log('  ---');
        }
        
        // Check if any recent records have block numbers
        const [summaryResults] = await sequelize.query(`
            SELECT 
                COUNT(*) as total_recent,
                COUNT(block_number) as with_block,
                COUNT(result_time) as with_time
            FROM bet_result_trx_wix 
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
        `);
        
        console.log('\n📊 Summary of recent records (last 1 hour):');
        console.log(`  Total records: ${summaryResults[0].total_recent}`);
        console.log(`  With block number: ${summaryResults[0].with_block}`);
        console.log(`  With result time: ${summaryResults[0].with_time}`);
        
        if (summaryResults[0].with_block === 0) {
            console.log('\n⚠️ ISSUE: No recent records have block numbers!');
            console.log('   This means new results are not being stored with block numbers.');
            console.log('   Check if the result generation code is using the updated logic.');
        } else {
            console.log('\n✅ Recent records have block numbers');
        }
        
    } catch (error) {
        console.error('❌ Error checking recent API records:', error);
        throw error;
    } finally {
        await sequelize.close();
        console.log('🔌 Database connection closed');
    }
}

// Run the check
checkRecentApiRecords().catch(console.error); 