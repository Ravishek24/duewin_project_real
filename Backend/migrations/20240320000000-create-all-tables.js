'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      // Create users table first (since many tables reference it)
      await queryInterface.createTable('users', {
        user_id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        email: {
          type: Sequelize.STRING,
          allowNull: true
        },
        phone_no: {
          type: Sequelize.STRING,
          allowNull: true
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
          defaultValue: 0
        },
        is_phone_verified: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false
        },
        phone_otp_session_id: {
          type: Sequelize.STRING,
          allowNull: true
        },
        referral_code: {
          type: Sequelize.STRING,
          allowNull: true
        },
        referring_code: {
          type: Sequelize.STRING,
          allowNull: true
        },
        vip_exp: {
          type: Sequelize.INTEGER,
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
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0
        },
        current_ip: {
          type: Sequelize.STRING,
          allowNull: true
        },
        registration_ip: {
          type: Sequelize.STRING,
          allowNull: true
        },
        reset_token: {
          type: Sequelize.STRING,
          allowNull: true
        },
        reset_token_expiry: {
          type: Sequelize.DATE,
          allowNull: true
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('now')
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('now')
        }
      });

      // Create vip_levels table
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
        required_exp: {
          type: Sequelize.INTEGER,
          allowNull: false
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('now')
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('now')
        }
      });

      // Create rebate_levels table
      await queryInterface.createTable('rebate_levels', {
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
        required_exp: {
          type: Sequelize.INTEGER,
          allowNull: false
        },
        rebate_percentage: {
          type: Sequelize.DECIMAL(5, 2),
          allowNull: false
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('now')
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('now')
        }
      });

      // Create user_rebate_levels table
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
          }
        },
        rebate_level_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'rebate_levels',
            key: 'id'
          }
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('now')
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('now')
        }
      });

      // Create payment_gateways table
      await queryInterface.createTable('payment_gateways', {
        gateway_id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        name: {
          type: Sequelize.STRING,
          allowNull: false,
          comment: 'Display name of the payment gateway'
        },
        code: {
          type: Sequelize.STRING,
          allowNull: false,
          unique: true,
          comment: 'Unique code for the payment gateway (e.g., OKPAY, WEPAY)'
        },
        description: {
          type: Sequelize.TEXT,
          allowNull: true,
          comment: 'Description of the payment gateway'
        },
        logo_url: {
          type: Sequelize.STRING,
          allowNull: true,
          comment: 'URL to the payment gateway logo'
        },
        is_active: {
          type: Sequelize.BOOLEAN,
          defaultValue: true,
          comment: 'Whether the gateway is currently active'
        },
        supports_deposit: {
          type: Sequelize.BOOLEAN,
          defaultValue: true,
          comment: 'Whether the gateway supports deposits'
        },
        supports_withdrawal: {
          type: Sequelize.BOOLEAN,
          defaultValue: true,
          comment: 'Whether the gateway supports withdrawals'
        },
        min_deposit: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: false,
          defaultValue: 100.00,
          comment: 'Minimum deposit amount'
        },
        max_deposit: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: false,
          defaultValue: 100000.00,
          comment: 'Maximum deposit amount'
        },
        min_withdrawal: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: false,
          defaultValue: 500.00,
          comment: 'Minimum withdrawal amount'
        },
        max_withdrawal: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: false,
          defaultValue: 50000.00,
          comment: 'Maximum withdrawal amount'
        },
        display_order: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
          comment: 'Order to display the payment gateway options'
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('now')
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('now')
        }
      });

      // Create bank_accounts table
      await queryInterface.createTable('bank_accounts', {
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
        bank_name: {
          type: Sequelize.STRING,
          allowNull: false
        },
        account_number: {
          type: Sequelize.STRING,
          allowNull: false
        },
        account_holder: {
          type: Sequelize.STRING,
          allowNull: false
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('now')
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('now')
        }
      });

      // Create usdt_accounts table
      await queryInterface.createTable('usdt_accounts', {
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
        address: {
          type: Sequelize.STRING,
          allowNull: false
        },
        network: {
          type: Sequelize.STRING,
          allowNull: false
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('now')
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('now')
        }
      });

      // Create referral_trees table
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
          }
        },
        referrer_id: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: 'users',
            key: 'user_id'
          }
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
          allowNull: false,
          defaultValue: Sequelize.fn('now')
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('now')
        }
      });

      // Create valid_referrals table
      await queryInterface.createTable('valid_referrals', {
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
        referrer_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'users',
            key: 'user_id'
          }
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('now')
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('now')
        }
      });

      // Create referral_commissions table
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
          }
        },
        amount: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: false,
          defaultValue: 0
        },
        level: {
          type: Sequelize.INTEGER,
          allowNull: false
        },
        status: {
          type: Sequelize.ENUM('pending', 'paid'),
          allowNull: false,
          defaultValue: 'pending'
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('now')
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('now')
        }
      });

      // Create game_configs table
      await queryInterface.createTable('game_configs', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        game_type: {
          type: Sequelize.STRING,
          allowNull: false
        },
        config: {
          type: Sequelize.JSON,
          allowNull: false
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('now')
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('now')
        }
      });

      // Create game_periods table
      await queryInterface.createTable('game_periods', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        game_type: {
          type: Sequelize.STRING,
          allowNull: false
        },
        period: {
          type: Sequelize.STRING,
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
        status: {
          type: Sequelize.ENUM('pending', 'running', 'completed'),
          allowNull: false,
          defaultValue: 'pending'
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('now')
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('now')
        }
      });

      // Create game_sessions table
      await queryInterface.createTable('game_sessions', {
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
        game_type: {
          type: Sequelize.STRING,
          allowNull: false
        },
        session_id: {
          type: Sequelize.STRING,
          allowNull: false
        },
        balance: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: false,
          defaultValue: 0
        },
        status: {
          type: Sequelize.ENUM('active', 'closed'),
          allowNull: false,
          defaultValue: 'active'
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('now')
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('now')
        }
      });

      // Create seamless_game_sessions table
      await queryInterface.createTable('seamless_game_sessions', {
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
        game_type: {
          type: Sequelize.STRING,
          allowNull: false
        },
        session_id: {
          type: Sequelize.STRING,
          allowNull: false
        },
        balance: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: false,
          defaultValue: 0
        },
        status: {
          type: Sequelize.ENUM('active', 'closed'),
          allowNull: false,
          defaultValue: 'active'
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('now')
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('now')
        }
      });

      // Create game_transactions table
      await queryInterface.createTable('game_transactions', {
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
        game_type: {
          type: Sequelize.STRING,
          allowNull: false
        },
        amount: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: false
        },
        type: {
          type: Sequelize.ENUM('bet', 'win', 'refund'),
          allowNull: false
        },
        status: {
          type: Sequelize.ENUM('pending', 'completed', 'failed'),
          allowNull: false,
          defaultValue: 'pending'
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('now')
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('now')
        }
      });

      // Create seamless_transactions table
      await queryInterface.createTable('seamless_transactions', {
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
        game_type: {
          type: Sequelize.STRING,
          allowNull: false
        },
        amount: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: false
        },
        type: {
          type: Sequelize.ENUM('bet', 'win', 'refund'),
          allowNull: false
        },
        status: {
          type: Sequelize.ENUM('pending', 'completed', 'failed'),
          allowNull: false,
          defaultValue: 'pending'
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('now')
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('now')
        }
      });

      // Create wallet_recharges table
      await queryInterface.createTable('wallet_recharges', {
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
        amount: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: false
        },
        payment_gateway_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'payment_gateways',
            key: 'gateway_id'
          }
        },
        status: {
          type: Sequelize.ENUM('pending', 'completed', 'failed'),
          allowNull: false,
          defaultValue: 'pending'
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('now')
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('now')
        }
      });

      // Create wallet_withdrawals table
      await queryInterface.createTable('wallet_withdrawals', {
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
        amount: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: false
        },
        payment_gateway_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'payment_gateways',
            key: 'gateway_id'
          }
        },
        transaction_id: {
          type: Sequelize.STRING,
          allowNull: false
        },
        status: {
          type: Sequelize.ENUM('pending', 'completed', 'failed', 'rejected'),
          allowNull: false,
          defaultValue: 'pending'
        },
        admin_id: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: 'users',
            key: 'user_id'
          }
        },
        rejection_reason: {
          type: Sequelize.STRING,
          allowNull: true
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('now')
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('now')
        }
      });

      // Create withdrawal_admins table
      await queryInterface.createTable('withdrawal_admins', {
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
        withdrawal_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'wallet_withdrawals',
            key: 'id'
          }
        },
        action: {
          type: Sequelize.ENUM('approve', 'reject'),
          allowNull: false
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('now')
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('now')
        }
      });

      // Create attendance_records table
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
          }
        },
        date: {
          type: Sequelize.DATEONLY,
          allowNull: false
        },
        reward: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: false,
          defaultValue: 0
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('now')
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('now')
        }
      });

      // Create bet_record_k3s table
      await queryInterface.createTable('bet_record_k3s', {
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
        period: {
          type: Sequelize.STRING,
          allowNull: false
        },
        bet_type: {
          type: Sequelize.STRING,
          allowNull: false
        },
        bet_amount: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: false
        },
        odds: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: false
        },
        status: {
          type: Sequelize.ENUM('pending', 'won', 'lost'),
          allowNull: false,
          defaultValue: 'pending'
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('now')
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('now')
        }
      });

      // Create bet_result_k3s table
      await queryInterface.createTable('bet_result_k3s', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        period: {
          type: Sequelize.STRING,
          allowNull: false,
          unique: true
        },
        result: {
          type: Sequelize.STRING,
          allowNull: false
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('now')
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('now')
        }
      });

      // Create bet_record_5ds table
      await queryInterface.createTable('bet_record_5ds', {
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
        period: {
          type: Sequelize.STRING,
          allowNull: false
        },
        bet_type: {
          type: Sequelize.STRING,
          allowNull: false
        },
        bet_amount: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: false
        },
        odds: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: false
        },
        status: {
          type: Sequelize.ENUM('pending', 'won', 'lost'),
          allowNull: false,
          defaultValue: 'pending'
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('now')
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('now')
        }
      });

      // Create bet_result_5ds table
      await queryInterface.createTable('bet_result_5ds', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        period: {
          type: Sequelize.STRING,
          allowNull: false,
          unique: true
        },
        result: {
          type: Sequelize.STRING,
          allowNull: false
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('now')
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('now')
        }
      });

      // Create bet_record_wingos table
      await queryInterface.createTable('bet_record_wingos', {
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
        period: {
          type: Sequelize.STRING,
          allowNull: false
        },
        bet_type: {
          type: Sequelize.STRING,
          allowNull: false
        },
        bet_amount: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: false
        },
        odds: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: false
        },
        status: {
          type: Sequelize.ENUM('pending', 'won', 'lost'),
          allowNull: false,
          defaultValue: 'pending'
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('now')
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('now')
        }
      });

      // Create bet_result_wingos table
      await queryInterface.createTable('bet_result_wingos', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        period: {
          type: Sequelize.STRING,
          allowNull: false,
          unique: true
        },
        result: {
          type: Sequelize.STRING,
          allowNull: false
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('now')
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('now')
        }
      });

      // Add indexes
      await queryInterface.addIndex('referral_trees', ['user_id'], {
        unique: true,
        name: 'referral_trees_user_id_unique'
      });
      await queryInterface.addIndex('referral_trees', ['referrer_id'], {
        name: 'referral_trees_referrer_id_index'
      });
      await queryInterface.addIndex('referral_commissions', ['user_id'], {
        name: 'referral_commissions_user_id_index'
      });
      await queryInterface.addIndex('valid_referrals', ['user_id', 'referrer_id'], {
        unique: true,
        name: 'valid_referrals_unique_pair'
      });
      await queryInterface.addIndex('bank_accounts', ['user_id'], {
        name: 'bank_accounts_user_id_index'
      });
      await queryInterface.addIndex('usdt_accounts', ['user_id'], {
        name: 'usdt_accounts_user_id_index'
      });
      await queryInterface.addIndex('game_sessions', ['user_id'], {
        name: 'game_sessions_user_id_index'
      });
      await queryInterface.addIndex('seamless_game_sessions', ['user_id'], {
        name: 'seamless_game_sessions_user_id_index'
      });
      await queryInterface.addIndex('game_transactions', ['user_id'], {
        name: 'game_transactions_user_id_index'
      });
      await queryInterface.addIndex('seamless_transactions', ['user_id'], {
        name: 'seamless_transactions_user_id_index'
      });
      await queryInterface.addIndex('wallet_recharges', ['user_id'], {
        name: 'wallet_recharges_user_id_index'
      });
      await queryInterface.addIndex('wallet_withdrawals', ['user_id'], {
        name: 'wallet_withdrawals_user_id_index'
      });
      await queryInterface.addIndex('withdrawal_admins', ['user_id'], {
        name: 'withdrawal_admins_user_id_index'
      });
      await queryInterface.addIndex('attendance_records', ['user_id', 'date'], {
        unique: true,
        name: 'attendance_records_user_date_unique'
      });
      await queryInterface.addIndex('bet_record_k3s', ['user_id', 'period'], {
        name: 'bet_record_k3s_user_period_index'
      });
      await queryInterface.addIndex('bet_record_5ds', ['user_id', 'period'], {
        name: 'bet_record_5ds_user_period_index'
      });
      await queryInterface.addIndex('bet_record_wingos', ['user_id', 'period'], {
        name: 'bet_record_wingos_user_period_index'
      });

      // Insert default payment gateway
      await queryInterface.bulkInsert('payment_gateways', [{
        name: 'Default Gateway',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      }]);

      // Insert default VIP levels
      await queryInterface.bulkInsert('vip_levels', [
        { level: 0, required_exp: 0, created_at: new Date(), updated_at: new Date() },
        { level: 1, required_exp: 1000, created_at: new Date(), updated_at: new Date() },
        { level: 2, required_exp: 5000, created_at: new Date(), updated_at: new Date() },
        { level: 3, required_exp: 10000, created_at: new Date(), updated_at: new Date() },
        { level: 4, required_exp: 50000, created_at: new Date(), updated_at: new Date() },
        { level: 5, required_exp: 100000, created_at: new Date(), updated_at: new Date() }
      ]);

      // Insert default rebate levels
      await queryInterface.bulkInsert('rebate_levels', [
        { level: 0, required_exp: 0, rebate_percentage: 0.00, created_at: new Date(), updated_at: new Date() },
        { level: 1, required_exp: 1000, rebate_percentage: 0.50, created_at: new Date(), updated_at: new Date() },
        { level: 2, required_exp: 5000, rebate_percentage: 1.00, created_at: new Date(), updated_at: new Date() },
        { level: 3, required_exp: 10000, rebate_percentage: 1.50, created_at: new Date(), updated_at: new Date() },
        { level: 4, required_exp: 50000, rebate_percentage: 2.00, created_at: new Date(), updated_at: new Date() },
        { level: 5, required_exp: 100000, rebate_percentage: 2.50, created_at: new Date(), updated_at: new Date() }
      ]);

    } catch (error) {
      console.error('Error in migration:', error.message);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      // Drop tables in reverse order of dependencies
      await queryInterface.dropTable('bet_result_wingos');
      await queryInterface.dropTable('bet_record_wingos');
      await queryInterface.dropTable('bet_result_5ds');
      await queryInterface.dropTable('bet_record_5ds');
      await queryInterface.dropTable('bet_result_k3s');
      await queryInterface.dropTable('bet_record_k3s');
      await queryInterface.dropTable('attendance_records');
      await queryInterface.dropTable('withdrawal_admins');
      await queryInterface.dropTable('wallet_withdrawals');
      await queryInterface.dropTable('wallet_recharges');
      await queryInterface.dropTable('seamless_transactions');
      await queryInterface.dropTable('game_transactions');
      await queryInterface.dropTable('seamless_game_sessions');
      await queryInterface.dropTable('game_sessions');
      await queryInterface.dropTable('game_periods');
      await queryInterface.dropTable('game_configs');
      await queryInterface.dropTable('referral_commissions');
      await queryInterface.dropTable('valid_referrals');
      await queryInterface.dropTable('referral_trees');
      await queryInterface.dropTable('usdt_accounts');
      await queryInterface.dropTable('bank_accounts');
      await queryInterface.dropTable('user_rebate_levels');
      await queryInterface.dropTable('rebate_levels');
      await queryInterface.dropTable('payment_gateways');
      await queryInterface.dropTable('vip_levels');
      await queryInterface.dropTable('users');
    } catch (error) {
      console.error('Error in migration:', error.message);
      throw error;
    }
  }
}; 