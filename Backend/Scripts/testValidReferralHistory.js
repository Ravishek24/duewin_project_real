// scripts/testValidReferralHistory.js
// Test script for the new valid referral history API

const { getValidReferralHistory } = require('../services/referralService');

const testValidReferralHistory = async () => {
    try {
        console.log('🧪 Testing valid referral history API...');
        
        // Test with a sample user ID (you can change this)
        const testUserId = 1; // Change this to an actual user ID in your database
        const page = 1;
        const limit = 10;
        
        console.log(`📋 Testing for user ID: ${testUserId}, Page: ${page}, Limit: ${limit}`);
        
        const result = await getValidReferralHistory(testUserId, page, limit);
        
        if (result.success) {
            console.log('✅ API call successful!');
            console.log('📊 User Info:', result.user);
            console.log('📈 Summary:', result.summary);
            console.log('📄 Pagination:', result.pagination);
            console.log('👥 History Records:', result.history.length);
            
            // Show first few records
            if (result.history.length > 0) {
                console.log('\n📋 Sample History Records:');
                result.history.slice(0, 3).forEach((record, index) => {
                    console.log(`\n--- Record ${index + 1} ---`);
                    console.log(`Referral ID: ${record.referralId}`);
                    console.log(`Referred User: ${record.referredUser.userName} (ID: ${record.referredUser.userId})`);
                    console.log(`Registration Date: ${record.referredUser.registrationDate}`);
                    console.log(`Total Recharge: ₹${record.validReferralDetails.totalRecharge}`);
                    console.log(`Valid Recharge Date: ${record.validReferralDetails.validRechargeDate}`);
                    console.log(`Valid Recharge Amount: ₹${record.validReferralDetails.validRechargeAmount}`);
                    console.log(`Became Valid At: ${record.validReferralDetails.becameValidAt}`);
                });
            } else {
                console.log('ℹ️ No valid referrals found for this user');
            }
        } else {
            console.log('❌ API call failed:', result.message);
        }
        
    } catch (error) {
        console.error('💥 Error testing valid referral history:', error);
    } finally {
        process.exit(0);
    }
};

// Run the test
testValidReferralHistory();
