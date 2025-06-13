const express = require('express');
const router = express.Router();
const FeedbackController = require('../controllers/FeedbackController');
const { isAdmin, auth } = require('../middlewares/authMiddleware');

console.log('Starting feedback routes setup...');
console.log('After require feedbackController');
console.log('Imported feedbackController:', FeedbackController);
console.log('Create method:', typeof FeedbackController.create);

// User routes
console.log('About to define POST route, feedbackController.create:', FeedbackController.create);
router.post('/', auth, FeedbackController.create);
router.get('/my', auth, FeedbackController.getUserFeedback);

// Admin routes
router.get('/all', isAdmin, FeedbackController.getAll);
router.put('/:id/respond', isAdmin, FeedbackController.respond);
router.put('/:id/status', isAdmin, FeedbackController.updateStatus);
router.delete('/:id', isAdmin, FeedbackController.delete);

module.exports = router; 