import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config(); 


const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASS, {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306, 
    dialect: 'mysql',
    logging: false, 
});

const connectDB = async () => {
    try {
        await sequelize.authenticate();
        console.log('Connection to the database has been established successfully.');
    } catch (error) {
        console.error('Unable to connect to the database:', error);
        process.exit(1); 
    }
};

export { sequelize, connectDB };
