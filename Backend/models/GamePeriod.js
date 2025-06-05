// Backend/models/GamePeriod.js - FIXED VERSION
const { Model, DataTypes } = require('sequelize');

class GamePeriod extends Model {
  static init(sequelize) {
    const model = super.init({
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      period_id: {
        type: DataTypes.STRING,
        allowNull: false,
        // IMPORTANT: Remove any unique constraint
        comment: 'Period identifier (duplicates allowed)'
      },
      game_type: {
        type: DataTypes.ENUM('wingo', 'fiveD', 'k3', 'trx_wix'),
        allowNull: false
      },
      duration: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'Duration in seconds (30, 60, 180, 300, 600)'
      },
      start_time: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: 'Period start time'
      },
      end_time: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: 'Period end time'
      },
      is_completed: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      result_override: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      override_by: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      total_bet_amount: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0
      },
      total_payout_amount: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0
      },
      unique_bettors: {
        type: DataTypes.INTEGER,
        defaultValue: 0
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
      modelName: 'GamePeriod',
      tableName: 'game_periods',
      timestamps: false,
      indexes: [
        // NO unique constraints - only regular indexes
        {
          fields: ['period_id']  // Regular index for performance
        },
        {
          fields: ['game_type', 'duration']
        },
        {
          fields: ['start_time']
        },
        {
          fields: ['end_time']
        },
        {
          fields: ['is_completed']
        }
      ]
    });

    return model;
  }

  static associate(models) {
    // Define associations here if needed
  }
}

module.exports = GamePeriod;