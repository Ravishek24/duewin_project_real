import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const BetResultTrywix = sequelize.define('BetResultTrywix', {
    bet_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    bet_number: {
        type: DataTypes.STRING, // Bet number/Period
        allowNull: false
    },
    block_time: {
        type: DataTypes.DATE,
        allowNull: false
    },
    hash_value: {
        type: DataTypes.STRING,
        allowNull: false
    },
    block_height: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    big_small: {
        type: DataTypes.ENUM('Big', 'Small'),
        allowNull: false
    },
    colour: {
        type: DataTypes.STRING,
        allowNull: false
    },
    number: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    time: {
        type: DataTypes.INTEGER, // Duration of the game in seconds
        allowNull: false
    }
}, {
    tableName: 'bet_result_trywix',
    timestamps: false
});

export default BetResultTrywix;
