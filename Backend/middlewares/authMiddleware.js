const jwt = require('jsonwebtoken');
const User = require('../models/User');
// REMOVED: const SystemConfig = require('../models/SystemConfig'); // This was causing the error
const dotenv = require('dotenv');
const config = require('../config/config');
const { verifyToken } = require('../utils/jwt');
const { Op } = require('sequelize');

dotenv.config();

// Use same DEFAULT_JWT_SECRET as in jwt.js to ensure consistency
const DEFAULT_JWT_SECRET = 'default_jwt_secret_for_development_only';

// SQL injection protection middleware
const sqlInjectionProtection = (req, res, next) => {
    // Basic SQL injection protection
    const sqlPattern = /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|TRUNCATE)\b)/i;
    const body = JSON.stringify(req.body);
    const query = JSON.stringify(req.query);
    const params = JSON.stringify(req.params);

    if (sqlPattern.test(body) || sqlPattern.test(query) || sqlPattern.test(params)) {
        return res.status(403).json({
            success: false,
            message: 'Invalid request'
        });
    }
    next();
};

// Get client IP address
const getClientIp = (req) => {
    const forwardedFor = req.headers['x-forwarded-for'];
    if (forwardedFor) {
        return forwardedFor.split(',')[0].trim();
    }
    return req.ip || req.connection.remoteAddress;
};

// Auth middleware that verifies JWT token
const auth = (req, res, next) => {
    try {
        // Get token from header
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'No token provided'
            });
        }

        // Verify token
        let decoded;
        try {
            decoded = jwt.verify(token, config.jwtSecret || DEFAULT_JWT_SECRET);
        } catch (jwtError) {
            if (jwtError.name === 'TokenExpiredError') {
                return res.status(401).json({
                    success: false,
                    message: 'Token expired'
                });
            }
            return res.status(401).json({
                success: false,
                message: 'Invalid token'
            });
        }

        // Get user ID from token
        const userId = decoded.userId || decoded.user_id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Invalid token format'
            });
        }

        // Set user ID in request
        req.userId = userId;
        req.user = { user_id: userId }; // Minimal user object

        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.status(500).json({
            success: false,
            message: 'Authentication failed'
        });
    }
};

// Admin auth middleware
const isAdmin = (req, res, next) => {
    try {
        if (!req.user || !req.user.is_admin) {
            return res.status(403).json({
                success: false,
                message: 'Admin access required'
            });
        }
        next();
    } catch (error) {
        next(error);
    }
};

// Phone verification middleware
const requirePhoneVerification = (req, res, next) => {
    try {
        if (!req.user || !req.user.is_phone_verified) {
            return res.status(403).json({
                success: false,
                message: 'Phone verification required'
            });
        }
        next();
    } catch (error) {
        console.error('Phone verification middleware error:', error);
        res.status(500).json({
            success: false,
            message: 'Phone verification check failed'
        });
    }
};

module.exports = { 
    auth,
    isAdmin,
    sqlInjectionProtection,
    getClientIp,
    requirePhoneVerification
};