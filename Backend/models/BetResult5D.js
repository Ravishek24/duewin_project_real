import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const BetResult5D = sequelize.define('BetResult5D', {
    bet_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    bet_number: {
        type: DataTypes.STRING, 
        allowNull: false
    },
    result: {
        type: DataTypes.STRING, 
        allowNull: false
    },
    total: {
        type: DataTypes.INTEGER, 
        allowNull: false
    },
    time: {
        type: DataTypes.INTEGER,
        allowNull: false
    }
}, {
    tableName: 'bet_result_5d',
    timestamps: false
});

export default BetResult5D;
