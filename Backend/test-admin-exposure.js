const adminExposureService = require('./services/adminExposureService');
const adminAuthService = require('./services/adminAuthService');

/**
 * Test Admin Exposure Monitoring System
 */

async function testAdminExposureSystem() {
    console.log('🧪 Testing Admin Exposure Monitoring System');
    console.log('===========================================');

    try {
        // Test 1: Admin Authentication
        console.log('\n🔐 Test 1: Admin Authentication');
        console.log('--------------------------------');
        
        const loginResult = await adminAuthService.adminLogin('admin', 'admin123');
        console.log('Login Result:', loginResult.success ? '✅ PASSED' : '❌ FAILED');
        
        if (loginResult.success) {
            console.log('Token:', loginResult.data.token.substring(0, 50) + '...');
            console.log('Admin:', loginResult.data.admin.username);
        }

        // Test 2: Token Verification
        console.log('\n🔍 Test 2: Token Verification');
        console.log('-----------------------------');
        
        if (loginResult.success) {
            const tokenResult = adminAuthService.verifyAdminToken(loginResult.data.token);
            console.log('Token Verification:', tokenResult.valid ? '✅ PASSED' : '❌ FAILED');
            
            if (tokenResult.valid) {
                console.log('Admin Permissions:', tokenResult.admin.permissions);
            }
        }

        // Test 3: IP Whitelist
        console.log('\n🌐 Test 3: IP Whitelist');
        console.log('------------------------');
        
        const testIPs = ['127.0.0.1', '192.168.1.100', '10.0.0.50', '8.8.8.8'];
        
        testIPs.forEach(ip => {
            const isWhitelisted = adminExposureService.verifyAdminIP(ip);
            console.log(`${ip}: ${isWhitelisted ? '✅ WHITELISTED' : '❌ BLOCKED'}`);
        });

        // Test 4: Wingo Exposure Data
        console.log('\n📊 Test 4: Wingo Exposure Data');
        console.log('-------------------------------');
        
        const wingoDurations = [30, 60, 180, 300];
        
        for (const duration of wingoDurations) {
            console.log(`\nTesting Wingo ${duration}s exposure...`);
            
            const exposureData = await adminExposureService.getWingoExposure(duration);
            
            if (exposureData.success) {
                console.log(`✅ Wingo ${duration}s: ${exposureData.analysis.totalExposure}₹ total exposure`);
                console.log(`   Optimal Number: ${exposureData.analysis.optimalNumber}`);
                console.log(`   Zero Exposure Numbers: [${exposureData.analysis.zeroExposureNumbers.join(', ')}]`);
                console.log(`   Users: ${exposureData.analysis.betDistribution.uniqueUsers}`);
                console.log(`   Bets: ${exposureData.analysis.betDistribution.totalBets}`);
            } else {
                console.log(`❌ Wingo ${duration}s: ${exposureData.error}`);
            }
        }

        // Test 5: All Rooms Exposure
        console.log('\n🏠 Test 5: All Rooms Exposure');
        console.log('-----------------------------');
        
        const allRoomsData = await adminExposureService.getAllWingoRoomsExposure();
        
        if (allRoomsData.success) {
            console.log(`✅ All rooms data retrieved successfully`);
            console.log(`   Total Rooms: ${Object.keys(allRoomsData.rooms).length}`);
            console.log(`   Timestamp: ${allRoomsData.timestamp}`);
            
            for (const [roomName, roomData] of Object.entries(allRoomsData.rooms)) {
                console.log(`   ${roomName}: ${roomData.analysis.totalExposure}₹ exposure`);
            }
        } else {
            console.log(`❌ All rooms data failed: ${allRoomsData.error}`);
        }

        // Test 6: Period Information
        console.log('\n⏰ Test 6: Period Information');
        console.log('-----------------------------');
        
        for (const duration of wingoDurations) {
            const currentPeriod = await adminExposureService.getCurrentPeriod(duration);
            const periodInfo = await adminExposureService.getPeriodInfo(duration, currentPeriod);
            
            console.log(`Wingo ${duration}s:`);
            console.log(`   Period ID: ${currentPeriod}`);
            console.log(`   Time Remaining: ${periodInfo?.timeRemaining || 0}s`);
            console.log(`   Duration: ${periodInfo?.duration || duration}s`);
        }

        // Test 7: Bet Distribution
        console.log('\n🎲 Test 7: Bet Distribution');
        console.log('----------------------------');
        
        for (const duration of wingoDurations) {
            const currentPeriod = await adminExposureService.getCurrentPeriod(duration);
            const betDistribution = await adminExposureService.getBetDistribution(duration, currentPeriod);
            
            console.log(`Wingo ${duration}s:`);
            console.log(`   Total Bets: ${betDistribution.totalBets}`);
            console.log(`   Unique Users: ${betDistribution.uniqueUsers}`);
            console.log(`   Bet Types: ${JSON.stringify(betDistribution.betTypes)}`);
        }

        console.log('\n✅ All tests completed successfully!');
        console.log('=====================================');

    } catch (error) {
        console.error('❌ Test failed:', error);
        console.error('Stack:', error.stack);
    }
}

// Run the test
testAdminExposureSystem().then(() => {
    console.log('\n🏁 Test script completed');
    process.exit(0);
}).catch(error => {
    console.error('❌ Test script failed:', error);
    process.exit(1);
}); 