'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class BetResultTrxWix extends Model {
    static associate(models) {
      // define associations here
    }
  }
  BetResultTrxWix.init({
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
      allowNull: false,
      get() {
        const rawValue = this.getDataValue('result');
        return rawValue ? JSON.parse(JSON.stringify(rawValue)) : null;
      },
      set(value) {
        this.setDataValue('result', value);
      }
    },
    verification_hash: {
      type: DataTypes.STRING,
      allowNull: false
    },
    verification_link: {
      type: DataTypes.STRING,
      allowNull: false
    },
    block_number: {
      type: DataTypes.BIGINT,
      allowNull: true,
      comment: 'TRON block number extracted from hash'
    },
    result_time: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: 'Result generation time in IST'
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
    modelName: 'BetResultTrxWix',
    tableName: 'bet_result_trx_wix',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        unique: true,
        fields: ['period', 'duration'],
        name: 'bet_result_trx_wix_period_duration_unique'
      }
    ]
  });
  return BetResultTrxWix;
}; 