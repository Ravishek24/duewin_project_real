// File: Backend/scripts/updateReferralStatus.js

const { sequelize } = require('../config/db');
const { User, ReferralTree, ReferralCommission } = require('../models/index');
const { Op } = require('sequelize');

/**
 * Update valid referral status for all users
 */
async function updateValidReferrals() {
    try {
        console.log('Starting daily referral update job...');

        // Get all users with referral trees
        const users = await User.findAll({
            include: [{
                model: ReferralTree,
                required: true
            }]
        });

        console.log(`Found ${users.length} users with referral trees`);

        for (const user of users) {
            const referralTree = user.ReferralTree;
            if (!referralTree) continue;

            // Get all referred users up to 6 levels deep
            const referredUsers = await User.findAll({
                where: {
                    user_id: {
                        [Op.in]: [
                            referralTree.level1,
                            referralTree.level2,
                            referralTree.level3,
                            referralTree.level4,
                            referralTree.level5,
                            referralTree.level6
                        ].filter(id => id !== null)
                    }
                }
            });

            console.log(`Processing referrals for user ${user.user_id} with ${referredUsers.length} referred users`);

            // Process each referred user
            for (const referredUser of referredUsers) {
                const level = [
                    referralTree.level1,
                    referralTree.level2,
                    referralTree.level3,
                    referralTree.level4,
                    referralTree.level5,
                    referralTree.level6
                ].indexOf(referredUser.user_id) + 1;

                // Calculate commission based on level
                const commissionRate = getCommissionRate(level);
                const commissionAmount = calculateCommission(referredUser, commissionRate);

                if (commissionAmount > 0) {
                    // Create commission record with earned type
                    await ReferralCommission.create({
                        user_id: user.user_id,
                        referred_user_id: referredUser.user_id,
                        amount: commissionAmount,
                        type: 'earned',
                        status: 'pending'
                    });

                    // Create commission record with generated type
                    await ReferralCommission.create({
                        user_id: user.user_id,
                        referred_user_id: referredUser.user_id,
                        amount: commissionAmount,
                        type: 'generated',
                        status: 'pending'
                    });
                }
            }
        }

        console.log('Daily referral update job completed successfully');
    } catch (error) {
        console.error('Error in daily referral update job:', error);
        throw error;
    }
}

function getCommissionRate(level) {
    const rates = {
        1: 0.10, // 10% for level 1
        2: 0.05, // 5% for level 2
        3: 0.03, // 3% for level 3
        4: 0.02, // 2% for level 4
        5: 0.01, // 1% for level 5
        6: 0.005 // 0.5% for level 6
    };
    return rates[level] || 0;
}

function calculateCommission(referredUser, rate) {
    // Get user's total bets for the day
    const totalBets = referredUser.total_bets || 0;
    return totalBets * rate;
}

module.exports = {
    processDailyReferrals: updateValidReferrals
};

// Only run directly if this file is being executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    updateValidReferrals().then(() => {
        console.log('Valid referral update complete');
        process.exit(0);
    }).catch(error => {
        console.error('Error in referral update script:', error);
        process.exit(1);
    });
}