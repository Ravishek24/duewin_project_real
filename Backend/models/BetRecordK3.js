// Backend/models/BetResultK3.js
const { Model, DataTypes } = require('sequelize');

class BetResultK3 extends Model {
  static init(sequelize) {
    return super.init({
      bet_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      bet_number: {
        type: DataTypes.STRING,
        allowNull: false
      },
      dice_1: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      dice_2: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      dice_3: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      sum: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      has_pair: {
        type: DataTypes.BOOLEAN,
        allowNull: false
      },
      has_triple: {
        type: DataTypes.BOOLEAN,
        allowNull: false
      },
      is_straight: {
        type: DataTypes.BOOLEAN,
        allowNull: false
      },
      sum_size: {
        type: DataTypes.ENUM('Big', 'Small'),
        allowNull: false
      },
      sum_parity: {
        type: DataTypes.ENUM('Odd', 'Even'),
        allowNull: false
      },
      time: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      },
      created_at: {
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
        defaultValue: 60,
        comment: 'Duration in seconds (60, 180, 300, 600)'
      }
    }, {
      sequelize,
      modelName: 'BetResultK3',
      tableName: 'bet_result_k3s',
      timestamps: false,
      indexes: [
        {
          unique: true,
          fields: ['bet_number', 'duration'],
          name: 'bet_result_k3s_bet_number_duration_unique'
        }
      ]
    });
  }

  static associate(models) {
    // define associations here
  }
}

module.exports = BetResultK3;