// routes/index.js - FIXED VERSION

const express = require('express');
const jwt = require('jsonwebtoken'); // ADD THIS LINE - Missing import
const userRoutes = require('./userRoutes');
const bankRoutes = require('./bankRoutes');
const usdtRoutes = require('./usdtRoutes');
const walletRoutes = require('./walletRoutes');
const gameRoutes = require('./gameRoutes');
const paymentRoutes = require('./paymentRoutes');
const paymentGatewayRoutes = require('./paymentGatewayRoutes');
const spribeRoutes = require('./spribeRoutes');
const seamlessWalletRoutes = require('./seamlessWalletRoutes');
const seamlessRoutes = require('./seamlessRoutes');
const referralRoutes = require('./referralRoutes');
const otpRoutes = require('./otpRoutes');
const adminRoutes = require('./adminRoutes');
const mxPayRoutes = require('./mxPayRoutes');
const vipRoutes = require('./vipRoutes');
const { auth, isAdmin } = require('../middlewares/authMiddleware');

const router = express.Router();

// Mount all route files with auth middleware where needed
router.use('/users', userRoutes); // userRoutes handles its own auth
router.use('/bank-accounts', auth, bankRoutes);
router.use('/usdt-accounts', auth, usdtRoutes);
router.use('/wallet', auth, walletRoutes);
router.use('/games', auth, gameRoutes);
router.use('/payments', auth, paymentRoutes);
router.use('/payment-gateways', auth, paymentGatewayRoutes);
router.use('/spribe', auth, spribeRoutes);
router.use('/seamless', auth, seamlessWalletRoutes);
router.use('/seamless-games', auth, seamlessRoutes);
router.use('/referrals', referralRoutes);
router.use('/otp', otpRoutes); // OTP routes typically don't need auth
router.use('/admin', isAdmin, adminRoutes);
router.use('/payments/mxpay', mxPayRoutes); // MxPay routes handle their own auth
router.use('/vip', vipRoutes); // VIP routes handle their own auth

// Debug routes
router.get('/debug/token', (req, res) => {
    const authHeader = req.header('Authorization');
    const token = authHeader ? authHeader.replace('Bearer ', '') : null;
    
    console.log('🐛 Debug token endpoint hit');
    console.log('🐛 Auth header:', authHeader);
    console.log('🐛 Extracted token:', token);
    
    if (!token) {
        return res.json({
            success: false,
            message: 'No token provided',
            authHeader,
            headers: req.headers
        });
    }
    
    // Try to decode without verification first
    try {
        const decoded = jwt.decode(token);
        console.log('🐛 Decoded token (no verification):', decoded);
        
        res.json({
            success: true,
            message: 'Token debug info',
            token: token.substring(0, 20) + '...',
            decoded,
            authHeader,
            envSecret: process.env.JWT_SECRET ? 'Present' : 'Missing',
            configSecret: require('../config/config').jwtSecret ? 'Present' : 'Missing'
        });
    } catch (error) {
        res.json({
            success: false,
            message: 'Failed to decode token',
            error: error.message,
            token: token.substring(0, 20) + '...'
        });
    }
});

// Test auth middleware
router.get('/debug/auth', auth, (req, res) => {
    res.json({
        success: true,
        message: 'Auth middleware passed',
        user: {
            user_id: req.user.user_id,
            user_name: req.user.user_name,
            is_admin: req.user.is_admin,
            is_phone_verified: req.user.is_phone_verified
        }
    });
});

// Test referral endpoint specifically
router.get('/debug/referral', auth, (req, res) => {
    res.json({
        success: true,
        message: 'Referral debug endpoint reached',
        user: {
            user_id: req.user.user_id,
            user_name: req.user.user_name,
            is_phone_verified: req.user.is_phone_verified
        },
        timestamp: new Date().toISOString()
    });
});

module.exports = router;