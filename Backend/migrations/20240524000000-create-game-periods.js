'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // First drop the table if it exists
    await queryInterface.dropTable('game_periods', { force: true });

    // Then create the table
    await queryInterface.createTable('game_periods', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      period_id: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'Unique period identifier (e.g., wingo20230501001)'
      },
      game_type: {
        type: Sequelize.ENUM('wingo', 'fiveD', 'k3', 'trx_wix'),
        allowNull: false,
        index: true
      },
      duration: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'Duration in seconds (30, 60, 180, 300, 600)',
        index: true
      },
      start_time: {
        type: Sequelize.DATE,
        allowNull: false,
        comment: 'Period start time',
        index: true
      },
      end_time: {
        type: Sequelize.DATE,
        allowNull: false,
        comment: 'Period end time',
        index: true
      },
      is_completed: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        comment: 'Whether the period has completed and results processed',
        index: true
      },
      result_override: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'JSON string of admin override result (if any)'
      },
      override_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Admin user ID who overrode the result'
      },
      total_bet_amount: {
        type: Sequelize.DECIMAL(15, 2),
        defaultValue: 0,
        comment: 'Total amount bet on this period'
      },
      total_payout_amount: {
        type: Sequelize.DECIMAL(15, 2),
        defaultValue: 0,
        comment: 'Total payout for this period'
      },
      unique_bettors: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        comment: 'Number of unique users who placed bets'
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('now')
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('now')
      }
    }, {
      indexes: [
        {
          name: 'game_periods_period_game_duration',
          unique: true,
          fields: ['period_id', 'game_type', 'duration']
        },
        {
          name: 'game_periods_game_type_duration',
          fields: ['game_type', 'duration']
        },
        {
          name: 'game_periods_start_time',
          fields: ['start_time']
        },
        {
          name: 'game_periods_end_time',
          fields: ['end_time']
        },
        {
          name: 'game_periods_is_completed',
          fields: ['is_completed']
        }
      ]
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('game_periods');
  }
}; 