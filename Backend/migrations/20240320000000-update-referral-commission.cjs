'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      // Check if table exists
      const [tables] = await queryInterface.sequelize.query(
        "SHOW TABLES LIKE 'referral_commissions'"
      );
      
      if (tables.length === 0) {
        console.log('Table referral_commissions does not exist, skipping update');
        return;
      }

      // Add type column if it doesn't exist
      const [columns] = await queryInterface.sequelize.query(
        "SHOW COLUMNS FROM referral_commissions LIKE 'type'"
      );

      if (columns.length === 0) {
        await queryInterface.addColumn('referral_commissions', 'type', {
          type: Sequelize.ENUM('earned', 'generated'),
          allowNull: false,
          defaultValue: 'earned'
        });
      }
    } catch (error) {
      console.log('Error in migration:', error.message);
      // Continue execution even if there's an error
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      // Check if table exists
      const [tables] = await queryInterface.sequelize.query(
        "SHOW TABLES LIKE 'referral_commissions'"
      );
      
      if (tables.length === 0) {
        console.log('Table referral_commissions does not exist, skipping column removal');
        return;
      }

      // Check if column exists
      const [columns] = await queryInterface.sequelize.query(
        "SHOW COLUMNS FROM referral_commissions LIKE 'type'"
      );

      if (columns.length > 0) {
        await queryInterface.removeColumn('referral_commissions', 'type');
      }
    } catch (error) {
      console.log('Error in migration:', error.message);
      // Continue execution even if there's an error
    }
  }
}; 