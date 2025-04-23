// models/VipLevel.js
import { sequelize } from '../config/db.js';
import { DataTypes } from 'sequelize';

const VipLevel = sequelize.define('VipLevel', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    level: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'VIP level name (e.g., VIP 1, VIP 2)'
    },
    exp_required: {
        type: DataTypes.BIGINT,
        allowNull: false,
        comment: 'Experience points required to reach this level'
    },
    bonus_amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        comment: 'One-time bonus amount when reaching this level'
    },
    monthly_reward: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        comment: 'Monthly reward amount for this level'
    },
    rebate_rate: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        comment: 'Rebate rate for this level (percentage)'
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
    tableName: 'vip_levels',
    timestamps: false
});

export default VipLevel;