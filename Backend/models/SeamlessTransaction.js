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
      key: 'id'
    }
  },
  game_session_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'seamless_game_sessions',
      key: 'id'
    }
  },
  provider_tx_id: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM('bet', 'win', 'rollback'),
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('pending', 'completed', 'failed', 'rolled_back'),
    allowNull: false,
    defaultValue: 'pending'
  },
  related_tx_id: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Related transaction ID for rollbacks'
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
      fields: ['game_session_id']
    },
    {
      unique: true,
      fields: ['provider_tx_id']
    },
    {
      fields: ['type']
    },
    {
      fields: ['status']
    }
  ]
});

// Establish relationship
User.hasMany(SeamlessTransaction, { foreignKey: 'user_id' });
SeamlessTransaction.belongsTo(User, { foreignKey: 'user_id' });

module.exports = SeamlessTransaction;