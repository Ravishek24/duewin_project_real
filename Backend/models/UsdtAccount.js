const { sequelize } = require('../config/db');
const { DataTypes } = require('sequelize');
const User = require('./User.js');

const UsdtAccount = sequelize.define('UsdtAccount', {
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
    address: {
        type: DataTypes.STRING,
        allowNull: false
    },
    network: {
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
    tableName: 'usdt_accounts',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        {
            fields: ['user_id']
        },
        {
            unique: true,
            fields: ['user_id', 'address']
        }
    ]
});

// Establish relationship
User.hasMany(UsdtAccount, { foreignKey: 'user_id' });
UsdtAccount.belongsTo(User, { foreignKey: 'user_id' });

module.exports = UsdtAccount;
