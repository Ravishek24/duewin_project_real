const otpService = require('../../services/otpService');
const User = require('../../models/User');
const jwt = require('jsonwebtoken');

/**
 * Send OTP for admin login
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const sendAdminOtpController = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }

        // Find admin user
        const admin = await User.findOne({
            where: {
                email: email,
                is_admin: true
            }
        });

        if (!admin) {
            return res.status(404).json({
                success: false,
                message: 'Admin not found'
            });
        }

        // Send OTP
        const result = await otpService.createOtpSession(
            admin.phone_no,
            '91', // Default to India
            admin.user_name,
            { udf1: admin.email },
            'admin_login',
            admin.user_id
        );

        if (!result.success) {
            return res.status(400).json(result);
        }

        return res.json({
            success: true,
            message: 'OTP sent successfully',
            otpSessionId: result.otpSessionId
        });
    } catch (error) {
        console.error('Error in sendAdminOtpController:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

/**
 * Verify OTP for admin login
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const verifyAdminOtpController = async (req, res) => {
    try {
        const { email, otp_session_id } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }

        // Find admin user
        const admin = await User.findOne({
            where: {
                email: email,
                is_admin: true
            }
        });

        if (!admin) {
            return res.status(404).json({
                success: false,
                message: 'Admin not found'
            });
        }

        // BYPASS OTP VERIFICATION FOR TESTING
        // Skip OTP verification and proceed with login
        console.log('⚠️ WARNING: OTP verification bypassed for testing purposes');

        // Generate JWT token
        const token = jwt.sign(
            { 
                user_id: admin.user_id,
                is_admin: true
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Remove sensitive data
        const adminData = admin.toJSON();
        delete adminData.password;

        return res.json({
            success: true,
            message: 'Login successful (OTP bypassed for testing)',
            data: {
                token,
                user: adminData
            }
        });
    } catch (error) {
        console.error('Error in verifyAdminOtpController:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

module.exports = {
    sendAdminOtpController,
    verifyAdminOtpController
}; 