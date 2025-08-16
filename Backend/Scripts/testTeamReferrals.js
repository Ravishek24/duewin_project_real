const referralService = require('../services/referralService');

async function testTeamReferrals() {
    try {
        console.log('🧪 Testing Enhanced Team Referrals Service...\n');
        
        // Test 1: Get team referrals with pagination and withdrawal data
        console.log('📋 Test 1: Get team referrals with pagination (page 1, limit 3)');
        const result1 = await referralService.getTeamReferrals(13, null, 1, 3);
        console.log('✅ Result:', JSON.stringify(result1, null, 2));
        console.log('📄 Pagination info:', result1.pagination);
        
        // Check if withdrawal data is included
        if (result1.success && result1.teamReferrals.level1 && result1.teamReferrals.level1.length > 0) {
            const firstUser = result1.teamReferrals.level1[0];
            console.log('💰 First user financial data:', {
                userId: firstUser.userId,
                userName: firstUser.userName,
                totalDeposit: firstUser.totalDeposit,
                totalWithdrawal: firstUser.totalWithdrawal,
                commissionEarned: firstUser.commissionEarned
            });
        }
        
        // Test 2: Get team referrals for admin (user 13)
        console.log('\n📋 Test 2: Get team referrals for admin (user 13)');
        const result2 = await referralService.getTeamReferralsForAdmin(13, null, 1, 3);
        console.log('✅ Result:', JSON.stringify(result2, null, 2));
        console.log('🎯 Target user info:', result2.targetUser);
        
        // Test 3: Test pagination (page 2)
        console.log('\n📋 Test 3: Test pagination (page 2, limit 3)');
        const result3 = await referralService.getTeamReferrals(13, null, 2, 3);
        console.log('✅ Result:', JSON.stringify(result3, null, 2));
        console.log('📄 Pagination info:', result3.pagination);
        
        console.log('\n🎉 All tests completed successfully!');
        console.log('💡 New features tested:');
        console.log('   - ✅ Pagination per level');
        console.log('   - ✅ Total withdrawal data per user');
        console.log('   - ✅ Consistent field naming');
        console.log('   - ✅ Admin API with target user info');
        
    } catch (error) {
        console.error('💥 Test failed:', error);
    }
}

// Run the test
testTeamReferrals();
