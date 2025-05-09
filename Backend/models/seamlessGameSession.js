// models/SeamlessGameSession.js
const { sequelize } = require('../config/db');
const { DataTypes } = require('sequelize');
const User = require('./User');

const SeamlessGameSession = sequelize.define('SeamlessGameSession', {
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
  session_id: {
    type: DataTypes.STRING,
    allowNull: false
  },
  balance: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0
  },
  status: {
    type: DataTypes.ENUM('active', 'closed'),
    allowNull: false,
    defaultValue: 'active'
  },
  remote_id: {
    type: DataTypes.STRING,
    allowNull: false
  },
  provider: {
    type: DataTypes.STRING,
    allowNull: false
  },
  session_token: {
    type: DataTypes.STRING,
    allowNull: false
  },
  game_id: {
    type: DataTypes.STRING,
    allowNull: true
  },
  game_id_hash: {
    type: DataTypes.STRING,
    allowNull: true
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  ip_address: {
    type: DataTypes.STRING,
    allowNull: true
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  last_activity: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  closed_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'seamless_game_sessions',
  timestamps: false,
  indexes: [
    {
      fields: ['user_id']
    },
    {
      fields: ['session_token']
    },
    {
      fields: ['is_active']
    }
  ]
});

// Only establish User relationship
User.hasMany(SeamlessGameSession, { foreignKey: 'user_id' });
SeamlessGameSession.belongsTo(User, { foreignKey: 'user_id' });

// Export only the model
module.exports = SeamlessGameSession;