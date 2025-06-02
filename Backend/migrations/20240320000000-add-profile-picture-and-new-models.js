'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add profile_picture_id to users table
    await queryInterface.addColumn('users', 'profile_picture_id', {
      type: Sequelize.STRING(255),
      allowNull: true,
      defaultValue: null
    });

    // Create ActivityReward table
    await queryInterface.createTable('activity_rewards', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'user_id'
        }
      },
      date: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      lottery_bet_amount: {
        type: Sequelize.DECIMAL(20, 2),
        defaultValue: 0.00
      },
      all_games_bet_amount: {
        type: Sequelize.DECIMAL(20, 2),
        defaultValue: 0.00
      },
      claimed_milestones: {
        type: Sequelize.JSON
      },
      total_rewards: {
        type: Sequelize.DECIMAL(20, 2),
        defaultValue: 0.00
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Add index for activity_rewards
    await queryInterface.addIndex('activity_rewards', ['user_id', 'date'], {
      name: 'idx_user_date'
    });

    // Create SelfRebate table
    await queryInterface.createTable('self_rebates', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'user_id'
        }
      },
      bet_amount: {
        type: Sequelize.DECIMAL(20, 2),
        allowNull: false
      },
      rebate_rate: {
        type: Sequelize.DECIMAL(5, 4),
        allowNull: false
      },
      rebate_amount: {
        type: Sequelize.DECIMAL(20, 2),
        allowNull: false
      },
      game_type: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      vip_level: {
        type: Sequelize.STRING(10),
        allowNull: false
      },
      status: {
        type: Sequelize.ENUM('pending', 'completed', 'failed'),
        defaultValue: 'pending'
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Add index for self_rebates
    await queryInterface.addIndex('self_rebates', ['user_id', 'created_at'], {
      name: 'idx_user_created'
    });

    // Create UserVault table
    await queryInterface.createTable('user_vaults', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'user_id'
        },
        unique: true
      },
      balance: {
        type: Sequelize.DECIMAL(20, 2),
        defaultValue: 0.00
      },
      interest_rate: {
        type: Sequelize.DECIMAL(5, 4),
        defaultValue: 0.0000
      },
      last_interest_date: {
        type: Sequelize.DATEONLY
      },
      status: {
        type: Sequelize.ENUM('active', 'inactive', 'locked'),
        defaultValue: 'active'
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Create VaultTransaction table
    await queryInterface.createTable('vault_transactions', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'user_id'
        }
      },
      vault_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'user_vaults',
          key: 'id'
        }
      },
      type: {
        type: Sequelize.ENUM('deposit', 'withdraw', 'interest'),
        allowNull: false
      },
      amount: {
        type: Sequelize.DECIMAL(20, 2),
        allowNull: false
      },
      balance_before: {
        type: Sequelize.DECIMAL(20, 2),
        allowNull: false
      },
      balance_after: {
        type: Sequelize.DECIMAL(20, 2),
        allowNull: false
      },
      status: {
        type: Sequelize.ENUM('pending', 'completed', 'failed'),
        defaultValue: 'pending'
      },
      metadata: {
        type: Sequelize.JSON
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Add index for vault_transactions
    await queryInterface.addIndex('vault_transactions', ['user_id', 'created_at'], {
      name: 'idx_user_created'
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove tables in reverse order
    await queryInterface.dropTable('vault_transactions');
    await queryInterface.dropTable('user_vaults');
    await queryInterface.dropTable('self_rebates');
    await queryInterface.dropTable('activity_rewards');
    
    // Remove column from users table
    await queryInterface.removeColumn('users', 'profile_picture_id');
  }
}; 