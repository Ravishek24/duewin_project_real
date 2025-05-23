// File: Backend/models/ValidReferral.js

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

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
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00
    },
    is_valid: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
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
    tableName: 'valid_referrals',
    indexes: [
        {
            unique: true,
            fields: ['referrer_id', 'referred_id']
        }
    ]
});

module.exports = ValidReferral;