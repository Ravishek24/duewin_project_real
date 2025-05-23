// Backend/models/BetResultK3.js
const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/db').sequelize;

class BetResultK3 extends Model {}

BetResultK3.init({
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
    dice_1: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    dice_2: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    dice_3: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    sum: {
        type: DataTypes.INTEGER,
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
        allowNull: false
    },
    sum_size: {
        type: DataTypes.ENUM('big', 'small'),
        allowNull: false
    },
    sum_parity: {
        type: DataTypes.ENUM('odd', 'even'),
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
    modelName: 'BetResultK3',
    tableName: 'bet_result_k3s',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
});

module.exports = BetResultK3;