const { ERROR_MESSAGES } = require('../config/constants');

/**
 * Validates a phone number format
 * @param {string} phone - Phone number to validate
 * @returns {boolean} - True if valid, false otherwise
 */
const isValidPhoneNumber = (phone) => {
    // Indian phone number format: +91 followed by 10 digits
    const phoneRegex = /^\+91[6-9]\d{9}$/;
    return phoneRegex.test(phone);
};

/**
 * Validates an email address format
 * @param {string} email - Email address to validate
 * @returns {boolean} - True if valid, false otherwise
 */
const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

/**
 * Validates a password strength
 * @param {string} password - Password to validate
 * @returns {boolean} - True if valid, false otherwise
 */
const isValidPassword = (password) => {
    // At least 8 characters, 1 uppercase, 1 lowercase, 1 number, 1 special character
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return passwordRegex.test(password);
};

/**
 * Validates an OTP format
 * @param {string} otp - OTP to validate
 * @returns {boolean} - True if valid, false otherwise
 */
const isValidOTP = (otp) => {
    // 6 digit numeric OTP
    const otpRegex = /^\d{6}$/;
    return otpRegex.test(otp);
};

/**
 * Validates a bank account number
 * @param {string} accountNumber - Bank account number to validate
 * @returns {boolean} - True if valid, false otherwise
 */
const isValidBankAccount = (accountNumber) => {
    // 9-18 digit numeric account number
    const accountRegex = /^\d{9,18}$/;
    return accountRegex.test(accountNumber);
};

/**
 * Validates an IFSC code
 * @param {string} ifsc - IFSC code to validate
 * @returns {boolean} - True if valid, false otherwise
 */
const isValidIFSC = (ifsc) => {
    // 11 character alphanumeric IFSC code
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    return ifscRegex.test(ifsc);
};

/**
 * Validates a UPI ID
 * @param {string} upiId - UPI ID to validate
 * @returns {boolean} - True if valid, false otherwise
 */
const isValidUPI = (upiId) => {
    // UPI ID format: username@bank
    const upiRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z]{3,}$/;
    return upiRegex.test(upiId);
};

/**
 * Validates a transaction amount
 * @param {number} amount - Amount to validate
 * @returns {boolean} - True if valid, false otherwise
 */
const isValidAmount = (amount) => {
    return !isNaN(amount) && amount > 0 && amount <= 1000000; // Max 10 lakhs
};

/**
 * Validates a game bet amount
 * @param {number} amount - Bet amount to validate
 * @returns {boolean} - True if valid, false otherwise
 */
const isValidBetAmount = (amount) => {
    return !isNaN(amount) && amount >= 1 && amount <= 50000; // Min 1, Max 50000
};

/**
 * Validates a game type
 * @param {string} gameType - Game type to validate
 * @returns {boolean} - True if valid, false otherwise
 */
const isValidGameType = (gameType) => {
    const validTypes = ['crash', 'dice', 'slots'];
    return validTypes.includes(gameType.toLowerCase());
};

/**
 * Validates a payment gateway
 * @param {string} gateway - Payment gateway to validate
 * @returns {boolean} - True if valid, false otherwise
 */
const isValidPaymentGateway = (gateway) => {
    const validGateways = ['WEPAY', 'MXPAY', 'OKPAY'];
    return validGateways.includes(gateway.toUpperCase());
};

/**
 * Validates a transaction type
 * @param {string} type - Transaction type to validate
 * @returns {boolean} - True if valid, false otherwise
 */
const isValidTransactionType = (type) => {
    const validTypes = ['deposit', 'withdrawal', 'bet', 'win', 'refund', 'bonus'];
    return validTypes.includes(type.toLowerCase());
};

/**
 * Validates a transaction status
 * @param {string} status - Transaction status to validate
 * @returns {boolean} - True if valid, false otherwise
 */
const isValidTransactionStatus = (status) => {
    const validStatuses = ['pending', 'completed', 'failed', 'cancelled'];
    return validStatuses.includes(status.toLowerCase());
};

/**
 * Validates a date range
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {boolean} - True if valid, false otherwise
 */
const isValidDateRange = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return start <= end && end <= new Date();
};

/**
 * Validates pagination parameters
 * @param {number} page - Page number
 * @param {number} limit - Items per page
 * @returns {boolean} - True if valid, false otherwise
 */
const isValidPagination = (page, limit) => {
    return !isNaN(page) && page > 0 && !isNaN(limit) && limit > 0 && limit <= 100;
};

module.exports = {
    isValidPhoneNumber,
    isValidEmail,
    isValidPassword,
    isValidOTP,
    isValidBankAccount,
    isValidIFSC,
    isValidUPI,
    isValidAmount,
    isValidBetAmount,
    isValidGameType,
    isValidPaymentGateway,
    isValidTransactionType,
    isValidTransactionStatus,
    isValidDateRange,
    isValidPagination
}; 