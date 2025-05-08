// services/otpService.js
const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

// ReverseOTP API configuration
const OTP_API_URL = 'https://app.reverseotp.com/api/v1';
const OTP_API_KEY = process.env.REVERSE_OTP_API_KEY;
const OTP_API_SECRET = process.env.REVERSE_OTP_SECRET;

/**
 * Create an OTP session for a user
 * @param {string} mobileNo - User's mobile number without country code
 * @param {string} countryCode - Country code (e.g., '91' for India)
 * @param {string} userName - Name of the user
 * @param {Object} userData - Optional additional user data (udf1, udf2, udf3)
 * @returns {Object} - API response with OTP session details
 */
const createOtpSession = async (mobileNo, countryCode, userName, userData = {}) => {
  try {
    const { udf1 = '', udf2 = '', udf3 = '' } = userData;
    
    const requestData = {
      mobile_no: mobileNo,
      country_code: countryCode,
      user_name: userName,
      api_key: OTP_API_KEY,
      secret: OTP_API_SECRET,
      udf1, 
      udf2, 
      udf3,
      // You can customize the OTP delivery methods if needed
      // type: ['sms', 'whatsapp'], 
    };
    
    const response = await axios.post(
      `${OTP_API_URL}/create_otp_session`,
      requestData
    );
    
    if (response.data.status === 'success') {
      return {
        success: true,
        message: response.data.message,
        otpSessionId: response.data.data.otp_session_id,
        primaryDetails: response.data.data.primary,
        secondaryDetails: response.data.data.secondary,
        frontendToken: response.data.data.frontend_token
      };
    } else {
      return {
        success: false,
        message: response.data.message || 'Failed to create OTP session'
      };
    }
  } catch (error) {
    console.error('Error creating OTP session:', error);
    return {
      success: false,
      message: error.response?.data?.message || 'Error creating OTP session'
    };
  }
};

/**
 * Check the status of an OTP session
 * @param {number} otpSessionId - OTP session ID
 * @returns {Object} - Session status and details
 */
const checkOtpSession = async (otpSessionId) => {
  try {
    const requestData = {
      api_key: OTP_API_KEY,
      secret: OTP_API_SECRET,
      otp_session_id: otpSessionId
    };
    
    const response = await axios.post(
      `${OTP_API_URL}/check_otp_session`,
      requestData
    );
    
    if (response.data.status === 'success') {
      // Return verification status
      return {
        success: true,
        message: response.data.message,
        verified: response.data.data.status === 'verified',
        status: response.data.data.status,
        mobileNo: response.data.data.mobile_no,
        userData: {
          udf1: response.data.data.udf1,
          udf2: response.data.data.udf2,
          udf3: response.data.data.udf3
        }
      };
    } else {
      return {
        success: false,
        message: response.data.message || 'Failed to check OTP session'
      };
    }
  } catch (error) {
    console.error('Error checking OTP session:', error);
    return {
      success: false,
      message: error.response?.data?.message || 'Error checking OTP session'
    };
  }
};

module.exports = {
  createOtpSession,
  checkOtpSession
};