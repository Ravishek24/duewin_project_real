// Database configuration with migration support
const config = {
  development: {
    username: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'duewin',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    logging: false,
    pool: {
      max: 50,
      min: 10,
      acquire: 120000,
      idle: 60000,
      evict: 60000
    },
    retry: {
      max: 5,
      match: [
        /SequelizeConnectionError/,
        /SequelizeConnectionRefusedError/,
        /SequelizeHostNotFoundError/,
        /SequelizeHostNotReachableError/,
        /SequelizeInvalidConnectionError/,
        /SequelizeConnectionTimedOutError/,
        /TimeoutError/,
        /ConnectionAcquireTimeoutError/
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
    username: process.env.DB_USER || 'admin',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'duewin',
    host: process.env.DB_HOST || 'your-aurora-cluster.cluster-xyz.region.rds.amazonaws.com',
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    logging: false,
    pool: {
      max: 100,
      min: 20,
      acquire: 120000,
      idle: 30000,
      evict: 60000
    },
    retry: {
      max: 5,
      match: [
        /SequelizeConnectionError/,
        /SequelizeConnectionRefusedError/,
        /SequelizeHostNotFoundError/,
        /SequelizeHostNotReachableError/,
        /SequelizeInvalidConnectionError/,
        /SequelizeConnectionTimedOutError/,
        /TimeoutError/,
        /ConnectionAcquireTimeoutError/
      ]
    },
    define: {
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    }
  },
  // NEW: Migration configuration
  migration_source: {
    username: process.env.SOURCE_DB_USER || 'migration_user',
    password: process.env.SOURCE_DB_PASSWORD || '',
    database: process.env.SOURCE_DB_NAME || 'duewin',
    host: process.env.SOURCE_DB_HOST || 'localhost',
    port: process.env.SOURCE_DB_PORT || 3306,
    dialect: 'mysql',
    logging: false,
    pool: {
      max: 10,
      min: 2,
      acquire: 60000,
      idle: 30000
    }
  },
  migration_target: {
    username: process.env.TARGET_DB_USER || 'admin',
    password: process.env.TARGET_DB_PASSWORD || '',
    database: process.env.TARGET_DB_NAME || 'duewin',
    host: process.env.TARGET_DB_HOST || 'your-aurora-cluster.cluster-xyz.region.rds.amazonaws.com',
    port: process.env.TARGET_DB_PORT || 3306,
    dialect: 'mysql',
    logging: false,
    pool: {
      max: 20,
      min: 5,
      acquire: 60000,
      idle: 30000
    }
  }
};

module.exports = config; 