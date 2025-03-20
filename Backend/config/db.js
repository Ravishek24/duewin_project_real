import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

export const sequelize = new Sequelize(process.env.DB_USER, process.env.DB_PASS, {
    host: process.env.DB_HOST,
    dialect: 'mysql', // Replace with your database dialect if not MySQL
    logging: false, // Disable SQL query logs; optional
});

export const connectDB = async () => {
    try {
        await sequelize.authenticate();
        console.log('Database connected successfully.');

        // Synchronize all models with the database
        await sequelize.sync({ alter: true }); // Use { force: true } for a fresh table creation
        console.log('All models were synchronized successfully.');
    } catch (error) {
        console.error('Error connecting to the database:', error.message);
        process.exit(1);
    }
};

export default { sequelize, connectDB };
