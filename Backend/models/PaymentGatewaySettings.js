const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const PaymentGatewaySettings = sequelize.define('PaymentGatewaySettings', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    gateway_name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    is_deposit_enabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    },
    is_withdrawal_enabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    },
    min_deposit_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
    },
    max_deposit_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 999999.99
    },
    min_withdrawal_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
    },
    max_withdrawal_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 999999.99
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
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
    tableName: 'payment_gateway_settings'
});

module.exports = PaymentGatewaySettings; 