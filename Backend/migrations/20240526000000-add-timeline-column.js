'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      // Add timeline column to bet_result_5ds table
      await queryInterface.addColumn('bet_result_5ds', 'timeline', {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'default',
        comment: 'Timeline identifier (1m, 3m, 5m, 10m)'
      });

      // Update existing records with appropriate timeline values based on duration
      await queryInterface.sequelize.query(`
        UPDATE bet_result_5ds 
        SET timeline = '1m'
        WHERE duration = 60;
      `);

      await queryInterface.sequelize.query(`
        UPDATE bet_result_5ds 
        SET timeline = '3m'
        WHERE duration = 180;
      `);

      await queryInterface.sequelize.query(`
        UPDATE bet_result_5ds 
        SET timeline = '5m'
        WHERE duration = 300;
      `);

      await queryInterface.sequelize.query(`
        UPDATE bet_result_5ds 
        SET timeline = '10m'
        WHERE duration = 600;
      `);

      console.log('Migration completed successfully');
    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      // Remove the timeline column
      await queryInterface.removeColumn('bet_result_5ds', 'timeline');
      console.log('Rollback completed successfully');
    } catch (error) {
      console.error('Rollback failed:', error);
      throw error;
    }
  }
}; 