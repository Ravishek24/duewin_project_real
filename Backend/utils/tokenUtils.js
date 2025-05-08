const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config();

// Generate a random token for email verification or password reset
const generateToken = (length = 32) => {
    return crypto.randomBytes(length).toString('hex');
};

// Generate JWT token for authentication
const generateJWT = (userId, email, expiresIn = process.env.JWT_EXPIRES_IN || '24h') => {
    return jwt.sign(
        { id: userId, email: email },
        process.env.JWT_SECRET,
        { expiresIn }
    );
};

// Verify JWT token
const verifyJWT = (token) => {
    try {
        return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
        throw new Error('Invalid or expired token');
    }
};

module.exports = {
    generateToken,
    generateJWT,
    verifyJWT
};