// models/AttendanceRecord.js
import { sequelize } from '../config/db.js';
import { DataTypes } from 'sequelize';
import User from './User.js';

const AttendanceRecord = sequelize.define('AttendanceRecord', {
    id: {
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
    attendance_date: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    streak_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
        comment: 'Current consecutive days streak'
    },
    bonus_claimed: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    bonus_amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'attendance_records',
    timestamps: false,
    indexes: [
        {
            unique: true,
            fields: ['user_id', 'attendance_date']
        }
    ]
});

// Establish relationship
User.hasMany(AttendanceRecord, { foreignKey: 'user_id' });
AttendanceRecord.belongsTo(User, { foreignKey: 'user_id' });

export default AttendanceRecord;