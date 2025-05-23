// models/PaymentGateway.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const PaymentGateway = sequelize.define('PaymentGateway', {
    gateway_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        field: 'gateway_id'
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    code: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    logo_url: {
        type: DataTypes.STRING,
        allowNull: true
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: true
    },
    supports_deposit: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: true
    },
    supports_withdrawal: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: true
    },
    min_deposit: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 100.00
    },
    max_deposit: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 100000.00
    },
    min_withdrawal: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 500.00
    },
    max_withdrawal: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 50000.00
    },
    display_order: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
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
    tableName: 'payment_gateways'
});

module.exports = PaymentGateway;