'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // First remove the unique constraint from period_id
    await queryInterface.removeIndex('game_periods', 'period_id');
    
    // Then add the composite unique index
    await queryInterface.addIndex('game_periods', ['period_id', 'game_type', 'duration'], {
      name: 'game_periods_period_game_duration',
      unique: true
    });

    // Add other indexes if they don't exist
    await queryInterface.addIndex('game_periods', ['game_type', 'duration'], {
      name: 'game_periods_game_type_duration'
    });
    await queryInterface.addIndex('game_periods', ['start_time'], {
      name: 'game_periods_start_time'
    });
    await queryInterface.addIndex('game_periods', ['end_time'], {
      name: 'game_periods_end_time'
    });
    await queryInterface.addIndex('game_periods', ['is_completed'], {
      name: 'game_periods_is_completed'
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove the composite index
    await queryInterface.removeIndex('game_periods', 'game_periods_period_game_duration');
    
    // Add back the unique constraint on period_id
    await queryInterface.addIndex('game_periods', ['period_id'], {
      unique: true
    });

    // Remove other indexes
    await queryInterface.removeIndex('game_periods', 'game_periods_game_type_duration');
    await queryInterface.removeIndex('game_periods', 'game_periods_start_time');
    await queryInterface.removeIndex('game_periods', 'game_periods_end_time');
    await queryInterface.removeIndex('game_periods', 'game_periods_is_completed');
  }
}; 