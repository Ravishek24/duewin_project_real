'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      // Remove the unique constraint
      await queryInterface.removeConstraint(
        'bet_result_wingos',
        'bet_result_wingos_bet_number_duration_unique'
      );
      
      console.log('✅ Successfully removed unique constraint from bet_result_wingos table');
    } catch (error) {
      console.error('❌ Error removing unique constraint:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      // Add back the unique constraint
      await queryInterface.addConstraint('bet_result_wingos', {
        fields: ['bet_number', 'duration'],
        type: 'unique',
        name: 'bet_result_wingos_bet_number_duration_unique'
      });
      
      console.log('✅ Successfully added back unique constraint to bet_result_wingos table');
    } catch (error) {
      console.error('❌ Error adding back unique constraint:', error);
      throw error;
    }
  }
}; 