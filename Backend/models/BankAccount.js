const { sequelize } = require('../config/db');
const { DataTypes } = require('sequelize');
const User = require('./User.js');

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
            key: 'user_id'
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
    created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'bank_accounts',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        {
            fields: ['user_id']
        },
        {
            unique: true,
            fields: ['user_id', 'account_number']
        }
    ]
});

// Establish relationship
User.hasMany(BankAccount, { foreignKey: 'user_id' });
BankAccount.belongsTo(User, { foreignKey: 'user_id' });

module.exports = BankAccount;