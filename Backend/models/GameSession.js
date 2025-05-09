// models/GameSession.js
const { sequelize } = require('../config/db');
const { DataTypes } = require('sequelize');
const User = require('./User');

const GameSession = sequelize.define('GameSession', {
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
    tableName: 'game_sessions',
    timestamps: false
});

// Only establish User relationship
User.hasMany(GameSession, { foreignKey: 'user_id' });
GameSession.belongsTo(User, { foreignKey: 'user_id' });

// Export only the model
module.exports = GameSession;