const { sequelize } = require('../config/db');

async function checkColumn() {
    try {
        const tableInfo = await sequelize.getQueryInterface().describeTable('users');
        console.log('Column actual_deposit_amount exists:', !!tableInfo.actual_deposit_amount);
        if (tableInfo.actual_deposit_amount) {
            console.log('Column properties:', tableInfo.actual_deposit_amount);
        }
    } catch (error) {
        console.error('Error checking column:', error);
    } finally {
        process.exit();
    }
}

checkColumn(); 