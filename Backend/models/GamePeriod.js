// Backend/models/GamePeriod.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const GamePeriod = sequelize.define('GamePeriod', {
    period_id: {
        type: DataTypes.STRING,
        primaryKey: true,
        comment: 'Unique period identifier (e.g., wingo20230501001)'
    },
    game_type: {
        type: DataTypes.ENUM('wingo', 'fiveD', 'k3'),
        allowNull: false
    },
    duration: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'Duration in seconds (30, 60, 180, 300, 600)'
    },
    start_time: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: 'Period start time'
    },
    end_time: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: 'Period end time'
    },
    is_completed: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Whether the period has completed and results processed'
    },
    result_override: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'JSON string of admin override result (if any)'
    },
    override_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Admin user ID who overrode the result'
    },
    total_bet_amount: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0,
        comment: 'Total amount bet on this period'
    },
    total_payout_amount: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0,
        comment: 'Total payout for this period'
    },
    unique_bettors: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Number of unique users who placed bets'
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
    tableName: 'game_periods',
    timestamps: false,
    indexes: [
        {
            fields: ['game_type', 'duration']
        },
        {
            fields: ['start_time']
        },
        {
            fields: ['end_time']
        },
        {
            fields: ['is_completed']
        }
    ]
});

module.exports = GamePeriod;