// File: Backend/models/ValidReferral.js

const { sequelize } = require('../config/db');
const { DataTypes } = require('sequelize');
const User = require('./User.js');

const ValidReferral = sequelize.define('ValidReferral', {
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
    referred_user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'users',
            key: 'user_id'
        }
    },
    total_recharge: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0.00
    },
    is_valid: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Whether this referral has recharged ≥300'
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
    tableName: 'valid_referrals',
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
            unique: true,
            fields: ['user_id', 'referred_user_id']
        }
    ]
});

// Establish relationships
User.hasMany(ValidReferral, { foreignKey: 'user_id' });
ValidReferral.belongsTo(User, { foreignKey: 'user_id' });

User.hasMany(ValidReferral, { foreignKey: 'referred_user_id' });
ValidReferral.belongsTo(User, { foreignKey: 'referred_user_id', as: 'referredUser' });

module.exports = ValidReferral;