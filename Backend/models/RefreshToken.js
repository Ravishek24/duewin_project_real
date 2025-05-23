const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const RefreshToken = sequelize.define('RefreshToken', {
    token: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'Users',
            key: 'id'
        }
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

module.exports = RefreshToken; 