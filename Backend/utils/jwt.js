const jwt = require('jsonwebtoken');
const config = require('../config/config');

// Default JWT settings if config is missing
const DEFAULT_JWT_SECRET = 'default_jwt_secret_for_development_only';
const DEFAULT_JWT_REFRESH_SECRET = 'default_refresh_secret_for_development_only';
const DEFAULT_JWT_EXPIRATION = '1h';
const DEFAULT_JWT_REFRESH_EXPIRATION = '7d';

/**
 * Generate JWT token for user
 * @param {Object} user - User object
 * @returns {string} - JWT token
 */
const generateToken = (user) => {
    const payload = {
        userId: user.user_id,
        email: user.email,
        role: user.role || 'user'
    };

    const secret = config.jwtSecret || DEFAULT_JWT_SECRET;
    const expiration = config.jwtExpiration || DEFAULT_JWT_EXPIRATION;

    return jwt.sign(payload, secret, {
        expiresIn: expiration
    });
};

/**
 * Generate refresh token
 * @param {Object} user - User object
 * @returns {string} - Refresh token
 */
const generateRefreshToken = (user) => {
    const payload = {
        userId: user.user_id,
        tokenType: 'refresh'
    };

    const secret = config.jwtRefreshSecret || DEFAULT_JWT_REFRESH_SECRET;
    const expiration = config.jwtRefreshExpiration || DEFAULT_JWT_REFRESH_EXPIRATION;

    return jwt.sign(payload, secret, {
        expiresIn: expiration
    });
};

/**
 * Verify JWT token
 * @param {string} token - JWT token
 * @returns {Object} - Decoded token payload
 */
const verifyToken = (token) => {
    try {
        const secret = config.jwtSecret || DEFAULT_JWT_SECRET;
        return jwt.verify(token, secret);
    } catch (error) {
        throw new Error('Invalid token');
    }
};

/**
 * Verify refresh token
 * @param {string} token - Refresh token
 * @returns {Object} - Decoded token payload
 */
const verifyRefreshToken = (token) => {
    try {
        const secret = config.jwtRefreshSecret || DEFAULT_JWT_REFRESH_SECRET;
        return jwt.verify(token, secret);
    } catch (error) {
        throw new Error('Invalid refresh token');
    }
};

/**
 * Decode JWT token without verification
 * @param {string} token - JWT token
 * @returns {Object} - Decoded token payload
 */
const decodeToken = (token) => {
    try {
        return jwt.decode(token);
    } catch (error) {
        throw new Error('Invalid token format');
    }
};

module.exports = {
    generateToken,
    generateRefreshToken,
    verifyToken,
    verifyRefreshToken,
    decodeToken
}; 