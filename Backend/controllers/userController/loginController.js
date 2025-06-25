const { getModels } = require('../../models');
const { generateToken, generateRefreshToken } = require('../../utils/jwt');
const { Op } = require('sequelize');
const attendanceQueue = require('../../queues/attendanceQueue');

const loginController = async (req, res) => {
    try {
        const { phone_no, password } = req.body;
        if (!phone_no || !password) {
            return res.status(400).json({
                success: false,
                message: 'Phone number and password are required'
            });
        }

        const models = await getModels();
        const User = models.User;
        if (!User || typeof User.findOne !== 'function') {
            console.error('User model not properly initialized');
            return res.status(500).json({
                success: false,
                message: 'Server configuration error. Please try again later.'
            });
        }

        const ipAddress = req.ip || req.connection.remoteAddress;
        const user = await User.scope('withPassword').findOne({
            where: { phone_no },
            attributes: ['user_id', 'phone_no', 'password', 'is_blocked', 'wallet_balance', 'user_name', 'vip_level', 'profile_picture_id', 'is_phone_verified']
        });
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }
        if (user.is_blocked) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }
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

        // Non-blocking update of last login
        user.update({ last_login_at: new Date(), last_login_ip: ipAddress }).catch(console.error);

        // Add attendance job with deduplication
        const today = new Date().toISOString().split('T')[0];
        const jobId = `attendance:${user.user_id}:${today}`;
        
        attendanceQueue.add('checkAttendance', 
            { userId: user.user_id }, 
            { 
                jobId, // Prevents duplicate jobs
                removeOnComplete: 5,
                removeOnFail: 10,
                attempts: 2,
                backoff: { type: 'fixed', delay: 5000 }
            }
        ).catch(console.error);

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
                    wallet_balance: user.wallet_balance,
                    profile_picture_id: user.profile_picture_id,
                    member_detail: `MEMBER${user.user_name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()}`,
                    vip_level: user.vip_level
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