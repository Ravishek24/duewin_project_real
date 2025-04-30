// controllers/otpController.js
import { verifyPhoneOtp, resendPhoneOtp, verifyPhoneUpdateOtp } from '../services/userServices.js';
import otpService from '../services/otpService.js';

/**
 * Controller to verify OTP after registration
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const verifyOtpController = async (req, res) => {
    try {
        const { otp_session_id } = req.body;
        const userId = req.user.user_id;
        
        if (!otp_session_id) {
            return res.status(400).json({
                success: false,
                message: 'OTP session ID is required'
            });
        }
        
        const result = await verifyPhoneOtp(userId, otp_session_id);
        
        if (result.success) {
            return res.status(200).json(result);
        } else {
            return res.status(400).json(result);
        }
    } catch (error) {
        console.error('Error verifying OTP:', error);
        res.status(500).json({
            success: false,
            message: 'Server error verifying OTP'
        });
    }
};

/**
 * Controller to resend OTP
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const resendOtpController = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const result = await resendPhoneOtp(userId);
        
        if (result.success) {
            return res.status(200).json(result);
        } else {
            return res.status(400).json(result);
        }
    } catch (error) {
        console.error('Error resending OTP:', error);
        res.status(500).json({
            success: false,
            message: 'Server error resending OTP'
        });
    }
};

/**
 * Controller to verify OTP for phone number update
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const verifyPhoneUpdateOtpController = async (req, res) => {
    try {
        const { otp_session_id, new_phone } = req.body;
        const userId = req.user.user_id;
        
        if (!otp_session_id || !new_phone) {
            return res.status(400).json({
                success: false,
                message: 'OTP session ID and new phone number are required'
            });
        }
        
        const result = await verifyPhoneUpdateOtp(userId, otp_session_id, new_phone);
        
        if (result.success) {
            return res.status(200).json(result);
        } else {
            return res.status(400).json(result);
        }
    } catch (error) {
        console.error('Error verifying phone update OTP:', error);
        res.status(500).json({
            success: false,
            message: 'Server error verifying phone update OTP'
        });
    }
};

/**
 * Controller to handle webhook callbacks from ReverseOTP API
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const otpWebhookController = async (req, res) => {
    try {
        const webhookData = req.body;
        
        console.log('OTP Webhook received:', webhookData);
        
        // Process webhook data (update user verification status, etc.)
        // This depends on the exact format of the webhook data
        
        // Send success response to acknowledge receipt
        return res.status(200).json({
            success: true,
            message: 'Webhook received successfully'
        });
    } catch (error) {
        console.error('Error processing OTP webhook:', error);
        res.status(500).json({
            success: false,
            message: 'Server error processing webhook'
        });
    }
};

/**
 * Controller to check OTP session status manually
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const checkOtpStatusController = async (req, res) => {
    try {
        const { otp_session_id } = req.params;
        
        if (!otp_session_id) {
            return res.status(400).json({
                success: false,
                message: 'OTP session ID is required'
            });
        }
        
        const result = await otpService.checkOtpSession(otp_session_id);
        
        if (result.success) {
            return res.status(200).json(result);
        } else {
            return res.status(400).json(result);
        }
    } catch (error) {
        console.error('Error checking OTP status:', error);
        res.status(500).json({
            success: false,
            message: 'Server error checking OTP status'
        });
    }
};

export default {
    verifyOtpController,
    resendOtpController,
    verifyPhoneUpdateOtpController,
    otpWebhookController,
    checkOtpStatusController
};