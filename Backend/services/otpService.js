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
        console.log(`🔐 Creating OTP session for: ${mobileNo}, type: ${requestType}, userId: ${userId || 'none'}`);
        
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
        // Create OTP request record
        const otpRequestData = {
            phone_no: phoneNumber,
            otp_session_id: verification.id,
            request_type: requestType,
            status: 'pending'
        };

        // Add user_id if provided
        if (userId) {
            otpRequestData.user_id = userId;
        }

        console.log(`📝 Creating OTP request with data:`, otpRequestData);
        
        await OtpRequest.create(otpRequestData);
        
        console.log(`✅ OTP session created successfully with ID: ${verification.id}`);
        
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
 * Verify an OTP code using Prelude Verify API
 * @param {string} otpSessionId - OTP session ID (verification.id from Prelude)
 * @param {string} phoneNumber - Phone number (E.164 format)
 * @param {string} code - The OTP code to verify
 * @returns {Object} - Verification result
 */
const verifyOtpCode = async (otpSessionId, phoneNumber, code) => {
    try {
        console.log(`🔐 Verifying OTP: session=${otpSessionId}, phone=${phoneNumber}, code=${code}`);
        
        // Verify the code using Prelude
        const check = await preludeClient.verification.check({
            target: {
                type: 'phone_number',
                value: phoneNumber,
            },
            code: code,
        });

        console.log(`📱 Prelude verification response:`, check);

        // Check if verification was successful
        if (check && check.status === 'approved') {
            // ✅ OTP is correct - update status to verified
            await OtpRequest.update(
                { status: 'verified' },
                { where: { otp_session_id: otpSessionId } }
            );

            console.log(`✅ OTP verified successfully for session: ${otpSessionId}`);
            
            return {
                success: true,
                message: 'OTP verified successfully',
                verified: true,
                status: 'verified',
                phoneNumber: phoneNumber,
                verificationDetails: check
            };
        } else {
            // ❌ OTP is incorrect or verification failed
            console.log(`❌ OTP verification failed for session: ${otpSessionId}. Status: ${check?.status}`);
            
            // Update OTP request status to failed
            await OtpRequest.update(
                { status: 'failed' },
                { where: { otp_session_id: otpSessionId } }
            );

            return {
                success: false,
                message: 'Invalid OTP code. Please try again.',
                verified: false,
                status: 'failed',
                phoneNumber: phoneNumber,
                verificationDetails: check
            };
        }
    } catch (error) {
        console.error('❌ Error verifying OTP code (Prelude):', error);
        
        // Update OTP request status to failed on error
        try {
            await OtpRequest.update(
                { status: 'failed' },
                { where: { otp_session_id: otpSessionId } }
            );
        } catch (updateError) {
            console.error('Failed to update OTP status on error:', updateError);
        }
        
        return {
            success: false,
            message: 'OTP verification failed. Please try again.',
            verified: false,
            status: 'failed',
            phoneNumber: phoneNumber,
            error: error.message
        };
    }
};

/**
 * Check the status of an OTP session (without verifying code)
 * @param {string} otpSessionId - OTP session ID (verification.id from Prelude)
 * @returns {Object} - Session status details
 */
const checkOtpSession = async (otpSessionId) => {
    try {
        console.log(`📱 Checking OTP session status: ${otpSessionId}`);
        
        // Get OTP request from database
        const otpRequest = await OtpRequest.findOne({
            where: { otp_session_id: otpSessionId }
        });

        if (!otpRequest) {
            return {
                success: false,
                message: 'OTP session not found',
                verified: false,
                status: 'not_found'
            };
        }

        console.log(`📱 OTP session status: ${otpRequest.status}`);
        
        return {
            success: true,
            message: 'OTP session status retrieved',
            verified: otpRequest.status === 'verified',
            status: otpRequest.status,
            phoneNumber: otpRequest.phone_no,
            requestType: otpRequest.request_type,
            createdAt: otpRequest.created_at
        };
    } catch (error) {
        console.error('❌ Error checking OTP session status:', error);
        
        return {
            success: false,
            message: 'Failed to check OTP session status',
            verified: false,
            status: 'error',
            error: error.message
        };
    }
};

// Export all functions
module.exports = {
    generateOTP, // Kept for compatibility, not used by Prelude
    checkOtpLimit,
    createOtpSession,
    verifyOtpCode, // 🆕 NEW: For actual OTP verification
    checkOtpSession // 🆕 UPDATED: For checking session status only
};
