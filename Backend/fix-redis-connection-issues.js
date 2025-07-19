#!/usr/bin/env node

/**
 * Redis Connection Issues Fix Script
 * This script helps diagnose and fix Redis connection problems
 */

const Redis = require('ioredis');
require('dotenv').config();

console.log('🔧 Redis Connection Issues Fix Script');
console.log('=====================================');

// Configuration
const redisConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || '',
    db: process.env.REDIS_DB || 0,
    
    tls: {
        rejectUnauthorized: false,
        requestCert: true,
        agent: false
    },
    
    connectTimeout: 15000,
    commandTimeout: 5000,
    lazyConnect: false,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    retryDelayOnFailover: 100,
    enableReadyCheck: true,
    maxLoadingTimeout: 10000,
    keepAlive: 30000,
    noDelay: true,
    connectionName: 'fix-script'
};

let tempRedis = null;

const createTestConnection = () => {
    if (!tempRedis) {
        console.log('🔄 Creating test Redis connection...');
        tempRedis = new Redis(redisConfig);
        
        tempRedis.on('connect', () => {
            console.log('✅ Test Redis client connected');
        });

        tempRedis.on('ready', () => {
            console.log('✅ Test Redis client ready');
        });

        tempRedis.on('error', (err) => {
            console.error('❌ Test Redis client error:', err.message);
        });

        tempRedis.on('reconnecting', (ms) => {
            console.log(`🔄 Test Redis client reconnecting in ${ms}ms...`);
        });

        tempRedis.on('end', () => {
            console.log('🔌 Test Redis client connection ended');
        });

        tempRedis.on('close', () => {
            console.log('🔌 Test Redis client connection closed');
        });
    }
    return tempRedis;
};

const diagnoseConnectionIssues = async () => {
    console.log('\n🔍 Diagnosing Redis Connection Issues');
    console.log('=====================================');
    
    try {
        const redis = createTestConnection();
        
        // Wait for connection
        await new Promise((resolve, reject) => {
            if (redis.status === 'ready') {
                resolve();
                return;
            }
            
            redis.once('ready', resolve);
            redis.once('error', reject);
            
            setTimeout(() => reject(new Error('Connection timeout')), 15000);
        });
        
        console.log('✅ Successfully connected to Redis');
        
        // Test basic operations
        console.log('🧪 Testing basic Redis operations...');
        
        // Test PING
        const pingResult = await redis.ping();
        console.log('✅ PING test:', pingResult);
        
        // Test SET/GET
        await redis.set('diagnostic_test', 'working', 'EX', 60);
        const getResult = await redis.get('diagnostic_test');
        await redis.del('diagnostic_test');
        console.log('✅ SET/GET test:', getResult === 'working' ? 'PASSED' : 'FAILED');
        
        // Test database selection
        await redis.select(2);
        console.log('✅ Database selection test: PASSED');
        
        // Get client info
        const clientInfo = await redis.client('INFO');
        console.log('✅ Client info retrieved');
        
        // Get server info
        const serverInfo = await redis.info();
        const infoLines = serverInfo.split('\n');
        
        // Extract key metrics
        const metrics = {};
        infoLines.forEach(line => {
            if (line.includes('connected_clients:') || 
                line.includes('maxclients:') ||
                line.includes('used_memory_human:') ||
                line.includes('redis_version:')) {
                const [key, value] = line.split(':');
                metrics[key] = value;
            }
        });
        
        console.log('\n📊 Redis Server Metrics:');
        console.log('Connected Clients:', metrics.connected_clients);
        console.log('Max Clients:', metrics.maxclients);
        console.log('Used Memory:', metrics.used_memory_human);
        console.log('Redis Version:', metrics.redis_version);
        
        // Check if we're near the connection limit
        const currentClients = parseInt(metrics.connected_clients) || 0;
        const maxClients = parseInt(metrics.maxclients) || 10000;
        const usagePercent = (currentClients / maxClients) * 100;
        
        console.log(`Connection Usage: ${currentClients}/${maxClients} (${usagePercent.toFixed(1)}%)`);
        
        if (usagePercent > 80) {
            console.log('⚠️  WARNING: High connection usage detected!');
            return { status: 'warning', message: 'High connection usage' };
        } else if (usagePercent > 50) {
            console.log('⚠️  CAUTION: Moderate connection usage');
            return { status: 'caution', message: 'Moderate connection usage' };
        } else {
            console.log('✅ Connection usage is normal');
            return { status: 'normal', message: 'Normal connection usage' };
        }
        
    } catch (error) {
        console.error('❌ Connection diagnosis failed:', error.message);
        return { status: 'error', message: error.message };
    }
};

const clearStaleConnections = async () => {
    console.log('\n🧹 Clearing Stale Redis Connections');
    console.log('===================================');
    
    try {
        const redis = createTestConnection();
        
        // Wait for connection
        await new Promise((resolve, reject) => {
            if (redis.status === 'ready') {
                resolve();
                return;
            }
            
            redis.once('ready', resolve);
            redis.once('error', reject);
            
            setTimeout(() => reject(new Error('Connection timeout')), 15000);
        });
        
        // Get client list
        const clientList = await redis.client('LIST');
        const clients = clientList.split('\n').filter(line => line.trim());
        
        console.log(`📋 Found ${clients.length} total connections`);
        
        let killedCount = 0;
        const currentTime = Date.now();
        
        for (const client of clients) {
            const parts = client.split(' ');
            if (parts.length >= 4) {
                const clientId = parts[0];
                const addr = parts[1];
                const idle = parseInt(parts[4]) || 0;
                
                // Kill connections that are idle for more than 5 minutes
                if (idle > 300) {
                    try {
                        await redis.client('KILL', 'ID', clientId);
                        console.log(`✅ Killed idle connection ${clientId} (${addr}) - idle: ${idle}s`);
                        killedCount++;
                    } catch (err) {
                        console.log(`⚠️  Could not kill connection ${clientId}: ${err.message}`);
                    }
                }
            }
        }
        
        console.log(`✅ Killed ${killedCount} stale connections`);
        return killedCount;
        
    } catch (error) {
        console.error('❌ Failed to clear stale connections:', error.message);
        return 0;
    }
};

const testConnectionPooling = async () => {
    console.log('\n🧪 Testing Connection Pooling');
    console.log('=============================');
    
    try {
        const connections = [];
        const maxTestConnections = 5;
        
        console.log(`Creating ${maxTestConnections} test connections...`);
        
        for (let i = 0; i < maxTestConnections; i++) {
            const redis = new Redis({
                ...redisConfig,
                connectionName: `test-connection-${i}`
            });
            
            await new Promise((resolve, reject) => {
                redis.once('ready', resolve);
                redis.once('error', reject);
                setTimeout(() => reject(new Error('Connection timeout')), 10000);
            });
            
            connections.push(redis);
            console.log(`✅ Created connection ${i + 1}/${maxTestConnections}`);
        }
        
        console.log('✅ All test connections created successfully');
        
        // Test operations on all connections
        for (let i = 0; i < connections.length; i++) {
            const redis = connections[i];
            await redis.set(`pool_test_${i}`, `value_${i}`, 'EX', 60);
            const value = await redis.get(`pool_test_${i}`);
            await redis.del(`pool_test_${i}`);
            console.log(`✅ Connection ${i + 1} operations: ${value === `value_${i}` ? 'PASSED' : 'FAILED'}`);
        }
        
        // Close all test connections
        for (const redis of connections) {
            await redis.quit();
        }
        
        console.log('✅ All test connections closed');
        return true;
        
    } catch (error) {
        console.error('❌ Connection pooling test failed:', error.message);
        return false;
    }
};

const generateRecommendations = (diagnosisResult) => {
    console.log('\n💡 Recommendations');
    console.log('==================');
    
    if (diagnosisResult.status === 'error') {
        console.log('🔧 Immediate Actions:');
        console.log('1. Check Redis server is running');
        console.log('2. Verify network connectivity');
        console.log('3. Check firewall settings');
        console.log('4. Verify Redis credentials');
        console.log('5. Check TLS configuration');
    } else if (diagnosisResult.status === 'warning') {
        console.log('🔧 High Connection Usage Actions:');
        console.log('1. Implement connection pooling in your application');
        console.log('2. Review and optimize Redis client usage');
        console.log('3. Consider increasing Redis maxclients setting');
        console.log('4. Monitor for connection leaks');
        console.log('5. Implement proper connection cleanup');
    } else {
        console.log('✅ Current setup appears healthy');
        console.log('🔧 Preventive Actions:');
        console.log('1. Monitor connection usage regularly');
        console.log('2. Implement connection pooling');
        console.log('3. Add connection health checks');
        console.log('4. Set up alerts for high connection usage');
    }
    
    console.log('\n📋 Code Changes Made:');
    console.log('1. Updated config/redis.js with singleton pattern');
    console.log('2. Updated config/redisConfig.js with connection pooling');
    console.log('3. Added connection cleanup methods');
    console.log('4. Enhanced error handling and retry logic');
};

const main = async () => {
    try {
        console.log('🚀 Starting Redis connection diagnosis...');
        
        // Step 1: Diagnose current issues
        const diagnosis = await diagnoseConnectionIssues();
        
        // Step 2: Clear stale connections if needed
        if (diagnosis.status === 'warning' || diagnosis.status === 'error') {
            await clearStaleConnections();
        }
        
        // Step 3: Test connection pooling
        await testConnectionPooling();
        
        // Step 4: Generate recommendations
        generateRecommendations(diagnosis);
        
        console.log('\n🎯 Next Steps:');
        console.log('1. Restart your application with the updated Redis configuration');
        console.log('2. Monitor logs for Redis connection messages');
        console.log('3. Run this script periodically to check connection health');
        console.log('4. Consider implementing connection monitoring in your application');
        
    } catch (error) {
        console.error('❌ Script failed:', error.message);
        process.exit(1);
    } finally {
        // Cleanup
        if (tempRedis) {
            await tempRedis.quit();
            console.log('🔌 Test connection closed');
        }
    }
};

// Run the script
main(); 