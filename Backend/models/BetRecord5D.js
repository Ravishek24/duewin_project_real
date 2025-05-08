// Backend/models/BetRecord5D.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const User = require('./User');

const BetRecord5D = sequelize.define('BetRecord5D', {
    bet_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: User,
            key: 'user_id'
        }
    },
    time: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    bet_category: {
        type: DataTypes.ENUM('A', 'B', 'C', 'D', 'E', 'SUM'),
        allowNull: false
    },
    bet_type: {
        type: DataTypes.ENUM('NUMBER', 'SIZE', 'PARITY'),
        allowNull: false
    },
    bet_value: {
        type: DataTypes.STRING,
        allowNull: false
    },
    bet_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    result_a: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    result_b: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    result_c: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    result_d: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    result_e: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    result_sum: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    win_loss: {
        type: DataTypes.BOOLEAN,
        allowNull: true
    },
    payout_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
    },
    duration: {
        type: DataTypes.INTEGER, // Duration of the game in seconds
        allowNull: false
    },
    period_id: {
        type: DataTypes.STRING,
        allowNull: false
    }
}, {
    tableName: 'bet_record_5d',
    timestamps: false,
    indexes: [
        {
            fields: ['user_id']
        },
        {
            fields: ['period_id']
        },
        {
            fields: ['time']
        }
    ]
});

// Set up relationship
User.hasMany(BetRecord5D, { foreignKey: 'user_id' });
BetRecord5D.belongsTo(User, { foreignKey: 'user_id' });

module.exports = BetRecord5D;