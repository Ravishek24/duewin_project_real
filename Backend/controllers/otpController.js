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
        const { phone, purpose } = req.body;

        if (!phone || !purpose) {
            return res.status(400).json({
                success: false,
                message: 'Phone number and purpose are required'
            });
        }

        // Validate purpose
        const validPurposes = ['registration', 'login', 'phone_update', 'bank_account', 'withdrawal'];
        if (!validPurposes.includes(purpose)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid purpose'
            });
        }

        // Send OTP
        const result = await otpService.createOtpSession(phone, '91', '', {}, purpose);

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