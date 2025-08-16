const express = require('express');
const { 
  claimGiftCode, 
  createGiftCode, 
  getGiftCodeStatus, 
  getUserGiftCodeHistory, 
  getAllGiftCodes, 
  getGiftCodeStats 
} = require('../controllers/adminController/giftCodeController');
// NOTE: Auth middleware is applied at router level in index.js
const { giftCode } = require('../middleware/inputValidator');
const rateLimiters = require('../middleware/rateLimiter');

const router = express.Router();

// User routes (require authentication) - Rate limited
router.post('/claim', rateLimiters.giftCodes, giftCode, claimGiftCode);
router.get('/history', rateLimiters.giftCodes, getUserGiftCodeHistory);

// Admin routes (require admin authentication) - No rate limiting for now as requested
router.post('/create', createGiftCode);
router.get('/status/:code', getGiftCodeStatus);
router.get('/all', getAllGiftCodes);
router.get('/stats', getGiftCodeStats);

module.exports = router; 