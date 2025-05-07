// models/ReferralCommission.js
import { sequelize } from '../config/db.js';
import { DataTypes } from 'sequelize';
import User from './User.js';

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
            model: User,
            key: 'user_id'
        },
        comment: 'User who earned the commission'
    },
    referred_user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: User,
            key: 'user_id'
        },
        comment: 'User whose activity generated the commission'
    },
    level: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'Level in the referral tree (1-6)'
    },
    amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        comment: 'Commission amount earned'
    },
    type: {
        type: DataTypes.ENUM('bet', 'deposit', 'direct_bonus', 'earned', 'generated'),
        allowNull: false,
        comment: 'Commission type'
    },
    rebate_type: {
        type: DataTypes.ENUM('lottery', 'casino'),
        allowNull: true,
        comment: 'Type of rebate (lottery or casino)'
    },
    distribution_batch_id: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Batch ID for commission distribution run'
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'referral_commissions',
    timestamps: false,
    indexes: [
        {
            fields: ['user_id']
        },
        {
            fields: ['referred_user_id']
        },
        {
            fields: ['distribution_batch_id']
        },
        {
            fields: ['created_at']
        },
        {
            fields: ['type']
        }
    ]
});

export default ReferralCommission;