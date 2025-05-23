// Backend/models/BetRecordK3.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const BetRecordK3 = sequelize.define('BetRecordK3', {
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
    period: {
        type: DataTypes.STRING,
        allowNull: false
    },
    bet_type: {
        type: DataTypes.STRING,
        allowNull: false
    },
    bet_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    odds: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    status: {
        type: DataTypes.ENUM('pending', 'won', 'lost'),
        allowNull: false,
        defaultValue: 'pending'
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
    tableName: 'bet_record_k3s'
});

module.exports = BetRecordK3;