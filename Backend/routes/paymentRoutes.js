const express = require('express');
const {
  payInController,
  initiateWithdrawalController,
  verifyWithdrawalOtpController,
  payInCallbackController,
  payOutCallbackController,
  wePayCollectionCallbackController,
  wePayTransferCallbackController,
  getPaymentStatusController,
  okPayCallbackController,
  initiateDeposit,
  getDepositHistory,
  getWithdrawalHistory
} = require('../controllers/paymentController');
const { auth, requirePhoneVerification } = require('../middlewares/authMiddleware');
const rateLimiters = require('../middleware/rateLimiter');
const validationRules = require('../middleware/inputValidator');
const { paymentCallbackWhitelist } = require('../middleware/paymentCallbackWhitelist');

const router = express.Router();

// Protected routes (require authentication & phone verification)
router.post('/payin', auth, requirePhoneVerification, payInController);

// New two-step withdrawal with OTP verification
router.post('/withdrawal/initiate', auth, requirePhoneVerification, initiateWithdrawalController);

// Payment status
router.get('/status/:order_id', auth, getPaymentStatusController);

// Callback routes for OKPAY (public, accessed by payment gateway)
// Apply IP whitelisting to protect callbacks
router.post('/okpay/payin-callback', paymentCallbackWhitelist, okPayCallbackController);
router.post('/okpay/payout-callback', paymentCallbackWhitelist, payOutCallbackController);

// Callback routes for WePayGlobal (public, accessed by payment gateway)
// Apply IP whitelisting to protect callbacks
router.post('/wepay/payin-callback', paymentCallbackWhitelist, wePayCollectionCallbackController);
router.post('/wepay/payout-callback', paymentCallbackWhitelist, wePayTransferCallbackController);

// Deposit routes
router.post('/deposit',
    auth,
    requirePhoneVerification,
    rateLimiters.payment,
    validationRules.payment,
    initiateDeposit
);

// Withdrawal routes
router.post('/withdrawal',
    auth,
    requirePhoneVerification,
    rateLimiters.withdrawal,
    validationRules.withdrawal,
    initiateWithdrawalController
);

// History routes
router.get('/deposit-history',
    auth,
    rateLimiters.general,
    getDepositHistory
);

router.get('/withdrawal-history',
    auth,
    rateLimiters.general,
    getWithdrawalHistory
);

module.exports = router;