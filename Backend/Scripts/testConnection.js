// Backend/scripts/testConnection.js
require('dotenv').config();
const mysql = require('mysql2/promise');

async function testDatabaseConnection() {
    console.log('🔍 Testing Database Connection...\n');
    
    // Get configuration from environment
    const config = {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASS || '',
        database: process.env.DB_NAME || 'duewin_db'
    };
    
    console.log('📋 Database Configuration:');
    console.log(`Host: ${config.host}`);
    console.log(`Port: ${config.port}`);
    console.log(`User: ${config.user}`);
    console.log(`Password: ${config.password ? '[SET - ' + config.password.length + ' characters]' : '[NOT SET]'}`);
    console.log(`Database: ${config.database}\n`);
    
    let connection;
    
    try {
        // Test 1: Basic MySQL connection (without database)
        console.log('🔗 Test 1: Connecting to MySQL server...');
        const basicConfig = { ...config };
        delete basicConfig.database; // Remove database from config
        
        connection = await mysql.createConnection(basicConfig);
        console.log('✅ Successfully connected to MySQL server\n');
        
        // Test 2: Check if database exists
        console.log('🔍 Test 2: Checking if database exists...');
        const [databases] = await connection.execute('SHOW DATABASES LIKE ?', [config.database]);
        
        if (databases.length > 0) {
            console.log(`✅ Database '${config.database}' exists\n`);
        } else {
            console.log(`❌ Database '${config.database}' does not exist\n`);
            
            // Try to create database
            console.log('🛠️ Attempting to create database...');
            try {
                await connection.execute(`CREATE DATABASE \`${config.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
                console.log(`✅ Database '${config.database}' created successfully\n`);
            } catch (createError) {
                console.log(`❌ Failed to create database: ${createError.message}\n`);
                throw createError;
            }
        }
        
        // Test 3: Connect to specific database
        console.log('🔗 Test 3: Connecting to specific database...');
        await connection.end(); // Close previous connection
        connection = await mysql.createConnection(config); // Reconnect with database
        console.log(`✅ Successfully connected to database '${config.database}'\n`);
        
        // Test 4: Check tables
        console.log('📊 Test 4: Checking existing tables...');
        const [tables] = await connection.execute('SHOW TABLES');
        
        if (tables.length > 0) {
            console.log(`✅ Found ${tables.length} tables:`);
            tables.forEach((table, index) => {
                const tableName = Object.values(table)[0];
                console.log(`   ${index + 1}. ${tableName}`);
            });
            console.log('');
        } else {
            console.log('ℹ️ No tables found (this is normal for a new database)\n');
        }
        
        // Test 5: Test basic operations
        console.log('🧪 Test 5: Testing basic database operations...');
        
        // Create test table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS connection_test (
                id INT PRIMARY KEY AUTO_INCREMENT,
                test_message VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Test table created');
        
        // Insert test data
        await connection.execute(
            'INSERT INTO connection_test (test_message) VALUES (?)',
            ['Database connection test successful']
        );
        console.log('✅ Test data inserted');
        
        // Read test data
        const [rows] = await connection.execute('SELECT * FROM connection_test ORDER BY id DESC LIMIT 1');
        console.log('✅ Test data retrieved:', rows[0]);
        
        // Clean up test table
        await connection.execute('DROP TABLE connection_test');
        console.log('✅ Test table cleaned up\n');
        
        // Test 6: Test Sequelize connection
        console.log('🔗 Test 6: Testing Sequelize connection...');
        try {
            const { sequelize } = require('../config/db');
            await sequelize.authenticate();
            console.log('✅ Sequelize connection successful\n');
            
            // Test model initialization
            console.log('🔄 Test 7: Testing model initialization...');
            const { initializeModels } = require('../models');
            const models = await initializeModels();
            console.log(`✅ Models initialized successfully. Found ${Object.keys(models).length} models\n`);
            
        } catch (seqError) {
            console.log(`❌ Sequelize connection failed: ${seqError.message}\n`);
            throw seqError;
        }
        
        console.log('🎉 All database tests passed successfully!');
        return true;
        
    } catch (error) {
        console.log(`❌ Database connection test failed: ${error.message}\n`);
        
        // Provide specific troubleshooting based on error code
        console.log('🔧 Troubleshooting Guide:');
        
        switch (error.code) {
            case 'ER_ACCESS_DENIED_ERROR':
                console.log('• Issue: Invalid username or password');
                console.log('• Solutions:');
                console.log('  1. Check your .env file DB_USER and DB_PASS values');
                console.log('  2. Test manual connection: mysql -u ' + config.user + ' -p');
                console.log('  3. Reset MySQL root password if needed');
                break;
                
            case 'ECONNREFUSED':
                console.log('• Issue: Cannot connect to MySQL server');
                console.log('• Solutions:');
                console.log('  1. Check if MySQL is running: sudo systemctl status mysql');
                console.log('  2. Start MySQL: sudo systemctl start mysql');
                console.log('  3. Check if port 3306 is open: netstat -tlnp | grep 3306');
                break;
                
            case 'ENOTFOUND':
                console.log('• Issue: Cannot resolve hostname');
                console.log('• Solutions:');
                console.log('  1. Check DB_HOST value in .env file');
                console.log('  2. Use "localhost" instead of "127.0.0.1" or vice versa');
                break;
                
            case 'ER_BAD_DB_ERROR':
                console.log('• Issue: Database does not exist');
                console.log('• Solutions:');
                console.log('  1. Database will be created automatically if user has permissions');
                console.log('  2. Create manually: CREATE DATABASE ' + config.database + ';');
                break;
                
            default:
                console.log('• Unknown error. Check MySQL server status and configuration.');
        }
        
        return false;
    } finally {
        if (connection) {
            await connection.end();
            console.log('🔌 Database connection closed');
        }
    }
}

// Export for use in other scripts
module.exports = { testDatabaseConnection };

// Run test if this file is executed directly
if (require.main === module) {
    testDatabaseConnection()
        .then((success) => {
            console.log(success ? '\n✅ Overall Result: PASSED' : '\n❌ Overall Result: FAILED');
            process.exit(success ? 0 : 1);
        })
        .catch((error) => {
            console.error('\n💥 Fatal Error:', error.message);
            process.exit(1);
        });
}