// services/otpService.js
const axios = require('axios');
const dotenv = require('dotenv');
const { Op } = require('sequelize');
const OtpRequest = require('../models/OtpRequest');

dotenv.config();

// Fast2SMS API configuration
const FAST2SMS_API_URL = 'https://www.fast2sms.com/dev/bulkV2';
const FAST2SMS_API_KEY = process.env.FAST2SMS_API_KEY;
const MAX_OTP_REQUESTS_PER_DAY = 4;

/**
 * Generate a random 6-digit OTP
 * @returns {string} - 6-digit OTP
 */
const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Check if user has exceeded OTP request limit
 * @param {number} userId - User ID
 * @returns {Object} - Result with limit status
 */
const checkOtpLimit = async (userId) => {
    try {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        
        const otpCount = await OtpRequest.count({
            where: {
                user_id: userId,
                created_at: {
                    [Op.gte]: twentyFourHoursAgo
                }
            }
        });

        return {
            canRequest: otpCount < MAX_OTP_REQUESTS_PER_DAY,
            remainingRequests: MAX_OTP_REQUESTS_PER_DAY - otpCount
        };
    } catch (error) {
        console.error('Error checking OTP limit:', error);
        return {
            canRequest: false,
            remainingRequests: 0
        };
    }
};

/**
 * Create an OTP session for a user
 * @param {string} mobileNo - User's mobile number without country code
 * @param {string} countryCode - Country code (e.g., '91' for India)
 * @param {string} userName - Name of the user
 * @param {Object} userData - Optional additional user data
 * @param {string} requestType - Type of OTP request (forgot_password, phone_update, bank_account)
 * @param {number} userId - User ID for limit checking
 * @returns {Object} - API response with OTP session details
 */
const createOtpSession = async (mobileNo, countryCode, userName, userData = {}, requestType, userId) => {
    try {
        // Check OTP limit if userId is provided
        if (userId) {
            const limitCheck = await checkOtpLimit(userId);
            if (!limitCheck.canRequest) {
                return {
                    success: false,
                    message: `OTP limit exceeded. You can request OTP again after 24 hours.`
                };
            }
        }

        // Generate OTP
        const otp = generateOTP();
        
        // Prepare request data for Fast2SMS
        const requestData = {
            authorization: FAST2SMS_API_KEY,
            variables_values: otp,
            route: 'otp',
            numbers: mobileNo
        };
        
        // Send OTP via Fast2SMS
        const response = await axios.get(FAST2SMS_API_URL, {
            params: requestData
        });
        
        if (response.data.return === true) {
            // Create OTP request record if userId is provided
            if (userId) {
                await OtpRequest.create({
                    user_id: userId,
                    phone_no: mobileNo,
                    otp_session_id: response.data.request_id,
                    request_type: requestType,
                    status: 'pending'
                });
            }

            return {
                success: true,
                message: 'OTP sent successfully',
                otpSessionId: response.data.request_id,
                remainingRequests: userId ? (await checkOtpLimit(userId)).remainingRequests : null
            };
        } else {
            return {
                success: false,
                message: response.data.message?.[0] || 'Failed to send OTP'
            };
        }
    } catch (error) {
        console.error('Error creating OTP session:', error);
        return {
            success: false,
            message: error.response?.data?.message?.[0] || 'Error sending OTP'
        };
    }
};

/**
 * Check the status of an OTP session
 * @param {string} otpSessionId - OTP session ID
 * @returns {Object} - Session status and details
 */
const checkOtpSession = async (otpSessionId) => {
    try {
        // Find the OTP request
        const otpRequest = await OtpRequest.findOne({
            where: { otp_session_id: otpSessionId }
        });

        if (!otpRequest) {
            return {
                success: false,
                message: 'OTP session not found'
            };
        }

        // Update OTP request status
        await OtpRequest.update(
            { status: 'verified' },
            { where: { otp_session_id: otpSessionId } }
        );

        return {
            success: true,
            message: 'OTP verified successfully',
            verified: true,
            status: 'verified',
            mobileNo: otpRequest.phone_no
        };
    } catch (error) {
        console.error('Error checking OTP session:', error);
        return {
            success: false,
            message: 'Error verifying OTP'
        };
    }
};

module.exports = {
    createOtpSession,
    checkOtpSession,
    checkOtpLimit
};