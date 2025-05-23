'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      // Change required_exp column type to BIGINT
      await queryInterface.changeColumn('vip_levels', 'required_exp', {
        type: Sequelize.BIGINT,
        allowNull: false
      });

      // Update VIP level 9 with correct experience value
      await queryInterface.bulkUpdate('vip_levels', {
        required_exp: 50000000000,
        updated_at: new Date()
      }, {
        level: 9
      });

      console.log('VIP level 9 experience value updated successfully');
    } catch (error) {
      console.error('Error updating VIP level 9:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      // Revert required_exp column type back to INT
      await queryInterface.changeColumn('vip_levels', 'required_exp', {
        type: Sequelize.INTEGER,
        allowNull: false
      });

      // Revert VIP level 9 experience value
      await queryInterface.bulkUpdate('vip_levels', {
        required_exp: 2147483647,
        updated_at: new Date()
      }, {
        level: 9
      });

      console.log('VIP level 9 experience value reverted successfully');
    } catch (error) {
      console.error('Error reverting VIP level 9:', error);
      throw error;
    }
  }
}; 