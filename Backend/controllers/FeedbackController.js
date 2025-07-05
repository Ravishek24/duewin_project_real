const { Feedback, User } = require('../models');
const { Op } = require('sequelize');

// Create a new feedback (User)
const create = async (req, res) => {
    try {
        const { content } = req.body;
        const user_id = req.user.user_id;

        const feedback = await Feedback.create({
            content,
            user_id
        });

        res.status(201).json({
            success: true,
            data: feedback
        });
    } catch (error) {
        console.error('Error creating feedback:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create feedback',
            error: error.message
        });
    }
};

// Get user's feedback history
const getUserFeedback = async (req, res) => {
    try {
        const user_id = req.user.user_id;
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const { count, rows: feedbacks } = await Feedback.findAndCountAll({
            where: { user_id },
            include: [{
                model: User,
                as: 'responder',
                attributes: ['user_name']
            }],
            order: [['created_at', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        res.json({
            success: true,
            data: feedbacks,
            pagination: {
                total: count,
                page: parseInt(page),
                pages: Math.ceil(count / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching user feedback:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch feedback',
            error: error.message
        });
    }
};

// Get all feedback (Admin only)
const getAll = async (req, res) => {
    try {
        const { page = 1, limit = 50, status } = req.query;
        const offset = (page - 1) * limit;

        const where = {};
        if (status) {
            where.status = status;
        }

        const { count, rows: feedbacks } = await Feedback.findAndCountAll({
            where,
            include: [
                {
                    model: User,
                    as: 'user',
                    attributes: ['user_name']
                },
                {
                    model: User,
                    as: 'responder',
                    attributes: ['user_name']
                }
            ],
            order: [['created_at', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        res.json({
            success: true,
            data: feedbacks,
            pagination: {
                total: count,
                page: parseInt(page),
                pages: Math.ceil(count / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching all feedback:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch feedback',
            error: error.message
        });
    }
};

// Update feedback status and response (Admin only)
const respond = async (req, res) => {
    try {
        const { id } = req.params;
        const { admin_response, status } = req.body;
        const responded_by = req.user.user_id;

        const feedback = await Feedback.findByPk(id);
        if (!feedback) {
            return res.status(404).json({
                success: false,
                message: 'Feedback not found'
            });
        }

        await feedback.update({
            admin_response,
            status: status || 'responded',
            responded_by,
            responded_at: new Date()
        });

        res.json({
            success: true,
            data: feedback
        });
    } catch (error) {
        console.error('Error responding to feedback:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to respond to feedback',
            error: error.message
        });
    }
};

// Update feedback status (Admin only)
const updateStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const feedback = await Feedback.findByPk(id);
        if (!feedback) {
            return res.status(404).json({
                success: false,
                message: 'Feedback not found'
            });
        }

        await feedback.update({ status });

        res.json({
            success: true,
            data: feedback
        });
    } catch (error) {
        console.error('Error updating feedback status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update feedback status',
            error: error.message
        });
    }
};

// Delete feedback (Admin only)
const deleteFeedback = async (req, res) => {
    try {
        const { id } = req.params;

        const feedback = await Feedback.findByPk(id);
        if (!feedback) {
            return res.status(404).json({
                success: false,
                message: 'Feedback not found'
            });
        }

        await feedback.destroy();

        res.json({
            success: true,
            message: 'Feedback deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting feedback:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete feedback',
            error: error.message
        });
    }
};

module.exports = {
    create,
    getUserFeedback,
    getAll,
    respond,
    updateStatus,
    delete: deleteFeedback
}; 