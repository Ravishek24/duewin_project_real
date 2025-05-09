const { sequelize } = require('../config/db');
const { DataTypes } = require('sequelize');

const User = sequelize.define('User', {
    user_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    email: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true,
        validate: {
            isEmail: true
        }
    },
    phone_no: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true,
        validate: {
            len: [10, 15]
        }
    },
    user_name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            len: [6, 100]
        }
    },
    wallet_balance: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00
    },
    is_phone_verified: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    phone_otp_session_id: {
        type: DataTypes.STRING,
        allowNull: true
    },
    referral_code: {
        type: DataTypes.STRING,
        allowNull: true
    },
    referring_code: {
        type: DataTypes.STRING,
        allowNull: true
    },
    vip_exp: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    vip_level: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    direct_referral_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    referral_level: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    current_ip: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
            isIP: true
        }
    },
    registration_ip: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
            isIP: true
        }
    },
    reset_token: {
        type: DataTypes.STRING,
        allowNull: true
    },
    reset_token_expiry: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    tableName: 'users',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = User;