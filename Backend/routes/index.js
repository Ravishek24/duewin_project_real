// routes/index.js - Add mxPayRoutes

const express = require('express');
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
const mxPayRoutes = require('./mxPayRoutes'); // Add MxPay routes
const { auth, authenticateAdmin } = require('../middleware/auth');

const router = express.Router();

// Mount all route files with auth middleware where needed
router.use('/users', auth, userRoutes);
router.use('/bank-accounts', auth, bankRoutes);
router.use('/usdt-accounts', auth, usdtRoutes);
router.use('/wallet', auth, walletRoutes);
router.use('/games', auth, gameRoutes);
router.use('/payments', auth, paymentRoutes);
router.use('/payment-gateways', auth, paymentGatewayRoutes);
router.use('/spribe', auth, spribeRoutes);
router.use('/seamless', auth, seamlessWalletRoutes);
router.use('/seamless-games', auth, seamlessRoutes);
router.use('/referrals', auth, referralRoutes);
router.use('/otp', otpRoutes); // OTP routes typically don't need auth
router.use('/admin', authenticateAdmin, adminRoutes);
router.use('/payments/mxpay', mxPayRoutes); // MxPay routes handle their own auth

module.exports = router;