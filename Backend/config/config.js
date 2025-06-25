require('dotenv').config();

// Debug logging for environment variables
console.log('Database Configuration Debug:', {
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
        dialect: 'mysql',
        logging: console.log,  // Enable logging for debugging
        pool: {
            max: 50,
            min: 10,
            acquire: 60000,
            idle: 30000,
            evict: 60000
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
        },
        define: {
            underscored: true,
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        }
    },
    production: {
        username: process.env.DB_USER || 'root',
        password: process.env.DB_PASS || '',
        database: process.env.DB_NAME || 'duewin_db',
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        dialect: 'mysql',
        logging: false,  // Disable logging in production
        pool: {
            max: 50,
            min: 10,
            acquire: 60000,
            idle: 30000,
            evict: 60000
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
        },
        define: {
            underscored: true,
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        }
    },
    test: {
        username: process.env.DB_USER || 'root',
        password: process.env.DB_PASS || '',
        database: process.env.DB_NAME_TEST || 'duewin_db_test',
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        dialect: 'mysql',
        logging: false,
        pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000
        }
    },
    // Add JWT configuration
    jwtSecret,
    jwtRefreshSecret,
    jwtExpiration,
    jwtRefreshExpiration
};

// Log the final configuration (without password)
console.log('Final Database Config:', {
    ...config[env],
    password: config[env].password ? '[HIDDEN]' : '[NOT SET]'
});

module.exports = config;