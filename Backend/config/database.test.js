module.exports = {
  development: {
    username: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'your_password',
    database: process.env.DB_NAME || 'diuwin_test',
    host: process.env.DB_HOST || 'localhost',
    dialect: 'mysql',
    logging: false,
    pool: {
      max: 20,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  },
  test: {
    username: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'your_password',
    database: process.env.DB_NAME || 'diuwin_test',
    host: process.env.DB_HOST || 'localhost',
    dialect: 'mysql',
    logging: false,
    pool: {
      max: 20,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
}; 