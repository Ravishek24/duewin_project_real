// services/otpService.js
const Prelude = require('@prelude.so/sdk');
const dotenv = require('dotenv');
const { Op } = require('sequelize');
const OtpRequest = require('../models/OtpRequest');

dotenv.config();

// Prelude API configuration
const PRELUDE_API_KEY = process.env.PRELUDE_API_KEY;
const MAX_OTP_REQUESTS_PER_DAY = 4;

// Initialize Prelude client
const preludeClient = new Prelude({
  apiToken: PRELUDE_API_KEY,
});

/**
 * Generate a random 6-digit OTP (not used by Prelude, but kept for compatibility)
 * @returns {string} - 6-digit OTP
 */
const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Check if user or phone has exceeded OTP request limit
 * @param {number} userId - User ID (optional)
 * @param {string} phoneNo - Phone number (optional)
 * @returns {Object} - Result with limit status
 */
const checkOtpLimit = async (userId, phoneNo) => {
    try {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        let whereClause = {
            created_at: {
                [Op.gte]: twentyFourHoursAgo
            }
        };
        if (userId) {
            whereClause.user_id = userId;
        }
        if (phoneNo) {
            whereClause.phone_no = phoneNo;
        }
        const otpCount = await OtpRequest.count({
            where: whereClause
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
 * Create an OTP session for a user using Prelude Verify API
 * @param {string} mobileNo - User's mobile number (with country code, e.g. '+91xxxxxxxxxx')
 * @param {string} countryCode - Country code (e.g., '91' for India)
 * @param {string} userName - Name of the user
 * @param {Object} userData - Optional additional user data
 * @param {string} requestType - Type of OTP request (forgot_password, phone_update, bank_account)
 * @param {number} userId - User ID for limit checking
 * @returns {Object} - API response with OTP session details
 */
const createOtpSession = async (mobileNo, countryCode, userName, userData = {}, requestType, userId) => {
    try {
        // Prelude expects phone number in E.164 format (e.g., +911234567890)
        let phoneNumber = mobileNo;
        if (!phoneNumber.startsWith('+')) {
            phoneNumber = `+${countryCode}${mobileNo}`;
        }
        // Check OTP limit by userId or phone number
        const limitCheck = await checkOtpLimit(userId, phoneNumber);
        if (!limitCheck.canRequest) {
            return {
                success: false,
                message: `OTP limit exceeded. You can request OTP again after 24 hours.`
            };
        }
        // Send OTP via Prelude
        const verification = await preludeClient.verification.create({
            target: {
                type: 'phone_number',
                value: phoneNumber,
            },
            // Optionally, you can add dispatch_id or metadata here
        });
        // Create OTP request record if userId is provided
        if (userId) {
            await OtpRequest.create({
                user_id: userId,
                phone_no: phoneNumber,
                otp_session_id: verification.id,
                request_type: requestType,
                status: 'pending'
            });
        } else {
            await OtpRequest.create({
                phone_no: phoneNumber,
                otp_session_id: verification.id,
                request_type: requestType,
                status: 'pending'
            });
        }
        return {
            success: true,
            message: 'OTP sent successfully',
            otpSessionId: verification.id,
            remainingRequests: limitCheck.remainingRequests
        };
    } catch (error) {
        console.error('Error creating OTP session (Prelude):', error);
        return {
            success: false,
            message: error.message || 'Error sending OTP via Prelude'
        };
    }
};

/**
 * Check the status of an OTP session (verify the code) using Prelude Verify API
 * @param {string} otpSessionId - OTP session ID (verification.id from Prelude)
 * @param {string} phoneNumber - Phone number (E.164 format)
 * @param {string} code - The OTP code to verify
 * @returns {Object} - Session status and details
 */
const checkOtpSession = async (otpSessionId, phoneNumber, code) => {
    try {
        // Verify the code using Prelude
        const check = await preludeClient.verification.check({
            target: {
                type: 'phone_number',
                value: phoneNumber,
            },
            code: code,
        });

        // Update OTP request status if found
        await OtpRequest.update(
            { status: 'verified' },
            { where: { otp_session_id: otpSessionId } }
        );

        return {
            success: true,
            message: 'OTP verified successfully',
            verified: true,
            status: 'verified',
            phoneNumber: phoneNumber
        };
    } catch (error) {
        console.error('Error checking OTP session (Prelude):', error);
        return {
            success: false,
            message: error.message || 'Error verifying OTP via Prelude'
        };
    }
};

// Export all functions
module.exports = {
    generateOTP, // Kept for compatibility, not used by Prelude
    checkOtpLimit,
    createOtpSession,
    checkOtpSession
};