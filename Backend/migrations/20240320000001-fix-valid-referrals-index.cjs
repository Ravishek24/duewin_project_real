'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      // Check if table exists
      const [tables] = await queryInterface.sequelize.query(
        "SHOW TABLES LIKE 'valid_referrals'"
      );
      
      if (tables.length === 0) {
        console.log('Table valid_referrals does not exist, skipping index creation');
        return;
      }

      // Check if index exists
      const [indexes] = await queryInterface.sequelize.query(
        "SHOW INDEX FROM valid_referrals WHERE Key_name = 'valid_referrals_referrer_id_referred_id'"
      );

      if (indexes.length > 0) {
        // Drop the old index
        await queryInterface.removeIndex('valid_referrals', 'valid_referrals_referrer_id_referred_id');
      }

      // Create the new index
      await queryInterface.addIndex('valid_referrals', ['referrer_id', 'referred_id'], {
        name: 'valid_referrals_unique_pair',
        unique: true
      });
    } catch (error) {
      console.log('Error in migration:', error.message);
      // Continue execution even if there's an error
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      // Check if table exists
      const [tables] = await queryInterface.sequelize.query(
        "SHOW TABLES LIKE 'valid_referrals'"
      );
      
      if (tables.length === 0) {
        console.log('Table valid_referrals does not exist, skipping index removal');
        return;
      }

      // Remove the new index
      await queryInterface.removeIndex('valid_referrals', 'valid_referrals_unique_pair');
    } catch (error) {
      console.log('Error in migration:', error.message);
      // Continue execution even if there's an error
    }
  }
}; 