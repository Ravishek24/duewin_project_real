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
  initiateUTRDeposit,
  getDepositHistory,
  getWithdrawalHistory,
  ghPayCallbackController,
  wowPayDepositCallbackController,
  wowPayWithdrawalCallbackController,
  ppayProDepositCallbackController,
  ppayProWithdrawalCallbackController,
  solPayDepositCallbackController,
  solPayWithdrawalCallbackController
} = require('../controllers/paymentController');

console.log('solPayDepositCallbackController:', solPayDepositCallbackController);
console.log('solPayWithdrawalCallbackController:', solPayWithdrawalCallbackController);
console.log('Type of solPayDepositCallbackController:', typeof solPayDepositCallbackController);
console.log('Type of solPayWithdrawalCallbackController:', typeof solPayWithdrawalCallbackController);
console.log('okPayCallbackController:', typeof okPayCallbackController);
console.log('payOutCallbackController:', typeof payOutCallbackController);
console.log('wePayCollectionCallbackController:', typeof wePayCollectionCallbackController);
console.log('wePayTransferCallbackController:', typeof wePayTransferCallbackController);
console.log('ghPayCallbackController:', typeof ghPayCallbackController);
console.log('wowPayDepositCallbackController:', typeof wowPayDepositCallbackController);
console.log('wowPayWithdrawalCallbackController:', typeof wowPayWithdrawalCallbackController);
console.log('ppayProDepositCallbackController:', typeof ppayProDepositCallbackController);
console.log('ppayProWithdrawalCallbackController:', typeof ppayProWithdrawalCallbackController);
console.log('solPayDepositCallbackController:', typeof solPayDepositCallbackController);
console.log('solPayWithdrawalCallbackController:', typeof solPayWithdrawalCallbackController);
const { auth, requirePhoneVerification } = require('../middlewares/authMiddleware');
const rateLimiters = require('../middleware/rateLimiter');
const validationRules = require('../middleware/inputValidator');
const { paymentCallbackWhitelist } = require('../middleware/paymentCallbackWhitelist');
console.log('paymentCallbackWhitelist:', typeof paymentCallbackWhitelist);

const router = express.Router();

// Protected routes (require authentication & phone verification)
router.post('/payin', auth, payInController);

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

// Callback routes for GH Pay (public, accessed by payment gateway)
// Apply IP whitelisting to protect callbacks
router.post('/ghpay/payin-callback', paymentCallbackWhitelist, ghPayCallbackController);
router.post('/ghpay/payout-callback', paymentCallbackWhitelist, ghPayCallbackController);

// Callback routes for WOWPAY (public, accessed by payment gateway)
// Apply IP whitelisting to protect callbacks
router.post('/wowpay/payin-callback', paymentCallbackWhitelist, wowPayDepositCallbackController);
router.post('/wowpay/payout-callback', paymentCallbackWhitelist, wowPayWithdrawalCallbackController);

// Callback routes for PPayPro (public, accessed by payment gateway)
// Apply IP whitelisting to protect callbacks
router.post('/ppaypro/payin-callback', paymentCallbackWhitelist, ppayProDepositCallbackController);
router.post('/ppaypro/payout-callback', paymentCallbackWhitelist, ppayProWithdrawalCallbackController);

// Callback routes for SOLPAY (public, accessed by payment gateway)
// Apply IP whitelisting to protect callbacks
router.post('/solpay/payin-callback', paymentCallbackWhitelist, solPayDepositCallbackController);
router.post('/solpay/payout-callback', paymentCallbackWhitelist, solPayWithdrawalCallbackController);

// 101pay callback routes are now handled in the main routes/index.js file
// to avoid authentication conflicts

// Deposit routes
router.post('/deposit',
    auth,
    requirePhoneVerification,
    rateLimiters.payment,
    validationRules.payment,
    initiateDeposit
);

// UTR Deposit routes
router.post('/utr-deposit',
    auth,
    requirePhoneVerification,
    rateLimiters.payment,
    validationRules.payment,
    initiateUTRDeposit
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