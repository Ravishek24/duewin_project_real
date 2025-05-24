// Backend/scripts/setupDatabase.js
require('dotenv').config();
const mysql = require('mysql2/promise');

async function setupDatabase() {
    console.log('🔧 Starting database setup...');
    
    // Database configuration
    const config = {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASS || ''
    };
    
    const dbName = process.env.DB_NAME || 'duewin_db';
    
    console.log('Database configuration:', {
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password ? '[HIDDEN]' : '[NOT SET]',
        database: dbName
    });
    
    let connection;
    
    try {
        // Test connection to MySQL server
        console.log('🔗 Connecting to MySQL server...');
        connection = await mysql.createConnection(config);
        console.log('✅ Connected to MySQL server successfully');
        
        // Check if database exists
        console.log(`🔍 Checking if database '${dbName}' exists...`);
        const [databases] = await connection.execute('SHOW DATABASES LIKE ?', [dbName]);
        
        if (databases.length === 0) {
            console.log(`📦 Creating database '${dbName}'...`);
            await connection.execute(`CREATE DATABASE \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
            console.log(`✅ Database '${dbName}' created successfully`);
        } else {
            console.log(`✅ Database '${dbName}' already exists`);
        }
        
        // Switch to the database
        await connection.execute(`USE \`${dbName}\``);
        console.log(`✅ Using database '${dbName}'`);
        
        // Check if user has proper permissions
        console.log('🔐 Checking user permissions...');
        try {
            await connection.execute('SELECT 1');
            await connection.execute('SHOW TABLES');
            console.log('✅ User has proper read permissions');
            
            // Test write permissions
            await connection.execute(`
                CREATE TABLE IF NOT EXISTS test_table (
                    id INT PRIMARY KEY AUTO_INCREMENT,
                    test_field VARCHAR(50)
                )
            `);
            await connection.execute('DROP TABLE IF EXISTS test_table');
            console.log('✅ User has proper write permissions');
            
        } catch (permError) {
            console.error('❌ Permission error:', permError.message);
            throw permError;
        }
        
        // Test Sequelize connection
        console.log('🧪 Testing Sequelize connection...');
        const { sequelize } = require('../config/db');
        
        try {
            await sequelize.authenticate();
            console.log('✅ Sequelize connection test successful');
            
            // Test model loading
            console.log('🔄 Testing model initialization...');
            const { initializeModels } = require('../models');
            await initializeModels();
            console.log('✅ Models initialized successfully');
            
        } catch (seqError) {
            console.error('❌ Sequelize error:', seqError.message);
            throw seqError;
        }
        
        console.log('🎉 Database setup completed successfully!');
        return true;
        
    } catch (error) {
        console.error('❌ Database setup failed:', error.message);
        
        // Provide troubleshooting tips
        console.log('\n🔧 Troubleshooting tips:');
        
        if (error.code === 'ER_ACCESS_DENIED_ERROR') {
            console.log('1. Check your MySQL username and password in .env file');
            console.log('2. Make sure the MySQL user has proper permissions');
            console.log('3. Try connecting to MySQL directly: mysql -u root -p');
        } else if (error.code === 'ECONNREFUSED') {
            console.log('1. Make sure MySQL server is running: sudo systemctl status mysql');
            console.log('2. Check if MySQL is running on the correct port');
            console.log('3. Check firewall settings');
        } else if (error.code === 'ER_BAD_DB_ERROR') {
            console.log('1. Database will be created automatically');
            console.log('2. Make sure user has CREATE DATABASE permission');
        }
        
        console.log('\n📋 Current environment variables:');
        console.log(`DB_HOST: ${process.env.DB_HOST || 'Not set (defaulting to localhost)'}`);
        console.log(`DB_PORT: ${process.env.DB_PORT || 'Not set (defaulting to 3306)'}`);
        console.log(`DB_USER: ${process.env.DB_USER || 'Not set (defaulting to root)'}`);
        console.log(`DB_PASS: ${process.env.DB_PASS ? '[SET]' : 'Not set'}`);
        console.log(`DB_NAME: ${process.env.DB_NAME || 'Not set (defaulting to duewin_db)'}`);
        
        return false;
    } finally {
        if (connection) {
            await connection.end();
            console.log('🔌 Database connection closed');
        }
    }
}

// Run the setup if this file is executed directly
if (require.main === module) {
    setupDatabase()
        .then((success) => {
            process.exit(success ? 0 : 1);
        })
        .catch((error) => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}

module.exports = { setupDatabase };