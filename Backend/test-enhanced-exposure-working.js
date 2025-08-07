const unifiedRedis = require('./config/unifiedRedisManager');

async function testEnhancedExposureWorking() {
    console.log('🧪 [TEST] Testing Enhanced Exposure Tracking Working');
    
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
        
        // Add test bets to exposure tracking
        for (const bet of testBets) {
            console.log(`📝 [TEST] Adding bet: ${bet.userId} - ${bet.betType}:${bet.betValue} - ₹${bet.betAmount}`);
            
            // Simulate the exposure tracking logic
            if (bet.betType === 'NUMBER') {
                // For NUMBER bets, add to specific number
                await addUserToNumberTracking(exposureKey, bet.betValue, bet);
            } else {
                // For other bets, add to all matching numbers
                const matchingNumbers = getMatchingNumbers(bet.betType, bet.betValue);
                for (const num of matchingNumbers) {
                    await addUserToNumberTracking(exposureKey, num, bet);
                }
            }
        }
        
        // Test the enhanced exposure data retrieval
        console.log('\n🔍 [TEST] Testing Enhanced Exposure Data Retrieval...');
        
        const exposureData = await unifiedRedisHelper.hgetall(exposureKey);
        console.log('📊 [TEST] Raw exposure data:', exposureData);
        
        // Test numbers data
        const numbers = {};
        for (let num = 0; num <= 9; num++) {
            const userCount = await getNumberUserCount(exposureKey, num);
            const totalBetAmount = await getNumberTotalBetAmount(exposureKey, num);
            numbers[num] = {
                users: userCount,
                totalBetAmount: totalBetAmount
            };
        }
        
        console.log('\n📈 [TEST] Numbers with User Counts:');
        Object.entries(numbers).forEach(([number, data]) => {
            if (data.users > 0) {
                console.log(`Number ${number}: 👥 ${data.users} users | 💰 ₹${data.totalBetAmount.toFixed(2)}`);
            }
        });
        
        // Test user details
        console.log('\n👥 [TEST] User Details by Number:');
        for (let num = 0; num <= 9; num++) {
            const usersJson = await unifiedRedisHelper.hget(exposureKey, `users:number:${num}`);
            if (usersJson) {
                const users = JSON.parse(usersJson);
                if (users.length > 0) {
                    console.log(`Number ${num}: ${users.length} users`);
                    users.forEach((user, index) => {
                        console.log(`  ${index + 1}. ${user.userId} - ${user.betType}:${user.betValue} - ₹${user.betAmount}`);
                    });
                }
            }
        }
        
        // Test statistics
        console.log('\n📊 [TEST] Statistics by Number:');
        for (let num = 0; num <= 9; num++) {
            const statsJson = await unifiedRedisHelper.hget(exposureKey, `stats:number:${num}`);
            if (statsJson) {
                const stats = JSON.parse(statsJson);
                if (stats.totalUsers > 0) {
                    console.log(`Number ${num}: ${stats.totalUsers} users, ₹${stats.totalBetAmount.toFixed(2)}, ${stats.uniqueUsers} unique`);
                }
            }
        }
        
        // Test period summary
        console.log('\n📋 [TEST] Period Summary:');
        const periodStatsJson = await unifiedRedisHelper.hget(exposureKey, 'period:stats');
        if (periodStatsJson) {
            const periodStats = JSON.parse(periodStatsJson);
            console.log('Period Stats:', periodStats);
        }
        
        console.log('\n✅ [TEST] Enhanced exposure tracking test completed successfully!');
        
    } catch (error) {
        console.error('❌ [TEST] Test failed:', error);
    }
}

// Helper functions
async function addUserToNumberTracking(exposureKey, number, userData) {
    try {
        const userKey = `users:number:${number}`;
        const statsKey = `stats:number:${number}`;
        
        // Get existing users for this number
        const existingUsersJson = await unifiedRedis.getHelper().hget(exposureKey, userKey) || '[]';
        const existingUsers = JSON.parse(existingUsersJson);
        
        // Add new user
        existingUsers.push(userData);
        
        // Limit to max 100 users per number (performance optimization)
        if (existingUsers.length > 100) {
            existingUsers.splice(0, existingUsers.length - 100);
        }
        
        // Update users list
        await unifiedRedis.getHelper().hset(exposureKey, userKey, JSON.stringify(existingUsers));
        
        // Update statistics
        await updateNumberStatistics(exposureKey, number, existingUsers);
        
        // Update global period statistics
        await updatePeriodStatistics(exposureKey);
        
    } catch (error) {
        console.error('❌ Error adding user to number tracking:', error);
    }
}

async function updateNumberStatistics(exposureKey, number, users) {
    try {
        const statsKey = `stats:number:${number}`;
        
        const stats = {
            totalUsers: users.length,
            totalBetAmount: users.reduce((sum, user) => sum + user.betAmount, 0),
            uniqueUsers: new Set(users.map(u => u.userId)).size,
            betTypes: {}
        };
        
        // Count bet types
        users.forEach(user => {
            stats.betTypes[user.betType] = (stats.betTypes[user.betType] || 0) + 1;
        });
        
        await unifiedRedis.getHelper().hset(exposureKey, statsKey, JSON.stringify(stats));
        
    } catch (error) {
        console.error('❌ Error updating number statistics:', error);
    }
}

async function updatePeriodStatistics(exposureKey) {
    try {
        const statsKey = 'period:stats';
        
        // Get all number statistics
        const allStats = {};
        for (let num = 0; num <= 9; num++) {
            const numberStatsJson = await unifiedRedis.getHelper().hget(exposureKey, `stats:number:${num}`);
            if (numberStatsJson) {
                allStats[num] = JSON.parse(numberStatsJson);
            }
        }
        
        // Calculate global statistics
        const globalStats = {
            totalUsers: 0,
            totalBetAmount: 0,
            uniqueUsers: new Set(),
            numberDistribution: {}
        };
        
        Object.entries(allStats).forEach(([number, stats]) => {
            globalStats.totalUsers += stats.totalUsers;
            globalStats.totalBetAmount += stats.totalBetAmount;
            stats.uniqueUsers.forEach(userId => globalStats.uniqueUsers.add(userId));
            globalStats.numberDistribution[number] = stats.totalUsers;
            globalStats.numberDistribution[`totalBetAmount:${number}`] = stats.totalBetAmount;
        });
        
        globalStats.uniqueUsers = globalStats.uniqueUsers.size;
        
        await unifiedRedis.getHelper().hset(exposureKey, statsKey, JSON.stringify(globalStats));
        
    } catch (error) {
        console.error('❌ Error updating period statistics:', error);
    }
}

function getMatchingNumbers(betType, betValue) {
    // Simplified matching logic for testing
    if (betType === 'COLOR') {
        if (betValue === 'red') {
            return [0, 2, 4, 6, 8]; // Red numbers
        } else if (betValue === 'green') {
            return [1, 3, 5, 7, 9]; // Green numbers
        }
    } else if (betType === 'SIZE') {
        if (betValue === 'big') {
            return [5, 6, 7, 8, 9]; // Big numbers
        } else if (betValue === 'small') {
            return [0, 1, 2, 3, 4]; // Small numbers
        }
    }
    return [];
}

async function getNumberUserCount(exposureKey, number) {
    const usersJson = await unifiedRedis.getHelper().hget(exposureKey, `users:number:${number}`);
    return usersJson ? JSON.parse(usersJson).length : 0;
}

async function getNumberTotalBetAmount(exposureKey, number) {
    const usersJson = await unifiedRedis.getHelper().hget(exposureKey, `users:number:${number}`);
    if (!usersJson) return 0;
    const users = JSON.parse(usersJson);
    return users.reduce((sum, user) => sum + user.betAmount, 0);
}

// Run the test
testEnhancedExposureWorking(); 