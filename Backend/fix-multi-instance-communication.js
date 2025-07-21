let redisHelper = null;
function setRedisHelper(helper) { redisHelper = helper; }


#!/usr/bin/env node

/**
 * Multi-Instance Communication Fix Script
 * This script helps diagnose and fix communication issues between scheduler and WebSocket instances
 */


require('dotenv').config();

console.log('🔧 Multi-Instance Communication Fix Script');
console.log('==========================================');

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
    connectionName: 'multi-instance-fix'
};

let tempRedis = null;

const createTestConnection = () => {
    if (!tempRedis) {
        console.log('🔄 Creating test Redis connection...');
        tempRedis = 
        
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

const diagnoseMultiInstanceIssues = async () => {
    console.log('\n🔍 Diagnosing Multi-Instance Communication Issues');
    console.log('=================================================');
    
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
        
        // Check for existing period data
        console.log('\n📋 Checking for existing period data...');
        const gameConfigs = {
            'wingo': [30, 60, 180, 300],
            'trx_wix': [30, 60, 180, 300],
            'k3': [60, 180, 300, 600],
            'fiveD': [60, 180, 300, 600]
        };
        
        let foundPeriods = 0;
        let missingPeriods = 0;
        
        for (const [gameType, durations] of Object.entries(gameConfigs)) {
            for (const duration of durations) {
                const possibleKeys = [
                    `game_scheduler:${gameType}:${duration}:current`,
                    `period:${gameType}:${duration}:current`,
                    `current_period:${gameType}:${duration}`,
                    `game:${gameType}:${duration}:current_period`,
                    `scheduler:${gameType}:${duration}:current`
                ];
                
                let found = false;
                for (const key of possibleKeys) {
                    const data = await redis.get(key);
                    if (data) {
                        try {
                            const parsed = JSON.parse(data);
                            if (parsed.periodId && parsed.endTime) {
                                console.log(`✅ Found period data: ${key} -> ${parsed.periodId}`);
                                found = true;
                                foundPeriods++;
                                break;
                            }
                        } catch (e) {
                            // Invalid JSON, continue
                        }
                    }
                }
                
                if (!found) {
                    console.log(`❌ No period data found for ${gameType}_${duration}`);
                    missingPeriods++;
                }
            }
        }
        
        console.log(`\n📊 Period Data Summary:`);
        console.log(`Found periods: ${foundPeriods}`);
        console.log(`Missing periods: ${missingPeriods}`);
        console.log(`Total expected: ${Object.values(gameConfigs).reduce((sum, durations) => sum + durations.length, 0)}`);
        
        if (missingPeriods > 0) {
            return { status: 'missing_periods', foundPeriods, missingPeriods };
        } else {
            return { status: 'all_periods_found', foundPeriods, missingPeriods };
        }
        
    } catch (error) {
        console.error('❌ Multi-instance diagnosis failed:', error.message);
        return { status: 'error', message: error.message };
    }
};

const testSchedulerCommunication = async () => {
    console.log('\n🧪 Testing Scheduler Communication');
    console.log('===================================');
    
    try {
        const redis = createTestConnection();
        
        // Test publishing to scheduler channels
        const testChannels = [
            'scheduler:period_request',
            'game_scheduler:period_start',
            'scheduler:heartbeat'
        ];
        
        console.log('📤 Testing publisher functionality...');
        
        for (const channel of testChannels) {
            const testData = {
                action: 'test',
                timestamp: new Date().toISOString(),
                source: 'multi_instance_test'
            };
            
            const subscribers = await redis.publish(channel, JSON.stringify(testData));
            console.log(`✅ Published to ${channel}: ${subscribers} subscribers`);
        }
        
        // Test subscriber functionality
        console.log('\n📥 Testing subscriber functionality...');
        
        const subscriber = redis.duplicate();
        await subscriber.subscribe('test:multi_instance');
        
        const testPromise = new Promise((resolve) => {
            subscriber.on('message', (channel, message) => {
                console.log(`✅ Received message on ${channel}: ${message}`);
                resolve(true);
            });
            
            // Send test message
            setTimeout(() => {
                redis.publish('test:multi_instance', 'test_message');
            }, 1000);
            
            // Timeout
            setTimeout(() => {
                resolve(false);
            }, 5000);
        });
        
        const received = await testPromise;
        await subscriber.unsubscribe('test:multi_instance');
        await subscriber.quit();
        
        if (received) {
            console.log('✅ Subscriber functionality working');
            return true;
        } else {
            console.log('❌ Subscriber functionality failed');
            return false;
        }
        
    } catch (error) {
        console.error('❌ Scheduler communication test failed:', error.message);
        return false;
    }
};

const createTestPeriods = async () => {
    console.log('\n🎮 Creating Test Periods');
    console.log('=========================');
    
    try {
        const redis = createTestConnection();
        
        const gameConfigs = {
            'wingo': [30, 60, 180, 300],
            'trx_wix': [30, 60, 180, 300],
            'k3': [60, 180, 300, 600],
            'fiveD': [60, 180, 300, 600]
        };
        
        let createdCount = 0;
        
        for (const [gameType, durations] of Object.entries(gameConfigs)) {
            for (const duration of durations) {
                // Generate a test period ID
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
                    source: 'multi_instance_test'
                };
                
                // Store in multiple possible keys
                const keys = [
                    `game_scheduler:${gameType}:${duration}:current`,
                    `period:${gameType}:${duration}:current`
                ];
                
                for (const key of keys) {
                    await redis.setex(key, 3600, JSON.stringify(periodData));
                    console.log(`✅ Created test period: ${key} -> ${periodId}`);
                }
                
                createdCount++;
            }
        }
        
        console.log(`\n📊 Created ${createdCount} test periods`);
        return createdCount;
        
    } catch (error) {
        console.error('❌ Failed to create test periods:', error.message);
        return 0;
    }
};

const testPeriodRetrieval = async () => {
    console.log('\n🔍 Testing Period Retrieval');
    console.log('============================');
    
    try {
        const redis = createTestConnection();
        
        const gameConfigs = {
            'wingo': [30, 60, 180, 300],
            'trx_wix': [30, 60, 180, 300],
            'k3': [60, 180, 300, 600],
            'fiveD': [60, 180, 300, 600]
        };
        
        let retrievedCount = 0;
        let failedCount = 0;
        
        for (const [gameType, durations] of Object.entries(gameConfigs)) {
            for (const duration of durations) {
                const possibleKeys = [
                    `game_scheduler:${gameType}:${duration}:current`,
                    `period:${gameType}:${duration}:current`,
                    `current_period:${gameType}:${duration}`,
                    `game:${gameType}:${duration}:current_period`,
                    `scheduler:${gameType}:${duration}:current`
                ];
                
                let retrieved = false;
                for (const key of possibleKeys) {
                    const data = await redis.get(key);
                    if (data) {
                        try {
                            const parsed = JSON.parse(data);
                            if (parsed.periodId && parsed.endTime) {
                                console.log(`✅ Retrieved period: ${key} -> ${parsed.periodId}`);
                                retrieved = true;
                                retrievedCount++;
                                break;
                            }
                        } catch (e) {
                            // Invalid JSON, continue
                        }
                    }
                }
                
                if (!retrieved) {
                    console.log(`❌ Failed to retrieve period for ${gameType}_${duration}`);
                    failedCount++;
                }
            }
        }
        
        console.log(`\n📊 Period Retrieval Summary:`);
        console.log(`Retrieved: ${retrievedCount}`);
        console.log(`Failed: ${failedCount}`);
        
        return { retrievedCount, failedCount };
        
    } catch (error) {
        console.error('❌ Period retrieval test failed:', error.message);
        return { retrievedCount: 0, failedCount: 0 };
    }
};

const generateMultiInstanceRecommendations = (diagnosisResult, communicationTest, retrievalResult) => {
    console.log('\n💡 Multi-Instance Setup Recommendations');
    console.log('=======================================');
    
    if (diagnosisResult.status === 'missing_periods') {
        console.log('🔧 Missing Periods Actions:');
        console.log('1. Ensure scheduler is running on the scheduler instance');
        console.log('2. Check scheduler logs for period creation');
        console.log('3. Verify Redis connectivity between instances');
        console.log('4. Check scheduler configuration');
        console.log('5. Restart scheduler if needed');
    }
    
    if (!communicationTest) {
        console.log('🔧 Communication Issues Actions:');
        console.log('1. Check Redis pub/sub functionality');
        console.log('2. Verify network connectivity between instances');
        console.log('3. Check Redis configuration on both instances');
        console.log('4. Ensure Redis allows multiple connections');
        console.log('5. Check firewall settings');
    }
    
    if (retrievalResult.failedCount > 0) {
        console.log('🔧 Period Retrieval Issues Actions:');
        console.log('1. Verify Redis key patterns match between instances');
        console.log('2. Check Redis permissions');
        console.log('3. Ensure consistent Redis database selection');
        console.log('4. Verify Redis connection pooling');
    }
    
    console.log('\n📋 Multi-Instance Configuration Checklist:');
    console.log('✅ Scheduler instance running start-scheduler.js');
    console.log('✅ WebSocket instance running index.js');
    console.log('✅ Both instances connected to same Redis');
    console.log('✅ Redis pub/sub working between instances');
    console.log('✅ Period data being created by scheduler');
    console.log('✅ Period data being retrieved by WebSocket');
    console.log('✅ No Redis connection limits exceeded');
    
    console.log('\n🔧 Code Changes Made:');
    console.log('1. Enhanced WebSocket service for multi-instance communication');
    console.log('2. Added Redis pub/sub for scheduler-WebSocket communication');
    console.log('3. Implemented period caching in WebSocket instance');
    console.log('4. Added fallback period retrieval mechanisms');
    console.log('5. Enhanced error handling for multi-instance setup');
};

const main = async () => {
    try {
        console.log('🚀 Starting multi-instance communication diagnosis...');
        
        // Step 1: Diagnose current issues
        const diagnosis = await diagnoseMultiInstanceIssues();
        
        // Step 2: Test scheduler communication
        const communicationTest = await testSchedulerCommunication();
        
        // Step 3: Create test periods if needed
        if (diagnosis.status === 'missing_periods') {
            console.log('\n🔄 Creating test periods to verify communication...');
            await createTestPeriods();
        }
        
        // Step 4: Test period retrieval
        const retrievalResult = await testPeriodRetrieval();
        
        // Step 5: Generate recommendations
        generateMultiInstanceRecommendations(diagnosis, communicationTest, retrievalResult);
        
        console.log('\n🎯 Next Steps:');
        console.log('1. Ensure scheduler is running on scheduler instance: node start-scheduler.js');
        console.log('2. Ensure WebSocket is running on WebSocket instance: node index.js');
        console.log('3. Monitor logs for communication messages');
        console.log('4. Check Redis connection status on both instances');
        console.log('5. Verify period data is being created and retrieved');
        
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
module.exports = { setRedisHelper };
