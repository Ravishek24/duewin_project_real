// routes/index.js (update)
import express from 'express';
import userRoutes from './userRoutes.js';
import bankRoutes from './bankRoutes.js';
import usdtRoutes from './usdtRoutes.js';
import walletRoutes from './walletRoutes.js';
import gameRoutes from './gameRoutes.js';
import paymentRoutes from './paymentRoutes.js';
import spriteRoutes from './spriteRoutes.js';
import seamlessWalletRoutes from './seamlessWalletRoutes.js';
import referralRoutes from './referralRoutes.js';  // Add this line

const router = express.Router();

// Mount all route files
router.use('/users', userRoutes);
router.use('/bank-accounts', bankRoutes);
router.use('/usdt-accounts', usdtRoutes);
router.use('/wallet', walletRoutes);
router.use('/games', gameRoutes);
router.use('/payments', paymentRoutes);
router.use('/sprite', spriteRoutes);
router.use('/seamless', seamlessWalletRoutes);
router.use('/referrals', referralRoutes);  // Add this line

export default router;