const jwt = require('jsonwebtoken');
const User = require('../models/User');
const SystemConfig = require('../models/SystemConfig');
const dotenv = require('dotenv');
const config = require('../config/config');

dotenv.config();

// Use same DEFAULT_JWT_SECRET as in jwt.js to ensure consistency
const DEFAULT_JWT_SECRET = 'default_jwt_secret_for_development_only';

const auth = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        // First try with environment variable
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (e) {
            // If that fails, try with config
            try {
                decoded = jwt.verify(token, config.jwtSecret || DEFAULT_JWT_SECRET);
            } catch (error) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid authentication token'
                });
            }
        }
        
        // Get user ID from token, supporting both formats
        const userId = decoded.userId || decoded.user_id;
        
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Invalid token format'
            });
        }
        
        // First try to find regular admin
        let user = await User.findOne({
            where: {
                user_id: userId
            }
        });

        // If found, check if admin
        const isAdmin = user?.is_admin === true;

        // If not found or not admin, try system config
        if (!user || !isAdmin) {
            const systemConfig = await SystemConfig.findOne({
                where: {
                    id: userId
                }
            });

            if (systemConfig) {
                const decryptedData = systemConfig.getDecryptedData();
                if (decryptedData) {
                    user = {
                        user_id: systemConfig.id,
                        user_name: decryptedData.username,
                        email: decryptedData.email,
                        phone_no: decryptedData.phone,
                        is_admin: true,  // Give admin access
                        is_system_config: true,
                        is_phone_verified: true,  // System config users are always verified
                        can_manage_admins: true,  // Give full admin rights
                        can_manage_withdrawals: true,
                        can_view_reports: true,
                        can_manage_settings: true
                    };
                }
            }
        }

        // Check if user is blocked
        if (user && user.is_blocked) {
            return res.status(403).json({
                success: false,
                message: 'Your account has been blocked. Please contact support for more information.',
                data: {
                    block_reason: user.block_reason,
                    blocked_at: user.blocked_at
                }
            });
        }

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid authentication'
            });
        }

        req.user = user;
        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        return res.status(401).json({
            success: false,
            message: 'Invalid authentication'
        });
    }
};

// Middleware to check if phone is verified
const requirePhoneVerification = (req, res, next) => {
    if (!req.user.is_phone_verified && !req.user.is_system_config) {
        return res.status(403).json({
            success: false,
            message: 'Phone verification required. Please verify your phone number before accessing this resource.'
        });
    }
    next();
};

// Middleware to check if user is an admin
const isAdmin = (req, res, next) => {
    if (!req.user.is_admin && !req.user.is_system_config) {
        return res.status(403).json({
            success: false,
            message: 'Admin access required'
        });
    }
    next();
};

module.exports = { auth, requirePhoneVerification, isAdmin };