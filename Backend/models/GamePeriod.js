// Backend/models/GamePeriod.js
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
        unique: true,
        comment: 'Unique period identifier (e.g., wingo20230501001)'
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
        defaultValue: false,
        comment: 'Whether the period has completed and results processed'
      },
      result_override: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'JSON string of admin override result (if any)'
      },
      override_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Admin user ID who overrode the result'
      },
      total_bet_amount: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0,
        comment: 'Total amount bet on this period'
      },
      total_payout_amount: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0,
        comment: 'Total payout for this period'
      },
      unique_bettors: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Number of unique users who placed bets'
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
        {
          unique: true,
          fields: ['period_id', 'game_type', 'duration']
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

    // Ensure all required methods are available
    if (!model.findOne) {
      model.findOne = async function(options) {
        return await this.findOne(options);
      };
    }
    if (!model.create) {
      model.create = async function(values, options) {
        return await this.create(values, options);
      };
    }
    if (!model.update) {
      model.update = async function(values, options) {
        return await this.update(values, options);
      };
    }
    if (!model.findAll) {
      model.findAll = async function(options) {
        return await this.findAll(options);
      };
    }

    return model;
  }

  static associate(models) {
    // Define associations here if needed
  }
}

module.exports = GamePeriod;