// routes/paymentGatewayRoutes.js
const express = require('express');
const {
  getActiveGatewaysController,
  getGatewayByCodeController,
  createGatewayController,
  updateGatewayController,
  toggleGatewayStatusController,
  initializeDefaultGatewaysController
} = require('../controllers/paymentGatewayController');
const { auth, isAdmin } = require('../middlewares/authMiddleware');

const router = express.Router();

// Public routes (available to logged in users)
router.get('/active', auth, getActiveGatewaysController);
router.get('/initialize', auth, isAdmin, initializeDefaultGatewaysController);
router.get('/:code', auth, getGatewayByCodeController);

// Admin-only routes
router.post('/', auth, isAdmin, createGatewayController);
router.put('/:id', auth, isAdmin, updateGatewayController);
router.patch('/:id/toggle', auth, isAdmin, toggleGatewayStatusController);

module.exports = router;