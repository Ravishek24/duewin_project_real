const jwt = require('jsonwebtoken');
const User = require('../models/User');
// REMOVED: const SystemConfig = require('../models/SystemConfig'); // This was causing the error
const dotenv = require('dotenv');
const config = require('../config/config');

dotenv.config();

// Use same DEFAULT_JWT_SECRET as in jwt.js to ensure consistency
const DEFAULT_JWT_SECRET = 'default_jwt_secret_for_development_only';

const auth = async (req, res, next) => {
    try {
        console.log('🔐 Auth middleware starting...');
        
        // Get token from header
        const authHeader = req.header('Authorization');
        console.log('📧 Auth header:', authHeader ? 'Present' : 'Missing');
        
        if (!authHeader) {
            console.log('❌ No Authorization header found');
            return res.status(401).json({
                success: false,
                message: 'Authentication required - No Authorization header'
            });
        }

        const token = authHeader.replace('Bearer ', '');
        console.log('🎫 Token extracted:', token ? 'Present' : 'Missing');
        
        if (!token) {
            console.log('❌ No token found after Bearer extraction');
            return res.status(401).json({
                success: false,
                message: 'Authentication required - No token provided'
            });
        }

        // Try to verify token with different secrets
        let decoded;
        let secretUsed;
        
        // First try with environment variable
        try {
            const envSecret = process.env.JWT_SECRET;
            console.log('🔑 Trying ENV JWT_SECRET:', envSecret ? 'Present' : 'Missing');
            decoded = jwt.verify(token, envSecret);
            secretUsed = 'ENV_SECRET';
            console.log('✅ Token verified with ENV_SECRET');
        } catch (envError) {
            console.log('❌ ENV_SECRET failed:', envError.message);
            
            // If that fails, try with config
            try {
                const configSecret = config.jwtSecret || DEFAULT_JWT_SECRET;
                console.log('🔑 Trying config JWT_SECRET:', configSecret ? 'Present' : 'Missing');
                decoded = jwt.verify(token, configSecret);
                secretUsed = 'CONFIG_SECRET';
                console.log('✅ Token verified with CONFIG_SECRET');
            } catch (configError) {
                console.log('❌ CONFIG_SECRET failed:', configError.message);
                
                // Last try with default
                try {
                    console.log('🔑 Trying DEFAULT_JWT_SECRET');
                    decoded = jwt.verify(token, DEFAULT_JWT_SECRET);
                    secretUsed = 'DEFAULT_SECRET';
                    console.log('✅ Token verified with DEFAULT_SECRET');
                } catch (defaultError) {
                    console.log('❌ ALL SECRETS FAILED');
                    console.log('🔍 ENV_SECRET error:', envError.message);
                    console.log('🔍 CONFIG_SECRET error:', configError.message);
                    console.log('🔍 DEFAULT_SECRET error:', defaultError.message);
                    
                    return res.status(401).json({
                        success: false,
                        message: 'Invalid authentication token',
                        debug: {
                            envError: envError.message,
                            configError: configError.message,
                            defaultError: defaultError.message
                        }
                    });
                }
            }
        }
        
        console.log('🎯 Token decoded successfully with:', secretUsed);
        console.log('📋 Decoded payload:', JSON.stringify(decoded, null, 2));
        
        // Get user ID from token, supporting both formats
        const userId = decoded.userId || decoded.user_id;
        console.log('👤 Extracted user ID:', userId);
        
        if (!userId) {
            console.log('❌ No user ID found in token');
            return res.status(401).json({
                success: false,
                message: 'Invalid token format - No user ID',
                debug: { decoded }
            });
        }
        
        // Find user by user_id (primary key in your User model)
        console.log('🔍 Looking for user with user_id:', userId);
        let user = await User.findOne({
            where: {
                user_id: userId
            }
        });

        console.log('👤 User found:', user ? 'Yes' : 'No');
        
        if (!user) {
            console.log('❌ No user found');
            return res.status(401).json({
                success: false,
                message: 'Invalid authentication - User not found',
                debug: { 
                    userId,
                    searchedUserId: userId,
                    secretUsed
                }
            });
        }

        // Check if user is blocked
        if (user && user.is_blocked) {
            console.log('🚫 User is blocked');
            return res.status(403).json({
                success: false,
                message: 'Your account has been blocked. Please contact support for more information.',
                data: {
                    block_reason: user.block_reason,
                    blocked_at: user.blocked_at
                }
            });
        }

        console.log('✅ Authentication successful for user:', user.user_id);
        console.log('📱 User phone verified:', user.is_phone_verified);
        console.log('👑 User is admin:', user.is_admin);
        
        req.user = user;
        next();
    } catch (error) {
        console.error('💥 Auth middleware error:', error);
        console.error('📋 Error stack:', error.stack);
        return res.status(401).json({
            success: false,
            message: 'Invalid authentication',
            debug: {
                error: error.message,
                stack: error.stack
            }
        });
    }
};

// Middleware to check if phone is verified
const requirePhoneVerification = (req, res, next) => {
    console.log('📱 Checking phone verification for user:', req.user.user_id);
    console.log('📱 Phone verified status:', req.user.is_phone_verified);
    
    if (!req.user.is_phone_verified) {
        console.log('❌ Phone verification required');
        return res.status(403).json({
            success: false,
            message: 'Phone verification required. Please verify your phone number before accessing this resource.'
        });
    }
    console.log('✅ Phone verification passed');
    next();
};

// Middleware to check if user is an admin
const isAdmin = (req, res, next) => {
    console.log('👑 Checking admin status for user:', req.user.user_id);
    console.log('👑 Is admin:', req.user.is_admin);
    
    if (!req.user.is_admin) {
        console.log('❌ Admin access required');
        return res.status(403).json({
            success: false,
            message: 'Admin access required'
        });
    }
    console.log('✅ Admin access granted');
    next();
};

module.exports = { auth, requirePhoneVerification, isAdmin };