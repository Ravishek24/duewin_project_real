module.exports = (authMiddleware) => {
const express = require('express');
const router = express.Router();
const AnnouncementController = require('../controllers/AnnouncementController');
const { auth, isAdmin } = authMiddleware;
const rateLimiters = require('../middleware/rateLimiter');

// Public routes - IP-based rate limiting
router.get('/latest', rateLimiters.announcements, AnnouncementController.getLatest);

// Admin routes - require auth + admin
router.post('/', auth, isAdmin, AnnouncementController.create);
router.get('/all', auth, isAdmin, AnnouncementController.getAll);
router.put('/:id', auth, isAdmin, AnnouncementController.update);
router.delete('/:id', auth, isAdmin, AnnouncementController.delete);

return router;
}; 