const Redis = require('ioredis');
require('dotenv').config();
const { CACHE } = require('./constants');

console.log('🔄 Initializing Unified Redis Manager...');
console.log('REDIS_HOST from process.env:', process.env.REDIS_HOST);

/**
 * UNIFIED Redis Manager - Single source of truth for all Redis connections
 * Replaces redis.js, redisConfig.js, and redisConnectionManager.js
 * Maintains 100% backward compatibility with existing code
 * 
 * 🚀 ENHANCED: Added comprehensive connection resilience and EPIPE error handling
 */
class UnifiedRedisManager {
    constructor() {
        this.connections = new Map();
        this.isInitialized = false;
        this.baseConfig = this.createBaseConfig();
        this.reconnectionAttempts = new Map();
        this.maxReconnectionAttempts = 5;
        this.reconnectionDelay = 1000;
        
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
            peakConnections: 0,
            reconnections: 0,
            epipeErrors: 0
        };
        
        this.setupGracefulShutdown();
    }

    /**
     * Create base Redis configuration (matches your existing config)
     * 🚀 ENHANCED: Added better connection resilience settings
     */
    createBaseConfig() {
        const host = process.env.REDIS_HOST || 'localhost';
        const port = process.env.REDIS_PORT || 6379;
        const useTlsEnv = String(process.env.REDIS_TLS || '').toLowerCase() === 'true';
        const isAwsCache = host.includes('amazonaws.com');

        const tlsConfig = (useTlsEnv || isAwsCache) ? {
            // SNI is important for AWS ElastiCache
            servername: host,
            rejectUnauthorized: false,
            requestCert: false,
            agent: false,
            minVersion: 'TLSv1.2',
            maxVersion: 'TLSv1.3',
            ciphers: 'ALL'
        } : false;

        const base = {
            host,
            port,
            password: process.env.REDIS_PASSWORD || '',
            db: process.env.REDIS_DB || 0,
            keyPrefix: CACHE.PREFIX,
            tls: tlsConfig,

            // 🚀 ENHANCED: Improved connection resilience
            family: 4,
            keepAlive: 30000,
            connectTimeout: 60000,
            commandTimeout: 60000,
            lazyConnect: false,

            // 🚀 ENHANCED: Better reconnection settings
            enableOfflineQueue: true,
            maxRetriesPerRequest: 3,
            retryDelayOnFailover: 100,
            enableReadyCheck: true,
            maxLoadingTimeout: 60000,

            // 🚀 NEW: Automatic reconnection settings
            retryDelayOnClusterDown: 300,
            maxRetriesPerRequest: 3,
            enableAutoPipelining: false,

            retryStrategy: (times) => {
                const delay = Math.min(times * 200, 10000);
                console.log(`🔄 Redis retry attempt ${times}, waiting ${delay}ms...`);
                return delay;
            }
        };

        if (!process.env.REDIS_HOST) {
            console.warn('⚠️ REDIS_HOST not set in environment. Falling back to localhost:6379');
        }

        return base;
    }

    /**
     * 🚀 NEW: Check if connection is healthy and ready for operations
     */
    isConnectionHealthy = (connection) => {
        if (!connection) return false;
        
        // Check connection status
        if (connection.status !== 'ready') return false;
        
        // Check if connection is writable
        if (connection.stream && connection.stream.destroyed) return false;
        
        // Check if connection has recent activity
        if (connection.lastError && Date.now() - connection.lastError < 5000) return false;
        
        return true;
    };

    /**
     * 🚀 NEW: Get healthy connection with automatic reconnection
     */
    getHealthyConnection = async (purpose) => {
        let connection = this.connections.get(purpose);
        
        // If no connection exists, create one
        if (!connection) {
            connection = await this.createConnection(purpose);
            return connection;
        }
        
        // If connection is healthy, return it
        if (this.isConnectionHealthy(connection)) {
            return connection;
        }
        
        // 🚀 ENHANCED: Connection is unhealthy, attempt reconnection
        console.log(`🔄 Connection ${purpose} is unhealthy, attempting reconnection...`);
        
        try {
            // Close unhealthy connection
            if (connection.status !== 'end') {
                await connection.disconnect();
            }
            
            // Remove from connections map
            this.connections.delete(purpose);
            
            // Create new connection
            connection = await this.createConnection(purpose);
            
            console.log(`✅ Successfully reconnected ${purpose}`);
            this.stats.reconnections++;
            
            return connection;
        } catch (error) {
            console.error(`❌ Failed to reconnect ${purpose}:`, error.message);
            throw error;
        }
    };

    /**
     * 🚀 NEW: Execute Redis operation with automatic retry and reconnection
     */
    executeWithResilience = async (purpose, operation, maxRetries = 3) => {
        let lastError;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const connection = await this.getHealthyConnection(purpose);
                
                // Execute the operation
                const result = await operation(connection);
                return result;
                
            } catch (error) {
                lastError = error;
                
                // Track EPIPE errors specifically
                if (error.code === 'EPIPE' || error.message.includes('EPIPE')) {
                    this.stats.epipeErrors++;
                    console.error(`🚨 EPIPE error on attempt ${attempt} for ${purpose}:`, error.message);
                }
                
                // If it's a connection error, try to reconnect
                if (error.code === 'EPIPE' || 
                    error.message.includes('Connection is closed') ||
                    error.message.includes('write EPIPE')) {
                    
                    console.log(`🔄 Connection error on attempt ${attempt}, will retry...`);
                    
                    // Remove the problematic connection
                    const connection = this.connections.get(purpose);
                    if (connection) {
                        try {
                            await connection.disconnect();
                        } catch (disconnectError) {
                            // Ignore disconnect errors
                        }
                        this.connections.delete(purpose);
                    }
                    
                    // Wait before retry
                    if (attempt < maxRetries) {
                        const delay = Math.min(attempt * 1000, 5000);
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                    
                    continue;
                }
                
                // For non-connection errors, don't retry
                throw error;
            }
        }
        
        // All retries failed
        throw new Error(`Operation failed after ${maxRetries} attempts. Last error: ${lastError.message}`);
    };

    /**
     * Initialize all predefined connections
     */
    initialize = async () => {
        if (this.isInitialized) {
            console.log('⚠️ Redis manager already initialized');
            return;
        }

        console.log('🔄 Initializing Unified Redis Manager...');
        console.log('Redis config:', {
            host: this.baseConfig.host,
            port: this.baseConfig.port,
            db: this.baseConfig.db,
            tls: this.baseConfig.tls ? 'enabled' : 'disabled',
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
    };

    /**
     * Create a Redis connection for a specific purpose
     * 🚀 ENHANCED: Added comprehensive error handling and reconnection logic
     */
    createConnection = async (purpose) => {
        if (this.connections.has(purpose)) {
            console.warn(`⚠️ Connection ${purpose} already exists`);
            return this.connections.get(purpose);
        }

        const connection = new Redis(this.baseConfig);
        
        // 🚀 ENHANCED: Track connection errors for health monitoring
        connection.lastError = null;
        connection.lastActivity = Date.now();
        
        // Add event handlers (matches your existing pattern)
        connection.on('connect', () => {
            console.log(`✅ Strike Game Redis client connected: ${purpose}`);
            connection.lastActivity = Date.now();
        });

        connection.on('ready', () => {
            console.log(`✅ Strike Game Redis client ready: ${purpose}`);
            this.stats.active++;
            connection.lastActivity = Date.now();
            
            if (this.stats.active > this.stats.peakConnections) {
                this.stats.peakConnections = this.stats.active;
            }
            
            // DISABLE offline queue after connection is ready (matches your existing pattern)
            connection.options.enableOfflineQueue = false;
        });

        connection.on('error', (error) => {
            console.error(`❌ Strike Game Redis client error (${purpose}):`, error.message);
            this.stats.errors++;
            connection.lastError = Date.now();
            
            // 🚀 ENHANCED: Handle specific error types
            if (error.code === 'EPIPE') {
                console.error(`🚨 EPIPE error detected for ${purpose} - connection will be recreated`);
                this.stats.epipeErrors++;
            }
            
            // Critical: Don't create new connections on error
            if (error.message.includes('max number of clients')) {
                console.error(`🚨 Redis connection limit reached for ${purpose}!`);
            }
        });

        connection.on('close', () => {
            console.log(`🔌 Strike Game Redis client connection closed: ${purpose}`);
            this.stats.active--;
            connection.lastActivity = Date.now();
        });

        connection.on('reconnecting', () => {
            console.log(`🔄 Strike Game Redis client reconnecting: ${purpose}`);
            connection.lastActivity = Date.now();
        });

        // 🚀 NEW: Handle end event
        connection.on('end', () => {
            console.log(`🔚 Strike Game Redis client connection ended: ${purpose}`);
            connection.lastActivity = Date.now();
        });

        // Wait for connection to be ready (matches your existing pattern)
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error(`Connection ${purpose} not ready after 30 seconds`));
            }, 30000);
            
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
    };

    /**
     * Get connection by purpose - ONLY predefined purposes allowed
     * 🚀 ENHANCED: Added health check and automatic reconnection
     */
    getConnection = async (purpose = 'main') => {
        if (!this.connectionPurposes.includes(purpose)) {
            console.error(`❌ Invalid connection purpose: ${purpose}`);
            console.error(`📋 Valid purposes: ${this.connectionPurposes.join(', ')}`);
            throw new Error(`Invalid connection purpose: ${purpose}`);
        }

        // If not initialized, try to initialize automatically
        if (!this.isInitialized) {
            console.log('🔄 Redis manager not initialized, attempting auto-initialization...');
            await this.initialize();
        }

        // 🚀 ENHANCED: Use health check and automatic reconnection
        return await this.getHealthyConnection(purpose);
    };

    /**
     * Synchronous connection accessor for modules that cannot await (e.g., queue singletons)
     * Returns null if manager is not initialized or connection missing
     * 🚀 ENHANCED: Added health check
     */
    getConnectionSync(purpose = 'main') {
        if (!this.connectionPurposes.includes(purpose)) {
            console.error(`❌ Invalid connection purpose: ${purpose}`);
            return null;
        }
        if (!this.isInitialized) {
            return null;
        }
        const connection = this.connections.get(purpose);
        if (!connection || !this.isConnectionHealthy(connection)) {
            return null;
        }
        return connection;
    }

    /**
     * Get helper methods for common operations (100% backward compatible with redis.js)
     * 🚀 ENHANCED: Added automatic retry and reconnection for all operations
     */
    getHelper = async () => {
        const mainConnection = await this.getConnection('main');
        
        return {
            async set(key, value, option = null, ttl = null, nx = null) {
                try {
                    return await unifiedRedisManager.executeWithResilience('main', async (connection) => {
                        const stringValue = typeof value === 'object' ? JSON.stringify(value) : value;
                        
                        if (option === 'EX' && nx === 'NX') {
                            const ttlSeconds = Math.floor(Number(ttl));
                            if (isNaN(ttlSeconds) || ttlSeconds <= 0) {
                                throw new Error('Invalid TTL value. Must be a positive number.');
                            }
                            const result = await connection.set(key, stringValue, 'EX', ttlSeconds, 'NX');
                            return result === 'OK';
                        } else if (ttl) {
                            const ttlSeconds = Math.floor(Number(ttl));
                            if (isNaN(ttlSeconds) || ttlSeconds <= 0) {
                                throw new Error('Invalid TTL value. Must be a positive number.');
                            }
                            await connection.setex(key, ttlSeconds, stringValue);
                            return true;
                        } else {
                            await connection.set(key, stringValue);
                            return true;
                        }
                    });
                } catch (error) {
                    console.error('Redis set error:', error);
                    throw error;
                }
            },

            async get(key) {
                try {
                    return await unifiedRedisManager.executeWithResilience('main', async (connection) => {
                        const value = await connection.get(key);
                        if (!value) return null;
                        try {
                            return JSON.parse(value);
                        } catch {
                            return value;
                        }
                    });
                } catch (error) {
                    console.error('Redis get error:', error);
                    throw error;
                }
            },

            async del(key) {
                try {
                    return await unifiedRedisManager.executeWithResilience('main', async (connection) => {
                        await connection.del(key);
                    });
                } catch (error) {
                    console.error('Redis del error:', error);
                    throw error;
                }
            },

            async exists(key) {
                try {
                    return await unifiedRedisManager.executeWithResilience('main', async (connection) => {
                        const result = await connection.exists(key);
                        return result === 1;
                    });
                } catch (error) {
                    console.error('Redis exists error:', error);
                    throw error;
                }
            },

            async expire(key, ttl) {
                try {
                    return await unifiedRedisManager.executeWithResilience('main', async (connection) => {
                        await connection.expire(key, ttl);
                    });
                } catch (error) {
                    console.error('Redis expire error:', error);
                    throw error;
                }
            },

            async incr(key, increment = 1) {
                try {
                    return await unifiedRedisManager.executeWithResilience('main', async (connection) => {
                        return await connection.incrby(key, increment);
                    });
                } catch (error) {
                    console.error('Redis incr error:', error);
                    throw error;
                }
            },

            async decr(key, decrement = 1) {
                try {
                    return await unifiedRedisManager.executeWithResilience('main', async (connection) => {
                        return await connection.decrby(key, decrement);
                    });
                } catch (error) {
                    console.error('Redis decr error:', error);
                    throw error;
                }
            },

            // Backward compatibility method for setex
            async setex(key, ttl, value) {
                try {
                    return await unifiedRedisManager.executeWithResilience('main', async (connection) => {
                        const stringValue = typeof value === 'object' ? JSON.stringify(value) : value;
                        const ttlSeconds = Math.floor(Number(ttl));
                        if (isNaN(ttlSeconds) || ttlSeconds <= 0) {
                            throw new Error('Invalid TTL value. Must be a positive number.');
                        }
                        await connection.setex(key, ttlSeconds, stringValue);
                        return true;
                    });
                } catch (error) {
                    console.error('Redis setex error:', error);
                    throw error;
                }
            },

            async hset(key, field, value) {
                try {
                    return await unifiedRedisManager.executeWithResilience('main', async (connection) => {
                        const stringValue = typeof value === 'object' ? JSON.stringify(value) : value;
                        return await connection.hset(key, field, stringValue);
                    });
                } catch (error) {
                    console.error('Redis hset error:', error);
                    throw error;
                }
            },

            async hget(key, field) {
                try {
                    return await unifiedRedisManager.executeWithResilience('main', async (connection) => {
                        const value = await connection.hget(key, field);
                        if (!value) return null;
                        try {
                            return JSON.parse(value);
                        } catch {
                            return value;
                        }
                    });
                } catch (error) {
                    console.error('Redis hget error:', error);
                    throw error;
                }
            },

            async hgetall(key) {
                try {
                    return await unifiedRedisManager.executeWithResilience('main', async (connection) => {
                        return await connection.hgetall(key);
                    });
                } catch (error) {
                    console.error('Redis hgetall error:', error);
                    throw error;
                }
            },

            async hincrby(key, field, increment = 1) {
                try {
                    return await unifiedRedisManager.executeWithResilience('main', async (connection) => {
                        return await connection.hincrby(key, field, increment);
                    });
                } catch (error) {
                    console.error('Redis hincrby error:', error);
                    throw error;
                }
            },

            // Set operations (for 5D protection service)
            async sadd(key, ...members) {
                try {
                    return await unifiedRedisManager.executeWithResilience('main', async (connection) => {
                        return await connection.sadd(key, ...members);
                    });
                } catch (error) {
                    console.error('Redis sadd error:', error);
                    throw error;
                }
            },

            async srem(key, ...members) {
                try {
                    return await unifiedRedisManager.executeWithResilience('main', async (connection) => {
                        return await connection.srem(key, ...members);
                    });
                } catch (error) {
                    console.error('Redis srem error:', error);
                    throw error;
                }
            },

            async smembers(key) {
                try {
                    return await unifiedRedisManager.executeWithResilience('main', async (connection) => {
                        return await connection.smembers(key);
                    });
                } catch (error) {
                    console.error('Redis smembers error:', error);
                    throw error;
                }
            },

            async scard(key) {
                try {
                    return await unifiedRedisManager.executeWithResilience('main', async (connection) => {
                        return await connection.scard(key);
                    });
                } catch (error) {
                    console.error('Redis scard error:', error);
                    throw error;
                }
            },

            async hlen(key) {
                try {
                    return await unifiedRedisManager.executeWithResilience('main', async (connection) => {
                        return await connection.hlen(key);
                    });
                } catch (error) {
                    console.error('Redis hlen error:', error);
                    throw error;
                }
            },

            async hkeys(key) {
                try {
                    return await unifiedRedisManager.executeWithResilience('main', async (connection) => {
                        return await connection.hkeys(key);
                    });
                } catch (error) {
                    console.error('Redis hkeys error:', error);
                    throw error;
                }
            },

            async keys(pattern) {
                try {
                    return await unifiedRedisManager.executeWithResilience('main', async (connection) => {
                        return await connection.keys(pattern);
                    });
                } catch (error) {
                    console.error('Redis keys error:', error);
                    throw error;
                }
            },

            async type(key) {
                try {
                    return await unifiedRedisManager.executeWithResilience('main', async (connection) => {
                        return await connection.type(key);
                    });
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
                    return await unifiedRedisManager.executeWithResilience('main', async (connection) => {
                        return await connection.ping();
                    });
                } catch (error) {
                    console.error('Redis ping error:', error);
                    throw error;
                }
            }
        };
    }

    /**
     * Health check all connections
     * 🚀 ENHANCED: Added connection health validation
     */
    healthCheck = async () => {
        console.log('🔍 Redis health check...');
        
        const results = [];
        for (const [purpose, connection] of this.connections) {
            try {
                const start = Date.now();
                
                // 🚀 ENHANCED: Check connection health before ping
                if (!this.isConnectionHealthy(connection)) {
                    results.push({
                        purpose,
                        status: 'unhealthy',
                        error: 'Connection not healthy',
                        lastError: connection.lastError ? new Date(connection.lastError).toISOString() : 'N/A',
                        lastActivity: connection.lastActivity ? new Date(connection.lastActivity).toISOString() : 'N/A'
                    });
                    continue;
                }
                
                await connection.ping();
                const latency = Date.now() - start;
                
                results.push({
                    purpose,
                    status: 'healthy',
                    latency: `${latency}ms`,
                    lastActivity: connection.lastActivity ? new Date(connection.lastActivity).toISOString() : 'N/A'
                });
            } catch (error) {
                results.push({
                    purpose,
                    status: 'unhealthy',
                    error: error.message,
                    lastError: connection.lastError ? new Date(connection.lastError).toISOString() : 'N/A',
                    lastActivity: connection.lastActivity ? new Date(connection.lastActivity).toISOString() : 'N/A'
                });
            }
        }
        
        console.log('📊 Redis Health Results:', results);
        return results;
    };

    /**
     * Start connection monitoring
     * 🚀 ENHANCED: Added EPIPE error tracking and connection health monitoring
     */
    startMonitoring = () => {
        setInterval(async () => {
            try {
                const mainConnection = await this.getConnection('main');
                const info = await mainConnection.info('clients');
                const connectedClients = info.match(/connected_clients:(\d+)/)?.[1] || '0';
                
                console.log(`📊 Redis Monitor - Server: ${connectedClients} clients, Manager: ${this.stats.active} active`);
                
                // Alert on high connections
                if (parseInt(connectedClients) > 100) {
                    console.warn(`🚨 HIGH Redis connections: ${connectedClients}`);
                }
                
                // 🚀 NEW: Alert on EPIPE errors
                if (this.stats.epipeErrors > 0) {
                    console.warn(`🚨 EPIPE errors detected: ${this.stats.epipeErrors}`);
                }
                
                // Log our stats
                console.log(`📈 Manager Stats:`, this.stats);
                
            } catch (error) {
                console.error('❌ Redis monitoring failed:', error.message);
            }
        }, 60000); // Every minute
    };

    /**
     * Get statistics
     * 🚀 ENHANCED: Added EPIPE error and reconnection stats
     */
    getStats = () => {
        return {
            ...this.stats,
            initialized: this.isInitialized,
            connectionCount: this.connections.size,
            purposes: Array.from(this.connections.keys()),
            // 🚀 NEW: Connection health status
            connectionHealth: Array.from(this.connections.entries()).map(([purpose, conn]) => ({
                purpose,
                status: conn.status,
                healthy: this.isConnectionHealthy(conn),
                lastError: conn.lastError ? new Date(conn.lastError).toISOString() : null,
                lastActivity: conn.lastActivity ? new Date(conn.lastActivity).toISOString() : null
            }))
        };
    };

    /**
     * Setup graceful shutdown
     */
    setupGracefulShutdown = () => {
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
    };

    /**
     * Manual cleanup (for testing/restart)
     */
    cleanup = async () => {
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
        this.stats = { created: 0, active: 0, errors: 0, peakConnections: 0, reconnections: 0, epipeErrors: 0 };
        
        console.log('✅ Redis cleanup completed');
    };
}

// Create and export singleton
const unifiedRedisManager = new UnifiedRedisManager();

module.exports = unifiedRedisManager; 