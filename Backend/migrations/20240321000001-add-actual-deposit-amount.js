'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      // Check if column already exists
      const [columns] = await queryInterface.sequelize.query(
        `SHOW COLUMNS FROM users LIKE 'actual_deposit_amount'`
      );
      
      if (columns.length === 0) {
        await queryInterface.addColumn('users', 'actual_deposit_amount', {
          type: Sequelize.DECIMAL(15, 2),
          defaultValue: 0.00,
          allowNull: false
        });
      }
    } catch (error) {
      console.error('Migration error:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.removeColumn('users', 'actual_deposit_amount');
    } catch (error) {
      console.error('Migration error:', error);
      throw error;
    }
  }
}; 