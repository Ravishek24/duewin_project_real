const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const User = require('./User');

const ThirdPartyWallet = sequelize.define('ThirdPartyWallet', {
  wallet_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'user_id'
    }
  },
  balance: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  currency: {
    type: DataTypes.STRING(3),
    allowNull: false,
    defaultValue: 'INR'
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  last_updated: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'third_party_wallets',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// Establish relationship with User
ThirdPartyWallet.belongsTo(User, { foreignKey: 'user_id' });
User.hasOne(ThirdPartyWallet, { foreignKey: 'user_id' });

module.exports = ThirdPartyWallet; 