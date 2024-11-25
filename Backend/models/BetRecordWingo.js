import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

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
            model: 'users',
            key: 'user_id'
        }
    },
    time: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    bet_number: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    bet_color: {
        type: DataTypes.STRING
    },
    bet_size: {
        type: DataTypes.ENUM('Big', 'Small')
    },
    result_color: {
        type: DataTypes.STRING
    },
    result_number: {
        type: DataTypes.INTEGER
    },
    result_size: {
        type: DataTypes.ENUM('Big', 'Small')
    },
    win_loss: {
        type: DataTypes.BOOLEAN
    },
    duration: {
        type: DataTypes.INTEGER // Duration of the game in seconds
    }
}, {
    tableName: 'bet_record_wingo',
    timestamps: false
});

export default BetRecordWingo;
