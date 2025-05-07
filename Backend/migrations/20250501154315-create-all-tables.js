'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Users table
    await queryInterface.createTable('users', {
      user_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      phone_no: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      user_name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      password: {
        type: Sequelize.STRING,
        allowNull: false
      },
      wallet_balance: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00
      },
      is_phone_verified: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      phone_otp_session_id: {
        type: Sequelize.STRING,
        allowNull: true
      },
      referral_code: {
        type: Sequelize.STRING,
        allowNull: false
      },
      referring_code: {
        type: Sequelize.STRING,
        unique: true
      },
      vip_exp: {
        type: Sequelize.BIGINT,
        allowNull: false,
        defaultValue: 0
      },
      vip_level: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      direct_referral_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      referral_level: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'L0'
      },
      current_ip: {
        type: Sequelize.STRING
      },
      registration_ip: {
        type: Sequelize.STRING
      },
      reset_token: {
        type: Sequelize.STRING,
        allowNull: true
      },
      reset_token_expiry: {
        type: Sequelize.DATE,
        allowNull: true
      },
      valid_referral_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      eligible_invitation_tier: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      eligible_invitation_amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true
      },
      is_admin: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('now')
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('now')
      }
    });

    // Bank Accounts table
    await queryInterface.createTable('bank_accounts', {
      bank_account_id: {
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
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      account_holder_name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      account_number: {
        type: Sequelize.STRING,
        allowNull: false
      },
      bank_name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      ifsc_code: {
        type: Sequelize.STRING,
        allowNull: false
      },
      branch_name: {
        type: Sequelize.STRING,
        allowNull: true
      },
      is_primary: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      is_verified: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('now')
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('now')
      }
    });

    // USDT Accounts table
    await queryInterface.createTable('usdt_accounts', {
      usdt_account_id: {
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
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      wallet_address: {
        type: Sequelize.STRING,
        allowNull: false
      },
      network_type: {
        type: Sequelize.STRING,
        allowNull: false
      },
      is_primary: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      is_verified: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('now')
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('now')
      }
    });

    // Wallet Recharges table
    await queryInterface.createTable('wallet_recharges', {
      recharge_id: {
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
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      phone_no: {
        type: Sequelize.STRING,
        allowNull: false
      },
      added_amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      order_id: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      transaction_id: {
        type: Sequelize.STRING,
        allowNull: true
      },
      time_of_request: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('now')
      },
      time_of_success: {
        type: Sequelize.DATE,
        allowNull: true
      },
      payment_gateway: {
        type: Sequelize.STRING,
        allowNull: false
      },
      payment_status: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      remark: {
        type: Sequelize.STRING,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('now')
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('now')
      }
    });

    // Wallet Withdrawals table
    await queryInterface.createTable('wallet_withdrawals', {
      withdrawal_id: {
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
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      phone_no: {
        type: Sequelize.STRING,
        allowNull: false
      },
      withdrawal_amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      payment_status: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      payment_gateway: {
        type: Sequelize.STRING,
        allowNull: false
      },
      withdrawal_type: {
        type: Sequelize.STRING,
        allowNull: false
      },
      order_id: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      transaction_id: {
        type: Sequelize.STRING,
        allowNull: true
      },
      remark: {
        type: Sequelize.STRING,
        allowNull: true
      },
      otp_verified: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      otp_session_id: {
        type: Sequelize.STRING,
        allowNull: true
      },
      admin_status: {
        type: Sequelize.ENUM('pending', 'approved', 'rejected'),
        defaultValue: 'pending'
      },
      time_of_request: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('now')
      },
      time_of_success: {
        type: Sequelize.DATE,
        allowNull: true
      },
      time_of_failed: {
        type: Sequelize.DATE,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('now')
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('now')
      }
    });

    // Withdrawal Admin table
    await queryInterface.createTable('withdrawal_admin', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      withdrawal_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'wallet_withdrawals',
          key: 'withdrawal_id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      admin_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'user_id'
        }
      },
      status: {
        type: Sequelize.ENUM('pending', 'approved', 'rejected'),
        defaultValue: 'pending'
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('now')
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('now')
      },
      processed_at: {
        type: Sequelize.DATE,
        allowNull: true
      }
    });

    // Referral Tree table
    await queryInterface.createTable('referral_trees', {
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
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      level_1: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      level_2: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      level_3: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      level_4: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      level_5: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      level_6: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('now')
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('now')
      }
    });

    // Valid Referrals table
    await queryInterface.createTable('valid_referrals', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      referrer_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'user_id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      referred_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'user_id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      total_recharge: {
        type: Sequelize.DECIMAL(15, 2),
        defaultValue: 0.00
      },
      is_valid: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('now')
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('now')
      }
    });

    // Add unique index to valid_referrals
    await queryInterface.addIndex('valid_referrals', ['referrer_id', 'referred_id'], {
      unique: true
    });

    // Rebate Levels table
    await queryInterface.createTable('rebate_levels', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      level: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      min_team_members: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      min_team_betting: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false
      },
      min_team_deposit: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false
      },
      lottery_l1_rebate: {
        type: Sequelize.DECIMAL(5, 4),
        allowNull: false
      },
      lottery_l2_rebate: {
        type: Sequelize.DECIMAL(5, 4),
        allowNull: false
      },
      lottery_l3_rebate: {
        type: Sequelize.DECIMAL(5, 4),
        allowNull: false
      },
      lottery_l4_rebate: {
        type: Sequelize.DECIMAL(5, 4),
        allowNull: false
      },
      lottery_l5_rebate: {
        type: Sequelize.DECIMAL(5, 4),
        allowNull: false
      },
      lottery_l6_rebate: {
        type: Sequelize.DECIMAL(5, 4),
        allowNull: false
      },
      casino_l1_rebate: {
        type: Sequelize.DECIMAL(5, 4),
        allowNull: false
      },
      casino_l2_rebate: {
        type: Sequelize.DECIMAL(5, 4),
        allowNull: false
      },
      casino_l3_rebate: {
        type: Sequelize.DECIMAL(5, 4),
        allowNull: false
      },
      casino_l4_rebate: {
        type: Sequelize.DECIMAL(5, 4),
        allowNull: false
      },
      casino_l5_rebate: {
        type: Sequelize.DECIMAL(5, 4),
        allowNull: false
      },
      casino_l6_rebate: {
        type: Sequelize.DECIMAL(5, 4),
        allowNull: false
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('now')
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('now')
      }
    });

    // User Rebate Levels table
    await queryInterface.createTable('user_rebate_levels', {
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
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      rebate_level: {
        type: Sequelize.STRING,
        allowNull: false,
        references: {
          model: 'rebate_levels',
          key: 'level'
        },
        defaultValue: 'L0'
      },
      team_members_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      team_total_betting: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0
      },
      team_total_deposit: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0
      },
      last_updated: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('now')
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('now')
      }
    });

    // VIP Levels table
    await queryInterface.createTable('vip_levels', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      level: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      exp_required: {
        type: Sequelize.BIGINT,
        allowNull: false
      },
      bonus_amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false
      },
      monthly_reward: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false
      },
      rebate_rate: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('now')
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('now')
      }
    });

    // Referral Commissions table
    await queryInterface.createTable('referral_commissions', {
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
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      referred_user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'user_id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      level: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false
      },
      type: {
        type: Sequelize.ENUM('bet', 'deposit', 'direct_bonus'),
        allowNull: false
      },
      rebate_type: {
        type: Sequelize.ENUM('lottery', 'casino'),
        allowNull: true
      },
      distribution_batch_id: {
        type: Sequelize.STRING,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('now')
      }
    });

    // Attendance Records table
    await queryInterface.createTable('attendance_records', {
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
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      attendance_date: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      streak_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1
      },
      has_recharged: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      recharge_amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00
      },
      additional_bonus: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00
      },
      bonus_amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true
      },
      bonus_claimed: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      claim_eligible: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('now')
      }
    });

    // Add unique index to attendance_records
    await queryInterface.addIndex('attendance_records', ['user_id', 'attendance_date'], {
      unique: true
    });

    // Payment Gateways table
    await queryInterface.createTable('payment_gateways', {
      gateway_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      code: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      logo_url: {
        type: Sequelize.STRING,
        allowNull: true
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      supports_deposit: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      supports_withdrawal: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      min_deposit: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 100.00
      },
      max_deposit: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 100000.00
      },
      min_withdrawal: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 500.00
      },
      max_withdrawal: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 50000.00
      },
      display_order: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('now')
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('now')
      }
    });

    // Seamless Game Sessions table
    await queryInterface.createTable('seamless_game_sessions', {
      session_id: {
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
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      remote_id: {
        type: Sequelize.STRING,
        allowNull: false
      },
      provider: {
        type: Sequelize.STRING,
        allowNull: false
      },
      session_token: {
        type: Sequelize.STRING,
        allowNull: false
      },
      game_id: {
        type: Sequelize.STRING,
        allowNull: true
      },
      game_id_hash: {
        type: Sequelize.STRING,
        allowNull: true
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      ip_address: {
        type: Sequelize.STRING,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('now')
      },
      last_activity: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('now')
      },
      closed_at: {
        type: Sequelize.DATE,
        allowNull: true
      }
    });

    // Add indexes for seamless_game_sessions
    await queryInterface.addIndex('seamless_game_sessions', ['session_token']);
    await queryInterface.addIndex('seamless_game_sessions', ['is_active']);

    // Seamless Transactions table
    await queryInterface.createTable('seamless_transactions', {
      transaction_id: {
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
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      remote_id: {
        type: Sequelize.STRING,
        allowNull: false
      },
      provider_transaction_id: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      provider: {
        type: Sequelize.STRING,
        allowNull: false
      },
      game_id: {
        type: Sequelize.STRING,
        allowNull: true
      },
      game_id_hash: {
        type: Sequelize.STRING,
        allowNull: true
      },
      round_id: {
        type: Sequelize.STRING,
        allowNull: true
      },
      type: {
        type: Sequelize.ENUM('balance', 'debit', 'credit', 'rollback'),
        allowNull: false
      },
      amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00
      },
      session_id: {
        type: Sequelize.STRING,
        allowNull: true
      },
      wallet_balance_before: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false
      },
      wallet_balance_after: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false
      },
      is_freeround_bet: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      is_freeround_win: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      is_jackpot_win: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      jackpot_contribution_in_amount: {
        type: Sequelize.DECIMAL(15, 6),
        defaultValue: 0.000000
      },
      gameplay_final: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      status: {
        type: Sequelize.ENUM('success', 'failed', 'rolledback'),
        defaultValue: 'success'
      },
      related_transaction_id: {
        type: Sequelize.STRING,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('now')
      }
    });

    // Add indexes for seamless_transactions
    await queryInterface.addIndex('seamless_transactions', ['user_id']);
    await queryInterface.addIndex('seamless_transactions', ['round_id']);
    await queryInterface.addIndex('seamless_transactions', ['type']);

    // Game Sessions table
    await queryInterface.createTable('game_sessions', {
      session_id: {
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
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      provider: {
        type: Sequelize.STRING,
        allowNull: false
      },
      game_id: {
        type: Sequelize.STRING,
        allowNull: false
      },
      launch_token: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      session_token: {
        type: Sequelize.STRING,
        allowNull: true,
        unique: true
      },
      currency: {
        type: Sequelize.STRING,
        allowNull: false
      },
      platform: {
        type: Sequelize.ENUM('mobile', 'desktop'),
        allowNull: true
      },
      ip_address: {
        type: Sequelize.STRING,
        allowNull: true
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      start_time: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('now')
      },
      end_time: {
        type: Sequelize.DATE,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('now')
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('now')
      }
    });

    // Add indexes for game_sessions
    await queryInterface.addIndex('game_sessions', ['launch_token'], { unique: true });
    await queryInterface.addIndex('game_sessions', ['session_token'], { unique: true });
    await queryInterface.addIndex('game_sessions', ['user_id']);
    await queryInterface.addIndex('game_sessions', ['is_active']);
    await queryInterface.addIndex('game_sessions', ['start_time']);

    // Game Transactions table
    await queryInterface.createTable('game_transactions', {
      transaction_id: {
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
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      provider: {
        type: Sequelize.STRING,
        allowNull: false
      },
      game_id: {
        type: Sequelize.STRING,
        allowNull: false
      },
      provider_tx_id: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      operator_tx_id: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      type: {
        type: Sequelize.ENUM('bet', 'win', 'rollback', 'freebet'),
        allowNull: false
      },
      amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false
      },
      currency: {
        type: Sequelize.STRING,
        allowNull: false
      },
      status: {
        type: Sequelize.ENUM('pending', 'completed', 'failed', 'rolled_back'),
        defaultValue: 'pending'
      },
      action_id: {
        type: Sequelize.STRING,
        allowNull: true
      },
      platform: {
        type: Sequelize.ENUM('mobile', 'desktop'),
        allowNull: false
      },
      ip_address: {
        type: Sequelize.STRING,
        allowNull: true
      },
      related_tx_id: {
        type: Sequelize.STRING,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('now')
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('now')
      }
    });

    // Add indexes for game_transactions
    await queryInterface.addIndex('game_transactions', ['provider_tx_id'], { unique: true });
    await queryInterface.addIndex('game_transactions', ['user_id']);
    await queryInterface.addIndex('game_transactions', ['type']);
    await queryInterface.addIndex('game_transactions', ['status']);
    await queryInterface.addIndex('game_transactions', ['created_at']);

    // Game Config table
    await queryInterface.createTable('game_configs', {
      config_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      game_type: {
        type: Sequelize.ENUM('wingo', 'fiveD', 'k3'),
        allowNull: false
      },
      duration: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      payout_target: {
        type: Sequelize.DECIMAL(5, 2),
        defaultValue: 60.00
      },
      min_bet_amount: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 10.00
      },
      max_bet_amount: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 10000.00
      },
      max_win_amount: {
        type: Sequelize.DECIMAL(15, 2),
        defaultValue: 100000.00
      },
      platform_fee_percent: {
        type: Sequelize.DECIMAL(5, 2),
        defaultValue: 2.00
      },
      bet_close_seconds: {
        type: Sequelize.INTEGER,
        defaultValue: 5
      },
      payout_multipliers: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('now')
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('now')
      },
      updated_by: {
        type: Sequelize.INTEGER,
        allowNull: true
      }
    });

    // Add unique index for game_configs
    await queryInterface.addIndex('game_configs', ['game_type', 'duration'], { unique: true });

    // Game Periods table
    await queryInterface.createTable('game_periods', {
      period_id: {
        type: Sequelize.STRING,
        primaryKey: true
      },
      game_type: {
        type: Sequelize.ENUM('wingo', 'fiveD', 'k3'),
        allowNull: false
      },
      duration: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      start_time: {
        type: Sequelize.DATE,
        allowNull: false
      },
      end_time: {
        type: Sequelize.DATE,
        allowNull: false
      },
      is_completed: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      result_override: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      override_by: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      total_bet_amount: {
        type: Sequelize.DECIMAL(15, 2),
        defaultValue: 0
      },
      total_payout_amount: {
        type: Sequelize.DECIMAL(15, 2),
        defaultValue: 0
      },
      unique_bettors: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('now')
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('now')
      }
    });

    // Add indexes for game_periods
    await queryInterface.addIndex('game_periods', ['game_type', 'duration']);
    await queryInterface.addIndex('game_periods', ['start_time']);
    await queryInterface.addIndex('game_periods', ['end_time']);
    await queryInterface.addIndex('game_periods', ['is_completed']);

    // Bet Record Wingo table
    await queryInterface.createTable('bet_record_wingo', {
      bet_id: {
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
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      time: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('now')
      },
      bet_number: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      bet_color: {
        type: Sequelize.STRING,
        allowNull: true
      },
      bet_size: {
        type: Sequelize.ENUM('Big', 'Small'),
        allowNull: true
      },
      bet_parity: {
        type: Sequelize.ENUM('odd', 'even'),
        allowNull: true
      },
      bet_amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      result_number: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      result_color: {
        type: Sequelize.STRING,
        allowNull: true
      },
      result_size: {
        type: Sequelize.ENUM('Big', 'Small'),
        allowNull: true
      },
      result_parity: {
        type: Sequelize.ENUM('odd', 'even'),
        allowNull: true
      },
      win_loss: {
        type: Sequelize.BOOLEAN,
        allowNull: true
      },
      payout_amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true
      },
      duration: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      period_id: {
        type: Sequelize.STRING,
        allowNull: false
      }
    });

    // Add indexes for bet_record_wingo
    await queryInterface.addIndex('bet_record_wingo', ['user_id']);
    await queryInterface.addIndex('bet_record_wingo', ['period_id']);
    await queryInterface.addIndex('bet_record_wingo', ['time']);

    // Bet Result Wingo table
    await queryInterface.createTable('bet_result_wingo', {
      bet_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      bet_number: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      result_of_number: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      result_of_size: {
        type: Sequelize.ENUM('Big', 'Small'),
        allowNull: false
      },
      result_of_color: {
        type: Sequelize.STRING,
        allowNull: false
      },
      time: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('now')
      }
    });

    // Add indexes for bet_result_wingo
    await queryInterface.addIndex('bet_result_wingo', ['bet_number'], { unique: true });
    await queryInterface.addIndex('bet_result_wingo', ['created_at']);

    // Bet Record 5D table
    await queryInterface.createTable('bet_record_5d', {
      bet_id: {
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
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      time: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('now')
      },
      bet_category: {
        type: Sequelize.ENUM('A', 'B', 'C', 'D', 'E', 'SUM'),
        allowNull: false
      },
      bet_type: {
        type: Sequelize.ENUM('NUMBER', 'SIZE', 'PARITY'),
        allowNull: false
      },
      bet_value: {
        type: Sequelize.STRING,
        allowNull: false
      },
      bet_amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      result_a: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      result_b: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      result_c: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      result_d: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      result_e: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      result_sum: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      win_loss: {
        type: Sequelize.BOOLEAN,
        allowNull: true
      },
      payout_amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true
      },
      duration: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      period_id: {
        type: Sequelize.STRING,
        allowNull: false
      }
    });

    // Add indexes for bet_record_5d
    await queryInterface.addIndex('bet_record_5d', ['user_id']);
    await queryInterface.addIndex('bet_record_5d', ['period_id']);
    await queryInterface.addIndex('bet_record_5d', ['time']);

    // Bet Result 5D table
    await queryInterface.createTable('bet_result_5d', {
      bet_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      bet_number: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      result_a: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      result_b: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      result_c: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      result_d: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      result_e: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      total_sum: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      time: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('now')
      }
    });

    // Add indexes for bet_result_5d
    await queryInterface.addIndex('bet_result_5d', ['bet_number'], { unique: true });
    await queryInterface.addIndex('bet_result_5d', ['created_at']);

    // Bet Record K3 table
    await queryInterface.createTable('bet_record_k3', {
      bet_id: {
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
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      time: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('now')
      },
      bet_type: {
        type: Sequelize.ENUM('SUM', 'SUM_CATEGORY', 'MATCHING_DICE', 'NUMBER_PATTERN'),
        allowNull: false
      },
      bet_category: {
        type: Sequelize.STRING,
        allowNull: true
      },
      bet_value: {
        type: Sequelize.STRING,
        allowNull: false
      },
      bet_amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      result_dice_1: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      result_dice_2: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      result_dice_3: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      result_sum: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      win_loss: {
        type: Sequelize.BOOLEAN,
        allowNull: true
      },
      payout_amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true
      },
      duration: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      period_id: {
        type: Sequelize.STRING,
        allowNull: false
      }
    });

    // Add indexes for bet_record_k3
    await queryInterface.addIndex('bet_record_k3', ['user_id']);
    await queryInterface.addIndex('bet_record_k3', ['period_id']);
    await queryInterface.addIndex('bet_record_k3', ['time']);

    // Bet Result K3 table
    await queryInterface.createTable('bet_result_k3', {
      bet_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      bet_number: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      dice_1: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      dice_2: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      dice_3: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      sum: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      has_pair: {
        type: Sequelize.BOOLEAN,
        allowNull: false
      },
      has_triple: {
        type: Sequelize.BOOLEAN,
        allowNull: false
      },
      is_straight: {
        type: Sequelize.BOOLEAN,
        allowNull: false
      },
      sum_size: {
        type: Sequelize.ENUM('big', 'small'),
        allowNull: false
      },
      sum_parity: {
        type: Sequelize.ENUM('odd', 'even'),
        allowNull: false
      },
      time: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('now')
      }
    });

    // Add indexes for bet_result_k3
    await queryInterface.addIndex('bet_result_k3', ['bet_number'], { unique: true });
    await queryInterface.addIndex('bet_result_k3', ['created_at']);
  },

  async down(queryInterface, Sequelize) {
    // Drop tables in reverse order (respecting foreign key constraints)
    await queryInterface.dropTable('bet_result_k3');
    await queryInterface.dropTable('bet_record_k3');
    await queryInterface.dropTable('bet_result_5d');
    await queryInterface.dropTable('bet_record_5d');
    await queryInterface.dropTable('bet_result_wingo');
    await queryInterface.dropTable('bet_record_wingo');
    await queryInterface.dropTable('game_periods');
    await queryInterface.dropTable('game_configs');
    await queryInterface.dropTable('game_transactions');
    await queryInterface.dropTable('game_sessions');
    await queryInterface.dropTable('seamless_transactions');
    await queryInterface.dropTable('seamless_game_sessions');
    await queryInterface.dropTable('payment_gateways');
    await queryInterface.dropTable('attendance_records');
    await queryInterface.dropTable('referral_commissions');
    await queryInterface.dropTable('vip_levels');
    await queryInterface.dropTable('user_rebate_levels');
    await queryInterface.dropTable('rebate_levels');
    await queryInterface.dropTable('valid_referrals');
    await queryInterface.dropTable('referral_trees');
    await queryInterface.dropTable('withdrawal_admin');
    await queryInterface.dropTable('wallet_withdrawals');
    await queryInterface.dropTable('wallet_recharges');
    await queryInterface.dropTable('usdt_accounts');
    await queryInterface.dropTable('bank_accounts');
    await queryInterface.dropTable('users');
  }
};