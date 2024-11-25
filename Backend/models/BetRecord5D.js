import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

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
            model: 'users',
            key: 'user_id'
        }
    },
    bet_category: {
        type: DataTypes.ENUM('A', 'B', 'C', 'D', 'E')
    },
    odd_even: {
        type: DataTypes.STRING // Odd or Even
    },
    number_result: {
        type: DataTypes.STRING
    },
    total_sum: {
        type: DataTypes.INTEGER
    },
    time: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    win_loss: {
        type: DataTypes.BOOLEAN
    },
    duration: {
        type: DataTypes.INTEGER // Duration of the game in seconds
    }
}, {
    tableName: 'bet_record_5d',
    timestamps: false
});

export default BetRecord5D;
