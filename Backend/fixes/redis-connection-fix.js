/**
 * Redis Connection Fix - Comprehensive solution for connection issues
 * This fixes the "Connection is closed" errors and connection leaks
 */

const Redis = require('ioredis');

/**
 * Enhanced Redis Connection Manager with Connection Pooling
 */
class FixedRedisManager {
    constructor() {
        this.connections = new Map();
        this.isInitialized = false;
        this.connectionPool = [];
        this.maxPoolSize = 10;
        this.baseConfig = this.createBaseConfig();
        
        // Connection purposes - limited to prevent leaks
        this.connectionPurposes = [
            'main',           // Primary operations
            'publisher',      // Publishing events
            'subscriber',     // Subscribing to events
            'websocket',      // WebSocket operations
            'scheduler',      // Scheduler operations
            'monitoring'      // Health checks
        ];
        
        // Stats tracking
        this.stats = {
            created: 0,
            active: 0,
            errors: 0,
            peakConnections: 0,
            deadConnections: 0
        };
        
        this.setupGracefulShutdown();
        this.startConnectionMonitoring();
    }

    /**
     * Create optimized base Redis configuration
     */
    createBaseConfig() {
        return {
            host: process.env.REDIS_HOST?.trim(), // FIX: Remove trailing space
            port: process.env.REDIS_PORT || 6379,
            password: process.env.REDIS_PASSWORD || '',
            db: process.env.REDIS_DB || 0,
            keyPrefix: 'strike:',
            
            // TLS configuration for ElastiCache
            tls: {
                rejectUnauthorized: false,
                requestCert: true,
                agent: false
            },
            
            // Connection optimization
            family: 4,
            keepAlive: 30000,
            connectTimeout: 15000,
            commandTimeout: 30000,
            lazyConnect: false,
            
            // CRITICAL FIX: Prevent connection leaks
            enableOfflineQueue: false,
            maxRetriesPerRequest: 3, // FIX: Changed from null to 3
            
            // Retry strategy
            retryStrategy: (times) => {
                const delay = Math.min(times * 50, 2000);
                return delay;
            }
        };
    }

    /**
     * Initialize with connection pooling
     */
    async initialize() {
        if (this.isInitialized) {
            console.log('⚠️ Redis manager already initialized');
            return;
        }

        console.log('🔄 Initializing Fixed Redis Manager...');
        
        try {
            // Create only essential connections
            for (const purpose of this.connectionPurposes) {
                await this.createConnection(purpose);
                console.log(`✅ Created Redis connection: ${purpose}`);
            }
            
            this.isInitialized = true;
            console.log('✅ Fixed Redis Manager initialized successfully');
            
        } catch (error) {
            console.error('❌ Failed to initialize Redis manager:', error);
            throw error;
        }
    }

    /**
     * Create connection with enhanced error handling
     */
    async createConnection(purpose) {
        if (this.connections.has(purpose)) {
            console.warn(`⚠️ Connection ${purpose} already exists`);
            return this.connections.get(purpose);
        }

        const connection = new Redis(this.baseConfig);
        
        // Enhanced event handlers
        connection.on('connect', () => {
            console.log(`✅ Redis connected: ${purpose}`);
        });

        connection.on('ready', () => {
            console.log(`✅ Redis ready: ${purpose}`);
            this.stats.active++;
            
            if (this.stats.active > this.stats.peakConnections) {
                this.stats.peakConnections = this.stats.active;
            }
        });

        connection.on('error', (error) => {
            console.error(`❌ Redis error (${purpose}):`, error.message);
            this.stats.errors++;
            
            // Auto-reconnect on connection errors
            if (error.message.includes('Connection is closed')) {
                console.log(`🔄 Auto-reconnecting ${purpose}...`);
                setTimeout(() => {
                    this.reconnectConnection(purpose);
                }, 5000);
            }
        });

        connection.on('close', () => {
            console.log(`🔌 Redis closed: ${purpose}`);
            this.stats.active--;
            this.stats.deadConnections++;
        });

        connection.on('reconnecting', () => {
            console.log(`🔄 Redis reconnecting: ${purpose}`);
        });

        // Wait for connection to be ready
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
     * Reconnect a specific connection
     */
    async reconnectConnection(purpose) {
        try {
            const oldConnection = this.connections.get(purpose);
            if (oldConnection) {
                await oldConnection.quit();
                this.connections.delete(purpose);
            }
            
            await this.createConnection(purpose);
            console.log(`✅ Reconnected ${purpose} successfully`);
        } catch (error) {
            console.error(`❌ Failed to reconnect ${purpose}:`, error);
        }
    }

    /**
     * Get connection with health check
     */
    getConnection(purpose = 'main') {
        if (!this.connectionPurposes.includes(purpose)) {
            throw new Error(`Invalid connection purpose: ${purpose}`);
        }

        if (!this.isInitialized) {
            throw new Error('Redis manager not initialized');
        }

        const connection = this.connections.get(purpose);
        if (!connection) {
            throw new Error(`Connection ${purpose} not found`);
        }

        // Check if connection is healthy
        if (connection.status !== 'ready') {
            console.warn(`⚠️ Connection ${purpose} is not ready, status: ${connection.status}`);
        }

        return connection;
    }

    /**
     * Get helper methods with connection pooling
     */
    getHelper() {
        const mainConnection = this.getConnection('main');
        
        return {
            async set(key, value, option = null, ttl = null, nx = null) {
                try {
                    const stringValue = typeof value === 'object' ? JSON.stringify(value) : value;
                    
                    if (ttl) {
                        await mainConnection.setex(key, ttl, stringValue);
                    } else if (nx) {
                        await mainConnection.setnx(key, stringValue);
                    } else {
                        await mainConnection.set(key, stringValue);
                    }
                    return true;
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

            async publish(channel, message) {
                try {
                    const publisher = this.getConnection('publisher');
                    return await publisher.publish(channel, JSON.stringify(message));
                } catch (error) {
                    console.error('Redis publish error:', error);
                    throw error;
                }
            },

            async subscribe(channel, callback) {
                try {
                    const subscriber = this.getConnection('subscriber');
                    await subscriber.subscribe(channel);
                    subscriber.on('message', (ch, message) => {
                        try {
                            const parsedMessage = JSON.parse(message);
                            callback(ch, parsedMessage);
                        } catch {
                            callback(ch, message);
                        }
                    });
                } catch (error) {
                    console.error('Redis subscribe error:', error);
                    throw error;
                }
            },

            getClient() {
                return mainConnection;
            },

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
     * Start connection monitoring
     */
    startConnectionMonitoring() {
        setInterval(async () => {
            try {
                const mainConnection = this.getConnection('main');
                const info = await mainConnection.info('clients');
                const connectedClients = info.match(/connected_clients:(\d+)/)?.[1] || '0';
                
                console.log(`📊 Redis Monitor - Server: ${connectedClients} clients, Manager: ${this.stats.active} active`);
                
                // Alert on high connections
                if (parseInt(connectedClients) > 50) {
                    console.warn(`🚨 HIGH Redis connections: ${connectedClients}`);
                }
                
                // Log stats
                console.log(`📈 Manager Stats:`, this.stats);
                
                // Clean up dead connections
                this.cleanupDeadConnections();
                
            } catch (error) {
                console.error('❌ Redis monitoring failed:', error.message);
            }
        }, 60000); // Every minute
    }

    /**
     * Clean up dead connections
     */
    cleanupDeadConnections() {
        for (const [purpose, connection] of this.connections) {
            if (connection.status === 'end' || connection.status === 'close') {
                console.log(`🧹 Cleaning up dead connection: ${purpose}`);
                this.connections.delete(purpose);
                this.stats.deadConnections++;
            }
        }
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
     * Manual cleanup
     */
    async cleanup() {
        console.log('🧹 Manual Redis cleanup...');
        
        for (const [purpose, connection] of this.connections) {
            try {
                await connection.quit();
                console.log(`✅ Closed connection: ${purpose}`);
            } catch (error) {
                console.error(`❌ Error closing ${purpose}:`, error.message);
            }
        }
        
        this.connections.clear();
        this.isInitialized = false;
        console.log('✅ Redis cleanup completed');
    }
}

// Create singleton instance
const fixedRedisManager = new FixedRedisManager();

module.exports = fixedRedisManager; 