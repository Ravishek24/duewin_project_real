// models/ReferralCommission.js
const { sequelize } = require('../config/db');
const { DataTypes } = require('sequelize');
const User = require('./User');

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
            key: 'user_id'
        },
        comment: 'User who earned the commission'
    },
    referred_user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'users',
            key: 'user_id'
        },
        comment: 'User who generated the commission'
    },
    amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        comment: 'Commission amount'
    },
    type: {
        type: DataTypes.ENUM('bet', 'deposit', 'direct_bonus', 'earned', 'generated'),
        allowNull: false,
        comment: 'The type of commission'
    },
    status: {
        type: DataTypes.ENUM('pending', 'paid', 'cancelled'),
        allowNull: false,
        defaultValue: 'pending',
        comment: 'Commission status'
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
    tableName: 'referral_commissions',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        {
            fields: ['user_id']
        },
        {
            fields: ['referred_user_id']
        },
        {
            fields: ['type']
        },
        {
            fields: ['status']
        }
    ],
    scopes: {
        earned: {
            where: { type: 'earned' }
        },
        generated: {
            where: { type: 'generated' }
        }
    }
});

// Define associations
ReferralCommission.associate = (models) => {
    ReferralCommission.belongsTo(models.User, {
        foreignKey: 'user_id',
        as: 'Earner'
    });
    
    ReferralCommission.belongsTo(models.User, {
        foreignKey: 'referred_user_id',
        as: 'Generator'
    });
};

module.exports = ReferralCommission;