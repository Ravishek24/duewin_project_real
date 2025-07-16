'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('gift_code_claims', 'claimed_ip', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'IP address when gift code was claimed'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('gift_code_claims', 'claimed_ip');
  }
}; 