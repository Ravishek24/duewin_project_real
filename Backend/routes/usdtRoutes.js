import express from 'express';
import { 
    getUsdtAccounts, 
    addUsdtAccount, 
    updateUsdtAccount, 
    deleteUsdtAccount 
} from '../controllers/usdtAccountController.js';
import { auth, requireEmailVerification } from '../middlewares/authMiddleware.js'; // Fix this import

const router = express.Router();

// All USDT account routes require authentication and email verification
router.use(auth);
router.use(requireEmailVerification);

router.get('/', getUsdtAccounts);
router.post('/', addUsdtAccount);
router.put('/:id', updateUsdtAccount);
router.delete('/:id', deleteUsdtAccount);

export default router;
