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
// NOTE: Auth middleware is applied at router level in index.js
const rateLimiters = require('../middleware/rateLimiter');

const router = express.Router();

// Public routes (available to logged in users) - Rate limited
router.get('/active', rateLimiters.paymentGateway, getActiveGatewaysController);
router.get('/initialize', initializeDefaultGatewaysController); // Admin route - no rate limiting
router.get('/:code', rateLimiters.paymentGateway, getGatewayByCodeController);

// Admin-only routes - No rate limiting for now as requested
router.post('/', createGatewayController);
router.put('/:id', updateGatewayController);
router.patch('/:id/toggle', toggleGatewayStatusController);

module.exports = router;