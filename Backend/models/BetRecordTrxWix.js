// Backend/models/BetRecordTrxWix.js
const { Model, DataTypes } = require('sequelize');

class BetRecordTrxWix extends Model {
  static init(sequelize) {
    return super.init({
      bet_id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'User who placed the bet'
      },
      bet_number: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'Game period identifier'
      },
      bet_type: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'Type of bet (e.g., NUMBER:5, COLOR:red, SIZE:big, PARITY:even)'
      },
      bet_amount: {
        type: DataTypes.DECIMAL(20, 8),
        allowNull: false,
        comment: 'Amount wagered'
      },
      odds: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 1.0,
        comment: 'Betting odds'
      },
      status: {
        type: DataTypes.ENUM('pending', 'won', 'lost'),
        defaultValue: 'pending',
        comment: 'Bet status'
      },
      win_amount: {
        type: DataTypes.DECIMAL(20, 8),
        allowNull: true,
        defaultValue: 0,
        comment: 'Amount won (if applicable)'
      },
      payout: {
        type: DataTypes.DECIMAL(20, 8),
        allowNull: true,
        defaultValue: 0,
        comment: 'Total payout amount'
      },
      result: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Game result data'
      },
      wallet_balance_before: {
        type: DataTypes.DECIMAL(20, 8),
        allowNull: false,
        comment: 'User wallet balance before bet'
      },
      wallet_balance_after: {
        type: DataTypes.DECIMAL(20, 8),
        allowNull: false,
        comment: 'User wallet balance after bet result'
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      },
      timeline: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'default'
      },
      duration: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 30,
        comment: 'Duration in seconds (30, 60, 180, 300)'
      }
    }, {
      sequelize,
      modelName: 'BetRecordTrxWix',
      tableName: 'bet_record_trx_wix',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      indexes: [
        {
          fields: ['user_id']
        },
        {
          fields: ['bet_number']
        },
        {
          fields: ['status']
        },
        {
          fields: ['created_at']
        },
        {
          unique: false,
          fields: ['bet_number', 'duration'],
          name: 'bet_record_trx_wix_bet_number_duration_idx'
        }
      ]
    });
  }

  static associate(models) {
    if (models.User) {
      this.belongsTo(models.User, {
        foreignKey: 'user_id',
        as: 'user'
      });
    }
  }
}

module.exports = BetRecordTrxWix;