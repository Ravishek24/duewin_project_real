// Backend/models/BetRecordK3.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const User = require('./User');

const BetRecordK3 = sequelize.define('BetRecordK3', {
    bet_id: {
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
        }
    },
    time: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    bet_type: {
        type: DataTypes.ENUM('SUM', 'SUM_CATEGORY', 'MATCHING_DICE', 'NUMBER_PATTERN'),
        allowNull: false
    },
    bet_category: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Additional category for bet types that need it (like triple_exact, pair_specific)'
    },
    bet_value: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'Specific value bet on (sum number, matching pattern, etc)'
    },
    bet_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    result_dice_1: {
        type: DataTypes.INTEGER, // 1-6
        allowNull: true
    },
    result_dice_2: {
        type: DataTypes.INTEGER, // 1-6
        allowNull: true
    },
    result_dice_3: {
        type: DataTypes.INTEGER, // 1-6
        allowNull: true
    },
    result_sum: {
        type: DataTypes.INTEGER, // 3-18
        allowNull: true
    },
    win_loss: {
        type: DataTypes.BOOLEAN,
        allowNull: true
    },
    payout_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
    },
    duration: {
        type: DataTypes.INTEGER, // Duration of the game in seconds
        allowNull: false
    },
    period_id: {
        type: DataTypes.STRING,
        allowNull: false
    }
}, {
    tableName: 'bet_record_k3',
    timestamps: false,
    indexes: [
        {
            fields: ['user_id']
        },
        {
            fields: ['period_id']
        },
        {
            fields: ['time']
        }
    ]
});

// Set up relationship
User.hasMany(BetRecordK3, { foreignKey: 'user_id' });
BetRecordK3.belongsTo(User, { foreignKey: 'user_id' });

module.exports = BetRecordK3;