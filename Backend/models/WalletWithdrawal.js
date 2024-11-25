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
    withdrawal_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    time_of_request: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    time_of_success: {
        type: DataTypes.DATE
    }
}, {
    tableName: 'wallet_withdrawals',
    timestamps: false
});

export default WalletWithdrawal;
