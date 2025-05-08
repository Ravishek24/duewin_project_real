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
const referralRoutes = require('./referralRoutes');
const otpRoutes = require('./otpRoutes');
const adminRoutes = require('./adminRoutes');
const mxPayRoutes = require('./mxPayRoutes'); // Add MxPay routes

const router = express.Router();

// Mount all route files
router.use('/users', userRoutes);
router.use('/bank-accounts', bankRoutes);
router.use('/usdt-accounts', usdtRoutes);
router.use('/wallet', walletRoutes);
router.use('/games', gameRoutes);
router.use('/payments', paymentRoutes);
router.use('/payment-gateways', paymentGatewayRoutes);
router.use('/spribe', spribeRoutes);
router.use('/seamless', seamlessWalletRoutes);
router.use('/referrals', referralRoutes);
router.use('/otp', otpRoutes);
router.use('/admin', adminRoutes);
router.use('/payments/mxpay', mxPayRoutes); // Mount MxPay routes

module.exports = router;