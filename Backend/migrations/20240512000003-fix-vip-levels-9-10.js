'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      // Update VIP level 9 with correct experience value
      await queryInterface.bulkUpdate('vip_levels', {
        required_exp: 50000000000,
        updated_at: new Date()
      }, {
        level: 9
      });

      // Update VIP level 10 with correct experience value
      await queryInterface.bulkUpdate('vip_levels', {
        required_exp: 999999999,
        updated_at: new Date()
      }, {
        level: 10
      });

      console.log('VIP levels 9 and 10 experience values updated successfully');
    } catch (error) {
      console.error('Error updating VIP levels:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      // Revert VIP level 9 experience value
      await queryInterface.bulkUpdate('vip_levels', {
        required_exp: 2147483647,
        updated_at: new Date()
      }, {
        level: 9
      });

      // Revert VIP level 10 experience value
      await queryInterface.bulkUpdate('vip_levels', {
        required_exp: 999999999,
        updated_at: new Date()
      }, {
        level: 10
      });

      console.log('VIP levels 9 and 10 experience values reverted successfully');
    } catch (error) {
      console.error('Error reverting VIP levels:', error);
      throw error;
    }
  }
}; 