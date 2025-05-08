// Backend/models/BetResultK3.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const BetResultK3 = sequelize.define('BetResultK3', {
    bet_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    bet_number: {
        type: DataTypes.STRING, // This holds the period ID
        allowNull: false,
        unique: true
    },
    dice_1: {
        type: DataTypes.INTEGER, // 1-6
        allowNull: false
    },
    dice_2: {
        type: DataTypes.INTEGER, // 1-6
        allowNull: false
    },
    dice_3: {
        type: DataTypes.INTEGER, // 1-6
        allowNull: false
    },
    sum: {
        type: DataTypes.INTEGER, // 3-18 (sum of three dice)
        allowNull: false
    },
    has_pair: {
        type: DataTypes.BOOLEAN,
        allowNull: false
    },
    has_triple: {
        type: DataTypes.BOOLEAN,
        allowNull: false
    },
    is_straight: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        comment: 'Three consecutive numbers'
    },
    sum_size: {
        type: DataTypes.ENUM('big', 'small'),
        allowNull: false,
        comment: 'Sum ≥ 11 is big, otherwise small'
    },
    sum_parity: {
        type: DataTypes.ENUM('odd', 'even'),
        allowNull: false
    },
    time: {
        type: DataTypes.INTEGER, // Duration of the game in seconds
        allowNull: false
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'bet_result_k3',
    timestamps: false,
    indexes: [
        {
            unique: true,
            fields: ['bet_number']
        },
        {
            fields: ['created_at']
        }
    ]
});

module.exports = BetResultK3;