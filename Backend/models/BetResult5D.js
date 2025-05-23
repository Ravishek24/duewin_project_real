// Backend/models/BetResult5D.js
const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/db').sequelize;

class BetResult5D extends Model {}

BetResult5D.init({
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
    result_a: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    result_b: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    result_c: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    result_d: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    result_e: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    total_sum: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    time: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    sequelize,
    modelName: 'BetResult5D',
    tableName: 'bet_result_5ds',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
});

module.exports = BetResult5D;