// Backend/models/BetRecordTrxWix.js
const { Model, DataTypes } = require('sequelize');

class BetRecordTrxWix extends Model {
  static init(sequelize) {
    return super.init({
      result_id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      period: {
        type: DataTypes.STRING,
        allowNull: false
      },
      result: {
        type: DataTypes.JSON,
        allowNull: false
      },
      verification_hash: {
        type: DataTypes.STRING,
        allowNull: false
      },
      verification_link: {
        type: DataTypes.STRING,
        allowNull: false
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
        defaultValue: 60,
        comment: 'Duration in seconds (60, 180, 300, 600)'
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
          unique: true,
          fields: ['period', 'duration'],
          name: 'bet_record_trx_wix_period_duration_unique'
        }
      ]
    });
  }

  static associate(models) {
    // define associations here
  }
}

module.exports = BetRecordTrxWix;