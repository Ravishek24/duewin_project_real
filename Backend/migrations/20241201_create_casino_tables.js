'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Create casino_game_sessions table
    await queryInterface.createTable('casino_game_sessions', {
      session_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'user_id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      member_account: {
        type: Sequelize.STRING(50),
        allowNull: false,
        comment: 'Player account name used in casino API'
      },
      game_uid: {
        type: Sequelize.STRING(50),
        allowNull: false,
        comment: 'Game UID from casino provider'
      },
      session_token: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Session token from casino provider'
      },
      game_launch_url: {
        type: Sequelize.TEXT,
        allowNull: false,
        comment: 'Game launch URL from casino provider'
      },
      credit_amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Credit amount allocated for this session'
      },
      currency_code: {
        type: Sequelize.STRING(3),
        allowNull: false,
        defaultValue: 'USD',
        comment: 'Currency code for this session'
      },
      language: {
        type: Sequelize.STRING(5),
        allowNull: false,
        defaultValue: 'en',
        comment: 'Game language'
      },
      platform: {
        type: Sequelize.STRING(10),
        allowNull: false,
        defaultValue: 'web',
        comment: 'Platform (web, H5)'
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Whether session is currently active'
      },
      ip_address: {
        type: Sequelize.STRING(45),
        allowNull: true,
        comment: 'IP address of the player'
      },
      started_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        comment: 'When the session started'
      },
      closed_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When the session was closed'
      },
      last_activity: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        comment: 'Last activity timestamp'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    });

    // Create casino_transactions table
    await queryInterface.createTable('casino_transactions', {
      transaction_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      session_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'casino_game_sessions',
          key: 'session_id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'Reference to game session'
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'user_id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      serial_number: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true,
        comment: 'Unique transaction ID from casino provider'
      },
      member_account: {
        type: Sequelize.STRING(50),
        allowNull: false,
        comment: 'Player account name'
      },
      game_uid: {
        type: Sequelize.STRING(50),
        allowNull: false,
        comment: 'Game UID from casino provider'
      },
      transaction_type: {
        type: Sequelize.ENUM('bet', 'win', 'balance', 'rollback'),
        allowNull: false,
        comment: 'Type of transaction'
      },
      bet_amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
        defaultValue: 0.00,
        comment: 'Bet amount (for bet transactions)'
      },
      win_amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
        defaultValue: 0.00,
        comment: 'Win amount (for win transactions)'
      },
      currency_code: {
        type: Sequelize.STRING(3),
        allowNull: false,
        defaultValue: 'USD',
        comment: 'Currency code for transaction'
      },
      timestamp: {
        type: Sequelize.BIGINT,
        allowNull: false,
        comment: 'Transaction timestamp from casino provider'
      },
      game_round: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Game round ID'
      },
      data: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Additional transaction data from casino provider'
      },
      wallet_balance_before: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
        comment: 'Wallet balance before transaction'
      },
      wallet_balance_after: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
        comment: 'Wallet balance after transaction'
      },
      status: {
        type: Sequelize.ENUM('pending', 'completed', 'failed', 'rolled_back'),
        allowNull: false,
        defaultValue: 'pending',
        comment: 'Transaction status'
      },
      error_message: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Error message if transaction failed'
      },
      processed_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When transaction was processed'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    });

    // Add indexes for better performance
    await queryInterface.addIndex('casino_game_sessions', ['user_id'], {
      name: 'idx_casino_sessions_user_id'
    });

    await queryInterface.addIndex('casino_game_sessions', ['member_account'], {
      name: 'idx_casino_sessions_member_account'
    });

    await queryInterface.addIndex('casino_game_sessions', ['session_token'], {
      name: 'idx_casino_sessions_token'
    });

    await queryInterface.addIndex('casino_game_sessions', ['is_active'], {
      name: 'idx_casino_sessions_active'
    });

    await queryInterface.addIndex('casino_game_sessions', ['started_at'], {
      name: 'idx_casino_sessions_started'
    });

    await queryInterface.addIndex('casino_transactions', ['user_id'], {
      name: 'idx_casino_transactions_user_id'
    });

    await queryInterface.addIndex('casino_transactions', ['serial_number'], {
      unique: true,
      name: 'idx_casino_transactions_serial_unique'
    });

    await queryInterface.addIndex('casino_transactions', ['session_id'], {
      name: 'idx_casino_transactions_session_id'
    });

    await queryInterface.addIndex('casino_transactions', ['transaction_type'], {
      name: 'idx_casino_transactions_type'
    });

    await queryInterface.addIndex('casino_transactions', ['timestamp'], {
      name: 'idx_casino_transactions_timestamp'
    });

    await queryInterface.addIndex('casino_transactions', ['status'], {
      name: 'idx_casino_transactions_status'
    });

    await queryInterface.addIndex('casino_transactions', ['created_at'], {
      name: 'idx_casino_transactions_created'
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Drop tables in reverse order
    await queryInterface.dropTable('casino_transactions');
    await queryInterface.dropTable('casino_game_sessions');
  }
};
