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
    password: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            len: [6, 100] // Password must be at least 6 characters long
        }
    },
    referral_code: {
        type: DataTypes.STRING,
        allowNull: false
    },
    referring_code: {
        type: DataTypes.STRING,
        unique: true
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
    }
}, {
    tableName: 'users',
    timestamps: false
});

export default User;
