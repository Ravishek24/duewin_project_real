const crypto = require('crypto');

/**
 * Generates a random referral code
 * @returns {string} A random 8-character uppercase alphanumeric code
 */
const generateReferringCode = () => {
    return crypto.randomBytes(4).toString('hex').toUpperCase();
};

module.exports = {
    generateReferringCode
}; 