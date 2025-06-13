'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('transactions', 'reference_id', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'Unique reference ID for the transaction'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('transactions', 'reference_id');
  }
}; 