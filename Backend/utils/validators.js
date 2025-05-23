const { body, validationResult } = require('express-validator');

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} - Whether email is valid
 */
const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

/**
 * Validate phone number format
 * @param {string} phone - Phone number to validate
 * @returns {boolean} - Whether phone number is valid
 */
const isValidPhone = (phone) => {
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    return phoneRegex.test(phone);
};

/**
 * Validate username format
 * @param {string} username - Username to validate
 * @returns {boolean} - Whether username is valid
 */
const isValidUsername = (username) => {
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    return usernameRegex.test(username);
};

/**
 * Validate login input
 * @param {Object} data - Login data to validate
 * @returns {Object} - Validation result with error if any
 */
const validateLoginInput = (data) => {
    const errors = [];

    if (!data.phone_no) {
        errors.push('Phone number is required');
    } else if (!isValidPhone(data.phone_no)) {
        errors.push('Invalid phone number format');
    }

    if (!data.password) {
        errors.push('Password is required');
    }

    return {
        error: errors.length > 0 ? { message: errors.join(', ') } : null
    };
};

/**
 * Validate password format
 * @param {string} password - Password to validate
 * @returns {Object} - Validation result with errors array
 */
const validatePassword = (password) => {
    const errors = [];
    
    if (!password) {
        errors.push('Password is required');
        return { isValid: false, errors };
    }
    
    if (password.length < 8) {
        errors.push('Password must be at least 8 characters long');
    }
    
    if (!/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
    }
    
    if (!/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
    }
    
    if (!/\d/.test(password)) {
        errors.push('Password must contain at least one number');
    }
    
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        errors.push('Password must contain at least one special character');
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
};

/**
 * Validate amount format
 * @param {number|string} amount - Amount to validate
 * @returns {boolean} - Whether amount is valid
 */
const isValidAmount = (amount) => {
    const num = Number(amount);
    return !isNaN(num) && num > 0 && num <= 1000000;
};

/**
 * Validate date format (YYYY-MM-DD)
 * @param {string} date - Date to validate
 * @returns {boolean} - Whether date is valid
 */
const isValidDate = (date) => {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) return false;
    
    const d = new Date(date);
    return d instanceof Date && !isNaN(d);
};

/**
 * Validate time format (HH:mm:ss)
 * @param {string} time - Time to validate
 * @returns {boolean} - Whether time is valid
 */
const isValidTime = (time) => {
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/;
    return timeRegex.test(time);
};

/**
 * Validate IP address format
 * @param {string} ip - IP address to validate
 * @returns {boolean} - Whether IP address is valid
 */
const isValidIP = (ip) => {
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
};

/**
 * Validate URL format
 * @param {string} url - URL to validate
 * @returns {boolean} - Whether URL is valid
 */
const isValidURL = (url) => {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
};

/**
 * Sanitize input string
 * @param {string} input - Input to sanitize
 * @returns {string} - Sanitized input
 */
const sanitizeInput = (input) => {
    if (typeof input !== 'string') return input;
    return input
        .replace(/[<>]/g, '') // Remove < and >
        .replace(/javascript:/gi, '') // Remove javascript: protocol
        .trim();
};

/**
 * Validate registration input
 * @param {Object} data - Registration data to validate
 * @returns {Object} - Validation result with error if any
 */
const validateRegistrationInput = (data) => {
    const errors = [];

    if (!data.phone_no) {
        errors.push('Phone number is required');
    } else if (!isValidPhone(data.phone_no)) {
        errors.push('Invalid phone number format');
    }

    if (!data.password) {
        errors.push('Password is required');
    } else {
        const passwordValidation = validatePassword(data.password);
        if (!passwordValidation.isValid) {
            errors.push(...passwordValidation.errors);
        }
    }

    if (data.email && !isValidEmail(data.email)) {
        errors.push('Invalid email format');
    }

    if (!data.user_name) {
        errors.push('Username is required');
    } else if (!isValidUsername(data.user_name)) {
        errors.push('Invalid username format');
    }

    return {
        error: errors.length > 0 ? { message: errors.join(', ') } : null
    };
};

module.exports = {
    isValidEmail,
    isValidPhone,
    isValidUsername,
    validatePassword,
    isValidAmount,
    isValidDate,
    isValidTime,
    isValidIP,
    isValidURL,
    sanitizeInput,
    validateLoginInput,
    validateRegistrationInput
}; 