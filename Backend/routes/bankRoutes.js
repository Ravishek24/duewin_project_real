const express = require('express');
const { 
    getBankAccountsController, 
    initBankAccountController, 
    completeBankAccountController,
    updateBankAccountController, 
    deleteBankAccountController 
} = require('../controllers/bankAccountController');
const { auth, requirePhoneVerification } = require('../middlewares/authMiddleware');

const router = express.Router();

// All bank account routes require authentication and phone verification
router.use(auth);
router.use(requirePhoneVerification);

router.get('/', getBankAccountsController);

// Two-step bank account addition with OTP verification
router.post('/init', initBankAccountController);
router.post('/complete', completeBankAccountController);

router.put('/:id', updateBankAccountController);
router.delete('/:id', deleteBankAccountController);

module.exports = router;