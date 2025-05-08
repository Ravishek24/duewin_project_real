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
const { auth } = require('../middlewares/authMiddleware');
const { isAdmin } = require('../middlewares/adminMiddleware');

const router = express.Router();

// Public routes (available to logged in users)
router.get('/active', auth, getActiveGatewaysController);
router.get('/:code', auth, getGatewayByCodeController);

// Admin-only routes
router.post('/', auth, isAdmin, createGatewayController);
router.put('/:id', auth, isAdmin, updateGatewayController);
router.patch('/:id/toggle', auth, isAdmin, toggleGatewayStatusController);
router.post('/initialize', auth, isAdmin, initializeDefaultGatewaysController);

module.exports = router;