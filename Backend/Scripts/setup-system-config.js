require('dotenv').config();
const SystemConfig = require('../models/SystemConfig');
const bcrypt = require('bcryptjs');

async function setupSystemConfig() {
    try {
        // Check if system config already exists
        const existingConfig = await SystemConfig.findOne();
        if (existingConfig) {
            console.log('System configuration already exists');
            return;
        }

        // Create system config
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('system_config_123', salt);

        const systemConfig = await SystemConfig.createSystemConfig({
            username: 'system_user',
            email: 'system@duewin.com',
            phone: '9999999999',
            password: hashedPassword
        });

        if (!systemConfig) {
            throw new Error('Failed to create system configuration');
        }

        console.log('System configuration created successfully!');
        console.log('Username: system_user');
        console.log('Email: system@duewin.com');
        console.log('Phone: 9999999999');
        console.log('Password: system_config_123');
        console.log('\nIMPORTANT: Please change these credentials after first login.');
        console.log('Store these credentials securely. They will not be shown again.');
    } catch (error) {
        console.error('Error setting up system configuration:', error.message);
        if (error.errors) {
            error.errors.forEach(err => {
                console.error(`- ${err.message}`);
            });
        }
        process.exit(1);
    }
}

setupSystemConfig(); 