const { requestPasswordReset } = require('../../services/userServices');

const forgotPasswordController = async (req, res) => {
    const { phone_no } = req.body;

    // Validate phone_no
    if (!phone_no) {
        return res.status(400).json({ 
            success: false, 
            message: 'Phone number is required.' 
        });
    }

    try {
        // Request password reset
        const result = await requestPasswordReset(phone_no);
        // Always return success even if phone not found for security
        return res.status(200).json({ 
            success: true, 
            message: 'If your phone number is registered, you will receive password reset instructions shortly.',
            otpSessionId: result.otpSessionId || null,
            resetToken: result.resetToken || null
        });
    } catch (error) {
        console.error('Error in forgot password:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error processing your request.' 
        });
    }
};

module.exports = forgotPasswordController;