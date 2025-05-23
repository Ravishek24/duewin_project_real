const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/db').sequelize;

class BetResultTrxWix extends Model {}

BetResultTrxWix.init({
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
    result_of_hash: {
        type: DataTypes.STRING,
        allowNull: false
    },
    result_of_number: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    result_of_color: {
        type: DataTypes.STRING,
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
    modelName: 'BetResultTrxWix',
    tableName: 'bet_result_trx_wix',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
});

module.exports = BetResultTrxWix; 