'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      // Check if constraint exists first
      const [results] = await queryInterface.sequelize.query(
        `SELECT CONSTRAINT_NAME 
         FROM information_schema.TABLE_CONSTRAINTS 
         WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'bet_result_wingos'
         AND CONSTRAINT_NAME = 'bet_result_wingos_bet_number_duration_unique'`
      );

      if (results.length > 0) {
        // Only remove if it exists
        await queryInterface.removeConstraint(
          'bet_result_wingos',
          'bet_result_wingos_bet_number_duration_unique'
        );
        console.log('✅ Successfully removed unique constraint from bet_result_wingos table');
      } else {
        console.log('ℹ️ Constraint does not exist, skipping removal');
      }
    } catch (error) {
      console.error('❌ Error in migration:', error);
      // Don't throw error, just log it and continue
      console.log('⚠️ Continuing with migration despite error');
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      // Check if constraint exists first
      const [results] = await queryInterface.sequelize.query(
        `SELECT CONSTRAINT_NAME 
         FROM information_schema.TABLE_CONSTRAINTS 
         WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'bet_result_wingos'
         AND CONSTRAINT_NAME = 'bet_result_wingos_bet_number_duration_unique'`
      );

      if (results.length === 0) {
        // Only add if it doesn't exist
        await queryInterface.addConstraint('bet_result_wingos', {
          fields: ['bet_number', 'duration'],
          type: 'unique',
          name: 'bet_result_wingos_bet_number_duration_unique'
        });
        console.log('✅ Successfully added back unique constraint to bet_result_wingos table');
      } else {
        console.log('ℹ️ Constraint already exists, skipping addition');
      }
    } catch (error) {
      console.error('❌ Error in migration:', error);
      // Don't throw error, just log it and continue
      console.log('⚠️ Continuing with migration despite error');
    }
  }
}; 