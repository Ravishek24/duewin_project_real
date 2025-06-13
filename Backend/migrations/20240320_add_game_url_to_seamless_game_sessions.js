'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      // Check if column exists
      const tableInfo = await queryInterface.describeTable('seamless_game_sessions');
      if (!tableInfo.game_url) {
        await queryInterface.addColumn('seamless_game_sessions', 'game_url', {
          type: Sequelize.TEXT,
          allowNull: true,
          comment: 'URL to launch the game'
        });
      }
    } catch (error) {
      console.log('Column game_url already exists or table does not exist');
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.removeColumn('seamless_game_sessions', 'game_url');
    } catch (error) {
      console.log('Error removing column:', error);
    }
  }
}; 