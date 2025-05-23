const User = require('../../models/User');
const bcrypt = require('bcryptjs');

/**
 * Update admin profile (email and password)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updateAdminProfileController = async (req, res) => {
    try {
        const adminId = req.user.user_id; // Get from auth middleware
        const { current_password, new_password, new_email } = req.body;

        // Validate request
        if (!current_password) {
            return res.status(400).json({
                success: false,
                message: 'Current password is required'
            });
        }

        if (!new_password && !new_email) {
            return res.status(400).json({
                success: false,
                message: 'Either new password or new email must be provided'
            });
        }

        // Get admin user
        const admin = await User.findOne({
            where: {
                user_id: adminId,
                is_admin: true
            }
        });

        if (!admin) {
            return res.status(404).json({
                success: false,
                message: 'Admin user not found'
            });
        }

        // Verify current password
        const isPasswordValid = await admin.checkPassword(current_password);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        // Update email if provided
        if (new_email) {
            // Check if email is already in use
            const existingUser = await User.findOne({
                where: {
                    email: new_email,
                    user_id: { [sequelize.Op.ne]: adminId }
                }
            });

            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    message: 'Email is already in use'
                });
            }

            admin.email = new_email;
        }

        // Update password if provided
        if (new_password) {
            // Validate password strength
            if (new_password.length < 8) {
                return res.status(400).json({
                    success: false,
                    message: 'Password must be at least 8 characters long'
                });
            }

            const salt = await bcrypt.genSalt(10);
            admin.password = await bcrypt.hash(new_password, salt);
        }

        // Save changes
        await admin.save();

        // Remove sensitive data before sending response
        const adminData = admin.toJSON();
        delete adminData.password;

        return res.status(200).json({
            success: true,
            message: 'Admin profile updated successfully',
            data: adminData
        });
    } catch (error) {
        console.error('Error updating admin profile:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error updating admin profile'
        });
    }
};

/**
 * Get admin profile
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getAdminProfileController = async (req, res) => {
    try {
        const adminId = req.user.user_id; // Get from auth middleware

        const admin = await User.findOne({
            where: {
                user_id: adminId,
                is_admin: true
            },
            attributes: { exclude: ['password'] }
        });

        if (!admin) {
            return res.status(404).json({
                success: false,
                message: 'Admin user not found'
            });
        }

        return res.status(200).json({
            success: true,
            data: admin
        });
    } catch (error) {
        console.error('Error fetching admin profile:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error fetching admin profile'
        });
    }
};

module.exports = {
    updateAdminProfileController,
    getAdminProfileController
}; 