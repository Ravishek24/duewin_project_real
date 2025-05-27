const { User } = require('../../models');
const { generateToken, generateRefreshToken } = require('../../utils/jwt');
const { Op } = require('sequelize');
const crypto = require('crypto');
const { autoRecordReferral } = require('../services/referralService');


// Fallback function to generate referral code if utility is not available
const generateReferringCode = () => {
    return crypto.randomBytes(4).toString('hex').toUpperCase();
};

// Inline security headers function
const setSecurityHeaders = (res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Content-Security-Policy', "default-src 'self'");
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
};

const registerController = async (req, res) => {
    try {
        // Check if User model is properly initialized
        if (!User || typeof User.findOne !== 'function') {
            console.error('User model not properly initialized');
            return res.status(500).json({
                success: false,
                message: 'Server configuration error. Please try again later.'
            });
        }

        const { phone_no, password, referred_by, email, user_name } = req.body;
        
        // Validate required fields
        if (!phone_no || !password || !referred_by) {
            return res.status(400).json({
                success: false,
                message: 'Phone number, password, and referral code are required'
            });
        }

        // Check if user already exists
        const existingUser = await User.findOne({
            where: {
                [Op.or]: [
                    { phone_no },
                    ...(email ? [{ email }] : []),
                    ...(user_name ? [{ user_name }] : [])
                ]
            }
        });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'User already exists with this phone number, email, or username'
            });
        }

        // Generate unique referring code
        let referring_code;
        let isUnique = false;
        let attempts = 0;
        const maxAttempts = 5;

        while (!isUnique && attempts < maxAttempts) {
            referring_code = generateReferringCode();
            const existingCode = await User.findOne({ where: { referring_code } });
            if (!existingCode) {
                isUnique = true;
            }
            attempts++;
        }

        if (!isUnique) {
            return res.status(500).json({
                success: false,
                message: 'Failed to generate unique referring code'
            });
        }
        
        // Generate username if not provided
        const auto_username = user_name || `user_${Date.now().toString().slice(-8)}`;

        // Create new user
        const user = await User.create({
            phone_no,
            email: email || null,
            user_name: auto_username,
            password,
            referring_code,
            referred_by,
            is_phone_verified: true,
            wallet_balance: 0,
            last_login_at: new Date(),
            last_login_ip: req.ip || req.connection.remoteAddress
        });

        // Generate tokens
        const accessToken = generateToken(user);
        const refreshToken = generateRefreshToken(user);

        // Set security headers
        setSecurityHeaders(res);

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            data: {
                user: {
                    id: user.user_id,
                    phone_no: user.phone_no,
                    email: user.email,
                    user_name: user.user_name,
                    referring_code: user.referring_code,
                    is_phone_verified: user.is_phone_verified,
                    wallet_balance: user.wallet_balance
                },
                tokens: {
                    accessToken,
                    refreshToken
                }
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        if (error.name === 'SequelizeValidationError') {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: error.errors.map(e => e.message)
            });
        }
        res.status(500).json({
            success: false,
            message: 'Error during registration',
            error: error.message
        });
    }
};

// After successful user creation, if referral code was used:
if (referralCode) {
    const referralResult = await autoRecordReferral(newUser.user_id, referralCode);
    console.log('Referral auto-recorded:', referralResult);
}

module.exports = registerController; 