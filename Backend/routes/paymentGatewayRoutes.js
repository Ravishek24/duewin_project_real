// routes/paymentGatewayRoutes.js
import express from 'express';
import {
  getActiveGatewaysController,
  getGatewayByCodeController,
  createGatewayController,
  updateGatewayController,
  toggleGatewayStatusController,
  initializeDefaultGatewaysController
} from '../controllers/paymentGatewayController.js';
import { auth } from '../middlewares/authMiddleware.js';
import { isAdmin } from '../middlewares/adminMiddleware.js';

const router = express.Router();

// Public routes (available to logged in users)
router.get('/active', auth, getActiveGatewaysController);
router.get('/:code', auth, getGatewayByCodeController);

// Admin-only routes
router.post('/', auth, isAdmin, createGatewayController);
router.put('/:id', auth, isAdmin, updateGatewayController);
router.patch('/:id/toggle', auth, isAdmin, toggleGatewayStatusController);
router.post('/initialize', auth, isAdmin, initializeDefaultGatewaysController);

export default router;