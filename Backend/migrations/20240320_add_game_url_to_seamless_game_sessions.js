'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('seamless_game_sessions', 'game_url', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'URL to launch the game'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('seamless_game_sessions', 'game_url');
  }
}; 