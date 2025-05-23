const { User } = require('../../models');
const { generateToken, generateRefreshToken } = require('../../utils/jwt');
const { Op } = require('sequelize');

const loginController = async (req, res) => {
    try {
        // Basic validation
        const { phone_no, password } = req.body;
        
        if (!phone_no || !password) {
            return res.status(400).json({
                success: false,
                message: 'Phone number and password are required'
            });
        }

        // Check if User model is properly initialized
        if (!User || typeof User.findOne !== 'function') {
            console.error('User model not properly initialized');
            return res.status(500).json({
                success: false,
                message: 'Server configuration error. Please try again later.'
            });
        }

        const ipAddress = req.ip || req.connection.remoteAddress;

        // Rate limiting checks bypassed
        console.log('Rate limiting checks bypassed for IP:', ipAddress);

        // Find user by phone number
        const user = await User.scope('withPassword').findOne({ where: { phone_no } });
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Check if user is blocked
        if (user.is_blocked) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        // Verify password using the User model's checkPassword method
        const isValidPassword = await user.checkPassword(password);
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Generate tokens
        const accessToken = generateToken(user);
        const refreshToken = generateRefreshToken(user);

        // Update last login
        await user.update({
            last_login_at: new Date(),
            last_login_ip: ipAddress
        });

        // Set security headers
        res.set({
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'X-XSS-Protection': '1; mode=block',
            'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
            'Content-Security-Policy': "default-src 'self'",
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        });

        res.json({
            success: true,
            data: {
                user: {
                    id: user.user_id,
                    phone_no: user.phone_no,
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
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred'
        });
    }
};

module.exports = loginController;