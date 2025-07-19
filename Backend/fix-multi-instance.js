#!/usr/bin/env node

/**
 * Multi-Instance Communication Fix
 * This script helps fix communication between scheduler and WebSocket instances
 */

const Redis = require('ioredis');
require('dotenv').config();

console.log('🔧 Multi-Instance Communication Fix');
console.log('===================================');

const redis = new Redis({
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
    keepAlive: 30000,
    noDelay: true,
    connectionName: 'multi_instance_fix'
});

const createTestPeriods = async () => {
    try {
        console.log('🎮 Creating test periods for multi-instance communication...');
        
        const gameConfigs = {
            'wingo': [30, 60, 180, 300],
            'trx_wix': [30, 60, 180, 300],
            'k3': [60, 180, 300, 600],
            'fiveD': [60, 180, 300, 600]
        };
        
        for (const [gameType, durations] of Object.entries(gameConfigs)) {
            for (const duration of durations) {
                // Generate test period ID
                const now = new Date();
                const dateStr = now.getFullYear().toString() + 
                               (now.getMonth() + 1).toString().padStart(2, '0') + 
                               now.getDate().toString().padStart(2, '0');
                const sequence = Math.floor(Math.random() * 1000).toString().padStart(9, '0');
                const periodId = dateStr + sequence;
                
                // Calculate times
                const startTime = new Date();
                const endTime = new Date(startTime.getTime() + duration * 1000);
                
                const periodData = {
                    periodId,
                    gameType,
                    duration,
                    startTime: startTime.toISOString(),
                    endTime: endTime.toISOString(),
                    timeRemaining: duration,
                    bettingOpen: true,
                    updatedAt: new Date().toISOString(),
                    source: 'multi_instance_fix'
                };
                
                // Store in Redis using the key pattern WebSocket expects
                const redisKey = `game_scheduler:${gameType}:${duration}:current`;
                await redis.setex(redisKey, 3600, JSON.stringify(periodData));
                
                console.log(`✅ Created test period: ${gameType}_${duration} -> ${periodId}`);
            }
        }
        
        console.log('✅ All test periods created successfully');
        
    } catch (error) {
        console.error('❌ Error creating test periods:', error);
    }
};

const testCommunication = async () => {
    try {
        console.log('\n🧪 Testing Redis pub/sub communication...');
        
        // Test publisher
        const testData = {
            action: 'test',
            timestamp: new Date().toISOString(),
            source: 'multi_instance_test'
        };
        
        const subscribers = await redis.publish('scheduler:period_request', JSON.stringify(testData));
        console.log(`✅ Published test message: ${subscribers} subscribers`);
        
        // Test subscriber
        const subscriber = redis.duplicate();
        await subscriber.subscribe('test:multi_instance');
        
        const testPromise = new Promise((resolve) => {
            subscriber.on('message', (channel, message) => {
                console.log(`✅ Received test message: ${message}`);
                resolve(true);
            });
            
            setTimeout(() => {
                redis.publish('test:multi_instance', 'test_message');
            }, 1000);
            
            setTimeout(() => resolve(false), 5000);
        });
        
        const received = await testPromise;
        await subscriber.unsubscribe('test:multi_instance');
        await subscriber.quit();
        
        if (received) {
            console.log('✅ Redis pub/sub communication working');
            return true;
        } else {
            console.log('❌ Redis pub/sub communication failed');
            return false;
        }
        
    } catch (error) {
        console.error('❌ Communication test failed:', error);
        return false;
    }
};

const main = async () => {
    try {
        // Wait for Redis connection
        await new Promise((resolve, reject) => {
            if (redis.status === 'ready') {
                resolve();
                return;
            }
            
            redis.once('ready', resolve);
            redis.once('error', reject);
            
            setTimeout(() => reject(new Error('Connection timeout')), 15000);
        });
        
        console.log('✅ Connected to Redis');
        
        // Create test periods
        await createTestPeriods();
        
        // Test communication
        const communicationWorking = await testCommunication();
        
        console.log('\n💡 Multi-Instance Setup Instructions:');
        console.log('=====================================');
        console.log('1. Scheduler Instance (Server 1):');
        console.log('   - Run: node start-scheduler.js');
        console.log('   - This creates periods and publishes events');
        console.log('');
        console.log('2. WebSocket Instance (Server 2):');
        console.log('   - Run: node index.js');
        console.log('   - This receives events and broadcasts to clients');
        console.log('');
        console.log('3. Both instances must connect to the same Redis');
        console.log('4. Redis pub/sub enables communication between instances');
        console.log('');
        
        if (communicationWorking) {
            console.log('✅ Multi-instance communication is working');
            console.log('🎯 You can now start your instances');
        } else {
            console.log('⚠️ Communication issues detected');
            console.log('🔧 Check Redis configuration and network connectivity');
        }
        
    } catch (error) {
        console.error('❌ Script failed:', error);
    } finally {
        await redis.quit();
    }
};

main(); 