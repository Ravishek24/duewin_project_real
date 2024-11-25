import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const BetResultWingo = sequelize.define('BetResultWingo', {
    bet_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    bet_number: {
        type: DataTypes.INTEGER,
        allowNull: false
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
    }
}, {
    tableName: 'bet_result_wingo',
    timestamps: false
});

export default BetResultWingo;
