// routes/adminRoutes.js
import express from 'express';
import { 
  getPendingWithdrawalsController,
  getWithdrawalsController,
  processWithdrawalActionController
} from '../controllers/adminController/withdrawalController.js';
import { auth } from '../middlewares/authMiddleware.js';
import { isAdmin } from '../middlewares/adminMiddleware.js';

const router = express.Router();

// All admin routes require authentication and admin privileges
router.use(auth);
router.use(isAdmin);

// Withdrawal management routes
router.get('/withdrawals/pending', getPendingWithdrawalsController);
router.get('/withdrawals', getWithdrawalsController);
router.post('/withdrawals/process', processWithdrawalActionController);

export default router;