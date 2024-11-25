import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const User = sequelize.define('User', {
    user_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    referring_code: {
        type: DataTypes.STRING,
        unique: true
    },
    referral_code: {
        type: DataTypes.STRING,
        unique: true
    },
    user_name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    email: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: false
    },
    phone_no: {
        type: DataTypes.STRING,
        unique: true
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false
    },
    wallet_balance: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.00
    },
    current_ip: {
        type: DataTypes.STRING
    },
    registration_ip: {
        type: DataTypes.STRING
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'users',
    timestamps: false
});

export default User;
