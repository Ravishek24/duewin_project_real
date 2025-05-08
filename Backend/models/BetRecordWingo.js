// Backend/models/BetRecordWingo.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const User = require('./User');

const BetRecordWingo = sequelize.define('BetRecordWingo', {
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
    bet_number: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    bet_color: {
        type: DataTypes.STRING,
        allowNull: true
    },
    bet_size: {
        type: DataTypes.ENUM('Big', 'Small'),
        allowNull: true
    },
    bet_parity: {
        type: DataTypes.ENUM('odd', 'even'),
        allowNull: true
    },
    bet_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    result_number: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    result_color: {
        type: DataTypes.STRING,
        allowNull: true
    },
    result_size: {
        type: DataTypes.ENUM('Big', 'Small'),
        allowNull: true
    },
    result_parity: {
        type: DataTypes.ENUM('odd', 'even'),
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
    tableName: 'bet_record_wingo',
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
User.hasMany(BetRecordWingo, { foreignKey: 'user_id' });
BetRecordWingo.belongsTo(User, { foreignKey: 'user_id' });

module.exports = BetRecordWingo;