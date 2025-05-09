// models/SeamlessTransaction.js
const { sequelize } = require('../config/db');
const { DataTypes } = require('sequelize');
const User = require('./User.js');

const SeamlessTransaction = sequelize.define('SeamlessTransaction', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'user_id'
    }
  },
  game_type: {
    type: DataTypes.STRING,
    allowNull: false
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM('bet', 'win', 'refund'),
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('pending', 'completed', 'failed'),
    allowNull: false,
    defaultValue: 'pending'
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
  }
}, {
  tableName: 'seamless_transactions',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      fields: ['user_id']
    },
    {
      fields: ['type']
    },
    {
      fields: ['status']
    }
  ]
});

// Add user association only
User.hasMany(SeamlessTransaction, { foreignKey: 'user_id' });
SeamlessTransaction.belongsTo(User, { foreignKey: 'user_id' });

// Export the model only
module.exports = SeamlessTransaction;