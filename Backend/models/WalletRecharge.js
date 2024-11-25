import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const WalletRecharge = sequelize.define('WalletRecharge', {
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'users',
            key: 'user_id'
        }
    },
    added_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    payment_gateway_key: {
        type: DataTypes.STRING
    },
    payment_success_key: {
        type: DataTypes.STRING
    },
    time_of_request: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    time_of_success: {
        type: DataTypes.DATE
    }
}, {
    tableName: 'wallet_recharges',
    timestamps: false
});

export default WalletRecharge;
