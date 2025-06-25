const { sequelize } = require('../config/db');
const referralService = require('../services/referralService');

const testCommissionTracking = async () => {
    try {
        console.log('🧪 Testing Commission Tracking System');
        console.log('=====================================');

        // Test with a specific user (replace with actual user ID)
        const testUserId = 1; // Change this to an actual user ID

        console.log(`\n📊 Testing for User ID: ${testUserId}`);

        // 1. Test Direct Referrals with Commission
        console.log('\n🔍 1. Testing Direct Referrals with Commission:');
        const directResult = await referralService.getDirectReferrals(testUserId);
        
        if (directResult.success) {
            console.log(`✅ Direct Referrals: ${directResult.total} users`);
            console.log(`💰 Total Commission Earned: ₹${directResult.totalCommissionEarned}`);
            
            if (directResult.directReferrals.length > 0) {
                console.log('\n📋 Direct Referral Details:');
                directResult.directReferrals.forEach((user, index) => {
                    console.log(`   ${index + 1}. ${user.user_name} (ID: ${user.user_id})`);
                    console.log(`      Commission Earned: ₹${user.commission_earned}`);
                    console.log(`      Joined: ${user.created_at}`);
                    console.log(`      Wallet Balance: ₹${user.wallet_balance}`);
                });
            }
        } else {
            console.log(`❌ Error: ${directResult.message}`);
        }

        // 2. Test Team Referrals with Commission
        console.log('\n🏆 2. Testing Team Referrals with Commission:');
        const teamResult = await referralService.getTeamReferrals(testUserId);
        
        if (teamResult.success) {
            console.log(`✅ Team Referrals: ${teamResult.total} users across all levels`);
            console.log(`💰 Total Commission Earned: ₹${teamResult.totalCommissionEarned}`);
            
            // Show breakdown by level
            for (let level = 1; level <= 6; level++) {
                const levelKey = `level${level}`;
                const levelUsers = teamResult.teamReferrals[levelKey] || [];
                
                if (levelUsers.length > 0) {
                    console.log(`\n📊 Level ${level}: ${levelUsers.length} users`);
                    
                    const levelCommission = levelUsers.reduce(
                        (sum, user) => sum + parseFloat(user.commission_earned || 0), 0
                    );
                    console.log(`   💰 Level ${level} Commission: ₹${levelCommission}`);
                    
                    // Show top 3 users by commission for this level
                    const topUsers = levelUsers
                        .sort((a, b) => parseFloat(b.commission_earned || 0) - parseFloat(a.commission_earned || 0))
                        .slice(0, 3);
                    
                    topUsers.forEach((user, index) => {
                        console.log(`   ${index + 1}. ${user.user_name} - ₹${user.commission_earned}`);
                    });
                }
            }
        } else {
            console.log(`❌ Error: ${teamResult.message}`);
        }

        // 3. Test Commission History
        console.log('\n📈 3. Testing Commission History:');
        const historyResult = await referralService.getRebateCommissionHistory(testUserId, null, 1, 10);
        
        if (historyResult.success) {
            console.log(`✅ Commission History: ${historyResult.data.summary.totalRecords} records`);
            console.log(`💰 Total Commission: ₹${historyResult.data.summary.totalCommission}`);
            
            if (historyResult.data.summary.userBreakdown.length > 0) {
                console.log('\n👥 Top Users by Commission:');
                historyResult.data.summary.userBreakdown.slice(0, 5).forEach((user, index) => {
                    console.log(`   ${index + 1}. ${user.userName} - ₹${user.totalCommission}`);
                });
            }
        } else {
            console.log(`❌ Error: ${historyResult.message}`);
        }

        // 4. Test Commission Stats
        console.log('\n📊 4. Testing Commission Statistics:');
        const statsResult = await referralService.getRebateCommissionStats(testUserId);
        
        if (statsResult.success) {
            const data = statsResult.data;
            console.log(`✅ User: ${data.userInfo.userName} (Level: ${data.userInfo.rebateLevel})`);
            console.log(`👥 Total Team Members: ${data.teamStructure.totalMembers}`);
            console.log(`💰 Total Earned: ₹${data.commissionStats.totalEarned}`);
            console.log(`🎯 Potential Daily: ₹${data.commissionStats.potentialDaily}`);
            
            if (data.rebateRates) {
                console.log('\n📋 Rebate Rates:');
                console.log('   Lottery:');
                for (let level = 1; level <= 6; level++) {
                    console.log(`     Level ${level}: ${data.rebateRates.lottery[`level${level}`]}%`);
                }
                console.log('   Casino:');
                for (let level = 1; level <= 6; level++) {
                    console.log(`     Level ${level}: ${data.rebateRates.casino[`level${level}`]}%`);
                }
            }
        } else {
            console.log(`❌ Error: ${statsResult.message}`);
        }

        console.log('\n✅ Commission Tracking Test Completed!');

    } catch (error) {
        console.error('💥 Error in commission tracking test:', error);
    } finally {
        await sequelize.close();
    }
};

// Run the test
testCommissionTracking(); 