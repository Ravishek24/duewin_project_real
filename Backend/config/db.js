// config/db.js
const { Sequelize, Op, DataTypes } = require('sequelize');
const { SequelizeObserver } = require('./sequelizeObserver');
const config = require('./config.js');

// Create the Sequelize instance
const sequelize = new Sequelize(
    config[process.env.NODE_ENV || 'development'].database,
    config[process.env.NODE_ENV || 'development'].username,
    config[process.env.NODE_ENV || 'development'].password,
    {
        host: config[process.env.NODE_ENV || 'development'].host,
        port: config[process.env.NODE_ENV || 'development'].port,
        dialect: config[process.env.NODE_ENV || 'development'].dialect,
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

// Connect to the database
const connectDB = async () => {
    let retries = 3;
    while (retries > 0) {
        try {
            console.log('🔗 Attempting to connect to database...');
            await sequelize.authenticate();
            console.log('✅ Database connection established successfully');
            
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
            
            console.log('⏳ Waiting 2 seconds before retrying...');
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
};

// Export the sequelize instance and connectDB function
module.exports = {
    sequelize,
    connectDB,
    Op,
    DataTypes
};