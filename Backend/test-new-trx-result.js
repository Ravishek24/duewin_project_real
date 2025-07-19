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

async function testNewTrxResult() {
    try {
        console.log('🔄 Connecting to database...');
        await sequelize.authenticate();
        console.log('✅ Database connected successfully');
        
        // Test creating a new result with block number and result time
        console.log('🧪 Testing new TRX_WIX result creation...');
        
        // Generate a test result
        const testResult = {
            number: 5,
            color: 'red',
            size: 'Small'
        };
        
        // Get verification with block number and time
        const verification = await tronHashService.getResultWithVerification(testResult);
        
        console.log('📋 Generated verification data:');
        console.log(`  Hash: ${verification.hash}`);
        console.log(`  Link: ${verification.link}`);
        console.log(`  Block Number: ${verification.blockNumber}`);
        console.log(`  Result Time: ${verification.resultTime}`);
        
        // Test database insertion
        const testPeriodId = `TEST_${Date.now()}`;
        
        const [insertResult] = await sequelize.query(`
            INSERT INTO bet_result_trx_wix (
                period,
                result,
                verification_hash,
                verification_link,
                block_number,
                result_time,
                duration,
                timeline
            ) VALUES (
                :period,
                :result,
                :hash,
                :link,
                :blockNumber,
                :resultTime,
                :duration,
                :timeline
            )
        `, {
            replacements: {
                period: testPeriodId,
                result: JSON.stringify(testResult),
                hash: verification.hash,
                link: verification.link,
                blockNumber: verification.blockNumber,
                resultTime: verification.resultTime,
                duration: 30,
                timeline: 'test'
            }
        });
        
        console.log('✅ Test record inserted successfully');
        
        // Verify the record was created with all fields
        const [verificationResults] = await sequelize.query(`
            SELECT 
                period,
                result,
                verification_hash,
                verification_link,
                block_number,
                result_time,
                created_at,
                updated_at
            FROM bet_result_trx_wix 
            WHERE period = :period
        `, {
            replacements: { period: testPeriodId }
        });
        
        if (verificationResults.length > 0) {
            const record = verificationResults[0];
            console.log('\n🔍 Verification of inserted record:');
            console.log(`  Period: ${record.period}`);
            console.log(`  Result: ${record.result}`);
            console.log(`  Hash: ${record.verification_hash}`);
            console.log(`  Link: ${record.verification_link}`);
            console.log(`  Block Number: ${record.block_number || 'NULL'}`);
            console.log(`  Result Time: ${record.result_time}`);
            console.log(`  Created At: ${record.created_at}`);
            console.log(`  Updated At: ${record.updated_at}`);
            
            if (record.block_number) {
                console.log('  ✅ Block number is present');
            } else {
                console.log('  ❌ Block number is missing');
            }
            
            if (record.result_time) {
                console.log('  ✅ Result time is present');
            } else {
                console.log('  ❌ Result time is missing');
            }
        }
        
        // Clean up test record
        await sequelize.query(`
            DELETE FROM bet_result_trx_wix 
            WHERE period = :period
        `, {
            replacements: { period: testPeriodId }
        });
        
        console.log('🧹 Test record cleaned up');
        
    } catch (error) {
        console.error('❌ Error testing new result:', error);
        throw error;
    } finally {
        await sequelize.close();
        console.log('🔌 Database connection closed');
    }
}

// Run the test
testNewTrxResult().catch(console.error); 