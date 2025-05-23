// models/ReferralCommission.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

// Base ReferralCommission model
const ReferralCommission = sequelize.define('ReferralCommission', {
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
    referred_user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    level: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
    },
    amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00
    },
    type: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'Type of commission (bet, direct_bonus, etc.)'
    },
    rebate_type: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Type of rebate (lottery, casino)'
    },
    distribution_batch_id: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Batch ID for commission distribution'
    },
    status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'pending',
        comment: 'Status of commission (pending, paid, cancelled)'
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
    tableName: 'referral_commissions'
});

module.exports = ReferralCommission;