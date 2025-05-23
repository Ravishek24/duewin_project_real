const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const GiftCode = sequelize.define('GiftCode', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  code: { type: DataTypes.STRING, unique: true, allowNull: false },
  total_amount: { type: DataTypes.DECIMAL(15,2), allowNull: false },
  max_claims: { type: DataTypes.INTEGER, allowNull: false },
  claimed_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  amount_per_user: { type: DataTypes.DECIMAL(15,2), allowNull: false },
  created_by: { type: DataTypes.INTEGER, allowNull: false },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
}, {
  timestamps: false,
  tableName: 'gift_codes'
});

module.exports = GiftCode; 