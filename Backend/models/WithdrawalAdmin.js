const { sequelize } = require('../config/db');
const { DataTypes } = require('sequelize');
const User = require('./User');
const WalletWithdrawal = require('./WalletWithdrawal');

const WithdrawalAdmin = sequelize.define('WithdrawalAdmin', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    withdrawal_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: WalletWithdrawal,
            key: 'withdrawal_id'
        }
    },
    admin_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: User,
            key: 'user_id'
        },
        comment: 'ID of admin who processed the approval/rejection'
    },
    status: {
        type: DataTypes.ENUM('pending', 'approved', 'rejected'),
        defaultValue: 'pending'
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Admin notes or reason for rejection'
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    processed_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'When the admin processed the withdrawal'
    }
}, {
    tableName: 'withdrawal_admin',
    timestamps: false,
    indexes: [
        {
            fields: ['withdrawal_id']
        },
        {
            fields: ['status']
        }
    ]
});

// Establish relationships
WalletWithdrawal.hasOne(WithdrawalAdmin, { foreignKey: 'withdrawal_id' });
WithdrawalAdmin.belongsTo(WalletWithdrawal, { foreignKey: 'withdrawal_id' });

User.hasMany(WithdrawalAdmin, { foreignKey: 'admin_id', as: 'ProcessedWithdrawals' });
WithdrawalAdmin.belongsTo(User, { foreignKey: 'admin_id', as: 'ProcessedBy' });

module.exports = WithdrawalAdmin;