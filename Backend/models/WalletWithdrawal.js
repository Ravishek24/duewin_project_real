import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const WalletWithdrawal = sequelize.define('WalletWithdrawal', {
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
    withdrawal_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    payment_status: {
        type: DataTypes.BOOLEAN
    },
    payment_gateway: {
        type: DataTypes.STRING
    },
    withdrawal_type: {
        type: DataTypes.STRING
    },
    remark: {
        type: DataTypes.STRING
    },
    time_of_request: {
        type: DataTypes.DATE
    },
    time_of_success: {
        type: DataTypes.DATE
    },
    time_of_failed: {
        type: DataTypes.DATE
    }
}, {
    tableName: 'wallet_withdrawals',
    timestamps: false
});

export default WalletWithdrawal;
