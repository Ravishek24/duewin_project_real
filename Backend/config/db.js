// config/db.js
require('dotenv').config();
const { Sequelize } = require('sequelize');
const { SequelizeObserver } = require('./sequelizeObserver');

// Get database configuration from environment variables
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    database: process.env.DB_NAME || 'duewin',
    username: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    dialect: 'mysql'
};

// Debug logging
console.log('Database Configuration:', {
    host: dbConfig.host,
    port: dbConfig.port,
    database: dbConfig.database,
    username: dbConfig.username,
    dialect: dbConfig.dialect,
    hasPassword: !!dbConfig.password
});

// Create the Sequelize instance
const sequelize = new Sequelize(
    dbConfig.database,
    dbConfig.username,
    dbConfig.password,
    {
        host: dbConfig.host,
        dialect: dbConfig.dialect,
        port: dbConfig.port,
        logging: false,
        define: {
            underscored: true,
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        },
        pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000
        },
        retry: {
            max: 3,
            match: [
                /SequelizeConnectionError/,
                /SequelizeConnectionRefusedError/,
                /SequelizeHostNotFoundError/,
                /SequelizeHostNotReachableError/,
                /SequelizeInvalidConnectionError/,
                /SequelizeConnectionTimedOutError/,
                /TimeoutError/
            ]
        }
    }
);

// Override the sync method to prevent automatic syncing
const originalSync = sequelize.sync;
sequelize.sync = function() {
    console.log('⚠️ Automatic sync operation blocked');
    return Promise.resolve();
};

// Connect to the database
const connectDB = async () => {
    let retries = 3;
    while (retries > 0) {
        try {
            await sequelize.authenticate();
            console.log('✅ Database connection established successfully');
            
            // Install the query interceptor after successful connection
            try {
                const observer = new SequelizeObserver(sequelize);
                if (observer) {
                    console.log('✅ Sequelize observer installed');
                }
            } catch (error) {
                console.warn('⚠️ Failed to install Sequelize observer:', error.message);
                // Don't throw error, continue with initialization
            }
            return true;
        } catch (error) {
            retries--;
            if (retries === 0) {
                console.error('❌ Unable to connect to the database after multiple attempts:', error);
                throw error;
            }
            console.warn(`⚠️ Database connection failed. Retrying... (${retries} attempts remaining)`);
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retrying
        }
    }
};

// Export the sequelize instance and connectDB function
module.exports = {
    sequelize,
    connectDB
};
