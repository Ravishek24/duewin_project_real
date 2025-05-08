const { verifyEmail, resendVerificationEmail } = require('../../services/userServices');

// Controller to verify email
const verifyEmailController = async (req, res) => {
    const { token } = req.params;

    if (!token) {
        return res.status(400).json({ 
            success: false, 
            message: 'Verification token is required.' 
        });
    }

    try {
        const result = await verifyEmail(token);
        
        if (result.success) {
            return res.status(200).json(result);
        } else {
            return res.status(400).json(result);
        }
    } catch (error) {
        console.error('Error verifying email:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error verifying email.' 
        });
    }
};

// Controller to resend verification email
const resendVerificationController = async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ 
            success: false, 
            message: 'Email is required.' 
        });
    }

    try {
        const result = await resendVerificationEmail(email);
        
        if (result.success) {
            return res.status(200).json(result);
        } else {
            return res.status(400).json(result);
        }
    } catch (error) {
        console.error('Error resending verification email:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error resending verification email.' 
        });
    }
};

module.exports = {
    verifyEmailController,
    resendVerificationController
};