// File: Backend/models/ValidReferral.js

import { sequelize } from '../config/db.js';
import { DataTypes } from 'sequelize';
import User from './User.js';

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
            model: User,
            key: 'user_id'
        }
    },
    referred_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: User,
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
        defaultValue: DataTypes.NOW
    },
    updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'valid_referrals',
    timestamps: false,
    indexes: [
        { fields: ['referrer_id'] },
        { fields: ['referred_id'] },
        { unique: true, fields: ['referrer_id', 'referred_id'] }
    ]
});

// Establish relationships
User.hasMany(ValidReferral, { foreignKey: 'referrer_id', as: 'Referrals' });
ValidReferral.belongsTo(User, { foreignKey: 'referrer_id', as: 'Referrer' });

User.hasOne(ValidReferral, { foreignKey: 'referred_id', as: 'ReferredBy' });
ValidReferral.belongsTo(User, { foreignKey: 'referred_id', as: 'Referred' });

export default ValidReferral;