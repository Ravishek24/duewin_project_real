import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';
import paymentGatewayService from '../services/paymentGatewayService.js';

dotenv.config();

export const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASS,
    {
        host: process.env.DB_HOST,
        dialect: 'mysql',
        port: process.env.DB_PORT || 3306,
        logging: false,
        dialectOptions: {
            connectTimeout: 60000,
        },
    }
);

export const connectDB = async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ Database connected successfully.');

        // Sync models
        await sequelize.sync();  
        console.log('✅ All models were synchronized successfully.');
        
        // Initialize default payment gateways if they don't exist
        try {
            await paymentGatewayService.initializeDefaultGateways();
            console.log('✅ Payment gateways initialized.');
        } catch (error) {
            console.error('⚠️ Error initializing payment gateways:', error.message);
            // Don't exit on this error, it's not critical
        }
    } catch (error) {
        console.error('❌ Error connecting to the database:', error.message);
        process.exit(1);
    }
};

export default { sequelize, connectDB };