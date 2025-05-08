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
    referrer_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    referred_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
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
            unique: true,
            fields: ['referrer_id', 'referred_id'],
            name: 'valid_referrals_unique_pair'
        }
    ]
});

// Establish relationships
User.hasMany(ValidReferral, { foreignKey: 'referrer_id', as: 'Referrals' });
ValidReferral.belongsTo(User, { foreignKey: 'referrer_id', as: 'Referrer' });

User.hasOne(ValidReferral, { foreignKey: 'referred_id', as: 'ReferredBy' });
ValidReferral.belongsTo(User, { foreignKey: 'referred_id', as: 'Referred' });

module.exports = ValidReferral;