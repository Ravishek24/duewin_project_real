const unifiedRedis = require('./config/unifiedRedisManager');
const gameLogicService = require('./services/gameLogicService');

async function testBetExposureTracking() {
    console.log('🧪 [TEST] Testing Bet Exposure Tracking');
    
    try {
        const unifiedRedisHelper = unifiedRedis.getHelper();
        
        // Test data
        const testDuration = 30;
        const testPeriodId = 'test_period_002';
        const exposureKey = `exposure:wingo:${testDuration}:default:${testPeriodId}`;
        
        console.log('📊 [TEST] Setting up test data...');
        
        // Clear any existing test data
        await unifiedRedisHelper.del(exposureKey);
        
        // Simulate a test bet
        const testBet = {
            userId: 'test_user_123',
            betAmount: 25.00,
            betType: 'COLOR',
            betValue: 'red',
            netBetAmount: 25.00,
            amount_after_tax: 25.00
        };
        
        console.log(`📝 [TEST] Processing test bet: ${testBet.userId} - ${testBet.betType}:${testBet.betValue} - ₹${testBet.betAmount}`);
        
        // Call the actual updateBetExposure function
        await gameLogicService.updateBetExposure('wingo', testDuration, testPeriodId, testBet, 'default');
        
        // Wait a moment for processing
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Check if exposure data was stored
        console.log('\n🔍 [TEST] Checking exposure data...');
        const exposureData = await unifiedRedisHelper.hgetall(exposureKey);
        console.log('📊 [TEST] Raw exposure data:', exposureData);
        
        // Check if user tracking data was stored
        console.log('\n👥 [TEST] Checking user tracking data...');
        for (let num = 0; num <= 9; num++) {
            const usersJson = await unifiedRedisHelper.hget(exposureKey, `users:number:${num}`);
            const statsJson = await unifiedRedisHelper.hget(exposureKey, `stats:number:${num}`);
            
            if (usersJson) {
                const users = JSON.parse(usersJson);
                console.log(`Number ${num}: ${users.length} users`);
                users.forEach((user, index) => {
                    console.log(`  ${index + 1}. ${user.userId} - ${user.betType}:${user.betValue} - ₹${user.betAmount}`);
                });
            }
            
            if (statsJson) {
                const stats = JSON.parse(statsJson);
                console.log(`Number ${num} stats:`, stats);
            }
        }
        
        // Check period statistics
        console.log('\n📋 [TEST] Checking period statistics...');
        const periodStatsJson = await unifiedRedisHelper.hget(exposureKey, 'period:stats');
        if (periodStatsJson) {
            const periodStats = JSON.parse(periodStatsJson);
            console.log('Period Stats:', periodStats);
        }
        
        // Test the admin exposure service
        console.log('\n🔍 [TEST] Testing Admin Exposure Service...');
        const adminExposureService = require('./services/adminExposureService');
        const enhancedData = await adminExposureService.getEnhancedWingoExposure(testDuration, testPeriodId);
        
        console.log('\n📊 [TEST] Enhanced Exposure Data:');
        console.log('Success:', enhancedData.success);
        console.log('Room:', enhancedData.room);
        console.log('Duration:', enhancedData.duration);
        
        if (enhancedData.numbers) {
            console.log('\n📈 Numbers with User Counts:');
            Object.entries(enhancedData.numbers).forEach(([number, data]) => {
                if (data.users > 0) {
                    console.log(`Number ${number}: 👥 ${data.users} users | 💰 ₹${data.totalBetAmount.toFixed(2)}`);
                }
            });
        }
        
        if (enhancedData.periodSummary) {
            console.log('\n📊 Period Summary:');
            console.log('Total Users:', enhancedData.periodSummary.totalUsers);
            console.log('Total Bet Amount:', enhancedData.periodSummary.totalBetAmount);
            console.log('Unique Users:', enhancedData.periodSummary.uniqueUsers);
        }
        
        console.log('\n✅ [TEST] Bet exposure tracking test completed!');
        
    } catch (error) {
        console.error('❌ [TEST] Test failed:', error);
        console.error('Error stack:', error.stack);
    }
}

// Run the test
testBetExposureTracking(); 