const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const config = require('../config/config');
const { verifyToken } = require('../utils/jwt');
const { Op } = require('sequelize');

dotenv.config();

const DEFAULT_JWT_SECRET = 'default_jwt_secret_for_development_only';

const sqlInjectionProtection = (req, res, next) => {
    const sqlPattern = /((SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|TRUNCATE)\b)/i;
    const body = JSON.stringify(req.body);
    const query = JSON.stringify(req.query);
    const params = JSON.stringify(req.params);
    if (sqlPattern.test(body) || sqlPattern.test(query) || sqlPattern.test(params)) {
        return res.status(403).json({ success: false, message: 'Invalid request' });
    }
    next();
};

const getClientIp = (req) => {
    const forwardedFor = req.headers['x-forwarded-for'];
    if (forwardedFor) {
        return forwardedFor.split(',')[0].trim();
    }
    return req.ip || req.connection.remoteAddress;
};

function createAuthMiddleware(sessionService, User) {
    // Auth middleware that verifies JWT token and session
    const auth = async (req, res, next) => {
        try {
            const token = req.header('Authorization')?.replace('Bearer ', '');
            if (!token) {
                return res.status(401).json({ success: false, message: 'No token provided' });
            }
            let decoded;
            try {
                decoded = jwt.verify(token, config.jwtSecret || DEFAULT_JWT_SECRET);
            } catch (jwtError) {
                if (jwtError.name === 'TokenExpiredError') {
                    return res.status(401).json({ success: false, message: 'Token expired' });
                }
                return res.status(401).json({ success: false, message: 'Invalid token' });
            }
            const userId = decoded.userId || decoded.user_id;
            if (!userId) {
                return res.status(401).json({ success: false, message: 'Invalid token format' });
            }
            // Extract session token from JWT payload for validation
            const sessionToken = decoded.sessionToken;
            if (!sessionToken) {
                return res.status(401).json({ success: false, message: 'Invalid session token' });
            }
            const sessionValidation = await sessionService.validateSession(sessionToken, req);
            if (!sessionValidation.valid) {
                return res.status(401).json({ success: false, message: 'Session invalid or logged in from another device', reason: sessionValidation.reason });
            }
            const user = await User.findByPk(userId);
            if (!user) {
                return res.status(401).json({ success: false, message: 'User not found' });
            }
            if (user.is_blocked) {
                return res.status(403).json({ success: false, message: 'Account is blocked' });
            }
            req.userId = userId;
            req.user = user;
            req.session = sessionValidation.session;
            next();
        } catch (error) {
            console.error('Auth middleware error:', error);
            res.status(500).json({ success: false, message: 'Authentication failed' });
        }
    };

    const isAdmin = (req, res, next) => {
        try {
            if (!req.user || !req.user.is_admin) {
                return res.status(403).json({ success: false, message: 'Admin access required' });
            }
            next();
        } catch (error) {
            next(error);
        }
    };

    const requirePhoneVerification = (req, res, next) => {
        try {
            if (!req.user || !req.user.is_phone_verified) {
                return res.status(403).json({ success: false, message: 'Phone verification required' });
            }
            next();
        } catch (error) {
            console.error('Phone verification middleware error:', error);
            res.status(500).json({ success: false, message: 'Phone verification check failed' });
        }
    };

    return {
        auth,
        isAdmin,
        sqlInjectionProtection,
        getClientIp,
        requirePhoneVerification
    };
}

module.exports = createAuthMiddleware;