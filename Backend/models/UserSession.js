const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const UserSession = sequelize.define('UserSession', {
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'Users',
            key: 'id'
        }
    },
    ipAddress: {
        type: DataTypes.STRING,
        allowNull: false
    },
    lastActive: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    expiresAt: {
        type: DataTypes.DATE,
        allowNull: false
    },
    isValid: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    }
});

module.exports = UserSession; 