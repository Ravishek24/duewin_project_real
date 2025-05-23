const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const User = require('./User');

const OtpRequest = sequelize.define('OtpRequest', {
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
    phone_no: {
        type: DataTypes.STRING,
        allowNull: false
    },
    otp_session_id: {
        type: DataTypes.STRING,
        allowNull: false
    },
    request_type: {
        type: DataTypes.ENUM('forgot_password', 'phone_update', 'bank_account', 'admin_login'),
        allowNull: false
    },
    status: {
        type: DataTypes.ENUM('pending', 'verified', 'expired'),
        defaultValue: 'pending'
    }
}, {
    tableName: 'otp_requests',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

// Define associations
OtpRequest.belongsTo(User, { foreignKey: 'user_id' });

module.exports = OtpRequest; 