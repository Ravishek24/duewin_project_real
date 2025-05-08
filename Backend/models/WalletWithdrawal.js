const { sequelize } = require('../config/db');
const { DataTypes } = require('sequelize');
const User = require('./User.js');

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
            key: 'id'
        }
    },
    amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    payment_method: {
        type: DataTypes.ENUM('bank', 'usdt'),
        allowNull: false
    },
    status: {
        type: DataTypes.ENUM('pending', 'completed', 'failed'),
        allowNull: false,
        defaultValue: 'pending'
    },
    transaction_id: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true
    },
    bank_account_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'bank_accounts',
            key: 'id'
        }
    },
    usdt_account_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'usdt_accounts',
            key: 'id'
        }
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
            fields: ['status']
        },
        {
            fields: ['payment_method']
        }
    ]
});

// Set up association
User.hasMany(WalletWithdrawal, { foreignKey: 'user_id' });
WalletWithdrawal.belongsTo(User, { foreignKey: 'user_id' });

module.exports = WalletWithdrawal;