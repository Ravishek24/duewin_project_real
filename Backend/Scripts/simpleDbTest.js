// Backend/scripts/simpleDbTest.js
require('dotenv').config();
const mysql = require('mysql2/promise');

async function simpleDbTest() {
    console.log('🔍 Simple Database Connection Test\n');
    
    const config = {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASS || '',
        database: process.env.DB_NAME || 'duewin_db'
    };
    
    console.log('📋 Configuration:');
    console.log(`Host: ${config.host}`);
    console.log(`Port: ${config.port}`);
    console.log(`User: ${config.user}`);
    console.log(`Database: ${config.database}`);
    console.log(`Password: ${config.password ? '[SET]' : '[NOT SET]'}\n`);
    
    let connection;
    
    try {
        // Step 1: Connect to MySQL server (without database)
        console.log('🔗 Step 1: Connecting to MySQL server...');
        const serverConfig = {
            host: config.host,
            port: config.port,
            user: config.user,
            password: config.password
        };
        
        connection = await mysql.createConnection(serverConfig);
        console.log('✅ Connected to MySQL server successfully\n');
        
        // Step 2: List all databases
        console.log('📊 Step 2: Listing databases...');
        const [databases] = await connection.execute('SHOW DATABASES');
        console.log('Available databases:');
        databases.forEach((db, index) => {
            const dbName = Object.values(db)[0];
            console.log(`  ${index + 1}. ${dbName}`);
        });
        
        // Check if our target database exists
        const targetDbExists = databases.some(db => Object.values(db)[0] === config.database);
        console.log(`\nTarget database '${config.database}': ${targetDbExists ? '✅ EXISTS' : '❌ NOT FOUND'}\n`);
        
        // Step 3: Create database if it doesn't exist
        if (!targetDbExists) {
            console.log(`🛠️ Step 3: Creating database '${config.database}'...`);
            await connection.execute(`CREATE DATABASE \`${config.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
            console.log(`✅ Database '${config.database}' created successfully\n`);
        } else {
            console.log('✅ Step 3: Database already exists, skipping creation\n');
        }
        
        // Step 4: Connect to specific database
        console.log('🔗 Step 4: Connecting to specific database...');
        await connection.end(); // Close current connection
        connection = await mysql.createConnection(config); // Connect with database
        console.log(`✅ Connected to database '${config.database}' successfully\n`);
        
        // Step 5: Test basic operations
        console.log('🧪 Step 5: Testing basic operations...');
        
        // Check current database
        const [currentDb] = await connection.execute('SELECT DATABASE() as current_db');
        console.log(`Current database: ${currentDb[0].current_db}`);
        
        // Show tables
        const [tables] = await connection.execute('SHOW TABLES');
        console.log(`Tables in database: ${tables.length}`);
        if (tables.length > 0) {
            tables.forEach((table, index) => {
                const tableName = Object.values(table)[0];
                console.log(`  ${index + 1}. ${tableName}`);
            });
        }
        
        // Test write permission
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS connection_test_${Date.now()} (
                id INT PRIMARY KEY AUTO_INCREMENT,
                test_message VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        const [testTables] = await connection.execute('SHOW TABLES LIKE "connection_test_%"');
        if (testTables.length > 0) {
            const testTableName = Object.values(testTables[0])[0];
            await connection.execute(`DROP TABLE ${testTableName}`);
            console.log('✅ Write permissions confirmed\n');
        }
        
        // Step 6: Test Sequelize
        console.log('🔗 Step 6: Testing Sequelize connection...');
        try {
            const { sequelize } = require('../config/db');
            await sequelize.authenticate();
            console.log('✅ Sequelize connection successful\n');
        } catch (seqError) {
            console.log(`❌ Sequelize connection failed: ${seqError.message}\n`);
            console.log('Sequelize config issue - check your config/config.js file\n');
        }
        
        console.log('🎉 All database tests completed successfully!');
        console.log('\n✅ Your database connection is working properly.');
        console.log('✅ You can now start your application.');
        
        return true;
        
    } catch (error) {
        console.log(`❌ Database test failed: ${error.message}\n`);
        console.log('Error details:', {
            code: error.code,
            errno: error.errno,
            sqlState: error.sqlState,
            sqlMessage: error.sqlMessage
        });
        
        return false;
    } finally {
        if (connection) {
            await connection.end();
            console.log('\n🔌 Database connection closed');
        }
    }
}

// Run if executed directly
if (require.main === module) {
    simpleDbTest()
        .then((success) => {
            process.exit(success ? 0 : 1);
        })
        .catch((error) => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}

module.exports = { simpleDbTest };