// controllers/otpController.js
const otpService = require('../services/otpService');
const userService = require('../services/userServices');
const { validateRequest } = require('../utils/validationUtils');

/**
 * Controller to send OTP
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const sendOtpController = async (req, res) => {
    try {
        const { phone, purpose, countryCode } = req.body;

        if (!phone || !purpose) {
            return res.status(400).json({
                success: false,
                message: 'Phone number and purpose are required'
            });
        }

        // Validate purpose
        const validPurposes = ['bank_account', 'forgot_password'];
        if (!validPurposes.includes(purpose)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid purpose'
            });
        }

        // Ensure phone is in E.164 format for Prelude
        let formattedPhone = phone;
        if (!formattedPhone.startsWith('+')) {
            const cc = countryCode || '91';
            formattedPhone = `+${cc}${phone}`;
        }

        // Send OTP
        const result = await otpService.createOtpSession(formattedPhone, countryCode || '91', '', {}, purpose);

        if (!result.success) {
            return res.status(400).json(result);
        }

        return res.json(result);
    } catch (error) {
        console.error('Error in sendOtpController:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

/**
 * Controller to verify OTP
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const verifyOtpController = async (req, res) => {
    try {
        const { otp_session_id, phone, code } = req.body;

        if (!otp_session_id || !phone || !code) {
            return res.status(400).json({
                success: false,
                message: 'OTP session ID, phone, and code are required'
            });
        }

        // Ensure phone is in E.164 format
        let formattedPhone = phone;
        if (!formattedPhone.startsWith('+')) {
            formattedPhone = `+91${phone}`;
        }

        const result = await otpService.checkOtpSession(otp_session_id, formattedPhone, code);

        if (!result.success) {
            return res.status(400).json(result);
        }

        return res.json(result);
    } catch (error) {
        console.error('Error in verifyOtpController:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

/**
 * Controller to verify OTP for phone number update
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const verifyPhoneUpdateOtpController = async (req, res) => {
    try {
        const { otp_session_id, new_phone } = req.body;

        if (!otp_session_id || !new_phone) {
            return res.status(400).json({
                success: false,
                message: 'OTP session ID and new phone number are required'
            });
        }

        const result = await userService.verifyPhoneUpdateOtp(req.user.id, otp_session_id, new_phone);

        if (!result.success) {
            return res.status(400).json(result);
        }

        return res.json(result);
    } catch (error) {
        console.error('Error in verifyPhoneUpdateOtpController:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

/**
 * Controller to verify OTP for bank account operations
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const verifyBankAccountOtpController = async (req, res) => {
    try {
        const { otp_session_id } = req.body;

        if (!otp_session_id) {
            return res.status(400).json({
                success: false,
                message: 'OTP session ID is required'
            });
        }

        const result = await otpService.checkOtpSession(otp_session_id);

        if (!result.success) {
            return res.status(400).json(result);
        }

        return res.json(result);
    } catch (error) {
        console.error('Error in verifyBankAccountOtpController:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

/**
 * Controller to check OTP status
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const checkOtpStatusController = async (req, res) => {
    try {
        const { otp_session_id } = req.params;

        if (!otp_session_id) {
            return res.status(400).json({
                success: false,
                message: 'OTP session ID is required'
            });
        }

        const result = await otpService.checkOtpSession(otp_session_id);

        if (!result.success) {
            return res.status(400).json(result);
        }

        return res.json(result);
    } catch (error) {
        console.error('Error in checkOtpStatusController:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

module.exports = {
    sendOtpController,
    verifyOtpController,
    verifyPhoneUpdateOtpController,
    verifyBankAccountOtpController,
    checkOtpStatusController
};