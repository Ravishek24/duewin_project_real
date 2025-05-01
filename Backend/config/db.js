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

        // 👇 Import models before sync
        await import('../models/index.js');
        await sequelize.sync({ alter: true }); // IMPORTANT CHANGE
        console.log('✅ All models synchronized successfully with database (altered).');
        
        return true;
    } catch (error) {
        console.error('❌ Error syncing models with database:', error.message);
        process.exit(1);
    }
};

export default { sequelize, connectDB, syncModels };
