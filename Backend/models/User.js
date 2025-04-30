import { sequelize } from '../config/db.js';
import { DataTypes } from 'sequelize';

const User = sequelize.define('User', {
    user_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
            isEmail: true, // Ensures the email format is valid
        }
    },
    phone_no: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
            len: [10, 15] // Ensures phone number length is between 10 and 15 characters
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
            len: [6, 100] // Password must be at least 6 characters long
        }
    },
    wallet_balance: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00
    },
    is_phone_verified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    phone_otp_session_id: {
        type: DataTypes.STRING,
        allowNull: true
    },
    referral_code: {
        type: DataTypes.STRING,
        allowNull: false
    },
    referring_code: {
        type: DataTypes.STRING,
        unique: true
    },
    vip_exp: {
        type: DataTypes.BIGINT,
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
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'L0'
    },
    current_ip: {
        type: DataTypes.STRING,
        validate: {
            isIP: true // Ensures valid IP address format
        }
    },
    registration_ip: {
        type: DataTypes.STRING,
        validate: {
            isIP: true
        }
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'users',
    timestamps: false
});

export default User;