const express = require('express');
const router = express.Router();
const FeedbackController = require('../controllers/FeedbackController');
// NOTE: Auth middleware is applied at router level in index.js
const rateLimiters = require('../middleware/rateLimiter');

console.log('Starting feedback routes setup...');
console.log('After require feedbackController');
console.log('Imported feedbackController:', FeedbackController);
console.log('Create method:', typeof FeedbackController.create);

// User routes - Rate limited
console.log('About to define POST route, feedbackController.create:', FeedbackController.create);
router.post('/', rateLimiters.userFeedback, FeedbackController.create);
router.get('/my', rateLimiters.userFeedback, FeedbackController.getUserFeedback);

// Admin routes - No rate limiting for now as requested
router.get('/all', FeedbackController.getAll);
router.put('/:id/respond', FeedbackController.respond);
router.put('/:id/status', FeedbackController.updateStatus);
router.delete('/:id', FeedbackController.delete);

module.exports = router; 