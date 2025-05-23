const { sequelize } = require('../config/db');
const { DataTypes } = require('sequelize');

const WalletWithdrawal = sequelize.define('WalletWithdrawal', {
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
    amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    payment_gateway_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'payment_gateways',
            key: 'gateway_id'
        }
    },
    transaction_id: {
        type: DataTypes.STRING,
        allowNull: false
    },
    status: {
        type: DataTypes.ENUM('pending', 'completed', 'failed', 'rejected'),
        allowNull: false,
        defaultValue: 'pending'
    },
    admin_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'users',
            key: 'user_id'
        }
    },
    rejection_reason: {
        type: DataTypes.STRING,
        allowNull: true
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
    tableName: 'wallet_withdrawals',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        {
            fields: ['user_id']
        },
        {
            fields: ['payment_gateway_id']
        },
        {
            fields: ['transaction_id']
        },
        {
            fields: ['status']
        },
        {
            fields: ['admin_id']
        }
    ]
});

module.exports = WalletWithdrawal;