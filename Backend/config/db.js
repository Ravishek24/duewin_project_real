// config/db.js
import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

// Create the Sequelize instance
export const sequelize = new Sequelize(
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
export const connectDB = async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ Database connected successfully.');
        
        // Don't sync models here - we'll do it after all models are loaded
        console.log('✅ Database configuration loaded.');
        
        return true;
    } catch (error) {
        console.error('❌ Error connecting to the database:', error.message);
        process.exit(1);
    }
};

// Function to sync all models after they are loaded
export const syncModels = async () => {
    try {
        await sequelize.sync();
        console.log('✅ All models were synchronized successfully.');
        
        // Initialize any default data here if needed
        
        return true;
    } catch (error) {
        console.error('❌ Error syncing models:', error.message);
        process.exit(1);
    }
};

export default { sequelize, connectDB, syncModels };