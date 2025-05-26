const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { verifyToken } = require('../utils/jwt');
const { Op } = require('sequelize');
const config = require('../config/config');

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
const auth = async (req, res, next) => {
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
        const decoded = jwt.verify(token, config.jwtSecret);
        const userId = decoded.userId;

        // Get user
        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check if user is blocked
        if (user.is_blocked) {
            return res.status(403).json({
                success: false,
                message: 'Account is blocked'
            });
        }

        // Attach user to request
        req.user = user;
        req.userId = userId;
        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Invalid token'
            });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token expired'
            });
        }
        res.status(500).json({
            success: false,
            message: 'Authentication failed'
        });
    }
};

// Admin auth middleware that verifies JWT token and admin role
const authenticateAdmin = async (req, res, next) => {
    try {
        await auth(req, res, () => {
            if (!req.user.is_admin) {
                return res.status(403).json({
                    success: false,
                    message: 'Admin access required'
                });
            }
            next();
        });
    } catch (error) {
        next(error);
    }
};

// Check if a user is an admin
const isAdmin = async (userId) => {
    try {
        const user = await User.findByPk(userId);
        return user && user.is_admin === true;
    } catch (error) {
        console.error('Error checking admin status:', error);
        return false;
    }
};

// Phone verification middleware
const requirePhoneVerification = async (req, res, next) => {
    try {
        if (!req.user.is_phone_verified) {
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
    authenticateAdmin,
    sqlInjectionProtection,
    getClientIp,
    requirePhoneVerification,
    isAdmin
}; 