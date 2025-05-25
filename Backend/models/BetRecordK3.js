// Backend/models/BetRecordK3.js
const { Model, DataTypes } = require('sequelize');

class BetRecordK3 extends Model {
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
      result: {
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
      modelName: 'BetRecordK3',
      tableName: 'bet_record_k3s',
      timestamps: false,
      indexes: [
        {
          unique: true,
          fields: ['bet_number', 'duration'],
          name: 'bet_record_k3s_bet_number_duration_unique'
        }
      ]
    });
  }

  static associate(models) {
    // define associations here
  }
}

module.exports = BetRecordK3;