// routes/index.js - Add mxPayRoutes

import express from 'express';
import userRoutes from './userRoutes.js';
import bankRoutes from './bankRoutes.js';
import usdtRoutes from './usdtRoutes.js';
import walletRoutes from './walletRoutes.js';
import gameRoutes from './gameRoutes.js';
import paymentRoutes from './paymentRoutes.js';
import paymentGatewayRoutes from './paymentGatewayRoutes.js';
import spribeRoutes from './spribeRoutes.js';
import seamlessWalletRoutes from './seamlessWalletRoutes.js';
import referralRoutes from './referralRoutes.js';
import otpRoutes from './otpRoutes.js';
import adminRoutes from './adminRoutes.js';
import mxPayRoutes from './mxPayRoutes.js'; // Add MxPay routes

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

export default router;