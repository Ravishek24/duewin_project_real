const User = require('../../models/User');
const bcrypt = require('bcryptjs');

/**
 * Create a new admin user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const createAdminController = async (req, res) => {
    try {
        const { email, phone_no, user_name, password } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({
            where: {
                [sequelize.Op.or]: [
                    { email: email },
                    { phone_no: phone_no }
                ]
            }
        });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'User with this email or phone number already exists'
            });
        }

        // Create new admin user
        const adminUser = await User.create({
            email,
            phone_no,
            user_name,
            password,
            is_admin: true
        });

        // Remove sensitive data before sending response
        const adminData = adminUser.toJSON();
        delete adminData.password;

        return res.status(201).json({
            success: true,
            message: 'Admin user created successfully',
            data: adminData
        });
    } catch (error) {
        console.error('Error creating admin user:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error creating admin user'
        });
    }
};

/**
 * Get all admin users
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getAllAdminsController = async (req, res) => {
    try {
        const admins = await User.findAll({
            where: { is_admin: true },
            attributes: { exclude: ['password'] }
        });

        return res.status(200).json({
            success: true,
            data: admins
        });
    } catch (error) {
        console.error('Error fetching admin users:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error fetching admin users'
        });
    }
};

/**
 * Update admin user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updateAdminController = async (req, res) => {
    try {
        const { admin_id } = req.params;
        const { email, phone_no, user_name, password } = req.body;

        const admin = await User.findOne({
            where: {
                user_id: admin_id,
                is_admin: true
            }
        });

        if (!admin) {
            return res.status(404).json({
                success: false,
                message: 'Admin user not found'
            });
        }

        // Update admin details
        if (email) admin.email = email;
        if (phone_no) admin.phone_no = phone_no;
        if (user_name) admin.user_name = user_name;
        if (password) {
            const salt = await bcrypt.genSalt(10);
            admin.password = await bcrypt.hash(password, salt);
        }

        await admin.save();

        // Remove sensitive data before sending response
        const adminData = admin.toJSON();
        delete adminData.password;

        return res.status(200).json({
            success: true,
            message: 'Admin user updated successfully',
            data: adminData
        });
    } catch (error) {
        console.error('Error updating admin user:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error updating admin user'
        });
    }
};

/**
 * Remove admin privileges
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const removeAdminController = async (req, res) => {
    try {
        const { admin_id } = req.params;

        const admin = await User.findOne({
            where: {
                user_id: admin_id,
                is_admin: true
            }
        });

        if (!admin) {
            return res.status(404).json({
                success: false,
                message: 'Admin user not found'
            });
        }

        // Remove admin privileges
        admin.is_admin = false;
        await admin.save();

        return res.status(200).json({
            success: true,
            message: 'Admin privileges removed successfully'
        });
    } catch (error) {
        console.error('Error removing admin privileges:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error removing admin privileges'
        });
    }
};

module.exports = {
    createAdminController,
    getAllAdminsController,
    updateAdminController,
    removeAdminController
}; 