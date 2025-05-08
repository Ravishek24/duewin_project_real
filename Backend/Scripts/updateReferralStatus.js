// File: Backend/scripts/updateReferralStatus.js

const { sequelize } = require('../config/db');
const User = require('../models/User');
const ValidReferral = require('../models/ValidReferral');
const { updateInvitationTier } = require('../services/referralService');

/**
 * Update valid referral status for all users
 */
const updateReferralStatus = async () => {
    console.log('Starting valid referral status update...');

    try {
        // Connect to database
        await sequelize.authenticate();

        // Get all users
        const users = await User.findAll({
            attributes: ['user_id']
        });

        console.log(`Processing ${users.length} users for referral status updates...`);

        let updatedCount = 0;

        // Process each user
        for (const user of users) {
            // Count valid referrals
            const validReferralsCount = await ValidReferral.count({
                where: {
                    referrer_id: user.user_id,
                    is_valid: true
                }
            });

            // Update user if count doesn't match
            if (validReferralsCount !== user.valid_referral_count) {
                await User.update(
                    { valid_referral_count: validReferralsCount },
                    { where: { user_id: user.user_id } }
                );

                // Check if this change makes them eligible for a new tier
                await updateInvitationTier(user.user_id, validReferralsCount);

                updatedCount++;
            }
        }

        console.log(`Updated valid referral count for ${updatedCount} users`);
    } catch (error) {
        console.error('Error updating valid referrals:', error);
    }
};

// Run the update
updateReferralStatus().then(() => {
    console.log('Valid referral update complete');
    process.exit(0);
}).catch(error => {
    console.error('Error in referral update script:', error);
    process.exit(1);
});

module.exports = {
  updateReferralStatus
};