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
const { auth, authenticateAdmin } = require('../middleware/auth');

const router = express.Router();

// Public routes (available to logged in users)
router.get('/active', auth, getActiveGatewaysController);
router.get('/initialize', auth, authenticateAdmin, initializeDefaultGatewaysController);
router.get('/:code', auth, getGatewayByCodeController);

// Admin-only routes
router.post('/', auth, authenticateAdmin, createGatewayController);
router.put('/:id', auth, authenticateAdmin, updateGatewayController);
router.patch('/:id/toggle', auth, authenticateAdmin, toggleGatewayStatusController);

module.exports = router;