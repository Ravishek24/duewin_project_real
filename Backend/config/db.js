// config/db.js
const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');

dotenv.config();

// Create the Sequelize instance
const sequelize = new Sequelize(
    process.env.DB_NAME || 'diuwin',
    process.env.DB_USER || 'root',
    process.env.DB_PASS || '',
    {
        host: process.env.DB_HOST || 'localhost',
        dialect: 'mysql',
        port: process.env.DB_PORT || 3306,
        logging: false,
        dialectOptions: {
            connectTimeout: 60000,
        },
    }
);

// Connect to the database
const connectDB = async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ Database connected successfully.');
        
        console.log('✅ Database configuration loaded.');
        return true;
    } catch (error) {
        console.error('❌ Error connecting to the database:', error.message);
        process.exit(1);
    }
};

// Function to sync all models after they are loaded
const syncModels = async () => {
    try {
        // Import models and initialize associations
        const models = require('../models/index');
        
        // Wait a bit to ensure all associations are properly set up
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Sync with alter option
        await sequelize.sync({ alter: true });
        console.log('✅ All models synchronized successfully with database (altered).');
        
        return true;
    } catch (error) {
        console.error('❌ Error syncing models with database:', error.message);
        process.exit(1);
    }
};

module.exports = { sequelize, connectDB, syncModels };
