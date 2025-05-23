'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      // Add new columns
      await queryInterface.addColumn('bet_result_wingos', 'duration', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 30,
        comment: 'Duration in seconds (30, 60, 180, 300)'
      });

      await queryInterface.addColumn('bet_result_wingos', 'timeline', {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'default',
        comment: 'Timeline identifier (30s, 1m, 3m, 5m)'
      });

      // Update existing records
      await queryInterface.sequelize.query(`
        UPDATE bet_result_wingos 
        SET 
          duration = 30,
          timeline = '30s'
        WHERE time = 30;
      `);

      await queryInterface.sequelize.query(`
        UPDATE bet_result_wingos 
        SET 
          duration = 60,
          timeline = '1m'
        WHERE time = 60;
      `);

      await queryInterface.sequelize.query(`
        UPDATE bet_result_wingos 
        SET 
          duration = 180,
          timeline = '3m'
        WHERE time = 180;
      `);

      await queryInterface.sequelize.query(`
        UPDATE bet_result_wingos 
        SET 
          duration = 300,
          timeline = '5m'
        WHERE time = 300;
      `);

      // Remove old time column
      await queryInterface.removeColumn('bet_result_wingos', 'time');

      console.log('Migration completed successfully');
    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      // Add back the time column
      await queryInterface.addColumn('bet_result_wingos', 'time', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 30
      });

      // Update time column with duration values
      await queryInterface.sequelize.query(`
        UPDATE bet_result_wingos 
        SET time = duration;
      `);

      // Remove new columns
      await queryInterface.removeColumn('bet_result_wingos', 'duration');
      await queryInterface.removeColumn('bet_result_wingos', 'timeline');

      console.log('Rollback completed successfully');
    } catch (error) {
      console.error('Rollback failed:', error);
      throw error;
    }
  }
}; 