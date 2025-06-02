'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('seamless_game_sessions', 'metadata', {
      type: Sequelize.JSON,
      allowNull: true,
      comment: 'Additional provider-specific data'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('seamless_game_sessions', 'metadata');
  }
}; 