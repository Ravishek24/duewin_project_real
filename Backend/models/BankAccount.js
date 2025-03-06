import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const BankAccount = sequelize.define('BankAccount', {
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'users',
            key: 'user_id'
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
    account_number: {
        type: DataTypes.STRING,
        allowNull: false
    },
    bank_ifsc: {
        type: DataTypes.STRING,
        allowNull: false
    },
    bank_name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    account_holder_name: {
        type: DataTypes.STRING,
        allowNull: false
    }
}, {
    tableName: 'bank_accounts',
    timestamps: false
});

export default BankAccount;
