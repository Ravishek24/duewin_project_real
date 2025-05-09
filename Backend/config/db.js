// config/db.js
const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');
const config = require('./config.cjs');
const { SequelizeObserver } = require('./sequelizeObserver');

dotenv.config();

// Get the current environment
const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

// Create the Sequelize instance
const sequelize = new Sequelize(
    dbConfig.database,
    dbConfig.username,
    dbConfig.password,
    {
        host: dbConfig.host,
        dialect: dbConfig.dialect,
        port: process.env.DB_PORT || 3306,
        logging: dbConfig.logging,
        dialectOptions: {
            connectTimeout: 60000,
        },
        // Disable sync operations completely
        sync: {
            force: false,
            alter: false
        }
    }
);

// Override the sync method to prevent automatic syncing
const originalSync = sequelize.sync;
sequelize.sync = function() {
    console.log('⚠️ Automatic sync operation blocked');
    return Promise.resolve();
};

// Install the query interceptor to block problematic session_id queries
new SequelizeObserver(sequelize);

// Connect to the database
const connectDB = async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ Database connected successfully.');
        return true;
    } catch (error) {
        console.error('❌ Error connecting to the database:', error.message);
        process.exit(1);
    }
};

module.exports = { sequelize, connectDB };
