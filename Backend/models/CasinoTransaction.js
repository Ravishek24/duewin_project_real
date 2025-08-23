const { Model, DataTypes } = require('sequelize');

class CasinoTransaction extends Model {
  static init(sequelize) {
    return super.init({
      transaction_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      session_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'casino_game_sessions',
          key: 'session_id'
        },
        comment: 'Reference to game session'
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'user_id'
        }
      },
      serial_number: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
        comment: 'Unique transaction ID from casino provider'
      },
      member_account: {
        type: DataTypes.STRING(50),
        allowNull: false,
        comment: 'Player account name'
      },
      game_uid: {
        type: DataTypes.STRING(50),
        allowNull: false,
        comment: 'Game UID from casino provider'
      },
      transaction_type: {
        type: DataTypes.ENUM('bet', 'win', 'balance', 'rollback'),
        allowNull: false,
        comment: 'Type of transaction'
      },
      bet_amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        defaultValue: 0.00,
        comment: 'Bet amount (for bet transactions)'
      },
      win_amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        defaultValue: 0.00,
        comment: 'Win amount (for win transactions)'
      },
      currency_code: {
        type: DataTypes.STRING(3),
        allowNull: false,
        defaultValue: 'USD',
        comment: 'Currency code for transaction'
      },
      timestamp: {
        type: DataTypes.BIGINT,
        allowNull: false,
        comment: 'Transaction timestamp from casino provider'
      },
      game_round: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: 'Game round ID'
      },
      data: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Additional transaction data from casino provider'
      },
      wallet_balance_before: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        comment: 'Wallet balance before transaction'
      },
      wallet_balance_after: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        comment: 'Wallet balance after transaction'
      },
      status: {
        type: DataTypes.ENUM('pending', 'completed', 'failed', 'rolled_back'),
        allowNull: false,
        defaultValue: 'pending',
        comment: 'Transaction status'
      },
      error_message: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Error message if transaction failed'
      },
      processed_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'When transaction was processed'
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      }
    }, {
      sequelize,
      modelName: 'CasinoTransaction',
      tableName: 'casino_transactions',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      indexes: [
        {
          fields: ['user_id']
        },
        {
          fields: ['serial_number'],
          unique: true
        },
        {
          fields: ['session_id']
        },
        {
          fields: ['transaction_type']
        },
        {
          fields: ['timestamp']
        },
        {
          fields: ['status']
        },
        {
          fields: ['created_at']
        }
      ]
    });
  }

  static associate(models) {
    if (models.User && typeof models.User === 'function') {
      this.belongsTo(models.User, {
        foreignKey: 'user_id',
        targetKey: 'user_id',
        as: 'user'
      });
    }
    
    if (models.CasinoGameSession && typeof models.CasinoGameSession === 'function') {
      this.belongsTo(models.CasinoGameSession, {
        foreignKey: 'session_id',
        targetKey: 'session_id',
        as: 'session'
      });
    }
  }

  // Instance methods
  getAmount() {
    if (this.transaction_type === 'bet') {
      return this.bet_amount || 0;
    } else if (this.transaction_type === 'win') {
      return this.win_amount || 0;
    }
    return 0;
  }

  isDebit() {
    return this.transaction_type === 'bet';
  }

  isCredit() {
    return this.transaction_type === 'win';
  }

  isBalance() {
    return this.transaction_type === 'balance';
  }

  isRollback() {
    return this.transaction_type === 'rollback';
  }
}

module.exports = CasinoTransaction;
