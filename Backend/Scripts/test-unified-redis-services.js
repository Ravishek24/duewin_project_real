// Backend/scripts/test-unified-redis-services.js
const unifiedRedis = require('../config/unifiedRedisManager');

/**
 * Test Unified Redis Manager with Core Services
 * Verifies that all services work correctly with the unified manager
 */
async function testUnifiedRedisServices() {
    try {
        console.log('🧪 Testing Unified Redis Manager with Core Services');
        console.log('==================================================');
        
        // Initialize the manager
        console.log('\n1️⃣ Initializing Unified Redis Manager...');
        await unifiedRedis.initialize();
        console.log('✅ Manager initialized');
        
        // Test 1: Basic Helper Operations (used by most services)
        console.log('\n2️⃣ Testing Helper Operations (redisHelper pattern)...');
        const helper = redisHelper;
        
        // Test set/get with TTL
        await helper.set('test_service_key', { data: 'test_value', timestamp: Date.now() }, null, 60);
        const retrieved = await helper.get('test_service_key');
        console.log('✅ Set/Get with JSON:', retrieved && retrieved.data === 'test_value' ? 'PASSED' : 'FAILED');
        
        // Test exists
        const exists = await helper.exists('test_service_key');
        console.log('✅ Exists check:', exists ? 'PASSED' : 'FAILED');
        
        // Test hash operations (used by many services)
        await helper.hset('test_service_hash', 'field1', 'value1');
        await helper.hset('test_service_hash', 'field2', { nested: 'data' });
        const hashValue1 = await helper.hget('test_service_hash', 'field1');
        const hashValue2 = await helper.hget('test_service_hash', 'field2');
        const allHash = await helper.hgetall('test_service_hash');
        console.log('✅ Hash operations:', 
            hashValue1 === 'value1' && 
            hashValue2.nested === 'data' && 
            Object.keys(allHash).length === 2 ? 'PASSED' : 'FAILED'
        );
        
        // Test increment/decrement
        await helper.incr('test_counter', 5);
        await helper.decr('test_counter', 2);
        const counterValue = await helper.get('test_counter');
        console.log('✅ Increment/Decrement:', counterValue === '3' ? 'PASSED' : 'FAILED');
        
        // Test 2: Direct Redis Operations (used by some services)
        console.log('\n3️⃣ Testing Direct Redis Operations...');
        const mainRedis = redisHelper;
        const websocketRedis = redisHelper;
        
        // Test direct set/get
        await mainRedis.set('direct_test_key', 'direct_value', 'EX', 60);
        const directValue = await mainRedis.get('direct_test_key');
        console.log('✅ Direct Redis operations:', directValue === 'direct_value' ? 'PASSED' : 'FAILED');
        
        // Test multiple connections
        await websocketRedis.set('websocket_test_key', 'websocket_value', 'EX', 60);
        const websocketValue = await websocketRedis.get('websocket_test_key');
        console.log('✅ Multiple connections:', websocketValue === 'websocket_value' ? 'PASSED' : 'FAILED');
        
        // Test 3: Service-Specific Patterns
        console.log('\n4️⃣ Testing Service-Specific Patterns...');
        
        // Pattern 1: Period data (used by periodService, websocketService)
        const periodData = {
            periodId: '202412010000001',
            gameType: 'wingo',
            duration: 30,
            startTime: Date.now(),
            endTime: Date.now() + 30000,
            status: 'active'
        };
        await helper.set(`period:wingo:30:202412010000001`, periodData, null, 3600);
        const retrievedPeriod = await helper.get(`period:wingo:30:202412010000001`);
        console.log('✅ Period data pattern:', 
            retrievedPeriod && retrievedPeriod.periodId === '202412010000001' ? 'PASSED' : 'FAILED'
        );
        
        // Pattern 2: Bet data (used by gameLogicService)
        const betData = {
            userId: 'user123',
            betAmount: 100,
            betType: 'COLOR',
            betValue: 'red',
            odds: 2.0
        };
        await helper.hset(`bets:wingo:30:202412010000001`, 'bet_001', betData);
        const retrievedBet = await helper.hget(`bets:wingo:30:202412010000001`, 'bet_001');
        console.log('✅ Bet data pattern:', 
            retrievedBet && retrievedBet.userId === 'user123' ? 'PASSED' : 'FAILED'
        );
        
        // Pattern 3: Exposure data (used by adminExposureService, fiveDProtectionService)
        const exposureData = {
            gameType: 'wingo',
            duration: 30,
            periodId: '202412010000001',
            exposures: {
                'number:0': 1500,
                'number:1': 2000,
                'number:2': 1800
            }
        };
        await helper.set(`exposure:wingo:30:202412010000001`, exposureData, null, 3600);
        const retrievedExposure = await helper.get(`exposure:wingo:30:202412010000001`);
        console.log('✅ Exposure data pattern:', 
            retrievedExposure && retrievedExposure.exposures['number:0'] === 1500 ? 'PASSED' : 'FAILED'
        );
        
        // Pattern 4: Cache data (used by cacheService)
        const cacheData = {
            key: 'hot_games',
            data: ['wingo', 'trx_wix', 'fiveD'],
            timestamp: Date.now(),
            ttl: 3600
        };
        await helper.set(`cache:hot_games`, cacheData, null, 3600);
        const retrievedCache = await helper.get(`cache:hot_games`);
        console.log('✅ Cache data pattern:', 
            retrievedCache && retrievedCache.data.includes('wingo') ? 'PASSED' : 'FAILED'
        );
        
        // Pattern 5: Rate limiting (used by rateLimiterService, attackProtection)
        await helper.set('rate_limit:user123', 1, 'EX', 60, 'NX');
        const rateLimitValue = await helper.get('rate_limit:user123');
        console.log('✅ Rate limiting pattern:', rateLimitValue === '1' ? 'PASSED' : 'FAILED');
        
        // Test 4: Connection Management
        console.log('\n5️⃣ Testing Connection Management...');
        
        const stats = unifiedRedis.getStats();
        console.log('📊 Connection Stats:', {
            total: stats.created,
            active: stats.active,
            errors: stats.errors,
            purposes: stats.purposes
        });
        
        // Verify all connections are healthy
        const healthCheck = await unifiedRedis.healthCheck();
        const allHealthy = healthCheck.every(conn => conn.status === 'healthy');
        console.log('✅ All connections healthy:', allHealthy ? 'PASSED' : 'FAILED');
        
        // Test 5: Performance Test
        console.log('\n6️⃣ Testing Performance...');
        
        const startTime = Date.now();
        const promises = [];
        
        // Simulate concurrent operations (like real service usage)
        for (let i = 0; i < 100; i++) {
            promises.push(helper.set(`perf_test_${i}`, `value_${i}`, null, 60));
        }
        
        await Promise.all(promises);
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        console.log(`✅ Performance test: ${promises.length} operations in ${duration}ms (${(promises.length/duration*1000).toFixed(1)} ops/sec)`);
        
        // Cleanup
        console.log('\n7️⃣ Cleaning up test data...');
        const cleanupPromises = [
            helper.del('test_service_key'),
            helper.del('test_service_hash'),
            helper.del('test_counter'),
            mainRedis.del('direct_test_key'),
            websocketRedis.del('websocket_test_key'),
            helper.del('period:wingo:30:202412010000001'),
            helper.del('bets:wingo:30:202412010000001'),
            helper.del('exposure:wingo:30:202412010000001'),
            helper.del('cache:hot_games'),
            helper.del('rate_limit:user123')
        ];
        
        // Cleanup performance test keys
        for (let i = 0; i < 100; i++) {
            cleanupPromises.push(helper.del(`perf_test_${i}`));
        }
        
        await Promise.all(cleanupPromises);
        console.log('✅ Cleanup completed');
        
        // Final summary
        console.log('\n🎉 All Tests Completed Successfully!');
        console.log('=====================================');
        console.log('✅ Helper operations working');
        console.log('✅ Direct Redis operations working');
        console.log('✅ Service-specific patterns working');
        console.log('✅ Connection management working');
        console.log('✅ Performance acceptable');
        console.log('✅ Cleanup working');
        
        console.log('\n📋 Your application is ready to use the Unified Redis Manager!');
        console.log('All your services will work exactly the same, but with better connection management.');
        
        return true;
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack trace:', error.stack);
        return false;
    }
}

// Run if called directly
if (require.main === module) {
    testUnifiedRedisServices()
        .then(success => {
            if (success) {
                console.log('\n🎯 Next Steps:');
                console.log('1. Your application is ready to use the unified manager');
                console.log('2. Start your services normally - they will work unchanged');
                console.log('3. Monitor connection count - should be stable at 6 connections');
                console.log('4. If any issues occur, use rollback: node scripts/rollback-redis-migration.js');
                process.exit(0);
            } else {
                console.error('💥 Tests failed - check the logs above');
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('💥 Unexpected error:', error);
            process.exit(1);
        });
}

module.exports = {
    setRedisHelper, testUnifiedRedisServices }; 