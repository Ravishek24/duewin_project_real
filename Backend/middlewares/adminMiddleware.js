// Backend/middlewares/adminMiddleware.js
const User = require('../models/User');

/**
 * Middleware to check if user is an admin
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const isAdmin = async (req, res, next) => {
  try {
    // Check if user exists in request (added by auth middleware)
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    // For this implementation, we'll assume there's an is_admin field in the User model
    // In a real production system, you'd want to implement proper role-based access control
    
    // Get user from database to check admin status
    const user = await User.findByPk(req.user.user_id);
    
    // Check if user is admin (this field would need to be added to your User model)
    if (!user || !user.is_admin) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }
    
    // User is admin, proceed
    next();
  } catch (error) {
    console.error('Admin middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error checking admin permissions'
    });
  }
};

module.exports = { isAdmin };