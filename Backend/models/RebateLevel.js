// models/RebateLevel.js
const { sequelize } = require('../config/db');
const { DataTypes } = require('sequelize');
const User = require('./User');

const RebateLevel = sequelize.define('RebateLevel', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    level: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        comment: 'Rebate level code (L0-L10)'
    },
    min_team_members: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'Minimum team members required'
    },
    min_team_betting: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        comment: 'Minimum team betting required'
    },
    min_team_deposit: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        comment: 'Minimum team deposit required'
    },
    lottery_l1_rebate: {
        type: DataTypes.DECIMAL(5, 4),
        allowNull: false,
        comment: 'Level 1 lottery rebate percentage'
    },
    lottery_l2_rebate: {
        type: DataTypes.DECIMAL(5, 4),
        allowNull: false,
        comment: 'Level 2 lottery rebate percentage'
    },
    lottery_l3_rebate: {
        type: DataTypes.DECIMAL(5, 4),
        allowNull: false,
        comment: 'Level 3 lottery rebate percentage'
    },
    lottery_l4_rebate: {
        type: DataTypes.DECIMAL(5, 4),
        allowNull: false,
        comment: 'Level 4 lottery rebate percentage'
    },
    lottery_l5_rebate: {
        type: DataTypes.DECIMAL(5, 4),
        allowNull: false,
        comment: 'Level 5 lottery rebate percentage'
    },
    lottery_l6_rebate: {
        type: DataTypes.DECIMAL(5, 4),
        allowNull: false,
        comment: 'Level 6 lottery rebate percentage'
    },
    casino_l1_rebate: {
        type: DataTypes.DECIMAL(5, 4),
        allowNull: false,
        comment: 'Level 1 casino rebate percentage'
    },
    casino_l2_rebate: {
        type: DataTypes.DECIMAL(5, 4),
        allowNull: false,
        comment: 'Level 2 casino rebate percentage'
    },
    casino_l3_rebate: {
        type: DataTypes.DECIMAL(5, 4),
        allowNull: false,
        comment: 'Level 3 casino rebate percentage'
    },
    casino_l4_rebate: {
        type: DataTypes.DECIMAL(5, 4),
        allowNull: false,
        comment: 'Level 4 casino rebate percentage'
    },
    casino_l5_rebate: {
        type: DataTypes.DECIMAL(5, 4),
        allowNull: false,
        comment: 'Level 5 casino rebate percentage'
    },
    casino_l6_rebate: {
        type: DataTypes.DECIMAL(5, 4),
        allowNull: false,
        comment: 'Level 6 casino rebate percentage'
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
    tableName: 'rebate_levels',
    timestamps: false
});

module.exports = RebateLevel;