const { sequelize } = require('../config/db');

async function prepareDatabase() {
    try {
        console.log('Starting database preparation...');
        
        // Basic connection test
        await sequelize.authenticate();
        console.log('Database connection successful');
        
        // Disable foreign key checks temporarily
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
        
        // Re-enable foreign key checks
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
        
        console.log('Database preparation completed successfully');
        return true;
    } catch (error) {
        console.error('Error preparing database:', error);
        return false;
    }
}

// Export the function
module.exports = { prepareDatabase }; 