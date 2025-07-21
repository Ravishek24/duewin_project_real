let redisHelper = null;
function setRedisHelper(helper) { redisHelper = helper; }


#!/usr/bin/env node

/**
 * Redis Connection Cleanup Script
 * This script helps clear Redis connections and restart the application properly
 */


require('dotenv').config();

console.log('🧹 Redis Connection Cleanup Script');
console.log('==================================');

// Create a temporary Redis client to clear connections
const tempRedis = 

const cleanupRedisConnections = async () => {
    try {
        console.log('🔄 Connecting to Redis for cleanup...');
        
        // Wait for connection
        await new Promise((resolve, reject) => {
            if (tempRedis.status === 'ready') {
                resolve();
                return;
            }
            
            tempRedis.once('ready', resolve);
            tempRedis.once('error', reject);
            
            setTimeout(() => reject(new Error('Connection timeout')), 10000);
        });
        
        console.log('✅ Connected to Redis');
        
        // Get client list
        console.log('📋 Getting client list...');
        const clientList = await tempRedis.client('LIST');
        console.log('📊 Current Redis clients:', clientList);
        
        // Count connections
        const connectionCount = clientList.split('\n').filter(line => line.trim()).length;
        console.log(`🔢 Total Redis connections: ${connectionCount}`);
        
        if (connectionCount > 10) {
            console.log('⚠️  High number of connections detected!');
            
            // Kill all connections except current one
            console.log('🧹 Clearing old connections...');
            const clients = clientList.split('\n').filter(line => line.trim());
            
            for (const client of clients) {
                const parts = client.split(' ');
                if (parts.length >= 2) {
                    const clientId = parts[0];
                    const addr = parts[1];
                    
                    // Don't kill our own connection
                    if (addr !== tempRedis.options.host + ':' + tempRedis.options.port) {
                        try {
                            await tempRedis.client('KILL', 'ADDR', addr);
                            console.log(`✅ Killed connection: ${addr}`);
                        } catch (err) {
                            console.log(`⚠️  Could not kill connection ${addr}: ${err.message}`);
                        }
                    }
                }
            }
            
            console.log('✅ Connection cleanup completed');
        } else {
            console.log('✅ Connection count is normal');
        }
        
        // Test Redis functionality
        console.log('🧪 Testing Redis functionality...');
        await tempRedis.set('cleanup_test', 'working', 'EX', 60);
        const testValue = await tempRedis.get('cleanup_test');
        await tempRedis.del('cleanup_test');
        
        if (testValue === 'working') {
            console.log('✅ Redis functionality test passed');
        } else {
            console.log('❌ Redis functionality test failed');
        }
        
    } catch (error) {
        console.error('❌ Cleanup failed:', error.message);
    } finally {
        // Close temporary connection
        await tempRedis.quit();
        console.log('🔌 Temporary Redis connection closed');
    }
};

const showRedisInfo = async () => {
    try {
        console.log('\n📊 Redis Server Information');
        console.log('==========================');
        
        const info = await tempRedis.info();
        const lines = info.split('\n');
        
        // Extract key information
        const serverInfo = {};
        lines.forEach(line => {
            if (line.includes('redis_version:') || 
                line.includes('connected_clients:') || 
                line.includes('used_memory_human:') ||
                line.includes('uptime_in_seconds:')) {
                const [key, value] = line.split(':');
                serverInfo[key] = value;
            }
        });
        
        console.log('Redis Version:', serverInfo.redis_version);
        console.log('Connected Clients:', serverInfo.connected_clients);
        console.log('Used Memory:', serverInfo.used_memory_human);
        console.log('Uptime:', Math.floor(serverInfo.uptime_in_seconds / 3600), 'hours');
        
    } catch (error) {
        console.error('❌ Could not get Redis info:', error.message);
    }
};

const main = async () => {
    try {
        await cleanupRedisConnections();
        await showRedisInfo();
        
        console.log('\n🎯 Next Steps:');
        console.log('1. Stop your application (Ctrl+C)');
        console.log('2. Wait 5-10 seconds');
        console.log('3. Restart your application');
        console.log('4. Monitor logs for Redis connection messages');
        
    } catch (error) {
        console.error('❌ Script failed:', error.message);
        process.exit(1);
    }
};

// Run the script
main(); 
module.exports = { setRedisHelper };
