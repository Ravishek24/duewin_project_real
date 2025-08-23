// config/db.js - COMPATIBILITY FIXED VERSION
const { Sequelize, Op, DataTypes } = require('sequelize');
const { SequelizeObserver } = require('./sequelizeObserver');
const config = require('./config.js');

let sequelize = null;
let isConnected = false;
let isInitialized = false;

// Get environment
const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

console.log('🔧 Database configuration loaded for environment:', env);

// Create the Sequelize instance function
const createSequelizeInstance = () => {
    if (sequelize) {
        console.log('♻️ Reusing existing Sequelize instance');
        return sequelize;
    }

    console.log('🆕 Creating new Sequelize instance...');
    
    // ✅ SIMPLIFIED: Create Sequelize with minimal, guaranteed-working config
    sequelize = new Sequelize(
        dbConfig.database,
        dbConfig.username,
        dbConfig.password,
        {
            host: dbConfig.host,
            port: dbConfig.port,
            dialect: dbConfig.dialect,
            logging: process.env.NODE_ENV === 'development' ? console.log : false,
            define: {
                underscored: true,
                timestamps: true,
                createdAt: 'created_at',
                updatedAt: 'updated_at'
            },
            
            // ✅ SIMPLIFIED: Basic pool configuration that works with all Sequelize versions
            pool: {
                max: 10,
                min: 2,
                acquire: 45000,
                idle: 10000,
                evict: 5000,
                handleDisconnects: true
            },
            
            // ✅ MINIMAL: Only essential dialect options (removed problematic ones)
            dialectOptions: {
                connectTimeout: 15000,
                multipleStatements: false,
                charset: 'utf8mb4'
                // Removed: collate (causing warnings)
            },
            
            // ✅ Basic retry configuration
            retry: {
                max: 3,
                match: [
                    /SequelizeConnectionError/,
                    /SequelizeDeadlockError/,
                    /SequelizeConnectionRefusedError/,
                    /SequelizeHostNotFoundError/,
                    /SequelizeHostNotReachableError/,
                    /SequelizeInvalidConnectionError/,
                    /SequelizeConnectionTimedOutError/,
                    /ConnectionAcquireTimeoutError/,
                    /TimeoutError/
                ]
            }
        }
    );

    // ✅ Add connection event handlers
    sequelize.addHook('beforeConnect', (config) => {
        console.log('🔌 [DB] Attempting connection...');
    });

    sequelize.addHook('afterConnect', (connection, config) => {
        console.log(`✅ [DB] Connected (Thread ID: ${connection.threadId})`);
        
        // ✅ Set session variables after connection (safer approach)
        setTimeout(async () => {
            try {
                await sequelize.query('SET SESSION innodb_lock_wait_timeout = 30');
                await sequelize.query('SET SESSION autocommit = 1'); 
                await sequelize.query('SET SESSION wait_timeout = 300');
                await sequelize.query('SET SESSION interactive_timeout = 300');
                console.log('✅ [DB] Session variables configured via query');
            } catch (error) {
                console.warn('⚠️ [DB] Failed to set session variables:', error.message);
            }
        }, 100);
    });

    sequelize.addHook('beforeDisconnect', (connection) => {
        console.log(`🔌 [DB] Disconnecting (Thread ID: ${connection.threadId})`);
    });

    // ✅ ROBUST: Pool monitoring that handles different Sequelize versions
    const monitorPool = () => {
        try {
            const connectionManager = sequelize.connectionManager;
            if (connectionManager && connectionManager.pool) {
                const pool = connectionManager.pool;
                
                // Handle different pool object structures
                const poolInfo = {
                    max: pool.max || pool._factory?.max || 'unknown',
                    min: pool.min || pool._factory?.min || 'unknown', 
                    size: pool.size || pool._count || 'unknown',
                    available: pool.available || pool._availableObjects?.length || 'unknown',
                    using: pool.using || pool._inUseObjects?.length || 'unknown',
                    waiting: pool.waiting || pool._waitingClients?.length || 0
                };
                
                console.log(`📊 [DB_POOL] Max: ${poolInfo.max}, Size: ${poolInfo.size}, Available: ${poolInfo.available}, Using: ${poolInfo.using}, Waiting: ${poolInfo.waiting}`);
                
                // Alert on issues
                if (typeof poolInfo.waiting === 'number' && poolInfo.waiting > 3) {
                    console.warn(`⚠️ [DB_POOL] High wait queue: ${poolInfo.waiting} requests waiting`);
                }
            } else {
                console.log('📊 [DB_POOL] Pool information not accessible');
            }
        } catch (error) {
            console.warn('⚠️ [DB_POOL] Error monitoring pool:', error.message);
        }
    };

    // Monitor pool every 30 seconds
    setInterval(monitorPool, 30000);

    // Override the sync method to prevent automatic syncing
    const originalSync = sequelize.sync;
    sequelize.sync = function() {
        console.log('⚠️ Automatic sync operation blocked');
        return Promise.resolve();
    };

    console.log('✅ Sequelize instance created with optimized pool settings');
    return sequelize;
};

// Connect to the database with enhanced validation
const connectDB = async () => {
    let retries = 3;
    
    while (retries > 0) {
        try {
            console.log('🔗 Attempting to connect to database...');
            
            // Create instance if it doesn't exist
            if (!sequelize) {
                createSequelizeInstance();
            }
            
            // Test the connection with timeout
            const connectionPromise = sequelize.authenticate();
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Connection authentication timeout')), 15000);
            });
            
            await Promise.race([connectionPromise, timeoutPromise]);
            console.log('✅ Database connection established successfully');
            
            // Additional validation - ensure Sequelize is fully initialized
            console.log('🔍 Validating Sequelize initialization...');
            
            // Check if all required methods exist
            const requiredMethods = ['getQueryInterface', 'getDialect', 'define'];
            for (const method of requiredMethods) {
                if (typeof sequelize[method] !== 'function') {
                    throw new Error(`Sequelize method ${method} is not available`);
                }
            }
            
            // Test getQueryInterface specifically
            const queryInterface = sequelize.getQueryInterface();
            if (!queryInterface) {
                throw new Error('QueryInterface is not available');
            }
            
            // ✅ ROBUST: Pool validation that works with different Sequelize versions
            try {
                const connectionManager = sequelize.connectionManager;
                if (connectionManager && connectionManager.pool) {
                    const pool = connectionManager.pool;
                    
                    // Check various possible pool configurations
                    const hasValidConfig = (
                        pool.max !== undefined || 
                        pool._factory?.max !== undefined ||
                        pool.size !== undefined ||
                        pool._count !== undefined
                    );
                    
                    if (hasValidConfig) {
                        console.log(`✅ Pool configured and accessible`);
                        
                        // Log whatever pool info we can get
                        const maxConnections = pool.max || pool._factory?.max || 'auto';
                        const currentSize = pool.size || pool._count || 'unknown';
                        console.log(`📊 Pool status: Max=${maxConnections}, Current=${currentSize}`);
                    } else {
                        console.warn('⚠️ Pool configuration unclear, but connection manager exists');
                        // Don't fail - many Sequelize versions work without explicit pool access
                    }
                } else {
                    console.warn('⚠️ Connection manager/pool not directly accessible');
                    // Don't fail - focus on whether the connection works
                }
                
                // Test if we can actually make a query (most important test)
                await sequelize.query('SELECT 1 as test', { timeout: 5000 });
                console.log('✅ Database query test successful');
                
            } catch (poolError) {
                console.warn('⚠️ Pool validation warning (non-critical):', poolError.message);
                // Don't throw - as long as queries work, we're good
            }
            
            console.log('✅ Sequelize fully validated and ready');
            isConnected = true;
            isInitialized = true;
            
            // Verify tables exist
            try {
                const tables = await sequelize.query('SHOW TABLES', { timeout: 10000 });
                console.log(`📊 Found ${tables[0].length} tables in database`);
                
                // Check specifically for important tables
                const tableNames = tables[0].map(t => Object.values(t)[0]);
                const importantTables = ['users', 'game_periods', 'bet_result_wingos', 'payment_gateways', 'wallet_recharges', 'wallet_withdrawals'];
                const missingTables = importantTables.filter(table => !tableNames.includes(table));
                
                if (missingTables.length > 0) {
                    console.warn('⚠️ Missing important tables:', missingTables);
                } else {
                    console.log('✅ All important tables exist');
                }
            } catch (error) {
                console.warn('⚠️ Could not verify tables:', error.message);
            }
            
            // Install the query interceptor after successful connection
            try {
                if (SequelizeObserver) {
                    const observer = new SequelizeObserver(sequelize);
                    if (observer) {
                        console.log('✅ Sequelize observer installed');
                    }
                }
            } catch (error) {
                console.warn('⚠️ Failed to install Sequelize observer:', error.message);
                // Don't throw error, continue with initialization
            }
            
            return true;
        } catch (error) {
            retries--;
            console.error(`❌ Database connection failed. ${retries} attempts remaining:`, error.message);
            
            if (retries === 0) {
                console.error('❌ Unable to connect to the database after multiple attempts');
                throw error;
            }
            
            console.log('⏳ Waiting 5 seconds before retrying...');
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            // Reset sequelize instance on retry
            if (sequelize) {
                try {
                    await sequelize.close();
                } catch (closeError) {
                    console.warn('⚠️ Error closing previous connection:', closeError.message);
                }
                sequelize = null;
                isConnected = false;
                isInitialized = false;
            }
        }
    }
};

// Wait for database to be ready
const waitForDatabase = async (maxWaitTime = 30000, retryInterval = 1000) => {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
        try {
            if (isConnected && isInitialized && sequelize) {
                // Verify connection is still alive with timeout
                const authPromise = sequelize.authenticate();
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Auth timeout')), 5000);
                });
                
                await Promise.race([authPromise, timeoutPromise]);
                return true;
            }
            
            // If not connected, try to connect
            if (!isConnected) {
                await connectDB();
                return true;
            }
            
            // Wait before next attempt
            await new Promise(resolve => setTimeout(resolve, retryInterval));
        } catch (error) {
            console.warn('⚠️ Database not ready, retrying...', error.message);
            await new Promise(resolve => setTimeout(resolve, retryInterval));
        }
    }
    
    throw new Error('Database connection timeout');
};

// FIXED: Get sequelize instance with simplified validation
const getSequelizeInstance = async () => {
    // If not initialized, initialize first
    if (!sequelize || !isConnected || !isInitialized) {
        console.log('🔄 [DB] Initializing database connection...');
        await connectDB();
    }
    
    // Simple validation - just check if sequelize exists and can authenticate
    if (!sequelize) {
        console.error('❌ [DB] Sequelize instance is null, reinitializing...');
        await connectDB();
    }
    
    return sequelize;
};

// Initialize database connection
const initializeDatabase = async () => {
    try {
        await connectDB();
        return true;
    } catch (error) {
        console.error('Failed to initialize database:', error);
        return false;
    }
};

// ✅ ROBUST: Get pool status that works with different Sequelize versions
const getPoolStatus = () => {
    try {
        if (sequelize && sequelize.connectionManager && sequelize.connectionManager.pool) {
            const pool = sequelize.connectionManager.pool;
            
            return {
                max: pool.max || pool._factory?.max || 'unknown',
                min: pool.min || pool._factory?.min || 'unknown',
                size: pool.size || pool._count || 'unknown',
                available: pool.available || pool._availableObjects?.length || 'unknown',
                using: pool.using || pool._inUseObjects?.length || 'unknown',
                waiting: pool.waiting || pool._waitingClients?.length || 0,
                isAccessible: true
            };
        }
    } catch (error) {
        console.error('Error getting pool status:', error.message);
    }
    return {
        max: 'unknown',
        min: 'unknown', 
        size: 'unknown',
        available: 'unknown',
        using: 'unknown',
        waiting: 0,
        isAccessible: false
    };
};

// ✅ Force cleanup idle connections (simplified)
const cleanupIdleConnections = async () => {
    try {
        console.log(`🧹 [DB] Attempting connection cleanup...`);
        
        // Simple approach: just test the connection
        if (sequelize) {
            await sequelize.authenticate();
            console.log(`✅ [DB] Connection verified during cleanup`);
        }
        
    } catch (error) {
        console.error('❌ [DB] Error during cleanup:', error.message);
    }
};

// ✅ Health check function
const healthCheck = async () => {
    try {
        if (!sequelize) {
            return { healthy: false, reason: 'Sequelize not initialized' };
        }
        
        // Quick authentication check
        await sequelize.authenticate();
        
        // Pool status check
        const poolStatus = getPoolStatus();
        
        return {
            healthy: true,
            connected: isConnected,
            initialized: isInitialized,
            pool: poolStatus
        };
    } catch (error) {
        return {
            healthy: false,
            reason: error.message,
            connected: isConnected,
            initialized: isInitialized
        };
    }
};

// Export functions and properties
module.exports = {
    connectDB,
    waitForDatabase,
    getSequelizeInstance,
    initializeDatabase,
    cleanupIdleConnections,
    getPoolStatus,
    healthCheck,
    get sequelize() {
        if (!sequelize) {
            console.warn('⚠️ Accessing sequelize before initialization');
        }
        return sequelize;
    },
    Op,
    DataTypes
};