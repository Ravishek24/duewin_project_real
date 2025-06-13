const { Announcement, User } = require('../models');
const { Op } = require('sequelize');

// Create a new announcement (Admin only)
const createAnnouncement = async (req, res) => {
    try {
        const { title, content } = req.body;
        const created_by = req.user.user_id;

        const announcement = await Announcement.create({
            title,
            content,
            created_by
        });

        res.status(201).json({
            success: true,
            data: announcement
        });
    } catch (error) {
        console.error('Error creating announcement:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create announcement',
            error: error.message
        });
    }
};

// Get latest 5 active announcements
const getLatestAnnouncements = async (req, res) => {
    try {
        const announcements = await Announcement.findAll({
            where: {
                is_active: true
            },
            include: [{
                model: User,
                as: 'creator',
                attributes: ['username']
            }],
            order: [['created_at', 'DESC']],
            limit: 5
        });

        res.json({
            success: true,
            data: announcements
        });
    } catch (error) {
        console.error('Error fetching announcements:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch announcements',
            error: error.message
        });
    }
};

// Get all announcements (Admin only)
const getAllAnnouncements = async (req, res) => {
    try {
        const { page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * limit;

        const { count, rows: announcements } = await Announcement.findAndCountAll({
            include: [{
                model: User,
                as: 'creator',
                attributes: ['username']
            }],
            order: [['created_at', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        res.json({
            success: true,
            data: announcements,
            pagination: {
                total: count,
                page: parseInt(page),
                pages: Math.ceil(count / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching all announcements:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch announcements',
            error: error.message
        });
    }
};

// Update an announcement (Admin only)
const updateAnnouncement = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, content, is_active } = req.body;

        const announcement = await Announcement.findByPk(id);
        if (!announcement) {
            return res.status(404).json({
                success: false,
                message: 'Announcement not found'
            });
        }

        await announcement.update({
            title: title || announcement.title,
            content: content || announcement.content,
            is_active: is_active !== undefined ? is_active : announcement.is_active
        });

        res.json({
            success: true,
            data: announcement
        });
    } catch (error) {
        console.error('Error updating announcement:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update announcement',
            error: error.message
        });
    }
};

// Delete an announcement (Admin only)
const deleteAnnouncement = async (req, res) => {
    try {
        const { id } = req.params;

        const announcement = await Announcement.findByPk(id);
        if (!announcement) {
            return res.status(404).json({
                success: false,
                message: 'Announcement not found'
            });
        }

        await announcement.destroy();

        res.json({
            success: true,
            message: 'Announcement deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting announcement:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete announcement',
            error: error.message
        });
    }
};

module.exports = {
    create: createAnnouncement,
    getLatest: getLatestAnnouncements,
    getAll: getAllAnnouncements,
    update: updateAnnouncement,
    delete: deleteAnnouncement
}; 