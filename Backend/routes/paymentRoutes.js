import express from 'express';
import { payInTransaction } from '../controllers/paymentController/payInController.js';

const router = express.Router();

router.post('/payin', payInTransaction);

export default router;
