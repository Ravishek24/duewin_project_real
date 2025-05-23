const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const WalletRecharge = sequelize.define('WalletRecharge', {
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
    status: {
        type: DataTypes.ENUM('pending', 'completed', 'failed'),
        allowNull: false,
        defaultValue: 'pending'
    },
    bonus_amount: {
        type: DataTypes.DECIMAL(10, 2),
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
    tableName: 'wallet_recharges'
});

module.exports = WalletRecharge;