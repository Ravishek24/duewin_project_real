module.exports = (authMiddleware) => {
const express = require('express');
const router = express.Router();
const AnnouncementController = require('../controllers/AnnouncementController');
const { isAdmin } = authMiddleware;
const rateLimiters = require('../middleware/rateLimiter');

// Public routes - IP-based rate limiting
router.get('/latest', rateLimiters.announcements, AnnouncementController.getLatest);

// Admin routes - No rate limiting for now as requested
router.post('/', isAdmin, AnnouncementController.create);
router.get('/all', isAdmin, AnnouncementController.getAll);
router.put('/:id', isAdmin, AnnouncementController.update);
router.delete('/:id', isAdmin, AnnouncementController.delete);

return router;
}; 