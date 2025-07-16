'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('spribe_transactions', 'ip_address', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'IP address where transaction occurred'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('spribe_transactions', 'ip_address');
  }
}; 