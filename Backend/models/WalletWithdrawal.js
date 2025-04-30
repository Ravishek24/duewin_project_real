import { sequelize } from '../config/db.js';
import { DataTypes } from 'sequelize';
import User from './User.js';

const WalletWithdrawal = sequelize.define('WalletWithdrawal', {
    withdrawal_id: {
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
        allowNull: false,
        validate: {
            len: [10, 15] // Ensures phone number length is between 10 and 15 characters
        }
    },
    withdrawal_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    payment_status: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    payment_gateway: {
        type: DataTypes.STRING,
        allowNull: false
    },
    withdrawal_type: {
        type: DataTypes.STRING,
        allowNull: false
    },
    // Order id from our system
    order_id: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    // Transaction id from payment gateway
    transaction_id: {
        type: DataTypes.STRING,
        allowNull: true
    },
    remark: {
        type: DataTypes.STRING,
        allowNull: true
    },
    // New fields for OTP verification
    otp_verified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Whether the withdrawal has been verified via OTP'
    },
    otp_session_id: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'OTP session ID for verification'
    },
    // New field for admin approval status
    admin_status: {
        type: DataTypes.ENUM('pending', 'approved', 'rejected'),
        defaultValue: 'pending',
        comment: 'Status of admin approval for this withdrawal'
    },
    time_of_request: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    time_of_success: {
        type: DataTypes.DATE,
        allowNull: true
    },
    time_of_failed: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    tableName: 'wallet_withdrawals',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

// Set up association
User.hasMany(WalletWithdrawal, { foreignKey: 'user_id' });
WalletWithdrawal.belongsTo(User, { foreignKey: 'user_id' });

export default WalletWithdrawal;