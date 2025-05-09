const { sequelize } = require('../config/db');
const { DataTypes } = require('sequelize');
const User = require('./User.js');
const PaymentGateway = require('./PaymentGateway.js');

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
    tableName: 'wallet_recharges',
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
            fields: ['status']
        }
    ]
});

// Establish relationships
User.hasMany(WalletRecharge, { foreignKey: 'user_id' });
WalletRecharge.belongsTo(User, { foreignKey: 'user_id' });

PaymentGateway.hasMany(WalletRecharge, { foreignKey: 'payment_gateway_id' });
WalletRecharge.belongsTo(PaymentGateway, { foreignKey: 'payment_gateway_id' });

module.exports = WalletRecharge;