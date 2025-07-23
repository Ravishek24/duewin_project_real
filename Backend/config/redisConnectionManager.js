let redisHelper = null;
function setRedisHelper(helper) { redisHelper = helper; }

require('dotenv').config();



/**
 * Redis Connection Manager - Non-disruptive implementation
 * Works alongside existing Redis configurations
 */
class RedisConnectionManager {
    constructor() {
        this.connections = new Map();
        this.connectionCounts = new Map();
        this.maxRetries = 3;
        this.isShuttingDown = false;
        
        // Track connection usage
        this.stats = {
            totalConnections: 0,
            activeConnections: 0,
            peakConnections: 0
        };
        
        // Setup graceful shutdown
        this.setupGracefulShutdown();
        
        // Start monitoring
        this.startMonitoring();
    }

    /**
     * Get or create a Redis connection for a specific purpose
     * @param {string} purpose - Purpose of the connection (e.g., 'main', 'publisher', 'subscriber')
     * @param {Object} options - Connection options
     * @returns {Redis} Redis connection instance
     */
    getConnection(purpose = 'default', options = {}) {
        const connectionKey = `${purpose}_${JSON.stringify(options)}`;
        
        if (!this.connections.has(connectionKey)) {
            const connection = this.createConnection(purpose, options);
            this.connections.set(connectionKey, connection);
            this.connectionCounts.set(connectionKey, 0);
            this.stats.totalConnections++;
            
            console.log(`🔌 Created Redis connection: ${purpose} (Total: ${this.stats.totalConnections})`);
        }
        
        this.connectionCounts.set(connectionKey, this.connectionCounts.get(connectionKey) + 1);
        this.stats.activeConnections++;
        
        if (this.stats.activeConnections > this.stats.peakConnections) {
            this.stats.peakConnections = this.stats.activeConnections;
        }
        
        return this.connections.get(connectionKey);
    }

    /**
     * Create a new Redis connection with optimized settings
     */
    createConnection(purpose, options = {}) {
        const config = {
            host: process.env.REDIS_HOST,
            port: process.env.REDIS_PORT || 6379,
            password: process.env.REDIS_PASSWORD || null,
            db: process.env.REDIS_DB || 0,
            
            // Connection pooling settings
            family: 4,
            keepAlive: 30000,
            maxRetriesPerRequest: 3,
            enableOfflineQueue: false,
            lazyConnect: true,
            
            // Connection limits
            connectTimeout: 10000,
            commandTimeout: 5000,
            
            // Pool settings
            maxMemoryPolicy: 'noeviction',
            
            // TLS settings
            tls: process.env.REDIS_TLS === 'true' ? {
                rejectUnauthorized: false,
                requestCert: true,
                agent: false
            } : undefined,
            
            // Custom options
            ...options
        };

        const connection = 

        // Add connection event handlers
        connection.on('connect', () => {
            console.log(`✅ Redis connected: ${purpose}`);
        });

        connection.on('ready', () => {
            console.log(`🚀 Redis ready: ${purpose}`);
        });

        connection.on('error', (error) => {
            console.error(`❌ Redis error (${purpose}):`, error.message);
            
            // Don't create new connections on error
            if (error.message.includes('max number of clients')) {
                console.error('🚨 Redis connection limit reached! Reusing existing connections.');
            }
        });

        connection.on('close', () => {
            console.log(`🔌 Redis closed: ${purpose}`);
        });

        connection.on('reconnecting', () => {
            console.log(`🔄 Redis reconnecting: ${purpose}`);
        });

        return connection;
    }

    /**
     * Get connection statistics
     */
    getStats() {
        return {
            ...this.stats,
            connections: Object.fromEntries(this.connectionCounts),
            connectionTypes: Array.from(this.connections.keys())
        };
    }

    /**
     * Health check for all connections
     */
    async healthCheck() {
        const results = [];
        
        for (const [key, connection] of this.connections) {
            try {
                const start = Date.now();
                await connection.ping();
                const latency = Date.now() - start;
                
                results.push({
                    connection: key,
                    status: 'healthy',
                    latency: `${latency}ms`
                });
            } catch (error) {
                results.push({
                    connection: key,
                    status: 'unhealthy',
                    error: error.message
                });
            }
        }
        
        return results;
    }

    /**
     * Start connection monitoring
     */
    startMonitoring() {
        setInterval(async () => {
            try {
                // Get Redis server info
                const mainConnection = this.getConnection('monitoring');
                const info = await mainConnection.info('clients');
                const connectedClients = info.match(/connected_clients:(\d+)/)?.[1] || '0';
                
                console.log(`📊 Redis Stats - Server: ${connectedClients} clients, Manager: ${this.stats.activeConnections} active`);
                
                // Warn if too many connections
                if (parseInt(connectedClients) > 50) {
                    console.warn(`⚠️ High Redis connections: ${connectedClients}`);
                }
                
                // Log our connection stats
                if (this.stats.activeConnections > 10) {
                    console.log(`📈 Connection Manager Stats:`, this.getStats());
                }
                
            } catch (error) {
                console.error('❌ Redis monitoring failed:', error.message);
            }
        }, 30000); // Every 30 seconds
    }

    /**
     * Setup graceful shutdown
     */
    setupGracefulShutdown() {
        const cleanup = async (signal) => {
            if (this.isShuttingDown) return;
            
            this.isShuttingDown = true;
            console.log(`🛑 Received ${signal}, shutting down Redis connections gracefully...`);
            
            const promises = [];
            for (const [key, connection] of this.connections) {
                console.log(`🔌 Closing connection: ${key}`);
                promises.push(connection.quit());
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
     * Cleanup all connections (for testing)
     */
    async cleanup() {
        console.log('🧹 Cleaning up Redis connections...');
        
        for (const [key, connection] of this.connections) {
            try {
                await connection.quit();
                console.log(`✅ Closed connection: ${key}`);
            } catch (error) {
                console.error(`❌ Error closing ${key}:`, error.message);
            }
        }
        
        this.connections.clear();
        this.connectionCounts.clear();
        this.stats.activeConnections = 0;
        
        console.log('✅ Redis connection cleanup completed');
    }
}

// Create singleton instance
const redisManager = new RedisConnectionManager();

module.exports = redisManager; 
module.exports.setRedisHelper = setRedisHelper;
