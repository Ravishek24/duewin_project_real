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

async function checkRecentTrxRecord() {
    try {
        console.log('🔄 Connecting to database...');
        await sequelize.authenticate();
        console.log('✅ Database connected successfully');
        
        // Check the most recent TRX_WIX record
        const [results] = await sequelize.query(`
            SELECT 
                result_id,
                period,
                verification_hash,
                verification_link,
                block_number,
                result_time,
                created_at,
                updated_at
            FROM bet_result_trx_wix 
            ORDER BY created_at DESC
            LIMIT 5
        `);
        
        console.log(`📊 Found ${results.length} recent records`);
        
        results.forEach((record, index) => {
            console.log(`\n📋 Record ${index + 1}:`);
            console.log(`  Period: ${record.period}`);
            console.log(`  Hash: ${record.verification_hash}`);
            console.log(`  Link: ${record.verification_link}`);
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
        });
        
        // Check if the specific period exists
        const [specificRecord] = await sequelize.query(`
            SELECT 
                result_id,
                period,
                verification_hash,
                verification_link,
                block_number,
                result_time,
                created_at,
                updated_at
            FROM bet_result_trx_wix 
            WHERE period = '20250719000000650'
        `);
        
        if (specificRecord.length > 0) {
            const record = specificRecord[0];
            console.log(`\n🎯 Specific Record (20250719000000650):`);
            console.log(`  Block Number: ${record.block_number || 'NULL'}`);
            console.log(`  Result Time: ${record.result_time || 'NULL'}`);
            console.log(`  Updated At: ${record.updated_at}`);
        } else {
            console.log(`\n❌ Record 20250719000000650 not found`);
        }
        
    } catch (error) {
        console.error('❌ Error checking recent record:', error);
        throw error;
    } finally {
        await sequelize.close();
        console.log('🔌 Database connection closed');
    }
}

// Run the check
checkRecentTrxRecord().catch(console.error); 