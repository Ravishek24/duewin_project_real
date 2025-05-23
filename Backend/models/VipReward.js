const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const VipReward = sequelize.define('VipReward', {
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
    level: {
        type: DataTypes.STRING,
        allowNull: false
    },
    reward_type: {
        type: DataTypes.STRING,
        allowNull: false
    },
    reward_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'pending'
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
    tableName: 'vip_rewards'
});

module.exports = VipReward; 