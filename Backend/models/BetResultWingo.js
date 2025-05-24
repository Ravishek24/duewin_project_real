// Backend/models/BetResultWingo.js
'use strict';
const { Model, DataTypes } = require('sequelize');

class BetResultWingo extends Model {
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
      result_of_number: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      result_of_size: {
        type: DataTypes.ENUM('Big', 'Small'),
        allowNull: false
      },
      result_of_color: {
        type: DataTypes.STRING,
        allowNull: false
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
        defaultValue: 30,
        comment: 'Duration in seconds (30, 60, 180, 300)'
      }
    }, {
      sequelize,
      modelName: 'BetResultWingo',
      tableName: 'bet_result_wingos',
      timestamps: false,
      indexes: [
        {
          unique: true,
          fields: ['bet_number', 'duration'],
          name: 'bet_result_wingos_bet_number_duration_unique'
        }
      ]
    });
  }

  static associate(models) {
    // define associations here
  }
}

module.exports = BetResultWingo;