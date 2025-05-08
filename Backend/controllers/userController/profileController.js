const { getUserProfile, updateUserProfile } = require('../../services/userServices');

// Controller to get user profile
const getProfileController = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const result = await getUserProfile(userId);
        
        if (result.success) {
            return res.status(200).json(result);
        } else {
            return res.status(404).json(result);
        }
    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error fetching profile.' 
        });
    }
};

// Controller to update user profile
const updateProfileController = async (req, res) => {
    const { user_name, phone_no } = req.body;
    const userId = req.user.user_id;

    try {
        const result = await updateUserProfile(userId, { user_name, phone_no });
        
        if (result.success) {
            return res.status(200).json(result);
        } else {
            return res.status(400).json(result);
        }
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error updating profile.' 
        });
    }
};

module.exports = {
    getProfileController,
    updateProfileController
};