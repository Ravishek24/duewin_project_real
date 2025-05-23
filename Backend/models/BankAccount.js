const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const BankAccount = sequelize.define('BankAccount', {
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
    bank_name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    account_number: {
        type: DataTypes.STRING,
        allowNull: false
    },
    account_holder: {
        type: DataTypes.STRING,
        allowNull: false
    },
    ifsc_code: {
        type: DataTypes.STRING,
        allowNull: false
    },
    is_default: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
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
    tableName: 'bank_accounts'
});

module.exports = BankAccount;