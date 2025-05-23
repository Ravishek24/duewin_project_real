const bcrypt = require('bcryptjs');

/**
 * Hash a password
 * @param {string} password - Plain text password
 * @returns {Promise<string>} - Hashed password
 */
const hashPassword = async (password) => {
    try {
        const salt = await bcrypt.genSalt(10);
        return await bcrypt.hash(password, salt);
    } catch (error) {
        throw new Error('Error hashing password');
    }
};

/**
 * Compare a password with a hash
 * @param {string} password - Plain text password
 * @param {string} hash - Hashed password
 * @returns {Promise<boolean>} - Whether password matches hash
 */
const comparePassword = async (password, hash) => {
    try {
        return await bcrypt.compare(password, hash);
    } catch (error) {
        throw new Error('Error comparing passwords');
    }
};

/**
 * Generate a random password
 * @param {number} length - Length of password
 * @returns {string} - Random password
 */
const generateRandomPassword = (length = 12) => {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+';
    let password = '';
    
    // Ensure at least one of each required character type
    password += charset.match(/[A-Z]/)[0]; // Uppercase
    password += charset.match(/[a-z]/)[0]; // Lowercase
    password += charset.match(/[0-9]/)[0]; // Number
    password += charset.match(/[!@#$%^&*()_+]/)[0]; // Special character
    
    // Fill the rest randomly
    for (let i = password.length; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * charset.length);
        password += charset[randomIndex];
    }
    
    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
};

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {Object} - Validation result
 */
const validatePasswordStrength = (password) => {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
    
    const errors = [];
    
    if (password.length < minLength) {
        errors.push(`Password must be at least ${minLength} characters long`);
    }
    if (!hasUpperCase) {
        errors.push('Password must contain at least one uppercase letter');
    }
    if (!hasLowerCase) {
        errors.push('Password must contain at least one lowercase letter');
    }
    if (!hasNumbers) {
        errors.push('Password must contain at least one number');
    }
    if (!hasSpecialChar) {
        errors.push('Password must contain at least one special character');
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
};

module.exports = {
    hashPassword,
    comparePassword,
    generateRandomPassword,
    validatePasswordStrength
}; 