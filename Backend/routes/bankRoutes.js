import express from 'express';
import { 
    getBankAccountsController, 
    addBankAccountController, 
    updateBankAccountController, 
    deleteBankAccountController 
} from '../controllers/bankAccountController.js';
import { auth, requireEmailVerification } from '../middleware/authMiddleware.js';

const router = express.Router();

// All bank account routes require authentication and email verification
router.use(auth);
router.use(requireEmailVerification);

router.get('/', getBankAccountsController);
router.post('/', addBankAccountController);
router.put('/:id', updateBankAccountController);
router.delete('/:id', deleteBankAccountController);

export default router;