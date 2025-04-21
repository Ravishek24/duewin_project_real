// Backend/models/BetResultWingo.js
import { DataTypes } from 'sequelize';
import { sequelize } from '../config/db.js';

const BetResultWingo = sequelize.define('BetResultWingo', {
    bet_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    bet_number: {
        type: DataTypes.STRING, // This holds the period ID
        allowNull: false,
        unique: true
    },
    result_of_number: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    result_of_size: {
        type: DataTypes.ENUM('Big', 'Small'),
        allowNull: false
    },
    result_of_color: {
        type: DataTypes.STRING,
        allowNull: false
    },
    time: {
        type: DataTypes.INTEGER, // Duration of the game in seconds
        allowNull: false
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'bet_result_wingo',
    timestamps: false,
    indexes: [
        {
            unique: true,
            fields: ['bet_number']
        },
        {
            fields: ['created_at']
        }
    ]
});

export default BetResultWingo;