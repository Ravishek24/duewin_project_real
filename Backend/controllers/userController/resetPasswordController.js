const { validateResetToken, resetPassword } = require('../../services/userServices');

// Controller to validate reset token
const validateTokenController = async (req, res) => {
    const { token } = req.params;

    if (!token) {
        return res.status(400).json({ 
            success: false, 
            message: 'Token is required.' 
        });
    }

    try {
        const result = await validateResetToken(token);
        
        if (result.success) {
            return res.status(200).json(result);
        } else {
            return res.status(400).json(result);
        }
    } catch (error) {
        console.error('Error validating token:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error validating token.' 
        });
    }
};

// Controller to reset password
const resetPasswordController = async (req, res) => {
    const { token, password } = req.body;

    // Validate input
    if (!token || !password) {
        return res.status(400).json({ 
            success: false, 
            message: 'Token and new password are required.' 
        });
    }

    // Validate password strength
    if (password.length < 6) {
        return res.status(400).json({ 
            success: false, 
            message: 'Password must be at least 6 characters long.' 
        });
    }

    try {
        const result = await resetPassword(token, password);
        
        if (result.success) {
            return res.status(200).json(result);
        } else {
            return res.status(400).json(result);
        }
    } catch (error) {
        console.error('Error resetting password:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error resetting password.' 
        });
    }
};

module.exports = {
    validateTokenController,
    resetPasswordController
};