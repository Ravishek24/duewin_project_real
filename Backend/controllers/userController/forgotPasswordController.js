const { requestPasswordReset } = require('../../services/userServices');

const forgotPasswordController = async (req, res) => {
    const { email } = req.body;

    // Validate email
    if (!email) {
        return res.status(400).json({ 
            success: false, 
            message: 'Email is required.' 
        });
    }

    try {
        // Request password reset
        const result = await requestPasswordReset(email);
        
        // Always return success even if email not found for security
        // The service will still return success:false, but we don't expose that to the client
        return res.status(200).json({ 
            success: true, 
            message: 'If your email is registered, you will receive password reset instructions shortly.' 
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