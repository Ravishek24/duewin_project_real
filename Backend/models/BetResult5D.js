// Backend/models/BetResult5D.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const BetResult5D = sequelize.define('BetResult5D', {
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
    result_a: {
        type: DataTypes.INTEGER, // 0-9
        allowNull: false
    },
    result_b: {
        type: DataTypes.INTEGER, // 0-9
        allowNull: false
    },
    result_c: {
        type: DataTypes.INTEGER, // 0-9
        allowNull: false
    },
    result_d: {
        type: DataTypes.INTEGER, // 0-9
        allowNull: false
    },
    result_e: {
        type: DataTypes.INTEGER, // 0-9
        allowNull: false
    },
    total_sum: {
        type: DataTypes.INTEGER, // Sum of all 5 numbers
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
    tableName: 'bet_result_5d',
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

module.exports = BetResult5D;