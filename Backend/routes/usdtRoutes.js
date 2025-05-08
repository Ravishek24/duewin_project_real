const express = require('express');
const { 
    getUsdtAccounts, 
    addUsdtAccount, 
    updateUsdtAccount, 
    deleteUsdtAccount 
} = require('../controllers/usdtAccountController');
const { auth, requirePhoneVerification } = require('../middlewares/authMiddleware');

const router = express.Router();

// All USDT account routes require authentication and email verification
router.use(auth);
router.use(requirePhoneVerification);

router.get('/', getUsdtAccounts);
router.post('/', addUsdtAccount);
router.put('/:id', updateUsdtAccount);
router.delete('/:id', deleteUsdtAccount);

module.exports = router;
