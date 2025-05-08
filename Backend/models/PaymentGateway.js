// models/PaymentGateway.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const PaymentGateway = sequelize.define('PaymentGateway', {
    gateway_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'Display name of the payment gateway'
    },
    code: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        comment: 'Unique code for the payment gateway (e.g., OKPAY, WEPAY)'
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Description of the payment gateway'
    },
    logo_url: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'URL to the payment gateway logo'
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: 'Whether the gateway is currently active'
    },
    supports_deposit: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: 'Whether the gateway supports deposits'
    },
    supports_withdrawal: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: 'Whether the gateway supports withdrawals'
    },
    min_deposit: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 100.00,
        comment: 'Minimum deposit amount'
    },
    max_deposit: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 100000.00,
        comment: 'Maximum deposit amount'
    },
    min_withdrawal: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 500.00,
        comment: 'Minimum withdrawal amount'
    },
    max_withdrawal: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 50000.00,
        comment: 'Maximum withdrawal amount'
    },
    display_order: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Order to display the payment gateway options'
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
    tableName: 'payment_gateways',
    timestamps: false,
    indexes: [
        {
            unique: true,
            fields: ['code']
        },
        {
            fields: ['is_active']
        }
    ]
});

module.exports = PaymentGateway;