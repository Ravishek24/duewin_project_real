// routes/adminRoutes.js
const express = require('express');
const { 
  getPendingWithdrawalsController,
  getWithdrawalsController,
  processWithdrawalActionController
} = require('../controllers/adminController/withdrawalController');
const { auth } = require('../middlewares/authMiddleware');
const { isAdmin } = require('../middlewares/adminMiddleware');

const router = express.Router();

// All admin routes require authentication and admin privileges
router.use(auth);
router.use(isAdmin);

// Withdrawal management routes
router.get('/withdrawals/pending', getPendingWithdrawalsController);
router.get('/withdrawals', getWithdrawalsController);
router.post('/withdrawals/process', processWithdrawalActionController);

module.exports = router;