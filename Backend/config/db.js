import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

export const sequelize = new Sequelize(
    process.env.DB_NAME,  // ✅ Now using "level" as DB_NAME
    process.env.DB_USER,
    process.env.DB_PASS,
    {
        host: process.env.DB_HOST,
        dialect: 'mysql',  // ✅ Set the correct dialect
        port: process.env.DB_PORT || 3306,
        logging: false,
        dialectOptions: {
            connectTimeout: 60000,  // ✅ Prevent connection timeouts
        },
    }
);

export const connectDB = async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ Database connected successfully.');

        // Sync models (remove `{ alter: true }` if not needed)
        await sequelize.sync();  
        console.log('✅ All models were synchronized successfully.');
    } catch (error) {
        console.error('❌ Error connecting to the database:', error.message);
        process.exit(1);
    }
};

export default { sequelize, connectDB };
