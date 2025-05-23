// Backend/middlewares/adminMiddleware.js
const User = require('../models/User');

/**
 * Middleware to check if user is an admin
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const isAdmin = (req, res, next) => {
    if (!req.user.is_admin && !req.user.is_system_config) {
        return res.status(403).json({
            success: false,
            message: 'Access denied. Admin privileges required.'
        });
    }
    next();
};

// Middleware to check if user can manage admins
const canManageAdmins = (req, res, next) => {
    if (!req.user.can_manage_admins && !req.user.is_system_config) {
        return res.status(403).json({
            success: false,
            message: 'Access denied. Insufficient privileges to manage admins.'
        });
    }
    next();
};

// Middleware to check if user can manage withdrawals
const canManageWithdrawals = (req, res, next) => {
    if (!req.user.can_manage_withdrawals && !req.user.is_system_config) {
        return res.status(403).json({
            success: false,
            message: 'Access denied. Insufficient privileges to manage withdrawals.'
        });
    }
    next();
};

// Middleware to check if user can view reports
const canViewReports = (req, res, next) => {
    if (!req.user.can_view_reports && !req.user.is_system_config) {
        return res.status(403).json({
            success: false,
            message: 'Access denied. Insufficient privileges to view reports.'
        });
    }
    next();
};

// Middleware to check if user can manage settings
const canManageSettings = (req, res, next) => {
    if (!req.user.can_manage_settings && !req.user.is_system_config) {
        return res.status(403).json({
            success: false,
            message: 'Access denied. Insufficient privileges to manage settings.'
        });
    }
    next();
};

module.exports = {
    isAdmin,
    canManageAdmins,
    canManageWithdrawals,
    canViewReports,
    canManageSettings
};