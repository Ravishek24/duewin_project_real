// config/db.js
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
                const importantTables = ['users', 'payment_gateways', 'bet_result_wingos'];
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

// Get sequelize instance with validation
const getSequelizeInstance = () => {
    if (!sequelize) {
        throw new Error('Sequelize instance not created. Call connectDB() first.');
    }
    
    if (!isConnected || !isInitialized) {
        throw new Error('Database not connected or not fully initialized. Call connectDB() first.');
    }
    
    // Double-check that required methods are available
    if (!sequelize.getQueryInterface || typeof sequelize.getQueryInterface !== 'function') {
        throw new Error('Sequelize QueryInterface not available. Database may not be fully initialized.');
    }
    
    return sequelize;
};

// Check if database is ready for model initialization
const isDatabaseReady = () => {
    return sequelize && isConnected && isInitialized && 
           sequelize.getQueryInterface && 
           typeof sequelize.getQueryInterface === 'function';
};

// Wait for database to be ready
const waitForDatabase = async (maxWaitTime = 30000) => {
    const startTime = Date.now();
    
    while (!isDatabaseReady() && (Date.now() - startTime) < maxWaitTime) {
        console.log('⏳ Waiting for database to be ready...');
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    if (!isDatabaseReady()) {
        throw new Error(`Database not ready after ${maxWaitTime}ms timeout`);
    }
    
    console.log('✅ Database is ready for model initialization');
    return true;
};

// Export the sequelize instance and connectDB function
module.exports = {
    get sequelize() {
        return getSequelizeInstance();
    },
    connectDB,
    isDatabaseReady,
    waitForDatabase,
    Op,
    DataTypes
};