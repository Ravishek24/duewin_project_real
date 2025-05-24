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
            await sequelize.authenticate();
            console.log('✅ Database connection established successfully');
            
            // Verify tables exist
            try {
                const tables = await sequelize.query('SHOW TABLES');
                console.log('Available tables:', tables[0].map(t => Object.values(t)[0]));
                
                // Check specifically for bet_result_wingos table
                const wingoTable = tables[0].find(t => Object.values(t)[0] === 'bet_result_wingos');
                if (!wingoTable) {
                    console.error('❌ bet_result_wingos table not found in database!');
                } else {
                    console.log('✅ bet_result_wingos table exists');
                }
            } catch (error) {
                console.error('Error checking tables:', error);
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
    connectDB,
    Op,
    DataTypes
};
