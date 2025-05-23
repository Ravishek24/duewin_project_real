const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const GiftCodeClaim = sequelize.define('GiftCodeClaim', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  gift_code_id: { type: DataTypes.INTEGER, allowNull: false },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  claimed_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
}, {
  timestamps: false,
  tableName: 'gift_code_claims'
});

module.exports = GiftCodeClaim; 