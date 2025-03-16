import express from 'express';
import { 
    getUsdtAccountsController, 
    addUsdtAccountController, 
    updateUsdtAccountController, 
    deleteUsdtAccountController 
} from '../controllers/usdtAccountController';
import { auth, requireEmailVerification } from '../middlewares/authMiddleware.js';

const router = express.Router();

// All USDT account routes require authentication and email verification
router.use(auth);
router.use(requireEmailVerification);

router.get('/', getUsdtAccountsController);
router.post('/', addUsdtAccountController);
router.put('/:id', updateUsdtAccountController);
router.delete('/:id', deleteUsdtAccountController);

export default router;