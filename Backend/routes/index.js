// routes/index.js
import express from 'express';
import userRoutes from './userRoutes.js';
import bankRoutes from './bankRoutes.js';
import usdtRoutes from './usdtRoutes.js';
import walletRoutes from './walletRoutes.js';
import gameRoutes from './gameRoutes.js';
import paymentRoutes from './paymentRoutes.js';
import spriteRoutes from './spriteRoutes.js'; // Add the new SPRIBE routes

const router = express.Router();

// Mount all route files
router.use('/users', userRoutes);
router.use('/bank-accounts', bankRoutes);
router.use('/usdt-accounts', usdtRoutes);
router.use('/wallet', walletRoutes);
router.use('/games', gameRoutes);
router.use('/payments', paymentRoutes);
router.use('/sprite', spriteRoutes); // Mount SPRIBE routes

export default router;