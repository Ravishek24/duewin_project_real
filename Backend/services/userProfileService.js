// Backend/services/userProfileService.js
const User = require('../models/User');

/**
 * Available profile picture IDs (you can extend this list)
 */
const AVAILABLE_PROFILE_PICTURES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/**
 * Update user's profile picture
 */
const updateProfilePicture = async (userId, profilePictureId) => {
    try {
        console.log(`🖼️ Updating profile picture for user ${userId} to ID ${profilePictureId}`);

        // Validate profile picture ID
        const pictureId = parseInt(profilePictureId);
        if (!AVAILABLE_PROFILE_PICTURES.includes(pictureId)) {
            return {
                success: false,
                message: `Invalid profile picture ID. Available IDs: ${AVAILABLE_PROFILE_PICTURES.join(', ')}`
            };
        }

        // Update user's profile picture
        const [updatedRows] = await User.update(
            { profile_picture_id: pictureId },
            { where: { user_id: userId } }
        );

        if (updatedRows === 0) {
            return {
                success: false,
                message: 'User not found'
            };
        }

        return {
            success: true,
            message: 'Profile picture updated successfully',
            profilePictureId: pictureId
        };

    } catch (error) {
        console.error('❌ Error updating profile picture:', error);
        return {
            success: false,
            message: 'Error updating profile picture: ' + error.message
        };
    }
};

/**
 * Get user's current profile picture
 */
const getUserProfilePicture = async (userId) => {
    try {
        const user = await User.findByPk(userId, {
            attributes: ['user_id', 'profile_picture_id']
        });

        if (!user) {
            return {
                success: false,
                message: 'User not found'
            };
        }

        return {
            success: true,
            profilePictureId: user.profile_picture_id,
            availablePictures: AVAILABLE_PROFILE_PICTURES
        };

    } catch (error) {
        console.error('❌ Error getting profile picture:', error);
        return {
            success: false,
            message: 'Error getting profile picture: ' + error.message
        };
    }
};

module.exports = {
    updateProfilePicture,
    getUserProfilePicture,
    AVAILABLE_PROFILE_PICTURES
};