require('dotenv').config();

// Debug logging
console.log('Environment Variables:', {
    DB_HOST: process.env.DB_HOST,
    DB_PORT: process.env.DB_PORT,
    DB_NAME: process.env.DB_NAME,
    DB_USER: process.env.DB_USER,
    hasPassword: !!process.env.DB_PASS,
    NODE_ENV: process.env.NODE_ENV
});

const env = process.env.NODE_ENV || 'development';

// Default JWT settings
const jwtSecret = process.env.JWT_SECRET || 'default_jwt_secret_replace_in_production';
const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || 'default_refresh_secret_replace_in_production';
const jwtExpiration = process.env.JWT_EXPIRATION || '1h';
const jwtRefreshExpiration = process.env.JWT_REFRESH_EXPIRATION || '7d';

const config = {
    development: {
        username: process.env.DB_USER || 'root',
        password: process.env.DB_PASS || '',
        database: process.env.DB_NAME || 'duewin_db',
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        dialect: 'mysql'
    },
    production: {
        username: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME,
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        dialect: 'mysql'
    },
    // Add JWT configuration
    jwtSecret,
    jwtRefreshSecret,
    jwtExpiration,
    jwtRefreshExpiration
};

module.exports = config; 