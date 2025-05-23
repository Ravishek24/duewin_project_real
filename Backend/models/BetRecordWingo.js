// Backend/models/BetRecordWingo.js
const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/db').sequelize;

class BetRecordWingo extends Model {}

BetRecordWingo.init({
    bet_id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    user_id: {
        type: DataTypes.UUID,
        allowNull: false
    },
    period: {
        type: DataTypes.STRING,
        allowNull: false
    },
    bet_type: {
        type: DataTypes.STRING,
        allowNull: false
    },
    bet_amount: {
        type: DataTypes.DECIMAL(20, 8),
        allowNull: false
    },
    odds: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    status: {
        type: DataTypes.ENUM('pending', 'won', 'lost'),
        defaultValue: 'pending'
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
    sequelize,
    modelName: 'BetRecordWingo',
    tableName: 'bet_record_wingo',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = BetRecordWingo;