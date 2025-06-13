const { getUserProfile, updateUserProfile } = require('../../services/userServices');
const { verifyEmailToken } = require('../../services/emailService');

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
    const { user_name, phone_no, email } = req.body;
    const userId = req.user.user_id;

    try {
        const result = await updateUserProfile(userId, { user_name, phone_no, email });
        
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

// Controller to verify email
const verifyEmailController = async (req, res) => {
    const { token } = req.query;

    if (!token) {
        return res.status(400).json({
            success: false,
            message: 'Verification token is required'
        });
    }

    try {
        const result = await verifyEmailToken(token);
        
        if (result.success) {
            return res.status(200).json(result);
        } else {
            return res.status(400).json(result);
        }
    } catch (error) {
        console.error('Error verifying email:', error);
        res.status(500).json({
            success: false,
            message: 'Server error verifying email'
        });
    }
};

module.exports = {
    getProfileController,
    updateProfileController,
    verifyEmailController
};