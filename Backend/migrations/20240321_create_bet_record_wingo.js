'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('bet_record_wingo', {
      bet_id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'user_id'
        }
      },
      bet_number: {
        type: Sequelize.STRING,
        allowNull: false
      },
      bet_type: {
        type: Sequelize.STRING,
        allowNull: false
      },
      bet_amount: {
        type: Sequelize.DECIMAL(20, 8),
        allowNull: false
      },
      odds: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 1.0
      },
      status: {
        type: Sequelize.ENUM('pending', 'won', 'lost'),
        defaultValue: 'pending'
      },
      win_amount: {
        type: Sequelize.DECIMAL(20, 8),
        allowNull: true,
        defaultValue: 0
      },
      payout: {
        type: Sequelize.DECIMAL(20, 8),
        allowNull: true,
        defaultValue: 0
      },
      result: {
        type: Sequelize.JSON,
        allowNull: true
      },
      wallet_balance_before: {
        type: Sequelize.DECIMAL(20, 8),
        allowNull: false
      },
      wallet_balance_after: {
        type: Sequelize.DECIMAL(20, 8),
        allowNull: false
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      timeline: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'default'
      },
      duration: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 30
      }
    });

    // Add indexes
    await queryInterface.addIndex('bet_record_wingo', ['user_id']);
    await queryInterface.addIndex('bet_record_wingo', ['bet_number']);
    await queryInterface.addIndex('bet_record_wingo', ['status']);
    await queryInterface.addIndex('bet_record_wingo', ['created_at']);
    await queryInterface.addIndex('bet_record_wingo', ['bet_number', 'duration'], {
      name: 'bet_record_wingo_bet_number_duration_idx'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('bet_record_wingo');
  }
}; 