'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add missing columns
    await queryInterface.addColumn('transactions', 'metadata', {
      type: Sequelize.JSON,
      allowNull: true,
      comment: 'Additional transaction metadata in JSON format'
    });

    await queryInterface.addColumn('transactions', 'created_by', {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: 'ID of admin who created the transaction (if applicable)',
      references: {
        model: 'users',
        key: 'user_id'
      }
    });

    await queryInterface.addColumn('transactions', 'payment_method', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'Payment method used (bank, USDT, etc.)'
    });

    await queryInterface.addColumn('transactions', 'payment_details', {
      type: Sequelize.JSON,
      allowNull: true,
      comment: 'Additional payment details in JSON format'
    });

    await queryInterface.addColumn('transactions', 'game_id', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'Game ID if transaction is game-related'
    });

    await queryInterface.addColumn('transactions', 'game_type', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'Type of game if transaction is game-related'
    });

    await queryInterface.addColumn('transactions', 'gift_code', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'Gift code used if transaction is gift code related'
    });

    await queryInterface.addColumn('transactions', 'transfer_from', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'Source of transfer if transaction is a transfer'
    });

    await queryInterface.addColumn('transactions', 'transfer_to', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'Destination of transfer if transaction is a transfer'
    });

    await queryInterface.addColumn('transactions', 'previous_balance', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      comment: 'User balance before transaction'
    });

    await queryInterface.addColumn('transactions', 'new_balance', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      comment: 'User balance after transaction'
    });

    // Update the type enum to include 'activity_reward'
    await queryInterface.changeColumn('transactions', 'type', {
      type: Sequelize.ENUM(
        'deposit',
        'withdrawal', 
        'admin_credit',
        'admin_debit',
        'game_win',
        'game_loss',
        'gift_code',
        'referral_bonus',
        'rebate',
        'vip_reward',
        'transfer_in',
        'transfer_out',
        'refund',
        'game_move_in',
        'game_move_out',
        'activity_reward'
      ),
      allowNull: false,
      comment: 'Type of transaction'
    });

    // Add indexes
    await queryInterface.addIndex('transactions', ['created_by']);
    await queryInterface.addIndex('transactions', ['game_id']);
    await queryInterface.addIndex('transactions', ['gift_code']);
  },

  down: async (queryInterface, Sequelize) => {
    // Remove indexes
    await queryInterface.removeIndex('transactions', ['created_by']);
    await queryInterface.removeIndex('transactions', ['game_id']);
    await queryInterface.removeIndex('transactions', ['gift_code']);

    // Revert the type enum
    await queryInterface.changeColumn('transactions', 'type', {
      type: Sequelize.ENUM(
        'deposit',
        'withdrawal', 
        'admin_credit',
        'admin_debit',
        'game_win',
        'game_loss',
        'gift_code',
        'referral_bonus',
        'rebate',
        'vip_reward',
        'transfer_in',
        'transfer_out',
        'refund',
        'game_move_in',
        'game_move_out'
      ),
      allowNull: false,
      comment: 'Type of transaction'
    });

    // Remove columns
    await queryInterface.removeColumn('transactions', 'new_balance');
    await queryInterface.removeColumn('transactions', 'previous_balance');
    await queryInterface.removeColumn('transactions', 'transfer_to');
    await queryInterface.removeColumn('transactions', 'transfer_from');
    await queryInterface.removeColumn('transactions', 'gift_code');
    await queryInterface.removeColumn('transactions', 'game_type');
    await queryInterface.removeColumn('transactions', 'game_id');
    await queryInterface.removeColumn('transactions', 'payment_details');
    await queryInterface.removeColumn('transactions', 'payment_method');
    await queryInterface.removeColumn('transactions', 'created_by');
    await queryInterface.removeColumn('transactions', 'metadata');
  }
}; 