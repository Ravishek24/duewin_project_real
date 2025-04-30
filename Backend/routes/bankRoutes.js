import express from 'express';
import { 
    getBankAccountsController, 
    initBankAccountController, 
    completeBankAccountController,
    updateBankAccountController, 
    deleteBankAccountController 
} from '../controllers/bankAccountController.js';
import { auth, requirePhoneVerification } from '../middlewares/authMiddleware.js';

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

export default router;