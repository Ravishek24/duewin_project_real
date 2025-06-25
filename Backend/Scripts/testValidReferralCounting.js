const { connectDB, getSequelizeInstance } = require('../config/db');
const { getModels } = require('../models');

/**
 * Test valid referral counting by simulating a recharge
 */
const testValidReferralCounting = async (referredUserId, rechargeAmount) => {
    let sequelize = null;
    
    try {
        console.log(`🧪 Testing valid referral counting for user ${referredUserId} with recharge ₹${rechargeAmount}...`);
        
        // Initialize database connection
        await connectDB();
        sequelize = await getSequelizeInstance();
        
        console.log('✅ Database connection established');
        
        // Initialize models properly
        const models = await getModels();
        const User = models.User;
        const ValidReferral = models.ValidReferral;
        const WalletRecharge = models.WalletRecharge;
        
        if (!User) {
            throw new Error('User model not found');
        }
        
        console.log('✅ Models initialized');
        
        // Get the referred user details
        const referredUser = await User.findByPk(referredUserId);
        if (!referredUser) {
            throw new Error(`Referred user ${referredUserId} not found`);
        }
        
        console.log(`\n👤 Referred User Details:`);
        console.log(`   Name: ${referredUser.user_name}`);
        console.log(`   Phone: ${referredUser.phone_no}`);
        console.log(`   Referral Code: ${referredUser.referral_code}`);
        
        if (!referredUser.referral_code) {
            throw new Error('This user has no referral code (not referred by anyone)');
        }
        
        // Find the referrer
        const referrer = await User.findOne({
            where: { referring_code: referredUser.referral_code }
        });
        
        if (!referrer) {
            throw new Error(`Referrer with code ${referredUser.referral_code} not found`);
        }
        
        console.log(`\n👤 Referrer Details (BEFORE RECHARGE):`);
        console.log(`   Name: ${referrer.user_name}`);
        console.log(`   ID: ${referrer.user_id}`);
        console.log(`   Direct Referral Count: ${referrer.direct_referral_count}`);
        console.log(`   Valid Referral Count: ${referrer.valid_referral_count}`);
        
        // Check current ValidReferral record
        let validReferral = null;
        if (ValidReferral) {
            validReferral = await ValidReferral.findOne({
                where: {
                    referrer_id: referrer.user_id,
                    referred_id: referredUserId
                }
            });
            
            if (validReferral) {
                console.log(`\n📊 Current ValidReferral Record:`);
                console.log(`   Total Recharge: ₹${validReferral.total_recharge}`);
                console.log(`   Is Valid: ${validReferral.is_valid}`);
                console.log(`   Created: ${validReferral.created_at}`);
                console.log(`   Updated: ${validReferral.updated_at}`);
            }
        }
        
        // Simulate recharge by calling updateReferralOnRecharge
        console.log(`\n💰 Simulating recharge of ₹${rechargeAmount}...`);
        
        const { updateReferralOnRecharge } = require('../services/referralService');
        const result = await updateReferralOnRecharge(referredUserId, rechargeAmount);
        
        console.log(`📋 Recharge result:`, result);
        
        // Check updated referrer details
        const updatedReferrer = await User.findByPk(referrer.user_id);
        console.log(`\n👤 Referrer Details (AFTER RECHARGE):`);
        console.log(`   Name: ${updatedReferrer.user_name}`);
        console.log(`   ID: ${updatedReferrer.user_id}`);
        console.log(`   Direct Referral Count: ${updatedReferrer.direct_referral_count}`);
        console.log(`   Valid Referral Count: ${updatedReferrer.valid_referral_count}`);
        
        // Check updated ValidReferral record
        if (ValidReferral) {
            const updatedValidReferral = await ValidReferral.findOne({
                where: {
                    referrer_id: referrer.user_id,
                    referred_id: referredUserId
                }
            });
            
            if (updatedValidReferral) {
                console.log(`\n📊 Updated ValidReferral Record:`);
                console.log(`   Total Recharge: ₹${updatedValidReferral.total_recharge}`);
                console.log(`   Is Valid: ${updatedValidReferral.is_valid}`);
                console.log(`   Created: ${updatedValidReferral.created_at}`);
                console.log(`   Updated: ${updatedValidReferral.updated_at}`);
            }
        }
        
        // Calculate expected values
        const previousTotalRecharge = validReferral ? parseFloat(validReferral.total_recharge) : 0;
        const newTotalRecharge = previousTotalRecharge + rechargeAmount;
        const wasValidBefore = validReferral ? validReferral.is_valid : false;
        const isNowValid = newTotalRecharge >= 300;
        const expectedValidCount = wasValidBefore ? referrer.valid_referral_count : 
                                  (isNowValid ? referrer.valid_referral_count + 1 : referrer.valid_referral_count);
        
        console.log(`\n📈 Expected vs Actual:`);
        console.log(`   Previous Total Recharge: ₹${previousTotalRecharge}`);
        console.log(`   New Total Recharge: ₹${newTotalRecharge}`);
        console.log(`   Was Valid Before: ${wasValidBefore}`);
        console.log(`   Is Valid Now: ${isNowValid}`);
        console.log(`   Expected Valid Count: ${expectedValidCount}`);
        console.log(`   Actual Valid Count: ${updatedReferrer.valid_referral_count}`);
        
        const validCountCorrect = updatedReferrer.valid_referral_count === expectedValidCount;
        console.log(`   ✅ Valid Count Correct: ${validCountCorrect ? 'YES' : 'NO'}`);
        
        return {
            success: true,
            validCountCorrect,
            before: {
                validReferralCount: referrer.valid_referral_count,
                totalRecharge: previousTotalRecharge,
                wasValid: wasValidBefore
            },
            after: {
                validReferralCount: updatedReferrer.valid_referral_count,
                totalRecharge: newTotalRecharge,
                isNowValid: isNowValid
            }
        };
        
    } catch (error) {
        console.error('💥 Error testing valid referral counting:', error);
        return {
            success: false,
            message: error.message
        };
    }
};

// Get command line arguments
const args = process.argv.slice(2);
const referredUserId = parseInt(args[0]);
const rechargeAmount = parseFloat(args[1]);

if (!referredUserId || !rechargeAmount) {
    console.log('Usage: node scripts/testValidReferralCounting.js <referredUserId> <rechargeAmount>');
    console.log('Example: node scripts/testValidReferralCounting.js 30 300');
    process.exit(1);
}

// Run the test if this script is executed directly
if (require.main === module) {
    testValidReferralCounting(referredUserId, rechargeAmount)
        .then(result => {
            console.log('\n🎉 Test completed!');
            console.log('Result:', result);
            process.exit(0);
        })
        .catch(error => {
            console.error('Test failed:', error);
            process.exit(1);
        });
}

module.exports = { testValidReferralCounting }; 