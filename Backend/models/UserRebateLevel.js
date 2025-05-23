// models/UserRebateLevel.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const UserRebateLevel = sequelize.define('UserRebateLevel', {
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
    rebate_level: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'L0'
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    tableName: 'user_rebate_levels'
});

module.exports = UserRebateLevel;