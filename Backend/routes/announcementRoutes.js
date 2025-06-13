const express = require('express');
const router = express.Router();
const AnnouncementController = require('../controllers/AnnouncementController');
const { isAdmin } = require('../middleware/authMiddleware');

// Public routes
router.get('/latest', AnnouncementController.getLatest);

// Admin routes
router.post('/', isAdmin, AnnouncementController.create);
router.get('/all', isAdmin, AnnouncementController.getAll);
router.put('/:id', isAdmin, AnnouncementController.update);
router.delete('/:id', isAdmin, AnnouncementController.delete);

module.exports = router; 