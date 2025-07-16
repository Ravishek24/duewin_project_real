'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('users', 'spribe_token', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'Current SPRIBE authentication token'
    });

    await queryInterface.addColumn('users', 'spribe_token_created_at', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'When the SPRIBE token was created'
    });

    await queryInterface.addColumn('users', 'spribe_token_expires_at', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'When the SPRIBE token expires'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('users', 'spribe_token');
    await queryInterface.removeColumn('users', 'spribe_token_created_at');
    await queryInterface.removeColumn('users', 'spribe_token_expires_at');
  }
}; 