// models/ReferralTree.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const ReferralTree = sequelize.define('ReferralTree', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
        references: {
            model: 'users',
            key: 'user_id'
        }
    },
    referrer_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'users',
            key: 'user_id'
        }
    },
    level_1: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    level_2: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    level_3: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    level_4: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    level_5: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    level_6: {
        type: DataTypes.TEXT,
        allowNull: true
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
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    tableName: 'referral_trees'
});

module.exports = ReferralTree;