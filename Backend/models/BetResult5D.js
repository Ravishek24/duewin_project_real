// Backend/models/BetResult5D.js
'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class BetResult5D extends Model {
    static associate(models) {
      // define associations here
    }
  }
  BetResult5D.init({
    bet_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    bet_number: {
      type: DataTypes.STRING,
      allowNull: false
    },
    result_a: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    result_b: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    result_c: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    result_d: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    result_e: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    total_sum: {
      type: DataTypes.INTEGER,
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
    modelName: 'BetResult5D',
    tableName: 'bet_result_5ds',
    timestamps: false,
    indexes: [
      {
        unique: true,
        fields: ['bet_number', 'duration'],
        name: 'bet_result_5ds_bet_number_duration_unique'
      }
    ]
  });
  return BetResult5D;
};