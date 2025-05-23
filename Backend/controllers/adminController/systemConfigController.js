const SystemConfig = require('../../models/SystemConfig');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Login system config user
const loginSystemConfig = async (req, res) => {
    try {
        const { identifier, password } = req.body;

        if (!identifier || !password) {
            return res.status(400).json({
                success: false,
                message: 'Identifier (username/email/phone) and password are required'
            });
        }

        // Try to authenticate
        const config = await SystemConfig.authenticate(identifier, password);
        if (!config) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Generate JWT token
        const token = jwt.sign(
            { 
                user_id: config.id,
                is_system_config: true
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        return res.status(200).json({
            success: true,
            message: 'Login successful',
            data: {
                token,
                user: {
                    username: config.username,
                    email: config.email,
                    phone: config.phone,
                    is_system_config: true
                }
            }
        });
    } catch (error) {
        console.error('Error in system config login:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get system config profile
const getSystemConfigProfile = async (req, res) => {
    try {
        if (!req.user.is_system_config) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Only system configuration users can access this endpoint.'
            });
        }

        const config = await SystemConfig.findByPk(req.user.user_id);
        if (!config) {
            return res.status(404).json({
                success: false,
                message: 'System configuration not found'
            });
        }

        const decryptedData = config.getDecryptedData();
        if (!decryptedData) {
            return res.status(500).json({
                success: false,
                message: 'Error retrieving system configuration data'
            });
        }

        // Return profile data without sensitive information
        return res.status(200).json({
            success: true,
            data: {
                username: decryptedData.username,
                email: decryptedData.email,
                phone: decryptedData.phone,
                last_access: config.last_access
            }
        });
    } catch (error) {
        console.error('Error getting system config profile:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Update system config profile
const updateSystemConfigProfile = async (req, res) => {
    try {
        if (!req.user.is_system_config) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Only system configuration users can access this endpoint.'
            });
        }

        const { current_password, new_password, email, phone } = req.body;

        // Validate input
        if (!current_password) {
            return res.status(400).json({
                success: false,
                message: 'Current password is required'
            });
        }

        const config = await SystemConfig.findByPk(req.user.user_id);
        if (!config) {
            return res.status(404).json({
                success: false,
                message: 'System configuration not found'
            });
        }

        // Verify current password
        const decryptedData = config.getDecryptedData();
        if (!decryptedData) {
            return res.status(500).json({
                success: false,
                message: 'Error retrieving system configuration data'
            });
        }

        const isPasswordValid = await bcrypt.compare(current_password, decryptedData.password);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        // Prepare update data
        const updateData = {
            username: decryptedData.username,
            email: email || decryptedData.email,
            phone: phone || decryptedData.phone,
            password: decryptedData.password
        };

        // If new password is provided, validate and update it
        if (new_password) {
            if (new_password.length < 8) {
                return res.status(400).json({
                    success: false,
                    message: 'New password must be at least 8 characters long'
                });
            }
            const salt = await bcrypt.genSalt(10);
            updateData.password = await bcrypt.hash(new_password, salt);
        }

        // Create new encrypted data
        const encryptedData = SystemConfig.encryptData(JSON.stringify(updateData));
        const usernameHash = SystemConfig.createHash(updateData.username);
        const emailHash = updateData.email ? SystemConfig.createHash(updateData.email) : null;
        const phoneHash = updateData.phone ? SystemConfig.createHash(updateData.phone) : null;

        // Update the configuration
        await config.update({
            encrypted_data: encryptedData,
            username_hash: usernameHash,
            email_hash: emailHash,
            phone_hash: phoneHash
        });

        return res.status(200).json({
            success: true,
            message: 'System configuration updated successfully',
            data: {
                username: updateData.username,
                email: updateData.email,
                phone: updateData.phone
            }
        });
    } catch (error) {
        console.error('Error updating system config profile:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

module.exports = {
    loginSystemConfig,
    getSystemConfigProfile,
    updateSystemConfigProfile
}; 