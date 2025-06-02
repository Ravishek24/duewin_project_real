// config/db.js - FIXED VERSION
const { Sequelize, Op, DataTypes } = require('sequelize');
const { SequelizeObserver } = require('./sequelizeObserver');
const config = require('./config.js');

let sequelize = null;
let isConnected = false;
let isInitialized = false;

// Get environment
const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

console.log('🔧 Database configuration loaded for environment:', env);

// Create the Sequelize instance function
const createSequelizeInstance = () => {
    if (sequelize) {
        console.log('♻️ Reusing existing Sequelize instance');
        return sequelize;
    }

    console.log('🆕 Creating new Sequelize instance...');
    
    sequelize = new Sequelize(
        dbConfig.database,
        dbConfig.username,
        dbConfig.password,
        {
            host: dbConfig.host,
            port: dbConfig.port,
            dialect: dbConfig.dialect,
            logging: process.env.NODE_ENV === 'development' ? console.log : false,
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

    console.log('✅ Sequelize instance created');
    return sequelize;
};

// Connect to the database with enhanced validation
const connectDB = async () => {
    let retries = 5; // Increased retries
    
    while (retries > 0) {
        try {
            console.log('🔗 Attempting to connect to database...');
            
            // Create instance if it doesn't exist
            if (!sequelize) {
                createSequelizeInstance();
            }
            
            // Test the connection
            await sequelize.authenticate();
            console.log('✅ Database connection established successfully');
            
            // Additional validation - ensure Sequelize is fully initialized
            console.log('🔍 Validating Sequelize initialization...');
            
            // Check if all required methods exist
            const requiredMethods = ['getQueryInterface', 'getDialect', 'define'];
            for (const method of requiredMethods) {
                if (typeof sequelize[method] !== 'function') {
                    throw new Error(`Sequelize method ${method} is not available`);
                }
            }
            
            // Test getQueryInterface specifically
            const queryInterface = sequelize.getQueryInterface();
            if (!queryInterface) {
                throw new Error('QueryInterface is not available');
            }
            
            console.log('✅ Sequelize fully validated and ready');
            isConnected = true;
            isInitialized = true;
            
            // Verify tables exist
            try {
                const tables = await sequelize.query('SHOW TABLES');
                console.log(`📊 Found ${tables[0].length} tables in database`);
                
                // Check specifically for important tables
                const tableNames = tables[0].map(t => Object.values(t)[0]);
                const importantTables = ['users', 'game_periods', 'bet_result_wingos', 'payment_gateways', 'wallet_recharges', 'wallet_withdrawals'];
                const missingTables = importantTables.filter(table => !tableNames.includes(table));
                
                if (missingTables.length > 0) {
                    console.warn('⚠️ Missing important tables:', missingTables);
                } else {
                    console.log('✅ All important tables exist');
                }
            } catch (error) {
                console.warn('⚠️ Could not verify tables:', error.message);
            }
            
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
            console.error(`❌ Database connection failed. ${retries} attempts remaining:`, error.message);
            
            if (retries === 0) {
                console.error('❌ Unable to connect to the database after multiple attempts');
                throw error;
            }
            
            console.log('⏳ Waiting 3 seconds before retrying...');
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Reset sequelize instance on retry
            if (sequelize) {
                try {
                    await sequelize.close();
                } catch (closeError) {
                    console.warn('⚠️ Error closing previous connection:', closeError.message);
                }
                sequelize = null;
                isConnected = false;
                isInitialized = false;
            }
        }
    }
};

// Wait for database to be ready
const waitForDatabase = async (maxWaitTime = 30000, retryInterval = 1000) => {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
        try {
            if (isConnected && isInitialized && sequelize) {
                // Verify connection is still alive
                await sequelize.authenticate();
                return true;
            }
            
            // If not connected, try to connect
            if (!isConnected) {
                await connectDB();
                return true;
            }
            
            // Wait before next attempt
            await new Promise(resolve => setTimeout(resolve, retryInterval));
        } catch (error) {
            console.warn('⚠️ Database not ready, retrying...', error.message);
            await new Promise(resolve => setTimeout(resolve, retryInterval));
        }
    }
    
    throw new Error('Database connection timeout');
};

// FIXED: Get sequelize instance with proper initialization
const getSequelizeInstance = async () => {
    // If not initialized, initialize first
    if (!sequelize || !isConnected || !isInitialized) {
        await connectDB();
    }
    return sequelize;
};

// Initialize database connection
const initializeDatabase = async () => {
    try {
        await connectDB();
        return true;
    } catch (error) {
        console.error('Failed to initialize database:', error);
        return false;
    }
};

// Export functions and properties
module.exports = {
    connectDB,
    waitForDatabase,
    getSequelizeInstance,
    initializeDatabase,
    get sequelize() {
        if (!sequelize) {
            console.warn('⚠️ Accessing sequelize before initialization');
        }
        return sequelize;
    },
    Op,
    DataTypes
};