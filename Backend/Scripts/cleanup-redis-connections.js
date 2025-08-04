/**
 * Redis Connection Cleanup Script
 * This script cleans up dead Redis connections that are causing server issues
 */

const Redis = require('ioredis');

// Redis configuration
const redisConfig = {
    host: process.env.REDIS_HOST?.trim(),
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || '',
    db: process.env.REDIS_DB || 0,
    tls: {
        rejectUnauthorized: false,
        requestCert: true,
        agent: false
    },
    family: 4,
    keepAlive: 30000,
    connectTimeout: 15000,
    commandTimeout: 30000,
    lazyConnect: false,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
    }
};

/**
 * Clean up dead Redis connections
 */
async function cleanupRedisConnections() {
    console.log('🧹 Starting Redis connection cleanup...');
    
    const redis = new Redis(redisConfig);
    
    try {
        // Wait for connection
        await redis.ping();
        console.log('✅ Connected to Redis');
        
        // Get client list
        const clientList = await redis.client('list');
        console.log(`📊 Found ${clientList.split('\n').length} total connections`);
        
        // Parse client list
        const clients = clientList.split('\n').filter(line => line.trim()).map(line => {
            const parts = line.split(' ');
            const client = {};
            parts.forEach(part => {
                const [key, value] = part.split('=');
                if (key && value) {
                    client[key] = value;
                }
            });
            return client;
        });
        
        // Find dead connections (idle for more than 1 hour)
        const deadConnections = clients.filter(client => {
            const idleTime = parseInt(client.idle || '0');
            const age = parseInt(client.age || '0');
            return idleTime > 3600 || age > 86400; // 1 hour idle or 24 hours old
        });
        
        console.log(`🔍 Found ${deadConnections.length} dead connections`);
        
        // Kill dead connections
        let killedCount = 0;
        for (const client of deadConnections) {
            try {
                await redis.client('kill', 'id', client.id);
                console.log(`✅ Killed dead connection: ${client.id} (idle: ${client.idle}s, age: ${client.age}s)`);
                killedCount++;
            } catch (error) {
                console.error(`❌ Failed to kill connection ${client.id}:`, error.message);
            }
        }
        
        console.log(`🎯 Successfully killed ${killedCount} dead connections`);
        
        // Get updated client count
        const updatedClientList = await redis.client('list');
        const updatedCount = updatedClientList.split('\n').filter(line => line.trim()).length;
        
        console.log(`📊 Updated connection count: ${updatedCount}`);
        
        // Show remaining connections
        const remainingClients = updatedClientList.split('\n').filter(line => line.trim()).map(line => {
            const parts = line.split(' ');
            const client = {};
            parts.forEach(part => {
                const [key, value] = part.split('=');
                if (key && value) {
                    client[key] = value;
                }
            });
            return client;
        });
        
        console.log('\n📋 Remaining connections:');
        remainingClients.forEach(client => {
            console.log(`  - ID: ${client.id}, IP: ${client.addr}, Age: ${client.age}s, Idle: ${client.idle}s, Cmd: ${client.cmd}`);
        });
        
    } catch (error) {
        console.error('❌ Error during cleanup:', error);
    } finally {
        await redis.quit();
        console.log('🔌 Redis connection closed');
    }
}

/**
 * Monitor Redis connections
 */
async function monitorRedisConnections() {
    console.log('📊 Starting Redis connection monitoring...');
    
    const redis = new Redis(redisConfig);
    
    try {
        await redis.ping();
        
        setInterval(async () => {
            try {
                const info = await redis.info('clients');
                const connectedClients = info.match(/connected_clients:(\d+)/)?.[1] || '0';
                const blockedClients = info.match(/blocked_clients:(\d+)/)?.[1] || '0';
                
                console.log(`📊 Redis Status - Connected: ${connectedClients}, Blocked: ${blockedClients}`);
                
                if (parseInt(connectedClients) > 50) {
                    console.warn(`🚨 HIGH Redis connections: ${connectedClients}`);
                }
                
            } catch (error) {
                console.error('❌ Monitoring error:', error.message);
            }
        }, 30000); // Every 30 seconds
        
    } catch (error) {
        console.error('❌ Error starting monitoring:', error);
    }
}

/**
 * Main function
 */
async function main() {
    const command = process.argv[2];
    
    switch (command) {
        case 'cleanup':
            await cleanupRedisConnections();
            break;
        case 'monitor':
            await monitorRedisConnections();
            break;
        default:
            console.log('Usage:');
            console.log('  node cleanup-redis-connections.js cleanup  - Clean up dead connections');
            console.log('  node cleanup-redis-connections.js monitor  - Monitor connections');
            break;
    }
}

// Run the script
if (require.main === module) {
    main().catch(console.error);
}

module.exports = {
    cleanupRedisConnections,
    monitorRedisConnections
}; 