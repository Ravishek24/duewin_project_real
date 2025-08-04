const unifiedRedis = require('./config/unifiedRedisManager');
const adminExposureService = require('./services/adminExposureService');

async function testEnhancedExposure() {
    console.log('🧪 [TEST] Testing Enhanced Exposure Tracking');
    
    try {
        const unifiedRedisHelper = unifiedRedis.getHelper();
        
        // Test data
        const testDuration = 30;
        const testPeriodId = 'test_period_001';
        const exposureKey = `exposure:wingo:${testDuration}:default:${testPeriodId}`;
        
        console.log('📊 [TEST] Setting up test data...');
        
        // Clear any existing test data
        await unifiedRedisHelper.del(exposureKey);
        
        // Simulate some test bets
        const testBets = [
            {
                userId: 'user123',
                betAmount: 15.00,
                betType: 'COLOR',
                betValue: 'red',
                timestamp: Date.now()
            },
            {
                userId: 'user456',
                betAmount: 20.00,
                betType: 'NUMBER',
                betValue: '0',
                timestamp: Date.now()
            },
            {
                userId: 'user789',
                betAmount: 12.50,
                betType: 'SIZE',
                betValue: 'big',
                timestamp: Date.now()
            }
        ];
        
        // Add test users to numbers (simulating the user tracking)
        for (const bet of testBets) {
            let targetNumbers = [];
            
            if (bet.betType === 'NUMBER') {
                targetNumbers = [parseInt(bet.betValue)];
            } else if (bet.betType === 'COLOR') {
                // Red numbers: 0, 2, 4, 6, 8
                targetNumbers = [0, 2, 4, 6, 8];
            } else if (bet.betType === 'SIZE') {
                // Big numbers: 5, 6, 7, 8, 9
                targetNumbers = [5, 6, 7, 8, 9];
            }
            
            for (const num of targetNumbers) {
                const userKey = `users:number:${num}`;
                const existingUsersJson = await unifiedRedisHelper.hget(exposureKey, userKey) || '[]';
                const existingUsers = JSON.parse(existingUsersJson);
                existingUsers.push(bet);
                await unifiedRedisHelper.hset(exposureKey, userKey, JSON.stringify(existingUsers));
            }
        }
        
        // Update statistics
        for (let num = 0; num <= 9; num++) {
            const userKey = `users:number:${num}`;
            const usersJson = await unifiedRedisHelper.hget(exposureKey, userKey);
            
            if (usersJson) {
                const users = JSON.parse(usersJson);
                const stats = {
                    totalUsers: users.length,
                    totalBetAmount: users.reduce((sum, user) => sum + user.betAmount, 0),
                    uniqueUsers: new Set(users.map(u => u.userId)).size,
                    betTypes: {}
                };
                
                users.forEach(user => {
                    stats.betTypes[user.betType] = (stats.betTypes[user.betType] || 0) + 1;
                });
                
                await unifiedRedisHelper.hset(exposureKey, `stats:number:${num}`, JSON.stringify(stats));
            }
        }
        
        // Update global period statistics
        const allStats = {};
        for (let num = 0; num <= 9; num++) {
            const numberStatsJson = await unifiedRedisHelper.hget(exposureKey, `stats:number:${num}`);
            if (numberStatsJson) {
                allStats[num] = JSON.parse(numberStatsJson);
            }
        }
        
        const globalStats = {
            totalUsers: 0,
            totalBetAmount: 0,
            uniqueUsers: new Set(),
            numberDistribution: {}
        };
        
        Object.entries(allStats).forEach(([number, stats]) => {
            globalStats.totalUsers += stats.totalUsers;
            globalStats.totalBetAmount += stats.totalBetAmount;
            globalStats.numberDistribution[number] = stats.totalUsers;
        });
        
        const allUserIds = new Set();
        for (let num = 0; num <= 9; num++) {
            const usersJson = await unifiedRedisHelper.hget(exposureKey, `users:number:${num}`);
            if (usersJson) {
                const users = JSON.parse(usersJson);
                users.forEach(user => allUserIds.add(user.userId));
            }
        }
        globalStats.uniqueUsers = allUserIds.size;
        
        await unifiedRedisHelper.hset(exposureKey, 'period:stats', JSON.stringify(globalStats));
        
        console.log('✅ [TEST] Test data setup complete');
        
        // Test the admin exposure service methods
        console.log('\n🔍 [TEST] Testing Admin Exposure Service Methods...');
        
        // Test getUserDetailsForNumber
        const userDetails = await adminExposureService.getUserDetailsForNumber(testDuration, testPeriodId, 0);
        console.log('📊 [TEST] User details for number 0:', JSON.stringify(userDetails, null, 2));
        
        // Test getAllNumbersUserCounts
        const userCounts = await adminExposureService.getAllNumbersUserCounts(testDuration, testPeriodId);
        console.log('📊 [TEST] All numbers user counts:', JSON.stringify(userCounts, null, 2));
        
        // Test getEnhancedWingoExposure
        const enhancedData = await adminExposureService.getEnhancedWingoExposure(testDuration, testPeriodId);
        console.log('📊 [TEST] Enhanced Wingo exposure:', JSON.stringify(enhancedData, null, 2));
        
        console.log('\n✅ [TEST] All tests completed successfully!');
        
        // Clean up test data
        await unifiedRedisHelper.del(exposureKey);
        console.log('🧹 [TEST] Test data cleaned up');
        
    } catch (error) {
        console.error('❌ [TEST] Test failed:', error);
    }
}

// Run the test
testEnhancedExposure(); 