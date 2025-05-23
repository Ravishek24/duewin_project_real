// models/SeamlessTransaction.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const SeamlessTransaction = sequelize.define('SeamlessTransaction', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    session_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'seamless_game_sessions',
            key: 'id'
        }
    },
    transaction_type: {
        type: DataTypes.STRING,
        allowNull: false
    },
    amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    balance: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
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
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    tableName: 'seamless_transactions'
});

module.exports = SeamlessTransaction;