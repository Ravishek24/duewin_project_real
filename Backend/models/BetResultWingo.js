// Backend/models/BetResultWingo.js
const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/db').sequelize;

class BetResultWingo extends Model {}

BetResultWingo.init({
    bet_id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    bet_number: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    result_of_number: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    result_of_size: {
        type: DataTypes.ENUM('Big', 'Small'),
        allowNull: false
    },
    result_of_color: {
        type: DataTypes.STRING,
        allowNull: false
    },
    duration: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'Duration in seconds (30, 60, 180, 300)'
    },
    timeline: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'default',
        comment: 'Timeline identifier (30s, 1m, 3m, 5m)'
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    sequelize,
    modelName: 'BetResultWingo',
    tableName: 'bet_result_wingos',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
});

module.exports = BetResultWingo;