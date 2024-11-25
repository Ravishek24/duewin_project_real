import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const BetRecordTrywix = sequelize.define('BetRecordTrywix', {
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
    bet_number: {
        type: DataTypes.STRING
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
    tableName: 'bet_record_trywix',
    timestamps: false
});

export default BetRecordTrywix;
