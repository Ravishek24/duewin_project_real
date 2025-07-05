const express = require('express');
const { 
  claimGiftCode, 
  createGiftCode, 
  getGiftCodeStatus, 
  getUserGiftCodeHistory, 
  getAllGiftCodes, 
  getGiftCodeStats 
} = require('../controllers/adminController/giftCodeController');
const { auth, isAdmin } = require('../middlewares/authMiddleware');
const { giftCode } = require('../middleware/inputValidator');

const router = express.Router();

// User routes (require authentication)
router.post('/claim', auth, giftCode, claimGiftCode);
router.get('/history', auth, getUserGiftCodeHistory);

// Admin routes (require admin authentication)
router.post('/create', auth, isAdmin, createGiftCode);
router.get('/status/:code', auth, isAdmin, getGiftCodeStatus);
router.get('/all', auth, isAdmin, getAllGiftCodes);
router.get('/stats', auth, isAdmin, getGiftCodeStats);

module.exports = router; 