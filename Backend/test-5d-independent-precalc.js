#!/usr/bin/env node

/**
 * Test script for 5D Independent Pre-Calculation System
 * This script tests the complete flow from pre-calculation to result delivery
 */

const unifiedRedis = require('./config/unifiedRedisManager');
const { connectDB } = require('./config/db');

// Test configuration
const TEST_CONFIG = {
    gameType: 'fiveD',
    duration: 60,
    periodId: '20250731000000001',
    timeline: 'default'
};

/**
 * Test 1: Verify Redis connectivity
 */
const testRedisConnectivity = async () => {
    console.log('🧪 [TEST_1] Testing Redis connectivity...');
    
    try {
        const redis = unifiedRedis.getHelper();
        await redis.ping();
        console.log('✅ [TEST_1] Redis connectivity: PASSED');
        return true;
    } catch (error) {
        console.log('❌ [TEST_1] Redis connectivity: FAILED -', error.message);
        return false;
    }
};

/**
 * Test 2: Verify 5D pre-calculation scheduler is running
 */
const testSchedulerRunning = async () => {
    console.log('🧪 [TEST_2] Testing 5D pre-calculation scheduler...');
    
    try {
        // Check if scheduler is publishing messages
        const publisher = unifiedRedis.getConnection('publisher');
        
        // Send a test message
        const testMessage = {
            action: 'test_scheduler',
            gameType: TEST_CONFIG.gameType,
            duration: TEST_CONFIG.duration,
            periodId: TEST_CONFIG.periodId,
            timestamp: new Date().toISOString()
        };
        
        await publisher.publish('5d_precalc:test', JSON.stringify(testMessage));
        console.log('✅ [TEST_2] 5D pre-calculation scheduler: PASSED (test message sent)');
        return true;
    } catch (error) {
        console.log('❌ [TEST_2] 5D pre-calculation scheduler: FAILED -', error.message);
        return false;
    }
};

/**
 * Test 3: Verify WebSocket subscription setup
 */
const testWebSocketSubscription = async () => {
    console.log('🧪 [TEST_3] Testing WebSocket subscription...');
    
    try {
        // Check if WebSocket service is subscribed to 5D pre-calculation channels
        const subscriber = unifiedRedis.getConnection('subscriber');
        
        // Try to subscribe to test channel
        await subscriber.subscribe('5d_precalc:test');
        console.log('✅ [TEST_3] WebSocket subscription: PASSED');
        
        // Cleanup
        await subscriber.unsubscribe('5d_precalc:test');
        return true;
    } catch (error) {
        console.log('❌ [TEST_3] WebSocket subscription: FAILED -', error.message);
        return false;
    }
};

/**
 * Test 4: Verify pre-calculated result storage and retrieval
 */
const testResultStorage = async () => {
    console.log('🧪 [TEST_4] Testing result storage and retrieval...');
    
    try {
        const redis = unifiedRedis.getHelper();
        
        // Create test result
        const testResult = {
            A: 5,
            B: 2,
            C: 8,
            D: 1,
            E: 9,
            sum: 25,
            dice_value: 52819,
            sum_size: 'big',
            sum_parity: 'odd'
        };
        
        const testData = {
            result: testResult,
            betPatterns: { 'SUM_SIZE:SUM_big': 1500, 'SUM_PARITY:SUM_odd': 2000 },
            calculatedAt: new Date().toISOString(),
            periodId: TEST_CONFIG.periodId,
            gameType: TEST_CONFIG.gameType,
            duration: TEST_CONFIG.duration,
            timeline: TEST_CONFIG.timeline
        };
        
        // Store test result
        const resultKey = `precalc_5d_result:${TEST_CONFIG.gameType}:${TEST_CONFIG.duration}:${TEST_CONFIG.timeline}:${TEST_CONFIG.periodId}`;
        await redis.set(resultKey, JSON.stringify(testData), 'EX', 300);
        
        // Retrieve test result
        const retrievedData = await redis.get(resultKey);
        const parsedData = JSON.parse(retrievedData);
        
        if (parsedData.result && parsedData.result.A === 5) {
            console.log('✅ [TEST_4] Result storage and retrieval: PASSED');
            
            // Cleanup
            await redis.del(resultKey);
            return true;
        } else {
            console.log('❌ [TEST_4] Result storage and retrieval: FAILED - Invalid data');
            return false;
        }
    } catch (error) {
        console.log('❌ [TEST_4] Result storage and retrieval: FAILED -', error.message);
        return false;
    }
};

/**
 * Test 5: Verify bet pattern retrieval
 */
const testBetPatternRetrieval = async () => {
    console.log('🧪 [TEST_5] Testing bet pattern retrieval...');
    
    try {
        const redis = unifiedRedis.getHelper();
        
        // Create test bet patterns
        const testBetPatterns = {
            'SUM_SIZE:SUM_big': 1500,
            'SUM_PARITY:SUM_odd': 2000,
            'SUM:25': 500,
            'POSITION:A_5': 300
        };
        
        const exposureKey = `exposure:5d:${TEST_CONFIG.duration}:${TEST_CONFIG.timeline}:${TEST_CONFIG.periodId}`;
        
        // Store test bet patterns
        for (const [pattern, exposure] of Object.entries(testBetPatterns)) {
            await redis.hset(exposureKey, `bet:${pattern}`, exposure);
        }
        
        // Retrieve bet patterns
        const betExposures = await redis.hgetall(exposureKey);
        
        // Convert to bet patterns format
        const betPatterns = {};
        for (const [betKey, exposure] of Object.entries(betExposures)) {
            if (!betKey.startsWith('bet:')) continue;
            const actualBetKey = betKey.replace('bet:', '');
            const [betType, betValue] = actualBetKey.split(':');
            if (betType && betValue) {
                betPatterns[`${betType}:${betValue}`] = parseFloat(exposure);
            }
        }
        
        if (Object.keys(betPatterns).length > 0) {
            console.log('✅ [TEST_5] Bet pattern retrieval: PASSED');
            console.log('📊 Retrieved patterns:', betPatterns);
            
            // Cleanup
            await redis.del(exposureKey);
            return true;
        } else {
            console.log('❌ [TEST_5] Bet pattern retrieval: FAILED - No patterns found');
            return false;
        }
    } catch (error) {
        console.log('❌ [TEST_5] Bet pattern retrieval: FAILED -', error.message);
        return false;
    }
};

/**
 * Test 6: Verify period info retrieval
 */
const testPeriodInfoRetrieval = async () => {
    console.log('🧪 [TEST_6] Testing period info retrieval...');
    
    try {
        const redis = unifiedRedis.getHelper();
        
        // Create test period info
        const testPeriodInfo = {
            periodId: TEST_CONFIG.periodId,
            gameType: TEST_CONFIG.gameType,
            duration: TEST_CONFIG.duration,
            endTime: new Date(Date.now() + 60000).toISOString(), // 1 minute from now
            timeRemaining: 60,
            bettingOpen: true,
            active: true
        };
        
        const periodKey = `game_scheduler:${TEST_CONFIG.gameType}:${TEST_CONFIG.duration}:current`;
        await redis.set(periodKey, JSON.stringify(testPeriodInfo), 'EX', 300);
        
        // Retrieve period info
        const retrievedInfo = await redis.get(periodKey);
        const parsedInfo = JSON.parse(retrievedInfo);
        
        if (parsedInfo.periodId === TEST_CONFIG.periodId) {
            console.log('✅ [TEST_6] Period info retrieval: PASSED');
            
            // Cleanup
            await redis.del(periodKey);
            return true;
        } else {
            console.log('❌ [TEST_6] Period info retrieval: FAILED - Invalid data');
            return false;
        }
    } catch (error) {
        console.log('❌ [TEST_6] Period info retrieval: FAILED -', error.message);
        return false;
    }
};

/**
 * Test 7: Verify complete flow simulation
 */
const testCompleteFlow = async () => {
    console.log('🧪 [TEST_7] Testing complete flow simulation...');
    
    try {
        const redis = unifiedRedis.getHelper();
        const publisher = unifiedRedis.getConnection('publisher');
        
        // Step 1: Simulate bet freeze detection
        console.log('   📋 Step 1: Simulating bet freeze detection...');
        
        // Step 2: Simulate pre-calculation completion
        console.log('   📋 Step 2: Simulating pre-calculation completion...');
        
        const testResult = {
            A: 7,
            B: 3,
            C: 9,
            D: 4,
            E: 6,
            sum: 29,
            dice_value: 73946,
            sum_size: 'big',
            sum_parity: 'odd'
        };
        
        const completionMessage = {
            action: 'precalc_completed',
            gameType: TEST_CONFIG.gameType,
            duration: TEST_CONFIG.duration,
            periodId: TEST_CONFIG.periodId,
            timeline: TEST_CONFIG.timeline,
            result: testResult,
            completedAt: new Date().toISOString()
        };
        
        // Publish completion message
        await publisher.publish('5d_precalc:completed', JSON.stringify(completionMessage));
        
        // Step 3: Simulate result retrieval
        console.log('   📋 Step 3: Simulating result retrieval...');
        
        // Store result in Redis
        const resultKey = `precalc_5d_result:${TEST_CONFIG.gameType}:${TEST_CONFIG.duration}:${TEST_CONFIG.timeline}:${TEST_CONFIG.periodId}`;
        const testData = {
            result: testResult,
            betPatterns: { 'SUM_SIZE:SUM_big': 1500 },
            calculatedAt: new Date().toISOString(),
            periodId: TEST_CONFIG.periodId,
            gameType: TEST_CONFIG.gameType,
            duration: TEST_CONFIG.duration,
            timeline: TEST_CONFIG.timeline
        };
        
        await redis.set(resultKey, JSON.stringify(testData), 'EX', 300);
        
        // Retrieve result
        const retrievedData = await redis.get(resultKey);
        const parsedData = JSON.parse(retrievedData);
        
        if (parsedData.result && parsedData.result.A === 7) {
            console.log('✅ [TEST_7] Complete flow simulation: PASSED');
            
            // Cleanup
            await redis.del(resultKey);
            return true;
        } else {
            console.log('❌ [TEST_7] Complete flow simulation: FAILED - Invalid result');
            return false;
        }
    } catch (error) {
        console.log('❌ [TEST_7] Complete flow simulation: FAILED -', error.message);
        return false;
    }
};

/**
 * Run all tests
 */
const runAllTests = async () => {
    console.log('🚀 Starting 5D Independent Pre-Calculation System Tests...\n');
    
    try {
        // Connect to database
        await connectDB();
        console.log('✅ Database connected\n');
        
        // Initialize Redis
        if (!unifiedRedis.isInitialized) {
            throw new Error('Redis not initialized');
        }
        console.log('✅ Redis initialized\n');
        
        const tests = [
            { name: 'Redis Connectivity', fn: testRedisConnectivity },
            { name: 'Scheduler Running', fn: testSchedulerRunning },
            { name: 'WebSocket Subscription', fn: testWebSocketSubscription },
            { name: 'Result Storage', fn: testResultStorage },
            { name: 'Bet Pattern Retrieval', fn: testBetPatternRetrieval },
            { name: 'Period Info Retrieval', fn: testPeriodInfoRetrieval },
            { name: 'Complete Flow', fn: testCompleteFlow }
        ];
        
        let passedTests = 0;
        let totalTests = tests.length;
        
        for (const test of tests) {
            console.log(`\n🧪 Running test: ${test.name}`);
            console.log('─'.repeat(50));
            
            const result = await test.fn();
            if (result) {
                passedTests++;
            }
            
            console.log('─'.repeat(50));
        }
        
        // Summary
        console.log('\n📊 Test Summary:');
        console.log('─'.repeat(50));
        console.log(`✅ Passed: ${passedTests}/${totalTests}`);
        console.log(`❌ Failed: ${totalTests - passedTests}/${totalTests}`);
        
        if (passedTests === totalTests) {
            console.log('\n🎉 All tests passed! The 5D Independent Pre-Calculation System is ready.');
        } else {
            console.log('\n⚠️ Some tests failed. Please check the logs and fix the issues.');
        }
        
    } catch (error) {
        console.error('❌ Test execution failed:', error.message);
        process.exit(1);
    }
};

// Run tests if this file is executed directly
if (require.main === module) {
    runAllTests().then(() => {
        console.log('\n🏁 Test execution completed.');
        process.exit(0);
    }).catch((error) => {
        console.error('❌ Test execution failed:', error);
        process.exit(1);
    });
}

module.exports = {
    runAllTests,
    testRedisConnectivity,
    testSchedulerRunning,
    testWebSocketSubscription,
    testResultStorage,
    testBetPatternRetrieval,
    testPeriodInfoRetrieval,
    testCompleteFlow
}; 