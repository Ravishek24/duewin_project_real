const Redis = require('ioredis');
require('dotenv').config();
const { CACHE } = require('./constants');

console.log('🔄 Initializing Unified Redis Manager...');
console.log('REDIS_HOST from process.env:', process.env.REDIS_HOST);

/**
 * UNIFIED Redis Manager - Single source of truth for all Redis connections
 * Replaces redis.js, redisConfig.js, and redisConnectionManager.js
 * Maintains 100% backward compatibility with existing code
 */
class UnifiedRedisManager {
    constructor() {
        this.connections = new Map();
        this.isInitialized = false;
        this.baseConfig = this.createBaseConfig();
        
        // Fixed connection purposes - prevent dynamic connection creation
        this.connectionPurposes = [
            'main',           // Primary operations (replaces redis.js)
            'publisher',      // Publishing events (for pub/sub)
            'subscriber',     // Subscribing to events (for WebSocket)
            'websocket',      // WebSocket operations (replaces redisConfig.js)
            'scheduler',      // Scheduler operations
            'monitoring'      // Health checks and monitoring
        ];
        
        // Stats tracking
        this.stats = {
            created: 0,
            active: 0,
            errors: 0,
            peakConnections: 0
        };
        
        this.setupGracefulShutdown();
    }

    /**
     * Create base Redis configuration (matches your existing config)
     */
    createBaseConfig() {
        return {
            host: process.env.REDIS_HOST ,
            port: process.env.REDIS_PORT || 6379,
            password: process.env.REDIS_PASSWORD || '',
            db: process.env.REDIS_DB || 0,
            keyPrefix: CACHE.PREFIX,
            
            // TLS configuration for ElastiCache (matches your existing config)
            tls: {
                rejectUnauthorized: false,
                requestCert: true,
                agent: false
            },
            
            // Connection optimization (matches your existing config)
            family: 4,
            keepAlive: 30000,
            connectTimeout: 15000,
            commandTimeout: 30000, // INCREASED: 30 seconds for large operations like hgetall
            lazyConnect: false,
            
            // Critical: Prevent connection leaks
            enableOfflineQueue: false,
            // BullMQ requires this to be null!
            maxRetriesPerRequest: null,
            
            // Retry strategy (matches your existing config)
            retryStrategy: (times) => {
                const delay = Math.min(times * 50, 2000);
                return delay;
            }
        };
    }

    /**
     * Initialize all predefined connections
     */
    async initialize() {
        if (this.isInitialized) {
            console.log('⚠️ Redis manager already initialized');
            return;
        }

        console.log('🔄 Initializing Unified Redis Manager...');
        console.log('Redis config for Strike Game ElastiCache:', {
            host: this.baseConfig.host,
            port: this.baseConfig.port,
            db: this.baseConfig.db,
            tls: 'enabled',
            keyPrefix: this.baseConfig.keyPrefix
        });
        
        // Create only predefined connections
        for (const purpose of this.connectionPurposes) {
            try {
                await this.createConnection(purpose);
                console.log(`✅ Created Redis connection: ${purpose}`);
            } catch (error) {
                console.error(`❌ Failed to create ${purpose} connection:`, error.message);
                throw error;
            }
        }
        
        this.isInitialized = true;
        console.log(`✅ Unified Redis Manager initialized with ${this.connections.size} connections`);
        
        // Start monitoring
        this.startMonitoring();
        
        // Test connections
        await this.healthCheck();
    }

    /**
     * Create a single connection for a specific purpose
     */
    async createConnection(purpose) {
        if (this.connections.has(purpose)) {
            console.warn(`⚠️ Connection ${purpose} already exists`);
            return this.connections.get(purpose);
        }

        const connection = new Redis(this.baseConfig);
        
        // Add event handlers (matches your existing pattern)
        connection.on('connect', () => {
            console.log(`✅ Strike Game Redis client connected: ${purpose}`);
        });

        connection.on('ready', () => {
            console.log(`✅ Strike Game Redis client ready: ${purpose}`);
            this.stats.active++;
            
            if (this.stats.active > this.stats.peakConnections) {
                this.stats.peakConnections = this.stats.active;
            }
            
            // DISABLE offline queue after connection is ready (matches your existing pattern)
            connection.options.enableOfflineQueue = false;
        });

        connection.on('error', (error) => {
            console.error(`❌ Strike Game Redis client error (${purpose}):`, error.message);
            this.stats.errors++;
            
            // Critical: Don't create new connections on error
            if (error.message.includes('max number of clients')) {
                console.error(`🚨 Redis connection limit reached for ${purpose}!`);
            }
        });

        connection.on('close', () => {
            console.log(`🔌 Strike Game Redis client connection closed: ${purpose}`);
            this.stats.active--;
        });

        connection.on('reconnecting', () => {
            console.log(`🔄 Strike Game Redis client reconnecting: ${purpose}`);
        });

        // Wait for connection to be ready (matches your existing pattern)
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error(`Connection timeout for ${purpose}`));
            }, 20000);

            if (connection.status === 'ready') {
                clearTimeout(timeout);
                resolve();
                return;
            }

            connection.once('ready', () => {
                clearTimeout(timeout);
                resolve();
            });

            connection.once('error', (error) => {
                clearTimeout(timeout);
                reject(error);
            });
        });

        this.connections.set(purpose, connection);
        this.stats.created++;
        
        return connection;
    }

    /**
     * Get connection by purpose - ONLY predefined purposes allowed
     */
    getConnection(purpose = 'main') {
        if (!this.connectionPurposes.includes(purpose)) {
            console.error(`❌ Invalid connection purpose: ${purpose}`);
            console.error(`📋 Valid purposes: ${this.connectionPurposes.join(', ')}`);
            throw new Error(`Invalid connection purpose: ${purpose}`);
        }

        // If not initialized, try to initialize automatically
        if (!this.isInitialized) {
            console.log('🔄 Redis manager not initialized, attempting auto-initialization...');
            return this.initialize().then(() => {
                const connection = this.connections.get(purpose);
                if (!connection) {
                    throw new Error(`Connection ${purpose} not found after initialization`);
                }
                return connection;
            });
        }

        const connection = this.connections.get(purpose);
        if (!connection) {
            throw new Error(`Connection ${purpose} not found`);
        }

        return connection;
    }

    /**
     * Get helper methods for common operations (100% backward compatible with redis.js)
     */
    getHelper() {
        const mainConnection = this.getConnection('main');
        
        return {
            async set(key, value, option = null, ttl = null, nx = null) {
                try {
                    const stringValue = typeof value === 'object' ? JSON.stringify(value) : value;
                    
                    if (option === 'EX' && nx === 'NX') {
                        const ttlSeconds = Math.floor(Number(ttl));
                        if (isNaN(ttlSeconds) || ttlSeconds <= 0) {
                            throw new Error('Invalid TTL value. Must be a positive number.');
                        }
                        const result = await mainConnection.set(key, stringValue, 'EX', ttlSeconds, 'NX');
                        return result === 'OK';
                    } else if (ttl) {
                        const ttlSeconds = Math.floor(Number(ttl));
                        if (isNaN(ttlSeconds) || ttlSeconds <= 0) {
                            throw new Error('Invalid TTL value. Must be a positive number.');
                        }
                        await mainConnection.setex(key, ttlSeconds, stringValue);
                        return true;
                    } else {
                        await mainConnection.set(key, stringValue);
                        return true;
                    }
                } catch (error) {
                    console.error('Redis set error:', error);
                    throw error;
                }
            },

            async get(key) {
                try {
                    const value = await mainConnection.get(key);
                    if (!value) return null;
                    try {
                        return JSON.parse(value);
                    } catch {
                        return value;
                    }
                } catch (error) {
                    console.error('Redis get error:', error);
                    throw error;
                }
            },

            async del(key) {
                try {
                    await mainConnection.del(key);
                } catch (error) {
                    console.error('Redis del error:', error);
                    throw error;
                }
            },

            async exists(key) {
                try {
                    const result = await mainConnection.exists(key);
                    return result === 1;
                } catch (error) {
                    console.error('Redis exists error:', error);
                    throw error;
                }
            },

            async expire(key, ttl) {
                try {
                    await mainConnection.expire(key, ttl);
                } catch (error) {
                    console.error('Redis expire error:', error);
                    throw error;
                }
            },

            async incr(key, increment = 1) {
                try {
                    return await mainConnection.incrby(key, increment);
                } catch (error) {
                    console.error('Redis incr error:', error);
                    throw error;
                }
            },

            async decr(key, decrement = 1) {
                try {
                    return await mainConnection.decrby(key, decrement);
                } catch (error) {
                    console.error('Redis decr error:', error);
                    throw error;
                }
            },

            async hset(key, field, value) {
                try {
                    const stringValue = typeof value === 'object' ? JSON.stringify(value) : value;
                    return await mainConnection.hset(key, field, stringValue);
                } catch (error) {
                    console.error('Redis hset error:', error);
                    throw error;
                }
            },

            async hget(key, field) {
                try {
                    const value = await mainConnection.hget(key, field);
                    if (!value) return null;
                    try {
                        return JSON.parse(value);
                    } catch {
                        return value;
                    }
                } catch (error) {
                    console.error('Redis hget error:', error);
                    throw error;
                }
            },

            async hgetall(key) {
                try {
                    return await mainConnection.hgetall(key);
                } catch (error) {
                    console.error('Redis hgetall error:', error);
                    throw error;
                }
            },

            async hincrby(key, field, increment = 1) {
                try {
                    return await mainConnection.hincrby(key, field, increment);
                } catch (error) {
                    console.error('Redis hincrby error:', error);
                    throw error;
                }
            },

            // Set operations (for 5D protection service)
            async sadd(key, ...members) {
                try {
                    return await mainConnection.sadd(key, ...members);
                } catch (error) {
                    console.error('Redis sadd error:', error);
                    throw error;
                }
            },

            async srem(key, ...members) {
                try {
                    return await mainConnection.srem(key, ...members);
                } catch (error) {
                    console.error('Redis srem error:', error);
                    throw error;
                }
            },

            async smembers(key) {
                try {
                    return await mainConnection.smembers(key);
                } catch (error) {
                    console.error('Redis smembers error:', error);
                    throw error;
                }
            },

            async scard(key) {
                try {
                    return await mainConnection.scard(key);
                } catch (error) {
                    console.error('Redis scard error:', error);
                    throw error;
                }
            },

            async hlen(key) {
                try {
                    return await mainConnection.hlen(key);
                } catch (error) {
                    console.error('Redis hlen error:', error);
                    throw error;
                }
            },

            async hkeys(key) {
                try {
                    return await mainConnection.hkeys(key);
                } catch (error) {
                    console.error('Redis hkeys error:', error);
                    throw error;
                }
            },

            async keys(pattern) {
                try {
                    return await mainConnection.keys(pattern);
                } catch (error) {
                    console.error('Redis keys error:', error);
                    throw error;
                }
            },

            async type(key) {
                try {
                    return await mainConnection.type(key);
                } catch (error) {
                    console.error('Redis type error:', error);
                    throw error;
                }
            },

            // Direct access to main connection (backward compatible)
            getClient() {
                return mainConnection;
            },

            // Test connection (backward compatible)
            async ping() {
                try {
                    return await mainConnection.ping();
                } catch (error) {
                    console.error('Redis ping error:', error);
                    throw error;
                }
            }
        };
    }

    /**
     * Health check all connections
     */
    async healthCheck() {
        console.log('🔍 Redis health check...');
        
        const results = [];
        for (const [purpose, connection] of this.connections) {
            try {
                const start = Date.now();
                await connection.ping();
                const latency = Date.now() - start;
                
                results.push({
                    purpose,
                    status: 'healthy',
                    latency: `${latency}ms`
                });
            } catch (error) {
                results.push({
                    purpose,
                    status: 'unhealthy',
                    error: error.message
                });
            }
        }
        
        console.log('📊 Redis Health Results:', results);
        return results;
    }

    /**
     * Start connection monitoring
     */
    startMonitoring() {
        setInterval(async () => {
            try {
                const mainConnection = this.getConnection('main');
                const info = await mainConnection.info('clients');
                const connectedClients = info.match(/connected_clients:(\d+)/)?.[1] || '0';
                
                console.log(`📊 Redis Monitor - Server: ${connectedClients} clients, Manager: ${this.stats.active} active`);
                
                // Alert on high connections
                if (parseInt(connectedClients) > 100) {
                    console.warn(`🚨 HIGH Redis connections: ${connectedClients}`);
                }
                
                // Log our stats
                console.log(`📈 Manager Stats:`, this.stats);
                
            } catch (error) {
                console.error('❌ Redis monitoring failed:', error.message);
            }
        }, 60000); // Every minute
    }

    /**
     * Get statistics
     */
    getStats() {
        return {
            ...this.stats,
            initialized: this.isInitialized,
            connectionCount: this.connections.size,
            purposes: Array.from(this.connections.keys())
        };
    }

    /**
     * Setup graceful shutdown
     */
    setupGracefulShutdown() {
        const cleanup = async (signal) => {
            console.log(`🛑 Received ${signal}, shutting down Redis connections gracefully...`);
            
            const promises = [];
            for (const [purpose, connection] of this.connections) {
                console.log(`🔌 Closing connection: ${purpose}`);
                promises.push(connection.quit().catch(err => {
                    console.error(`❌ Error closing ${purpose}:`, err.message);
                }));
            }
            
            try {
                await Promise.allSettled(promises);
                console.log('✅ All Redis connections closed gracefully');
            } catch (error) {
                console.error('❌ Error during Redis cleanup:', error.message);
            }
            
            process.exit(0);
        };

        process.on('SIGINT', () => cleanup('SIGINT'));
        process.on('SIGTERM', () => cleanup('SIGTERM'));
        process.on('SIGQUIT', () => cleanup('SIGQUIT'));
    }

    /**
     * Manual cleanup (for testing/restart)
     */
    async cleanup() {
        console.log('🧹 Manual Redis cleanup...');
        
        for (const [purpose, connection] of this.connections) {
            try {
                await connection.quit();
                console.log(`✅ Closed: ${purpose}`);
            } catch (error) {
                console.error(`❌ Error closing ${purpose}:`, error.message);
            }
        }
        
        this.connections.clear();
        this.isInitialized = false;
        this.stats = { created: 0, active: 0, errors: 0, peakConnections: 0 };
        
        console.log('✅ Redis cleanup completed');
    }
}

// Create and export singleton
const unifiedRedisManager = new UnifiedRedisManager();

module.exports = unifiedRedisManager; 