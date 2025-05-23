// models/VipLevel.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const VipLevel = sequelize.define('VipLevel', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    level: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true
    },
    required_exp: {
        type: DataTypes.BIGINT,
        allowNull: false,
        defaultValue: 0
    },
    bonus_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00
    },
    monthly_reward: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00
    },
    rebate_rate: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0.00
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
    tableName: 'vip_levels'
});

module.exports = VipLevel;